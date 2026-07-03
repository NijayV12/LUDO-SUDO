// LUDO NEON - Core Game Logic & Controller

// Online Multiplayer Global State
let isOnline = false;
let isHost = false;
let myColor = 'red';
let peer = null;
let roomCode = null;
let connections = []; // List of client connections on host
let hostConn = null; // Host connection on client
let peerIdToColorMap = {}; // mapping peer ID to assigned color on host


// 1. Coordinates and Paths Setup
const perimeterCoordinates = [
    // Left-to-right on row 6 (cols 0 to 5)
    {r: 6, c: 0}, {r: 6, c: 1}, {r: 6, c: 2}, {r: 6, c: 3}, {r: 6, c: 4}, {r: 6, c: 5},
    // Up col 6 (rows 5 to 0)
    {r: 5, c: 6}, {r: 4, c: 6}, {r: 3, c: 6}, {r: 2, c: 6}, {r: 1, c: 6}, {r: 0, c: 6},
    // Top-center col 7, row 0
    {r: 0, c: 7},
    // Down col 8 (rows 0 to 5)
    {r: 0, c: 8}, {r: 1, c: 8}, {r: 2, c: 8}, {r: 3, c: 8}, {r: 4, c: 8}, {r: 5, c: 8},
    // Left-to-right on row 6 (cols 9 to 14)
    {r: 6, c: 9}, {r: 6, c: 10}, {r: 6, c: 11}, {r: 6, c: 12}, {r: 6, c: 13}, {r: 6, c: 14},
    // Right-center col 14, row 7
    {r: 7, c: 14},
    // Right-to-left on row 8 (cols 14 to 9)
    {r: 8, c: 14}, {r: 8, c: 13}, {r: 8, c: 12}, {r: 8, c: 11}, {r: 8, c: 10}, {r: 8, c: 9},
    // Down col 8 (rows 9 to 14)
    {r: 9, c: 8}, {r: 10, c: 8}, {r: 11, c: 8}, {r: 12, c: 8}, {r: 13, c: 8}, {r: 14, c: 8},
    // Bottom-center col 7, row 14
    {r: 14, c: 7},
    // Up col 6 (rows 14 to 9)
    {r: 14, c: 6}, {r: 13, c: 6}, {r: 12, c: 6}, {r: 11, c: 6}, {r: 10, c: 6}, {r: 9, c: 6},
    // Right-to-left on row 8 (cols 5 to 0)
    {r: 8, c: 5}, {r: 8, c: 4}, {r: 8, c: 3}, {r: 8, c: 2}, {r: 8, c: 1}, {r: 8, c: 0},
    // Left-center col 0, row 7
    {r: 7, c: 0}
];

// Start and End indices for each color on perimeter coordinates
const colorStartIndices = {
    red: 1,       // (6, 1)
    green: 14,    // (1, 8)
    yellow: 27,   // (8, 13)
    blue: 40      // (13, 6)
};

const safeCellIndices = [1, 9, 14, 22, 27, 35, 40, 48];

// Precompute complete paths (length 57) for each color
const playerPaths = {};
const colors = ['red', 'green', 'yellow', 'blue'];

colors.forEach(color => {
    const path = [];
    const startIdx = colorStartIndices[color];
    
    // Add 51 cells of perimeter path clockwise
    for (let i = 0; i < 51; i++) {
        const idx = (startIdx + i) % 52;
        path.push(perimeterCoordinates[idx]);
    }
    
    // Add home path (5 cells) & home center (1 cell)
    if (color === 'red') {
        for (let c = 1; c <= 5; c++) path.push({r: 7, c: c});
        path.push({r: 7, c: 6});
    } else if (color === 'green') {
        for (let r = 1; r <= 5; r++) path.push({r: r, c: 7});
        path.push({r: 6, c: 7});
    } else if (color === 'yellow') {
        for (let c = 13; c >= 9; c--) path.push({r: 7, c: c});
        path.push({r: 7, c: 8});
    } else if (color === 'blue') {
        for (let r = 13; r >= 9; r--) path.push({r: r, c: 7});
        path.push({r: 8, c: 7});
    }
    
    playerPaths[color] = path;
});

// 2. Game State
let playerTypes = { red: 'human', green: 'ai', yellow: 'ai', blue: 'ai' };
let players = {
    red: { tokens: [{step: -1}, {step: -1}, {step: -1}, {step: -1}], finished: false },
    green: { tokens: [{step: -1}, {step: -1}, {step: -1}, {step: -1}], finished: false },
    yellow: { tokens: [{step: -1}, {step: -1}, {step: -1}, {step: -1}], finished: false },
    blue: { tokens: [{step: -1}, {step: -1}, {step: -1}, {step: -1}], finished: false }
};

let activePlayersOrder = [];
let activeOrderIndex = 0;
let currentTurnColor = 'red';
let currentRoll = 0;
let consecutiveSixes = 0;
let isRolling = false;
let isAnimating = false;
let gameWinnerList = []; // Leaderboard list of colors in finish order

const PHASE_SETUP = 'setup';
const PHASE_ROLL = 'roll';
const PHASE_MOVE = 'move';
const PHASE_OVER = 'over';
let gamePhase = PHASE_SETUP;

// Sound Controller Hook
const getAudio = () => window.audioManager;

// 3. Initialize Board grid cells in HTML
function initBoardDOM() {
    const boardEl = document.getElementById('ludo-board');
    
    // Clear dynamic cells if resetting
    const existingDynamic = boardEl.querySelectorAll('.cell');
    existingDynamic.forEach(el => el.remove());
    
    // Set up a Map to avoid duplicates (perimeter and home paths may cross but coordinates are unique)
    const cellMap = new Map();
    
    // Add perimeter cells
    perimeterCoordinates.forEach((coord, idx) => {
        const key = `${coord.r}-${coord.c}`;
        cellMap.set(key, {
            ...coord,
            isSafe: safeCellIndices.includes(idx),
            class: safeCellIndices.includes(idx) ? `safe-cell safe-cell-${getSafeColor(idx)}` : ''
        });
    });
    
    // Add home paths
    colors.forEach(color => {
        const path = playerPaths[color];
        // home paths are steps 51 to 55 (5 cells)
        for (let step = 51; step <= 55; step++) {
            const coord = path[step];
            const key = `${coord.r}-${coord.c}`;
            cellMap.set(key, {
                ...coord,
                isSafe: true,
                class: `${color}-home-path`
            });
        }
    });
    
    // Append starting cells special highlights
    colors.forEach(color => {
        const startIdx = colorStartIndices[color];
        const coord = perimeterCoordinates[startIdx];
        const key = `${coord.r}-${coord.c}`;
        const existing = cellMap.get(key);
        if (existing) {
            existing.class += ` path-${color}-start`;
        }
    });

    // Create DOM elements
    cellMap.forEach((cellData, key) => {
        const cellDiv = document.createElement('div');
        cellDiv.className = `cell ${cellData.class}`;
        cellDiv.id = `cell-${cellData.r}-${cellData.c}`;
        cellDiv.style.gridRow = cellData.r + 1;
        cellDiv.style.gridColumn = cellData.c + 1;
        boardEl.appendChild(cellDiv);
    });
}

