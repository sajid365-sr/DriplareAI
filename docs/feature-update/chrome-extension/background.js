// Background Service Worker for Driplare AI Chrome Extension
chrome.runtime.onInstalled.addListener(() => {
  console.log("[Driplare AI] Chrome Extension installed successfully.");
  chrome.storage.sync.get(["apiUrl"], (result) => {
    if (!result.apiUrl) {
      chrome.storage.sync.set({ apiUrl: "https://driplare.com" });
    }
  });
});

// Proxy API requests from content script to bypass CORS if necessary
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "DRIPLARE_API_CALL") {
    chrome.storage.sync.get(["apiUrl", "apiKey"], async ({ apiUrl, apiKey }) => {
      const baseUrl = apiUrl || "https://driplare.com";
      try {
        const response = await fetch(`${baseUrl}${request.endpoint}`, {
          method: request.method || "GET",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            ...request.headers,
          },
          body: request.body ? JSON.stringify(request.body) : undefined,
        });

        const data = await response.json().catch(() => ({}));
        sendResponse({ success: response.ok, status: response.status, data });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    });
    return true; // Keep message channel open for async response
  }
});

