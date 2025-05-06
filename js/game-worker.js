/**
 * Main game logic - Web Worker Version
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
let workerGameState = {
    fps: 0,
    limitFrameRate: false,
    lastFrameTime: 0,
    frameCount: 0,
    lastFpsUpdate: 0
};

// Initialize worker game
function initWorkerGame() {
    resizeWorkerCanvas();
    
    // Create game state for rendering
    workerGameState = {
        player: {
            x: workerCanvas.width / 2,
            y: workerCanvas.height / 2,
            radius: 20,
            color: '#00FF00',
            aimAngle: 0,
            score: 0,
            health: 100,
            bulletLevel: 1
        },
        monsters: [],
        bullets: [],
        monsterStats: {
            totalSpawned: 0,
            maxTotal: 500,
            spawnComplete: false,
            spawnDuration: 0,
            spawnStartTime: Date.now()
        },
        fps: 0,
        limitFrameRate: false,
        lastFrameTime: 0,
        frameCount: 0,
        lastFpsUpdate: 0,
        isGameOver: false,
        canvasWidth: workerCanvas.width,
        canvasHeight: workerCanvas.height
    };
    
    // Create and initialize the worker
    if (window.Worker) {
        // Terminate existing worker if any
        if (gameWorker) {
            gameWorker.terminate();
        }
        
        // Create new worker
        gameWorker = new Worker('js/game-worker-thread.js');
        
        // Send initial canvas dimensions to worker
        gameWorker.postMessage({
            type: 'init',
            canvasWidth: workerCanvas.width,
            canvasHeight: workerCanvas.height
        });
        
        // Set up message handler
        gameWorker.onmessage = handleWorkerMessage;
        
        // Set up keyboard event listeners
        setupWorkerEventListeners();
        
        // Start the rendering loop
        requestAnimationFrame(renderWorkerGame);
    } else {
        alert('Your browser does not support Web Workers. The worker version will not run.');
    }
}

// Handle messages from the worker
function handleWorkerMessage(e) {
    const message = e.data;
    
    switch (message.type) {
        case 'gameState':
            // Update our local copy of the game state
            workerGameState.player = message.player;
            workerGameState.monsters = message.monsters;
            workerGameState.bullets = message.bullets;
            workerGameState.monsterStats = message.monsterStats;
            workerGameState.isGameOver = message.isGameOver;
            
            // Update UI
            updateWorkerUI();
            break;
            
        case 'fps':
            workerGameState.fps = message.fps;
            updateWorkerUI();
            break;
    }
}

// Render the game based on the state received from the worker
function renderWorkerGame(timestamp) {
    // Calculate FPS for the rendering thread
    if (!workerGameState.lastFrameTime) {
        workerGameState.lastFrameTime = timestamp;
    }
    
    const deltaTime = (timestamp - workerGameState.lastFrameTime) / 1000;
    workerGameState.lastFrameTime = timestamp;
    
    // FPS calculation for rendering
    workerGameState.frameCount++;
    if (timestamp - workerGameState.lastFpsUpdate >= 1000) {
        const renderFps = Math.round((workerGameState.frameCount * 1000) / (timestamp - workerGameState.lastFpsUpdate));
        workerGameState.frameCount = 0;
        workerGameState.lastFpsUpdate = timestamp;
        
        // Update render FPS in UI
        document.getElementById('worker-fps').textContent = `FPS: ${workerGameState.fps} (Render: ${renderFps})`;
    }
    
    // Clear canvas
    workerCtx.fillStyle = '#111';
    workerCtx.fillRect(0, 0, workerCanvas.width, workerCanvas.height);
    
    if (!workerGameState.isGameOver) {
        // Draw game entities
        drawWorkerGame();
    } else {
        // Draw game over screen
        drawWorkerGameOver();
    }
    
    // Continue rendering loop
    requestAnimationFrame(renderWorkerGame);
}

// Draw game entities
function drawWorkerGame() {
    // Draw bullets
    workerGameState.bullets.forEach(bullet => {
        workerCtx.fillStyle = bullet.color;
        workerCtx.beginPath();
        workerCtx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        workerCtx.fill();
    });
    
    // Draw monsters
    workerGameState.monsters.forEach(monster => {
        workerCtx.fillStyle = monster.color;
        workerCtx.beginPath();
        workerCtx.arc(monster.x, monster.y, monster.radius, 0, Math.PI * 2);
        workerCtx.fill();
        
        // Draw health bar
        const healthBarWidth = monster.radius * 2;
        const healthBarHeight = 5;
        const healthPercentage = monster.health / monster.maxHealth;
        
        workerCtx.fillStyle = '#333';
        workerCtx.fillRect(monster.x - monster.radius, monster.y - monster.radius - 10, healthBarWidth, healthBarHeight);
        
        workerCtx.fillStyle = '#FF0000';
        workerCtx.fillRect(monster.x - monster.radius, monster.y - monster.radius - 10, healthBarWidth * healthPercentage, healthBarHeight);
    });
    
    // Draw player
    const player = workerGameState.player;
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

// Update UI elements
function updateWorkerUI() {
    const { player, monsterStats, fps, limitFrameRate } = workerGameState;
    
    document.getElementById('worker-score').textContent = `Score: ${player.score}`;
    document.getElementById('worker-health').textContent = `INVINCIBLE`;
    document.getElementById('worker-level').textContent = `Bullet Level: ${player.bulletLevel}`;
    
    // Display monster count
    document.getElementById('worker-monsters').textContent = `Monsters: ${monsterStats.totalSpawned}/${monsterStats.maxTotal}`;
    
    // Display spawn time
    let spawnTimeText = "Spawning...";
    if (monsterStats.spawnComplete) {
        spawnTimeText = `${monsterStats.spawnDuration.toFixed(2)}s`;
    } else if (monsterStats.totalSpawned > 0) {
        const elapsedTime = (Date.now() - monsterStats.spawnStartTime) / 1000;
        spawnTimeText = `${elapsedTime.toFixed(2)}s`;
    }
    document.getElementById('worker-spawn-time').textContent = `Spawn Time: ${spawnTimeText}`;
    
    // Display FPS with current mode
    const modeText = limitFrameRate ? "LIMITED (60 FPS)" : "UNLIMITED";
    document.getElementById('worker-fps').textContent = `FPS: ${fps} - ${modeText}`;
}

// Set up event listeners
function setupWorkerEventListeners() {
    // Keyboard events for worker game
    window.addEventListener('keydown', (e) => {
        if (workerGameState.isGameOver) {
            if (e.key === 'r' || e.key === 'R') {
                initWorkerGame();
            }
            return;
        }
        
        // Send key events to worker
        gameWorker.postMessage({
            type: 'keydown',
            key: e.key
        });
    });
    
    window.addEventListener('keyup', (e) => {
        // Send key events to worker
        gameWorker.postMessage({
            type: 'keyup',
            key: e.key
        });
    });
    
    // Window resize
    window.addEventListener('resize', () => {
        resizeWorkerCanvas();
        
        // Inform worker about new canvas dimensions
        if (gameWorker) {
            gameWorker.postMessage({
                type: 'resize',
                canvasWidth: workerCanvas.width,
                canvasHeight: workerCanvas.height
            });
        }
    });
}

// Start the worker game when the page loads
window.addEventListener('load', initWorkerGame);
