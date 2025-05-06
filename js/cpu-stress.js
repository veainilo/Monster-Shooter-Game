/**
 * CPU stress testing module
 * This module contains functions that perform heavy CPU calculations
 * to deliberately slow down the game
 */

class CPUStressTester {
    constructor() {
        // Configuration
        this.enabled = true;
        this.intensityLevel = 3; // 1-5, higher is more intense
        
        // Stats
        this.calculationsPerFrame = 0;
        this.totalCalculations = 0;
        
        // Prime number cache
        this.primes = [2, 3, 5, 7, 11, 13];
        this.maxTestedNumber = 13;
    }
    
    // Set intensity level (1-5)
    setIntensity(level) {
        this.intensityLevel = Math.max(1, Math.min(5, level));
    }
    
    // Toggle stress testing
    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
    
    // Main stress test function - call this each frame
    runStressTest(deltaTime) {
        if (!this.enabled) return;
        
        this.calculationsPerFrame = 0;
        
        // Run different stress tests based on intensity
        this.findPrimes(1000 * this.intensityLevel);
        this.performMatrixOperations(20 * this.intensityLevel);
        this.calculateFractals(10 * this.intensityLevel);
        this.simulateParticlePhysics(50 * this.intensityLevel);
        
        // Update total
        this.totalCalculations += this.calculationsPerFrame;
    }
    
    // Stress test 1: Find prime numbers
    findPrimes(count) {
        let found = 0;
        let num = this.maxTestedNumber + 2;
        
        while (found < count) {
            if (this.isPrime(num)) {
                this.primes.push(num);
                found++;
            }
            
            this.calculationsPerFrame++;
            num += 2; // Only check odd numbers
        }
        
        this.maxTestedNumber = num - 2;
    }
    
    // Helper function to check if a number is prime
    isPrime(num) {
        if (num <= 1) return false;
        if (num <= 3) return true;
        if (num % 2 === 0 || num % 3 === 0) return false;
        
        const sqrtNum = Math.sqrt(num);
        for (let i = 5; i <= sqrtNum; i += 6) {
            this.calculationsPerFrame++;
            if (num % i === 0 || num % (i + 2) === 0) return false;
        }
        
        return true;
    }
    
    // Stress test 2: Matrix operations
    performMatrixOperations(size) {
        // Create matrices
        const matrixA = this.createRandomMatrix(size, size);
        const matrixB = this.createRandomMatrix(size, size);
        
        // Multiply matrices
        const result = this.multiplyMatrices(matrixA, matrixB);
        
        // Calculate determinant (very expensive for large matrices)
        if (size <= 10) {
            this.calculateDeterminant(result);
        }
    }
    
    // Create a random matrix
    createRandomMatrix(rows, cols) {
        const matrix = [];
        for (let i = 0; i < rows; i++) {
            matrix[i] = [];
            for (let j = 0; j < cols; j++) {
                matrix[i][j] = Math.random() * 10;
                this.calculationsPerFrame++;
            }
        }
        return matrix;
    }
    
    // Multiply two matrices
    multiplyMatrices(a, b) {
        const result = [];
        for (let i = 0; i < a.length; i++) {
            result[i] = [];
            for (let j = 0; j < b[0].length; j++) {
                result[i][j] = 0;
                for (let k = 0; k < a[0].length; k++) {
                    result[i][j] += a[i][k] * b[k][j];
                    this.calculationsPerFrame++;
                }
            }
        }
        return result;
    }
    
    // Calculate determinant (recursive, very expensive)
    calculateDeterminant(matrix) {
        // Base case for 2x2 matrix
        if (matrix.length === 2) {
            this.calculationsPerFrame++;
            return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
        }
        
        let determinant = 0;
        for (let i = 0; i < matrix.length; i++) {
            // Get minor
            const minor = this.getMinor(matrix, 0, i);
            
            // Add or subtract determinant of minor
            determinant += Math.pow(-1, i) * matrix[0][i] * this.calculateDeterminant(minor);
            this.calculationsPerFrame++;
        }
        
        return determinant;
    }
    
    // Get minor of matrix
    getMinor(matrix, row, col) {
        const minor = [];
        for (let i = 0; i < matrix.length; i++) {
            if (i === row) continue;
            
            const newRow = [];
            for (let j = 0; j < matrix.length; j++) {
                if (j === col) continue;
                newRow.push(matrix[i][j]);
                this.calculationsPerFrame++;
            }
            
            minor.push(newRow);
        }
        
        return minor;
    }
    
    // Stress test 3: Calculate fractals
    calculateFractals(iterations) {
        const width = 100;
        const height = 100;
        
        // Calculate a portion of the Mandelbrot set
        for (let x = 0; x < width; x += 5) {
            for (let y = 0; y < height; y += 5) {
                const belongsToSet = this.mandelbrotTest(
                    -2 + (x / width) * 3,
                    -1.5 + (y / height) * 3,
                    iterations
                );
                this.calculationsPerFrame++;
            }
        }
    }
    
    // Test if a point belongs to the Mandelbrot set
    mandelbrotTest(x0, y0, maxIterations) {
        let x = 0;
        let y = 0;
        let iteration = 0;
        
        while (x*x + y*y < 4 && iteration < maxIterations) {
            const xTemp = x*x - y*y + x0;
            y = 2*x*y + y0;
            x = xTemp;
            iteration++;
            this.calculationsPerFrame++;
        }
        
        return iteration === maxIterations;
    }
    
    // Stress test 4: Simulate particle physics
    simulateParticlePhysics(particleCount) {
        // Create particles if needed
        if (!this.physicsParticles) {
            this.physicsParticles = [];
            for (let i = 0; i < particleCount; i++) {
                this.physicsParticles.push({
                    x: Math.random() * 800,
                    y: Math.random() * 600,
                    vx: (Math.random() - 0.5) * 10,
                    vy: (Math.random() - 0.5) * 10,
                    mass: 1 + Math.random() * 10
                });
            }
        }
        
        // Update particles
        for (let i = 0; i < this.physicsParticles.length; i++) {
            const p1 = this.physicsParticles[i];
            
            // Apply forces from all other particles
            for (let j = 0; j < this.physicsParticles.length; j++) {
                if (i === j) continue;
                
                const p2 = this.physicsParticles[j];
                
                // Calculate distance
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const distance = Math.sqrt(dx*dx + dy*dy);
                
                // Calculate gravitational force
                const force = (p1.mass * p2.mass) / (distance * distance);
                const angle = Math.atan2(dy, dx);
                
                // Apply force
                p1.vx += Math.cos(angle) * force / p1.mass * 0.01;
                p1.vy += Math.sin(angle) * force / p1.mass * 0.01;
                
                this.calculationsPerFrame++;
            }
            
            // Update position
            p1.x += p1.vx;
            p1.y += p1.vy;
            
            // Bounce off walls
            if (p1.x < 0 || p1.x > 800) p1.vx *= -0.9;
            if (p1.y < 0 || p1.y > 600) p1.vy *= -0.9;
        }
    }
}
