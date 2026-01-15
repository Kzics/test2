#!/bin/bash
# Wrapper to run the bot inside Xvfb with PM2
# Usage: ./start.sh <STREAM_KEY> <CHANNEL_ID>

# Clean up any leftover Xvfb locks (optional but safe)
rm -f /tmp/.X99-lock

# Run with auto-servernum to avoid conflicts
# --auto-servernum (-a) finds a free display number
# --server-args defines the resolution
exec xvfb-run --auto-servernum --server-args="-screen 0 720x1280x24" node stream_bot.js "$1" "$2"
