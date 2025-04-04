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
// Removed: turnIndicatorSpan

// --- Constants ---
const AVAILABLE_COLORS = ['#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#FFD700', '#8A2BE2'];
// ... (rest of constants are the same)
const HEX_SIZE = 20; // Reduced size slightly for larger board visibility
const CANVAS_WIDTH = 600; // Increased canvas size
const CANVAS_HEIGHT = 550; // Increased canvas size
const ORIGIN_X = CANVAS_WIDTH / 2;
const ORIGIN_Y = CANVAS_HEIGHT / 2;
const HIGHLIGHT_DURATION = 400;

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
         if (!gameStatusDiv.textContent.startsWith('Error:')) {
            displayGameStatus('Game in progress');
         }
    }
}

// --- Coordinate & Drawing Functions ---

// NEW: Axial directions for neighbor calculation
const axialDirections = [
    { q: 1, r: 0 }, { q: 0, r: 1 }, { q: -1, r: 1 },
    { q: -1, r: 0 }, { q: 0, r: -1 }, { q: 1, r: -1 }
];

// NEW: Helper function to get neighbors
function getHexNeighbors(q, r) {
    const neighbors = [];
    axialDirections.forEach(dir => {
        neighbors.push({ q: q + dir.q, r: r + dir.r });
    });
    return neighbors;
}

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

    // --- Draw all hex bodies and standard borders first ---
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

    // --- NEW: Draw Territory Boundaries ---
    ctx.lineWidth = 3; // Thicker line for boundaries

    Object.values(gameState.board).forEach(hexData => {
        if (!hexData || !hexData.owner) return; // Skip empty or unowned hexes

        const { q, r, owner } = hexData;
        const playerColor = gameState.players[owner]?.color;
        if (!playerColor) return; // Skip if player color is somehow missing

        const center = axialToPixel(q, r);
        const neighbors = getHexNeighbors(q, r);

        ctx.strokeStyle = playerColor; // Set the stroke color for this player's boundary

        for (let i = 0; i < 6; i++) {
            const neighborCoords = neighbors[i];
            const neighborKey = `${neighborCoords.q},${neighborCoords.r}`;
            const neighborHex = gameState.board[neighborKey];

            // Draw boundary edge if neighbor doesn't exist or is not owned by the same player
            if (!neighborHex || neighborHex.owner !== owner) {
                const corner1 = hexCorner(center, HEX_SIZE, i);
                const corner2 = hexCorner(center, HEX_SIZE, (i + 1) % 6); // Next corner

                ctx.beginPath();
                ctx.moveTo(corner1.x, corner1.y);
                ctx.lineTo(corner2.x, corner2.y);
                ctx.stroke();
            }
        }
    });
    // --- End NEW Section ---
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
    player1ScoreSpan = document.getElementById('player1-score'); // Already scoped correctly
    player2ScoreSpan = document.getElementById('player2-score'); // Already scoped correctly
    // References to colorButtonsContainer and gameStatusDiv are already set globally

    // Add event listeners for hover effect
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseout', handleMouseOut);

    displayGameStatus("Connecting...");
    updateColorButtons(); // Initial call
    drawBoard(); // Initial draw
}

init();
