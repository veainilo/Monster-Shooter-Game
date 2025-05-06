/**
 * Lighting system for visual effects and performance testing
 */
class Light {
    constructor(x, y, radius, color, intensity) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.intensity = intensity;
        this.flicker = Math.random() * 0.2;
        this.flickerSpeed = 5 + Math.random() * 5;
        this.time = Math.random() * 1000;
    }
    
    update(deltaTime) {
        // Update flicker effect
        this.time += deltaTime * this.flickerSpeed;
        
        // Calculate current intensity with flicker
        this.currentIntensity = this.intensity * (1 - this.flicker + this.flicker * Math.sin(this.time));
    }
    
    draw(ctx) {
        // Create radial gradient
        const gradient = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, this.radius
        );
        
        // Add color stops
        gradient.addColorStop(0, this.color.replace(')', `, ${this.currentIntensity})`));
        gradient.addColorStop(1, this.color.replace(')', ', 0)'));
        
        // Draw light
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class LightingSystem {
    constructor() {
        this.lights = [];
        this.ambientLight = 'rgba(0, 0, 0, 0.7)'; // Dark ambient light
        
        // Create offscreen canvas for lighting
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    }
    
    resize(width, height) {
        this.offscreenCanvas.width = width;
        this.offscreenCanvas.height = height;
    }
    
    addLight(x, y, radius, color, intensity) {
        this.lights.push(new Light(x, y, radius, color, intensity));
    }
    
    updateLights(deltaTime) {
        // Update all lights
        for (let i = 0; i < this.lights.length; i++) {
            this.lights[i].update(deltaTime);
        }
    }
    
    render(ctx, width, height) {
        // Clear offscreen canvas
        this.offscreenCtx.clearRect(0, 0, width, height);
        
        // Fill with ambient light
        this.offscreenCtx.fillStyle = this.ambientLight;
        this.offscreenCtx.fillRect(0, 0, width, height);
        
        // Set blend mode
        this.offscreenCtx.globalCompositeOperation = 'lighter';
        
        // Draw all lights
        for (let i = 0; i < this.lights.length; i++) {
            this.lights[i].draw(this.offscreenCtx);
        }
        
        // Reset blend mode
        this.offscreenCtx.globalCompositeOperation = 'source-over';
        
        // Draw lighting to main canvas
        ctx.drawImage(this.offscreenCanvas, 0, 0);
    }
}
