# HexStorm

A real-time two-player territory capture game played on a hexagonal board. Players compete to control the board by strategically selecting colors to flood-fill their territory, expanding from their starting corner.

## Game Specification

*   **Board:** A hexagonal grid of a defined size (currently **7-radius** hex).
*   **Players:** Two players, Player 1 and Player 2. Spectators can also join.
*   **Starting Positions:** Player 1 starts controlling the bottom-left corner hex. Player 2 starts controlling the top-right corner hex.
*   **Starting Turn:** The game waits for both players to connect. The starting player is then **randomly chosen**.
*   **Objective:** Control more than half of the hexes on the board.
*   **Gameplay:**
    *   Players take turns selecting a color from the available options.
    *   The selected color cannot be the player's current territory color or the opponent's current territory color.
    *   When a color is selected, all hexes adjacent to the player's current territory that match the *selected* color are captured and become part of the player's territory (flood fill). The player's entire territory then changes to the selected color.
    *   The game continues until one player controls more than half the hexes.
*   **Colors:** A predefined set of 6 distinct colors are used for the hexes and player moves.

## Tech Stack

*   **Backend:** Node.js, Express, Socket.IO
*   **Frontend:** HTML, CSS, JavaScript (Canvas API), Socket.IO Client, canvas-confetti

## Current Status (April 5, 2024 - Update)

*   **Core Gameplay:** Implemented and functional. Players can connect, take turns, select colors, and capture territory via flood fill.
*   **Real-time Sync:** Game state is synchronized between server and clients using Socket.IO.
*   **Win Condition:** Game correctly detects when a player controls > 50% of the hexes and declares a winner.
*   **Game Reset:** The game automatically resets a few seconds after a winner is declared.
*   **Player Assignment:** Server assigns players as Player 1, Player 2, or Spectator upon connection.
*   **Random Start:** Server waits for both players and randomly assigns the first turn.
*   **Board Size:** Increased board radius from 6 to **7**.
*   **UI:**
    *   Canvas rendering of the hex board.
    *   Info bar above canvas displays player scores and highlights the active player.
    *   Color selection buttons below canvas are dynamically enabled/disabled based on game state and rules.
    *   Implemented a "dark mode" theme with black background and orange UI elements.
    *   Player 2's view is rotated 180 degrees so their starting corner appears in the lower-left on their screen.
    *   Hexes owned by the current player have a persistent white border for better visibility.
*   **Visual Effects:**
    *   Dynamic canvas-based hex starfield background with **red/blue colors, parallax, multi-directional movement, and star growth**.
    *   Added win/lose effects: Winner's territory glows, loser's territory desaturates to brown/grey. **Winner gets celebratory emoji confetti burst, loser gets 'slime down' emoji confetti effect.**
    *   Implemented a capture "wave" animation: Effect emanates from the start hex through owned territory upon capture.
*   **Debugging:** Added console logs for troubleshooting state updates and rendering.
*   **Development:** Added `nodemon` for automatic server restarts during local development (`npm run dev`).

## How to Run Locally

1.  Navigate to the `gemini/hexstorm` directory.
2.  Install dependencies (including `nodemon` for development):
    ```bash
    npm install
    ```
3.  Start the development server (automatically restarts on file changes):
    ```bash
    npm run dev
    ```
4.  Open two browser tabs/windows to `http://localhost:3000`. The first tab will be Player 1, the second Player 2. Subsequent tabs will be spectators.

## Deployment to Render.com (Free Tier)

Render.com can host Node.js web services. Here's a basic guide:

1.  **Prerequisites:**
    *   A GitHub account.
    *   Your HexStorm project pushed to a GitHub repository.
    *   A Render.com account.
2.  **Prepare your Repository:**
    *   Ensure your `package.json` has the necessary dependencies (`express`, `socket.io`).
    *   Make sure `package.json` includes a `start` script:
        ```json
        "scripts": {
          "start": "node server.js",
          "dev": "nodemon server.js"
          // other scripts...
        },
        ```
    *   Ensure your `server.js` uses `process.env.PORT` for the port number, falling back to a default (e.g., 3000) for local development:
        ```javascript
        const PORT = process.env.PORT || 3000;
        server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
        ```
    *   Commit and push these changes to GitHub.
