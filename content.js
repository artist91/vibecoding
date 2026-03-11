const SVG_DOWNLOAD_ICON = `<svg aria-label="Download" class="ig-download-svg" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"></path><polyline points="7 10 12 15 17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"></polyline><line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"></line></svg>`;

// Function to find the highest resolution image URL from an img element
function getHighResImageUrl(imgElement) {
    // Check srcset first
    if (imgElement.srcset) {
        const sources = imgElement.srcset.split(',');
        let highestRes = 0;
        let bestUrl = '';

        sources.forEach(source => {
            const parts = source.trim().split(' ');
            if (parts.length === 2) {
                const url = parts[0];
                const res = parseInt(parts[1].replace('w', ''));
                if (res > highestRes) {
                    highestRes = res;
                    bestUrl = url;
                }
            }
        });

        if (bestUrl) return bestUrl;
    }

    // Fallback to regular src
    return imgElement.src;
}

// Function to handle the download button click
function handleDownload(e, imgElement, btn) {
    e.preventDefault();
    e.stopPropagation();

    const url = getHighResImageUrl(imgElement);

    if (!url) {
        console.error('Could not find image URL to download.');
        return;
    }

    // Show loading state
    btn.classList.add('loading');

    // Send message to background script to download the image
    chrome.runtime.sendMessage({ action: 'downloadImage', url: url }, (response) => {
        btn.classList.remove('loading');

        if (response && response.success) {
            // Show success state briefly
            btn.classList.add('success');
            btn.innerHTML = '✅';
            setTimeout(() => {
                btn.classList.remove('success');
                btn.innerHTML = SVG_DOWNLOAD_ICON;
            }, 2000);
        } else {
            console.error('Download failed:', response?.error);
            alert('Failed to download image. See console for details.');
        }
    });
}

// Function to inject download button into a target container
function injectButton(container) {
    // Check if button already exists in this container
    if (container.querySelector('.ig-download-btn-wrapper')) {
        return;
    }

    // Look for the image inside this container
    // Note: Instagram's DOM changes, so we look for standard img tags
    // We exclude avatars by ensuring the container is of a certain size or structure,
    // but targeting the article or modal image container usually filters naturally.
    const imgElement = container.querySelector('img[style*="object-fit: cover"]');

    if (!imgElement || !imgElement.src) return;

    // Create button wrapper and button
    const wrapper = document.createElement('div');
    wrapper.className = 'ig-download-btn-wrapper';

    const btn = document.createElement('button');
    btn.className = 'ig-download-btn';
    btn.innerHTML = SVG_DOWNLOAD_ICON;
    btn.title = 'Download Image';

    // Attach click listener
    btn.addEventListener('click', (e) => handleDownload(e, imgElement, btn));

    wrapper.appendChild(btn);

    // To place it at the top right of the image, we append it to the container
    // The container should have position: relative for this to work correctly via CSS
    container.appendChild(wrapper);

    // Force container to be relative if it isn't, so absolute positioning works
    const style = window.getComputedStyle(container);
    if (style.position === 'static') {
        container.style.position = 'relative';
    }
}

// Main function to scan the DOM for image containers
function scanForImages() {
    // Instagram typically wraps feed images and modal images in a specific way.
    // We can look for divs that contain the actual images.
    // Targeting divs that have class like '_aagv' (often used for photo wrappers)
    // Since classes change, a more robust way is to find img tags and go up to their container.

    const images = document.querySelectorAll('img[style*="object-fit: cover"]');

    images.forEach(img => {
        // Look 2 levels up for the stable container (usually the wrapper that constrains the image)
        const container = img.parentElement.parentElement;
        if (container && !container.querySelector('.ig-download-btn-wrapper')) {
            injectButton(container);
        }
    });
}

// Set up MutationObserver to detect when new posts load (infinite scroll or modals)
const observer = new MutationObserver((mutations) => {
    let shouldScan = false;
    for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
            shouldScan = true;
            break;
        }
    }

    if (shouldScan) {
        // Slight delay to allow React/Instagram to finish rendering the DOM
        setTimeout(scanForImages, 300);
    }
});

// Start observing the document body
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Initial scan
scanForImages();
