// This script runs in the offscreen document to handle canvas operations.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessages(message, sendResponse);
  return true; // Keep the channel open for async response
});

async function handleMessages(message, sendResponse) {
  // Handle copy-to-clipboard messages
  if (message.type === 'copy-to-clipboard') {
    try {
      // Try using the Clipboard API
      await navigator.clipboard.writeText(message.text);
      console.log('Copied to clipboard via Clipboard API:', message.text);
      sendResponse({ success: true });
    } catch (err) {
      console.error('Clipboard API failed, trying fallback:', err);
      try {
        // Fallback: use a textarea
        const textarea = document.createElement('textarea');
        textarea.value = message.text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        console.log('Copied to clipboard via execCommand:', success, message.text);
        sendResponse({ success: success });
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
        sendResponse({ success: false, error: fallbackErr.message });
      }
    }
    return;
  }
  
  // We only expect 'crop-image' messages.
  if (message.type !== 'crop-image') {
    return;
  }
  const { dataUrl, area, dpr, url } = message;
  const { dataUrl: croppedDataUrl, width, height } = await cropImage(dataUrl, area, dpr, url);
  // Send the cropped image data URL back to the service worker.
  await chrome.runtime.sendMessage({ type: 'cropped-image', dataUrl: croppedDataUrl, url: url, width, height });
}

function cropImage(dataUrl, area, dpr, url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      // Create a canvas that fits the cropped image only (no annotation bar)
      const width = Math.round(area.width * dpr);
      const height = Math.round(area.height * dpr);
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');

      // Draw the cropped image portion
      ctx.drawImage(image, area.x * dpr, area.y * dpr, area.width * dpr, area.height * dpr, 0, 0, width, height);

      // Convert the canvas to a Blob, then to a data URL.
      canvas.convertToBlob({ type: 'image/png' }).then(blob => {
        const reader = new FileReader();
        reader.onload = () => resolve({
          dataUrl: reader.result,
          width: canvas.width,
          height: canvas.height
        });
        reader.onerror = () => reject(new Error('Failed to read blob as data URL.'));
        reader.readAsDataURL(blob);
      });
    };
    image.onerror = () => reject(new Error('Image failed to load.'));
    image.src = dataUrl;
  });
}