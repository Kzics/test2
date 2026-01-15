export const Maps = [
    {
        name: "Neon Peaks",
        width: 1280,
        height: 720,
        platforms: [
            // Outer Walls
            { x: 0, y: 0, w: 1280, h: 50 }, // Top
            { x: 0, y: 670, w: 1280, h: 50 }, // Bottom
            { x: 0, y: 0, w: 50, h: 720 }, // Left
            { x: 1230, y: 0, w: 50, h: 720 }, // Right
            
            // Major Platforms
            { x: 200, y: 200, w: 400, h: 20 },
            { x: 700, y: 300, w: 400, h: 20 },
            { x: 300, y: 500, w: 600, h: 20 },
            
            // Angled ramps (made of small blocks for now, effectively) or just static blocks
            { x: 100, y: 400, w: 150, h: 20 }
        ],
        traps: [
            { type: 'spike', x: 400, y: 180, w: 40, h: 20 },
            { type: 'bumper', x: 800, y: 280, r: 25 },
            { type: 'fan', x: 1100, y: 600, w: 60, h: 60, forceX: 0, forceY: -5 }
        ],
        startZone: { x: 100, y: 100, w: 100, h: 50 },
        endZone: { x: 1150, y: 600, w: 50, h: 50 }
    },
    {
        name: "The Plunge",
        width: 1280,
        height: 720,
        platforms: [
            { x: 0, y: 0, w: 1280, h: 50 },
            { x: 0, y: 670, w: 1280, h: 50 },
            { x: 0, y: 0, w: 50, h: 720 },
            { x: 1230, y: 0, w: 50, h: 720 },

            // Zig Zag vertical
            { x: 50, y: 150, w: 800, h: 20 },
            { x: 430, y: 300, w: 800, h: 20 },
            { x: 50, y: 450, w: 800, h: 20 }
        ],
        traps: [
            { type: 'bumper', x: 600, y: 250, r: 30 }
        ],
        startZone: { x: 100, y: 80, w: 100, h: 50 },
        endZone: { x: 1100, y: 600, w: 80, h: 50 }
    }
];
