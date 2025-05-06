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
            const results = processCollisions(message.data);
            const endTime = performance.now();

            // Send results back to main thread
            self.postMessage({
                type: 'collisionResults',
                data: results,
                processTime: endTime - startTime
            });
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

    // Process Player-Monster collisions
    monsters.forEach(monster => {
        if (circlesCollide(player, monster)) {
            resolveCollision(results.player, monster);
            results.monsters.push({ ...monster });
        }
    });

    // Process Monster-Monster collisions
    for (let i = 0; i < monsters.length; i++) {
        for (let j = i + 1; j < monsters.length; j++) {
            if (circlesCollide(monsters[i], monsters[j])) {
                resolveCollision(monsters[i], monsters[j]);

                // Add both monsters to results if not already added
                if (!results.monsters.some(m => m.id === monsters[i].id)) {
                    results.monsters.push({
                        ...monsters[i],
                        color: '#FFFFFF' // Ensure color is white
                    });
                }
                if (!results.monsters.some(m => m.id === monsters[j].id)) {
                    results.monsters.push({
                        ...monsters[j],
                        color: '#FFFFFF' // Ensure color is white
                    });
                }
            }
        }
    }

    // Process Bullet-Monster collisions
    bullets.forEach(bullet => {
        let bulletUpdated = false;

        monsters.forEach(monster => {
            if (circlesCollide(bullet, monster)) {
                // Handle bullet piercing
                bullet.currentPierceCount = (bullet.currentPierceCount || 0) + 1;

                // Award score for player bullets
                if (bullet.isPlayerBullet) {
                    score += 50;
                }

                // Flash monster when hit (add to results to update in main thread)
                if (!results.monsters.some(m => m.id === monster.id)) {
                    results.monsters.push({
                        ...monster,
                        flash: true,
                        color: '#FFFFFF' // Ensure color is white
                    });
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
