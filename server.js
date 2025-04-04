// Server setup for HexStorm using Express and Socket.IO

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// --- Game Constants ---
const BOARD_RADIUS = 4;
const COLORS = ['#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#FFD700', '#8A2BE2'];
const PLAYER_IDS = ['player1', 'player2'];
// Axial directions (q, r) for neighbors
const AXIAL_DIRECTIONS = [
    { q: +1, r: 0 }, { q: +1, r: -1 }, { q: 0, r: -1 },
    { q: -1, r: 0 }, { q: -1, r: +1 }, { q: 0, r: +1 }
];

// --- Game State ---
let gameState = {
    board: {},
    players: {
        player1: { id: null, socketId: null, score: 0, startHex: null, color: null },
        player2: { id: null, socketId: null, score: 0, startHex: null, color: null }
    },
    turn: null,
    gameStarted: false,
    winner: null
};

// --- Game Logic Functions ---

/**
 * Initializes or resets the game board and state.
 */
function initializeGame() {
    console.log("Initializing game state...");
    gameState.board = {};
    gameState.winner = null;
    gameState.gameStarted = false; // Will be set to true when 2 players join
    const usedColors = new Set();

    const startCoords = [
        { q: -BOARD_RADIUS, r: 0 }, // P1 new start (Leftmost)
        { q: BOARD_RADIUS, r: 0 }   // P2 new start (Rightmost)
    ];

    const p1StartKey = `${startCoords[0].q},${startCoords[0].r}`;
    const p2StartKey = `${startCoords[1].q},${startCoords[1].r}`;

    // Reset player state but keep socket IDs if they exist
    gameState.players.player1 = { ...gameState.players.player1, score: 0, startHex: p1StartKey, color: null };
    gameState.players.player2 = { ...gameState.players.player2, score: 0, startHex: p2StartKey, color: null };


    // Generate board hexes
    for (let q = -BOARD_RADIUS; q <= BOARD_RADIUS; q++) {
        for (let r = -BOARD_RADIUS; r <= BOARD_RADIUS; r++) {
            if (Math.abs(q + r) <= BOARD_RADIUS) {
                const coordKey = `${q},${r}`;
                let randomColor;
                let owner = null;

                if (coordKey === p1StartKey) {
                    owner = 'player1';
                    do { randomColor = COLORS[Math.floor(Math.random() * COLORS.length)]; } while (usedColors.has(randomColor));
                    usedColors.add(randomColor);
                    gameState.players.player1.color = randomColor;
                } else if (coordKey === p2StartKey) {
                    owner = 'player2';
                    do { randomColor = COLORS[Math.floor(Math.random() * COLORS.length)]; } while (usedColors.has(randomColor) || randomColor === gameState.players.player1.color); // Ensure P2 is different from P1 too
                    usedColors.add(randomColor);
                    gameState.players.player2.color = randomColor;
                } else {
                    // Assign random color, ensuring it's not one of the initial player colors
                     do {
                        randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
                    } while (randomColor === gameState.players.player1.color || randomColor === gameState.players.player2.color);
                }
                gameState.board[coordKey] = { q, r, color: randomColor, owner: owner };
            }
        }
    }
    gameState.players.player1.score = 1;
    gameState.players.player2.score = 1;
    gameState.turn = 'player1'; // Player 1 starts
    console.log("Game state initialized.");

    // If both players are already connected from a previous game, start immediately
    if (gameState.players.player1.socketId && gameState.players.player2.socketId) {
         startGame();
    }
}

/**
 * Gets valid neighbor coordinates for a given hex.
 */
function getNeighbors(q, r) {
    const neighbors = [];
    AXIAL_DIRECTIONS.forEach(dir => {
        const nq = q + dir.q;
        const nr = r + dir.r;
        const key = `${nq},${nr}`;
        if (gameState.board[key]) { // Check if the neighbor exists on the board
            neighbors.push(gameState.board[key]);
        }
    });
    return neighbors;
}

/**
 * Performs flood fill for a player choosing a target color.
 * Updates the owner and color of captured hexes.
 */
function floodFill(playerNumber, targetColor) {
    const player = gameState.players[playerNumber];
    if (!player || !player.color) return 0; // Should not happen in valid game

    const opponentNumber = playerNumber === 'player1' ? 'player2' : 'player1';
    const opponent = gameState.players[opponentNumber];

    // --- Validation ---
    if (targetColor === player.color) {
        console.log(`Player ${playerNumber} chose their own color (${targetColor}). Invalid move.`);
        return player.score; // No change in score
    }
    if (opponent && targetColor === opponent.color) {
         console.log(`Player ${playerNumber} chose opponent's color (${targetColor}). Invalid move.`);
         return player.score; // No change in score
    }
    if (!COLORS.includes(targetColor)) {
        console.log(`Invalid color chosen: ${targetColor}`);
        return player.score; // No change in score
    }

    const frontier = []; // Hexes to visit (use array as a queue for BFS)
    const visited = new Set(); // Keep track of visited hex coords ("q,r")
    let currentScore = 0;

    // 1. Find all hexes currently owned by the player - these are the start points
    const ownedHexes = Object.values(gameState.board).filter(hex => hex.owner === playerNumber);

    // 2. Initialize frontier and visited set with currently owned hexes
    ownedHexes.forEach(hex => {
        const key = `${hex.q},${hex.r}`;
        frontier.push(hex);
        visited.add(key);
        // Change color of currently owned hexes immediately
        hex.color = targetColor;
    });

    // 3. Perform BFS
    while (frontier.length > 0) {
        const currentHex = frontier.shift(); // Get hex from the front of the queue

        // Explore neighbors
        const neighbors = getNeighbors(currentHex.q, currentHex.r);
        for (const neighbor of neighbors) {
            const neighborKey = `${neighbor.q},${neighbor.r}`;

            // Check if neighbor should be captured or added to frontier
            if (!visited.has(neighborKey)) {
                 // Capture condition: Neighbor has the target color OR was previously owned by the player (part of the initial set)
                if (neighbor.color === targetColor || neighbor.owner === playerNumber) {
                    visited.add(neighborKey); // Mark as visited
                    neighbor.owner = playerNumber; // Capture the hex
                    neighbor.color = targetColor; // Ensure its color matches
                    frontier.push(neighbor); // Add to frontier to explore its neighbors
                }
            }
        }
    }

    // 4. Update player's main color and score
    player.color = targetColor;
    player.score = visited.size; // Score is the total number of owned hexes

    console.log(`Player ${playerNumber} captured with ${targetColor}. New score: ${player.score}`);
    return player.score;
}

