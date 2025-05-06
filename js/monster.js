/**
 * Monster class
 */
class Monster {
    constructor(x, y, radius, health, speed, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.health = health;
        this.maxHealth = health;
        this.speed = speed;
        this.color = color;
        this.isActive = true;
        this.shootCooldown = 0;
        this.shootInterval = 1000; // Faster shooting (was 2000ms)
        this.mass = radius * 2; // Mass for collision resolution
    }

    update(deltaTime, player, bullets) {
        if (!this.isActive) return;

        // Move towards player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Only move if not too close to player
        if (distance > this.radius + player.radius + 10) {
            this.x += (dx / distance) * this.speed * deltaTime;
            this.y += (dy / distance) * this.speed * deltaTime;
        }

        // Shooting logic
        this.shootCooldown -= deltaTime * 1000;
        if (this.shootCooldown <= 0) {
            // Calculate angle to player
            const angle = Math.atan2(dy, dx);
            bullets.push(BulletFactory.createMonsterBullet(this.x, this.y, angle));
            this.shootCooldown = this.shootInterval;
        }

        // Check if monster is dead
        if (this.health <= 0) {
            this.isActive = false;
        }
    }

    draw(ctx) {
        if (!this.isActive) return;

        // Draw monster body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw health bar
        const healthBarWidth = this.radius * 2;
        const healthBarHeight = 5;
        const healthPercentage = this.health / this.maxHealth;

        ctx.fillStyle = '#333';
        ctx.fillRect(this.x - this.radius, this.y - this.radius - 10, healthBarWidth, healthBarHeight);

        ctx.fillStyle = '#FF0000';
        ctx.fillRect(this.x - this.radius, this.y - this.radius - 10, healthBarWidth * healthPercentage, healthBarHeight);
    }

    takeDamage(damage) {
        this.health -= damage;
        if (this.health <= 0) {
            this.isActive = false;
        }
    }
}

/**
 * Monster spawner
 */
class MonsterSpawner {
    constructor(canvas) {
        this.canvas = canvas;
        this.spawnInterval = 800; // Much faster spawning (was 3000ms)
        this.spawnTimer = 0;
        this.difficultyTimer = 0;
        this.difficultyInterval = 15000; // Increase difficulty faster (was 30000ms)
        this.difficulty = 1;
        this.maxMonstersOnScreen = 50; // Maximum number of monsters allowed on screen
        this.spawnBatchSize = 3; // Spawn multiple monsters at once
    }

    update(deltaTime, monsters) {
        // Only spawn if we haven't reached the maximum number of monsters
        if (monsters.length < this.maxMonstersOnScreen) {
            // Spawn timer
            this.spawnTimer += deltaTime * 1000;
            if (this.spawnTimer >= this.spawnInterval) {
                // Spawn multiple monsters at once
                for (let i = 0; i < this.spawnBatchSize; i++) {
                    if (monsters.length < this.maxMonstersOnScreen) {
                        this.spawnMonster(monsters);
                    }
                }
                this.spawnTimer = 0;
            }
        }

        // Difficulty timer
        this.difficultyTimer += deltaTime * 1000;
        if (this.difficultyTimer >= this.difficultyInterval) {
            this.increaseDifficulty();
            this.difficultyTimer = 0;
        }
    }

    spawnMonster(monsters) {
        // Determine spawn position (outside the canvas)
        let x, y;
        const side = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left

        switch (side) {
            case 0: // Top
                x = Math.random() * this.canvas.width;
                y = -30;
                break;
            case 1: // Right
                x = this.canvas.width + 30;
                y = Math.random() * this.canvas.height;
                break;
            case 2: // Bottom
                x = Math.random() * this.canvas.width;
                y = this.canvas.height + 30;
                break;
            case 3: // Left
                x = -30;
                y = Math.random() * this.canvas.height;
                break;
        }

        // Create monster with properties based on difficulty
        const radius = 15 + Math.random() * 10;
        const health = 30 + (this.difficulty * 10);
        const speed = 50 + (this.difficulty * 5);
        const color = `hsl(${Math.random() * 360}, 70%, 50%)`;

        monsters.push(new Monster(x, y, radius, health, speed, color));
    }

    increaseDifficulty() {
        this.difficulty++;
        this.spawnInterval = Math.max(200, this.spawnInterval - 100);
        this.spawnBatchSize = Math.min(10, this.spawnBatchSize + 1);
        this.maxMonstersOnScreen = Math.min(100, this.maxMonstersOnScreen + 5);
    }
}