function getSafeColor(perimeterIdx) {
    if (perimeterIdx === 1 || perimeterIdx === 48) return 'red';
    if (perimeterIdx === 14 || perimeterIdx === 9) return 'green';
    if (perimeterIdx === 27 || perimeterIdx === 22) return 'yellow';
    if (perimeterIdx === 41 || perimeterIdx === 35) return 'blue';
    return 'neutral';
}

// Check if cell is safe from captures
function isSafeCell(r, c) {
    // Check if cell exists in perimeter and is safe
    const perimeterIdx = perimeterCoordinates.findIndex(coord => coord.r === r && coord.c === c);
    if (perimeterIdx !== -1 && safeCellIndices.includes(perimeterIdx)) return true;
    
    // Home paths are safe
    for (let color of colors) {
        const path = playerPaths[color];
        const stepIdx = path.findIndex(coord => coord.r === r && coord.c === c);
        if (stepIdx >= 51) return true; // home path cells or home triangle
    }
    return false;
}

// Get clean player labels
function getPlayerName(color) {
    const displayNames = { red: 'Player 1 (Red)', green: 'Player 2 (Green)', yellow: 'Player 3 (Yellow)', blue: 'Player 4 (Blue)' };
    return displayNames[color];
}

// Log messages into the GUI console
function logMessage(text, color = 'system') {
    const logsContainer = document.getElementById('logs-container');
    const log = document.createElement('div');
    log.className = `log-entry ${color}-log`;
    log.textContent = `[${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}] ${text}`;
    logsContainer.appendChild(log);
    logsContainer.scrollTop = logsContainer.scrollHeight;

    // Relays logs to clients in online multiplayer
    if (isOnline && isHost) {
        connections.forEach(c => {
            if (c.open) {
                c.send({
                    type: 'CHAT_MSG',
                    text: text,
                    color: color
                });
            }
        });
    }
}

// 4. GUI Rendering Engine
function renderBoard() {
    // 1. Clear all slots & cell token containers
    const slots = document.querySelectorAll('.token-slot');
    slots.forEach(slot => slot.innerHTML = '');
    
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.innerHTML = '';
        cell.className = cell.className.replace(/\bstack-\d+\b/g, '').trim();
    });
    
    // Clear home triangles tokens if any
    const triangles = document.querySelectorAll('.home-triangle');
    triangles.forEach(t => t.innerHTML = '');

    // 2. Track token groupings per cell coordinates to manage stacking layouts
    const positionsMap = new Map();

    colors.forEach(color => {
        if (playerTypes[color] === 'off') return;
        
        players[color].tokens.forEach((token, tokenId) => {
            const step = token.step;
            
            // Build the token element
            const tokenDiv = document.createElement('div');
            tokenDiv.className = `token token-${color}`;
            tokenDiv.dataset.color = color;
            tokenDiv.dataset.tokenid = tokenId;
            
            // Add movable highlighting if conditions met
            if (gamePhase === PHASE_MOVE && color === currentTurnColor && (!isOnline || color === myColor) && playerTypes[color] === 'human' && !isAnimating) {
                if (canTokenMove(color, tokenId, currentRoll)) {
                    tokenDiv.classList.add('movable');
                    tokenDiv.style.color = `var(--color-${color})`;
                    tokenDiv.addEventListener('click', () => handleTokenClick(color, tokenId));
                }
            }

            if (step === -1) {
                // In base slot
                const slot = document.getElementById(`slot-${color}-${tokenId}`);
                if (slot) slot.appendChild(tokenDiv);
            } else if (step === 56) {
                // In home triangle
                const triangle = document.querySelector(`.triangle-${color}`);
                if (triangle) triangle.appendChild(tokenDiv);
            } else {
                // On path cells
                const coord = playerPaths[color][step];
                const cellKey = `${coord.r}-${coord.c}`;
                
                if (!positionsMap.has(cellKey)) {
                    positionsMap.set(cellKey, []);
                }
                positionsMap.get(cellKey).push(tokenDiv);
            }
        });
    });

    // 3. Render cells with proper stacking CSS
    positionsMap.forEach((tokensArr, cellKey) => {
        const cellEl = document.getElementById(`cell-${cellKey}`);
        if (cellEl) {
            tokensArr.forEach(t => cellEl.appendChild(t));
            const count = tokensArr.length;
            cellEl.classList.add(`stack-${Math.min(count, 4)}`);
        }
    });

    // 4. Update Scoreboard interface
    colors.forEach(color => {
        const card = document.getElementById(`card-${color}`);
        const homeSpan = document.getElementById(`home-${color}`);
        
        if (playerTypes[color] === 'off') {
            card.classList.add('hidden');
            return;
        } else {
            card.classList.remove('hidden');
        }

        // Count tokens home
        const homeCount = players[color].tokens.filter(t => t.step === 56).length;
        homeSpan.textContent = `${homeCount}/4`;

        // Active indicator
        card.classList.remove('active-turn');
        if (gamePhase !== PHASE_SETUP && gamePhase !== PHASE_OVER && color === currentTurnColor) {
            card.classList.add('active-turn');
        }
    });
}

// 5. Game Logic & Rules Core
function canTokenMove(color, tokenId, roll) {
    const step = players[color].tokens[tokenId].step;
    if (step === -1) {
        return roll === 6; // Requires exactly 6 to release from base
    }
    return step + roll <= 56; // Exact fit or less
}

function hasValidMoves(color, roll) {
    let possible = false;
    players[color].tokens.forEach((_, id) => {
        if (canTokenMove(color, id, roll)) possible = true;
    });
    return possible;
}

