// Client-side setup for HexStorm

const socket = io(); // Connect to the server

// --- DOM Elements ---
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const bgCanvas = document.getElementById('background-canvas');
const bgCtx = bgCanvas.getContext('2d');
const infoBarDiv = document.getElementById('info-bar');
const controlsDiv = document.getElementById('controls');
const colorButtonsContainer = document.getElementById('color-buttons-container');
const gameStatusDiv = document.getElementById('game-status');

// Placeholders for elements within infoBarDiv
let player1InfoDiv = null;
let player2InfoDiv = null;
let player1ScoreSpan = null;
let player2ScoreSpan = null;

// --- Hex Starfield Animation State ---
let hexStars = [];
const NUM_STARS = 150;
const STAR_COLORS = ['rgba(255, 215, 0, 0.7)', 'rgba(255, 165, 0, 0.6)', 'rgba(200, 200, 255, 0.5)', 'rgba(150, 150, 200, 0.4)'];
let lastStarTimestamp = 0;

// --- Flood Fill Pulse Animation State ---
let isAnimatingPulse = false;
let pulseStartTime = 0;
const PULSE_DURATION = 350; // ms
let hexesToPulse = [];

// --- Win/Lose Animation State ---
let isGameOver = false;
let isWinner = null; // true, false, or null
let winAnimationId = null;
let winAnimationStartTime = 0;
const WIN_ANIMATION_DURATION = 4000; // ms (slightly less than server reset delay)
let loseColorsApplied = false;
const LOSE_COLOR = '#8B4513'; // SaddleBrown - a dull brown
const LOSE_COLOR_ALT = '#A0522D'; // Sienna - another brown

// --- Constants ---
const AVAILABLE_COLORS = ['#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#FFD700', '#8A2BE2'];
const HEX_SIZE = 20;
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 550;
const ORIGIN_X = CANVAS_WIDTH / 2;
const ORIGIN_Y = CANVAS_HEIGHT / 2;

// --- Canvas Setup ---
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
bgCanvas.width = CANVAS_WIDTH;
bgCanvas.height = CANVAS_HEIGHT;

// --- Game State ---
let gameState = null;
let previousGameState = null;
let currentPlayerId = null;
let playerNumber = null;
let isSpectator = false;
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
    drawBoard();
});

socket.on('spectator', (status) => {
    console.log("Assigned as spectator.");
    isSpectator = true;
    playerNumber = null;
    updateUI();
    drawBoard();
});

socket.on('gameState', (newState) => {
    console.log('Received game state update');
    const wasGameOver = isGameOver; // Check previous game over state
    previousGameState = gameState;
    gameState = newState;

    // --- Handle Game Over Start/End --- 
    if (!previousGameState?.winner && newState.winner) {
        // Game just ended
        console.log(`Game Over. Winner: ${newState.winner}`);
        isGameOver = true;
        isWinner = (newState.winner === playerNumber);
        loseColorsApplied = false; // Reset lose effect flag
        if (winAnimationId) cancelAnimationFrame(winAnimationId); // Stop previous win anim if any

        if (!isSpectator) {
            if (isWinner) {
                startWinAnimationLoop();
            } else {
                applyLoseEffect();
            }
        }
    } else if (previousGameState?.winner && !newState.winner) {
        // Game just reset
        console.log("Game reset.");
        isGameOver = false;
        isWinner = null;
        loseColorsApplied = false;
        if (winAnimationId) {
            cancelAnimationFrame(winAnimationId);
            winAnimationId = null;
        }
    }
    // --- End Handle Game Over ---

    updateUI(); // Update scores, status messages, buttons
    
    // Only draw board immediately if not in a win animation (which handles its own drawing)
    if (!winAnimationId) {
        drawBoard(); 
    }

    // --- Trigger Pulse Animation (only if game is running) ---
    if (!isGameOver && previousGameState && previousGameState.board && gameState.board && playerNumber && !isSpectator) {
        const newlyCapturedHexes = [];
        const currentPlayer = gameState.players[playerNumber];
        const previousPlayer = previousGameState.players[playerNumber];
        if (previousGameState.turn === playerNumber && currentPlayer && previousPlayer && currentPlayer.score > previousPlayer.score) {
            Object.keys(gameState.board).forEach(key => {
                const currentHex = gameState.board[key];
                const previousHex = previousGameState.board[key];
                if (currentHex.owner === playerNumber && (!previousHex || previousHex.owner !== playerNumber)) {
                    newlyCapturedHexes.push({ q: currentHex.q, r: currentHex.r });
                }
            });
        }
        if (newlyCapturedHexes.length > 0) {
            startFloodFillPulseAnimation(newlyCapturedHexes);
        }
    }
    // --- End Trigger Pulse Animation ---
});

