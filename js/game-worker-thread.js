/**
 * Web Worker Thread for Game Logic
 * This runs in a separate thread from the main UI
 */

// Game state
let gameState = {
    player: null,
    monsters: [],
    bullets: [],
    monsterStats: {
        totalSpawned: 0,
        maxTotal: 500,
        spawnComplete: false,
        spawnDuration: 0,
        spawnStartTime: Date.now()
    },
    lastTime: 0,
    isGameOver: false,
    upgradePoints: 0,
    upgradeThreshold: 500,
    
    // FPS calculation
    frameCount: 0,
    lastFpsUpdate: 0,
    fps: 0,
    
    // Frame rate limiting
    limitFrameRate: false,
    
    // Canvas dimensions
    canvasWidth: 800,
    canvasHeight: 600
};

// Game constants
const PLAYER_RADIUS = 20;
const PLAYER_SPEED = 200;
const MONSTER_SPAWN_INTERVAL = 50; // ms
const MONSTER_BATCH_SIZE = 50;
const MAX_MONSTERS_ON_SCREEN = 500;
const MAX_TOTAL_MONSTERS = 500;
const BULLET_PIERCE_COUNT = 10;

// Message handler
self.onmessage = function(e) {
    const message = e.data;
    
    switch (message.type) {
        case 'init':
            initGame(message.canvasWidth, message.canvasHeight);
            break;
            
        case 'keydown':
            handleKeyDown(message.key);
            break;
            
        case 'keyup':
            handleKeyUp(message.key);
            break;
            
        case 'resize':
            gameState.canvasWidth = message.canvasWidth;
            gameState.canvasHeight = message.canvasHeight;
            break;
    }
};

// Initialize game
function initGame(canvasWidth, canvasHeight) {
    gameState.canvasWidth = canvasWidth;
    gameState.canvasHeight = canvasHeight;
    
    // Create player
    gameState.player = {
        x: canvasWidth / 2,
        y: canvasHeight / 2,
        radius: PLAYER_RADIUS,
        speed: PLAYER_SPEED,
        health: 100,
        maxHealth: 100,
        bulletLevel: 1,
        maxBulletLevel: 5,
        score: 0,
        moveUp: false,
        moveDown: false,
        moveLeft: false,
        moveRight: false,
        aimAngle: 0,
        shootCooldown: 0,
        shootInterval: 150, // ms
        color: '#00FF00'
    };
    
    // Reset game state
    gameState.monsters = [];
    gameState.bullets = [];
    gameState.monsterStats = {
        totalSpawned: 0,
        maxTotal: MAX_TOTAL_MONSTERS,
        spawnComplete: false,
        spawnDuration: 0,
        spawnStartTime: Date.now()
    };
    gameState.lastTime = 0;
    gameState.isGameOver = false;
    gameState.upgradePoints = 0;
    gameState.upgradeThreshold = 500;
    gameState.frameCount = 0;
    gameState.lastFpsUpdate = 0;
    gameState.fps = 0;
    
    // Start game loop
    gameLoop();
}

// High performance timestamp function
function getTimestamp() {
    return self.performance && self.performance.now ? self.performance.now() : Date.now();
}

// Game loop
function gameLoop() {
    const timestamp = getTimestamp();
    
    // First frame
    if (!gameState.lastTime) {
        gameState.lastTime = timestamp;
    }
    
    // Calculate delta time
    const deltaTime = (timestamp - gameState.lastTime) / 1000;
    gameState.lastTime = timestamp;
    
    // FPS calculation
    gameState.frameCount++;
    if (timestamp - gameState.lastFpsUpdate >= 1000) {
        gameState.fps = Math.round((gameState.frameCount * 1000) / (timestamp - gameState.lastFpsUpdate));
        gameState.frameCount = 0;
        gameState.lastFpsUpdate = timestamp;
        
        // Send FPS to main thread
        self.postMessage({
            type: 'fps',
            fps: gameState.fps
        });
    }
    
    // Update game
    updateGame(deltaTime);
    
    // Send updated game state to main thread
    self.postMessage({
        type: 'gameState',
        player: gameState.player,
        monsters: gameState.monsters,
        bullets: gameState.bullets,
        monsterStats: gameState.monsterStats,
        isGameOver: gameState.isGameOver
    });
    
    // Continue game loop
    if (gameState.limitFrameRate) {
        setTimeout(gameLoop, 16); // ~60 FPS
    } else {
        setTimeout(gameLoop, 0); // As fast as possible
    }
}