// Roll 3D dice logic
function triggerDiceRoll() {
    if (isRolling || isAnimating || gamePhase !== PHASE_ROLL) return;
    
    // If online and client, send request to host instead of executing locally
    if (isOnline && !isHost) {
        if (currentTurnColor === myColor) {
            hostConn.send({ type: 'REQUEST_ROLL' });
            // Disable roll button locally
            const diceBtn = document.getElementById('roll-btn');
            if (diceBtn) diceBtn.disabled = true;
        }
        return;
    }

    // AI check for turn block safety
    if (playerTypes[currentTurnColor] === 'human') {
        const diceBtn = document.getElementById('roll-btn');
        if (diceBtn) diceBtn.disabled = true;
    }

    isRolling = true;
    getAudio().playRoll();
    
    const diceEl = document.getElementById('dice');
    diceEl.classList.add('rolling');
    
    // Roll randomly between 1 and 6
    const roll = Math.floor(Math.random() * 6) + 1;
    currentRoll = roll;

    // Broadcast roll to clients so they spin locally
    if (isOnline && isHost) {
        connections.forEach(conn => {
            if (conn.open) conn.send({ type: 'ROLL_START_SYNC', roll: roll });
        });
    }

    setTimeout(() => {
        diceEl.classList.remove('rolling');
        
        // Remove previous orientation classes
        for (let i = 1; i <= 6; i++) {
            diceEl.classList.remove(`show-${i}`);
        }
        // Set new face
        diceEl.classList.add(`show-${roll}`);
        isRolling = false;
        
        // Record roll to player history card list
        updateRollHistory(currentTurnColor, roll);

        logMessage(`${getPlayerName(currentTurnColor)} rolled a ${roll}!`, currentTurnColor);
        
        handleRollResult(roll);
    }, 700);
}

function updateRollHistory(color, roll) {
    const historyContainer = document.getElementById(`history-${color}`);
    const rollBadge = document.createElement('div');
    rollBadge.className = 'history-roll';
    rollBadge.textContent = roll;
    
    historyContainer.appendChild(rollBadge);
    
    // Limit to 8 visible rolls
    if (historyContainer.children.length > 8) {
        historyContainer.removeChild(historyContainer.firstChild);
    }
}

// Decide next action after a roll
function handleRollResult(roll) {
    gamePhase = PHASE_MOVE;
    
    // Check consecutive 6s
    if (roll === 6) {
        consecutiveSixes++;
        if (consecutiveSixes === 3) {
            logMessage(`Three consecutive 6s rolled! Skip Turn.`, 'system');
            consecutiveSixes = 0;
            const cardEl = document.getElementById(`card-${currentTurnColor}`);
            createScoreboardFloatingText(cardEl, "Turn Skipped", "var(--color-red)");
            setTimeout(nextTurn, 1200);
            return;
        }
    } else {
        consecutiveSixes = 0;
    }

    if (!hasValidMoves(currentTurnColor, roll)) {
        logMessage(`No moves possible for ${getPlayerName(currentTurnColor)}.`, 'system');
        const instruction = document.getElementById('turn-instruction');
        instruction.textContent = "No valid moves possible! Passing turn...";
        
        // Brief pause to show message before skipping
        setTimeout(() => {
            consecutiveSixes = 0; // Roll of 6 is forfeited since we couldn't move
            nextTurn();
        }, 1200);
    } else {
        // Highlight options for user or execute AI bot
        const instruction = document.getElementById('turn-instruction');
        if (playerTypes[currentTurnColor] === 'human') {
            instruction.textContent = "Choose one of your glowing tokens to move.";
            renderBoard(); // highlights will appear on tokens
        } else {
            instruction.textContent = "Computer is choosing a move...";
            setTimeout(triggerAIMove, 1000);
        }
    }
}

// Token click action callback (Human)
async function handleTokenClick(color, tokenId) {
    if (gamePhase !== PHASE_MOVE || color !== currentTurnColor || playerTypes[color] !== 'human' || isAnimating) return;
    
    if (isOnline && !isHost) {
        if (color === myColor && canTokenMove(color, tokenId, currentRoll)) {
            // Send request to host
            hostConn.send({
                type: 'REQUEST_MOVE',
                tokenId: tokenId
            });
            // Turn off movable classes locally to prevent double clicks
            const movables = document.querySelectorAll('.token.movable');
            movables.forEach(t => t.classList.remove('movable'));
        }
        return;
    }
    
    if (canTokenMove(color, tokenId, currentRoll)) {
        await executeMove(color, tokenId, currentRoll);
    }
}

// Execute move step by step
async function executeMove(color, tokenId, roll) {
    isAnimating = true;
    const token = players[color].tokens[tokenId];
    const startStep = token.step;
    
    if (startStep === -1) {
        // Exiting base
        token.step = 0;
        getAudio().playRelease();
        logMessage(`${getPlayerName(color)} released token ${tokenId + 1} from base.`, color);
        
        const cellCoord = playerPaths[color][0];
        createFloatingParticles(cellCoord.r, cellCoord.c, `var(--color-${color})`);
        
        renderBoard();
        
        if (isOnline && isHost) {
            broadcastGameState();
        }

        await new Promise(r => setTimeout(r, 200));
    } else {
        // Animate grid hopping
        const targetStep = startStep + roll;
        for (let s = startStep + 1; s <= targetStep; s++) {
            token.step = s;
            getAudio().playStep(s - startStep);
            
            // Broadcast step sound to clients
            if (isOnline && isHost) {
                connections.forEach(c => {
                    if (c.open) c.send({ type: 'ANIMATE_STEP', stepVal: s - startStep });
                });
            }

            renderBoard();
            
            if (isOnline && isHost) {
                broadcastGameState();
            }

            await new Promise(r => setTimeout(r, 160));
        }
    }
    
    isAnimating = false;
    await processLanding(color, tokenId, token.step, roll);
}