socket.on('gameError', (error) => {
    console.error('Game Error:', error.message);
    displayGameStatus(`Error: ${error.message}`);
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    // Reset all state on disconnect
    gameState = null;
    previousGameState = null;
    playerNumber = null;
    isSpectator = false;
    hoveredHexKey = null;
    isAnimatingPulse = false;
    hexesToPulse = [];
    isGameOver = false;
    isWinner = null;
    loseColorsApplied = false;
    if (winAnimationId) {
        cancelAnimationFrame(winAnimationId);
        winAnimationId = null;
    }
    displayGameStatus("Disconnected from server.");
    updateColorButtons();
    drawBoard();
});

// --- UI Update Functions ---
function displayGameStatus(message) {
    if (gameStatusDiv) gameStatusDiv.textContent = message;
}

function updateColorButtons() {
    if (!colorButtonsContainer) return;
    colorButtonsContainer.innerHTML = '';
    // Buttons only available during active play
    if (isSpectator || !gameState || !gameState.gameStarted || gameState.winner || gameState.turn !== playerNumber || isGameOver) {
        return;
    }
    const currentPlayerColor = gameState.players[playerNumber]?.color;
    const opponentNumber = playerNumber === 'player1' ? 'player2' : 'player1';
    const opponentColor = gameState.players[opponentNumber]?.color;

    AVAILABLE_COLORS.forEach(color => {
        if (color === currentPlayerColor || color === opponentColor) return;
        const button = document.createElement('button');
        button.style.backgroundColor = color;
        button.onclick = () => selectColor(color);
        button.disabled = false; // Already checked conditions above
        button.style.cursor = 'pointer';
        colorButtonsContainer.appendChild(button);
    });
}

function updateUI() {
    if (!gameState || !gameState.players || !player1InfoDiv || !player2InfoDiv) return;
    const p1Score = gameState.players.player1?.score ?? '0';
    const p2Score = gameState.players.player2?.score ?? '0';
    player1ScoreSpan.textContent = p1Score;
    player2ScoreSpan.textContent = p2Score;
    // Active player highlight only if game is running
    player1InfoDiv.classList.toggle('active-player', gameState.gameStarted && !gameState.winner && gameState.turn === 'player1' && !isGameOver);
    player2InfoDiv.classList.toggle('active-player', gameState.gameStarted && !gameState.winner && gameState.turn === 'player2' && !isGameOver);
    const p1IdSpan = player1InfoDiv.querySelector('.player-id');
    const p2IdSpan = player2InfoDiv.querySelector('.player-id');
    p1IdSpan.textContent = (playerNumber === 'player1') ? '(You)' : '';
    p2IdSpan.textContent = (playerNumber === 'player2') ? '(You)' : '';
    
    updateColorButtons(); // Update buttons based on turn and colors

    // --- Update Game Status Message --- 
    if (isSpectator) {
        displayGameStatus(isGameOver ? `${gameState.winner} wins!` : "Spectating game.");
    }
    else if (gameStatusDiv && gameStatusDiv.textContent.startsWith('Error:')) {
        // Keep existing error message
    } 
    else if (isGameOver) {
        // Game over state takes precedence
        displayGameStatus(isWinner ? "You Win!" : "You Lose.");
    } 
    else if (!gameState.gameStarted) {
        displayGameStatus('Waiting for opponent...');
    } 
    else {
        // Game is in progress
        if (gameState.turn === playerNumber) {
            displayGameStatus("Your turn!");
        } else {
            displayGameStatus("Opponent's turn.");
        }
    }
}

