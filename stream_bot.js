const express = require('express');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer');
const { LiveChat } = require('youtube-chat');
const fs = require('fs');

// --- CONFIGURATION ---
const PORT = 3000;
const STREAM_KEY = process.argv[2];
const CHANNEL_ID = process.argv[3];

const RTMP_URL = "rtmp://a.rtmp.youtube.com/live2";
const SCREEN_WIDTH = 720;
const SCREEN_HEIGHT = 1280;

if (!STREAM_KEY) {
    console.error("❌ Error: Usage: node stream_bot.js <STREAM_KEY> [CHANNEL_ID_OR_VIDEO_ID]");
    process.exit(1);
}

// 1. Start Static Server
const app = express();
app.use(express.static(__dirname));
const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`✅ Game Server running on http://127.0.0.1:${PORT}`);
    startStream();
});

async function startStream() {
    console.log("🚀 Launching Browser...");
    const browser = await puppeteer.launch({
        headless: false,
        ignoreDefaultArgs: ['--enable-automation'], // Hides "Chrome is being controlled..." bar
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

    // Handle Chat Interactions with RETRY
    if (CHANNEL_ID) {
        connectToChat(CHANNEL_ID, page);
    } else {
        console.log("⚠️ No Channel ID provided. Chat interaction disabled.");
    }

    try {
        await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle2' });
    } catch (e) {
        console.error("❌ Error loading page:", e);
    }

    console.log("✅ Game Loaded. Preparing FFmpeg...");

    const display = process.env.DISPLAY || ':99';

    let audioArgs = [];
    if (fs.existsSync('bgm.mp3')) {
        console.log("🎵 Custom Audio Found: bgm.mp3 (Looping)");
        audioArgs = ['-stream_loop', '-1', '-i', 'bgm.mp3'];
    } else {
        console.log("🔇 No 'bgm.mp3' found. Using dummy silence.");
        audioArgs = ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100'];
    }

    const ffmpegArgs = [
        '-f', 'x11grab',
        '-s', `${SCREEN_WIDTH}x${SCREEN_HEIGHT}`,
        '-r', '25',
        '-i', `${display}.0+0,0`,
        ...audioArgs,
        '-map', '0:v',
        '-map', '1:a',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-b:v', '2000k',
        '-maxrate', '2000k',
        '-bufsize', '4000k',
        '-pix_fmt', 'yuv420p',
        '-g', '50',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '44100',
        '-f', 'flv',
        `${RTMP_URL}/${STREAM_KEY}`
    ];

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);

    ffmpeg.stderr.on('data', (data) => {
        // console.log(`ffmpeg: ${data}`); 
    });

    ffmpeg.on('close', (code) => {
        console.log(`🛑 FFmpeg exited with code ${code}`);
        browser.close();
        server.close();
        process.exit(code);
    });
}

function connectToChat(channelId, page) {
    console.log(`💬 Attempting to connect to chat for: ${channelId}...`);
    const liveChat = new LiveChat({ channelId: channelId });

    liveChat.on('start', (liveId) => {
        console.log(`💬 ✅ Connected to Live Stream ID: ${liveId}`);
    });

    liveChat.on('chat', (chatItem) => {
        const msg = chatItem.message[0].text;
        console.log(`💬 ${chatItem.author.name}: ${msg}`);

        if (msg.startsWith('!')) {
            const cmd = msg.split(' ')[0]; // Get command part
            const user = chatItem.author.name;

            page.evaluate((command, username) => {
                if (window.game && window.game.handleChatCommand) {
                    window.game.handleChatCommand(command, username);
                }
            }, cmd, user);
        }
    });

    liveChat.on('error', (err) => {
        // console.log("💬 Chat Conn Error (Retrying in 10s)...");
        // Retry logic managed by recursive calls on error or interval? 
        // library emits error then stops.
    });

    // Wrapper to handle start failure
    liveChat.start().then(ok => {
        if (!ok) {
            console.log("💬 Stream not found yet. Retrying in 15s...");
            setTimeout(() => connectToChat(channelId, page), 15000);
        }
    }).catch(e => {
        console.log("💬 Stream not live yet. Retrying in 15s...");
        setTimeout(() => connectToChat(channelId, page), 15000);
    });
}
