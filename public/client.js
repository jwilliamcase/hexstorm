// Client-side setup for HexStorm

const socket = io(); // Connect to the server

// --- DOM Elements ---
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const controlsDiv = document.getElementById('controls');
// Placeholders for elements within controlsDiv (will be populated in init)
let player1ScoreSpan = null;
let player2ScoreSpan = null;
let turnIndicatorSpan = null;
let gameStatusDiv = null;
let colorButtonsContainer = null;

// --- Constants ---
const HEX_SIZE = 25; // Radius of a hexagon tile
const AVAILABLE_COLORS = ['#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#FFD700', '#8A2BE2'];
const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 500;
const ORIGIN_X = CANVAS_WIDTH / 2;
const ORIGIN_Y = CANVAS_HEIGHT / 2;
const HIGHLIGHT_DURATION = 400; // ms for capture animation

// --- Canvas Setup ---
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// --- Game State ---
let gameState = null; // Will hold the full game state from the server
let previousGameState = null; // Store previous state for animation
let currentPlayerId = null; // This client's socket ID (assigned on connect)
let playerNumber = null; // Is this client player1 or player2?
let isSpectator = false; // Is this client a spectator?
let newlyCapturedHexes = new Set(); // Hex keys ("q,r") captured in the last update
let highlightTimeout = null; // Timeout ID for clearing highlight
let hoveredHexKey = null; // Hex key ("q,r") currently under the mouse

// --- Socket Event Handlers ---
socket.on('connect', () => {
    console.log('Connected to server:', socket.id);
    currentPlayerId = socket.id;
});

socket.on('assignPlayer', (assignedNumber) => {
    console.log(`Assigned player number: ${assignedNumber}`);
    playerNumber = assignedNumber;
    isSpectator = false;
    updateUI();
});

socket.on('spectator', (status) => {
    console.log("Assigned as spectator.");
    isSpectator = true;
    playerNumber = null;
    updateUI();
});


socket.on('gameState', (newState) => {
    console.log('Received game state update');
    previousGameState = gameState; // Store old state *before* updating
    gameState = newState;
    console.log('DEBUG: Received gameState:', JSON.stringify(gameState, null, 2));

    // --- Animation Logic ---
    clearTimeout(highlightTimeout); // Clear previous timeout if updates are fast
    newlyCapturedHexes.clear();

    if (previousGameState && previousGameState.board && gameState.board && playerNumber) {
        Object.keys(gameState.board).forEach(key => {
            const newHex = gameState.board[key];
            const oldHex = previousGameState.board[key];
            // Check if hex *just* became owned by the current player
            if (newHex.owner === playerNumber && (!oldHex || oldHex.owner !== playerNumber)) {
                newlyCapturedHexes.add(key);
            }
        });
    }

    updateUI(); // Update scores, turn indicator, buttons etc.
    drawBoard(); // Redraw the board with the new state (potentially showing highlights)

    // Set timeout to clear highlights and redraw
    if (newlyCapturedHexes.size > 0) {
        highlightTimeout = setTimeout(() => {
            newlyCapturedHexes.clear();
            drawBoard(); // Redraw without highlights
        }, HIGHLIGHT_DURATION);
    }

    // Check if game just ended to show winner message clearly
    if (!previousGameState?.winner && newState.winner) {
         displayGameStatus(`${newState.winner} wins! Resetting soon...`);
    } else if (previousGameState?.winner && !newState.winner) {
        displayGameStatus('New game started!'); // Message when game resets
    }
});

socket.on('gameError', (error) => {
    console.error('Game Error:', error.message);
    displayGameStatus(`Error: ${error.message}`);
});


socket.on('disconnect', () => {
    console.log('Disconnected from server');
    gameState = null;
    previousGameState = null;
    playerNumber = null;
    isSpectator = false;
    newlyCapturedHexes.clear();
    clearTimeout(highlightTimeout);
    hoveredHexKey = null;
    displayGameStatus("Disconnected from server.");
    updateColorButtons();
    drawBoard();
});

// --- UI Update Functions ---

function displayGameStatus(message) {
    if (gameStatusDiv) {
        gameStatusDiv.textContent = message;
    }
}

