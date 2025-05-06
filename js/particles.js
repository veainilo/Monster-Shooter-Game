/**
 * Particle system for visual effects and performance testing
 */
class Particle {
    constructor(x, y, vx, vy, size, color, life, gravity = 0) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.originalSize = size;
        this.size = size;
        this.color = color;
        this.alpha = 1;
        this.life = life;
        this.originalLife = life;
        this.isActive = true;
        this.gravity = gravity;
        
        // Add some random rotation for more complex rendering
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.2;
    }
    
    update(deltaTime) {
        // Update position
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
        
        // Apply gravity
        this.vy += this.gravity * deltaTime;
        
        // Update life
        this.life -= deltaTime;
        
        // Update alpha and size based on life
        this.alpha = this.life / this.originalLife;
        this.size = this.originalSize * this.alpha;
        
        // Update rotation
        this.rotation += this.rotationSpeed;
        
        // Check if particle is dead
        if (this.life <= 0) {
            this.isActive = false;
        }
    }
    
    draw(ctx) {
        if (!this.isActive) return;
        
        ctx.save();
        
        // Set transparency
        ctx.globalAlpha = this.alpha;
        
        // Translate to particle position
        ctx.translate(this.x, this.y);
        
        // Rotate
        ctx.rotate(this.rotation);
        
        // Draw particle
        ctx.fillStyle = this.color;
        
        // Draw a more complex shape (square) instead of a circle
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        
        // Add a stroke for more complexity
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-this.size / 2, -this.size / 2, this.size, this.size);
        
        ctx.restore();
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
        this.maxParticles = 5000; // Very high number for performance testing
    }
    
    createExplosion(x, y, count, color, size = 5, life = 1, speed = 100) {
        for (let i = 0; i < count; i++) {
            // Skip if we've reached the maximum number of particles
            if (this.particles.length >= this.maxParticles) break;
            
            // Calculate random velocity
            const angle = Math.random() * Math.PI * 2;
            const magnitude = Math.random() * speed;
            const vx = Math.cos(angle) * magnitude;
            const vy = Math.sin(angle) * magnitude;
            
            // Create particle
            const particle = new Particle(
                x, 
                y, 
                vx, 
                vy, 
                size * (0.5 + Math.random()), 
                color, 
                life * (0.5 + Math.random()), 
                50 // Add gravity for more complex movement
            );
            
            this.particles.push(particle);
        }
    }
    
    createBulletTrail(bullet, count) {
        for (let i = 0; i < count; i++) {
            // Skip if we've reached the maximum number of particles
            if (this.particles.length >= this.maxParticles) break;
            
            // Calculate random offset
            const offsetX = (Math.random() - 0.5) * 5;
            const offsetY = (Math.random() - 0.5) * 5;
            
            // Calculate velocity (opposite to bullet direction)
            const vx = -bullet.vx * 0.1 + (Math.random() - 0.5) * 20;
            const vy = -bullet.vy * 0.1 + (Math.random() - 0.5) * 20;
            
            // Create particle
            const particle = new Particle(
                bullet.x + offsetX, 
                bullet.y + offsetY, 
                vx, 
                vy, 
                bullet.radius * 0.8 * Math.random(), 
                bullet.isPlayerBullet ? '#00FFFF' : '#FF4444', 
                0.3 * Math.random()
            );
            
            this.particles.push(particle);
        }
    }
    
    update(deltaTime) {
        // Update all particles
        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i].update(deltaTime);
        }
        
        // Remove inactive particles
        this.particles = this.particles.filter(particle => particle.isActive);
    }
    
    draw(ctx) {
        // Draw all particles
        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i].draw(ctx);
        }
    }
}
