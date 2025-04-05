# HexStorm

A real-time two-player territory capture game played on a hexagonal board. Players compete to control the board by strategically selecting colors to flood-fill their territory, expanding from their starting corner.

## Game Specification

*   **Board:** A hexagonal grid of a defined size (currently **7-radius** hex).
*   **Players:** Two players, Player 1 and Player 2.
*   **Starting Positions:** Player 1 starts controlling the bottom-left corner hex. Player 2 starts controlling the top-right corner hex.
*   **Starting Turn:** The game waits for both players to connect. The starting player is then **randomly chosen**.
*   **Objective:** Control more than half of the hexes on the board.
*   **Gameplay:**
    *   Players take turns selecting a color from the available options.
    *   The selected color cannot be the player's current territory color or the opponent's current territory color.
    *   When a color is selected, all hexes adjacent to the player's current territory that match the *selected* color are captured and become part of the player's territory (flood fill). The player's entire territory then changes to the selected color.
    *   The game continues until one player controls more than half the hexes.
*   **Colors:** A predefined set of distinct colors are used for the hexes and player moves (currently 6 colors).

## Tech Stack

*   **Backend:** Node.js, Express, Socket.IO
*   **Frontend:** HTML, CSS, JavaScript (Canvas API), Socket.IO Client

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
    *   Replaced static background with a dynamic canvas-based hex starfield animation.
    *   Added win/lose effects: Winner's territory glows, loser's territory desaturates to brown/grey.
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

## Future Features & Ideas

*   **Configurability:**
    *   Allow selection of board size (radius).
    *   Allow selection of color palettes.
*   **Gameplay Enhancements:**
    *   AI opponent (simple greedy AI or more advanced).
    *   Different game modes (e.g., limited turns, score-based victory).
    *   Special hex types (e.g., obstacles, bonus points).
*   **UI/UX:**
    *   Visual feedback for invalid moves (e.g., shaking the button).
    *   Mobile responsiveness improvements.
    *   Spectator chat.
*   **Persistence:**
    *   User accounts.
    *   Leaderboards/Rankings.
    *   Game history/replays.
*   **Technical:**
    *   Add automated tests (unit/integration).
    *   Implement more robust error handling and logging.
    *   Code linting/formatting enforcement.
    *   **Optimizations:**
        *   Reduce canvas redraw frequency where possible (e.g., only redraw affected areas).
        *   Optimize BFS calculations (though likely not a bottleneck currently).
        *   Refine server-side validation logic.
        *   Investigate client-side state management for potential improvements.
    *   **Technical Debt:**
        *   **Lack of Tests:** No automated tests exist, increasing risk of regressions.
        *   **Magic Numbers/Strings:** Some values (e.g., animation timings, colors) are hardcoded; could be constants or configuration.
        *   **CSS Structure:** `style.css` could potentially be better organized or use a preprocessor.
        *   **Client State:** Client-side state management is basic; could become complex. Consider a lightweight state library if features grow significantly.
        *   **Error Handling:** Client/Server error handling is basic; could be more user-friendly and informative.
