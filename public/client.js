// Client-side setup for HexStorm

const socket = io(); // Connect to the server

// --- DOM Elements ---
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const infoBarDiv = document.getElementById('info-bar'); // New info bar
const controlsDiv = document.getElementById('controls');
const colorButtonsContainer = document.getElementById('color-buttons-container'); // Direct reference
const gameStatusDiv = document.getElementById('game-status'); // Direct reference

// Placeholders for elements within infoBarDiv (will be populated in init)
let player1InfoDiv = null;
let player2InfoDiv = null;
let player1ScoreSpan = null;
let player2ScoreSpan = null;

// --- Constants ---
const AVAILABLE_COLORS = ['#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#FFD700', '#8A2BE2'];
const HEX_SIZE = 20;
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 550;
const ORIGIN_X = CANVAS_WIDTH / 2;
const ORIGIN_Y = CANVAS_HEIGHT / 2;
// REMOVED: HIGHLIGHT_DURATION

// --- Canvas Setup ---
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// --- Game State ---
let gameState = null;
let previousGameState = null; // Still useful for checking state transitions (like winner)
let currentPlayerId = null;
let playerNumber = null;
let isSpectator = false;
// REMOVED: newlyCapturedHexes
// REMOVED: highlightTimeout
let hoveredHexKey = null;

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
    drawBoard(); // Redraw needed after player assignment
});

socket.on('spectator', (status) => {
    console.log("Assigned as spectator.");
    isSpectator = true;
    playerNumber = null;
    updateUI();
    drawBoard(); // Redraw needed
});


socket.on('gameState', (newState) => {
    console.log('Received game state update');
    previousGameState = gameState; // Store old state *before* updating
    gameState = newState;
    console.log('DEBUG: Received gameState:', JSON.stringify(gameState, null, 2));

    // REMOVED: Animation Logic block (no longer needed)

    updateUI(); // Update scores, turn indicator, buttons etc.
    drawBoard(); // Redraw the board with the new state

    // REMOVED: Highlight Timeout block (no longer needed)

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
    // REMOVED: newlyCapturedHexes.clear();
    // REMOVED: clearTimeout(highlightTimeout);
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
    // ... (function remains the same) ...
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
        // Button styles are now primarily handled by CSS
        button.onclick = () => selectColor(color);

        if (!isMyTurn || color === currentPlayerColor || color === opponentColor) {
            button.disabled = true;
        } else {
             button.style.cursor = 'pointer';
        }

        colorButtonsContainer.appendChild(button);
    });
}

function updateUI() {
    // ... (function remains the same) ...
    // Check if player info divs are ready
    if (!gameState || !gameState.players || !player1InfoDiv || !player2InfoDiv) {
        console.log("UI elements or game state not ready for update.");
        return;
    }

    // Update Scores
    const p1Score = gameState.players.player1?.score ?? '0';
    const p2Score = gameState.players.player2?.score ?? '0';
    player1ScoreSpan.textContent = p1Score;
    player2ScoreSpan.textContent = p2Score;

    // Update Active Player Highlight
    player1InfoDiv.classList.remove('active-player');
    player2InfoDiv.classList.remove('active-player');

    if (gameState.gameStarted && !gameState.winner) {
        if (gameState.turn === 'player1') {
            player1InfoDiv.classList.add('active-player');
        } else if (gameState.turn === 'player2') {
            player2InfoDiv.classList.add('active-player');
        }
    }

    // Update "You are Player X / Spectating" status
    const p1IdSpan = player1InfoDiv.querySelector('.player-id');
    const p2IdSpan = player2InfoDiv.querySelector('.player-id');
    p1IdSpan.textContent = ''; // Clear previous
    p2IdSpan.textContent = ''; // Clear previous

    if (playerNumber === 'player1') {
        p1IdSpan.textContent = '(You)';
    } else if (playerNumber === 'player2') {
        p2IdSpan.textContent = '(You)';
    } else if (isSpectator) {
        // Optionally show spectator status somewhere, maybe gameStatusDiv
        // displayGameStatus("Spectating game."); // Already handled elsewhere
    }


    // Update Color Buttons (handles enabling/disabling based on state)
    updateColorButtons();

    // Update general status message
    if (gameState.winner) {
        displayGameStatus(`${gameState.winner} wins! Resetting soon...`);
    } else if (!gameState.gameStarted) {
        displayGameStatus('Waiting for opponent...');
    } else {
        // Clear status if game is running and no error/winner
         if (gameStatusDiv && !gameStatusDiv.textContent.startsWith('Error:')) { // Added null check for safety
            displayGameStatus('Game in progress');
         }
    }
}

// --- Coordinate & Drawing Functions ---

// REMOVED: axialDirections (no longer needed as getHexNeighbors is removed)
// REMOVED: getHexNeighbors (no longer needed)

