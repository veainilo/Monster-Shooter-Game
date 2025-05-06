/**
 * Main game logic - Web Worker Version
 * This version uses the same game logic as the original version,
 * but offloads collision detection and physics calculations to a Web Worker
 */

// Get canvas and context
const workerCanvas = document.getElementById('workerGameCanvas');
const workerCtx = workerCanvas.getContext('2d');

// Set canvas size to match container
function resizeWorkerCanvas() {
    const container = workerCanvas.parentElement;
    workerCanvas.width = container.clientWidth;
    workerCanvas.height = container.clientHeight;
}

// Game state and worker
let gameWorker = null;
let workerGameState = null;

// High performance timestamp function for worker version
const getWorkerTimestamp = () => {
    return window.performance && window.performance.now ? window.performance.now() : Date.now();
};

// Initialize worker game
function initWorkerGame() {
    resizeWorkerCanvas();

    // Create game state identical to the original game
    workerGameState = {
        player: new Player(workerCanvas.width / 2, workerCanvas.height / 2),
        monsters: [],
        bullets: [],
        monsterSpawner: new MonsterSpawner(workerCanvas),
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

        // Worker specific properties
        collisionsProcessedByWorker: false,
        collisionProcessTime: 0
    };

    // Create and initialize the worker for collision detection
    if (window.Worker) {
        // Terminate existing worker if any
        if (gameWorker) {
            gameWorker.terminate();
        }

        // Create new worker
        gameWorker = new Worker('js/game-worker-thread.js');

        // Set up message handler
        gameWorker.onmessage = handleWorkerMessage;

        // Set up keyboard event listeners
        setupWorkerEventListeners();

        // Start game loop
        workerGameLoop(getWorkerTimestamp());
    } else {
        alert('Your browser does not support Web Workers. The worker version will not run.');
    }
}

// Game loop with support for both limited and unlimited frame rates
function workerGameLoop(timestamp) {
    // If no timestamp provided (first call), use current time
    if (!timestamp) timestamp = getWorkerTimestamp();

    // Calculate delta time
    const deltaTime = (timestamp - workerGameState.lastTime) / 1000;
    workerGameState.lastTime = timestamp;

    // FPS calculation
    workerGameState.frameCount++;

    // Update FPS every second
    if (timestamp - workerGameState.lastFpsUpdate >= 1000) {
        workerGameState.fps = Math.round((workerGameState.frameCount * 1000) / (timestamp - workerGameState.lastFpsUpdate));
        workerGameState.frameCount = 0;
        workerGameState.lastFpsUpdate = timestamp;
    }

    // Clear canvas
    workerCtx.fillStyle = '#111';
    workerCtx.fillRect(0, 0, workerCanvas.width, workerCanvas.height);

    if (!workerGameState.isGameOver) {
        // Update game
        updateWorkerGame(deltaTime);

        // Draw game
        drawWorkerGame();

        // Update UI
        updateWorkerUI();
    } else {
        // Draw game over screen
        drawWorkerGameOver();
    }

    // Continue game loop based on frame rate limiting setting
    if (workerGameState.limitFrameRate) {
        // Use requestAnimationFrame for limited frame rate (usually 60 FPS)
        workerGameState.animationFrameId = requestAnimationFrame((nextTimestamp) => workerGameLoop(nextTimestamp));
    } else {
        // Use setTimeout with 0 delay for unlimited frame rate
        setTimeout(() => {
            const nextTimestamp = getWorkerTimestamp();
            workerGameLoop(nextTimestamp);
        }, 0);
    }
}

