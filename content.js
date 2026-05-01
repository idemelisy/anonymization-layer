const BUTTON_ID = "lpw-neutralize-btn";
const REQUEST_TIMEOUT_MS = 120000;

let enabled = true;
let activeEditable = null;
let activeRequestId = null;
let requestStartedAt = 0;
let streamedText = "";

const button = createButton();
document.documentElement.appendChild(button);

init().catch(() => {});

async function init() {
  const state = await chrome.storage.local.get("enabled");
  enabled = typeof state.enabled === "boolean" ? state.enabled : true;
  updateButtonVisibility();

  document.addEventListener("focusin", handleFocusIn, true);
  document.addEventListener("scroll", updateButtonPosition, true);
  window.addEventListener("resize", updateButtonPosition);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !Object.prototype.hasOwnProperty.call(changes, "enabled")) {
      return;
    }
    enabled = Boolean(changes.enabled.newValue);
    if (!enabled) {
      resetRequestState();
    }
    updateButtonVisibility();
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || !message.type || message.requestId !== activeRequestId) {
      return;
    }

    if (message.type === "neutralize_chunk") {
      streamedText += message.chunk || "";
      writeToEditable(activeEditable, streamedText);
      return;
    }

    if (message.type === "neutralize_done") {
      finalizeRequest();
      return;
    }

    if (message.type === "neutralize_error") {
      finalizeRequest(message.error || "Neutralization failed.");
    }
  });
}

function handleFocusIn(event) {
  const target = getEditableHost(event.target);
  if (!target || !isEditableElement(target)) {
    return;
  }
  activeEditable = target;
  updateButtonVisibility();
  updateButtonPosition();
}

function createButton() {
  const element = document.createElement("button");
  element.id = BUTTON_ID;
  element.type = "button";
  element.textContent = "Neutralize";
  Object.assign(element.style, {
    position: "fixed",
    zIndex: "2147483647",
    display: "none",
    padding: "8px 10px",
    borderRadius: "999px",
    border: "none",
    background: "#111827",
    color: "#ffffff",
    fontSize: "12px",
    fontFamily: "Arial, sans-serif",
    cursor: "pointer",
    boxShadow: "0 6px 16px rgba(0, 0, 0, 0.25)"
  });

  element.addEventListener("click", onNeutralizeClick);
  return element;
}

async function onNeutralizeClick() {
  if (!enabled || !activeEditable || activeRequestId) {
    return;
  }

  const sourceText = readFromEditable(activeEditable);
  if (!sourceText.trim()) {
    flashButton("No text");
    return;
  }

  activeRequestId = crypto.randomUUID();
  requestStartedAt = Date.now();
  streamedText = "";
  setButtonBusy(true);

  try {
    const response = await chrome.runtime.sendMessage({
      type: "neutralize_text",
      requestId: activeRequestId,
      text: sourceText
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Background request rejected.");
    }
  } catch (error) {
    finalizeRequest(error?.message || "Could not reach background service.");
    return;
  }

  window.setTimeout(() => {
    if (activeRequestId && Date.now() - requestStartedAt >= REQUEST_TIMEOUT_MS) {
      finalizeRequest("Request timed out.");
    }
  }, REQUEST_TIMEOUT_MS + 50);
}

function updateButtonVisibility() {
  const shouldShow = enabled && isEditableElement(activeEditable);
  button.style.display = shouldShow ? "block" : "none";
  if (shouldShow) {
    updateButtonPosition();
  }
}

function updateButtonPosition() {
  if (button.style.display === "none" || !activeEditable) {
    return;
  }

  const rect = activeEditable.getBoundingClientRect();
  const top = Math.max(8, rect.top + 8);
  const right = window.innerWidth - rect.right + 8;
  button.style.top = `${top}px`;
  button.style.right = `${Math.max(8, right)}px`;
}

function isEditableElement(node) {
  if (!(node instanceof HTMLElement)) {
    return false;
  }

  if (node.tagName === "TEXTAREA") {
    return true;
  }

  if (node.tagName === "INPUT") {
    const input = node;
    const type = (input.type || "").toLowerCase();
    return ["text", "search", "email", "url", "tel"].includes(type);
  }

  if (node.isContentEditable) {
    return true;
  }

  return false;
}

function getEditableHost(node) {
  if (!(node instanceof HTMLElement)) {
    return null;
  }

  const directEditable = node.closest("textarea, input, [contenteditable='true'], [contenteditable='plaintext-only']");
  if (!(directEditable instanceof HTMLElement)) {
    return null;
  }

  if (directEditable.tagName === "INPUT" || directEditable.tagName === "TEXTAREA") {
    return directEditable;
  }

  // Ensure writes target the contenteditable container itself, not a nested inline node.
  const contenteditableHost = directEditable.closest("[contenteditable='true'], [contenteditable='plaintext-only']");
  return contenteditableHost instanceof HTMLElement ? contenteditableHost : directEditable;
}

function readFromEditable(node) {
  if (!node) {
    return "";
  }
  if (node instanceof HTMLTextAreaElement || node instanceof HTMLInputElement) {
    return node.value || "";
  }
  return node.innerText || "";
}

function writeToEditable(node, value) {
  if (!node) {
    return;
  }

  if (node instanceof HTMLTextAreaElement || node instanceof HTMLInputElement) {
    node.value = value;
    node.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  node.textContent = value;
  node.dispatchEvent(new Event("input", { bubbles: true }));
}

function finalizeRequest(errorMessage) {
  if (errorMessage) {
    flashButton("Error");
    console.warn("[LocalPrivacyFirewall]", errorMessage);
  }
  resetRequestState();
}

function resetRequestState() {
  activeRequestId = null;
  streamedText = "";
  requestStartedAt = 0;
  setButtonBusy(false);
}

function setButtonBusy(isBusy) {
  button.disabled = isBusy;
  button.style.opacity = isBusy ? "0.7" : "1";
  button.style.cursor = isBusy ? "wait" : "pointer";
  button.textContent = isBusy ? "Neutralizing..." : "Neutralize";
}

function flashButton(label) {
  const original = button.textContent;
  button.textContent = label;
  window.setTimeout(() => {
    button.textContent = activeRequestId ? "Neutralizing..." : "Neutralize";
    if (!activeRequestId && original && original !== label) {
      button.textContent = "Neutralize";
    }
  }, 1200);
}