// Resolve collisions and win triggers on target grid cell
async function processLanding(color, tokenId, step, roll) {
    const path = playerPaths[color];
    const landCoord = path[step];
    
    let isCapture = false;
    let isHomeRun = (step === 56);
    
    // Check Captures (only if landed cell is not safe)
    if (step < 51 && !isSafeCell(landCoord.r, landCoord.c)) {
        // Loop other players
        for (let otherColor of colors) {
            if (otherColor === color || playerTypes[otherColor] === 'off') continue;
            
            players[otherColor].tokens.forEach((othToken, othId) => {
                if (othToken.step >= 0 && othToken.step < 51) {
                    const othCoord = playerPaths[otherColor][othToken.step];
                    if (othCoord.r === landCoord.r && othCoord.c === landCoord.c) {
                        // Capture!
                        othToken.step = -1; // Send to base
                        isCapture = true;
                        logMessage(`BOOM! ${getPlayerName(color)} captured ${getPlayerName(otherColor)}'s token ${othId + 1}!`, color);
                        
                        // Capture particle explosion
                        createFloatingParticles(landCoord.r, landCoord.c, `var(--color-${otherColor})`, 16);
                    }
                }
            });
        }
    }

    if (isCapture) {
        getAudio().playCapture();
        const cellEl = document.getElementById(`cell-${landCoord.r}-${landCoord.c}`);
        createScoreboardFloatingText(cellEl, "CAPTURED!", "var(--color-yellow)");
    }
    
    if (isHomeRun) {
        getAudio().playHome();
        logMessage(`HOORAY! ${getPlayerName(color)} got token ${tokenId + 1} safely Home!`, color);
        
        const centerEl = document.querySelector('.center-star-badge');
        createFloatingParticles(landCoord.r, landCoord.c, `var(--color-${color})`, 20);
        createScoreboardFloatingText(centerEl, "HOME RUN!", `var(--color-${color})`);
        
        // Check if color won
        const finishedCount = players[color].tokens.filter(t => t.step === 56).length;
        if (finishedCount === 4) {
            players[color].finished = true;
            if (!gameWinnerList.includes(color)) {
                gameWinnerList.push(color);
                const place = gameWinnerList.length;
                let suffix = 'th';
                if (place === 1) suffix = 'st';
                else if (place === 2) suffix = 'nd';
                else if (place === 3) suffix = 'rd';
                
                logMessage(`🏆 WINNER! ${getPlayerName(color)} finishes in ${place}${suffix} place!`, color);
                
                const cardEl = document.getElementById(`card-${color}`);
                createScoreboardFloatingText(cardEl, `${place}${suffix} Place!`, `var(--color-${color})`);
            }
        }
    }

    renderBoard();
    
    // Check if game is over (only 1 player or less remaining unfinished)
    const activeCount = activePlayersOrder.length;
    const finishedCount = activePlayersOrder.filter(c => players[c].finished).length;
    
    if (finishedCount >= activeCount - 1 || finishedCount === activeCount) {
        // Game Over!
        endGameSession();
        return;
    }

    // Double roll logic:
    // Players get an extra turn if they roll a 6, capture an opponent, or reach home.
    const getExtraRoll = (roll === 6 || isCapture || isHomeRun) && !players[color].finished;
    
    if (getExtraRoll) {
        logMessage(`${getPlayerName(color)} earns an extra roll!`, color);
        gamePhase = PHASE_ROLL;
        setupNextActionInterface();
    } else {
        consecutiveSixes = 0;
        nextTurn();
    }
}

// Pass Turn to next active player
function nextTurn() {
    if (gamePhase === PHASE_OVER) return;

    // Find next player index that is not off and has not finished
    let loops = 0;
    do {
        activeOrderIndex = (activeOrderIndex + 1) % activePlayersOrder.length;
        currentTurnColor = activePlayersOrder[activeOrderIndex];
        loops++;
    } while ((playerTypes[currentTurnColor] === 'off' || players[currentTurnColor].finished) && loops < 5);

    consecutiveSixes = 0;
    gamePhase = PHASE_ROLL;
    
    logMessage(`It is now ${getPlayerName(currentTurnColor)}'s turn.`, currentTurnColor);
    
    setupNextActionInterface();
}

// Prepare buttons/text for the next player action
function setupNextActionInterface() {
    const turnLabel = document.getElementById('current-player-turn');
    turnLabel.textContent = getPlayerName(currentTurnColor);
    
    // Update color theme class
    turnLabel.className = '';
    turnLabel.classList.add(`${currentTurnColor}-text`);

    const diceBtn = document.getElementById('roll-btn');
    const instruction = document.getElementById('turn-instruction');

    if (isOnline) {
        if (currentTurnColor === myColor) {
            // It is my turn!
            if (diceBtn) diceBtn.disabled = false;
            instruction.textContent = "It is YOUR turn! Click 'Roll Dice' to roll.";
        } else {
            // Someone else's turn or AI
            if (diceBtn) diceBtn.disabled = true;
            if (playerTypes[currentTurnColor] === 'human') {
                instruction.textContent = `Waiting for ${getPlayerName(currentTurnColor)} to roll...`;
            } else {
                instruction.textContent = `${getPlayerName(currentTurnColor)} (AI Bot) is playing...`;
            }
        }
        
        // Only the host triggers AI turns automatically
        if (isHost && playerTypes[currentTurnColor] === 'ai' && gamePhase === PHASE_ROLL && !isRolling && !isAnimating) {
            setTimeout(triggerDiceRoll, 1000);
        }
    } else {
        // Local Play Mode
        if (playerTypes[currentTurnColor] === 'human') {
            if (diceBtn) diceBtn.disabled = false;
            instruction.textContent = "Click 'Roll Dice' or spin the cube!";
        } else {
            if (diceBtn) diceBtn.disabled = true;
            instruction.textContent = "Computer is thinking...";
            setTimeout(triggerDiceRoll, 1000);
        }
    }
    
    renderBoard();

    // Host automatically updates state for clients
    if (isOnline && isHost) {
        broadcastGameState();
    }
}

// 6. AI Bot Decision Maker
function triggerAIMove() {
    const validTokenIds = [];
    players[currentTurnColor].tokens.forEach((_, id) => {
        if (canTokenMove(currentTurnColor, id, currentRoll)) {
            validTokenIds.push(id);
        }
    });

    if (validTokenIds.length === 0) {
        nextTurn();
        return;
    }

    // AI selects best token
    let bestTokenId = validTokenIds[0];
    let bestScore = -Infinity;

    validTokenIds.forEach(id => {
        const score = evaluateAIMove(currentTurnColor, id, currentRoll);
        if (score > bestScore) {
            bestScore = score;
            bestTokenId = id;
        }
    });

    executeMove(currentTurnColor, bestTokenId, currentRoll);
}

