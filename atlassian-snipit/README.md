## Why doing this?

- Screenshot should be considered as data living in the cloud that has a UUID. Sharing screenshot is via the link not by copy-n-paste the raw screenshot.

- One's screenshots are now easier to be found in chronological order in a central place.

- Some UI only supports text, this is the case where screenshot sharing via links is more convenient.

- When writing a long doc with references to many screenshots, it is better to insert the links to screenshots rather than the screenshot images.

## How to Use it?

### A. Download Extension
TODO: publish a chrome extension.

### B. Deploy Locally directly with source code.

1. clone this repo
2. open chrome://extensions
3. click "load unpacked", select this folder `atlassian-snipit`
4. Find the chrome tab that has a URL
5. Click the chrome extension icon to take a screenshot within this chrome page
6. A screenshot is uploaded, and its permanent link is opened in a new chrome tab (for example https://json2tree.ap-southeast-2.dev.atl-paas.net/screenshot/display?id=dJWSNaHYTeOxJS6IWFtzIA) and clipboard now has the shorter go link that points to the same link: [go/screenshot/dJWSNaHYTeOxJS6IWFtzIA](http://go/screenshot/dJWSNaHYTeOxJS6IWFtzIA)
7. To view all screenshots: [go/screenshot](http://go/screenshot)

## Related Reference

#### Atlassian Guide for Chrome Extension Local Developement
https://hello.atlassian.net/wiki/spaces/cskb/pages/5477285235/GUIDE+Publishing+Chrome+Extensions#Publishing-finished-extensions

#### Chrome Extension Console
https://chrome.google.com/webstore/devconsole/0b2f1730-fa87-4485-9c6a-f308c62705e2
