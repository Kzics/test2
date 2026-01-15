/**
 * FLAG RACE - BUNDLED VERSION
 * Optimized for OBS / Local File usage
 * MODE: BATTLE ROYALE (FINAL BALANCE)
 */

window.GAME_MODE = "BATTLE_ROYALE";

// --- 1. CONFIG & DATA ---
const SCREEN_W = 720;
const SCREEN_H = 1280;

const Maps = [
    {
        name: "The Arena",
        width: SCREEN_W,
        height: SCREEN_H,
        platforms: [
            { x: 0, y: 0, w: SCREEN_W, h: 40 }, { x: 0, y: SCREEN_H - 40, w: SCREEN_W, h: 40 },
            { x: 0, y: 0, w: 40, h: SCREEN_H }, { x: SCREEN_W - 40, y: 0, w: 40, h: SCREEN_H },
        ],
        traps: [
            // Central Spike (Smaller)
            { type: 'spike', x: SCREEN_W / 2 - 20, y: SCREEN_H / 2 - 20, w: 40, h: 40 }
        ],
        startZone: { x: 100, y: 200, w: SCREEN_W - 200, h: SCREEN_H - 400 }
    }
];

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
        this.radius = 18;
        this.mass = 1;
        this.velX = 0;
        this.velY = 0;
        this.lives = 5;
        this.isDead = false;
        this.damageCooldown = 0;
        this.scale = 1.0;
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
        if (this.lives <= 0) {
            this.isDead = true;
            return true;
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

class TNT {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.timer = 3.0; // 3 seconds
        this.radius = 20;
        this.isDead = false;
        this.blink = 0;
    }
    update(dt) {
        this.timer -= dt;
        this.blink += dt * 10;
        if (this.timer <= 0) {
            this.isDead = true;
            return true; // Explode
        }
        return false;
    }
}

// --- 3. PHYSICS ---
class Physics {
    constructor() {
        this.friction = 0.99; // Slightly simplistic friction
        this.restitution = 0.8;
        this.targetSpeed = 4.0;
        this.particles = [];
        this.tnts = []; // New TNT array
        this.mapBounds = { w: SCREEN_W, h: SCREEN_H };
        this.substeps = 3;
    }

    spawnParticles(x, y, color = '#FFF', count = 3, speed = 5) {
        for (let i = 0; i < 2; i++) {
            this.particles.push(new Particle(x, y, color, speed));
        }
    }

