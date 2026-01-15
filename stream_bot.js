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

app.use((req, res, next) => {
    // console.log(`📥 HTTP Request: ${req.method} ${req.url}`); 
    next();
});

app.use(express.static(__dirname));

const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`✅ Game Server running on http://127.0.0.1:${PORT}`);
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

    try {
        await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle2' });
    } catch (e) {
        console.error("❌ Error loading page:", e);
    }

    console.log("✅ Game Loaded. Starting FFmpeg...");

    const display = process.env.DISPLAY || ':99';

    const ffmpegArgs = [
        // INPUT 0: VIDEO (X11)
        '-f', 'x11grab',
        '-s', `${SCREEN_WIDTH}x${SCREEN_HEIGHT}`,
        '-r', '25', // 25 FPS (ECO MODE)
        '-i', `${display}.0+0,0`,

        // INPUT 1: AUDIO (Silence Generator)
        '-f', 'lavfi',
        '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',

        // MAP STREAMS
        '-map', '0:v',
        '-map', '1:a',

        // VIDEO ENCODING
        '-c:v', 'libx264',
        '-preset', 'ultrafast', // ULTRAFAST (ECO MODE)
        '-b:v', '2000k',        // 2000k (BALANCED)
        '-maxrate', '2000k',
        '-bufsize', '4000k',
        '-pix_fmt', 'yuv420p',
        '-g', '50',

        // AUDIO ENCODING
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '44100',

        '-f', 'flv',
        `${RTMP_URL}/${STREAM_KEY}`
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);

    // LOGS ENABLED !!!
    ffmpeg.stderr.on('data', (data) => {
        console.log(`ffmpeg: ${data}`);
    });

    ffmpeg.on('close', (code) => {
        console.log(`🛑 FFmpeg exited with code ${code}`);
        browser.close();
        server.close();
        process.exit(code);
    });

    console.log("🔴 Streaming Live! Check YouTube.");
}
