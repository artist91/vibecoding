const SVG_DOWNLOAD_ICON = `<svg aria-label="Download" class="ig-download-svg" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"></path><polyline points="7 10 12 15 17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"></polyline><line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"></line></svg>`;

// Function to find the highest resolution image URL from an img element
function getHighResImageUrl(imgElement) {
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
    
    // Sometimes high-res image is in a sibling or previous element if this is a blurred placeholder.
    // However, if we filter properly, we shouldn't hit the placeholder.
    return imgElement.src;
}

// Function to handle the download button click
function handleDownload(e, imgElement, btn) {
    e.preventDefault();
    e.stopPropagation();

    const url = getHighResImageUrl(imgElement);

    if (!url || url.startsWith('data:')) {
        console.error('Could not find image URL to download.');
        alert('Failed to find high resolution image.');
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
function injectButton(container, imgElement) {
    if (container.querySelector('.ig-download-btn-wrapper')) {
        return;
    }

    // Create button wrapper and button
    const wrapper = document.createElement('div');
    wrapper.className = 'ig-download-btn-wrapper';

    const btn = document.createElement('button');
    btn.className = 'ig-download-btn';
    btn.innerHTML = SVG_DOWNLOAD_ICON;
    btn.title = 'Download High-Res Image';

    // Attach click listener
    btn.addEventListener('click', (e) => handleDownload(e, imgElement, btn));

    wrapper.appendChild(btn);
    container.appendChild(wrapper);

    // Force container to be relative if it isn't, so absolute positioning works
    const style = window.getComputedStyle(container);
    if (style.position === 'static') {
        container.style.position = 'relative';
    }
}

// Main function to scan the DOM for image containers
function scanForImages() {
    // Only look within <article> tags (Feed and Modal posts), ignore the profile grid.
    const articles = document.querySelectorAll('article');
    
    articles.forEach(article => {
        // Find all images within each article
        const images = article.querySelectorAll('img');

        images.forEach(img => {
            // 1. Filter out UI elements and avatars by checking minimum dimensions
            if (img.clientWidth > 0 && img.clientWidth < 150) return;
            if (img.clientHeight > 0 && img.clientHeight < 150) return;
            
            // 2. Filter out base64 blurry placeholders
            if (img.src && img.src.startsWith('data:')) return;
            
            // 3. Instagram overlay placeholders often don't have srcset, or have very small intrinsic size
            if (img.naturalWidth > 0 && img.naturalWidth < 150) return;

            // Target the direct parent of the image. 
            // In a carousel, each image represents a slide and is usually wrapped in an li or div that moves horizontally.
            // Appending to the parent ensures the button moves alongside the image in the carousel.
            const container = img.parentElement;
            
            if (container && !container.querySelector('.ig-download-btn-wrapper')) {
                injectButton(container, img);
            }
        });
    });
}

// Set up MutationObserver to detect when new posts load (infinite scroll or modals or carousel sliding)
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
