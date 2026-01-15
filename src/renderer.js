export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        // Keep internal resolution fixed for consistency, scale with CSS
        this.canvas.width = 1280;
        this.canvas.height = 720;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawMap(map) {
        this.ctx.fillStyle = '#16213e'; // Dark blue platforms
        this.ctx.strokeStyle = '#00E5FF'; // Cyber blue outline
        this.ctx.lineWidth = 2;

        for (let p of map.platforms) {
            this.ctx.fillRect(p.x, p.y, p.w, p.h);
            this.ctx.strokeRect(p.x, p.y, p.w, p.h);
        }

        // Draw Zones
        this.ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
        this.ctx.fillRect(map.startZone.x, map.startZone.y, map.startZone.w, map.startZone.h);

        this.ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
        this.ctx.fillRect(map.endZone.x, map.endZone.y, map.endZone.w, map.endZone.h);
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.strokeRect(map.endZone.x, map.endZone.y, map.endZone.w, map.endZone.h);

        // Draw Traps
        if (map.traps) {
            for (let t of map.traps) {
                if (t.type === 'bumper') {
                    this.ctx.beginPath();
                    this.ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
                    this.ctx.fillStyle = '#FF0055';
                    this.ctx.fill();
                    this.ctx.stroke();
                } else if (t.type === 'fan') {
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                    this.ctx.fillRect(t.x, t.y, t.w, t.h);
                    this.ctx.beginPath();
                    this.ctx.moveTo(t.x, t.y + t.h / 2);
                    this.ctx.lineTo(t.x + t.w, t.y);
                    this.ctx.lineTo(t.x + t.w, t.y + t.h);
                    this.ctx.fill();
                }
            }
        }
    }

    drawEntities(entities) {
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.font = '24px Arial'; // Emoji font

        for (let e of entities) {
            if (e.finished) continue; // Don't draw if finished (mostly)

            this.ctx.beginPath();
            this.ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = '#ffffff'; // White backing for emoji visibility
            this.ctx.fill();
            this.ctx.stroke();

            this.ctx.fillText(e.emoji, e.x, e.y + 2); // +2 for visual alignment
        }
    }
}
