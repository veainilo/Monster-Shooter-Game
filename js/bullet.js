/**
 * Bullet class for both player and monster bullets
 */
class Bullet {
    constructor(x, y, angle, speed, damage, radius, color, isPlayerBullet, pierceCount = 0, gameCanvas = null) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = speed;
        this.damage = damage;
        this.radius = radius;
        this.color = color;
        this.isPlayerBullet = isPlayerBullet;
        this.isActive = true;
        this.gameCanvas = gameCanvas; // Store reference to the canvas

        // Piercing properties
        this.maxPierceCount = pierceCount; // Maximum number of enemies this bullet can pierce
        this.currentPierceCount = 0; // Current number of enemies pierced

        // Calculate velocity based on angle
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
    }

    update(deltaTime) {
        // Move the bullet
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;

        // Check if bullet is out of bounds (only if we have a canvas reference)
        if (this.gameCanvas) {
            if (this.x < -this.radius || this.x > this.gameCanvas.width + this.radius ||
                this.y < -this.radius || this.y > this.gameCanvas.height + this.radius) {
                this.isActive = false;
            }
        } else {
            // Fallback for when no canvas is provided - use a large boundary
            const largeBoundary = 2000; // Arbitrary large value
            if (this.x < -this.radius - largeBoundary || this.x > largeBoundary + this.radius ||
                this.y < -this.radius - largeBoundary || this.y > largeBoundary + this.radius) {
                this.isActive = false;
            }
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Factory for creating different types of player bullets based on level
 */
class BulletFactory {
    static createPlayerBullet(x, y, angle, level, gameCanvas = null) {
        // Enhanced bullet properties based on level with higher pierce counts
        const bulletProps = {
            1: { speed: 700, damage: 30, radius: 6, color: '#00FFFF', pierce: 10 },
            2: { speed: 750, damage: 40, radius: 7, color: '#00AAFF', pierce: 15 },
            3: { speed: 800, damage: 50, radius: 8, color: '#0088FF', pierce: 20 },
            4: { speed: 850, damage: 60, radius: 9, color: '#0044FF', pierce: 25 },
            5: { speed: 900, damage: 70, radius: 10, color: '#0000FF', pierce: 30 }
        };

        const props = bulletProps[level] || bulletProps[1];
        return new Bullet(x, y, angle, props.speed, props.damage, props.radius, props.color, true, props.pierce, gameCanvas);
    }

    static createMonsterBullet(x, y, angle, gameCanvas = null) {
        // Monster bullets also have pierce now (10 pierce count)
        return new Bullet(x, y, angle, 300, 5, 4, '#FF4444', false, 10, gameCanvas);
    }
}
