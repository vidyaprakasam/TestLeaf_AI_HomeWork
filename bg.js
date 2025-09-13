/**
 * Thischrome.action.onClicked.addListener((tab) => {
  // This opens the side panel in Chrome (Experimental APIs).
  // Adjust if you're using a different approach or want to open a popup window, etc.
  try {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ windowId: tab.windowId });
    } else {
      console.warn('Side panel API not available, opening popup instead');
      chrome.windows.create({
        url: chrome.runtime.getURL('panel.html'),
        type: 'popup',
        width: 400,
        height: 600
      });
    }
  } catch (error) {
    console.error('Error opening side panel:', error);
    // Fallback to popup
    chrome.windows.create({
      url: chrome.runtime.getURL('panel.html'),
      type: 'popup',
      width: 400,
      height: 600
    });
  }
});y will hold the aggregated selections from content.js.
 * Alternatively, you can store them directly in chrome.storage.sync
 * after each new selection rather than keeping them in memory.
 */
let selectedElements = [];

/**
 * Handler: When the user clicks the extension’s toolbar icon,
 * we open or focus the side panel associated with the current window.
 */
chrome.action.onClicked.addListener((tab) => {
  // This opens the side panel in Chrome (Experimental APIs).
  // Adjust if you’re using a different approach or want to open a popup window, etc.
  chrome.sidePanel.open({ windowId: tab.windowId });
});

/**
 * Listen for messages from content.js or other parts of the extension.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SELECTED_DOM_CONTENT') {
    /**
     * content.js is sending the combined outerHTML of all currently selected elements.
     * Usually, you'll want to store each update or the final snippet for the user’s next step.
     */
    console.log('[background.js] Received snippet:\n', message.content);

    const combinedSnippet = message.content; // string of concatenated outerHTML lines

    // For demonstration, store in memory:
    selectedElements = [combinedSnippet];

    // Also store it in chrome.storage.sync for easy retrieval in sidepanel or chat:
    chrome.storage.local.set({ combinedDomSnippet: combinedSnippet }, () => {
      console.log('[background] Stored combinedDomSnippet in chrome.storage.local:', combinedSnippet);
    });

    sendResponse({ success: true });
    return true; // async
  }

  // Handle GitHub API requests
  if (message.type === 'GITHUB_API_REQUEST') {
    // Use async/await pattern that works with Chrome extension messaging
    (async () => {
      try {
        const result = await handleGitHubAPIRequest(message);
        sendResponse(result);
      } catch (error) {
        sendResponse({
          success: false,
          status: 0,
          data: null,
          error: error.message
        });
      }
    })();
    return true; // Keep the message channel open for async response
  }

  return false; // no other message types handled
});

/**
 * Handle GitHub API requests from the extension pages
 */
async function handleGitHubAPIRequest(message) {
  console.log('[background] Handling GitHub API request:', message.url);
  try {
    const { url, options } = message;
    console.log('[background] Making fetch request to:', url);
    const response = await fetch(url, options);
    console.log('[background] Fetch response status:', response.status);
    
    let data = {};
    try {
      data = await response.json();
    } catch (jsonError) {
      console.log('[background] JSON parse error (expected for some responses):', jsonError.message);
    }
    
    const result = {
      success: response.ok,
      status: response.status,
      data: data,
      error: response.ok ? null : `GitHub API error: ${response.status} - ${data.message || 'Unknown error'}`
    };
    
    console.log('[background] Returning result:', result);
    return result;
  } catch (error) {
    console.error('[background] Network error:', error);
    return {
      success: false,
      status: 0,
      data: null,
      error: `Network error: ${error.message}`
    };
  }
}

/**
 * Handle extension unload (e.g., browser shutting down, extension disabled).
 * We attempt to send a 'CLEANUP' message to each tab so it can remove highlights, etc.
 */
chrome.runtime.onSuspend.addListener(async () => {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'CLEANUP' });
      } catch (error) {
        // Ignore errors for tabs where the content script is not running
      }
    }
  } catch (error) {
    console.error('Error during extension cleanup:', error);
  }
});
