/**
 * Main game logic - Original Version (Non-Worker)
 */

// Get canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size to match container
function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}

// Initialize game
function initGame() {
    resizeCanvas();

    // Game state
    const gameState = {
        player: new Player(canvas.width / 2, canvas.height / 2),
        monsters: [],
        bullets: [],
        monsterSpawner: new MonsterSpawner(canvas),
        lastTime: 0,
        isGameOver: false,
        upgradePoints: 0,
        upgradeThreshold: 500, // Score needed for an upgrade

        // FPS calculation
        frameCount: 0,
        lastFpsUpdate: 0,
        fps: 0,

        // Frame rate limiting
        limitFrameRate: false, // Default to unlimited frame rate
        animationFrameId: null, // Store animation frame ID

        // Visual effects systems
        particleSystem: new ParticleSystem()
    };

    // Set up event listeners
    setupEventListeners(gameState);

    // Start game loop with high performance timing
    gameLoop(getTimestamp(), gameState);
}

// High performance timestamp function
const getTimestamp = () => {
    return window.performance && window.performance.now ? window.performance.now() : Date.now();
};

// Game loop with support for both limited and unlimited frame rates
function gameLoop(timestamp, gameState) {
    // If no timestamp provided (first call), use current time
    if (!timestamp) timestamp = getTimestamp();

    // Calculate delta time
    const deltaTime = (timestamp - gameState.lastTime) / 1000;
    gameState.lastTime = timestamp;

    // FPS calculation
    gameState.frameCount++;

    // Update FPS every second
    if (timestamp - gameState.lastFpsUpdate >= 1000) {
        gameState.fps = Math.round((gameState.frameCount * 1000) / (timestamp - gameState.lastFpsUpdate));
        gameState.frameCount = 0;
        gameState.lastFpsUpdate = timestamp;
    }

    // Clear canvas
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!gameState.isGameOver) {
        // Update game
        updateGame(deltaTime, gameState);

        // Draw game
        drawGame(gameState);

        // Update UI
        updateUI(gameState);
    } else {
        // Draw game over screen
        drawGameOver(gameState);
    }

    // Continue game loop based on frame rate limiting setting
    if (gameState.limitFrameRate) {
        // Use requestAnimationFrame for limited frame rate (usually 60 FPS)
        gameState.animationFrameId = requestAnimationFrame((nextTimestamp) => gameLoop(nextTimestamp, gameState));
    } else {
        // Use setTimeout with 0 delay for unlimited frame rate
        setTimeout(() => {
            const nextTimestamp = getTimestamp();
            gameLoop(nextTimestamp, gameState);
        }, 0);
    }
}

// Update game state
function updateGame(deltaTime, gameState) {
    const { player, monsters, bullets, monsterSpawner } = gameState;

    // Update player
    player.update(deltaTime, monsters, bullets);

    // Update monsters
    monsters.forEach(monster => {
        monster.update(deltaTime, player, bullets);
    });

    // Update bullets
    bullets.forEach(bullet => {
        bullet.update(deltaTime);
    });

    // Spawn monsters
    monsterSpawner.update(deltaTime, monsters);

    // Check for collisions
    handleCollisions(gameState);

    // Clean up inactive entities
    cleanupEntities(gameState);

    // Check for game over
    if (!player.isActive) {
        gameState.isGameOver = true;
    }

    // Check for upgrade
    if (player.score >= gameState.upgradeThreshold) {
        gameState.upgradePoints++;
        gameState.upgradeThreshold += 500;
    }
}

// Handle collisions
function handleCollisions(gameState) {
    const { player, monsters, bullets } = gameState;

    // Player-Monster collisions
    monsters.forEach(monster => {
        if (monster.isActive && player.isActive && circlesCollide(player, monster)) {
            resolveCollision(player, monster);
        }
    });

    // Monster-Monster collisions
    for (let i = 0; i < monsters.length; i++) {
        for (let j = i + 1; j < monsters.length; j++) {
            if (monsters[i].isActive && monsters[j].isActive && circlesCollide(monsters[i], monsters[j])) {
                resolveCollision(monsters[i], monsters[j]);
            }
        }
    }

    // Bullet-Monster collisions (both player bullets and monster bullets)
    bullets.forEach(bullet => {
        if (bullet.isActive) {
            monsters.forEach(monster => {
                if (monster.isActive && circlesCollide(bullet, monster)) {
                    // Since monsters are invincible, takeDamage just returns true for scoring
                    if (monster.takeDamage()) {
                        // Only award score if it's a player bullet
                        if (bullet.isPlayerBullet) {
                            player.addScore(50);
                        }
                    }

                    // Handle bullet piercing
                    bullet.currentPierceCount++;
                    if (bullet.currentPierceCount > bullet.maxPierceCount) {
                        bullet.isActive = false;
                    }
                }
            });
        }
    });

    // Bullet-Player collisions - player is invincible but we still show visual feedback
    bullets.forEach(bullet => {
        if (bullet.isActive && !bullet.isPlayerBullet && player.isActive && circlesCollide(bullet, player)) {
            player.takeDamage(0); // 0 damage, just for visual effect
            bullet.isActive = false; // Player bullets don't pierce through player
        }
    });
}

