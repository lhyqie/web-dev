((config) => {
  // Avoid running the script multiple times on the same page
  if (window.hasRun) {
    return;
  }
  window.hasRun = true;

  const delayedMode = config.delayedMode || false;
  const delay = config.delay || 3000;

  let startX, startY;
  let isSelecting = false;

  const overlay = document.createElement('div');
  overlay.id = 'screenshot-overlay';
  document.body.appendChild(overlay);

  const selectionBox = document.createElement('div');
  selectionBox.id = 'screenshot-selection-box';
  document.body.appendChild(selectionBox);

  const cleanup = () => {
    // Check if the elements exist before trying to remove them
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    if (selectionBox.parentNode) {
      selectionBox.parentNode.removeChild(selectionBox);
    }
    window.removeEventListener('mousedown', handleMouseDown);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
    window.removeEventListener('keydown', handleKeyDown);
    delete window.hasRun;
  };

  const handleKeyDown = (e) => {
    // If the user presses Escape, cancel the selection.
    if (e.key === 'Escape') {
      cleanup();
    }
  };

  const handleMouseDown = (e) => {
    // Prevent default browser behavior, like text selection.
    e.preventDefault();
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
    selectionBox.style.left = `${startX}px`;
    selectionBox.style.top = `${startY}px`;
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.style.display = 'block';
  };

  const handleMouseMove = (e) => {
    if (!isSelecting) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    selectionBox.style.left = `${left}px`;
    selectionBox.style.top = `${top}px`;
    selectionBox.style.width = `${width}px`;
    selectionBox.style.height = `${height}px`;
  };

  const handleMouseUp = (e) => {
    if (!isSelecting) return;
    isSelecting = false;

    const rect = selectionBox.getBoundingClientRect();

    // Hide UI elements before taking the screenshot
    overlay.style.display = 'none';
    selectionBox.style.display = 'none';

    // Use a small delay to ensure the DOM has updated and the overlay is gone.
    setTimeout(() => {
      // Only capture if the selection is a meaningful size (e.g., > 5x5 pixels)
      if (rect.width > 5 && rect.height > 5) {
        chrome.runtime.sendMessage({
          type: 'capture',
          area: {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
          },
          dpr: window.devicePixelRatio
        });
      }
      // Clean up the UI and event listeners.
      cleanup();
    }, 100);
  };

  // Handle delayed mode
  if (delayedMode) {
    // Hide overlay immediately so content is visible
    overlay.style.display = 'none';
    
    // Wait for the delay, then capture
    setTimeout(() => {
      const rect = {
        left: window.scrollX,
        top: window.scrollY,
        width: window.innerWidth,
        height: window.innerHeight
      };
      
      chrome.runtime.sendMessage({
        type: 'capture',
        area: {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height
        },
        dpr: window.devicePixelRatio
      });
      
      cleanup();
    }, delay);
    
    // Allow ESC to cancel
    window.addEventListener('keydown', handleKeyDown);
  } else {
    // Add all event listeners to the window for normal mode.
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
  }
})(window.screenshotConfig || {});
