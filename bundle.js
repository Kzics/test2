/**
 * FLAG RACE - BUNDLED VERSION
 * Optimized for OBS / Local File usage
 * MODE: BATTLE ROYALE (FINAL BALANCE - 18px / Speed 8)
 */

window.GAME_MODE = "BATTLE_ROYALE";

// --- 1. CONFIG & DATA ---

// SCREEN DIMENSIONS (SHORTS)
const SCREEN_W = 720;
const SCREEN_H = 1280;

// MAPS - Empty Arenas (Only Borders)
const Maps = [
    {
        name: "The Arena",
        width: SCREEN_W,
        height: SCREEN_H,
        platforms: [
            // Outer Walls Only
            { x: 0, y: 0, w: SCREEN_W, h: 40 }, { x: 0, y: SCREEN_H - 40, w: SCREEN_W, h: 40 },
            { x: 0, y: 0, w: 40, h: SCREEN_H }, { x: SCREEN_W - 40, y: 0, w: 40, h: SCREEN_H },
        ],
        traps: [
            // Central Spike (Requested)
            { type: 'spike', x: SCREEN_W / 2 - 25, y: SCREEN_H / 2 - 25, w: 50, h: 50 }
        ],
        startZone: { x: 100, y: 200, w: SCREEN_W - 200, h: SCREEN_H - 400 }
    }
];

// 24 Countries
const COUNTRIES = [
    'US', 'GB', 'FR', 'DE', 'IT', 'ES', 'JP', 'KR', 'CN', 'BR',
    'CA', 'AU', 'IN', 'RU', 'ZA', 'MX', 'AR', 'EG', 'NG', 'SE',
    'CH', 'NL', 'BE', 'PT'
];

// --- 2. ENTITIES ---
class Flag {
    constructor(countryCode, x, y) {
        this.countryCode = countryCode;
        this.emoji = this.getFlagEmoji(countryCode);
        this.x = x;
        this.y = y;
        this.radius = 18; // Requested: 18px
        this.mass = 1;
        this.velX = 0;
        this.velY = 0;
        this.finished = false;
        this.lives = 5;
        this.isDead = false;
        this.damageCooldown = 0;
        this.highlight = 0;
        this.scale = 1.0;
        this.lastX = x;
        this.lastY = y;
    }

    getFlagEmoji(countryCode) {
        const codePoints = countryCode
            .toUpperCase()
            .split('')
            .map(char => 127397 + char.charCodeAt());
        return String.fromCodePoint(...codePoints);
    }

    takeDamage(sourceName) {
        if (this.damageCooldown > 0 || this.isDead) return false;
        this.lives--;
        this.damageCooldown = 60; // 1s invul

        // Visual Hit
        this.highlight = 1.0;

        if (this.lives <= 0) {
            this.isDead = true;
            return true; // Died
        }
        return false;
    }
}

class Particle {
    constructor(x, y, color, speed) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * speed;
        this.vy = (Math.random() - 0.5) * speed;
        this.life = 0.8;
        this.color = color;
        this.size = Math.random() * 3 + 1;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.04;
    }
}

// --- 3. PHYSICS ---
class Physics {
    constructor() {
        this.gravity = 0;
        this.friction = 1.0;
        this.restitution = 1.0;
        this.targetSpeed = 4.0; // Reduced from 12.0
        this.particles = [];
        this.mapBounds = { w: SCREEN_W, h: SCREEN_H };
        this.substeps = 8;
    }