// --- Coordinate & Drawing Functions ---
function axialToPixel(q, r) {
    let drawQ = q, drawR = r;
    if (playerNumber === 'player2') { drawQ = -q; drawR = -r; }
    const x = HEX_SIZE * (Math.sqrt(3) * drawQ + Math.sqrt(3) / 2 * drawR) + ORIGIN_X;
    const y = HEX_SIZE * (3. / 2 * drawR) + ORIGIN_Y;
    return { x, y };
}

function pixelToAxial(x, y) {
    let adjustedX = x - ORIGIN_X, adjustedY = y - ORIGIN_Y;
    if (playerNumber === 'player2') { adjustedX = -adjustedX; adjustedY = -adjustedY; }
    const q = (Math.sqrt(3) / 3 * adjustedX - 1. / 3 * adjustedY) / HEX_SIZE;
    const r = (2. / 3 * adjustedY) / HEX_SIZE;
    return { q, r };
}

function hexRound(q, r) {
    const s = -q - r;
    let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
    const q_diff = Math.abs(rq - q), r_diff = Math.abs(rr - r), s_diff = Math.abs(rs - s);
    if (q_diff > r_diff && q_diff > s_diff) rq = -rr - rs;
    else if (r_diff > s_diff) rr = -rq - rs;
    return { q: rq, r: rr };
}

function hexCorner(center, size, i) {
    const angle_deg = 60 * i + 30;
    const angle_rad = Math.PI / 180 * angle_deg;
    return { x: center.x + size * Math.cos(angle_rad), y: center.y + size * Math.sin(angle_rad) };
}

// Draw a single GAME hexagon
function drawHex(hexData, isOwnedByCurrentPlayer, isHovered) {
    const { q, r, owner } = hexData;
    let displayColor = hexData.color; // Start with the original color

    // Check if lose effect should be applied
    if (loseColorsApplied && owner === playerNumber) {
        // Use alternating brown colors for variety
        displayColor = (q % 2 === r % 2) ? LOSE_COLOR : LOSE_COLOR_ALT;
    }

    const center = axialToPixel(q, r);
    const applyHoverEffect = isHovered && owner === playerNumber && !isSpectator && !isGameOver;
    if (applyHoverEffect) {
        ctx.save();
        ctx.shadowColor = 'rgba(255, 255, 255, 0.7)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const corner = hexCorner(center, HEX_SIZE, i);
        if (i === 0) ctx.moveTo(corner.x, corner.y);
        else ctx.lineTo(corner.x, corner.y);
    }
    ctx.closePath();
    ctx.fillStyle = displayColor || '#CCCCCC';
    ctx.fill();
    if (applyHoverEffect) ctx.restore();
    
    // Border logic - keep winner highlight even during win animation
    let borderColor = '#333333';
    let borderWidth = owner ? 2 : 1;
    if (isOwnedByCurrentPlayer) {
        borderColor = '#FFFFFF';
        borderWidth = 3.0;
    }
    // Keep loser's border dark during lose effect
    if (loseColorsApplied && owner === playerNumber) {
         borderColor = '#555555';
         borderWidth = 1.0;
    }

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    ctx.stroke();
}

// Draw the main game board
function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!gameState || !gameState.board || Object.keys(gameState.board).length === 0) {
        ctx.fillStyle = '#FFA500';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        let initialMessage = "Connecting...";
        if (socket.connected) {
            initialMessage = isSpectator ? "Spectating..." : "Waiting for game state...";
        }
        ctx.fillText(initialMessage, canvas.width / 2, canvas.height / 2);
        return;
    }
    Object.values(gameState.board).forEach(hexData => {
        if (hexData && typeof hexData.q !== 'undefined' && typeof hexData.r !== 'undefined') {
            const isHovered = hoveredHexKey === `${hexData.q},${hexData.r}`;
            const isOwnedByCurrentPlayer = hexData.owner === playerNumber;
            drawHex(hexData, isOwnedByCurrentPlayer, isHovered);
        } else {
            console.error("DEBUG: drawBoard - Invalid hexData found:", hexData);
        }
    });
}