// Converts axial coordinates (q, r) to pixel coordinates (x, y)
function axialToPixel(q, r) {
    // ... (function remains the same) ...
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
    // ... (function remains the same) ...
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
    // ... (function remains the same) ...
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
    // ... (function remains the same) ...
    const angle_deg = 60 * i + 30;
    const angle_rad = Math.PI / 180 * angle_deg;
    return {
        x: center.x + size * Math.cos(angle_rad),
        y: center.y + size * Math.sin(angle_rad)
    };
}

// MODIFIED: Draw a single hexagon with persistent highlight for current player
function drawHex(hexData, isOwnedByCurrentPlayer, isHovered) { // Changed parameter
    const { q, r, color, owner } = hexData;
    const center = axialToPixel(q, r);

    // --- Hover Effect (Drop Shadow) --- (No change)
    const applyHoverEffect = isHovered && owner === playerNumber && !isSpectator;
    if (applyHoverEffect) {
        ctx.save();
        ctx.shadowColor = 'rgba(255, 255, 255, 0.7)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }

    // --- Draw Hex Body --- (No change)
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const corner = hexCorner(center, HEX_SIZE, i);
        if (i === 0) ctx.moveTo(corner.x, corner.y);
        else ctx.lineTo(corner.x, corner.y);
    }
    ctx.closePath();

    ctx.fillStyle = color || '#CCCCCC';
    ctx.fill();

    // --- Restore context if shadow was applied --- (No change)
    if (applyHoverEffect) {
        ctx.restore();
    }

    // --- MODIFIED: Draw Hex Border ---
    // Persistent highlight for current player's hexes
    if (isOwnedByCurrentPlayer) { // Check if hex is owned by the viewing player
        ctx.strokeStyle = '#FFFFFF'; // Bright white highlight
        ctx.lineWidth = 3.0; // Thicker white border
    } else {
        // Normal border: Darker, slightly thicker if owned by opponent
         ctx.strokeStyle = '#333333';
         ctx.lineWidth = owner ? 2 : 1; // Thicker for opponent's hexes than unowned
    }
    ctx.stroke();
}

function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!gameState || !gameState.board || Object.keys(gameState.board).length === 0) {
        // ... (placeholder drawing logic is the same) ...
        ctx.fillStyle = '#222222'; // Match dark background
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFA500'; // Orange text
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(isSpectator ? "Spectating..." : "Waiting for game state...", canvas.width / 2, canvas.height / 2);
        return;
    }

    // --- Draw all hex bodies and standard/highlighted borders ---
    Object.values(gameState.board).forEach(hexData => {
        if (hexData && typeof hexData.q !== 'undefined' && typeof hexData.r !== 'undefined') {
             const isHovered = hoveredHexKey === `${hexData.q},${hexData.r}`;
             const isOwnedByCurrentPlayer = hexData.owner === playerNumber; // Check ownership
             drawHex(hexData, isOwnedByCurrentPlayer, isHovered); // Pass ownership flag
        } else {
             console.error("DEBUG: drawBoard - Invalid hexData found:", hexData);
        }
    });

    // REMOVED: Territory Boundary Drawing Section
}

// --- Player Actions ---
function selectColor(color) {
    // ... (function remains the same) ...
    if (isSpectator || !gameState || !gameState.gameStarted || gameState.winner || gameState.turn !== playerNumber) {
        console.log("Cannot select color now.");
        return;
    }
    console.log(`Sending move: ${color}`);
    socket.emit('playerMove', { color: color });
}

// --- Mouse Event Handling ---
function handleMouseMove(event) {
    // ... (function remains the same) ...
    if (!gameState || !gameState.board || isSpectator) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const { q, r } = pixelToAxial(x, y);
    const { q: roundedQ, r: roundedR } = hexRound(q, r);
    const newKey = `${roundedQ},${roundedR}`;

    if (gameState.board[newKey]) {
        if (newKey !== hoveredHexKey) {
            hoveredHexKey = newKey;
            drawBoard();
        }
    } else {
        if (hoveredHexKey !== null) {
            hoveredHexKey = null;
            drawBoard();
        }
    }
}

function handleMouseOut(event) {
    // ... (function remains the same) ...
     if (hoveredHexKey !== null) {
        hoveredHexKey = null;
        drawBoard();
    }
}


// --- Initialization ---
function init() {
    // ... (function remains the same) ...
    console.log("Initializing client...");

    // Setup info-bar structure
    infoBarDiv.innerHTML = `
        <div id="player1-info" class="player-info">
            Player 1: <span class="score" id="player1-score">0</span>
            <span class="player-id"></span>
        </div>
        <div id="player2-info" class="player-info">
            Player 2: <span class="score" id="player2-score">0</span>
            <span class="player-id"></span>
        </div>
    `;

    // Get references to the newly created elements
    player1InfoDiv = document.getElementById('player1-info');
    player2InfoDiv = document.getElementById('player2-info');
    player1ScoreSpan = document.getElementById('player1-score');
    player2ScoreSpan = document.getElementById('player2-score');

    // Add event listeners for hover effect
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseout', handleMouseOut);

    displayGameStatus("Connecting...");
    updateColorButtons(); // Initial call
    drawBoard(); // Initial draw
}

init();