3.  **Create a Render Web Service:**
    *   Log in to Render.
    *   Click "New +" -> "Web Service".
    *   Connect your GitHub account if you haven't already.
    *   Select your HexStorm repository.
    *   Configure the service:
        *   **Name:** Choose a unique name (e.g., `hexstorm-game`).
        *   **Region:** Choose a region close to you.
        *   **Branch:** Select the branch to deploy (e.g., `main`).
        *   **Root Directory:** Leave blank if `package.json` is in the root, otherwise specify the path (e.g., `gemini/hexstorm` if your repo root is the parent directory). **Important:** Based on your setup, this might need to be `gemini/hexstorm`. Double-check where `package.json` is relative to the repo root.
        *   **Runtime:** Select `Node`.
        *   **Build Command:** `npm install` (This installs both production and dev dependencies by default on Render, but `nodemon` won't be used by the start command).
        *   **Start Command:** `npm start` (This uses the `start` script defined in `package.json`).
        *   **Plan:** Select the "Free" tier. Note free tier services spin down after inactivity and may take a moment to start on the first request.
4.  **Deploy:**
    *   Click "Create Web Service".
    *   Render will clone your repository, run the build command, and then the start command. Monitor the deploy logs.
5.  **Access:**
    *   Once deployed, Render provides a URL like `https://your-service-name.onrender.com`. Use this URL to access your game online.

## TODO / Future Enhancements

### Core Gameplay & Mechanics
*   **Comeback/Powerup Mechanic:** Introduce elements to help a losing player or add strategic depth (e.g., temporary score boost, extra turn, color wildcard, neutral hex capture).
*   **AI Opponent:** Implement a computer opponent (simple greedy AI or more advanced).
*   **Different Game Modes:** Add variations like limited turns, score-based victory, etc.
*   **Special Hex Types:** Introduce hexes with unique properties (e.g., obstacles, bonus points, warp zones).

### Multi-Room & Scalability
*   **Goal:** Allow multiple independent games to run concurrently, enabling players to join specific games or be matched.
*   **Server-Side Changes:**
    *   **Room Management:** Implement logic to create, track, and destroy game rooms. Each room needs its own `gameState`.
    *   **Player-Room Mapping:** Associate connected sockets (players) with specific room IDs.
    *   **Socket.IO Rooms:** Utilize Socket.IO's room feature (`socket.join(roomId)`, `io.to(roomId).emit(...)`) to broadcast events only to players within the same game.
    *   **Game State Isolation:** Ensure game logic (moves, win checks, resets) operates strictly within the context of a single room's state.
    *   **Matchmaking (Optional):** Implement a simple lobby or queue system for players looking for opponents.
*   **Client-Side Changes:**
    *   **UI for Joining/Creating:** Add UI elements for players to see available games, create new ones, or join a queue.
    *   **Room Communication:** Client needs to inform the server which room it wants to join or if it wants to create one.
    *   **Event Handling:** Ensure client handles events targeted at its specific room.

### Stability & User Experience
*   **Disconnection Handling:**
    *   **Detection:** Reliably detect when a player disconnects mid-game.
    *   **Game State:** Decide game outcome (e.g., opponent wins by forfeit, game pauses allowing reconnection for a short period, game ends gracefully).
    *   **UI Feedback:** Clearly inform the remaining player(s) about the disconnection and game status.
    *   **Cleanup:** Ensure disconnected player resources are cleaned up on the server (remove from room, potentially reset game if needed).
*   **Spectator Chat:** Allow spectators to chat without interfering with players.
*   **Visual Feedback:** Add cues for invalid moves (e.g., shaking button, message).
*   **Mobile Responsiveness:** Improve layout and controls for smaller screens.

### Configurability & Persistence
*   **Board Size Selection:** Allow players to choose the game board radius.
*   **Color Palette Selection:** Offer different visual themes or color sets.
*   **User Accounts:** Basic accounts to track stats.
*   **Leaderboards/Rankings:** Simple ranking system.
*   **Game History/Replays:** Store past game data.

### Technical Debt & Refinement
*   **Automated Tests:** Add unit and integration tests.
*   **Error Handling:** Implement more robust error handling and logging (client/server).
*   **Code Quality:** Enforce linting/formatting; refactor magic numbers/strings into constants; organize CSS.
*   **Optimizations:** Reduce canvas redraws; optimize server logic; potentially add client state management if complexity increases.

## Sound Effects Wishlist

To enhance the game's atmosphere and provide auditory feedback, the following sound effects are desired. Short, non-intrusive sounds are generally preferred for frequent actions.

**Recommended Formats:** `.mp3` (widely supported) and `.ogg` (good quality/compression, open format). Provide both for best browser compatibility. `.wav` can be used as the source/master format before encoding.

**Sound List:**

*   **Game Start:** A brief, positive notification sound when the second player connects and the game begins. (Duration: ~1-1.5s)
*   **Turn Change:** A subtle chime or notification indicating it's now the local player's turn. (Duration: ~0.5s)
*   **Color Select (Valid):** A satisfying click or 'pop' when a valid color button is pressed. (Duration: ~0.2-0.4s)
*   **Color Select (Invalid):** A soft 'buzz' or 'thud' if the player clicks an invalid color button (their own color, opponent's color, or during opponent's turn). (Duration: ~0.3-0.5s)
*   **Hex Capture:** A subtle 'sweep' or 'bubble' sound effect accompanying the capture wave animation, perhaps scaling slightly in pitch or intensity based on the number of hexes captured. (Duration: ~0.5-1s, matching wave animation)
*   **Territory Grow (Subtle):** A very low-level, ambient hum or shimmer while the capture wave animation is active. (Duration: Matches wave animation)
*   **Game Win:** An upbeat, celebratory fanfare or jingle. (Duration: ~2-4s)
*   **Game Lose:** A downbeat, slightly melancholic sound or brief 'deflating' effect. (Duration: ~2-3s)
*   **Player Connect:** A simple 'blip' or 'join' sound when a player (or spectator) connects. (Optional, could be annoying if many spectators join/leave). (Duration: ~0.5s)
*   **Player Disconnect:** A 'dropout' or 'leave' sound when an opponent disconnects mid-game. (Duration: ~0.5-1s)
*   **UI Hover (Optional):** A very subtle tick or highlight sound when hovering over interactive elements (like color buttons). (Duration: ~0.1-0.2s)
