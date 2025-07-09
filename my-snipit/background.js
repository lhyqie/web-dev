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

    // Create an HTML page that displays the image as a clickable link.
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Screenshot</title>
          <style>
            body { margin: 0; background-color: #202124; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
            a { display: block; }
            img { max-width: 100vw; max-height: 100vh; box-shadow: 0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23); }
          </style>
        </head>
        <body>
          <a href="${url}" target="_blank" title="Click to open original page: ${url}">
            <img src="${dataUrl}" alt="Captured from ${url}">
          </a>
        </body>
      </html>
    `;
    const htmlDataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);
    await chrome.tabs.create({ url: htmlDataUrl });
    await chrome.offscreen.closeDocument();
  }
});