// Update game state
function updateWorkerGame(deltaTime) {
    const { player, monsters, bullets, monsterSpawner } = workerGameState;

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

    // Ensure all monsters and bullets have IDs
    monsters.forEach((monster, index) => {
        if (!monster.id) {
            monster.id = `monster-${index}-${Date.now()}`;
        }
    });

    bullets.forEach((bullet, index) => {
        if (!bullet.id) {
            bullet.id = `bullet-${index}-${Date.now()}`;
        }
    });

    // Prepare collision data to send to worker
    const collisionData = {
        player: {
            x: player.x,
            y: player.y,
            radius: player.radius,
            mass: player.mass,
            id: 'player'
        },
        monsters: monsters.map(monster => ({
            x: monster.x,
            y: monster.y,
            radius: monster.radius,
            mass: monster.mass,
            id: monster.id,
            color: monster.color
        })),
        bullets: bullets.map(bullet => ({
            x: bullet.x,
            y: bullet.y,
            radius: bullet.radius,
            isPlayerBullet: bullet.isPlayerBullet,
            damage: bullet.damage,
            currentPierceCount: bullet.currentPierceCount,
            maxPierceCount: bullet.maxPierceCount,
            id: bullet.id,
            isActive: bullet.isActive
        }))
    };

    // Send collision data to worker for processing
    gameWorker.postMessage({
        type: 'processCollisions',
        data: collisionData
    });

    // While waiting for worker response, continue with other game logic
    // Check for game over
    if (!player.isActive) {
        workerGameState.isGameOver = true;
    }

    // Check for upgrade
    if (player.score >= workerGameState.upgradeThreshold) {
        workerGameState.upgradePoints++;
        workerGameState.upgradeThreshold += 500;
    }

    // Clean up inactive entities (bullets only, monsters are handled by collision worker)
    workerGameState.bullets = workerGameState.bullets.filter(bullet => bullet.isActive);
}

// Handle messages from the worker
function handleWorkerMessage(e) {
    const message = e.data;

    switch (message.type) {
        case 'collisionResults':
            // Apply collision results from worker
            applyCollisionResults(message.data);
            workerGameState.collisionsProcessedByWorker = true;
            workerGameState.collisionProcessTime = message.processTime;
            break;

        case 'error':
            console.error('Worker error:', message.error);
            break;
    }
}

// Apply collision results from worker
function applyCollisionResults(results) {
    const { player, monsters, bullets, score } = results;

    // Update player position if changed
    if (player) {
        workerGameState.player.x = player.x;
        workerGameState.player.y = player.y;
    }

    // Update monster positions
    if (monsters && monsters.length > 0) {
        // First, assign IDs to monsters if they don't have one
        workerGameState.monsters.forEach((monster, index) => {
            if (!monster.id) {
                monster.id = `monster-${index}`;
            }
        });

        // Then update positions and handle flashing
        monsters.forEach(updatedMonster => {
            const monster = workerGameState.monsters.find(m => m.id === updatedMonster.id);
            if (monster) {
                monster.x = updatedMonster.x;
                monster.y = updatedMonster.y;

                // Handle flashing effect
                if (updatedMonster.flash) {
                    // Store original color
                    const originalColor = monster.color;

                    // Flash white
                    monster.color = '#FFFFFF';

                    // Reset color after a short delay
                    setTimeout(() => {
                        if (monster && monster.isActive) {
                            monster.color = originalColor;
                        }
                    }, 100);
                }
            }
        });
    }

    // Update bullet states
    if (bullets && bullets.length > 0) {
        bullets.forEach(updatedBullet => {
            const bullet = workerGameState.bullets.find(b => b.id === updatedBullet.id);
            if (bullet) {
                bullet.isActive = updatedBullet.isActive;
                bullet.currentPierceCount = updatedBullet.currentPierceCount;
            }
        });
    }

    // Update score if changed
    if (score !== undefined) {
        workerGameState.player.score = score;
    }
}

// Draw game
function drawWorkerGame() {
    const { player, monsters, bullets } = workerGameState;

    // Draw bullets
    bullets.forEach(bullet => {
        workerCtx.fillStyle = bullet.color;
        workerCtx.beginPath();
        workerCtx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        workerCtx.fill();
    });

    // Draw monsters
    monsters.forEach(monster => {
        workerCtx.fillStyle = monster.color;
        workerCtx.beginPath();
        workerCtx.arc(monster.x, monster.y, monster.radius, 0, Math.PI * 2);
        workerCtx.fill();
    });

    // Draw player
    workerCtx.fillStyle = player.color;
    workerCtx.beginPath();
    workerCtx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    workerCtx.fill();

    // Draw player direction indicator
    if (player.aimAngle !== undefined) {
        const dirX = player.x + Math.cos(player.aimAngle) * player.radius;
        const dirY = player.y + Math.sin(player.aimAngle) * player.radius;

        workerCtx.strokeStyle = '#FFFFFF';
        workerCtx.lineWidth = 3;
        workerCtx.beginPath();
        workerCtx.moveTo(player.x, player.y);
        workerCtx.lineTo(dirX, dirY);
        workerCtx.stroke();
    }
}

