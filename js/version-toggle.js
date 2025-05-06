/**
 * Version Toggle - Controls which game version is running
 * This script allows toggling between original and worker versions
 */

// Game state tracking
let toggleState = {
    currentMode: 'original', // 'original' or 'worker'
    // Store the game version preference in localStorage
    savePreference: function() {
        localStorage.setItem('gameVersionPreference', this.currentMode);
    },
    // Load the game version preference from localStorage
    loadPreference: function() {
        const savedMode = localStorage.getItem('gameVersionPreference');
        if (savedMode && (savedMode === 'original' || savedMode === 'worker')) {
            this.currentMode = savedMode;
            return true;
        }
        return false;
    }
};

// DOM elements
const toggleButton = document.getElementById('toggle-version');
const activeVersionText = document.getElementById('active-version');
const versionTitle = document.getElementById('game-version-title');
const originalCanvas = document.getElementById('gameCanvas');
// Use the existing workerCanvas reference instead of creating a new one

// Initialize toggle functionality
function initVersionToggle() {
    // Add click event listener to toggle button
    toggleButton.addEventListener('click', toggleGameVersion);

    // Make sure both games are stopped initially
    stopOriginalGame();
    stopWorkerGame();

    // Load saved preference if any
    if (toggleState.loadPreference()) {
        // Apply the saved preference
        applyVersionPreference();
    } else {
        // Default to original version
        toggleState.currentMode = 'original';
        applyVersionPreference();
    }
}

// Apply the current version preference
function applyVersionPreference() {
    // Clean up any existing game elements
    cleanupGameContainer();

    if (toggleState.currentMode === 'original') {
        // Show original version
        showOriginalVersion();
    } else {
        // Show worker version
        showWorkerVersion();
    }
}

// Clean up the game container
function cleanupGameContainer() {
    // Remove any elements that might have been added dynamically
    const gameContainer = document.getElementById('game-container');
    const gameInfo = document.querySelector('.game-info');

    // Keep only the canvases and game info
    Array.from(gameContainer.children).forEach(child => {
        if (child !== originalCanvas &&
            child !== document.getElementById('workerGameCanvas') &&
            child !== gameInfo) {
            child.remove();
        }
    });

    // Reset canvases to clear any content
    resetCanvas(originalCanvas);
    resetCanvas(document.getElementById('workerGameCanvas'));
}

// Reset a canvas to clear its content
function resetCanvas(canvas) {
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (context) {
        // Clear the entire canvas
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Reset any transformations
        context.setTransform(1, 0, 0, 1, 0, 0);
    }
}

// Toggle between game versions
function toggleGameVersion() {
    if (toggleState.currentMode === 'original') {
        // Switch to worker version
        toggleState.currentMode = 'worker';
        showWorkerVersion();
    } else {
        // Switch to original version
        toggleState.currentMode = 'original';
        showOriginalVersion();
    }

    // Save the preference
    toggleState.savePreference();
}

// Show the original version
function showOriginalVersion() {
    // Update UI
    versionTitle.textContent = 'Original Version';
    toggleButton.textContent = 'Switch to Web Worker Version';
    activeVersionText.textContent = 'Currently running: Original Version';

    // Reset game info display
    resetGameInfo();

    // Show original canvas, hide worker canvas
    originalCanvas.style.display = 'block';
    document.getElementById('workerGameCanvas').style.display = 'none';

    // Stop worker game if running
    stopWorkerGame();

    // Start original game
    startOriginalGame();

    // Update timing info element ID to match original version
    updateTimingInfoElementId('original');
}

// Reset game info display
function resetGameInfo() {
    document.getElementById('score').textContent = 'Score: 0';
    document.getElementById('health').textContent = 'Health: 100';
    document.getElementById('level').textContent = 'Bullet Level: 1';
    document.getElementById('monsters').textContent = 'Monsters: 0/500';
    document.getElementById('spawn-time').textContent = 'Spawn Time: 0.00s';
    document.getElementById('fps').textContent = 'FPS: 0';
}

// Show the worker version
function showWorkerVersion() {
    // Update UI
    versionTitle.textContent = 'Web Worker Version';
    toggleButton.textContent = 'Switch to Original Version';
    activeVersionText.textContent = 'Currently running: Web Worker Version';

    // Reset game info display
    resetGameInfo();

    // Show worker canvas, hide original canvas
    originalCanvas.style.display = 'none';
    document.getElementById('workerGameCanvas').style.display = 'block';

    // Stop original game
    stopOriginalGame();

    // Start worker game
    startWorkerGame();

    // Update timing info element ID to match worker version
    updateTimingInfoElementId('worker');
}

// Update the timing info element ID based on the active version
function updateTimingInfoElementId(version) {
    // Remove any existing timing info elements to avoid duplicates
    const existingTimingElements = document.querySelectorAll('.timing-info');
    existingTimingElements.forEach(element => {
        element.remove();
    });

    // The new timing info element will be created by the game's updateUI function
}

// Stop the original game
function stopOriginalGame() {
    // Get the animation frame ID from the game
    if (window.gameState && window.gameState.animationFrameId) {
        cancelAnimationFrame(window.gameState.animationFrameId);
    }

    // Clear any setTimeout that might be running
    if (window.gameState && window.gameState.timeoutId) {
        clearTimeout(window.gameState.timeoutId);
    }

    // Reset game state to prevent memory leaks
    window.gameState = null;
}

// Start the original game
function startOriginalGame() {
    // Make sure any previous instance is fully stopped
    stopOriginalGame();

    // Reinitialize the game
    if (typeof initGame === 'function') {
        initGame();
    }
}

// Stop the worker game
function stopWorkerGame() {
    // Get the animation frame ID from the game
    if (window.workerGameState && window.workerGameState.animationFrameId) {
        cancelAnimationFrame(window.workerGameState.animationFrameId);
    }

    // Clear any setTimeout that might be running
    if (window.workerGameState && window.workerGameState.timeoutId) {
        clearTimeout(window.workerGameState.timeoutId);
    }

    // Remove event listeners if the function exists
    if (typeof removeWorkerEventListeners === 'function') {
        removeWorkerEventListeners();
    }

    // Terminate the worker if it exists
    if (window.gameWorker) {
        gameWorker.terminate();
        window.gameWorker = null;
    }

    // Reset game state to prevent memory leaks
    window.workerGameState = null;
}

// Start the worker game
function startWorkerGame() {
    // Make sure any previous instance is fully stopped
    stopWorkerGame();

    // Reinitialize the game
    if (typeof initWorkerGame === 'function') {
        initWorkerGame();
    }
}

// Initialize when the page loads
window.addEventListener('load', initVersionToggle);
