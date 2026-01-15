const express = require('express');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer');
const path = require('path');

// --- CONFIGURATION ---
const PORT = 3000;
const STREAM_KEY = process.argv[2];
const RTMP_URL = "rtmp://a.rtmp.youtube.com/live2";
const SCREEN_WIDTH = 720;
const SCREEN_HEIGHT = 1280;

if (!STREAM_KEY) {
    console.error("❌ Error: You must provide a Stream Key!");
    process.exit(1);
}

// 1. Start Static Server with Debugging
const app = express();

// MIDDLEWARE: Log every request
app.use((req, res, next) => {
    console.log(`📥 HTTP Request: ${req.method} ${req.url}`);
    next();
});

app.use(express.static(__dirname));

const server = app.listen(PORT, '127.0.0.1', () => { // Bind to IPv4 explicitly
    console.log(`✅ Game Server running on http://127.0.0.1:${PORT}`);
    console.log(`📂 Serving files from: ${__dirname}`);
    startStream();
});

async function startStream() {
    console.log("🚀 Launching Browser...");
    const browser = await puppeteer.launch({
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--kiosk',
            `--window-size=${SCREEN_WIDTH},${SCREEN_HEIGHT}`,
            '--autoplay-policy=no-user-gesture-required'
        ],
        executablePath: '/usr/bin/google-chrome'
    });

    const page = await browser.newPage();
    await page.setViewport({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT });

    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('requestfailed', request => {
        console.log(`❌ BROWSER LOAD FAIL: ${request.url()} - ${request.failure().errorText}`);
    });

    // Use 127.0.0.1
    try {
        await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle2' });
    } catch (e) {
        console.error("❌ Error loading page:", e);
    }

    console.log("✅ Page loaded commands sent. Starting FFmpeg...");

    const display = process.env.DISPLAY || ':99';

    const ffmpegArgs = [
        '-f', 'x11grab',
        '-s', `${SCREEN_WIDTH}x${SCREEN_HEIGHT}`,
        '-r', '30',
        '-i', `${display}.0+0,0`,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-b:v', '3000k',
        '-maxrate', '3000k',
        '-bufsize', '6000k',
        '-pix_fmt', 'yuv420p',
        '-g', '60',
        '-f', 'flv',
        `${RTMP_URL}/${STREAM_KEY}`
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);

    ffmpeg.stderr.on('data', (data) => {
        // console.log(`ffmpeg: ${data}`); // Keep commented to reduce noise unless needed
    });

    ffmpeg.on('close', (code) => {
        console.log(`🛑 FFmpeg exited with code ${code}`);
        browser.close();
        server.close();
        process.exit(code);
    });

    console.log("🔴 Streaming Live! Check YouTube.");
}
