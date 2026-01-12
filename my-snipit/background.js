// const SERVER_URL = 'https://json2tree.ap-southeast-2.dev.atl-paas.net';
const SERVER_URL = 'http://127.0.0.1:8080';

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

    // Truncate URL for display if longer than 100 characters
    const truncatedURL = url.length > 100 
      ? url.substring(0, 50) + '...' + url.substring(url.length - 47)
      : url;

    // Create an HTML page that displays the image as a clickable link.
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Screenshot</title>
          <style>
            body { 
              margin: 0; 
              background-color: white; 
              display: flex; 
              flex-direction: column;
              justify-content: center; 
              align-items: center; 
              min-height: 100vh;
              padding: 20px;
            }
            .url-link { 
              color: blue; 
              text-decoration: underline; 
              margin-bottom: 20px;
              font-family: Arial, sans-serif;
              font-size: 14px;
            }
            .image-container a { 
              display: block; 
            }
            img { 
              max-width: 100vw; 
              max-height: 80vh; 
              box-shadow: 0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23); 
            }
          </style>
        </head>
        <body>
          <a href="${url}" target="_blank" class="url-link" title="${url}">${truncatedURL}</a>
          <div class="image-container">
            <a href="${url}" target="_blank" title="Click to open original page: ${url}">
              <img src="${dataUrl}" alt="Captured from ${url}">
            </a>
          </div>
        </body>
      </html>
    `;
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
          text: 'go/screenshot/' + data.id
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
});
