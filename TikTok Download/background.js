// Function to convert video to audio
async function convertToAudio(videoUrl) {
    try {
        const response = await fetch(videoUrl);
        const videoBlob = await response.blob();
        
        // Create a temporary video element
        const video = document.createElement('video');
        video.src = URL.createObjectURL(videoBlob);
        
        // Create audio context
        const audioContext = new AudioContext();
        const source = audioContext.createMediaElementSource(video);
        const destination = audioContext.createMediaStreamDestination();
        source.connect(destination);
        
        // Create MediaRecorder
        const mediaRecorder = new MediaRecorder(destination.stream);
        const chunks = [];
        
        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(chunks, { type: 'audio/mp3' });
            URL.revokeObjectURL(video.src);
            return audioBlob;
        };
        
        // Start recording and playing
        mediaRecorder.start();
        await video.play();
        await new Promise(resolve => setTimeout(resolve, video.duration * 1000));
        mediaRecorder.stop();
        
        return mediaRecorder.onstop();
    } catch (error) {
        console.error('Audio conversion failed:', error);
        throw error;
    }
}

// Keep track of popup state
let isPopupVisible = false;

// Handle downloads and audio conversion
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'downloadAudio') {
        // Use third-party API for audio downloads
        const apiUrl = 'https://tiktalmp3download.cresotech.com/download';
        
        fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: request.pageUrl
            })
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success || !data.fileUrl) {
                throw new Error(data.message || 'Audio conversion failed');
            }
            return chrome.downloads.download({
                url: data.fileUrl,
                filename: request.filename,
                saveAs: true
            });
        })
        .then(downloadId => {
            sendResponse({ success: true, downloadId });
        })
        .catch(error => {
            console.error('Audio download failed:', error);
            sendResponse({ success: false, error: error.message });
        });

        return true;
    } else if (request.type === 'download') {
        // For video downloads, download directly
        chrome.downloads.download({
            url: request.url,
            filename: request.filename,
            saveAs: true
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ success: true, downloadId });
            }
        });
        return true;
    }
});

function extractVideoId(url) {
    const match = url.match(/video\/(\d+)/);
    return match ? match[1] : '';
}

// This function will be injected into the page
function extractAudio(url, filename) {
    const video = document.querySelector('video');
    if (!video) return;

    // Create a MediaRecorder to record the audio
    const stream = video.captureStream();
    const audioTrack = stream.getAudioTracks()[0];
    
    if (!audioTrack) {
        console.error('No audio track found');
        return;
    }

    const mediaStream = new MediaStream([audioTrack]);
    const mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType: 'audio/webm'
    });

    const chunks = [];
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(blob);
        
        // Create download link
        const a = document.createElement('a');
        a.href = audioUrl;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(audioUrl);
        }, 100);
    };

    // Start recording current audio
    mediaRecorder.start();
    
    // Record for the duration of the video
    setTimeout(() => {
        mediaRecorder.stop();
    }, video.duration * 1000);
}

// Utility function to convert AudioBuffer to WAV
function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const length = buffer.length * numChannels * 2;
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, length, true);
    
    // Write audio data
    const channels = [];
    for (let i = 0; i < numChannels; i++) {
        channels.push(buffer.getChannelData(i));
    }
    
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
            const sample = Math.max(-1, Math.min(1, channels[channel][i]));
            view.setInt16(offset, sample * 0x7FFF, true);
            offset += 2;
        }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// Handle keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
    if (command === "_execute_action") {
        if (isPopupVisible) {
            // Hide popup
            chrome.action.setPopup({ popup: "" });
            isPopupVisible = false;
        } else {
            // Show popup
            chrome.action.setPopup({ popup: "popup.html" });
            isPopupVisible = true;
        }
    }
});

// Initialize popup state
chrome.runtime.onInstalled.addListener(() => {
    isPopupVisible = true;
    chrome.action.setPopup({ popup: "popup.html" });
}); 