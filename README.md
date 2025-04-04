# HexStorm

A real-time two-player territory capture game played on a hexagonal board. Players compete to control the board by strategically selecting colors to flood-fill their territory, expanding from their starting corner.

## Game Specification

*   **Board:** A hexagonal grid of a defined size (currently 5-radius hex).
*   **Players:** Two players, Player 1 and Player 2.
*   **Starting Positions:** Player 1 starts controlling the bottom-left corner hex. Player 2 starts controlling the top-right corner hex.
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

## Current Status (April 4, 2024)

*   **Core Gameplay:** Implemented and functional. Players can connect, take turns, select colors, and capture territory via flood fill.
*   **Real-time Sync:** Game state is synchronized between server and clients using Socket.IO.
*   **Win Condition:** Game correctly detects when a player controls > 50% of the hexes and declares a winner.
*   **Game Reset:** The game automatically resets a few seconds after a winner is declared.
*   **Player Assignment:** Server assigns players as Player 1, Player 2, or Spectator upon connection.
*   **UI:**
    *   Canvas rendering of the hex board.
    *   Displays player scores and current turn.
    *   Color selection buttons are dynamically enabled/disabled based on game state and rules.
    *   Implemented a "dark mode" theme with black background and orange UI elements.
    *   Player 2's view is rotated 180 degrees so their starting corner appears in the lower-left on their screen.
*   **Debugging:** Added console logs for troubleshooting state updates and rendering.

## How to Run Locally

1.  Navigate to the `gemini/hexstorm` directory.
2.  Install dependencies: `npm install`
3.  Start the server: `node server.js`
4.  Open two browser tabs/windows to `http://localhost:3000`. The first tab will be Player 1, the second Player 2. Subsequent tabs will be spectators.

## To-Dos / Future Plans

*   **Deployment:** Prepare for deployment on a platform like Render.com (free tier).
    *   Ensure `package.json` includes necessary start scripts (`"start": "node server.js"`).
    *   Check Node.js version compatibility.
    *   Configure Render service settings (e.g., build command `npm install`, start command `npm start`).
*   **Refinements:**
    *   Improve handling of player disconnections (e.g., pause game, declare winner/loser).
    *   Add visual feedback for invalid moves (e.g., shake button).
    *   Consider adding a simple animation for the flood fill.
*   **Configuration:** Make board size and colors configurable (maybe via constants or environment variables).
*   **Code Quality:** Add more comments, potentially run a linter/formatter.
*   **Spectator Experience:** Enhance the spectator view (e.g., clearer indication of who is who).

