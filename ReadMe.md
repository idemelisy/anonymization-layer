Local Privacy Firewall - Beginner Setup Guide
=============================================

This guide explains everything from zero:
1) Install Ollama
2) Download the Ministral 3B model
3) Start Ollama with Chrome-extension CORS enabled
4) Load this extension into Chrome
5) Test that neutralization works


1) Install Ollama
-----------------
Official download page:
https://ollama.com/download

Install for your operating system (Windows/macOS/Linux), then open a terminal:
- Windows: PowerShell
- macOS/Linux: Terminal

Verify install:
ollama --version


2) Download the model (one-time)
--------------------------------
Run:
ollama pull ministral-3:3b

If this succeeds, the model is now available locally.


3) Start Ollama server with CORS for Chrome Extensions
------------------------------------------------------
This extension sends requests from a chrome-extension:// origin.
You must allow this origin, or requests will be blocked.

Windows (PowerShell):
$env:OLLAMA_ORIGINS="chrome-extension://*"
ollama serve

macOS/Linux (bash/zsh):
export OLLAMA_ORIGINS="chrome-extension://*"
ollama serve

Keep this terminal open while using the extension.


4) Load extension in Chrome (Developer mode)
--------------------------------------------
1. Open Chrome
2. Go to: chrome://extensions
3. Turn ON "Developer mode" (top-right)
4. Click "Load unpacked"
5. Select this folder:"anonymization-layer"

After loading, you should see "Local Privacy Firewall" in your extensions list.


5) First test
-------------
1. Open a page with an editable area (for example ChatGPT or Gmail compose)
2. Click inside a text box/contenteditable field
3. Click the "Neutralize" button
4. You should see rewritten text stream back into the field


Troubleshooting
---------------
- Error: model not found
  Run:
  ollama pull ministral-3:3b

- Error: connection/CORS blocked
  Make sure Ollama is started with:
  OLLAMA_ORIGINS="chrome-extension://*"

- Nothing happens after clicking Neutralize
  1) Confirm Ollama is running (`ollama serve` terminal still open)
  2) In chrome://extensions, click "Reload" on this extension
  3) Refresh the target web page and try again


Optional: Use a different local model
-------------------------------------
If you want another model, edit this constant in background.js:
const OLLAMA_MODEL = "ministral-3:3b";

Then reload the extension in chrome://extensions.