    spawnParticles(x, y, color = '#FFF', count = 3, speed = 5) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color, speed));
        }
    }

    update(entities, map, onDeathCallback) {
        this.mapBounds = { w: map.width, h: map.height };

        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.update();
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        const dt = 1.0 / this.substeps;

        for (let s = 0; s < this.substeps; s++) {
            entities.forEach(entity => {
                if (entity.isDead) return;

                if (entity.damageCooldown > 0) entity.damageCooldown -= dt;

                entity.x += entity.velX * dt;
                entity.y += entity.velY * dt;

                entity.velX *= Math.pow(this.friction, dt);
                entity.velY *= Math.pow(this.friction, dt);

                for (let platform of map.platforms) {
                    this.resolveAABBCollision(entity, platform);
                }

                this.enforceBounds(entity);
            });

            for (let i = 0; i < entities.length; i++) {
                for (let j = i + 1; j < entities.length; j++) {
                    if (!entities[i].isDead && !entities[j].isDead) {
                        this.resolveElasticCollision(entities[i], entities[j], onDeathCallback);
                    }
                }
            }
        }

        // ENFORCE CONSTANT SPEED at end of frame
        entities.forEach(entity => {
            if (entity.isDead) return;
            const currentSpeed = Math.sqrt(entity.velX ** 2 + entity.velY ** 2);

            if (currentSpeed < 0.1) {
                const angle = Math.random() * Math.PI * 2;
                entity.velX = Math.cos(angle) * this.targetSpeed;
                entity.velY = Math.sin(angle) * this.targetSpeed;
            } else {
                const scale = this.targetSpeed / currentSpeed;
                entity.velX *= scale;
                entity.velY *= scale;
            }
        });
    }

    enforceBounds(entity) {
        if (entity.x - entity.radius < 0) {
            entity.x = entity.radius;
            entity.velX = Math.abs(entity.velX);
        }
        if (entity.x + entity.radius > this.mapBounds.w) {
            entity.x = this.mapBounds.w - entity.radius;
            entity.velX = -Math.abs(entity.velX);
        }
        if (entity.y - entity.radius < 0) {
            entity.y = entity.radius;
            entity.velY = Math.abs(entity.velY);
        }
        if (entity.y + entity.radius > this.mapBounds.h) {
            entity.y = this.mapBounds.h - entity.radius;
            entity.velY = -Math.abs(entity.velY);
        }
    }

    resolveAABBCollision(circle, rect) {
        let closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
        let closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));

        let dx = circle.x - closestX;
        let dy = circle.y - closestY;
        let distanceSq = dx * dx + dy * dy;

        if (distanceSq < (circle.radius * circle.scale) ** 2) {
            let distance = Math.sqrt(distanceSq);
            if (distance === 0) distance = 0.01;
            let overlap = (circle.radius * circle.scale) - distance;

            let nx = dx / distance;
            let ny = dy / distance;

            circle.x += nx * overlap;
            circle.y += ny * overlap;

            let dot = circle.velX * nx + circle.velY * ny;
            if (dot < 0) {
                circle.velX = (circle.velX - 2 * dot * nx);
                circle.velY = (circle.velY - 2 * dot * ny);
                this.spawnParticles(closestX, closestY, '#FFCC00', 2, 5);
            }
        }
    }

    resolveElasticCollision(c1, c2, onDeathCallback) {
        if (c1.isDead || c2.isDead) return;

        let dx = c2.x - c1.x;
        let dy = c2.y - c1.y;
        let distSq = dx * dx + dy * dy;
        let safeDist = (c1.radius * c1.scale) + (c2.radius * c2.scale);

        if (distSq < safeDist * safeDist) {
            if (onDeathCallback) {
                const died1 = c1.takeDamage(c2.countryCode);
                const died2 = c2.takeDamage(c1.countryCode);

                if (died1) onDeathCallback(c1, c2);
                if (died2) onDeathCallback(c2, c1);

                if (c1.isDead || c2.isDead) return;
            }

            let dist = Math.sqrt(distSq);
            if (dist === 0) dist = 0.01;
            let nx = dx / dist;
            let ny = dy / dist;

            let overlap = (safeDist - dist) / 2;
            c1.x -= nx * overlap;
            c1.y -= ny * overlap;
            c2.x += nx * overlap;
            c2.y += ny * overlap;

            let v1n = c1.velX * nx + c1.velY * ny;
            let v2n = c2.velX * nx + c2.velY * ny;

            let m1 = c1.mass * c1.scale;
            let m2 = c2.mass * c2.scale;

            let newV1n = (v1n * (m1 - m2) + 2 * m2 * v2n) / (m1 + m2);
            let newV2n = (v2n * (m2 - m1) + 2 * m1 * v1n) / (m1 + m2);

            let dv1 = newV1n - v1n;
            let dv2 = newV2n - v2n;

            c1.velX += dv1 * nx;
            c1.velY += dv1 * ny;
            c2.velX += dv2 * nx;
            c2.velY += dv2 * ny;
        }
    }
}

