document.addEventListener("DOMContentLoaded", function() {
    const captureButton = document.getElementById("capture");
  
    captureButton.addEventListener("click", function() {
      // First, get the current tab to access its URL
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        const currentTab = tabs[0];
        if (!currentTab || !currentTab.url) {
          console.error("Could not get current tab's URL.");
          return;
        }
        const tabUrl = currentTab.url;

        // Capture the visible tab's content
        chrome.tabs.captureVisibleTab(null, { format: "png" }, function(screenshotDataUrl) {
          if (!screenshotDataUrl) {
            console.error("Failed to capture screenshot.");
            return;
          }
          
          // Instead of drawing on a canvas, create an HTML page with a clickable link
          const htmlContent = `
            <!DOCTYPE html>
            <html>
              <head>
                <title>Screenshot of ${tabUrl}</title>
                <style>
                  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #202124; }
                  img { display: block; width: 100%; height: auto; }
                  a.url-annotation {
                    position: fixed;
                    bottom: 20px;
                    left: 20px;
                    padding: 10px 15px;
                    background-color: rgba(0, 0, 0, 0.7);
                    color: white;
                    text-decoration: none;
                    border-radius: 8px;
                    font-size: 16px;
                    transition: background-color 0.2s ease;
                  }
                  a.url-annotation:hover {
                    background-color: rgba(0, 0, 0, 0.9);
                    text-decoration: underline;
                  }
                </style>
              </head>
              <body>
                <a href="${tabUrl}" target="_blank" rel="noopener noreferrer" class="url-annotation">
                  ${tabUrl}
                </a>
                <img src="${screenshotDataUrl}" alt="Screenshot of ${tabUrl}" />
              </body>
            </html>
          `;

          // Create a data URL for the HTML content
          const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent);

          // Open the HTML page in a new tab
          chrome.tabs.create({ url: dataUrl });
        });
      });
    });
  });
  