    explodeTNT(tnt, entities) {
        // Visual
        this.spawnParticles(tnt.x, tnt.y, '#FF4400', 10, 15);

        // Knockback (No Damage)
        entities.forEach(e => {
            if (e.isDead) return;
            let dx = e.x - tnt.x;
            let dy = e.y - tnt.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 200) { // Blast radius
                let force = (200 - dist) / 10; // Stronger closer
                let angle = Math.atan2(dy, dx);
                e.velX += Math.cos(angle) * force;
                e.velY += Math.sin(angle) * force;
            }
        });
    }

    update(entities, map, onDeathCallback) {
        this.mapBounds = { w: map.width, h: map.height };

        const dt = 1.0 / this.substeps;

        // -- TNT UPDATE --
        for (let i = this.tnts.length - 1; i >= 0; i--) {
            if (this.tnts[i].update(1 / 60)) { // Simple dt for timer
                this.explodeTNT(this.tnts[i], entities);
                this.tnts.splice(i, 1);
            }
        }

        // -- PARTICLES --
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.update();
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        // -- ENTITIES --
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

                if (map.traps) {
                    for (let trap of map.traps) {
                        this.resolveTrapCollision(entity, trap);
                    }
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

        // -- SPEED CONTROL --
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

    resolveTrapCollision(circle, rect) {
        let closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
        let closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
        let dx = circle.x - closestX;
        let dy = circle.y - closestY;
        let distanceSq = dx * dx + dy * dy;

        if (distanceSq < (circle.radius * circle.scale) ** 2) {
            if (rect.type === 'spike') {
                let distance = Math.sqrt(distanceSq);
                if (distance === 0) distance = 0.01;
                let overlap = (circle.radius * circle.scale) - distance;

                let nx = dx / distance;
                let ny = dy / distance;

                circle.x += nx * overlap;
                circle.y += ny * overlap;

                // Hard Bounce
                circle.velX = (circle.velX - 2 * (circle.velX * nx + circle.velY * ny) * nx);
                circle.velY = (circle.velY - 2 * (circle.velX * nx + circle.velY * ny) * ny);

                circle.takeDamage("SPIKE");
                this.spawnParticles(closestX, closestY, '#FF0000', 5, 8);
            }
        }
    }

    enforceBounds(entity) {
        if (entity.x - entity.radius < 0) { entity.x = entity.radius; entity.velX = Math.abs(entity.velX); }
        if (entity.x + entity.radius > this.mapBounds.w) { entity.x = this.mapBounds.w - entity.radius; entity.velX = -Math.abs(entity.velX); }
        if (entity.y - entity.radius < 0) { entity.y = entity.radius; entity.velY = Math.abs(entity.velY); }
        if (entity.y + entity.radius > this.mapBounds.h) { entity.y = this.mapBounds.h - entity.radius; entity.velY = -Math.abs(entity.velY); }
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
            }
        }
    }

    resolveElasticCollision(c1, c2, onDeathCallback) {
        if (c1.isDead || c2.isDead) return;
        let dx = c2.x - c1.x;
        let dy = c2.y - c1.y;
        let distSq = dx * dx + dy * dy;
        let safeDist = c1.radius + c2.radius; // Simplified radius
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
            let m1 = c1.mass;
            let m2 = c2.mass;
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
        this.eventMsg = null;
        this.eventTimer = 0;
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
        this.ctx.fillStyle = '#16213e';
        this.ctx.strokeStyle = '#00E5FF';
        this.ctx.lineWidth = 4;
        for (let p of map.platforms) {
            this.ctx.fillRect(p.x, p.y, p.w, p.h);
            this.ctx.strokeRect(p.x, p.y, p.w, p.h);
        }
        if (map.traps) {
            for (let t of map.traps) {
                if (t.type === 'spike') {
                    this.ctx.fillStyle = '#FF0000';
                    this.ctx.fillRect(t.x, t.y, t.w, t.h);
                }
            }
        }
    }

    drawTNTs(tnts) {
        this.ctx.fillStyle = '#FF4400';
        this.ctx.textAlign = 'center';
        this.ctx.font = '20px sans-serif';
        for (let t of tnts) {
            this.ctx.save();
            this.ctx.translate(t.x, t.y);
            // Blink effect
            if (Math.sin(t.blink) > 0) this.ctx.fillStyle = '#FFF';
            else this.ctx.fillStyle = '#FF4400';

            this.ctx.fillRect(-15, -15, 30, 30);
            this.ctx.fillStyle = 'black';
            this.ctx.fillText("TNT", 0, 5);
            this.ctx.restore();
        }
    }

    drawEntities(entities) {
        this.ctx.save();
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Font Priority: Noto Color Emoji, then system fonts
        const fontSize = 36; // 18radius * 2
        this.ctx.font = `${fontSize}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", Arial, sans-serif`;

        for (let e of entities) {
            if (e.isDead) continue;

            // Draw Emoji directly (No circle clipping to avoid cutting weirdly if font issue)
            this.ctx.fillText(e.emoji, e.x, e.y + 2); // +2 for visual centering

            // HP Pips ABOVE flag
            this.ctx.fillStyle = '#00FF00';
            const pipW = 6;
            const pipH = 3;
            const gap = 2;
            const totalPipW = (3 * pipW) + (2 * gap);
            const startX = e.x - (totalPipW / 2);

            for (let i = 0; i < e.lives; i++) {
                this.ctx.fillRect(startX + (i * (pipW + gap)), e.y - 25, pipW, pipH);
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

    drawEventMessage() {
        if (this.eventTimer > 0) {
            this.ctx.save();
            this.ctx.textAlign = 'center';
            this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
            this.ctx.fillRect(0, 100, SCREEN_W, 60);

            this.ctx.fillStyle = '#00FF00';
            this.ctx.font = 'bold 24px sans-serif';
            this.ctx.fillText(this.eventMsg, SCREEN_W / 2, 138);

            this.eventTimer--;
            this.ctx.restore();
        }
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
        this.roundActive = false;
        this.leaderboard = {};

        this.cooldowns = { quake: 0, tnt: 0 };

        this.setupUI();
        this.init();
    }

    setupUI() {
        this.victoryScreen = document.getElementById('victory-screen');
        this.winnerFlag = document.getElementById('winner-flag');
        this.winnerName = document.getElementById('winner-name');
    }

    init() {
        this.startRound();
        this.loop();
    }

    handleChatCommand(command, user) {
        const now = Date.now();
        const cmd = command.toLowerCase().replace('!', '');
        const cooldownTime = 20000; // 20s

        if (this.cooldowns[cmd] && now < this.cooldowns[cmd]) {
            console.log(`⏳ Command ${cmd} on cooldown.`);
            return;
        }

        if (cmd === 'quake') {
            this.cooldowns[cmd] = now + cooldownTime;
            this.triggerQuake(user);
        }
        else if (cmd === 'tnt') {
            this.cooldowns[cmd] = now + cooldownTime;
            this.triggerTNT(user);
        }
    }

    triggerQuake(user) {
        this.renderer.eventMsg = `${user} activated QUAKE!`;
        this.renderer.eventTimer = 180;

        // Randomize Direction (Chaos)
        this.entities.forEach(e => {
            if (!e.isDead) {
                const speed = Math.sqrt(e.velX ** 2 + e.velY ** 2) + 5; // Add some energy
                const newAngle = Math.random() * Math.PI * 2;
                e.velX = Math.cos(newAngle) * speed;
                e.velY = Math.sin(newAngle) * speed;
            }
        });
    }

    triggerTNT(user) {
        this.renderer.eventMsg = `${user} activated TNT!`;
        this.renderer.eventTimer = 180;

        // Random Position (Safe from walls)
        const margin = 100;
        const x = margin + Math.random() * (SCREEN_W - margin * 2);
        const y = margin + Math.random() * (SCREEN_H - margin * 2);

        this.physics.tnts.push(new TNT(x, y));
    }

    startRound() {
        this.entities = [];
        this.physics.particles = [];
        this.physics.tnts = [];
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
        this.roundActive = true;
        this.victoryScreen.classList.add('hidden');
        document.getElementById('victory-ranking').style.display = 'none';
    }

    onEntityDeath(victim, killer) {
        this.physics.spawnParticles(victim.x, victim.y, '#FF0000', 10, 8);
        this.showKillFeed(victim, killer);
    }

    showKillFeed(victim, killer) {
        const kf = document.getElementById('kill-feed');
        const msg = document.createElement('div');
        msg.className = 'kf-msg';
        msg.innerHTML = `${victim.emoji} ${victim.countryCode} killed by ${killer.emoji} ${killer.countryCode}`;
        kf.appendChild(msg);
        setTimeout(() => { if (msg.parentNode) msg.parentNode.removeChild(msg); }, 2200);
    }

    endRound(winner) {
        if (!this.roundActive) return;
        this.roundActive = false;
        if (!this.leaderboard[winner.countryCode]) this.leaderboard[winner.countryCode] = 0;
        this.leaderboard[winner.countryCode]++;
        this.winnerFlag.innerText = winner.emoji;
        this.winnerName.innerText = winner.countryCode + " WINS!";
        this.victoryScreen.classList.remove('hidden');

        const rankList = document.querySelector('#victory-ranking ul');
        rankList.innerHTML = '';
        const sorted = Object.entries(this.leaderboard).sort((a, b) => b[1] - a[1]).slice(0, 5);
        sorted.forEach((entry, idx) => {
            const li = document.createElement('li');
            const f = new Flag(entry[0], 0, 0);
            li.innerHTML = `<span class="v-rank">#${idx + 1}</span> <span class="v-flag">${f.emoji}</span> <span class="v-score">${entry[1]}</span>`;
            rankList.appendChild(li);
        });

        setTimeout(() => { document.getElementById('victory-ranking').style.display = 'block'; }, 1500);

        let countdown = 4;
        const interval = setInterval(() => {
            countdown--;
            if (countdown <= 0) { clearInterval(interval); this.startRound(); }
        }, 1000);
    }

    update() {
        this.physics.update(this.entities, this.currentMap, (v, k) => this.onEntityDeath(v, k));
        let alive = this.entities.filter(e => !e.isDead);
        if (this.roundActive) {
            if (alive.length === 1) this.endRound(alive[0]);
            else if (alive.length === 0) { this.roundActive = false; setTimeout(() => this.startRound(), 2000); }
        }
    }

    draw() {
        this.renderer.clear();
        this.renderer.drawMap(this.currentMap);
        this.renderer.drawEntities(this.entities);
        this.renderer.drawTNTs(this.physics.tnts);
        this.renderer.drawParticles(this.physics.particles);
        this.renderer.drawEventMessage(); // Draw notification overlay
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
}

window.onload = () => {
    console.log("🎮 GAME STARTED SUCCESSFULLY - v2.0 (Chats + TNT)");
    window.game = new Game();
};
