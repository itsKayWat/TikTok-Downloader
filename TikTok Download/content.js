'use strict';

// Function to convert video to audio using FFmpeg
async function convertToAudio(videoBlob) {
    const ffmpeg = FFmpeg.createFFmpeg({ 
        log: true,
        corePath: chrome.runtime.getURL('lib/ffmpeg-core.js')
    });
    await ffmpeg.load();

    // Write video file to FFmpeg's virtual filesystem
    ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(videoBlob));

    // Run FFmpeg command to extract audio as MP3
    await ffmpeg.run('-i', 'input.mp4', '-vn', '-acodec', 'libmp3lame', '-q:a', '2', 'output.mp3');

    // Read the result
    const data = ffmpeg.FS('readFile', 'output.mp3');
    
    // Cleanup
    ffmpeg.FS('unlink', 'input.mp4');
    ffmpeg.FS('unlink', 'output.mp3');

    return new Blob([data.buffer], { type: 'audio/mp3' });
}

function initDownloader() {
    // Check if we're on a TikTok video page and notify popup
    function checkForVideo() {
        const videoUrl = findVideoUrl();
        chrome.runtime.sendMessage({
            type: 'videoStatus',
            hasVideo: !!videoUrl
        });
    }

    function getAudioName() {
        const audioName = 
            document.querySelector('[data-e2e="browse-music"]')?.textContent ||
            document.querySelector('[data-e2e="music-title"]')?.textContent ||
            document.querySelector('.sound-title')?.textContent ||
            'original_sound';
        
        return audioName.trim().replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50);
    }

    function findVideoUrl() {
        // Try to find the video URL in the page source
        const pageSource = document.documentElement.innerHTML;
        
        // Look for the playAddr in the JSON data
        const jsonMatch = pageSource.match(/"playAddr":"([^"]+)"/);
        if (jsonMatch) {
            const url = jsonMatch[1].replace(/\\u002F/g, '/');
            console.log('Found video URL from JSON:', url);
            return url;
        }

        // Try to find direct video URL
        const urlMatch = pageSource.match(/https:\/\/[^"']*\.(?:mp4|m3u8)[^"']*/);
        if (urlMatch) {
            console.log('Found video URL from source:', urlMatch[0]);
            return urlMatch[0];
        }

        // Try video element
        const videoElement = document.querySelector('video');
        if (videoElement?.src) {
            console.log('Found video URL from video element:', videoElement.src);
            return videoElement.src;
        }

        return null;
    }

    // Remove any existing message listeners
    chrome.runtime.onMessage.removeListener(handleDownloadRequest);

    // Message listener
    function handleDownloadRequest(request, sender, sendResponse) {
        console.log('Download request received:', request);

        try {
            const timestamp = Date.now();
            const audioName = getAudioName();
            const videoUrl = findVideoUrl();

            if (!videoUrl) {
                throw new Error('Video URL not found');
            }

            // Send to background script for download
            chrome.runtime.sendMessage({
                type: request.action === 'downloadAudio' ? 'downloadAudio' : 'download',
                url: videoUrl,
                pageUrl: window.location.href,
                filename: request.action === 'downloadAudio' 
                    ? `${audioName}_${timestamp}.mp3`
                    : `${audioName}_${timestamp}.mp4`
            }, response => {
                if (response.success) {
                    sendResponse({ success: true });
                } else {
                    sendResponse({ success: false, error: response.error });
                }
            });

        } catch (error) {
            console.error('Download failed:', error);
            sendResponse({ success: false, error: error.message });
        }

        return true;
    }

    // Add the message listener
    chrome.runtime.onMessage.addListener(handleDownloadRequest);

    // Check for video periodically
    setInterval(checkForVideo, 1000);

    // Initial check
    checkForVideo();
}

// Initialize the downloader only once
if (!window.downloaderInitialized) {
    window.downloaderInitialized = true;
    initDownloader();
}

// Debug logging
window.addEventListener('load', () => {
    console.log('TikTok Downloader: Ready');
    const videos = document.querySelectorAll('video');
    console.log('Found video elements:', videos.length);
    videos.forEach((v, i) => {
        console.log(`Video ${i}:`, {
            src: v.src,
            currentSrc: v.currentSrc
        });
    });
});