// Clean up inactive entities
function cleanupEntities(gameState) {
    // Since monsters are now invincible, we don't need to filter them
    // Only clean up bullets
    gameState.bullets = gameState.bullets.filter(bullet => bullet.isActive);
}

// Draw game
function drawGame(gameState) {
    const { player, monsters, bullets } = gameState;

    // Draw bullets
    bullets.forEach(bullet => {
        bullet.draw(ctx);
    });

    // Draw monsters
    monsters.forEach(monster => {
        monster.draw(ctx);
    });

    // Draw player
    player.draw(ctx);
}

// Update UI
function updateUI(gameState) {
    const { player, fps, limitFrameRate, monsterSpawner } = gameState;

    document.getElementById('score').textContent = `Score: ${player.score}`;
    document.getElementById('health').textContent = `INVINCIBLE`;
    document.getElementById('level').textContent = `Bullet Level: ${player.bulletLevel}`;

    // Display monster count
    document.getElementById('monsters').textContent = `Monsters: ${monsterSpawner.totalMonstersSpawned}/${monsterSpawner.maxTotalMonsters}`;

    // Display spawn time
    let spawnTimeText = "Spawning...";
    if (monsterSpawner.spawnComplete) {
        spawnTimeText = `${monsterSpawner.spawnDuration.toFixed(2)}s`;
    } else if (monsterSpawner.totalMonstersSpawned > 0) {
        const elapsedTime = (Date.now() - monsterSpawner.spawnStartTime) / 1000;
        spawnTimeText = `${elapsedTime.toFixed(2)}s`;
    }
    document.getElementById('spawn-time').textContent = `Spawn Time: ${spawnTimeText}`;

    // Display FPS with current mode
    const modeText = limitFrameRate ? "LIMITED (60 FPS)" : "UNLIMITED";
    document.getElementById('fps').textContent = `FPS: ${fps} - ${modeText}`;
}

// Draw game over screen
function drawGameOver(gameState) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#FF0000';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 50);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '24px Arial';
    ctx.fillText(`Final Score: ${gameState.player.score}`, canvas.width / 2, canvas.height / 2);

    ctx.font = '18px Arial';
    ctx.fillText('Press R to restart', canvas.width / 2, canvas.height / 2 + 50);
}

// Set up event listeners
function setupEventListeners(gameState) {
    // Keyboard events
    window.addEventListener('keydown', (e) => {
        if (gameState.isGameOver) {
            if (e.key === 'r' || e.key === 'R') {
                initGame();
            }
            return;
        }

        switch (e.key) {
            case 'w':
            case 'W':
            case 'ArrowUp':
                gameState.player.moveUp = true;
                break;
            case 's':
            case 'S':
            case 'ArrowDown':
                gameState.player.moveDown = true;
                break;
            case 'a':
            case 'A':
            case 'ArrowLeft':
                gameState.player.moveLeft = true;
                break;
            case 'd':
            case 'D':
            case 'ArrowRight':
                gameState.player.moveRight = true;
                break;
            case 'u':
            case 'U':
                if (gameState.upgradePoints > 0) {
                    if (gameState.player.upgradeBullet()) {
                        gameState.upgradePoints--;
                    }
                }
                break;
            case 'f':
            case 'F':
                // Toggle frame rate limiting
                gameState.limitFrameRate = !gameState.limitFrameRate;

                // Display current mode
                const modeText = gameState.limitFrameRate ? "LIMITED (60 FPS)" : "UNLIMITED";
                document.getElementById('fps').textContent = `FPS: ${gameState.fps} - ${modeText}`;
                break;
        }
    });

    window.addEventListener('keyup', (e) => {
        switch (e.key) {
            case 'w':
            case 'W':
            case 'ArrowUp':
                gameState.player.moveUp = false;
                break;
            case 's':
            case 'S':
            case 'ArrowDown':
                gameState.player.moveDown = false;
                break;
            case 'a':
            case 'A':
            case 'ArrowLeft':
                gameState.player.moveLeft = false;
                break;
            case 'd':
            case 'D':
            case 'ArrowRight':
                gameState.player.moveRight = false;
                break;
        }
    });

    // No mouse events needed

    // Window resize
    window.addEventListener('resize', resizeCanvas);
}

// Start the game when the page loads
window.addEventListener('load', initGame);