// Update game state
function updateGame(deltaTime) {
    // Update player
    updatePlayer(deltaTime);
    
    // Update monsters
    updateMonsters(deltaTime);
    
    // Update bullets
    updateBullets(deltaTime);
    
    // Spawn monsters
    spawnMonsters(deltaTime);
    
    // Check for collisions
    handleCollisions();
    
    // Clean up inactive entities
    cleanupEntities();
    
    // Check for upgrade
    if (gameState.player.score >= gameState.upgradeThreshold) {
        gameState.upgradePoints++;
        gameState.upgradeThreshold += 500;
    }
}

// Update player
function updatePlayer(deltaTime) {
    const player = gameState.player;
    
    // Calculate movement
    let dx = 0;
    let dy = 0;
    
    if (player.moveUp) dy -= 1;
    if (player.moveDown) dy += 1;
    if (player.moveLeft) dx -= 1;
    if (player.moveRight) dx += 1;
    
    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
        const length = Math.sqrt(dx * dx + dy * dy);
        dx /= length;
        dy /= length;
    }
    
    // Apply movement
    player.x += dx * player.speed * deltaTime;
    player.y += dy * player.speed * deltaTime;
    
    // Keep player within canvas bounds
    player.x = Math.max(player.radius, Math.min(gameState.canvasWidth - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(gameState.canvasHeight - player.radius, player.y));
    
    // Find nearest monster for auto-targeting
    let nearestMonster = null;
    let nearestDistance = Infinity;
    
    for (const monster of gameState.monsters) {
        const monsterDx = monster.x - player.x;
        const monsterDy = monster.y - player.y;
        const distance = Math.sqrt(monsterDx * monsterDx + monsterDy * monsterDy);
        
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestMonster = monster;
        }
    }
    
    // Update aim angle to target the nearest monster
    if (nearestMonster) {
        const targetDx = nearestMonster.x - player.x;
        const targetDy = nearestMonster.y - player.y;
        player.aimAngle = Math.atan2(targetDy, targetDx);
    }
    
    // Shooting logic
    player.shootCooldown -= deltaTime * 1000;
    
    // Auto-shooting (only if there's a monster to target)
    if (player.shootCooldown <= 0 && nearestMonster) {
        createBullet(player.x, player.y, player.aimAngle, true, player.bulletLevel);
        player.shootCooldown = player.shootInterval;
    }
}

// Update monsters
function updateMonsters(deltaTime) {
    for (const monster of gameState.monsters) {
        // Move towards player
        const dx = gameState.player.x - monster.x;
        const dy = gameState.player.y - monster.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Only move if not too close to player
        if (distance > monster.radius + gameState.player.radius + 10) {
            monster.x += (dx / distance) * monster.speed * deltaTime;
            monster.y += (dy / distance) * monster.speed * deltaTime;
        }
        
        // Shooting logic
        monster.shootCooldown -= deltaTime * 1000;
        if (monster.shootCooldown <= 0) {
            // Calculate angle to player
            const angle = Math.atan2(dy, dx);
            createBullet(monster.x, monster.y, angle, false);
            monster.shootCooldown = monster.shootInterval;
        }
    }
}

