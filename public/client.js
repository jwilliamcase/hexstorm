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
const STAR_COLORS = [
    'rgba(255, 50, 50, 0.7)',  // Brighter Red
    'rgba(100, 100, 255, 0.6)', // Brighter Blue
    'rgba(200, 0, 0, 0.5)',    // Darker Red
    'rgba(50, 50, 200, 0.4)'     // Darker Blue
];
let lastStarTimestamp = 0;
const MIN_STAR_SIZE = 0.5;
const MAX_STAR_SIZE = 1.5;
const STAR_GROWTH_RATE = 0.005; // How fast stars grow per frame (adjust as needed)

// --- Capture Wave Animation State ---
let isAnimatingWave = false;
let waveAnimationId = null;
let waveStartTime = 0;
const WAVE_ANIMATION_DURATION = 1000; // ms - Faster duration
const WAVE_WIDTH = 2.5; // How many hex distances the wave effect covers
const WAVE_MAX_SCALE = 1.15; // Max size increase (1.0 = normal)
const WAVE_MAX_SHADOW_BLUR = 10;
const WAVE_MAX_SHADOW_ALPHA = 0.6;
let waveHexData = []; // Stores {q, r, distance} for owned hexes
let maxWaveDistance = 0;

// --- Win/Lose Animation State ---
let isGameOver = false;
let isWinner = null; // true, false, or null
let winAnimationId = null;
let winAnimationStartTime = 0;
const WIN_ANIMATION_DURATION = 4000; // ms
let loseColorsApplied = false;
const LOSE_COLOR = '#8B4513';
const LOSE_COLOR_ALT = '#A0522D';

// --- Emoji Confetti State ---
const WIN_EMOJIS = ['🦄', '🌈', '⭐', '✨', '🎉'];
const LOSE_EMOJIS = ['💩', '🧛', '💀', '👻', '💩']; // Replaced thumbs down
const EMOJI_SCALAR = 6; // Controls emoji size

// --- Constants ---
const AVAILABLE_COLORS = ['#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#FFD700', '#8A2BE2'];
const HEX_SIZE = 20;
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 550;
const ORIGIN_X = CANVAS_WIDTH / 2;
const ORIGIN_Y = CANVAS_HEIGHT / 2;
// Axial directions (q, r) for neighbors - used in BFS
const AXIAL_DIRECTIONS = [
    { q: +1, r: 0 }, { q: +1, r: -1 }, { q: 0, r: -1 },
    { q: -1, r: 0 }, { q: -1, r: +1 }, { q: 0, r: +1 }
];

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
    const wasGameOver = isGameOver;
    previousGameState = gameState;
    gameState = newState;

    let captureOccurred = false;
    let capturingPlayer = null;
    // Check if a capture just happened (score increased for the player who moved)
    if (!isGameOver && previousGameState && previousGameState.turn && 
        gameState.players[previousGameState.turn] && previousGameState.players[previousGameState.turn] &&
        gameState.players[previousGameState.turn].score > previousGameState.players[previousGameState.turn].score) {
        captureOccurred = true;
        capturingPlayer = previousGameState.turn;
    }

    // --- Handle Game Over Start/End --- 
    if (!previousGameState?.winner && newState.winner) {
        console.log(`Game Over. Winner: ${newState.winner}`);
        isGameOver = true;
        isWinner = (newState.winner === playerNumber);
        loseColorsApplied = false;
        if (winAnimationId) cancelAnimationFrame(winAnimationId);
        if (waveAnimationId) cancelAnimationFrame(waveAnimationId); // Stop wave anim if game ends
        waveAnimationId = null;
        isAnimatingWave = false;

        if (!isSpectator) {
            if (isWinner) {
                startWinAnimationLoop();
                triggerWinConfetti(); // Trigger win confetti
            } else {
                // Trigger confetti BEFORE applying visual effect
                triggerLoseConfetti(); 
                applyLoseEffect();
            }
        }
    } else if (previousGameState?.winner && !newState.winner) {
        console.log("Game reset.");
        isGameOver = false;
        isWinner = null;
        loseColorsApplied = false;
        if (winAnimationId) cancelAnimationFrame(winAnimationId);
        winAnimationId = null;
        isAnimatingWave = false;
        waveAnimationId = null;
    }
    // --- End Handle Game Over ---

    updateUI(); // Update scores, status messages, buttons
    
    // --- Trigger Capture Wave Animation --- 
    if (captureOccurred && !isGameOver && !isAnimatingWave) {
        // Start wave animation for the player who captured, visible to all
        startWaveAnimation(capturingPlayer);
    }
    // --- End Trigger Capture Wave --- 

    // Draw board only if no animations are running
    if (!isAnimatingWave && !winAnimationId) {
        drawBoard(); 
    }
});

