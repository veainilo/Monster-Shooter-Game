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
        this.shootInterval = 500; // Even faster shooting (500ms)
        this.mass = radius * 2; // Mass for collision resolution
        this.bulletCount = 3; // Shoot multiple bullets at once
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

    takeDamage() {
        // Monster is invincible, but we'll show a visual effect
        this.flashEffect();

        // Still award score to player when hit
        return true; // Return true to indicate a successful hit for scoring
    }

    flashEffect() {
        // Store original color
        const originalColor = this.color;

        // Flash white
        this.color = '#FFFFFF';

        // Reset color after a short delay
        setTimeout(() => {
            this.color = originalColor;
        }, 100);
    }
}

/**
 * Monster spawner
 */
class MonsterSpawner {
    constructor(canvas) {
        this.canvas = canvas;
        this.spawnInterval = 50; // Even faster spawning (50ms)
        this.spawnTimer = 0;
        this.difficultyTimer = 0;
        this.difficultyInterval = 1000; // Increase difficulty every second
        this.difficulty = 1;
        this.maxMonstersOnScreen = 500; // Allow even more monsters on screen
        this.spawnBatchSize = 50; // Spawn even more monsters at once
        this.totalMonstersSpawned = 0; // Track total monsters spawned
        this.maxTotalMonsters = 500; // Maximum total monsters to spawn

        // Calculate parameters to spawn all monsters in 10 seconds
        // 500 monsters in 10 seconds = 50 monsters per second
        this.targetSpawnTime = 10000; // 10 seconds in ms
        this.spawnRate = this.maxTotalMonsters / (this.targetSpawnTime / 1000); // Monsters per second

        // Timer for tracking spawn duration
        this.spawnStartTime = Date.now();
        this.spawnDuration = 0; // Will be updated during spawning
        this.spawnComplete = false;
    }

    update(deltaTime, monsters) {
        // Check if we've reached the total monster limit
        if (this.totalMonstersSpawned >= this.maxTotalMonsters) {
            // If this is the first time we've reached the limit, record the duration
            if (!this.spawnComplete) {
                this.spawnDuration = (Date.now() - this.spawnStartTime) / 1000; // Convert to seconds
                this.spawnComplete = true;
                console.log(`All ${this.maxTotalMonsters} monsters spawned in ${this.spawnDuration.toFixed(2)} seconds`);
            }
            return; // Stop spawning if we've reached the limit
        }

        // Calculate how many monsters to spawn this frame to maintain our target rate
        const monstersToSpawnThisFrame = Math.ceil(this.spawnRate * deltaTime);

        // Only spawn if we haven't reached the maximum number of monsters on screen
        if (monsters.length < this.maxMonstersOnScreen) {
            // Spawn timer - much faster now
            this.spawnTimer += deltaTime * 1000;
            if (this.spawnTimer >= this.spawnInterval) {
                // Spawn a large batch of monsters at once
                const batchSize = Math.min(
                    this.spawnBatchSize,
                    this.maxTotalMonsters - this.totalMonstersSpawned,
                    this.maxMonstersOnScreen - monsters.length,
                    monstersToSpawnThisFrame
                );

                // Spawn the calculated batch size
                for (let i = 0; i < batchSize; i++) {
                    this.spawnMonster(monsters);
                    this.totalMonstersSpawned++;
                }

                this.spawnTimer = 0;
            }
        }

        // Difficulty timer - increase difficulty more frequently
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
        this.spawnInterval = Math.max(50, this.spawnInterval - 10); // Reduce to minimum 50ms
        this.spawnBatchSize = Math.min(50, this.spawnBatchSize + 5); // Increase batch size more aggressively
        this.maxMonstersOnScreen = Math.min(300, this.maxMonstersOnScreen + 20); // Allow more monsters on screen
    }
}
