chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'downloadImage' && request.url) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `ig_highres_${timestamp}.jpg`;

        chrome.downloads.download({
            url: request.url,
            filename: filename,
            saveAs: false // Automatically save without prompt
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                console.error('Download failed:', chrome.runtime.lastError);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
                console.log('Download started with ID:', downloadId);
                sendResponse({ success: true, downloadId: downloadId });
            }
        });

        // Return true to indicate we wish to send a response asynchronously
        return true;
    }
});