// Rate how good a token move is
function evaluateAIMove(color, tokenId, roll) {
    const token = players[color].tokens[tokenId];
    const currentStep = token.step;
    const nextStep = (currentStep === -1) ? 0 : currentStep + roll;
    
    const path = playerPaths[color];
    const nextCoord = path[nextStep];
    
    let score = 0;

    // 1. Capture opportunity (Highest priority!)
    if (nextStep < 51 && !isSafeCell(nextCoord.r, nextCoord.c)) {
        for (let otherColor of colors) {
            if (otherColor === color || playerTypes[otherColor] === 'off') continue;
            
            players[otherColor].tokens.forEach((othToken, othId) => {
                if (othToken.step >= 0 && othToken.step < 51) {
                    const othCoord = playerPaths[otherColor][othToken.step];
                    if (othCoord.r === nextCoord.r && othCoord.c === nextCoord.c) {
                        score += 1200; // Super high rating for capture
                    }
                }
            });
        }
    }

    // 2. Reach home center
    if (nextStep === 56) {
        score += 1000;
    }

    // 3. Release token from base
    if (currentStep === -1 && roll === 6) {
        // Count how many tokens are currently active on the track
        const activeCount = players[color].tokens.filter(t => t.step >= 0 && t.step < 56).length;
        if (activeCount === 0) {
            score += 800; // Crucial to release first token
        } else {
            score += 450; // Still good to get more out
        }
    }

    // 4. Enter safe zone
    if (nextStep < 51 && isSafeCell(nextCoord.r, nextCoord.c) && !isSafeCell(path[currentStep]?.r, path[currentStep]?.c)) {
        score += 300;
    }

    // 5. Escape danger
    // Check if an opponent is behind this token within 6 steps
    if (currentStep >= 0 && currentStep < 51 && !isSafeCell(path[currentStep].r, path[currentStep].c)) {
        let isThreatened = false;
        
        for (let otherColor of colors) {
            if (otherColor === color || playerTypes[otherColor] === 'off') continue;
            
            players[otherColor].tokens.forEach(othToken => {
                if (othToken.step >= 0 && othToken.step < 51) {
                    const othCoord = playerPaths[otherColor][othToken.step];
                    
                    // Trace paths of other players to see if they can reach our current cell
                    // Opponent steps away
                    const dist = getStepsAway(otherColor, othToken.step, color, currentStep);
                    if (dist > 0 && dist <= 6) {
                        isThreatened = true;
                    }
                }
            });
        }

        if (isThreatened) {
            score += 400; // Move threatened tokens away!
        }
    }

    // 6. Prefer pushing advanced tokens close to home
    if (currentStep > 35) {
        score += nextStep * 1.5;
    } else {
        score += nextStep * 0.5; // General advance
    }

    // Add small random noise to break ties and make AI look organic
    score += Math.random() * 15;

    return score;
}

// Calculate how many steps player A (at step A) is behind player B (at step B)
function getStepsAway(colorA, stepA, colorB, stepB) {
    const coordA = playerPaths[colorA][stepA];
    const coordB = playerPaths[colorB][stepB];

    // Find perimeter index of both
    const idxA = perimeterCoordinates.findIndex(c => c.r === coordA.r && c.c === coordA.c);
    const idxB = perimeterCoordinates.findIndex(c => c.r === coordB.r && c.c === coordB.c);

    if (idxA === -1 || idxB === -1) return -1; // One is in base/home-run

    // Clockwise distance
    return (idxB - idxA + 52) % 52;
}

// 7. Premium Visual Feedback: Particles & Text Splashes
function createFloatingParticles(r, c, colorCode, count = 12) {
    const boardEl = document.getElementById('ludo-board');
    // Calculate approximate cell bounds
    const cellEl = document.getElementById(`cell-${r}-${c}`);
    if (!cellEl) return;
    
    const rect = cellEl.getBoundingClientRect();
    const boardRect = boardEl.getBoundingClientRect();
    
    // Relative coordinates inside ludo-board container
    const x = rect.left - boardRect.left + (rect.width / 2);
    const y = rect.top - boardRect.top + (rect.height / 2);
    
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        particle.style.width = `${Math.floor(Math.random()*6) + 4}px`;
        particle.style.height = particle.style.width;
        particle.style.borderRadius = '50%';
        particle.style.background = colorCode;
        particle.style.boxShadow = `0 0 8px ${colorCode}`;
        particle.style.pointerEvents = 'none';
        particle.style.zIndex = '500';
        
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 80 + 40;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        
        boardEl.appendChild(particle);
        
        const startTime = performance.now();
        const duration = 800; // 0.8s life
        
        function animateParticle(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Apply speed + gravity drift
            const currX = x + (vx * progress * 0.01) * 10;
            const currY = y + (vy * progress * 0.01) * 10 + (progress * progress * 40); // gravity fall
            
            particle.style.transform = `translate(${currX - x}px, ${currY - y}px)`;
            particle.style.opacity = 1 - progress;
            
            if (progress < 1) {
                requestAnimationFrame(animateParticle);
            } else {
                particle.remove();
            }
        }
        requestAnimationFrame(animateParticle);
    }
}

function createScoreboardFloatingText(anchorElement, text, colorCode) {
    if (!anchorElement) return;
    
    const floatText = document.createElement('div');
    floatText.style.position = 'absolute';
    floatText.style.color = '#fff';
    floatText.style.background = 'rgba(0,0,0,0.8)';
    floatText.style.border = `1px solid ${colorCode}`;
    floatText.style.boxShadow = `0 0 10px ${colorCode}`;
    floatText.style.padding = '4px 10px';
    floatText.style.borderRadius = '6px';
    floatText.style.fontSize = '0.75rem';
    floatText.style.fontWeight = '800';
    floatText.style.whiteSpace = 'nowrap';
    floatText.style.pointerEvents = 'none';
    floatText.style.zIndex = '1000';
    floatText.textContent = text;
    
    document.body.appendChild(floatText);
    
    const rect = anchorElement.getBoundingClientRect();
    const startX = rect.left + window.scrollX + (rect.width/2);
    const startY = rect.top + window.scrollY;
    
    floatText.style.left = `${startX}px`;
    floatText.style.top = `${startY}px`;
    floatText.style.transform = 'translate(-50%, -50%)';
    
    const startTime = performance.now();
    const duration = 1200;
    
    function animateText(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Rise and fade
        floatText.style.top = `${startY - (progress * 50)}px`;
        floatText.style.opacity = 1 - progress;
        
        if (progress < 1) {
            requestAnimationFrame(animateText);
        } else {
            floatText.remove();
        }
    }
    requestAnimationFrame(animateText);
}

// 8. Session Management (Start, Reset, End)
function startLudoGame(override = false) {
    if (!override && !isOnline) {
        // Read setup screen radio inputs
        colors.forEach(color => {
            const checkedInput = document.querySelector(`input[name="p-${color}"]:checked`);
            playerTypes[color] = checkedInput ? checkedInput.value : 'off';
        });
    }

    // Validate player count (minimum 2 active players)
    activePlayersOrder = colors.filter(c => playerTypes[c] !== 'off');
    if (activePlayersOrder.length < 2) {
        alert("Arena needs at least 2 active players to initiate Ludo combat!");
        return;
    }

    // Initialize/Resume Audio Context
    getAudio().init();

    // Reset states
    players = {
        red: { tokens: [{step: -1}, {step: -1}, {step: -1}, {step: -1}], finished: false },
        green: { tokens: [{step: -1}, {step: -1}, {step: -1}, {step: -1}], finished: false },
        yellow: { tokens: [{step: -1}, {step: -1}, {step: -1}, {step: -1}], finished: false },
        blue: { tokens: [{step: -1}, {step: -1}, {step: -1}, {step: -1}], finished: false }
    };
    
    // Reset roll histories
    colors.forEach(color => {
        const hist = document.getElementById(`history-${color}`);
        if (hist) hist.innerHTML = '';
        
        // Update setup badges type
        const card = document.getElementById(`card-${color}`);
        if (card) {
            const badge = card.querySelector('.player-type-badge');
            if (badge) {
                badge.textContent = playerTypes[color];
                badge.className = `player-type-badge ${color}-badge`;
            }
        }
    });

    gameWinnerList = [];
    activeOrderIndex = 0;
    currentTurnColor = activePlayersOrder[0];
    consecutiveSixes = 0;
    isRolling = false;
    isAnimating = false;
    
    // Initialize HTML grid path DOM structures
    initBoardDOM();

    // Transition screens
    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    logMessage(`--- GAME STARTED ---`, 'system');
    logMessage(`Active Warriors: ${activePlayersOrder.map(c => c.toUpperCase()).join(', ')}`, 'system');
    
    gamePhase = PHASE_ROLL;
    setupNextActionInterface();
}

