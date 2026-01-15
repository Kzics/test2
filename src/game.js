import { Physics } from './physics.js';
import { Renderer } from './renderer.js';
import { Maps } from './maps.js';
import { Flag, COUNTRIES } from './entities.js';

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.physics = new Physics();
        this.renderer = new Renderer(this.canvas);

        this.maps = Maps;
        this.currentMapIndex = 0;
        this.currentMap = this.maps[0];

        this.entities = [];
        this.roundTime = 0;
        this.roundActive = false;

        this.leaderboard = {}; // { US: 0, GB: 2 ... }

        // Dom Elements
        this.uiTimer = document.getElementById('game-timer');
        this.uiMapName = document.getElementById('map-name');
        this.uiRound = document.getElementById('round-counter');
        this.uiLeaderboard = document.getElementById('leaderboard-list');
        this.victoryScreen = document.getElementById('victory-screen');
        this.winnerFlag = document.getElementById('winner-flag');
        this.winnerName = document.getElementById('winner-name');

        this.roundCount = 1024;

        this.init();
    }

    init() {
        this.startRound();
        this.loop();
    }

    startRound() {
        this.currentMap = this.maps[this.currentMapIndex];
        this.uiMapName.innerText = this.currentMap.name;
        this.roundCount++;
        this.uiRound.innerText = '#' + this.roundCount;

        this.entities = [];
        // Spawn Flags in Start Zone
        COUNTRIES.forEach(code => {
            const z = this.currentMap.startZone;
            const x = z.x + Math.random() * z.w;
            const y = z.y + Math.random() * z.h;
            this.entities.push(new Flag(code, x, y));
        });

        this.physics.gravity = 0.2; // Reset defaults
        this.roundTime = 0;
        this.roundActive = true;
        this.victoryScreen.classList.add('hidden');
    }

    endRound(winner) {
        if (!this.roundActive) return;
        this.roundActive = false;

        // Update Leaderboard
        if (!this.leaderboard[winner.countryCode]) this.leaderboard[winner.countryCode] = 0;
        this.leaderboard[winner.countryCode]++;
        this.updateLeaderboardUI();

        // Show Victory Screen
        this.winnerFlag.innerText = winner.emoji;
        this.winnerName.innerText = winner.countryCode + " WINS!";
        this.victoryScreen.classList.remove('hidden');

        // Auto restart
        let countdown = 5;
        const cdEl = document.getElementById('restart-timer');
        const interval = setInterval(() => {
            countdown--;
            if (cdEl) cdEl.innerText = countdown;
            if (countdown <= 0) {
                clearInterval(interval);
                this.nextMap();
            }
        }, 1000);
    }

    nextMap() {
        this.currentMapIndex = (this.currentMapIndex + 1) % this.maps.length;
        this.startRound();
    }

    update() {
        if (!this.roundActive) return;

        this.physics.update(this.entities, this.currentMap);
        this.roundTime += 1 / 60;

        // Format Time
        const mins = Math.floor(this.roundTime / 60).toString().padStart(2, '0');
        const secs = Math.floor(this.roundTime % 60).toString().padStart(2, '0');
        this.uiTimer.innerText = `${mins}:${secs}`;

        // Check Win Condition
        for (let e of this.entities) {
            if (e.x > this.currentMap.endZone.x &&
                e.x < this.currentMap.endZone.x + this.currentMap.endZone.w &&
                e.y > this.currentMap.endZone.y &&
                e.y < this.currentMap.endZone.y + this.currentMap.endZone.h) {

                this.endRound(e);
                break;
            }
        }
    }

    draw() {
        this.renderer.clear();
        this.renderer.drawMap(this.currentMap);
        this.renderer.drawEntities(this.entities);
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }

    updateLeaderboardUI() {
        // Sort
        const sorted = Object.entries(this.leaderboard).sort((a, b) => b[1] - a[1]).slice(0, 5);
        this.uiLeaderboard.innerHTML = '';

        sorted.forEach((entry, index) => {
            const code = entry[0];
            const wins = entry[1];
            // Re-create flag emoji manually or fetch from entities helper if exposed
            const emoji = this.entities.find(e => e.countryCode === code)?.emoji || "🏳️";

            const li = document.createElement('li');
            li.innerHTML = `
                <span class="rank">${index + 1}</span>
                ${emoji}
                <span class="score">${wins} Wins</span>
            `;
            this.uiLeaderboard.appendChild(li);
        });
    }

    // --- Streamer Interaction Methods ---
    spawnBomb() {
        // Find leader or random
        if (this.entities.length > 0) {
            const target = this.entities[Math.floor(Math.random() * this.entities.length)];
            // Apply massive force
            target.velY -= 15;
            target.velX += (Math.random() - 0.5) * 20;
        }
    }

    toggleGravity() {
        this.physics.gravity = (this.physics.gravity === 0.2) ? 0.05 : 0.2;
    }

    shakeCamera() {
        // Visual effect only, maybe add random velocity to everyone
        this.entities.forEach(e => {
            e.velY -= 5;
            e.velX += (Math.random() - 0.5) * 10;
        });
    }
}

// Expose to window for UI buttons
window.game = new Game();
