// Load FFmpeg
const ffmpegScript = document.createElement('script');
ffmpegScript.src = chrome.runtime.getURL('lib/ffmpeg.min.js');
document.head.appendChild(ffmpegScript);

// Load FFmpeg core
const ffmpegCoreScript = document.createElement('script');
ffmpegCoreScript.src = chrome.runtime.getURL('lib/ffmpeg-core.js');
document.head.appendChild(ffmpegCoreScript); 