// --- Player Actions ---
function selectColor(color) {
    if (isSpectator || !gameState || !gameState.gameStarted || gameState.winner || gameState.turn !== playerNumber || isGameOver) return;
    console.log(`Sending move: ${color}`);
    socket.emit('playerMove', { color: color });
}

// --- Mouse Event Handling (disable during game over) ---
function handleMouseMove(event) {
    if (!gameState || !gameState.board || isSpectator || isGameOver) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const { q, r } = pixelToAxial(x, y);
    const { q: roundedQ, r: roundedR } = hexRound(q, r);
    const newKey = `${roundedQ},${roundedR}`;
    if (gameState.board[newKey]) {
        if (newKey !== hoveredHexKey) {
            hoveredHexKey = newKey;
            if (!isAnimatingPulse && !winAnimationId) drawBoard();
        }
    } else {
        if (hoveredHexKey !== null) {
            hoveredHexKey = null;
            if (!isAnimatingPulse && !winAnimationId) drawBoard();
        }
    }
}

function handleMouseOut(event) {
     if (isGameOver) return; // Ignore if game is over
    if (hoveredHexKey !== null) {
        hoveredHexKey = null;
        if (!isAnimatingPulse && !winAnimationId) drawBoard();
    }
}

// --- Hex Starfield Background Animation ---

function drawMiniHex(x, y, size, color) {
    bgCtx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle_deg = 60 * i + 30;
        const angle_rad = Math.PI / 180 * angle_deg;
        const cornerX = x + size * Math.cos(angle_rad);
        const cornerY = y + size * Math.sin(angle_rad);
        if (i === 0) bgCtx.moveTo(cornerX, cornerY);
        else bgCtx.lineTo(cornerX, cornerY);
    }
    bgCtx.closePath();
    bgCtx.fillStyle = color;
    bgCtx.fill();
}

function createHexStarfield() {
    hexStars = [];
    for (let i = 0; i < NUM_STARS; i++) {
        const speedFactor = Math.random() * 0.6 + 0.2;
        hexStars.push({
            x: Math.random() * bgCanvas.width,
            y: Math.random() * bgCanvas.height,
            size: Math.random() * 1.5 + 1,
            dx: (Math.random() - 0.5) * 0.5 * speedFactor,
            dy: (Math.random() * 0.5 + 0.1) * speedFactor,
            color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)]
        });
    }
    console.log(`Created ${hexStars.length} hex stars.`);
}

function animateHexStarfield(timestamp) {
    if (!bgCtx) return;
    if (lastStarTimestamp === 0) lastStarTimestamp = timestamp;
    const deltaTime = timestamp - lastStarTimestamp;
    lastStarTimestamp = timestamp;
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    hexStars.forEach(star => {
        star.x += star.dx * (deltaTime / 16.67);
        star.y += star.dy * (deltaTime / 16.67);
        if (star.x < -star.size) star.x = bgCanvas.width + star.size;
        else if (star.x > bgCanvas.width + star.size) star.x = -star.size;
        if (star.y < -star.size) star.y = bgCanvas.height + star.size;
        else if (star.y > bgCanvas.height + star.size) star.y = -star.size;
        drawMiniHex(star.x, star.y, star.size, star.color);
    });
    requestAnimationFrame(animateHexStarfield);
}

// --- Flood Fill Pulse Animation ---
function startFloodFillPulseAnimation(capturedHexes) {
    if (isAnimatingPulse || isGameOver) return; // Don't run during game over
    console.log(`Starting pulse animation for ${capturedHexes.length} hexes.`);
    isAnimatingPulse = true;
    pulseStartTime = performance.now();
    hexesToPulse = capturedHexes;
    requestAnimationFrame(animatePulseStep);
}