function updateColorButtons() {
    if (!colorButtonsContainer) return;
    colorButtonsContainer.innerHTML = '';

    if (isSpectator || !gameState || !gameState.gameStarted || gameState.winner) {
         if (isSpectator) displayGameStatus("Spectating game.");
         else if (!gameState) displayGameStatus("Waiting for connection...");
         else if (!gameState.gameStarted) displayGameStatus("Waiting for opponent...");
         else if (gameState.winner) displayGameStatus(`${gameState.winner} won!`);
        return;
    }

    const currentPlayerColor = gameState.players[playerNumber]?.color;
    const opponentNumber = playerNumber === 'player1' ? 'player2' : 'player1';
    const opponentColor = gameState.players[opponentNumber]?.color;
    const isMyTurn = gameState.turn === playerNumber;

    AVAILABLE_COLORS.forEach(color => {
        const button = document.createElement('button');
        button.textContent = '';
        button.style.backgroundColor = color;
        button.style.margin = '3px';
        button.style.width = '40px';
        button.style.height = '40px';
        button.style.border = '1px solid #555';
        button.style.borderRadius = '4px';
        button.onclick = () => selectColor(color);

        if (!isMyTurn || color === currentPlayerColor || color === opponentColor) {
            button.disabled = true;
            button.style.opacity = '0.5';
            button.style.cursor = 'not-allowed';
        } else {
             button.style.cursor = 'pointer';
             // Subtle hover effect for enabled buttons
             button.onmouseenter = () => button.style.boxShadow = '0 0 5px #FFF';
             button.onmouseleave = () => button.style.boxShadow = 'none';
        }

        colorButtonsContainer.appendChild(button);
    });
}

function updateUI() {
    if (!gameState || !gameState.players || !player1ScoreSpan) {
        console.log("UI elements or game state not ready for update.");
        return;
    }

    const p1Score = gameState.players.player1?.score ?? '0';
    const p2Score = gameState.players.player2?.score ?? '0';
    player1ScoreSpan.textContent = p1Score;
    player2ScoreSpan.textContent = p2Score;

    if (gameState.winner) {
        turnIndicatorSpan.textContent = `${gameState.winner} wins!`;
        turnIndicatorSpan.style.fontWeight = 'bold';
    } else if (gameState.gameStarted) {
        turnIndicatorSpan.textContent = `Turn: ${gameState.turn}`;
        turnIndicatorSpan.style.fontWeight = (gameState.turn === playerNumber) ? 'bold' : 'normal';
    } else {
        turnIndicatorSpan.textContent = "Waiting...";
        turnIndicatorSpan.style.fontWeight = 'normal';
    }

    updateColorButtons();

    if (!gameState.winner && gameStatusDiv.textContent.startsWith('Error:')) {
         displayGameStatus(gameState.gameStarted ? 'Game in progress' : 'Waiting for opponent...');
    } else if (!gameState.winner && !gameState.gameStarted) {
         displayGameStatus('Waiting for opponent...');
    } else if (!gameState.winner && gameState.gameStarted) {
         displayGameStatus('Game in progress');
    }

     const playerIndicator = document.getElementById('player-indicator');
     if (playerIndicator) {
         if (playerNumber) playerIndicator.textContent = `You are ${playerNumber}`;
         else if (isSpectator) playerIndicator.textContent = `You are spectating`;
         else playerIndicator.textContent = `Connecting...`;
     }
}

// --- Coordinate & Drawing Functions ---

// Converts axial coordinates (q, r) to pixel coordinates (x, y)
function axialToPixel(q, r) {
    let drawQ = q;
    let drawR = r;
    // Apply 180-degree rotation for Player 2's view
    if (playerNumber === 'player2') {
        drawQ = -q;
        drawR = -r;
    }
    const x = HEX_SIZE * (Math.sqrt(3) * drawQ + Math.sqrt(3) / 2 * drawR) + ORIGIN_X;
    const y = HEX_SIZE * (3. / 2 * drawR) + ORIGIN_Y;
    return { x, y };
}

// Converts pixel coordinates (x, y) to fractional axial coordinates (q, r)
function pixelToAxial(x, y) {
    let adjustedX = x - ORIGIN_X;
    let adjustedY = y - ORIGIN_Y;

    // Apply inverse rotation if Player 2
    if (playerNumber === 'player2') {
        adjustedX = -adjustedX;
        adjustedY = -adjustedY;
    }

    const q = (Math.sqrt(3) / 3 * adjustedX - 1. / 3 * adjustedY) / HEX_SIZE;
    const r = (2. / 3 * adjustedY) / HEX_SIZE;
    return { q, r };
}

// Rounds fractional axial coordinates to the nearest integer hex coordinates
function hexRound(q, r) {
    const s = -q - r; // Calculate the third cube coordinate
    let rq = Math.round(q);
    let rr = Math.round(r);
    let rs = Math.round(s);

    const q_diff = Math.abs(rq - q);
    const r_diff = Math.abs(rr - r);
    const s_diff = Math.abs(rs - s);

    if (q_diff > r_diff && q_diff > s_diff) {
        rq = -rr - rs;
    } else if (r_diff > s_diff) {
        rr = -rq - rs;
    } else {
        rs = -rq - rr;
    }
    // Return the primary axial coordinates
    return { q: rq, r: rr };
}


function hexCorner(center, size, i) {
    const angle_deg = 60 * i + 30;
    const angle_rad = Math.PI / 180 * angle_deg;
    return {
        x: center.x + size * Math.cos(angle_rad),
        y: center.y + size * Math.sin(angle_rad)
    };
}

