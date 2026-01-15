const express = require('express');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer');
const path = require('path');

// --- CONFIGURATION ---
const PORT = 3000;
const STREAM_KEY = process.argv[2]; // Pass stream key as argument
const RTMP_URL = "rtmp://a.rtmp.youtube.com/live2"; // YouTube Ingest (Change for TikTok/Twitch)
const SCREEN_WIDTH = 720;
const SCREEN_HEIGHT = 1280;

if (!STREAM_KEY) {
    console.error("❌ Error: You must provide a Stream Key!");
    console.error("Usage: node stream_bot.js <YOUR_STREAM_KEY>");
    process.exit(1);
}

// 1. Start Static Server
const app = express();
app.use(express.static(__dirname)); // Serve current folder
const server = app.listen(PORT, () => {
    console.log(`✅ Game Server running on http://localhost:${PORT}`);
    startStream();
});

async function startStream() {
    // 2. Launch Browser (Headful mode inside Xvfb)
    console.log("🚀 Launching Browser...");
    const browser = await puppeteer.launch({
        headless: false, // Must be false to render graphics
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--kiosk', // Fullscreen mode
            `--window-size=${SCREEN_WIDTH},${SCREEN_HEIGHT}`,
            '--autoplay-policy=no-user-gesture-required'
        ],
        executablePath: '/usr/bin/google-chrome' // Common path, might adjust
    });

    const page = await browser.newPage();
    await page.setViewport({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT });
    await page.goto(`http://localhost:${PORT}/index.html`);

    console.log("✅ Game Loaded. Starting FFmpeg...");

    // 3. Start FFmpeg (Capturing X11 Display)
    // We assume this script is run with 'xvfb-run', so DISPLAY is set (usually :99)
    const display = process.env.DISPLAY || ':99';

    const ffmpegArgs = [
        '-f', 'x11grab',
        '-s', `${SCREEN_WIDTH}x${SCREEN_HEIGHT}`,
        '-r', '30', // 30 FPS
        '-i', `${display}.0+0,0`, // Capture Display
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-b:v', '3000k', // Bitrate
        '-maxrate', '3000k',
        '-bufsize', '6000k',
        '-pix_fmt', 'yuv420p',
        '-g', '60', // Keyframe interval (2s for 30fps)
        '-f', 'flv',
        `${RTMP_URL}/${STREAM_KEY}`
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);

    ffmpeg.stderr.on('data', (data) => {
        // console.log(`ffmpeg: ${data}`); // Uncomment to debug ffmpeg
    });

    ffmpeg.on('close', (code) => {
        console.log(`🛑 FFmpeg exited with code ${code}`);
        browser.close();
        server.close();
        process.exit(code);
    });

    console.log("🔴 Streaming Live! Press Ctrl+C to stop.");
}
