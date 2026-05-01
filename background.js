const OLLAMA_URL = "http://localhost:11434/api/generate";
const OLLAMA_MODEL = "ministral-3:3b";
const SYSTEM_PROMPT =
  "You are a privacy editor. Rewrite the following text to remove all personal identifiers, specific locations, and unique style markers while keeping the core meaning and utility intact. Output only the rewritten text.";

chrome.runtime.onInstalled.addListener(async () => {
  const state = await chrome.storage.local.get("enabled");
  if (typeof state.enabled !== "boolean") {
    await chrome.storage.local.set({ enabled: true });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "neutralize_text") {
    const tabId = sender.tab?.id;
    const requestId = message.requestId;

    if (!tabId || !requestId || typeof message.text !== "string") {
      sendResponse({ ok: false, error: "Invalid neutralization request." });
      return false;
    }

    streamNeutralization({
      tabId,
      requestId,
      text: message.text
    }).catch((error) => {
      chrome.tabs.sendMessage(tabId, {
        type: "neutralize_error",
        requestId,
        error: error?.message || "Unknown error."
      });
    });

    sendResponse({ ok: true });
    return true;
  }

  return false;
});

async function streamNeutralization({ tabId, requestId, text }) {
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      system: SYSTEM_PROMPT,
      prompt: text,
      stream: true
    })
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Ollama request failed (${response.status}): ${bodyText}`);
  }

  if (!response.body) {
    throw new Error("No response body from Ollama.");
  }

  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  let buffer = "";
  let done = false;
  let sentAnyChunk = false;

  while (!done) {
    const chunk = await reader.read();
    done = chunk.done;

    if (chunk.value) {
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        const parsed = safeParse(line);
        if (!parsed) {
          continue;
        }

        if (typeof parsed.response === "string" && parsed.response.length > 0) {
          sentAnyChunk = true;
          chrome.tabs.sendMessage(tabId, {
            type: "neutralize_chunk",
            requestId,
            chunk: parsed.response
          });
        }

        if (parsed.done) {
          chrome.tabs.sendMessage(tabId, {
            type: "neutralize_done",
            requestId,
            empty: !sentAnyChunk
          });
          return;
        }
      }
    }
  }

  if (buffer.trim()) {
    const parsed = safeParse(buffer.trim());
    if (parsed?.response) {
      chrome.tabs.sendMessage(tabId, {
        type: "neutralize_chunk",
        requestId,
        chunk: parsed.response
      });
      sentAnyChunk = true;
    }
  }

  chrome.tabs.sendMessage(tabId, {
    type: "neutralize_done",
    requestId,
    empty: !sentAnyChunk
  });
}

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}