// --- 4. RENDERER ---
class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = SCREEN_W;
        this.canvas.height = SCREEN_H;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawMap(map) {
        this.ctx.save();

        this.ctx.fillStyle = '#16213e';
        this.ctx.strokeStyle = '#00E5FF';
        this.ctx.lineWidth = 4;

        for (let p of map.platforms) {
            this.ctx.fillRect(p.x, p.y, p.w, p.h);
            this.ctx.strokeRect(p.x, p.y, p.w, p.h);
        }

        this.ctx.restore();
    }

    drawEntities(entities) {
        this.ctx.save();
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        for (let e of entities) {
            if (e.isDead) continue;

            const radius = e.radius * (e.scale || 1);

            // 1. Clipping for Circular Emoji
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);
            this.ctx.clip();

            // Font adjusted for new radius 18
            this.ctx.font = `${Math.floor(radius * 2.2)}px Arial`;
            this.ctx.fillStyle = '#FFF';
            this.ctx.fillText(e.emoji, e.x, e.y + (radius * 0.2));

            if (e.damageCooldown > 0) {
                if (Math.floor(Date.now() / 50) % 2 !== 0) {
                    this.ctx.fillStyle = 'rgba(255, 0, 85, 0.5)';
                    this.ctx.fillRect(e.x - radius, e.y - radius, radius * 2, radius * 2);
                } else {
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                    this.ctx.fillRect(e.x - radius, e.y - radius, radius * 2, radius * 2);
                }
            }

            this.ctx.restore();

            // 2. Border
            this.ctx.beginPath();
            this.ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);

            if (e.lives === 2) this.ctx.strokeStyle = '#FFCC00';
            else if (e.lives === 1) this.ctx.strokeStyle = '#FF3300';
            else this.ctx.strokeStyle = '#FFFFFF';

            this.ctx.lineWidth = 2; // Thinner border
            this.ctx.stroke();

            // 3. HP Pips - Adjusted for 18px size
            this.ctx.fillStyle = '#00FF00';
            const pipW = 6;
            const pipH = 3;
            const gap = 3;
            // Center the pips (3 pips * 6w + 2 gaps * 3 = 18 + 6 = 24 width)
            const totalPipW = (3 * pipW) + (2 * gap);
            const startX = e.x - (totalPipW / 2);

            for (let i = 0; i < e.lives; i++) {
                this.ctx.fillRect(startX + (i * (pipW + gap)), e.y - radius - 8, pipW, pipH);
            }
        }
        this.ctx.restore();
    }

    drawParticles(particles) {
        this.ctx.save();
        for (let p of particles) {
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1.0;
        this.ctx.restore();
    }
}

