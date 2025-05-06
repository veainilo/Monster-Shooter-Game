# JavaScript Monster Shooter Game

A high-performance browser-based game demonstrating the power of Web Workers for handling intensive computations in JavaScript games.

![Game Screenshot](screenshot.png)

## 🎮 Game Overview

This project showcases two implementations of the same game:

1. **Original Version**: All game logic runs on the main thread
2. **Web Worker Version**: Collision detection runs in a separate worker thread

The game features a player fighting against a massive number of monsters with remote attacks. The goal is to survive as long as possible while defeating monsters to earn points and upgrades.

## ✨ Features

- Fast-paced action with 500+ monsters on screen
- Bullet penetration system (bullets can hit multiple targets)
- Friendly fire (monsters' bullets can hit other monsters)
- Player upgrades system
- Performance comparison between single-threaded and multi-threaded implementations
- Frame rate display and toggle between limited/unlimited frame rates

## 🔧 Technical Implementation

### Main Technologies

- Pure JavaScript (no frameworks)
- HTML5 Canvas for rendering
- Web Workers API for multi-threading

### Performance Optimizations

#### Web Worker Implementation
- Offloads collision detection to a separate thread
- Uses transferable objects for efficient data transfer between threads
- Non-blocking main thread design for maximum responsiveness
- Adaptive worker communication to balance performance

#### Collision Detection
- Efficient circle-based collision detection
- Optimized collision resolution algorithms

## 🚀 How to Play

1. Use **WASD** or **Arrow Keys** to move the player
2. Auto-targeting and auto-shooting (no need to aim manually)
3. Press **U** to upgrade bullets when upgrade points are available
4. Press **F** to toggle between limited and unlimited frame rates

## 🔍 Implementation Details

### Game Architecture

The game is structured with the following components:

- **Player**: Controlled by the user, can shoot bullets and has upgradeable abilities
- **Monsters**: AI-controlled entities that chase the player
- **Bullets**: Projectiles that can penetrate multiple targets
- **Collision System**: Handles all entity interactions
- **Rendering System**: Draws all game elements on the canvas

### Web Worker Implementation

The Web Worker version moves the collision detection system to a separate thread:

1. Main thread handles:
   - User input
   - Entity movement
   - Rendering
   - Game state management

2. Worker thread handles:
   - All collision detection (player-monster, monster-monster, bullet-monster)
   - Collision resolution
   - Damage calculations

Data is transferred between threads using ArrayBuffer and transferable objects for maximum efficiency.

## 📊 Performance Comparison

The project includes a side-by-side comparison of both implementations:

- **Original Version**: Simple implementation but may experience frame rate drops with many entities
- **Web Worker Version**: More complex implementation but maintains higher frame rates under load

## 🔄 Flow Comparison

See [game_worker_flow_comparison.md](game_worker_flow_comparison.md) for detailed sequence diagrams comparing the execution flow of both implementations.

## 🛠️ Running Locally

1. Clone the repository
2. Start a local web server in the project directory
   ```
   python -m http.server 8000
   ```
   or any other method to serve static files
3. Open `http://localhost:8000` in your browser

## 📝 Notes

- The game is designed to test performance limits with a large number of entities
- Modern browsers with Web Worker support are required for the worker version
- Performance may vary based on your hardware

## 📜 License

MIT License - feel free to use and modify for your own projects.

## 🙏 Acknowledgements

This project was created as a demonstration of Web Worker usage in browser games and the performance benefits of multi-threading in JavaScript applications.
