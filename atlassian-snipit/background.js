const SERVER_URL = 'https://json2tree.ap-southeast-2.dev.atl-paas.net';
// const SERVER_URL = 'http://127.0.0.1:8080';

// Create context menu on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'take-screenshot',
    title: 'Take Screenshot',
    contexts: ['page', 'selection', 'link', 'image']
  });
  chrome.contextMenus.create({
    id: 'take-screenshot-delayed',
    title: 'Take Screenshot in 3 Seconds',
    contexts: ['page', 'selection', 'link', 'image']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const loggedIn = await checkLogin();
  if (!loggedIn) {
    chrome.tabs.create({ url: `${SERVER_URL}/login` });
    return;
  }

  if (info.menuItemId === 'take-screenshot') {
    // Inject the content script and CSS into the active tab.
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['style.css'],
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
  } else if (info.menuItemId === 'take-screenshot-delayed') {
    // Inject the content script with delayed mode
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['style.css'],
    });
    // Set config before loading content script
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        window.screenshotConfig = { delayedMode: true, delay: 3000 };
      }
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
  }
});

// A function to check if the user is logged in.
async function checkLogin() {
  try {
    const response = await fetch(`${SERVER_URL}/login_user_info`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

// A function to check if an offscreen document is already active.
async function hasOffscreenDocument(path) {
  const offscreenUrl = chrome.runtime.getURL(path);
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });
  return contexts.length > 0;
}

// This is the main entry point. When the user clicks the extension's icon.
chrome.action.onClicked.addListener(async (tab) => {
  const loggedIn = await checkLogin();
  if (!loggedIn) {
    chrome.tabs.create({ url: `${SERVER_URL}/login` });
    return;
  }

  // Inject the content script and CSS into the active tab.
  await chrome.scripting.insertCSS({
    target: { tabId: tab.id },
    files: ['style.css'],
  });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  });
});

// Listen for messages from other parts of the extension.
chrome.runtime.onMessage.addListener(async (request, sender) => {
  // Message from content script to capture the screen.
  if (request.type === 'capture') {
    const tab = sender.tab;
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      
      // To crop the image, we need a canvas, which is not available in service workers.
      // We create an offscreen document to host the canvas.
      if (!await hasOffscreenDocument('offscreen.html')) {
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['DOM_PARSER'],
            justification: 'To crop the screenshot on a canvas',
        });
      }

      // Send message to the offscreen document to perform the cropping.
      chrome.runtime.sendMessage({
        type: 'crop-image',
        dataUrl: dataUrl,
        area: request.area,
        dpr: request.dpr,
        url: tab.url
      });
    } catch (e) {
      console.error("Error capturing tab:", e);
    }
  } else if (request.type === 'cropped-image') {
    // Message from the offscreen document with the cropped image and original URL.
    const { dataUrl, url } = request;

    // Option 1: Open in editor tab
    // await chrome.storage.local.set({ screenshotDataUrl: dataUrl, originalUrl: url });
    // await chrome.tabs.create({ url: 'editor.html' });

    // Option 2: Upload directly
    await uploadScreenshot(dataUrl, url);
  } else if (request.type === 'upload-annotated-image') {
    const { dataUrl, url } = request;
    await uploadScreenshot(dataUrl, url);
  }
});

async function uploadScreenshot(dataUrl, url) {
    // Truncate URL for display if longer than 100 characters
    const truncatedURL = url.length > 100 
      ? url.substring(0, 50) + '...' + url.substring(url.length - 47)
      : url;

    // Create simplified HTML content matching the server-side editing format
    const htmlContent = `<div style="padding: 10px; background: #f5f5f5; border-bottom: 1px solid #ddd; font-family: -apple-system, sans-serif; text-align: center;"><a href="${url}" target="_blank" style="color: #0052cc; text-decoration: none; font-size: 14px;">${truncatedURL}</a></div><div style="text-align: center;"><img src="${dataUrl}" style="display: inline-block;"></div>`;
    const htmlDataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
    
    // Upload the file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `screenshot-${timestamp}.html`;
    
    try {
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const formData = new FormData();
      formData.append('file', blob, filename);

      const response = await fetch(`${SERVER_URL}/screenshot/upload`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        const displayUrl = `${SERVER_URL}/screenshot/display?id=${data.id}`;
        
        // Ensure offscreen document exists for clipboard operation
        if (!await hasOffscreenDocument('offscreen.html')) {
          await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['CLIPBOARD'],
            justification: 'To copy URL to clipboard',
          });
        }
        
        // Copy display URL to clipboard via offscreen document
        await chrome.runtime.sendMessage({
          type: 'copy-to-clipboard',
          text: 'http://go/screenshot/' + data.id
        });
        
        await chrome.tabs.create({ url: displayUrl });
        console.log('Screenshot uploaded successfully');
      } else {
        const errorText = await response.text();
        console.error('Failed to upload screenshot:', response.status, response.statusText, errorText);
        console.log('Opening fallback tab with data URL...');
        await chrome.tabs.create({ url: htmlDataUrl });
      }
    } catch (error) {
      console.error('Error uploading screenshot:', error);
      await chrome.tabs.create({ url: htmlDataUrl });
    }
}
