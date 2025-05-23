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

    // Game state - make it globally accessible
    window.gameState = {
        player: new Player(canvas.width / 2, canvas.height / 2, canvas),
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
        particleSystem: new ParticleSystem(),

        // Detailed timing measurements
        timings: {
            playerUpdateTime: 0,
            monsterUpdateTime: 0,
            bulletUpdateTime: 0,
            monsterSpawnTime: 0,
            collisionTime: 0,
            renderTime: 0,
            totalFrameTime: 0
        }
    };

    // Set up event listeners
    setupEventListeners(window.gameState);

    // Start game loop with high performance timing
    gameLoop(getTimestamp(), window.gameState);
}

// High performance timestamp function
const getTimestamp = () => {
    return window.performance && window.performance.now ? window.performance.now() : Date.now();
};

// Game loop with support for both limited and unlimited frame rates
function gameLoop(timestamp, gameState) {
    // Start measuring total frame time
    const frameStartTime = getTimestamp();

    // If no timestamp provided (first call), use current time
    if (!timestamp) timestamp = frameStartTime;

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

        // Measure render time
        const renderStartTime = getTimestamp();

        // Draw game
        drawGame(gameState);

        // Calculate render time
        gameState.timings.renderTime = getTimestamp() - renderStartTime;

        // Update UI
        updateUI(gameState);
    } else {
        // Draw game over screen
        drawGameOver(gameState);
    }

    // Calculate total frame time
    gameState.timings.totalFrameTime = getTimestamp() - frameStartTime;

    // Continue game loop based on frame rate limiting setting
    if (gameState.limitFrameRate) {
        // Use requestAnimationFrame for limited frame rate (usually 60 FPS)
        gameState.animationFrameId = requestAnimationFrame((nextTimestamp) => gameLoop(nextTimestamp, gameState));
    } else {
        // Use setTimeout with 0 delay for unlimited frame rate
        // Store the timeout ID so we can clear it when stopping the game
        gameState.timeoutId = setTimeout(() => {
            const nextTimestamp = getTimestamp();
            gameLoop(nextTimestamp, gameState);
        }, 0);
    }
}

// Update game state
function updateGame(deltaTime, gameState) {
    const { player, monsters, bullets, monsterSpawner } = gameState;

    // Measure player update time
    const playerStartTime = getTimestamp();

    // Update player
    player.update(deltaTime, monsters, bullets);

    // Calculate player update time
    gameState.timings.playerUpdateTime = getTimestamp() - playerStartTime;

    // Measure monster update time
    const monsterStartTime = getTimestamp();

    // Update monsters
    monsters.forEach(monster => {
        monster.update(deltaTime, player, bullets);
    });

    // Calculate monster update time
    gameState.timings.monsterUpdateTime = getTimestamp() - monsterStartTime;

    // Measure bullet update time
    const bulletStartTime = getTimestamp();

    // Update bullets
    bullets.forEach(bullet => {
        bullet.update(deltaTime);
    });

    // Calculate bullet update time
    gameState.timings.bulletUpdateTime = getTimestamp() - bulletStartTime;

    // Measure monster spawning time
    const spawnStartTime = getTimestamp();

    // Spawn monsters
    monsterSpawner.update(deltaTime, monsters);

    // Calculate monster spawning time
    gameState.timings.monsterSpawnTime = getTimestamp() - spawnStartTime;

    // Measure collision detection time
    const collisionStartTime = getTimestamp();

    // Check for collisions
    handleCollisions(gameState);

    // Calculate collision detection time
    gameState.timings.collisionTime = getTimestamp() - collisionStartTime;

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

// Update UI - only show FPS for better performance
function updateUI(gameState) {
    const { fps, limitFrameRate } = gameState;

    // Only display FPS information to reduce UI updates and improve performance
    const modeText = limitFrameRate ? "LIMITED (60 FPS)" : "UNLIMITED";
    document.getElementById('fps').textContent = `FPS: ${fps} - ${modeText}`;

    // Hide other UI elements to improve performance
    document.getElementById('score').style.display = 'none';
    document.getElementById('health').style.display = 'none';
    document.getElementById('level').style.display = 'none';
    document.getElementById('monsters').style.display = 'none';
    document.getElementById('spawn-time').style.display = 'none';

    // Remove timing info element if it exists
    const timingInfoElement = document.getElementById('timing-info');
    if (timingInfoElement) {
        timingInfoElement.remove();
    }
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

// Start the game when the page loads (for iframe version)
window.addEventListener('load', initGame);
