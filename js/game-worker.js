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

// Game state and worker - make them globally accessible
let gameWorker = null;
window.workerGameState = null;

// High performance timestamp function for worker version
const getWorkerTimestamp = () => {
    return window.performance && window.performance.now ? window.performance.now() : Date.now();
};

// Initialize worker game
function initWorkerGame() {
    resizeWorkerCanvas();

    // Create game state identical to the original game
    window.workerGameState = {
        player: new Player(workerCanvas.width / 2, workerCanvas.height / 2, workerCanvas),
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

        // Frame rate limiting - start with unlimited frame rate for better performance comparison
        limitFrameRate: false, // Default to unlimited frame rate for worker version
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
        mainThreadFrameCount: 0,

        // Detailed timing measurements
        timings: {
            playerUpdateTime: 0,
            monsterUpdateTime: 0,
            bulletUpdateTime: 0,
            monsterSpawnTime: 0,
            dataSerializationTime: 0,
            renderTime: 0,
            totalFrameTime: 0
        }
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
    // Start measuring total frame time
    const frameStartTime = getWorkerTimestamp();

    // If no timestamp provided (first call), use current time
    if (!timestamp) timestamp = frameStartTime;

    // Calculate delta time
    const deltaTime = (timestamp - workerGameState.lastTime) / 1000;
    workerGameState.lastTime = timestamp;

    // More accurate FPS calculation
    workerGameState.frameCount++;
    if (timestamp - workerGameState.lastFpsUpdate >= 1000) {
        // Calculate FPS based on actual time elapsed for more accuracy
        const elapsed = timestamp - workerGameState.lastFpsUpdate;
        workerGameState.fps = Math.round((workerGameState.frameCount * 1000) / elapsed);
        workerGameState.frameCount = 0;
        workerGameState.lastFpsUpdate = timestamp;
    }

    // Clear canvas
    workerCtx.fillStyle = '#111';
    workerCtx.fillRect(0, 0, workerCanvas.width, workerCanvas.height);

    if (!workerGameState.isGameOver) {
        // Update game
        updateWorkerGame(deltaTime);

        // Measure render time
        const renderStartTime = getWorkerTimestamp();

        // Draw game
        drawWorkerGame();

        // Calculate render time
        workerGameState.timings.renderTime = getWorkerTimestamp() - renderStartTime;

        // Update UI
        updateWorkerUI();
    } else {
        // Draw game over screen
        drawWorkerGameOver();
    }

    // Calculate total frame time
    workerGameState.timings.totalFrameTime = getWorkerTimestamp() - frameStartTime;

    // Continue game loop based on frame rate limiting setting
    if (workerGameState.limitFrameRate) {
        // Use requestAnimationFrame for limited frame rate (usually 60 FPS)
        workerGameState.animationFrameId = requestAnimationFrame(workerGameLoop);
    } else {
        // For truly unlimited frame rate, use direct setTimeout with 0 delay
        // This bypasses requestAnimationFrame's sync to monitor refresh rate
        // and allows the game to run as fast as the CPU can handle
        workerGameState.timeoutId = setTimeout(() => {
            const nextTimestamp = getWorkerTimestamp();
            workerGameLoop(nextTimestamp);
        }, 0);
    }
}

// Update game state
function updateWorkerGame(deltaTime) {
    const { player, monsters, bullets, monsterSpawner } = workerGameState;

    // Measure player update time
    const playerStartTime = getWorkerTimestamp();

    // Update player
    player.update(deltaTime, monsters, bullets);

    // Calculate player update time
    workerGameState.timings.playerUpdateTime = getWorkerTimestamp() - playerStartTime;

    // Measure monster update time
    const monsterStartTime = getWorkerTimestamp();

    // Update monsters
    monsters.forEach(monster => {
        monster.update(deltaTime, player, bullets);
    });

    // Calculate monster update time
    workerGameState.timings.monsterUpdateTime = getWorkerTimestamp() - monsterStartTime;

    // Measure bullet update time
    const bulletStartTime = getWorkerTimestamp();

    // Update bullets
    bullets.forEach(bullet => {
        bullet.update(deltaTime);
    });

    // Calculate bullet update time
    workerGameState.timings.bulletUpdateTime = getWorkerTimestamp() - bulletStartTime;

    // Measure monster spawning time
    const spawnStartTime = getWorkerTimestamp();

    // Spawn monsters - use the same spawning logic as the original version
    monsterSpawner.update(deltaTime, monsters);

    // Calculate monster spawning time
    workerGameState.timings.monsterSpawnTime = getWorkerTimestamp() - spawnStartTime;

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

    // Send data to worker only if it's not busy
    if (!workerGameState.workerBusy) {
        // Mark worker as busy until it responds
        workerGameState.workerBusy = true;

        // Measure data serialization time
        const serializationStartTime = getWorkerTimestamp();

        // Calculate buffer size needed to avoid allocating too much memory
        const monsterDataSize = monsters.length * 3; // x, y, radius for each monster
        const bulletDataSize = bullets.length * 6; // x, y, radius, isPlayerBullet, currentPierceCount, maxPierceCount
        const bufferSize = 4 + monsterDataSize + bulletDataSize; // Player data (3) + monster count (1) + bullet count (1)

        // Serialize data to ArrayBuffer for transfer - use a more appropriate size
        const buffer = new ArrayBuffer(Math.max(bufferSize * 4, 1024)); // Ensure minimum size of 1KB
        const view = new Float32Array(buffer);

        // Store data in the buffer (simplified approach)
        let offset = 0;

        // Player data
        view[offset++] = player.x;
        view[offset++] = player.y;
        view[offset++] = player.radius;

        // Monster count
        view[offset++] = monsters.length;

        // Monster data - only send active monsters
        monsters.forEach(monster => {
            if (monster.isActive) {
                view[offset++] = monster.x;
                view[offset++] = monster.y;
                view[offset++] = monster.radius;
            }
        });

        // Bullet count
        view[offset++] = bullets.length;

        // Bullet data - only send active bullets
        bullets.forEach(bullet => {
            if (bullet.isActive) {
                view[offset++] = bullet.x;
                view[offset++] = bullet.y;
                view[offset++] = bullet.radius;
                view[offset++] = bullet.isPlayerBullet ? 1 : 0;
                view[offset++] = bullet.currentPierceCount;
                view[offset++] = bullet.maxPierceCount;
            }
        });

        // Calculate data serialization time
        workerGameState.timings.dataSerializationTime = getWorkerTimestamp() - serializationStartTime;

        // Send data to worker using transferable
        gameWorker.postMessage({
            type: 'processCollisions',
            buffer: buffer,
            bufferSize: offset
        }, [buffer]);
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



// Handle messages from the worker
function handleWorkerMessage(e) {
    const message = e.data;

    switch (message.type) {
        case 'collisionResults':
            // Apply collision results from worker
            if (message.buffer) {
                // Deserialize from ArrayBuffer
                const view = new Float32Array(message.buffer);
                const results = deserializeResults(view);
                applyCollisionResults(results);
            } else {
                applyCollisionResults(message.data);
            }

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

/**
 * Deserialize results from Float32Array
 * @param {Float32Array} view - Float32Array containing serialized results
 * @returns {Object} - Deserialized results
 */
function deserializeResults(view) {
    let offset = 0;

    // Read player data
    const player = {
        x: view[offset++],
        y: view[offset++]
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

// Apply collision results from worker
function applyCollisionResults(results) {
    // Apply results directly without using requestAnimationFrame
    // This is safer and avoids potential timing issues
        const { player, monsters, bullets, score } = results;

        // Update player position if changed
        if (player) {
            workerGameState.player.x = player.x;
            workerGameState.player.y = player.y;
        }

        // Update monster positions - use minimal updates
        if (monsters && monsters.length > 0) {
            // Use a more efficient approach - direct index matching instead of searching
            const monsterCount = Math.min(monsters.length, workerGameState.monsters.length);

            for (let i = 0; i < monsterCount; i++) {
                const updatedMonster = monsters[i];
                const monster = workerGameState.monsters[i];

                // Only update position - minimize work in main thread
                monster.x = updatedMonster.x;
                monster.y = updatedMonster.y;

                // Simplified flash handling - no setTimeout to reduce overhead
                if (updatedMonster.flash) {
                    monster.color = '#FFFFFF';
                }
            }
        }

        // Update bullet states - use minimal processing
        if (bullets && bullets.length > 0) {
            // Create a map for faster lookups - only once
            if (!workerGameState.bulletMap) {
                workerGameState.bulletMap = new Map();
            } else {
                workerGameState.bulletMap.clear();
            }

            // Populate map
            workerGameState.bullets.forEach(bullet => {
                workerGameState.bulletMap.set(bullet.id, bullet);
            });

            // Apply updates
            bullets.forEach(updatedBullet => {
                const bullet = workerGameState.bulletMap.get(updatedBullet.id);
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

// Draw game with optimizations
function drawWorkerGame() {
    const { player, monsters, bullets } = workerGameState;

    // Only draw active bullets
    const activeBullets = bullets.filter(bullet => bullet.isActive);

    // Batch similar drawing operations to reduce context state changes
    if (activeBullets.length > 0) {
        // Draw player bullets
        const playerBullets = activeBullets.filter(bullet => bullet.isPlayerBullet);
        if (playerBullets.length > 0) {
            workerCtx.fillStyle = '#00FFFF'; // Use a single color for all player bullets
            workerCtx.beginPath();
            playerBullets.forEach(bullet => {
                workerCtx.moveTo(bullet.x + bullet.radius, bullet.y);
                workerCtx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
            });
            workerCtx.fill();
        }

        // Draw monster bullets
        const monsterBullets = activeBullets.filter(bullet => !bullet.isPlayerBullet);
        if (monsterBullets.length > 0) {
            workerCtx.fillStyle = '#FF4444'; // Use a single color for all monster bullets
            workerCtx.beginPath();
            monsterBullets.forEach(bullet => {
                workerCtx.moveTo(bullet.x + bullet.radius, bullet.y);
                workerCtx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
            });
            workerCtx.fill();
        }
    }

    // Only draw active monsters
    const activeMonsters = monsters.filter(monster => monster.isActive);

    // Draw monsters - batch for better performance
    if (activeMonsters.length > 0) {
        // Draw monster bodies
        workerCtx.fillStyle = '#FFFFFF';
        workerCtx.beginPath();
        activeMonsters.forEach(monster => {
            workerCtx.moveTo(monster.x + monster.radius, monster.y);
            workerCtx.arc(monster.x, monster.y, monster.radius, 0, Math.PI * 2);
        });
        workerCtx.fill();

        // Draw health bars
        workerCtx.fillStyle = '#333';
        activeMonsters.forEach(monster => {
            const healthBarWidth = monster.radius * 2;
            const healthBarHeight = 5;
            workerCtx.fillRect(monster.x - monster.radius, monster.y - monster.radius - 10, healthBarWidth, healthBarHeight);
        });

        workerCtx.fillStyle = '#FF0000';
        activeMonsters.forEach(monster => {
            const healthBarWidth = monster.radius * 2;
            const healthBarHeight = 5;
            workerCtx.fillRect(monster.x - monster.radius, monster.y - monster.radius - 10, healthBarWidth, healthBarHeight);
        });
    }

    // Draw player
    if (player.isActive) {
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

// Update UI every frame - only show FPS for better performance
function updateWorkerUI() {
    // Make sure workerGameState still exists
    if (!workerGameState) return;

    const { limitFrameRate, collisionProcessTime } = workerGameState;

    // Only display FPS information to reduce UI updates and improve performance
    const modeText = limitFrameRate ? "LIMITED" : "UNLIMITED";
    const workerText = collisionProcessTime > 0 ? ` (Worker: ${collisionProcessTime.toFixed(0)}ms)` : '';

    // Display FPS
    const fps = workerGameState.fps || 0;

    document.getElementById('fps').textContent = `FPS: ${fps} - ${modeText}${workerText}`;

    // Hide other UI elements to improve performance
    document.getElementById('score').style.display = 'none';
    document.getElementById('health').style.display = 'none';
    document.getElementById('level').style.display = 'none';
    document.getElementById('monsters').style.display = 'none';
    document.getElementById('spawn-time').style.display = 'none';

    // Remove timing info element if it exists
    const timingInfoElement = document.getElementById('worker-timing-info');
    if (timingInfoElement) {
        timingInfoElement.remove();
    }
}

// Store event handler references so we can remove them later
const workerEventHandlers = {
    keydown: null,
    keyup: null,
    resize: null
};

// Set up event listeners
function setupWorkerEventListeners() {
    // Remove any existing event listeners first
    removeWorkerEventListeners();

    // Keyboard events - keydown
    workerEventHandlers.keydown = (e) => {
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
                toggleWorkerFrameRateLimit();
                break;
        }
    };

    // Keyboard events - keyup
    workerEventHandlers.keyup = (e) => {
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
    };

    // Window resize
    workerEventHandlers.resize = resizeWorkerCanvas;

    // Add the event listeners
    window.addEventListener('keydown', workerEventHandlers.keydown);
    window.addEventListener('keyup', workerEventHandlers.keyup);
    window.addEventListener('resize', workerEventHandlers.resize);
}

// Remove worker event listeners
function removeWorkerEventListeners() {
    if (workerEventHandlers.keydown) {
        window.removeEventListener('keydown', workerEventHandlers.keydown);
    }

    if (workerEventHandlers.keyup) {
        window.removeEventListener('keyup', workerEventHandlers.keyup);
    }

    if (workerEventHandlers.resize) {
        window.removeEventListener('resize', workerEventHandlers.resize);
    }
}

// Toggle frame rate limiting
function toggleWorkerFrameRateLimit() {
    // Toggle the frame rate limit flag
    workerGameState.limitFrameRate = !workerGameState.limitFrameRate;

    // If we're switching to limited mode, we need to cancel any existing setTimeout
    // and restart the loop with requestAnimationFrame
    if (workerGameState.limitFrameRate) {
        // Cancel any existing timeout
        if (workerGameState.timeoutId) {
            clearTimeout(workerGameState.timeoutId);
            workerGameState.timeoutId = null;
        }

        // Cancel any existing animation frame
        if (workerGameState.animationFrameId) {
            cancelAnimationFrame(workerGameState.animationFrameId);
        }

        // Restart with requestAnimationFrame
        workerGameState.animationFrameId = requestAnimationFrame(workerGameLoop);
    } else {
        // If we're switching to unlimited mode, cancel any existing animation frame
        // and restart with setTimeout
        if (workerGameState.animationFrameId) {
            cancelAnimationFrame(workerGameState.animationFrameId);
            workerGameState.animationFrameId = null;
        }

        // Restart with setTimeout for unlimited frame rate
        workerGameState.timeoutId = setTimeout(() => {
            const nextTimestamp = getWorkerTimestamp();
            workerGameLoop(nextTimestamp);
        }, 0);
    }
}

// Start the worker game when the page loads (for iframe version)
window.addEventListener('load', initWorkerGame);
