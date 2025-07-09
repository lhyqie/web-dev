// This script runs in the offscreen document to handle canvas operations.
chrome.runtime.onMessage.addListener(handleMessages);

async function handleMessages(message) {
  // We only expect 'crop-image' messages.
  if (message.type !== 'crop-image') {
    return;
  }
  const { dataUrl, area, dpr, url } = message;
  const croppedDataUrl = await cropImage(dataUrl, area, dpr, url);
  // Send the cropped image data URL back to the service worker.
  await chrome.runtime.sendMessage({ type: 'cropped-image', dataUrl: croppedDataUrl, url: url });
}

function cropImage(dataUrl, area, dpr, url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      // Define annotation properties, scaled by device pixel ratio
      const PADDING = 10 * dpr;
      const FONT_SIZE = 14 * dpr;
      const FONT_FAMILY = 'Arial';
      const TEXT_COLOR = '#ffffff';
      const BG_COLOR = '#212121';
      const ANNOTATION_HEIGHT = FONT_SIZE + (PADDING * 2);

      // Create a canvas that fits the cropped image and the annotation area.
      const canvas = new OffscreenCanvas(area.width * dpr, area.height * dpr + ANNOTATION_HEIGHT);
      const ctx = canvas.getContext('2d');

      // --- Annotation Drawing ---
      // Draw the annotation background bar.
      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, canvas.width, ANNOTATION_HEIGHT);
      
      // Truncate URL if it's too long to fit, to avoid overflow.
      let displayText = url;
      const maxWidth = canvas.width - (PADDING * 2);
      if (ctx.measureText(displayText).width > maxWidth) {
        // A simple truncation logic from the end.
        while (ctx.measureText(displayText + '...').width > maxWidth && displayText.length > 0) {
          displayText = displayText.slice(0, -1);
        }
        displayText += '...';
      }

      // Configure text properties.
      ctx.fillStyle = TEXT_COLOR;
      ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Draw the text in the middle of the annotation bar.
      ctx.fillText(displayText, canvas.width / 2, ANNOTATION_HEIGHT / 2);

      // --- Image Drawing ---
      // Draw the cropped image portion below the annotation bar.
      ctx.drawImage(image, area.x * dpr, area.y * dpr, area.width * dpr, area.height * dpr, 0, ANNOTATION_HEIGHT, area.width * dpr, area.height * dpr);

      // Convert the canvas to a Blob, then to a data URL.
      canvas.convertToBlob({ type: 'image/png' }).then(blob => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read blob as data URL.'));
        reader.readAsDataURL(blob);
      });
    };
    image.onerror = () => reject(new Error('Image failed to load.'));
    image.src = dataUrl;
  });
}