// Update bullets
function updateBullets(deltaTime) {
    for (let i = 0; i < gameState.bullets.length; i++) {
        const bullet = gameState.bullets[i];
        
        // Move the bullet
        bullet.x += bullet.vx * deltaTime;
        bullet.y += bullet.vy * deltaTime;
        
        // Check if bullet is out of bounds
        if (bullet.x < -bullet.radius || bullet.x > gameState.canvasWidth + bullet.radius ||
            bullet.y < -bullet.radius || bullet.y > gameState.canvasHeight + bullet.radius) {
            bullet.isActive = false;
        }
    }
}

// Spawn monsters
function spawnMonsters(deltaTime) {
    // Check if we've reached the total monster limit
    if (gameState.monsterStats.totalSpawned >= gameState.monsterStats.maxTotal) {
        // If this is the first time we've reached the limit, record the duration
        if (!gameState.monsterStats.spawnComplete) {
            gameState.monsterStats.spawnDuration = (Date.now() - gameState.monsterStats.spawnStartTime) / 1000;
            gameState.monsterStats.spawnComplete = true;
        }
        return;
    }
    
    // Only spawn if we haven't reached the maximum number of monsters on screen
    if (gameState.monsters.length < MAX_MONSTERS_ON_SCREEN) {
        // Spawn timer
        gameState.monsterSpawnTimer = (gameState.monsterSpawnTimer || 0) + deltaTime * 1000;
        if (gameState.monsterSpawnTimer >= MONSTER_SPAWN_INTERVAL) {
            // Spawn multiple monsters at once
            for (let i = 0; i < MONSTER_BATCH_SIZE; i++) {
                // Check both screen limit and total limit
                if (gameState.monsters.length < MAX_MONSTERS_ON_SCREEN && 
                    gameState.monsterStats.totalSpawned < gameState.monsterStats.maxTotal) {
                    createMonster();
                    gameState.monsterStats.totalSpawned++;
                }
            }
            gameState.monsterSpawnTimer = 0;
        }
    }
}

// Create a monster
function createMonster() {
    // Determine spawn position (outside the canvas)
    let x, y;
    const side = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
    
    switch (side) {
        case 0: // Top
            x = Math.random() * gameState.canvasWidth;
            y = -30;
            break;
        case 1: // Right
            x = gameState.canvasWidth + 30;
            y = Math.random() * gameState.canvasHeight;
            break;
        case 2: // Bottom
            x = Math.random() * gameState.canvasWidth;
            y = gameState.canvasHeight + 30;
            break;
        case 3: // Left
            x = -30;
            y = Math.random() * gameState.canvasHeight;
            break;
    }
    
    // Create monster with properties
    const radius = 15 + Math.random() * 10;
    const health = 30;
    const maxHealth = health;
    const speed = 50;
    const color = `hsl(${Math.random() * 360}, 70%, 50%)`;
    
    gameState.monsters.push({
        x,
        y,
        radius,
        health,
        maxHealth,
        speed,
        color,
        isActive: true,
        shootCooldown: 0,
        shootInterval: 500, // ms
        mass: radius * 2
    });
}

// Create a bullet
function createBullet(x, y, angle, isPlayerBullet, level = 1) {
    // Bullet properties based on level
    let speed, damage, radius, color, pierce;
    
    if (isPlayerBullet) {
        const bulletProps = {
            1: { speed: 700, damage: 30, radius: 6, color: '#00FFFF', pierce: 10 },
            2: { speed: 750, damage: 40, radius: 7, color: '#00AAFF', pierce: 15 },
            3: { speed: 800, damage: 50, radius: 8, color: '#0088FF', pierce: 20 },
            4: { speed: 850, damage: 60, radius: 9, color: '#0044FF', pierce: 25 },
            5: { speed: 900, damage: 70, radius: 10, color: '#0000FF', pierce: 30 }
        };
        
        const props = bulletProps[level] || bulletProps[1];
        speed = props.speed;
        damage = props.damage;
        radius = props.radius;
        color = props.color;
        pierce = props.pierce;
    } else {
        speed = 300;
        damage = 5;
        radius = 4;
        color = '#FF4444';
        pierce = 10;
    }
    
    // Calculate velocity
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    
    // Create bullet
    gameState.bullets.push({
        x,
        y,
        vx,
        vy,
        radius,
        damage,
        color,
        isPlayerBullet,
        isActive: true,
        currentPierceCount: 0,
        maxPierceCount: pierce
    });
}

