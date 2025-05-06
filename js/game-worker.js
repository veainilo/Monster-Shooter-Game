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
        collisionProcessTime: 0,
        workerBusy: false, // Flag to track if worker is processing data

        // Performance tracking
        mainThreadFps: 0, // Track main thread FPS separately from worker FPS
        lastMainThreadFpsUpdate: 0,
        mainThreadFrameCount: 0
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

        // Initialize FPS tracking timestamps
        const currentTime = getWorkerTimestamp();
        workerGameState.lastFpsUpdate = currentTime;
        workerGameState.lastMainThreadFpsUpdate = currentTime;

        // Start game loop
        workerGameLoop(currentTime);
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

    // FPS calculation - track both main thread and worker FPS
    workerGameState.frameCount++;
    workerGameState.mainThreadFrameCount++;

    // Update FPS every second
    if (timestamp - workerGameState.lastFpsUpdate >= 1000) {
        // Calculate worker FPS (this is the FPS including worker processing)
        workerGameState.fps = Math.round((workerGameState.frameCount * 1000) / (timestamp - workerGameState.lastFpsUpdate));
        workerGameState.frameCount = 0;
        workerGameState.lastFpsUpdate = timestamp;

        // Calculate main thread FPS (this is the raw FPS without worker limitations)
        workerGameState.mainThreadFps = Math.round((workerGameState.mainThreadFrameCount * 1000) / (timestamp - workerGameState.lastMainThreadFpsUpdate));
        workerGameState.mainThreadFrameCount = 0;
        workerGameState.lastMainThreadFpsUpdate = timestamp;
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

    // Spawn monsters - use the same spawning logic as the original version
    monsterSpawner.update(deltaTime, monsters);

    // Ensure all monsters and bullets have IDs
    monsters.forEach((monster, index) => {
        if (!monster.id) {
            monster.id = `monster-${index}-${Date.now()}`;
        }
        // Always ensure monster color is white
        monster.color = '#FFFFFF';
    });

    bullets.forEach((bullet, index) => {
        if (!bullet.id) {
            bullet.id = `bullet-${index}-${Date.now()}`;
        }
    });

    // Check if we need to send data to worker
    // Only send if the worker is not busy processing the previous data
    // This ensures we don't overwhelm the worker with too many messages
    if (!workerGameState.workerBusy) {
        // Mark worker as busy until it responds
        workerGameState.workerBusy = true;

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

        // Send collision data to worker for processing using transferable objects
        // Serialize data to ArrayBuffer for transfer
        const buffer = serializeGameData(collisionData);

        gameWorker.postMessage({
            type: 'processCollisions',
            buffer: buffer
        }, [buffer]);  // Transfer ownership of the buffer to avoid copying
    }

    // Continue with other game logic regardless of worker status
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

/**
 * Serialize game data to ArrayBuffer for transfer to worker
 * @param {Object} data - Game state data for collision processing
 * @returns {ArrayBuffer} - Serialized data in ArrayBuffer
 */
function serializeGameData(data) {
    const { player, monsters, bullets } = data;

    // Calculate buffer size
    let bufferSize = 4; // Player data (x, y, radius, mass)
    bufferSize += 1 + monsters.length * 4; // Monster count + monster data (x, y, radius, mass)
    bufferSize += 1 + bullets.length * 8; // Bullet count + bullet data (x, y, radius, isPlayerBullet, damage, currentPierceCount, maxPierceCount, isActive)

    // Create buffer
    const buffer = new ArrayBuffer(bufferSize * 4); // 4 bytes per float
    const view = new Float32Array(buffer);

    let offset = 0;

    // Write player data
    view[offset++] = player.x;
    view[offset++] = player.y;
    view[offset++] = player.radius;
    view[offset++] = player.mass || 1;

    // Write monster count
    view[offset++] = monsters.length;

    // Write monster data
    monsters.forEach(monster => {
        view[offset++] = monster.x;
        view[offset++] = monster.y;
        view[offset++] = monster.radius;
        view[offset++] = monster.mass || 1;
    });

    // Write bullet count
    view[offset++] = bullets.length;

    // Write bullet data
    bullets.forEach(bullet => {
        view[offset++] = bullet.x;
        view[offset++] = bullet.y;
        view[offset++] = bullet.radius;
        view[offset++] = bullet.isPlayerBullet ? 1 : 0;
        view[offset++] = bullet.damage;
        view[offset++] = bullet.currentPierceCount;
        view[offset++] = bullet.maxPierceCount;
        view[offset++] = bullet.isActive ? 1 : 0;
    });

    return buffer;
}

/**
 * Deserialize results from ArrayBuffer received from worker
 * @param {ArrayBuffer} buffer - Buffer containing serialized results
 * @returns {Object} - Deserialized results
 */
function deserializeResults(buffer) {
    const view = new Float32Array(buffer);
    let offset = 0;

    // Read player data
    const player = {
        x: view[offset++],
        y: view[offset++],
        radius: view[offset++],
        mass: view[offset++]
    };

    // Read score
    const score = view[offset++];

    // Read monster count
    const monsterCount = view[offset++];
    const monsters = [];

    // Read monster data
    for (let i = 0; i < monsterCount; i++) {
        monsters.push({
            x: view[offset++],
            y: view[offset++],
            radius: view[offset++],
            mass: view[offset++],
            flash: view[offset++] > 0,
            id: `monster-${i}`
        });
    }

    // Read bullet count
    const bulletCount = view[offset++];
    const bullets = [];

    // Read bullet data
    for (let i = 0; i < bulletCount; i++) {
        const bulletIndex = view[offset++];
        bullets.push({
            id: `bullet-${bulletIndex}`,
            isActive: view[offset++] > 0,
            currentPierceCount: view[offset++]
        });
    }

    return { player, monsters, bullets, score };
}

// Handle messages from the worker
function handleWorkerMessage(e) {
    const message = e.data;

    switch (message.type) {
        case 'collisionResults':
            // Apply collision results from worker
            let results;

            if (message.buffer) {
                // Deserialize from ArrayBuffer if using transferable
                results = deserializeResults(message.buffer);
            } else {
                // Fallback to old method
                results = message.data;
            }

            applyCollisionResults(results);
            workerGameState.collisionsProcessedByWorker = true;
            workerGameState.collisionProcessTime = message.processTime;

            // Mark worker as no longer busy - ready to receive new data
            workerGameState.workerBusy = false;
            break;

        case 'error':
            console.error('Worker error:', message.error);
            // Also mark worker as no longer busy in case of error
            workerGameState.workerBusy = false;
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
        // Ensure all monsters have IDs
        workerGameState.monsters.forEach((monster, index) => {
            if (!monster.id) {
                monster.id = `monster-${index}`;
            }
        });

        // Update positions and handle flashing - optimized for performance
        for (let i = 0; i < Math.min(monsters.length, workerGameState.monsters.length); i++) {
            const updatedMonster = monsters[i];
            const monster = workerGameState.monsters[i];

            // Update position
            monster.x = updatedMonster.x;
            monster.y = updatedMonster.y;

            // Handle flashing effect
            if (updatedMonster.flash) {
                // Flash effect - we'll use a simple approach since monsters are already white
                // This is just to indicate hit feedback
                setTimeout(() => {
                    if (monster && monster.isActive) {
                        monster.color = '#FFFFFF'; // Reset to white
                    }
                }, 50);
            }
        }
    }

    // Update bullet states - optimized for performance
    if (bullets && bullets.length > 0) {
        // Create a map for faster lookups
        const bulletMap = new Map();
        workerGameState.bullets.forEach(bullet => {
            bulletMap.set(bullet.id, bullet);
        });

        bullets.forEach(updatedBullet => {
            const bullet = bulletMap.get(updatedBullet.id);
            if (bullet) {
                bullet.isActive = updatedBullet.isActive;
                bullet.currentPierceCount = updatedBullet.currentPierceCount;
            }
        });
    }

    // Update score if changed
    if (score !== undefined) {
        workerGameState.player.score += score; // Add to current score
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
        // Always use white color for monsters
        workerCtx.fillStyle = '#FFFFFF';
        workerCtx.beginPath();
        workerCtx.arc(monster.x, monster.y, monster.radius, 0, Math.PI * 2);
        workerCtx.fill();

        // Draw health bar (similar to original Monster class)
        const healthBarWidth = monster.radius * 2;
        const healthBarHeight = 5;

        workerCtx.fillStyle = '#333';
        workerCtx.fillRect(monster.x - monster.radius, monster.y - monster.radius - 10, healthBarWidth, healthBarHeight);

        workerCtx.fillStyle = '#FF0000';
        workerCtx.fillRect(monster.x - monster.radius, monster.y - monster.radius - 10, healthBarWidth, healthBarHeight);
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
    const { player, limitFrameRate, monsterSpawner, collisionProcessTime } = workerGameState;

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

    // Display main thread FPS
    const mainFps = workerGameState.mainThreadFps || 0;

    document.getElementById('worker-fps').textContent = `FPS: ${mainFps} - ${modeText}${workerText}`;
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