// Draw a single hexagon with optional highlight and hover effects
function drawHex(hexData, isHighlight, isHovered) {
    const { q, r, color, owner } = hexData;
    const center = axialToPixel(q, r);

    // --- Hover Effect (Drop Shadow) ---
    const applyHoverEffect = isHovered && owner === playerNumber && !isSpectator;
    if (applyHoverEffect) {
        ctx.save(); // Save context state before applying shadow
        ctx.shadowColor = 'rgba(255, 255, 255, 0.7)'; // White glow
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }

    // --- Draw Hex Body ---
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const corner = hexCorner(center, HEX_SIZE, i);
        if (i === 0) ctx.moveTo(corner.x, corner.y);
        else ctx.lineTo(corner.x, corner.y);
    }
    ctx.closePath();

    ctx.fillStyle = color || '#CCCCCC';
    ctx.fill();

    // --- Restore context if shadow was applied ---
    if (applyHoverEffect) {
        ctx.restore(); // Restore context to remove shadow for border drawing
    }

    // --- Draw Hex Border ---
    // Highlight effect: Bright white, thicker border
    if (isHighlight) {
        ctx.strokeStyle = '#FFFFFF'; // Bright white highlight
        ctx.lineWidth = 3.5;
    } else {
        // Normal border: Darker, slightly thicker if owned
         ctx.strokeStyle = '#333333';
         ctx.lineWidth = owner ? 2 : 1; // Slightly thicker for owned
    }
    ctx.stroke();
}

function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!gameState || !gameState.board || Object.keys(gameState.board).length === 0) {
        // Draw placeholder background/text if no game state
        ctx.fillStyle = '#222222'; // Match dark background
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFA500'; // Orange text
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(isSpectator ? "Spectating..." : "Waiting for game state...", canvas.width / 2, canvas.height / 2);
        return;
    }

    Object.values(gameState.board).forEach(hexData => {
        if (hexData && typeof hexData.q !== 'undefined' && typeof hexData.r !== 'undefined') {
             const key = `${hexData.q},${hexData.r}`;
             const isHighlight = newlyCapturedHexes.has(key);
             const isHovered = hoveredHexKey === key;
             drawHex(hexData, isHighlight, isHovered);
        } else {
             console.error("DEBUG: drawBoard - Invalid hexData found:", hexData);
        }
    });
}

// --- Player Actions ---
function selectColor(color) {
    if (isSpectator || !gameState || !gameState.gameStarted || gameState.winner || gameState.turn !== playerNumber) {
        console.log("Cannot select color now.");
        return;
    }
    console.log(`Sending move: ${color}`);
    socket.emit('playerMove', { color: color });
}

// --- Mouse Event Handling ---
function handleMouseMove(event) {
    if (!gameState || !gameState.board || isSpectator) return; // Only handle hover if game is active and user is a player

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const { q, r } = pixelToAxial(x, y);
    const { q: roundedQ, r: roundedR } = hexRound(q, r);
    const newKey = `${roundedQ},${roundedR}`;

    // Check if the calculated hex exists on the board
    if (gameState.board[newKey]) {
        if (newKey !== hoveredHexKey) {
            hoveredHexKey = newKey;
            drawBoard(); // Redraw needed to show/remove hover effect
        }
    } else {
        // Mouse is over the canvas but not a valid hex
        if (hoveredHexKey !== null) {
            hoveredHexKey = null;
            drawBoard(); // Redraw needed to remove hover effect
        }
    }
}

function handleMouseOut(event) {
     if (hoveredHexKey !== null) {
        hoveredHexKey = null;
        drawBoard(); // Redraw to remove hover effect when mouse leaves canvas
    }
}


// --- Initialization ---
function init() {
    console.log("Initializing client...");

    // Setup controlsDiv structure
    controlsDiv.innerHTML = `
        <div id="player-indicator" style="margin-bottom: 10px; font-style: italic;">Connecting...</div>
        <div id="game-status" style="margin-bottom: 10px; min-height: 1.2em;">Waiting for server...</div>
        <p>P1 Score: <span id="player1-score">0</span></p>
        <p>P2 Score: <span id="player2-score">0</span></p>
        <p><span id="turn-indicator">Waiting...</span></p>
        <div id="color-buttons-container" style="margin-top: 15px;">
            <!-- Buttons will be added dynamically -->
        </div>
    `;

    // Get references to the newly created elements
    player1ScoreSpan = document.getElementById('player1-score');
    player2ScoreSpan = document.getElementById('player2-score');
    turnIndicatorSpan = document.getElementById('turn-indicator');
    gameStatusDiv = document.getElementById('game-status');
    colorButtonsContainer = document.getElementById('color-buttons-container');

    // Add event listeners for hover effect
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseout', handleMouseOut);


    displayGameStatus("Connecting...");
    updateColorButtons();
    drawBoard();
}

init();
