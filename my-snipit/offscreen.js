// This script runs in the offscreen document to handle canvas operations.
chrome.runtime.onMessage.addListener(handleMessages);

async function handleMessages(message) {
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
      const canvas = new OffscreenCanvas(area.width * dpr, area.height * dpr);
      const ctx = canvas.getContext('2d');

      // Draw the cropped image portion
      ctx.drawImage(image, area.x * dpr, area.y * dpr, area.width * dpr, area.height * dpr, 0, 0, area.width * dpr, area.height * dpr);

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