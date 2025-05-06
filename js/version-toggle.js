/**
 * Version Toggle - Controls which game version is running
 * This script allows toggling between original, worker, or both versions
 * to accurately compare performance without interference
 */

// Game state tracking
let toggleState = {
    originalActive: true,
    workerActive: true,
    mode: 'both' // 'both', 'original', or 'worker'
};

// DOM elements
const toggleButton = document.getElementById('toggle-version');
const activeVersionText = document.getElementById('active-version');
const originalWrapper = document.querySelector('.game-wrapper:nth-child(1)');
const workerWrapper = document.querySelector('.game-wrapper:nth-child(2)');

// Game canvas elements - use existing references if available
const originalCanvas = document.getElementById('gameCanvas');

// Initialize toggle functionality
function initVersionToggle() {
    // Wait for both games to initialize
    setTimeout(() => {
        // Add click event listener to toggle button
        toggleButton.addEventListener('click', toggleGameVersion);

        // Store references to the original game loop functions
        window.originalGameLoop = window.gameLoop;
        window.workerGameLoop = window.workerGameLoop;

        // Store references to animation frame IDs
        window.originalAnimationFrameId = null;
        window.workerAnimationFrameId = null;
    }, 1000); // Wait 1 second for games to initialize
}

// Toggle between game versions
function toggleGameVersion() {
    // Initialize mode if not set
    if (!toggleState.mode) {
        toggleState.mode = 'both';
    }

    switch (toggleState.mode) {
        case 'both':
            // Switch to original only
            toggleState.mode = 'original';
            toggleState.originalActive = true;
            toggleState.workerActive = false;

            // Update UI
            originalWrapper.classList.remove('inactive');
            workerWrapper.classList.add('inactive');
            activeVersionText.textContent = 'Currently running: Original Version Only';

            // Stop worker game
            stopWorkerGame();
            break;

        case 'original':
            // Switch to worker only
            toggleState.mode = 'worker';
            toggleState.originalActive = false;
            toggleState.workerActive = true;

            // Update UI
            originalWrapper.classList.add('inactive');
            workerWrapper.classList.remove('inactive');
            activeVersionText.textContent = 'Currently running: Worker Version Only';

            // Stop original game and start worker game
            stopOriginalGame();
            startWorkerGame();
            break;

        case 'worker':
            // Switch back to both
            toggleState.mode = 'both';
            toggleState.originalActive = true;
            toggleState.workerActive = true;

            // Update UI
            originalWrapper.classList.remove('inactive');
            workerWrapper.classList.remove('inactive');
            activeVersionText.textContent = 'Currently running: Both Versions';

            // Start original game
            startOriginalGame();
            break;
    }
}

// Stop the original game
function stopOriginalGame() {
    // Get the animation frame ID from the game
    if (window.gameState && window.gameState.animationFrameId) {
        cancelAnimationFrame(window.gameState.animationFrameId);
    }

    // Hide the canvas
    originalCanvas.style.visibility = 'hidden';
}

// Start the original game
function startOriginalGame() {
    // Only start if it's not already running
    if (originalCanvas.style.visibility === 'hidden') {
        // Show the canvas
        originalCanvas.style.visibility = 'visible';

        // Reinitialize the game
        if (typeof initGame === 'function') {
            initGame();
        }
    }
}

// Stop the worker game
function stopWorkerGame() {
    // Get the animation frame ID from the game
    if (window.workerGameState && window.workerGameState.animationFrameId) {
        cancelAnimationFrame(window.workerGameState.animationFrameId);
    }

    // Hide the canvas - use the global reference
    const workerCanvas = document.getElementById('workerGameCanvas');
    if (workerCanvas) {
        workerCanvas.style.visibility = 'hidden';
    }
}

// Start the worker game
function startWorkerGame() {
    // Get the canvas - use the global reference
    const workerCanvas = document.getElementById('workerGameCanvas');
    if (!workerCanvas) return;

    // Only start if it's not already running
    if (workerCanvas.style.visibility === 'hidden') {
        // Show the canvas
        workerCanvas.style.visibility = 'visible';

        // Reinitialize the game
        if (typeof initWorkerGame === 'function') {
            initWorkerGame();
        }
    }
}

// Initialize when the page loads
window.addEventListener('load', initVersionToggle);