/** Sets gameStarted to true and notifies clients */
function startGame() {
    if (!gameState.gameStarted && gameState.players.player1.socketId && gameState.players.player2.socketId) {
        gameState.gameStarted = true;
        console.log("Both players connected. Starting game.");
        // Broadcast initial state to start the game on clients
        io.emit('gameState', gameState);
    }
}

// --- Server Setup & Socket Handling ---

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    let assignedPlayer = null;

    // Assign player slot
    if (!gameState.players.player1.socketId) {
        assignedPlayer = 'player1';
        gameState.players.player1.socketId = socket.id;
        console.log(`Assigned ${socket.id} to player1`);
    } else if (!gameState.players.player2.socketId) {
        assignedPlayer = 'player2';
        gameState.players.player2.socketId = socket.id;
        console.log(`Assigned ${socket.id} to player2`);
    } else {
        console.log(`Spectator connected: ${socket.id}`);
        // Handle spectators if desired (e.g., send game state but don't assign player)
        socket.emit('spectator', true); // Inform client they are spectator
    }

    if (assignedPlayer) {
        socket.emit('assignPlayer', assignedPlayer); // Tell the client which player they are
    }

    // Send current game state to the new client
    socket.emit('gameState', gameState);

    // Check if game can start
    startGame();


    // Handle player moves
    socket.on('playerMove', (data) => {
        const playerNumber = Object.keys(gameState.players).find(p => gameState.players[p].socketId === socket.id);

        if (!playerNumber) {
            console.log(`Move received from unknown socket: ${socket.id}`);
            return; // Ignore move from spectators or unknown sockets
        }

        if (!gameState.gameStarted) {
             console.log(`Move received before game started from ${playerNumber}.`);
             // Optionally send an error message back
             // socket.emit('gameError', { message: "Game has not started yet." });
             return;
        }

        if (gameState.turn !== playerNumber) {
            console.log(`Move received from ${playerNumber} but it's ${gameState.turn}'s turn.`);
             // Optionally send an error message back
             // socket.emit('gameError', { message: "It's not your turn." });
            return;
        }

        const targetColor = data.color;
        console.log(`Move received from ${playerNumber} (${socket.id}): ${targetColor}`);

        // Perform flood fill and update score (validation is inside floodFill)
        const newScore = floodFill(playerNumber, targetColor);

        // Check win condition (e.g., > half the board) - Simple version
        const totalHexes = Object.keys(gameState.board).length;
        if (newScore > totalHexes / 2) {
            gameState.winner = playerNumber;
            console.log(`Player ${playerNumber} wins!`);
            // Resetting or stopping the game state update might happen here
        }


        // Switch turn if the game is not won
        if (!gameState.winner) {
            gameState.turn = playerNumber === 'player1' ? 'player2' : 'player1';
        } else {
            gameState.turn = null; // No more turns after win
            gameState.gameStarted = false; // Stop game logic
        }

        // Broadcast updated gameState to ALL players
        io.emit('gameState', gameState);

         // Optional: Reset game after a short delay if someone won
         if (gameState.winner) {
             setTimeout(() => {
                 initializeGame(); // Re-initialize for a new game
                 io.emit('gameState', gameState); // Send the fresh board
             }, 5000); // Reset after 5 seconds
         }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        const playerNumber = Object.keys(gameState.players).find(p => gameState.players[p].socketId === socket.id);
        if (playerNumber) {
            console.log(`Player ${playerNumber} disconnected.`);
            gameState.players[playerNumber].socketId = null; // Clear the socket ID
            // TODO: Handle game interruption (e.g., declare other player winner, pause game, reset)
            // Simple reset for now if a player leaves mid-game
            if (gameState.gameStarted && !gameState.winner) {
                 console.log("A player disconnected mid-game. Resetting.");
                 // Notify remaining player?
                 const otherPlayer = playerNumber === 'player1' ? 'player2' : 'player1';
                 const otherSocketId = gameState.players[otherPlayer]?.socketId;
                 if(otherSocketId) {
                    io.to(otherSocketId).emit('gameError', { message: 'Opponent disconnected. Resetting game.' });
                 }
                 // Reset the game state
                 initializeGame();
                 // Broadcast the reset state
                 io.emit('gameState', gameState);
            } else if (!gameState.gameStarted) {
                // If game hadn't started, just clear the slot
                console.log("Player disconnected before game started.");
            }
        } else {
            console.log("Spectator disconnected.");
        }
    });
});

// Initialize the game state when the server starts
initializeGame();

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
