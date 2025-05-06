/**
 * Web Worker Thread for Game Collision Detection
 * This worker handles only the collision detection and physics calculations
 * to offload CPU-intensive work from the main thread
 */

// Message handler
self.onmessage = function(e) {
    const message = e.data;

    switch (message.type) {
        case 'processCollisions':
            const startTime = performance.now();

            // Process data from ArrayBuffer
            let data;
            if (message.buffer) {
                // Deserialize from ArrayBuffer
                const view = new Float32Array(message.buffer);
                data = deserializeGameData(view);
            } else {
                data = message.data;
            }

            // Process collision data
            const results = processCollisions(data);
            const endTime = performance.now();

            // Serialize results to ArrayBuffer for transfer
            const resultBuffer = new ArrayBuffer(1000000); // Allocate a large buffer
            const resultView = new Float32Array(resultBuffer);
            const resultSize = serializeResults(results, resultView);

            // Send results back to main thread using transferable
            self.postMessage({
                type: 'collisionResults',
                buffer: resultBuffer,
                bufferSize: resultSize,
                processTime: endTime - startTime
            }, [resultBuffer]);
            break;

        default:
            self.postMessage({
                type: 'error',
                error: `Unknown message type: ${message.type}`
            });
            break;
    }
};

/**
 * Deserialize game data from Float32Array
 * @param {Float32Array} view - Float32Array containing serialized game data
 * @returns {Object} - Deserialized game data
 */
function deserializeGameData(view) {
    let offset = 0;

    // Read player data
    const player = {
        x: view[offset++],
        y: view[offset++],
        radius: view[offset++],
        mass: 1,
        id: 'player'
    };

    // Read monster count
    const monsterCount = view[offset++];
    const monsters = [];

    // Read monster data
    for (let i = 0; i < monsterCount; i++) {
        monsters.push({
            x: view[offset++],
            y: view[offset++],
            radius: view[offset++],
            mass: 1,
            id: `monster-${i}`
        });
    }

    // Read bullet count
    const bulletCount = view[offset++];
    const bullets = [];

    // Read bullet data
    for (let i = 0; i < bulletCount; i++) {
        bullets.push({
            x: view[offset++],
            y: view[offset++],
            radius: view[offset++],
            isPlayerBullet: view[offset++] > 0,
            currentPierceCount: view[offset++],
            maxPierceCount: view[offset++],
            id: `bullet-${i}`,
            isActive: true
        });
    }

    return { player, monsters, bullets };
}

/**
 * Serialize results to Float32Array
 * @param {Object} results - Collision processing results
 * @param {Float32Array} view - Float32Array to write to
 * @returns {number} - Number of elements written
 */
function serializeResults(results, view) {
    let offset = 0;

    // Write player data
    view[offset++] = results.player.x;
    view[offset++] = results.player.y;

    // Write score
    view[offset++] = results.score || 0;

    // Write monster count
    view[offset++] = results.monsters.length;

    // Write monster data
    results.monsters.forEach(monster => {
        view[offset++] = monster.x;
        view[offset++] = monster.y;
        view[offset++] = monster.flash ? 1 : 0;
    });

    // Write bullet count
    view[offset++] = results.bullets.length;

    // Write bullet data
    results.bullets.forEach((bullet, index) => {
        view[offset++] = index; // Use index as ID reference
        view[offset++] = bullet.isActive ? 1 : 0;
        view[offset++] = bullet.currentPierceCount || 0;
    });

    return offset;
}

/**
 * Process all collisions in the game
 * @param {Object} data - Game state data for collision processing
 * @returns {Object} - Updated positions and states after collision resolution
 */
function processCollisions(data) {
    const { player, monsters, bullets } = data;
    let score = 0;

    // Create result objects to return
    const results = {
        player: { ...player },
        monsters: [],
        bullets: [],
        score: 0
    };

    // Create a working copy of monsters that we can modify
    const workingMonsters = monsters.map(m => ({ ...m }));

    // Process Player-Monster collisions
    workingMonsters.forEach(monster => {
        if (circlesCollide(player, monster)) {
            resolveCollision(results.player, monster);
        }
    });

    // Process Monster-Monster collisions - simple approach
    // Check all pairs of monsters
    for (let i = 0; i < workingMonsters.length; i++) {
        for (let j = i + 1; j < workingMonsters.length; j++) {
            if (circlesCollide(workingMonsters[i], workingMonsters[j])) {
                resolveCollision(workingMonsters[i], workingMonsters[j]);
            }
        }
    }

    // Add all working monsters to results to ensure all positions are updated
    workingMonsters.forEach(monster => {
        results.monsters.push({
            ...monster,
            color: '#FFFFFF' // Ensure color is white
        });
    });

    // Process Bullet-Monster collisions
    bullets.forEach(bullet => {
        let bulletUpdated = false;

        workingMonsters.forEach(monster => {
            if (circlesCollide(bullet, monster)) {
                // Handle bullet piercing
                bullet.currentPierceCount = (bullet.currentPierceCount || 0) + 1;

                // Award score for player bullets
                if (bullet.isPlayerBullet) {
                    score += 50;
                }

                // Mark monster for flashing
                const monsterInResults = results.monsters.find(m => m.id === monster.id);
                if (monsterInResults) {
                    monsterInResults.flash = true;
                }

                // Deactivate bullet if it has reached max pierce count
                if (bullet.currentPierceCount > bullet.maxPierceCount) {
                    bullet.isActive = false;
                }

                // Add updated bullet to results if not already added
                if (!bulletUpdated) {
                    results.bullets.push({ ...bullet });
                    bulletUpdated = true;
                }
            }
        });
    });

    // Process Bullet-Player collisions
    bullets.forEach(bullet => {
        if (!bullet.isPlayerBullet && circlesCollide(bullet, player)) {
            // Player is invincible, just deactivate the bullet
            bullet.isActive = false;
            results.bullets.push({ ...bullet });
        }
    });

    // Update score
    results.score = score;

    return results;
}

/**
 * Check if two circles are colliding
 * @param {Object} circle1 - First circle with x, y, and radius properties
 * @param {Object} circle2 - Second circle with x, y, and radius properties
 * @returns {boolean} - True if circles are colliding
 */
function circlesCollide(circle1, circle2) {
    const dx = circle1.x - circle2.x;
    const dy = circle1.y - circle2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < circle1.radius + circle2.radius;
}

/**
 * Resolve collision between two circles
 * @param {Object} circle1 - First circle with x, y, radius, and optional mass properties
 * @param {Object} circle2 - Second circle with x, y, radius, and optional mass properties
 */
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
