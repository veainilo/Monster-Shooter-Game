/**
 * Bullet class for both player and monster bullets
 */
class Bullet {
    constructor(x, y, angle, speed, damage, radius, color, isPlayerBullet) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = speed;
        this.damage = damage;
        this.radius = radius;
        this.color = color;
        this.isPlayerBullet = isPlayerBullet;
        this.isActive = true;

        // Calculate velocity based on angle
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
    }

    update(deltaTime) {
        // Move the bullet
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;

        // Check if bullet is out of bounds
        if (this.x < -this.radius || this.x > canvas.width + this.radius ||
            this.y < -this.radius || this.y > canvas.height + this.radius) {
            this.isActive = false;
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
    static createPlayerBullet(x, y, angle, level) {
        // Enhanced bullet properties based on level
        const bulletProps = {
            1: { speed: 700, damage: 30, radius: 6, color: '#00FFFF' },
            2: { speed: 750, damage: 40, radius: 7, color: '#00AAFF' },
            3: { speed: 800, damage: 50, radius: 8, color: '#0088FF' },
            4: { speed: 850, damage: 60, radius: 9, color: '#0044FF' },
            5: { speed: 900, damage: 70, radius: 10, color: '#0000FF' }
        };

        const props = bulletProps[level] || bulletProps[1];
        return new Bullet(x, y, angle, props.speed, props.damage, props.radius, props.color, true);
    }

    static createMonsterBullet(x, y, angle) {
        return new Bullet(x, y, angle, 300, 5, 4, '#FF4444', false);
    }
}