socket.on('gameError', (error) => {
    console.error('Game Error:', error.message);
    displayGameStatus(`Error: ${error.message}`);
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    // Reset all state
    gameState = null;
    previousGameState = null;
    playerNumber = null;
    isSpectator = false;
    hoveredHexKey = null;
    isGameOver = false;
    isWinner = null;
    loseColorsApplied = false;
    if (winAnimationId) cancelAnimationFrame(winAnimationId);
    winAnimationId = null;
    if (waveAnimationId) cancelAnimationFrame(waveAnimationId);
    waveAnimationId = null;
    isAnimatingWave = false;
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
    // Buttons only available during active play (not animating, not game over, player's turn)
    if (isSpectator || !gameState || !gameState.gameStarted || gameState.winner || gameState.turn !== playerNumber || isGameOver || isAnimatingWave) {
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
        button.disabled = false;
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
    // Active player highlight only if game is running and not animating wave
    player1InfoDiv.classList.toggle('active-player', gameState.gameStarted && !gameState.winner && gameState.turn === 'player1' && !isGameOver && !isAnimatingWave);
    player2InfoDiv.classList.toggle('active-player', gameState.gameStarted && !gameState.winner && gameState.turn === 'player2' && !isGameOver && !isAnimatingWave);
    const p1IdSpan = player1InfoDiv.querySelector('.player-id');
    const p2IdSpan = player2InfoDiv.querySelector('.player-id');
    p1IdSpan.textContent = (playerNumber === 'player1') ? '(You)' : '';
    p2IdSpan.textContent = (playerNumber === 'player2') ? '(You)' : '';
    
    updateColorButtons(); // Update buttons based on turn and colors

    // --- Update Game Status Message --- 
    if (isSpectator) {
        displayGameStatus(isGameOver ? `${gameState.winner} wins!` : (isAnimatingWave ? "Capturing..." : "Spectating game."));
    }
    else if (gameStatusDiv && gameStatusDiv.textContent.startsWith('Error:')) {
        // Keep existing error message
    } 
    else if (isGameOver) {
        displayGameStatus(isWinner ? "You Win!" : "You Lose.");
    } 
    else if (isAnimatingWave) {
        displayGameStatus("Capturing..."); // Show status during wave animation
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
    // Player 2 view rotation is handled here for drawing
    let drawQ = q, drawR = r;
    if (playerNumber === 'player2') { drawQ = -q; drawR = -r; }
    const x = HEX_SIZE * (Math.sqrt(3) * drawQ + Math.sqrt(3) / 2 * drawR) + ORIGIN_X;
    const y = HEX_SIZE * (3. / 2 * drawR) + ORIGIN_Y;
    return { x, y };
}

function pixelToAxial(x, y) {
    // Player 2 view rotation is handled here for input/hover
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

// Draw a single GAME hexagon - Modified to be callable with custom size/color for animations
function drawHexShape(center, size, color, borderColor = '#333333', borderWidth = 1, shadow = null) {
    ctx.save();
    if (shadow) {
        ctx.shadowColor = shadow.color;
        ctx.shadowBlur = shadow.blur;
        ctx.shadowOffsetX = shadow.offsetX;
        ctx.shadowOffsetY = shadow.offsetY;
    }
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const corner = hexCorner(center, size, i);
        if (i === 0) ctx.moveTo(corner.x, corner.y);
        else ctx.lineTo(corner.x, corner.y);
    }
    ctx.closePath();
    ctx.fillStyle = color || '#CCCCCC';
    ctx.fill();
    if (borderWidth > 0) {
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = borderWidth;
        ctx.stroke();
    }
    ctx.restore();
}

// Original drawHex function - now uses drawHexShape
function drawHex(hexData, isOwnedByCurrentPlayer, isHovered) {
    const { q, r, owner } = hexData;
    let displayColor = hexData.color;
    let borderColor = '#333333';
    let borderWidth = owner ? 2 : 1;

    // Apply lose effect if applicable (even if not owned by current player)
    if (loseColorsApplied && owner === (isWinner ? (playerNumber === 'player1' ? 'player2' : 'player1') : playerNumber)) {
        displayColor = (q % 2 === r % 2) ? LOSE_COLOR : LOSE_COLOR_ALT;
        borderColor = '#555555';
        borderWidth = 1.0;
    }
    else if (isOwnedByCurrentPlayer) {
        borderColor = '#FFFFFF'; // Highlight for the local player
        borderWidth = 3.0;
    }

    const center = axialToPixel(q, r);
    // Hover effect disabled during animations or if hex not owned by local player
    const applyHoverEffect = isHovered && isOwnedByCurrentPlayer && !isSpectator && !isGameOver && !isAnimatingWave && !winAnimationId;
    let shadow = null;
    if (applyHoverEffect) {
        shadow = { color: 'rgba(255, 255, 255, 0.7)', blur: 10, offsetX: 0, offsetY: 0 };
    }

    drawHexShape(center, HEX_SIZE, displayColor, borderColor, borderWidth, shadow);
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
    // Always draw all hexes in their base state
    Object.values(gameState.board).forEach(hexData => {
        if (hexData && typeof hexData.q !== 'undefined' && typeof hexData.r !== 'undefined') {
            const isHovered = hoveredHexKey === `${hexData.q},${hexData.r}`;
            const isOwnedByCurrentPlayer = hexData.owner === playerNumber; // Check if owned by the *local* player
            drawHex(hexData, isOwnedByCurrentPlayer, isHovered);
        } else {
            console.error("DEBUG: drawBoard - Invalid hexData found:", hexData);
        }
    });
}

// --- Player Actions ---
function selectColor(color) {
    // Disable actions during animations or game over
    if (isSpectator || !gameState || !gameState.gameStarted || gameState.winner || gameState.turn !== playerNumber || isGameOver || isAnimatingWave) return;
    console.log(`Sending move: ${color}`);
    socket.emit('playerMove', { color: color });
}

// --- Mouse Event Handling (disable during animations/game over) ---
function handleMouseMove(event) {
    if (!gameState || !gameState.board || isSpectator || isGameOver || isAnimatingWave || winAnimationId) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const { q, r } = pixelToAxial(x, y);
    const { q: roundedQ, r: roundedR } = hexRound(q, r);
    const newKey = `${roundedQ},${roundedR}`;
    if (gameState.board[newKey]) {
        if (newKey !== hoveredHexKey) {
            hoveredHexKey = newKey;
            drawBoard(); // Redraw needed only if not animating
        }
    } else {
        if (hoveredHexKey !== null) {
            hoveredHexKey = null;
            drawBoard(); 
        }
    }
}

function handleMouseOut(event) {
     if (isGameOver || isAnimatingWave || winAnimationId) return; 
    if (hoveredHexKey !== null) {
        hoveredHexKey = null;
        drawBoard();
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

// Function to reset a star's properties
function resetStar(star) {
    star.size = MIN_STAR_SIZE + Math.random() * (MAX_STAR_SIZE - MIN_STAR_SIZE);
    star.x = Math.random() * bgCanvas.width;
    star.y = Math.random() * bgCanvas.height;
    const speed = (Math.random() * 0.4 + 0.1) * (star.size / MAX_STAR_SIZE); // Speed slightly tied to size
    star.dx = (Math.random() - 0.5) * 0.8 * speed; // Adjusted base speed
    star.dy = (Math.random() - 0.5) * 0.8 * speed;
    star.color = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];
    star.growthRate = STAR_GROWTH_RATE * (1 + Math.random() * 0.5); // Slightly variable growth
}

function createHexStarfield() {
    hexStars = [];
    for (let i = 0; i < NUM_STARS; i++) {
        const star = {};
        resetStar(star); // Initialize star with reset logic
        hexStars.push(star);
    }
    console.log(`Created ${hexStars.length} hex stars with growth.`);
}

function animateHexStarfield(timestamp) {
    if (!bgCtx) return;
    if (lastStarTimestamp === 0) lastStarTimestamp = timestamp;
    const deltaTime = timestamp - lastStarTimestamp;
    lastStarTimestamp = timestamp;
    const dtFactor = deltaTime / 16.67; // Normalize speed/growth to ~60fps

    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);

    hexStars.forEach(star => {
        // Grow the star
        star.size += star.growthRate * dtFactor;

        // Move the star
        star.x += star.dx * dtFactor;
        star.y += star.dy * dtFactor;

        // Check if star is completely off-screen
        const isOffScreen = 
            star.x < -star.size || 
            star.x > bgCanvas.width + star.size ||
            star.y < -star.size ||
            star.y > bgCanvas.height + star.size;

        if (isOffScreen) {
            // Reset star if it goes off bounds
            resetStar(star);
        } else {
            // Draw the star if it's on screen
            drawMiniHex(star.x, star.y, star.size, star.color);
        }
    });

    requestAnimationFrame(animateHexStarfield);
}

// --- Capture Wave Animation Functions ---

// Helper to get neighbor coordinates
function getNeighborCoords(q, r) {
    return AXIAL_DIRECTIONS.map(dir => ({ q: q + dir.q, r: r + dir.r }));
}

// Modified to accept capturingPlayerNumber
function startWaveAnimation(capturingPlayerNumber) {
    if (!gameState || !capturingPlayerNumber) return; // Need game state and the player who captured

    console.log(`Starting capture wave animation for ${capturingPlayerNumber}.`);
    isAnimatingWave = true;
    waveHexData = [];
    maxWaveDistance = 0;

    const playerState = gameState.players[capturingPlayerNumber];
    if (!playerState || !playerState.startHex) {
        console.error(`Cannot start wave: Player state or start hex missing for ${capturingPlayerNumber}.`);
        isAnimatingWave = false;
        return;
    }

    // BFS to calculate distances from start hex through owned territory of the capturing player
    const startCoordsArr = playerState.startHex.split(',').map(Number);
    const startQ = startCoordsArr[0];
    const startR = startCoordsArr[1];

    const queue = [{ q: startQ, r: startR, distance: 0 }];
    const visited = new Set([playerState.startHex]);
    waveHexData.push({ q: startQ, r: startR, distance: 0 });

    let head = 0;
    while (head < queue.length) {
        const { q, r, distance } = queue[head++];
        maxWaveDistance = Math.max(maxWaveDistance, distance);

        const neighbors = getNeighborCoords(q, r);
        for (const neighbor of neighbors) {
            const neighborKey = `${neighbor.q},${neighbor.r}`;
            // Check if neighbor exists, is owned by the *capturing* player, and not visited
            if (gameState.board[neighborKey] && gameState.board[neighborKey].owner === capturingPlayerNumber && !visited.has(neighborKey)) {
                visited.add(neighborKey);
                const neighborData = { q: neighbor.q, r: neighbor.r, distance: distance + 1 };
                waveHexData.push(neighborData);
                queue.push(neighborData);
            }
        }
    }

    if (waveHexData.length <= 1) { // Only start hex? Don't animate.
        console.log(`No territory to animate wave over for ${capturingPlayerNumber}.`);
        isAnimatingWave = false;
        drawBoard();
        return;
    }

    waveStartTime = performance.now();
    if (waveAnimationId) cancelAnimationFrame(waveAnimationId);
    waveAnimationId = requestAnimationFrame(waveAnimationStep);
    updateUI(); // Update status to "Capturing..."
}

function waveAnimationStep(timestamp) {
    if (!isAnimatingWave) { // Stop if flag is cleared
        waveAnimationId = null;
        return;
    }

    const elapsed = timestamp - waveStartTime;
    const progress = Math.min(elapsed / WAVE_ANIMATION_DURATION, 1);

    // Calculate the leading edge distance of the wave
    const currentMaxDistanceReached = progress * (maxWaveDistance + WAVE_WIDTH); // Add width to ensure wave travels off the edge

    // Draw the base board state first (now draws all hexes)
    drawBoard(); 

    // --- Draw Wave Effect On Top --- 
    waveHexData.forEach(hex => {
        const { q, r, distance } = hex;
        const diff = currentMaxDistanceReached - distance;

        // Check if the hex is within the current wave band
        if (diff >= 0 && diff < WAVE_WIDTH) {
            // Calculate intensity (0 to 1, peaks in middle of wave band)
            const wavePosition = diff / WAVE_WIDTH; // 0 (leading edge) to 1 (trailing edge)
            const intensity = Math.sin(wavePosition * Math.PI); // Simple sine pulse (0 -> 1 -> 0)
            
            const scaleFactor = 1 + (WAVE_MAX_SCALE - 1) * intensity;
            const shadowBlur = WAVE_MAX_SHADOW_BLUR * intensity;
            const shadowAlpha = WAVE_MAX_SHADOW_ALPHA * intensity;
            const shadowOffsetX = 2 * intensity;
            const shadowOffsetY = 3 * intensity;

            const center = axialToPixel(q, r);
            const color = gameState.board[`${q},${r}`]?.color || '#CCCCCC'; // Get current color
            const shadow = {
                color: `rgba(0, 0, 0, ${shadowAlpha})`,
                blur: shadowBlur,
                offsetX: shadowOffsetX,
                offsetY: shadowOffsetY
            };

            // Draw the affected hex again, on top, with effects
            drawHexShape(center, HEX_SIZE * scaleFactor, color, '#444444', 1.5, shadow);
        }
    });
    // --- End Wave Effect ---

    // Continue animation?
    if (progress < 1) {
        waveAnimationId = requestAnimationFrame(waveAnimationStep);
    } else {
        console.log("Wave animation finished.");
        isAnimatingWave = false;
        waveAnimationId = null;
        waveHexData = [];
        updateUI(); // Update status back to turn info
        drawBoard(); // Final clean draw
    }
}

// --- Win/Lose Effect Functions ---

function applyLoseEffect() {
    console.log("Applying lose effect.");
    loseColorsApplied = true;
    drawBoard(); 
}

function startWinAnimationLoop() {
    if (winAnimationId) cancelAnimationFrame(winAnimationId);
    console.log("Starting win animation.");
    winAnimationStartTime = performance.now();
    winAnimationId = requestAnimationFrame(winAnimationStep);
}

function winAnimationStep(timestamp) {
    if (!isGameOver || !isWinner) {
        if (winAnimationId) cancelAnimationFrame(winAnimationId);
        winAnimationId = null;
        drawBoard();
        return;
    }

    const elapsed = timestamp - winAnimationStartTime;
    const progress = elapsed / WIN_ANIMATION_DURATION;

    if (progress >= 1) {
        winAnimationId = null;
        drawBoard(); 
        console.log("Win animation finished.");
        return;
    }

    drawBoard();

    const pulseCycle = 1000;
    const pulseProgress = (elapsed % pulseCycle) / pulseCycle;
    const glowAlpha = 0.3 + Math.sin(pulseProgress * Math.PI) * 0.4;
    const glowRadius = HEX_SIZE * (1.0 + Math.sin(pulseProgress * Math.PI) * 0.3);
    const lineWidth = 3 + Math.sin(pulseProgress * Math.PI) * 2;

    ctx.strokeStyle = `rgba(255, 215, 0, ${glowAlpha})`;
    ctx.lineWidth = lineWidth;

    // Animate only the local winner's hexes
    Object.values(gameState.board).forEach(hexData => {
        if (hexData.owner === playerNumber) { // Only for local winner
            const center = axialToPixel(hexData.q, hexData.r);
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const corner = hexCorner(center, glowRadius, i);
                if (i === 0) ctx.moveTo(corner.x, corner.y);
                else ctx.lineTo(corner.x, corner.y);
            }
            ctx.closePath();
            ctx.stroke();
        }
    });

    winAnimationId = requestAnimationFrame(winAnimationStep);
}

// --- Emoji Confetti Functions ---
function triggerWinConfetti() {
    if (typeof confetti !== 'function') {
        console.warn("Confetti library not loaded.");
        return;
    }
    console.log("Triggering WIN confetti");

    const emojiShapes = WIN_EMOJIS.map(text => confetti.shapeFromText({ text, scalar: EMOJI_SCALAR }));

    const defaults = {
        spread: 360,
        ticks: 70, 
        gravity: 0.2,
        decay: 0.94,
        startVelocity: 35,
        shapes: emojiShapes,
        scalar: EMOJI_SCALAR 
    };

    // Fire multiple bursts for a more impactful effect
    function shootBurst() {
        confetti({
            ...defaults,
            particleCount: 35, // Reduced particles
            origin: { x: Math.random(), y: Math.random() * 0.5 } // Random origin near top
        });
    }

    setTimeout(shootBurst, 0);
    setTimeout(shootBurst, 150);
    setTimeout(shootBurst, 300); // Reduced to 3 bursts
}

function triggerLoseConfetti() {
    if (typeof confetti !== 'function') {
        console.warn("Confetti library not loaded.");
        return;
    }
    console.log("Triggering negative outcome confetti (slime)");

    const emojiShapes = LOSE_EMOJIS.map(text => confetti.shapeFromText({ text, scalar: EMOJI_SCALAR }));

    const defaults = {
        angle: 270, // Force downwards
        spread: 70, // Narrower spread
        ticks: 600, // Longer duration
        gravity: 0.6, 
        decay: 0.92, // Reduced decay
        startVelocity: 30, // Slightly faster start
        shapes: emojiShapes,
        scalar: EMOJI_SCALAR,
        origin: { x: 0.5, y: 0 } // Start from top center
    };

    // Fire one larger burst immediately
    confetti({
        ...defaults,
        particleCount: 50, 
    });
}


// --- Initialization ---
function init() {
    console.log("Initializing client...");

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

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseout', handleMouseOut);

    displayGameStatus("Connecting...");
    updateColorButtons();
    drawBoard();

    createHexStarfield();
    lastStarTimestamp = 0;
    requestAnimationFrame(animateHexStarfield);

}

init();