function endGameSession() {
    gamePhase = PHASE_OVER;
    getAudio().playWin();
    
    logMessage(`--- ARENA MATCH CONCLUDED ---`, 'system');
    gameWinnerList.forEach((col, idx) => {
        logMessage(`#${idx+1} Place: ${getPlayerName(col).toUpperCase()}`, col);
    });

    const instruction = document.getElementById('turn-instruction');
    const winnerName = getPlayerName(gameWinnerList[0]);
    instruction.innerHTML = `🏆 MATCH OVER!<br>${winnerName.toUpperCase()} IS VICTORIOUS!`;
    
    // Add win text animation
    const turnLabel = document.getElementById('current-player-turn');
    turnLabel.textContent = "GAME OVER";
    turnLabel.className = 'accent-text';

    const diceBtn = document.getElementById('roll-btn');
    diceBtn.disabled = true;
}

function resetGameToSetup() {
    gamePhase = PHASE_SETUP;
    
    // Transition screens back
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('setup-screen').classList.remove('hidden');
    
    // Clear logs
    const logsContainer = document.getElementById('logs-container');
    logsContainer.innerHTML = '<div class="log-entry system-log">Welcome to LUDO NEON! Setup completed. Ready to play.</div>';

    // Terminate online connection if returning to lobby
    if (isOnline) {
        resetOnlineState();
    }
}

// 9. Event Listeners Setup
document.addEventListener('DOMContentLoaded', () => {
    // Standard Buttons
    document.getElementById('start-game-btn').addEventListener('click', () => startLudoGame(false));
    document.getElementById('restart-btn').addEventListener('click', resetGameToSetup);
    
    // Play Mode Tabs toggles
    const tabLocal = document.getElementById('tab-local');
    const tabOnline = document.getElementById('tab-online');
    const localLobby = document.getElementById('local-lobby-container');
    const onlineLobby = document.getElementById('online-lobby-container');

    if (tabLocal && tabOnline) {
        tabLocal.addEventListener('click', () => {
            tabLocal.classList.add('active');
            tabOnline.classList.remove('active');
            localLobby.classList.remove('hidden');
            onlineLobby.classList.add('hidden');
            resetOnlineState();
        });

        tabOnline.addEventListener('click', () => {
            tabOnline.classList.add('active');
            tabLocal.classList.remove('active');
            onlineLobby.classList.remove('hidden');
            localLobby.classList.add('hidden');
            resetOnlineState();
            updateOnlineLobbyUI();
        });
    }

    // Online Roles toggles
    const roleHostBtn = document.getElementById('role-host');
    const roleJoinBtn = document.getElementById('role-join');
    const hostPanel = document.getElementById('host-panel');
    const joinPanel = document.getElementById('join-panel');

    if (roleHostBtn && roleJoinBtn) {
        roleHostBtn.addEventListener('click', () => {
            roleHostBtn.classList.add('active');
            roleJoinBtn.classList.remove('active');
            hostPanel.classList.remove('hidden');
            joinPanel.classList.add('hidden');
            resetOnlineState();
            updateOnlineLobbyUI();
        });

        roleJoinBtn.addEventListener('click', () => {
            roleJoinBtn.classList.add('active');
            roleHostBtn.classList.remove('active');
            joinPanel.classList.remove('hidden');
            hostPanel.classList.add('hidden');
            resetOnlineState();
            updateOnlineLobbyUI();
        });
    }

    // Multiplayer Buttons
    const btnCreateLobby = document.getElementById('btn-create-lobby');
    if (btnCreateLobby) btnCreateLobby.addEventListener('click', initHost);
    
    const btnJoinLobby = document.getElementById('btn-join-lobby');
    if (btnJoinLobby) {
        btnJoinLobby.addEventListener('click', () => {
            const input = document.getElementById('join-code-input');
            if (input) initClient(input.value);
        });
    }
    
    const btnCopyCode = document.getElementById('btn-copy-code');
    if (btnCopyCode) {
        btnCopyCode.addEventListener('click', () => {
            const code = document.getElementById('lobby-code-txt').textContent;
            navigator.clipboard.writeText(code).then(() => {
                const originalText = btnCopyCode.textContent;
                btnCopyCode.textContent = "Copied!";
                btnCopyCode.style.borderColor = "var(--color-green)";
                setTimeout(() => {
                    btnCopyCode.textContent = originalText;
                    btnCopyCode.style.borderColor = "";
                }, 1500);
            });
        });
    }

    const btnStartOnline = document.getElementById('btn-start-online');
    if (btnStartOnline) btnStartOnline.addEventListener('click', startOnlineGame);

    // Rules modal toggles
    const rulesModal = document.getElementById('rules-modal');
    const showRules = () => rulesModal.classList.remove('hidden');
    const hideRules = () => rulesModal.classList.add('hidden');
    
    const ruleBtn1 = document.getElementById('how-to-play-online-btn');
    if (ruleBtn1) ruleBtn1.addEventListener('click', showRules);
    
    document.getElementById('how-to-play-btn').addEventListener('click', showRules);
    document.getElementById('game-rules-btn').addEventListener('click', showRules);
    document.getElementById('close-rules-btn').addEventListener('click', hideRules);
    document.getElementById('close-rules-footer-btn').addEventListener('click', hideRules);
    
    // Clicking outside modal closes it
    rulesModal.addEventListener('click', (e) => {
        if (e.target === rulesModal) hideRules();
    });

    // Mute button
    const muteBtn = document.getElementById('mute-btn');
    muteBtn.addEventListener('click', () => {
        const isMuted = getAudio().toggleMute();
        const icon = document.getElementById('sound-icon');
        if (isMuted) {
            // Muted Speaker Icon Path
            icon.innerHTML = `<path fill="currentColor" d="M12,4L9.91,6.09L12,8.18M4.27,3L3,4.27L7.73,9H3V15H7L12,20V13.27L16.25,17.53C15.58,18.04 14.83,18.46 14,18.7V20.77C15.38,20.44 16.63,19.78 17.7,18.9L20.73,21.93L22,20.66L4.27,3M19,12C19,12.9 18.84,13.75 18.57,14.54L20.12,16.1C20.67,14.87 21,13.5 21,12C21,7.72 18.01,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12M16.5,12C16.5,10.23 15.5,8.71 14,7.97V10.18L16.45,12.63C16.48,12.43 16.5,12.22 16.5,12Z" />`;
            logMessage("Sound system muted.", 'system');
        } else {
            // Normal Speaker Icon Path
            icon.innerHTML = `<path fill="currentColor" d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.7V20.77C18.01,19.86 21,16.28 21,12C21,7.72 18.01,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.77 16.5,12M3,9V15H7L12,20V4L7,9H3Z" />`;
            logMessage("Sound system activated.", 'system');
        }
    });

    // Dice triggers
    document.getElementById('roll-btn').addEventListener('click', triggerDiceRoll);
    document.getElementById('dice').addEventListener('click', triggerDiceRoll);
});

