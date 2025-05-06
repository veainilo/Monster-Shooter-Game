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

            // Process data - could be direct data or from ArrayBuffer
            let data;
            if (message.buffer instanceof ArrayBuffer) {
                // Deserialize from ArrayBuffer if using transferable
                const view = new Float32Array(message.buffer);
                data = deserializeGameData(view);
            } else {
                data = message.data;
            }

            const results = processCollisions(data);
            const endTime = performance.now();

            // Serialize results to ArrayBuffer for transfer
            const { buffer, bufferSize } = serializeResults(results);

            // Send results back to main thread using transferable objects
            self.postMessage({
                type: 'collisionResults',
                buffer: buffer,
                bufferSize: bufferSize,
                processTime: endTime - startTime
            }, [buffer]);
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
        mass: view[offset++],
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
            mass: view[offset++],
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
            damage: view[offset++],
            currentPierceCount: view[offset++],
            maxPierceCount: view[offset++],
            id: `bullet-${i}`,
            isActive: view[offset++] > 0
        });
    }

    return { player, monsters, bullets };
}

/**
 * Serialize results to ArrayBuffer for transfer
 * @param {Object} results - Collision processing results
 * @returns {Object} - Object containing buffer and bufferSize
 */
function serializeResults(results) {
    // Calculate buffer size
    let bufferSize = 5; // Player data (x, y, radius, mass, score)
    bufferSize += 1 + results.monsters.length * 5; // Monster count + monster data (x, y, radius, mass, flash)
    bufferSize += 1 + results.bullets.length * 3; // Bullet count + bullet data (id, isActive, currentPierceCount)

    // Create buffer
    const buffer = new ArrayBuffer(bufferSize * 4); // 4 bytes per float
    const view = new Float32Array(buffer);

    let offset = 0;

    // Write player data
    view[offset++] = results.player.x;
    view[offset++] = results.player.y;
    view[offset++] = results.player.radius;
    view[offset++] = results.player.mass || 1;
    view[offset++] = results.score || 0;

    // Write monster count
    view[offset++] = results.monsters.length;

    // Write monster data
    results.monsters.forEach(monster => {
        view[offset++] = monster.x;
        view[offset++] = monster.y;
        view[offset++] = monster.radius;
        view[offset++] = monster.mass || 1;
        view[offset++] = monster.flash ? 1 : 0;
    });

    // Write bullet count
    view[offset++] = results.bullets.length;

    // Write bullet data - only the essential information
    results.bullets.forEach((bullet, index) => {
        view[offset++] = index; // Use index as ID reference
        view[offset++] = bullet.isActive ? 1 : 0;
        view[offset++] = bullet.currentPierceCount;
    });

    return { buffer, bufferSize };
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

    // Process Monster-Monster collisions with spatial partitioning optimization
    // This is much faster than checking every pair of monsters
    const gridSize = 50; // Size of each grid cell
    const grid = new Map(); // Grid for spatial partitioning

    // Place monsters in grid cells
    workingMonsters.forEach((monster, index) => {
        // Calculate grid cell coordinates
        const cellX = Math.floor(monster.x / gridSize);
        const cellY = Math.floor(monster.y / gridSize);

        // Create a unique key for this cell
        const cellKey = `${cellX},${cellY}`;

        // Add monster to this cell
        if (!grid.has(cellKey)) {
            grid.set(cellKey, []);
        }
        grid.get(cellKey).push(index);

        // Also add to neighboring cells if monster is near the boundary
        const radius = monster.radius;
        const neighborCells = [];

        // Check if monster overlaps with neighboring cells
        if (monster.x - radius < (cellX * gridSize)) {
            neighborCells.push(`${cellX-1},${cellY}`);
        }
        if (monster.x + radius >= ((cellX+1) * gridSize)) {
            neighborCells.push(`${cellX+1},${cellY}`);
        }
        if (monster.y - radius < (cellY * gridSize)) {
            neighborCells.push(`${cellX},${cellY-1}`);
        }
        if (monster.y + radius >= ((cellY+1) * gridSize)) {
            neighborCells.push(`${cellX},${cellY+1}`);
        }

        // Add to diagonal neighbors if needed
        if (monster.x - radius < (cellX * gridSize) && monster.y - radius < (cellY * gridSize)) {
            neighborCells.push(`${cellX-1},${cellY-1}`);
        }
        if (monster.x - radius < (cellX * gridSize) && monster.y + radius >= ((cellY+1) * gridSize)) {
            neighborCells.push(`${cellX-1},${cellY+1}`);
        }
        if (monster.x + radius >= ((cellX+1) * gridSize) && monster.y - radius < (cellY * gridSize)) {
            neighborCells.push(`${cellX+1},${cellY-1}`);
        }
        if (monster.x + radius >= ((cellX+1) * gridSize) && monster.y + radius >= ((cellY+1) * gridSize)) {
            neighborCells.push(`${cellX+1},${cellY+1}`);
        }

        // Add monster to neighboring cells
        neighborCells.forEach(neighborKey => {
            if (!grid.has(neighborKey)) {
                grid.set(neighborKey, []);
            }
            grid.get(neighborKey).push(index);
        });
    });

    // Check collisions only between monsters in the same or adjacent cells
    const checkedPairs = new Set(); // Track which pairs we've already checked

    grid.forEach((monsterIndices) => {
        // Check collisions between monsters in this cell
        for (let i = 0; i < monsterIndices.length; i++) {
            const index1 = monsterIndices[i];
            const monster1 = workingMonsters[index1];

            for (let j = i + 1; j < monsterIndices.length; j++) {
                const index2 = monsterIndices[j];
                const monster2 = workingMonsters[index2];

                // Create a unique pair ID (always put smaller index first)
                const pairId = index1 < index2 ? `${index1}-${index2}` : `${index2}-${index1}`;

                // Skip if we've already checked this pair
                if (checkedPairs.has(pairId)) continue;
                checkedPairs.add(pairId);

                // Check and resolve collision
                if (circlesCollide(monster1, monster2)) {
                    resolveCollision(monster1, monster2);
                }
            }
        }
    });

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

    // Optimization: Compare squared distances instead of using square root
    // This avoids the expensive square root operation
    const distanceSquared = dx * dx + dy * dy;
    const radiusSum = circle1.radius + circle2.radius;

    return distanceSquared < radiusSum * radiusSum;
}

/**
 * Resolve collision between two circles
 * @param {Object} circle1 - First circle with x, y, radius, and optional mass properties
 * @param {Object} circle2 - Second circle with x, y, radius, and optional mass properties
 */
function resolveCollision(circle1, circle2) {
    const dx = circle2.x - circle1.x;
    const dy = circle2.y - circle1.y;

    // Calculate distance squared
    const distanceSquared = dx * dx + dy * dy;

    // Fast check if circles are not colliding
    const radiusSum = circle1.radius + circle2.radius;
    if (distanceSquared >= radiusSum * radiusSum) return;

    // Calculate actual distance only when needed
    const distance = Math.sqrt(distanceSquared);

    // If circles are at exactly the same position, move them in a random direction
    if (distance === 0) {
        // Generate a random angle
        const angle = Math.random() * Math.PI * 2;
        circle1.x -= Math.cos(angle) * circle1.radius * 0.1;
        circle1.y -= Math.sin(angle) * circle1.radius * 0.1;
        circle2.x += Math.cos(angle) * circle2.radius * 0.1;
        circle2.y += Math.sin(angle) * circle2.radius * 0.1;
        return;
    }

    // Calculate the overlap - use the same formula as the original version
    const overlap = (radiusSum - distance) / 2;

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