function animatePulseStep(timestamp) {
    if (!isAnimatingPulse) return;
    const elapsed = timestamp - pulseStartTime;
    const progress = Math.min(elapsed / PULSE_DURATION, 1);
    // Only draw board if win animation isn't also running
    if (!winAnimationId) drawBoard(); 
    const maxRadius = HEX_SIZE * 0.8;
    const currentRadius = maxRadius * progress;
    const alpha = 1.0 - progress;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    hexesToPulse.forEach(hexCoords => {
        const center = axialToPixel(hexCoords.q, hexCoords.r);
        ctx.beginPath();
        ctx.arc(center.x, center.y, currentRadius, 0, Math.PI * 2);
        ctx.fill();
    });
    if (progress < 1) {
        requestAnimationFrame(animatePulseStep);
    } else {
        console.log("Pulse animation finished.");
        isAnimatingPulse = false;
        hexesToPulse = [];
        // Final redraw only if win animation isn't running
        if (!winAnimationId) drawBoard(); 
    }
}

// --- Win/Lose Effect Functions (NEW) ---

function applyLoseEffect() {
    console.log("Applying lose effect.");
    loseColorsApplied = true;
    // No need to modify gameState directly, drawHex will handle it
    drawBoard(); // Redraw once with loser colors
}

function startWinAnimationLoop() {
    if (winAnimationId) cancelAnimationFrame(winAnimationId); // Clear previous if any
    console.log("Starting win animation.");
    winAnimationStartTime = performance.now();
    winAnimationId = requestAnimationFrame(winAnimationStep);
}

function winAnimationStep(timestamp) {
    if (!isGameOver || !isWinner) { // Stop if game reset or state is wrong
        if (winAnimationId) cancelAnimationFrame(winAnimationId);
        winAnimationId = null;
        drawBoard(); // Ensure final clean draw
        return;
    }

    const elapsed = timestamp - winAnimationStartTime;
    const progress = elapsed / WIN_ANIMATION_DURATION;

    if (progress >= 1) {
        winAnimationId = null; // Animation finished
        drawBoard(); // Draw final state
        console.log("Win animation finished.");
        return;
    }

    // Draw the base board state first
    drawBoard();

    // --- Draw Celebration Effect --- 
    // Example: Pulsating glow around winner's hexes
    const pulseCycle = 1000; // Duration of one pulse cycle in ms
    const pulseProgress = (elapsed % pulseCycle) / pulseCycle; // 0 to 1 over cycle duration
    const glowAlpha = 0.3 + Math.sin(pulseProgress * Math.PI) * 0.4; // 0.3 to 0.7 alpha sine wave
    const glowRadius = HEX_SIZE * (1.0 + Math.sin(pulseProgress * Math.PI) * 0.3); // 1.0x to 1.3x size

    ctx.strokeStyle = `rgba(255, 215, 0, ${glowAlpha})`; // Pulsing gold glow (Gold: #FFD700)
    ctx.lineWidth = 3 + Math.sin(pulseProgress * Math.PI) * 2; // Line width pulses 3 to 5

    Object.values(gameState.board).forEach(hexData => {
        if (hexData.owner === playerNumber) { // Only for winner's hexes
            const center = axialToPixel(hexData.q, hexData.r);
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                // Use hexCorner helper for consistency
                const corner = hexCorner(center, glowRadius, i);
                if (i === 0) ctx.moveTo(corner.x, corner.y);
                else ctx.lineTo(corner.x, corner.y);
            }
            ctx.closePath();
            ctx.stroke();
        }
    });
    // --- End Celebration Effect ---

    // Request next frame
    winAnimationId = requestAnimationFrame(winAnimationStep);
}


// --- Initialization ---
function init() {
    console.log("Initializing client...");

    // Setup info-bar structure
    infoBarDiv.innerHTML = `
        <div id="player1-info" class="player-info">
            Player 1: <span class="score" id="player1-score">0</span> <span class="player-id"></span>
        </div>
        <div id="player2-info" class="player-info">
            Player 2: <span class="score" id="player2-score">0</span> <span class="player-id"></span>
        </div>
    `;
    player1InfoDiv = document.getElementById('player1-info');
    player2InfoDiv = document.getElementById('player2-info');
    player1ScoreSpan = document.getElementById('player1-score');
    player2ScoreSpan = document.getElementById('player2-score');

    // Add event listeners
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseout', handleMouseOut);

    displayGameStatus("Connecting...");
    updateColorButtons();
    drawBoard();

    // Create and start hex starfield animation
    createHexStarfield();
    lastStarTimestamp = 0;
    requestAnimationFrame(animateHexStarfield);

}

init();