// 10. PeerJS P2P Online Multiplayer Engine

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `NEON-${code}`;
}

function initHost() {
    roomCode = generateRoomCode();
    
    // Create host peer session
    peer = new Peer(roomCode, {
        host: '0.peerjs.com',
        port: 443,
        secure: true
    });

    const statusTxt = document.getElementById('lobby-code-txt');
    statusTxt.textContent = "Connecting...";
    document.getElementById('room-code-display').classList.remove('hidden');
    document.getElementById('lobby-player-list').classList.remove('hidden');
    
    peer.on('open', (id) => {
        isOnline = true;
        isHost = true;
        myColor = 'red';
        
        statusTxt.textContent = id;
        logMessage(`Host lobby created. Room Code: ${id}`, 'system');
        
        // Reset player types locally
        colors.forEach(c => {
            playerTypes[c] = (c === 'red') ? 'human' : 'ai';
        });
        
        updateOnlineLobbyUI();
    });

    peer.on('connection', (conn) => {
        setupIncomingConnection(conn);
    });

    peer.on('error', (err) => {
        console.error("PeerJS Error:", err);
        if (err.type === 'unavailable-id') {
            logMessage("Room Code conflict. Retrying...", 'system');
            peer.destroy();
            setTimeout(initHost, 1000);
        } else {
            alert(`Lobby Connection Error: ${err.message}`);
            resetOnlineState();
        }
    });
}

function setupIncomingConnection(conn) {
    // Find next available color slot for the client
    const assignedColor = colors.find(c => playerTypes[c] === 'ai');
    if (!assignedColor) {
        conn.on('open', () => {
            conn.send({ type: 'LOBBY_FULL' });
            setTimeout(() => conn.close(), 1000);
        });
        return;
    }

    playerTypes[assignedColor] = 'human';
    peerIdToColorMap[conn.peer] = assignedColor;
    connections.push(conn);

    conn.on('open', () => {
        logMessage(`Player joined. Assigned to ${getPlayerName(assignedColor)}.`, assignedColor);
        
        conn.send({
            type: 'HANDSHAKE',
            color: assignedColor,
            playerTypes: playerTypes
        });

        broadcastLobbyState();
    });

    conn.on('data', (data) => {
        handleHostReceivedData(conn.peer, data);
    });

    conn.on('close', () => {
        handleClientDisconnect(conn.peer);
    });

    conn.on('error', () => {
        handleClientDisconnect(conn.peer);
    });
}

function broadcastLobbyState() {
    const payload = {
        type: 'LOBBY_UPDATE',
        playerTypes: playerTypes
    };
    connections.forEach(c => {
        if (c.open) c.send(payload);
    });
    updateOnlineLobbyUI();
}

function initClient(targetRoomCode) {
    const code = targetRoomCode.trim().toUpperCase();
    if (!code) {
        alert("Please enter a valid Room Code!");
        return;
    }

    // Standardize code formats (e.g. if user types just 'ABCD', prepend 'NEON-')
    const finalCode = code.startsWith('NEON-') ? code : `NEON-${code}`;

    const joinStatus = document.getElementById('join-status-txt');
    joinStatus.textContent = "Connecting to broker server...";
    
    peer = new Peer({
        host: '0.peerjs.com',
        port: 443,
        secure: true
    });

    peer.on('open', () => {
        joinStatus.textContent = `Connecting to Host: ${finalCode}...`;
        
        hostConn = peer.connect(finalCode);
        
        hostConn.on('open', () => {
            isOnline = true;
            isHost = false;
            joinStatus.textContent = "Connected! Setting up lobby...";
            document.getElementById('lobby-player-list').classList.remove('hidden');
        });

        hostConn.on('data', (data) => {
            handleClientReceivedData(data);
        });

        hostConn.on('close', () => {
            alert("Connection to host lost!");
            resetOnlineState();
        });

        hostConn.on('error', (err) => {
            console.error("Host Connection Error:", err);
            alert("Lobby Connection failed.");
            resetOnlineState();
        });
    });

    peer.on('error', (err) => {
        console.error("Peer error:", err);
        alert(`Failed to create Peer session: ${err.message}`);
        resetOnlineState();
    });
}

function handleClientReceivedData(data) {
    switch (data.type) {
        case 'HANDSHAKE':
            myColor = data.color;
            playerTypes = data.playerTypes;
            logMessage(`Connected as ${getPlayerName(myColor)}!`, myColor);
            updateOnlineLobbyUI();
            break;
            
        case 'LOBBY_UPDATE':
            playerTypes = data.playerTypes;
            updateOnlineLobbyUI();
            break;
            
        case 'LOBBY_FULL':
            alert("Lobby is full!");
            resetOnlineState();
            break;
            
        case 'GAME_START':
            playerTypes = data.playerTypes;
            activePlayersOrder = data.activePlayersOrder;
            currentTurnColor = data.currentTurnColor;
            
            initBoardDOM();
            document.getElementById('setup-screen').classList.add('hidden');
            document.getElementById('game-screen').classList.remove('hidden');
            
            logMessage(`Online match started by host!`, 'system');
            setupNextActionInterface();
            break;
            
        case 'STATE_SYNC':
            players = data.state.players;
            currentTurnColor = data.state.currentTurnColor;
            currentRoll = data.state.currentRoll;
            consecutiveSixes = data.state.consecutiveSixes;
            gamePhase = data.state.gamePhase;
            gameWinnerList = data.state.gameWinnerList;
            activePlayersOrder = data.state.activePlayersOrder;
            activeOrderIndex = data.state.activeOrderIndex;
            isRolling = data.state.isRolling;
            isAnimating = data.state.isAnimating;
            playerTypes = data.state.playerTypes;
            
            setupNextActionInterface();
            break;
            
        case 'ROLL_START_SYNC':
            const diceEl = document.getElementById('dice');
            if (diceEl) diceEl.classList.add('rolling');
            getAudio().playRoll();
            
            setTimeout(() => {
                if (diceEl) {
                    diceEl.classList.remove('rolling');
                    for (let i = 1; i <= 6; i++) diceEl.classList.remove(`show-${i}`);
                    diceEl.classList.add(`show-${data.roll}`);
                }
            }, 700);
            break;
            
        case 'ANIMATE_STEP':
            getAudio().playStep(data.stepVal);
            break;

        case 'CHAT_MSG':
            logMessage(data.text, data.color);
            break;
    }
}

