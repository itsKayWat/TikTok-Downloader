document.addEventListener('DOMContentLoaded', function() {
    const downloadVideo = document.getElementById('downloadVideo');
    const downloadAudio = document.getElementById('downloadAudio');
    const downloadBoth = document.getElementById('downloadBoth');
    const status = document.getElementById('status');

    // Check if we're on a TikTok page
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentTab = tabs[0];
        const isTikTok = currentTab.url.includes('tiktok.com');
        
        if (!isTikTok) {
            status.textContent = 'Please open a TikTok video to download';
            return;
        }
    });

    // Listen for video status updates
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'videoStatus') {
            downloadVideo.disabled = !request.hasVideo;
            downloadAudio.disabled = !request.hasVideo;
            downloadBoth.disabled = !request.hasVideo;
        }
    });

    function download(action) {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: action}, function(response) {
                if (!response || !response.success) {
                    status.textContent = response?.error || 'Download failed';
                }
            });
        });
    }

    downloadVideo.addEventListener('click', () => download('downloadVideo'));
    downloadAudio.addEventListener('click', () => download('downloadAudio'));
    downloadBoth.addEventListener('click', () => download('downloadBoth'));

    document.getElementById('documentation').addEventListener('click', () => {
        window.open(chrome.runtime.getURL('documentation.html'), '_blank');
    });
});