// Handle collisions
function handleCollisions() {
    // Player-Monster collisions
    for (const monster of gameState.monsters) {
        if (circlesCollide(gameState.player, monster)) {
            resolveCollision(gameState.player, monster);
        }
    }
    
    // Monster-Monster collisions
    for (let i = 0; i < gameState.monsters.length; i++) {
        for (let j = i + 1; j < gameState.monsters.length; j++) {
            if (circlesCollide(gameState.monsters[i], gameState.monsters[j])) {
                resolveCollision(gameState.monsters[i], gameState.monsters[j]);
            }
        }
    }
    
    // Bullet-Monster collisions
    for (const bullet of gameState.bullets) {
        if (bullet.isActive) {
            for (const monster of gameState.monsters) {
                if (circlesCollide(bullet, monster)) {
                    // Award score if it's a player bullet
                    if (bullet.isPlayerBullet) {
                        gameState.player.score += 50;
                    }
                    
                    // Handle bullet piercing
                    bullet.currentPierceCount++;
                    if (bullet.currentPierceCount > bullet.maxPierceCount) {
                        bullet.isActive = false;
                    }
                }
            }
        }
    }
    
    // Bullet-Player collisions
    for (const bullet of gameState.bullets) {
        if (bullet.isActive && !bullet.isPlayerBullet && circlesCollide(bullet, gameState.player)) {
            // Player is invincible, just deactivate the bullet
            bullet.isActive = false;
        }
    }
}

// Check if two circles are colliding
function circlesCollide(circle1, circle2) {
    const dx = circle1.x - circle2.x;
    const dy = circle1.y - circle2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < circle1.radius + circle2.radius;
}

// Resolve collision between two circles
function resolveCollision(circle1, circle2) {
    const dx = circle2.x - circle1.x;
    const dy = circle2.y - circle1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // If circles are not colliding, no need to resolve
    if (distance >= circle1.radius + circle2.radius) return;
    
    // Calculate the overlap
    const overlap = (circle1.radius + circle2.radius - distance) / 2;
    
    // Calculate the unit vector in the direction of the collision
    const directionX = dx / distance;
    const directionY = dy / distance;
    
    // Move circles apart based on their mass
    const mass1 = circle1.mass || 1;
    const mass2 = circle2.mass || 1;
    const totalMass = mass1 + mass2;
    
    // Calculate how much each circle should move
    const circle1Move = (mass2 / totalMass) * overlap;
    const circle2Move = (mass1 / totalMass) * overlap;
    
    // Move the circles apart
    circle1.x -= directionX * circle1Move;
    circle1.y -= directionY * circle1Move;
    circle2.x += directionX * circle2Move;
    circle2.y += directionY * circle2Move;
}

// Clean up inactive entities
function cleanupEntities() {
    // Only clean up bullets
    gameState.bullets = gameState.bullets.filter(bullet => bullet.isActive);
}

// Handle key down events
function handleKeyDown(key) {
    switch (key) {
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
                if (gameState.player.bulletLevel < gameState.player.maxBulletLevel) {
                    gameState.player.bulletLevel++;
                    gameState.upgradePoints--;
                }
            }
            break;
        case 'f':
        case 'F':
            // Toggle frame rate limiting
            gameState.limitFrameRate = !gameState.limitFrameRate;
            break;
    }
}

// Handle key up events
function handleKeyUp(key) {
    switch (key) {
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
}
