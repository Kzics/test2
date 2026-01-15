export class Physics {
    constructor() {
        this.gravity = 0.2;
        this.friction = 0.99;
        this.restitution = 0.7; // Bounciness
    }

    update(entities, map) {
        entities.forEach(entity => {
            // Apply Gravity
            entity.velY += this.gravity;

            // Apply Velocity
            entity.x += entity.velX;
            entity.y += entity.velY;

            // Apply Friction (Air resistance)
            entity.velX *= this.friction;
            entity.velY *= this.friction;

            // Map Collisions (Platforms)
            for (let platform of map.platforms) {
                this.resolveAABBCollision(entity, platform);
            }

            // Map Bounds (Safety net)
            if (entity.x - entity.radius < 0) {
                entity.x = entity.radius;
                entity.velX *= -this.restitution;
            }
            if (entity.x + entity.radius > map.width) {
                entity.x = map.width - entity.radius;
                entity.velX *= -this.restitution;
            }
            if (entity.y - entity.radius < 0) {
                entity.y = entity.radius;
                entity.velY *= -this.restitution;
            }
            if (entity.y + entity.radius > map.height) {
                entity.y = map.height - entity.radius;
                entity.velY *= -0.5; // Less bouncy on floor to settle
            }

            // Trap Collisions
            if (map.traps) {
                for (let trap of map.traps) {
                    if (trap.type === 'bumper') {
                        this.resolveCircleCollision(entity, { x: trap.x, y: trap.y, radius: trap.r }, 1.5);
                    } else if (trap.type === 'fan') {
                        if (entity.x > trap.x && entity.x < trap.x + trap.w &&
                            entity.y > trap.y && entity.y < trap.y + trap.h) {
                            entity.velX += trap.forceX || 0;
                            entity.velY += trap.forceY || 0;
                        }
                    }
                }
            }
        });

        // Entity vs Entity collision (Simple separaton)
        for (let i = 0; i < entities.length; i++) {
            for (let j = i + 1; j < entities.length; j++) {
                this.resolveEntityCollision(entities[i], entities[j]);
            }
        }
    }

    resolveAABBCollision(circle, rect) {
        // Find closest point on rect to circle center
        let closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
        let closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));

        let dx = circle.x - closestX;
        let dy = circle.y - closestY;
        let distanceSq = dx * dx + dy * dy;

        if (distanceSq < circle.radius * circle.radius) {
            let distance = Math.sqrt(distanceSq);
            let overlap = circle.radius - distance;

            // Normalize collision normal
            let nx = dx / distance;
            let ny = dy / distance;

            // If center is inside, just push up (fallback)
            if (distance === 0) {
                ny = -1;
                nx = 0;
                overlap = circle.radius;
            }

            // Move circle out of collision
            circle.x += nx * overlap;
            circle.y += ny * overlap;

            // Reflect velocity (Bounce)
            // v' = v - 2(v . n)n
            let dot = circle.velX * nx + circle.velY * ny;

            circle.velX = (circle.velX - 2 * dot * nx) * this.restitution;
            circle.velY = (circle.velY - 2 * dot * ny) * this.restitution;
        }
    }

    resolveCircleCollision(e1, e2, boost = 1.0) {
        let dx = e1.x - e2.x;
        let dy = e1.y - e2.y;
        let distSq = dx * dx + dy * dy;
        let minDist = e1.radius + e2.radius;

        if (distSq < minDist * minDist) {
            let dist = Math.sqrt(distSq);
            let overlap = minDist - dist;
            let nx = dx / dist;
            let ny = dy / dist;

            // Separate
            // e1.x += nx * overlap;
            // e1.y += ny * overlap; 
            // Better: only push the entity (e1) if e2 is static (trap), or push both if dynamic
            // But here e2 is a bumper (static), so we push e1 fully
            e1.x += nx * overlap;
            e1.y += ny * overlap;

            // Bounce
            let dot = e1.velX * nx + e1.velY * ny;
            e1.velX = (e1.velX - 2 * dot * nx) * (this.restitution * boost);
            e1.velY = (e1.velY - 2 * dot * ny) * (this.restitution * boost);
        }
    }

    resolveEntityCollision(e1, e2) {
        let dx = e1.x - e2.x;
        let dy = e1.y - e2.y;
        let distSq = dx * dx + dy * dy;
        let minDist = e1.radius + e2.radius;

        if (distSq < minDist * minDist) {
            let dist = Math.sqrt(distSq);
            let overlap = (minDist - dist) / 2; // Split overlap
            let nx = dx / dist;
            let ny = dy / dist;

            e1.x += nx * overlap;
            e1.y += ny * overlap;
            e2.x -= nx * overlap;
            e2.y -= ny * overlap;

            // Simple elastic collision approximation (swapping momentum partially)
            // For now just position correction + slight friction is enough for "rubbing" flags
            // Real elastic collision requires proper mass code
        }
    }
}
