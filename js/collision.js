/**
 * Collision detection and resolution utilities
 */

// Check if two circles are colliding
function circlesCollide(circle1, circle2) {
    const dx = circle1.x - circle2.x;
    const dy = circle1.y - circle2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < circle1.radius + circle2.radius;
}

// Resolve collision between two circles (prevent overlapping)
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
    
    // Move circles apart based on their mass (if they have mass property)
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