// --- 5. GAME LOOP ---
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

        this.leaderboard = {};

        this.setupUI();
        this.init();
    }

    setupUI() {
        this.uiMapName = document.getElementById('map-name');
        this.uiRound = document.getElementById('round-counter');
        this.victoryScreen = document.getElementById('victory-screen');
        this.winnerFlag = document.getElementById('winner-flag');
        this.winnerName = document.getElementById('winner-name');
    }

    init() {
        this.startRound();
        this.loop();
    }

    startRound() {
        this.currentMap = this.maps[this.currentMapIndex];

        this.entities = [];
        this.physics.particles = [];

        document.getElementById('kill-feed').innerHTML = '';

        const z = this.currentMap.startZone;

        for (let i = 0; i < COUNTRIES.length; i++) {
            const x = z.x + (Math.random() * z.w);
            const y = z.y + (Math.random() * z.h);

            const flag = new Flag(COUNTRIES[i], x, y);

            const angle = Math.random() * Math.PI * 2;
            const speed = this.physics.targetSpeed;
            flag.velX = Math.cos(angle) * speed;
            flag.velY = Math.sin(angle) * speed;

            this.entities.push(flag);
        }

        this.roundTime = 0;
        this.roundActive = true;
        this.victoryScreen.classList.add('hidden');
        document.getElementById('victory-ranking').style.display = 'none';
    }

    showKillFeed(victim, killer) {
        const kf = document.getElementById('kill-feed');
        const msg = document.createElement('div');
        msg.className = 'kf-msg';
        msg.innerHTML = `${victim.emoji} ${victim.countryCode} killed by ${killer.emoji} ${killer.countryCode}`;
        kf.appendChild(msg);

        setTimeout(() => {
            if (msg.parentNode) msg.parentNode.removeChild(msg);
        }, 2200);
    }

    onEntityDeath(victim, killer) {
        this.physics.spawnParticles(victim.x, victim.y, '#FF0000', 10, 8);
        this.showKillFeed(victim, killer);
    }

    endRound(winner) {
        if (!this.roundActive) return;
        this.roundActive = false;

        if (!this.leaderboard[winner.countryCode]) this.leaderboard[winner.countryCode] = 0;
        this.leaderboard[winner.countryCode]++;

        this.winnerFlag.innerText = winner.emoji;
        this.winnerName.innerText = winner.countryCode + " WINS!";
        this.victoryScreen.classList.remove('hidden');
        this.physics.spawnParticles(winner.x, winner.y, '#FFD700', 20, 10);

        const rankList = document.querySelector('#victory-ranking ul');
        rankList.innerHTML = '';
        const sorted = Object.entries(this.leaderboard).sort((a, b) => b[1] - a[1]).slice(0, 5);
        sorted.forEach((entry, idx) => {
            const li = document.createElement('li');
            const f = new Flag(entry[0], 0, 0);
            li.innerHTML = `<span class="v-rank">#${idx + 1}</span> <span class="v-flag">${f.emoji}</span> <span class="v-score">${entry[1]}</span>`;
            rankList.appendChild(li);
        });

        setTimeout(() => {
            document.getElementById('victory-ranking').style.display = 'block';
        }, 1500);

        let countdown = 4; // Faster
        const interval = setInterval(() => {
            countdown--;
            if (countdown <= 0) {
                clearInterval(interval);
                this.nextMap();
            }
        }, 1000);
    }

    nextMap() {
        this.startRound();
    }

    update() {
        this.physics.update(this.entities, this.currentMap, (victim, killer) => {
            this.onEntityDeath(victim, killer);
        });

        let alive = this.entities.filter(e => !e.isDead);

        if (this.roundActive) {
            if (alive.length === 1) {
                this.endRound(alive[0]);
            } else if (alive.length === 0) {
                this.roundActive = false;
                setTimeout(() => this.startRound(), 2000);
            }
        }
    }

    draw() {
        this.renderer.clear();
        this.renderer.drawMap(this.currentMap);
        this.renderer.drawEntities(this.entities);
        this.renderer.drawParticles(this.physics.particles);
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }

    spawnBomb() {
        if (this.entities.length === 0) return;
        const angle = Math.random() * Math.PI * 2;
        this.entities.forEach(e => {
            e.velX += Math.cos(angle) * 2;
            e.velY += Math.sin(angle) * 2;
        });
    }
}

window.onload = () => {
    console.log("🎮 GAME STARTED SUCCESSFULLY - HELLO FROM BUNDLE.JS");
    window.game = new Game();
};
