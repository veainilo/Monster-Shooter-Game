/**
 * Player class
 */
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 20;
        this.speed = 200;
        this.health = 100;
        this.maxHealth = 100;
        this.bulletLevel = 1;
        this.maxBulletLevel = 5;
        this.score = 0;
        this.shootCooldown = 0;
        this.shootInterval = 150; // Faster shooting (was 300ms)
        this.isActive = true;
        this.mass = 50; // Mass for collision resolution
        this.color = '#00FF00'; // Player color

        // Movement
        this.moveUp = false;
        this.moveDown = false;
        this.moveLeft = false;
        this.moveRight = false;

        // Aiming
        this.aimAngle = 0;

        // Add direct keyboard controls to the player
        this.setupDirectControls();
    }

    setupDirectControls() {
        // Add keyboard event listeners directly to the player
        window.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'w':
                case 'W':
                case 'ArrowUp':
                    this.moveUp = true;
                    break;
                case 's':
                case 'S':
                case 'ArrowDown':
                    this.moveDown = true;
                    break;
                case 'a':
                case 'A':
                case 'ArrowLeft':
                    this.moveLeft = true;
                    break;
                case 'd':
                case 'D':
                case 'ArrowRight':
                    this.moveRight = true;
                    break;
            }
        });

        window.addEventListener('keyup', (e) => {
            switch (e.key) {
                case 'w':
                case 'W':
                case 'ArrowUp':
                    this.moveUp = false;
                    break;
                case 's':
                case 'S':
                case 'ArrowDown':
                    this.moveDown = false;
                    break;
                case 'a':
                case 'A':
                case 'ArrowLeft':
                    this.moveLeft = false;
                    break;
                case 'd':
                case 'D':
                case 'ArrowRight':
                    this.moveRight = false;
                    break;
            }
        });
    }

    update(deltaTime, monsters, bullets) {
        if (!this.isActive) return;

        // Calculate movement
        let dx = 0;
        let dy = 0;

        if (this.moveUp) dy -= 1;
        if (this.moveDown) dy += 1;
        if (this.moveLeft) dx -= 1;
        if (this.moveRight) dx += 1;

        // Normalize diagonal movement
        if (dx !== 0 && dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length;
            dy /= length;
        }

        // Apply movement
        this.x += dx * this.speed * deltaTime;
        this.y += dy * this.speed * deltaTime;

        // Keep player within canvas bounds
        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));

        // Find the nearest active monster
        let nearestMonster = null;
        let nearestDistance = Infinity;

        for (const monster of monsters) {
            if (monster.isActive) {
                const monsterDx = monster.x - this.x;
                const monsterDy = monster.y - this.y;
                const distance = Math.sqrt(monsterDx * monsterDx + monsterDy * monsterDy);

                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestMonster = monster;
                }
            }
        }

        // Update aim angle to target the nearest monster
        if (nearestMonster) {
            const targetDx = nearestMonster.x - this.x;
            const targetDy = nearestMonster.y - this.y;
            this.aimAngle = Math.atan2(targetDy, targetDx);
        }

        // Shooting logic
        this.shootCooldown -= deltaTime * 1000;

        // Auto-shooting (only if there's a monster to target)
        if (this.shootCooldown <= 0 && nearestMonster) {
            this.shoot(bullets);
        }
    }

    shoot(bullets) {
        if (this.shootCooldown <= 0) {
            bullets.push(BulletFactory.createPlayerBullet(this.x, this.y, this.aimAngle, this.bulletLevel));
            this.shootCooldown = this.shootInterval;
        }
    }

    draw(ctx) {
        if (!this.isActive) return;

        // Draw player body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw player direction indicator (only if we have an aim angle)
        if (this.aimAngle !== undefined) {
            const dirX = this.x + Math.cos(this.aimAngle) * this.radius;
            const dirY = this.y + Math.sin(this.aimAngle) * this.radius;

            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(dirX, dirY);
            ctx.stroke();
        }

        // Since player is invincible, we don't need a health bar
        // But we'll keep a small indicator to show the player is invincible
        const barWidth = this.radius * 2;
        const barHeight = 4;

        ctx.fillStyle = '#333';
        ctx.fillRect(this.x - this.radius, this.y - this.radius - 10, barWidth, barHeight);

        ctx.fillStyle = '#FFFF00'; // Yellow for invincibility
        ctx.fillRect(this.x - this.radius, this.y - this.radius - 10, barWidth, barHeight);
    }

    takeDamage() {
        // Player is invincible, so no damage is taken
        // But we'll flash the player to indicate a hit
        this.flashEffect();
    }

    flashEffect() {
        // Visual feedback when hit (without taking damage)
        const originalColor = '#00FF00';
        const flashColor = '#FFFFFF';

        // Store the original color
        this.color = flashColor;

        // Reset color after a short delay
        setTimeout(() => {
            this.color = originalColor;
        }, 100);
    }

    upgradeBullet() {
        if (this.bulletLevel < this.maxBulletLevel) {
            this.bulletLevel++;
            return true;
        }
        return false;
    }

    addScore(points) {
        this.score += points;
    }
}