function handleHostReceivedData(peerId, data) {
    const senderColor = peerIdToColorMap[peerId];
    if (!senderColor) return;

    switch (data.type) {
        case 'REQUEST_ROLL':
            if (gamePhase === PHASE_ROLL && senderColor === currentTurnColor && !isRolling && !isAnimating) {
                triggerDiceRoll();
            }
            break;
            
        case 'REQUEST_MOVE':
            if (gamePhase === PHASE_MOVE && senderColor === currentTurnColor && !isRolling && !isAnimating) {
                if (canTokenMove(senderColor, data.tokenId, currentRoll)) {
                    executeMove(senderColor, data.tokenId, currentRoll);
                }
            }
            break;
    }
}

function handleClientDisconnect(peerId) {
    const dcColor = peerIdToColorMap[peerId];
    if (dcColor) {
        logMessage(`Connection lost with ${getPlayerName(dcColor)}. Replacing with AI bot.`, 'system');
        playerTypes[dcColor] = 'ai';
        delete peerIdToColorMap[peerId];
        
        connections = connections.filter(conn => conn.peer !== peerId);
        
        if (gamePhase !== PHASE_SETUP && gamePhase !== PHASE_OVER) {
            broadcastGameState();
            
            if (currentTurnColor === dcColor && gamePhase === PHASE_ROLL && !isRolling && !isAnimating) {
                setTimeout(triggerDiceRoll, 1000);
            } else if (currentTurnColor === dcColor && gamePhase === PHASE_MOVE && !isRolling && !isAnimating) {
                setTimeout(triggerAIMove, 1000);
            }
        } else {
            broadcastLobbyState();
        }
    }
}

function broadcastGameState() {
    if (!isOnline || !isHost) return;
    
    const statePayload = {
        type: 'STATE_SYNC',
        state: {
            players: players,
            currentTurnColor: currentTurnColor,
            currentRoll: currentRoll,
            consecutiveSixes: consecutiveSixes,
            gamePhase: gamePhase,
            gameWinnerList: gameWinnerList,
            activePlayersOrder: activePlayersOrder,
            activeOrderIndex: activeOrderIndex,
            isRolling: isRolling,
            isAnimating: isAnimating,
            playerTypes: playerTypes
        }
    };
    
    connections.forEach(conn => {
        if (conn.open) {
            conn.send(statePayload);
        }
    });
}

function startOnlineGame() {
    if (!isOnline || !isHost) return;
    
    activePlayersOrder = colors.filter(c => playerTypes[c] !== 'off');
    if (activePlayersOrder.length < 2) {
        alert("Lobby needs at least 2 active players to initiate!");
        return;
    }
    
    // Broadcast start to clients
    connections.forEach(conn => {
        if (conn.open) {
            conn.send({
                type: 'GAME_START',
                playerTypes: playerTypes,
                activePlayersOrder: activePlayersOrder,
                currentTurnColor: currentTurnColor
            });
        }
    });
    
    startLudoGame(true);
}

function updateOnlineLobbyUI() {
    colors.forEach(color => {
        const pill = document.getElementById(`slot-pill-${color}`);
        const nameSpan = document.getElementById(`slot-name-${color}`);
        if (!pill || !nameSpan) return;

        pill.className = `player-slot-pill pill-${color}`;

        if (playerTypes[color] === 'human') {
            pill.classList.remove('empty-slot');
            if (isHost) {
                if (color === 'red') {
                    nameSpan.textContent = `Player 1 (Red): Host (You)`;
                } else {
                    nameSpan.textContent = `${getPlayerName(color)}: Connected Client`;
                }
            } else {
                if (color === myColor) {
                    nameSpan.textContent = `${getPlayerName(color)}: You`;
                } else if (color === 'red') {
                    nameSpan.textContent = `Player 1 (Red): Host`;
                } else {
                    nameSpan.textContent = `${getPlayerName(color)}: Connected Client`;
                }
            }
        } else if (playerTypes[color] === 'ai') {
            pill.classList.add('empty-slot');
            nameSpan.textContent = `${getPlayerName(color)}: AI Bot`;
        } else {
            pill.classList.add('empty-slot');
            nameSpan.textContent = `${getPlayerName(color)}: Disabled`;
        }
    });

    const startOnlineBtn = document.getElementById('btn-start-online');
    const waitMsg = document.getElementById('online-wait-msg');
    
    if (startOnlineBtn && waitMsg) {
        if (isHost) {
            startOnlineBtn.classList.remove('hidden');
            waitMsg.classList.add('hidden');
            
            const clientConnected = colors.some(c => c !== 'red' && playerTypes[c] === 'human');
            startOnlineBtn.disabled = !clientConnected; // Host must wait for at least 1 online peer
        } else {
            startOnlineBtn.classList.add('hidden');
            waitMsg.classList.remove('hidden');
        }
    }
}

function resetOnlineState() {
    isOnline = false;
    isHost = false;
    myColor = 'red';
    
    if (peer) {
        peer.destroy();
        peer = null;
    }
    
    connections = [];
    hostConn = null;
    peerIdToColorMap = {};
    
    const roomDisp = document.getElementById('room-code-display');
    const playList = document.getElementById('lobby-player-list');
    const startOnlineBtn = document.getElementById('btn-start-online');
    const waitMsg = document.getElementById('online-wait-msg');
    
    if (roomDisp) roomDisp.classList.add('hidden');
    if (playList) playList.classList.add('hidden');
    if (startOnlineBtn) startOnlineBtn.classList.add('hidden');
    if (waitMsg) waitMsg.classList.remove('hidden');
    
    const joinStatus = document.getElementById('join-status-txt');
    if (joinStatus) joinStatus.textContent = '';
    
    const codeTxt = document.getElementById('lobby-code-txt');
    if (codeTxt) codeTxt.textContent = 'NEON-XXXX';
    
    const codeInput = document.getElementById('join-code-input');
    if (codeInput) codeInput.value = '';
    
    colors.forEach(c => {
        playerTypes[c] = (c === 'red') ? 'human' : 'ai';
    });
    
    updateOnlineLobbyUI();
}