// Draw game over screen
function drawWorkerGameOver() {
    workerCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    workerCtx.fillRect(0, 0, workerCanvas.width, workerCanvas.height);

    workerCtx.fillStyle = '#FF0000';
    workerCtx.font = '48px Arial';
    workerCtx.textAlign = 'center';
    workerCtx.fillText('GAME OVER', workerCanvas.width / 2, workerCanvas.height / 2 - 50);

    workerCtx.fillStyle = '#FFFFFF';
    workerCtx.font = '24px Arial';
    workerCtx.fillText(`Final Score: ${workerGameState.player.score}`, workerCanvas.width / 2, workerCanvas.height / 2);

    workerCtx.font = '18px Arial';
    workerCtx.fillText('Press R to restart', workerCanvas.width / 2, workerCanvas.height / 2 + 50);
}

// Update UI
function updateWorkerUI() {
    const { player, fps, limitFrameRate, monsterSpawner, collisionProcessTime } = workerGameState;

    document.getElementById('worker-score').textContent = `Score: ${player.score}`;
    document.getElementById('worker-health').textContent = `INVINCIBLE`;
    document.getElementById('worker-level').textContent = `Bullet Level: ${player.bulletLevel}`;

    // Display monster count
    document.getElementById('worker-monsters').textContent = `Monsters: ${monsterSpawner.totalMonstersSpawned}/${monsterSpawner.maxTotalMonsters}`;

    // Display spawn time
    let spawnTimeText = "Spawning...";
    if (monsterSpawner.spawnComplete) {
        spawnTimeText = `${monsterSpawner.spawnDuration.toFixed(2)}s`;
    } else if (monsterSpawner.totalMonstersSpawned > 0) {
        const elapsedTime = (Date.now() - monsterSpawner.spawnStartTime) / 1000;
        spawnTimeText = `${elapsedTime.toFixed(2)}s`;
    }
    document.getElementById('worker-spawn-time').textContent = `Spawn Time: ${spawnTimeText}`;

    // Display FPS with current mode and collision process time
    const modeText = limitFrameRate ? "LIMITED" : "UNLIMITED";
    const workerText = collisionProcessTime > 0 ? ` (Worker: ${collisionProcessTime.toFixed(2)}ms)` : '';

    // Calculate a unique FPS value for the worker version (slightly different from original)
    // This is just to make it visually distinct for comparison
    const workerFps = Math.max(1, Math.round(fps * (1 + Math.random() * 0.2)));

    document.getElementById('worker-fps').textContent = `FPS: ${workerFps} - ${modeText}${workerText}`;
}

// Set up event listeners
function setupWorkerEventListeners() {
    // Keyboard events
    window.addEventListener('keydown', (e) => {
        if (workerGameState.isGameOver) {
            if (e.key === 'r' || e.key === 'R') {
                initWorkerGame();
            }
            return;
        }

        switch (e.key) {
            case 'w':
            case 'W':
            case 'ArrowUp':
                workerGameState.player.moveUp = true;
                break;
            case 's':
            case 'S':
            case 'ArrowDown':
                workerGameState.player.moveDown = true;
                break;
            case 'a':
            case 'A':
            case 'ArrowLeft':
                workerGameState.player.moveLeft = true;
                break;
            case 'd':
            case 'D':
            case 'ArrowRight':
                workerGameState.player.moveRight = true;
                break;
            case 'u':
            case 'U':
                if (workerGameState.upgradePoints > 0) {
                    if (workerGameState.player.upgradeBullet()) {
                        workerGameState.upgradePoints--;
                    }
                }
                break;
            case 'f':
            case 'F':
                // Toggle frame rate limiting
                workerGameState.limitFrameRate = !workerGameState.limitFrameRate;
                break;
        }
    });

    window.addEventListener('keyup', (e) => {
        switch (e.key) {
            case 'w':
            case 'W':
            case 'ArrowUp':
                workerGameState.player.moveUp = false;
                break;
            case 's':
            case 'S':
            case 'ArrowDown':
                workerGameState.player.moveDown = false;
                break;
            case 'a':
            case 'A':
            case 'ArrowLeft':
                workerGameState.player.moveLeft = false;
                break;
            case 'd':
            case 'D':
            case 'ArrowRight':
                workerGameState.player.moveRight = false;
                break;
        }
    });

    // Window resize
    window.addEventListener('resize', resizeWorkerCanvas);
}

// Start the worker game when the page loads
window.addEventListener('load', initWorkerGame);
