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


// 1. Coordinates and Paths Setup (Dynamic Coordinates Engine)
const allColors = ['red', 'green', 'yellow', 'blue', 'orange', 'purple'];
let colors = ['red', 'green', 'yellow', 'blue'];
let perimeterCoordinates = [];
let colorStartIndices = {};
let safeCellIndices = [];
let playerPaths = {};
let baseCoordinates = {};
let homeTokenCoordinates = {};
let lastInitializedBoardMode = null;

function setupBoardGeometry(numPlayers) {
    colors = allColors.slice(0, numPlayers);
    
    perimeterCoordinates = [];
    colorStartIndices = {};
    safeCellIndices = [];
    playerPaths = {};
    baseCoordinates = {};
    homeTokenCoordinates = {};

    const C = { x: 50, y: 50 };

    // Layout configuration constants (in percentages of board wrapper)
    const r_inner = 12.0;
    const r_outer = 37.5;
    const r_tip = 42.0;
    const w = 5.5;

    // Outgoing, centerline, and ingoing tracks have 6 radial steps
    const r = [];
    for (let i = 0; i < 6; i++) {
        r.push(r_outer - i * (r_outer - r_inner) / 5);
    }

    const alpha = [];
    const beta = [];
    for (let p = 0; p < numPlayers; p++) {
        // Arm centerline angle
        const a = p * (2 * Math.PI / numPlayers) - Math.PI;
        alpha.push(a);
        // Base angle sits midway to next arm
        beta.push(a + Math.PI / numPlayers);
    }

    // Build the perimeter track loop clockwise
    for (let p = 0; p < numPlayers; p++) {
        const u = { x: Math.cos(alpha[p]), y: Math.sin(alpha[p]) };
        const v = { x: -Math.sin(alpha[p]), y: Math.cos(alpha[p]) }; // clockwise perpendicular
        
        const armIndexStart = perimeterCoordinates.length;

        // 1. Outgoing cells (6 cells, moving away from center)
        for (let i = 5; i >= 0; i--) {
            perimeterCoordinates.push({
                x: C.x + r[i] * u.x - w * v.x,
                y: C.y + r[i] * u.y - w * v.y,
                r: 0,
                c: 0
            });
        }

        // 2. Outer tip cell (1 cell)
        perimeterCoordinates.push({
            x: C.x + r_tip * u.x,
            y: C.y + r_tip * u.y,
            r: 0,
            c: 0
        });

        // 3. Ingoing cells (6 cells, moving towards center)
        for (let i = 0; i < 6; i++) {
            perimeterCoordinates.push({
                x: C.x + r[i] * u.x + w * v.x,
                y: C.y + r[i] * u.y + w * v.y,
                r: 0,
                c: 0
            });
        }

        const color = colors[p];
        // Start cell is the second cell of the ingoing path (index armIndexStart + 8)
        colorStartIndices[color] = armIndexStart + 8;

        // Safe cells
        safeCellIndices.push(armIndexStart + 8); // start cell
        safeCellIndices.push(armIndexStart + 3); // outgoing safe cell

        // Base coordinates
        baseCoordinates[color] = {
            x: C.x + 34.0 * Math.cos(beta[p]),
            y: C.y + 34.0 * Math.sin(beta[p])
        };

        // Home token positions inside triangles (step 56)
        homeTokenCoordinates[color] = {
            x: C.x + 7.5 * u.x,
            y: C.y + 7.5 * u.y
        };
    }

    // Precompute complete paths (length 57) for each color
    colors.forEach((color, p) => {
        const path = [];
        const startIdx = colorStartIndices[color];
        const N = perimeterCoordinates.length;

        // 51 perimeter cells clockwise
        for (let i = 0; i < 51; i++) {
            const idx = (startIdx + i) % N;
            path.push(perimeterCoordinates[idx]);
        }

        // 5 home path cells (steps 51 to 55)
        const u = { x: Math.cos(alpha[p]), y: Math.sin(alpha[p]) };
        for (let i = 1; i <= 5; i++) {
            path.push({
                x: C.x + r[i] * u.x,
                y: C.y + r[i] * u.y,
                r: 0,
                c: 0
            });
        }

        // Home center (step 56)
        path.push({
            x: homeTokenCoordinates[color].x,
            y: homeTokenCoordinates[color].y,
            r: 0,
            c: 0
        });

        playerPaths[color] = path;
    });
}

// 2. Game State
let playerTypes = { red: 'human', green: 'ai', yellow: 'ai', blue: 'ai', orange: 'ai', purple: 'ai' };
let playerDifficulties = { red: 'balanced', green: 'balanced', yellow: 'balanced', blue: 'balanced', orange: 'balanced', purple: 'balanced' };
let playerNames = {
    red: 'Player 1 (Red)',
    green: 'Player 2 (Green)',
    yellow: 'Player 3 (Yellow)',
    blue: 'Player 4 (Blue)',
    orange: 'Player 5 (Orange)',
    purple: 'Player 6 (Purple)'
};
let tokensCount = 4;
let releaseRule = '6';

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
    if (!boardEl) return;
    
    // Skip rebuilding if layout is already generated for the active player count
    if (lastInitializedBoardMode === colors.length && boardEl.querySelector('.cell')) {
        return;
    }
    lastInitializedBoardMode = colors.length;

    boardEl.innerHTML = ''; // Clear static layout structures

    // 1. Create dynamic bases and token slots
    colors.forEach(color => {
        const baseCoord = baseCoordinates[color];
        if (!baseCoord) return;
        
        const baseDiv = document.createElement('div');
        baseDiv.className = `base ${color}-base`;
        baseDiv.id = `base-${color}`;
        baseDiv.style.left = `${baseCoord.x}%`;
        baseDiv.style.top = `${baseCoord.y}%`;
        baseDiv.style.width = '20%';
        baseDiv.style.height = '20%';
        baseDiv.style.transform = 'translate(-50%, -50%)';
        
        const baseInner = document.createElement('div');
        baseInner.className = 'base-inner';
        
        for (let i = 0; i < tokensCount; i++) {
            const slot = document.createElement('div');
            slot.className = `token-slot ${color}-slot`;
            slot.id = `slot-${color}-${i}`;
            baseInner.appendChild(slot);
        }
        
        baseDiv.appendChild(baseInner);
        boardEl.appendChild(baseDiv);
    });

    const P = colors.length;
    const alpha = [];
    const beta = [];
    for (let p = 0; p < P; p++) {
        const a = p * (2 * Math.PI / P) - Math.PI;
        alpha.push(a);
        beta.push(a + Math.PI / P);
    }

    // 2. Create Home Center SVG and divided polygons
    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.setAttribute('class', 'home-triangles-svg');
    svgEl.setAttribute('viewBox', '0 0 100 100');
    svgEl.setAttribute('preserveAspectRatio', 'none');
    
    const R_home_corner = 15.0;
    
    colors.forEach((color, p) => {
        const prevBeta = beta[(p - 1 + P) % P];
        const currBeta = beta[p];
        
        const x1 = 50 + R_home_corner * Math.cos(prevBeta);
        const y1 = 50 + R_home_corner * Math.sin(prevBeta);
        const x2 = 50 + R_home_corner * Math.cos(currBeta);
        const y2 = 50 + R_home_corner * Math.sin(currBeta);
        
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', `50,50 ${x1.toFixed(2)},${y1.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)}`);
        polygon.setAttribute('class', `svg-triangle-${color}`);
        polygon.style.fill = `var(--color-${color})`;
        polygon.style.opacity = '0.85';
        polygon.style.filter = `drop-shadow(0 0 4px var(--color-${color}-glow))`;
        svgEl.appendChild(polygon);
    });
    boardEl.appendChild(svgEl);

    // Center decoration star badge
    const centerBadge = document.createElement('div');
    centerBadge.className = 'center-star-badge';
    centerBadge.innerHTML = `
        <svg viewBox="0 0 24 24" width="28" height="28">
            <path fill="#ffffff" d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z"/>
        </svg>
    `;
    boardEl.appendChild(centerBadge);

    // 3. Create Home Triangle Token Container divs
    colors.forEach(color => {
        const homeTokenCoord = homeTokenCoordinates[color];
        if (!homeTokenCoord) return;
        
        const triangleDiv = document.createElement('div');
        triangleDiv.className = `home-triangle triangle-${color}`;
        triangleDiv.style.position = 'absolute';
        triangleDiv.style.left = `${homeTokenCoord.x}%`;
        triangleDiv.style.top = `${homeTokenCoord.y}%`;
        triangleDiv.style.transform = 'translate(-50%, -50%)';
        boardEl.appendChild(triangleDiv);
    });

    // 4. Create Perimeter cells
    perimeterCoordinates.forEach((coord, idx) => {
        const cellDiv = document.createElement('div');
        cellDiv.className = 'cell';
        cellDiv.id = `cell-p-${idx}`;
        
        // Highlight start cells
        const isStart = colors.some((c, p) => idx === p * 13 + 8);
        if (isStart) {
            const pIdx = colors.findIndex((c, p) => idx === p * 13 + 8);
            const color = colors[pIdx];
            cellDiv.classList.add(`path-${color}-start`);
            
            // Draw starting arrow pointing towards center (opposite of arm centerline direction)
            const arrowAngle = (alpha[pIdx] * 180 / Math.PI) + 180;
            const arrowEl = document.createElement('div');
            arrowEl.className = 'start-arrow';
            arrowEl.style.transform = `rotate(${arrowAngle}deg)`;
            arrowEl.style.color = `var(--color-${color})`;
            arrowEl.textContent = '▶';
            cellDiv.appendChild(arrowEl);
        }
        
        // Safe cells star highlights
        if (safeCellIndices.includes(idx)) {
            const safeColor = getSafeColor(idx);
            cellDiv.classList.add('safe-cell', `safe-cell-${safeColor}`);
        }
        
        cellDiv.style.position = 'absolute';
        cellDiv.style.left = `${coord.x}%`;
        cellDiv.style.top = `${coord.y}%`;
        cellDiv.style.width = '5.2%';
        cellDiv.style.height = '5.2%';
        cellDiv.style.transform = 'translate(-50%, -50%)';
        
        boardEl.appendChild(cellDiv);
    });

    // 5. Create Home Path cells (steps 51 to 55)
    colors.forEach((color, p) => {
        const path = playerPaths[color];
        for (let step = 51; step <= 55; step++) {
            const coord = path[step];
            const cellDiv = document.createElement('div');
            cellDiv.className = `cell ${color}-home-path`;
            cellDiv.id = `cell-h-${color}-${step}`;
            
            cellDiv.style.position = 'absolute';
            cellDiv.style.left = `${coord.x}%`;
            cellDiv.style.top = `${coord.y}%`;
            cellDiv.style.width = '5.2%';
            cellDiv.style.height = '5.2%';
            cellDiv.style.transform = 'translate(-50%, -50%)';
            
            boardEl.appendChild(cellDiv);
        }
    });

    // 6. Create effects canvas overlay
    const canvas = document.createElement('canvas');
    canvas.id = 'effects-canvas';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '15';
    boardEl.appendChild(canvas);
}

function getSafeColor(perimeterIdx) {
    const P = colors.length;
    for (let p = 0; p < P; p++) {
        const color = colors[p];
        if (perimeterIdx === p * 13 + 8 || perimeterIdx === p * 13 + 3) {
            return color;
        }
    }
    return 'neutral';
}

function isSafeCell(perimeterIdx) {
    return safeCellIndices.includes(perimeterIdx);
}

// Get clean player labels
function getPlayerName(color) {
    return playerNames[color] || color.toUpperCase();
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

    // 2. Track token groupings per cell ID to manage stacking layouts
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
                // On path cells (perimeter or home path)
                let cellId = '';
                if (step >= 51) {
                    cellId = `cell-h-${color}-${step}`;
                } else {
                    const startIdx = colorStartIndices[color];
                    const idx = (startIdx + step) % perimeterCoordinates.length;
                    cellId = `cell-p-${idx}`;
                }
                
                if (!positionsMap.has(cellId)) {
                    positionsMap.set(cellId, []);
                }
                positionsMap.get(cellId).push(tokenDiv);
            }
        });
    });

    // 3. Render cells with proper stacking CSS
    positionsMap.forEach((tokensArr, cellId) => {
        const cellEl = document.getElementById(cellId);
        if (cellEl) {
            tokensArr.forEach(t => cellEl.appendChild(t));
            const count = tokensArr.length;
            cellEl.classList.add(`stack-${Math.min(count, 4)}`);
        }
    });

    // 4. Update Scoreboard interface for all potential colors
    allColors.forEach(color => {
        const card = document.getElementById(`card-${color}`);
        if (!card) return;
        
        if (!colors.includes(color) || playerTypes[color] === 'off') {
            card.classList.add('hidden');
            return;
        } else {
            card.classList.remove('hidden');
        }

        const homeSpan = document.getElementById(`home-${color}`);
        if (homeSpan) {
            const homeCount = players[color].tokens.filter(t => t.step === 56).length;
            homeSpan.textContent = `${homeCount}/${tokensCount}`;
        }

        // Update name in scoreboard
        const nameEl = card.querySelector('.player-name');
        if (nameEl) {
            nameEl.textContent = getPlayerName(color);
        }

        // Update human vs AI badge correctly
        const badgeEl = card.querySelector('.player-type-badge');
        if (badgeEl) {
            let badgeText = 'AI';
            if (playerTypes[color] === 'human') {
                if (isOnline) {
                    badgeText = (color === myColor) ? 'You' : 'Human';
                } else {
                    badgeText = 'Human';
                }
            } else if (playerTypes[color] === 'ai') {
                badgeText = 'AI';
            }
            badgeEl.textContent = badgeText;
            badgeEl.className = `player-type-badge ${color}-badge`;
        }

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
        const canRelease = (releaseRule === '1or6') ? (roll === 1 || roll === 6) : (roll === 6);
        return canRelease;
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
    
    // Roll dice: boost chance of rolling a 6 if player has zero tokens active on the track
    let roll;
    const activeTokensCount = players[currentTurnColor].tokens.filter(t => t.step >= 0 && t.step < 56).length;
    if (activeTokensCount === 0) {
        // Boosted chance of rolling a 6 (35% probability)
        if (Math.random() < 0.35) {
            roll = 6;
        } else {
            // Uniform roll between 1 and 5
            roll = Math.floor(Math.random() * 5) + 1;
        }
    } else {
        // Standard uniform roll (1 to 6)
        roll = Math.floor(Math.random() * 6) + 1;
    }
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
        
        const startIdx = colorStartIndices[color];
        const cellEl = document.getElementById(`cell-p-${startIdx}`);
        createFloatingParticles(cellEl, `var(--color-${color})`);
        
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
    let isCapture = false;
    let isHomeRun = (step === 56);
    
    let landCellEl = null;
    let myIdx = -1;
    if (step >= 51) {
        landCellEl = document.getElementById(`cell-h-${color}-${step}`);
    } else {
        myIdx = (colorStartIndices[color] + step) % perimeterCoordinates.length;
        landCellEl = document.getElementById(`cell-p-${myIdx}`);
    }
    
    // Check Captures (only if landed cell is not safe)
    if (step < 51 && !isSafeCell(myIdx)) {
        // Loop other players
        for (let otherColor of colors) {
            if (otherColor === color || playerTypes[otherColor] === 'off') continue;
            
            players[otherColor].tokens.forEach((othToken, othId) => {
                if (othToken.step >= 0 && othToken.step < 51) {
                    const othIdx = (colorStartIndices[otherColor] + othToken.step) % perimeterCoordinates.length;
                    if (othIdx === myIdx) {
                        // Capture!
                        othToken.step = -1; // Send to base
                        isCapture = true;
                        logMessage(`BOOM! ${getPlayerName(color)} captured ${getPlayerName(otherColor)}'s token ${othId + 1}!`, color);
                        
                        // Capture particle explosion
                        createFloatingParticles(landCellEl, `var(--color-${otherColor})`, 16);
                    }
                }
            });
        }
    }

    if (isCapture) {
        getAudio().playCapture();
        createScoreboardFloatingText(landCellEl, "CAPTURED!", "var(--color-yellow)");
    }
    
    if (isHomeRun) {
        getAudio().playHome();
        logMessage(`HOORAY! ${getPlayerName(color)} got token ${tokenId + 1} safely Home!`, color);
        
        const centerEl = document.querySelector('.center-star-badge');
        const triangleEl = document.querySelector(`.triangle-${color}`);
        createFloatingParticles(triangleEl || centerEl, `var(--color-${color})`, 20);
        createScoreboardFloatingText(centerEl, "HOME RUN!", `var(--color-${color})`);
        
        // Check if color won
        const finishedCount = players[color].tokens.filter(t => t.step === 56).length;
        if (finishedCount === tokensCount) {
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

    const difficulty = playerDifficulties[currentTurnColor] || 'balanced';
    let bestTokenId;

    if (difficulty === 'easy') {
        const randomIndex = Math.floor(Math.random() * validTokenIds.length);
        bestTokenId = validTokenIds[randomIndex];
    } else {
        bestTokenId = validTokenIds[0];
        let bestScore = -Infinity;

        validTokenIds.forEach(id => {
            const score = evaluateAIMove(currentTurnColor, id, currentRoll);
            if (score > bestScore) {
                bestScore = score;
                bestTokenId = id;
            }
        });
    }

    executeMove(currentTurnColor, bestTokenId, currentRoll);
}

// Rate how good a token move is
function evaluateAIMove(color, tokenId, roll) {
    const token = players[color].tokens[tokenId];
    const currentStep = token.step;
    const nextStep = (currentStep === -1) ? 0 : currentStep + roll;
    
    let score = 0;
    const diff = playerDifficulties[color] || 'balanced';

    const nextIdx = (colorStartIndices[color] + nextStep) % perimeterCoordinates.length;

    // 1. Capture opportunity (Highest priority!)
    if (nextStep < 51 && !isSafeCell(nextIdx)) {
        for (let otherColor of colors) {
            if (otherColor === color || playerTypes[otherColor] === 'off') continue;
            
            players[otherColor].tokens.forEach(othToken => {
                if (othToken.step >= 0 && othToken.step < 51) {
                    const othIdx = (colorStartIndices[otherColor] + othToken.step) % perimeterCoordinates.length;
                    if (othIdx === nextIdx) {
                        if (diff === 'aggressive') {
                            score += 2500; // Extra aggressive capture priority!
                        } else {
                            score += 1200; // Standard capture
                        }
                    }
                }
            });
        }
    }

    // 2. Reach home center
    if (nextStep === 56) {
        if (diff === 'aggressive') {
            score += 500; // Aggressive bots prefer chasing/capturing over finishing quickly
        } else {
            score += 1000;
        }
    }

    // 3. Release token from base
    const canRelease = (releaseRule === '1or6') ? (roll === 1 || roll === 6) : (roll === 6);
    if (currentStep === -1 && canRelease) {
        const activeCount = players[color].tokens.filter(t => t.step >= 0 && t.step < 56).length;
        if (activeCount === 0) {
            score += (diff === 'aggressive') ? 1200 : 800; // Aggressive releases immediately
        } else {
            score += (diff === 'aggressive') ? 600 : 450;
        }
    }

    // 4. Enter safe zone
    const currentIdx = currentStep >= 0 ? (colorStartIndices[color] + currentStep) % perimeterCoordinates.length : -1;
    if (nextStep < 51 && isSafeCell(nextIdx) && (currentStep === -1 || !isSafeCell(currentIdx))) {
        if (diff === 'aggressive') {
            score -= 100; // Aggressive bots penalize hiding in safe zones
        } else {
            score += 300;
        }
    }

    // 5. Escape danger
    if (currentStep >= 0 && currentStep < 51 && !isSafeCell(currentIdx)) {
        let isThreatened = false;
        
        for (let otherColor of colors) {
            if (otherColor === color || playerTypes[otherColor] === 'off') continue;
            
            players[otherColor].tokens.forEach(othToken => {
                if (othToken.step >= 0 && othToken.step < 51) {
                    const dist = getStepsAway(otherColor, othToken.step, color, currentStep);
                    if (dist > 0 && dist <= 6) {
                        isThreatened = true;
                    }
                }
            });
        }

        if (isThreatened) {
            if (diff === 'aggressive') {
                score += 100; // Care less about escape, prioritize forward attack/chase
            } else {
                score += 400;
            }
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
    if (stepA < 0 || stepA >= 51 || stepB < 0 || stepB >= 51) return -1;
    const idxA = (colorStartIndices[colorA] + stepA) % perimeterCoordinates.length;
    const idxB = (colorStartIndices[colorB] + stepB) % perimeterCoordinates.length;
    const N = perimeterCoordinates.length;
    return (idxB - idxA + N) % N;
}

// 7. Premium Visual Feedback: HTML5 Canvas Particles & Text Splashes
let canvasParticles = [];
let particleAnimId = null;

class CanvasParticle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 3 + 2;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.alpha = 1;
        this.decay = Math.random() * 0.02 + 0.015;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= this.decay;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function createFloatingParticles(cellEl, colorCode, count = 12) {
    if (!cellEl) return;
    const boardEl = document.getElementById('ludo-board');
    const canvas = document.getElementById('effects-canvas');
    if (!boardEl || !canvas) return;

    const rect = cellEl.getBoundingClientRect();
    const boardRect = boardEl.getBoundingClientRect();

    // Map position relative to board width/height to canvas coordinate space
    const scaleX = canvas.width / boardRect.width;
    const scaleY = canvas.height / boardRect.height;
    const x = (rect.left - boardRect.left + (rect.width / 2)) * scaleX;
    const y = (rect.top - boardRect.top + (rect.height / 2)) * scaleY;

    // Resolve CSS variables
    let finalColor = colorCode;
    if (colorCode.startsWith('var(')) {
        const cleanName = colorCode.substring(4, colorCode.length - 1).trim();
        finalColor = getComputedStyle(document.documentElement).getPropertyValue(cleanName).trim() || '#ffffff';
    }

    for (let i = 0; i < count; i++) {
        canvasParticles.push(new CanvasParticle(x, y, finalColor));
    }

    triggerCanvasParticleLoop();
}

function triggerCanvasParticleLoop() {
    if (particleAnimId) return;

    const loop = () => {
        const canvas = document.getElementById('effects-canvas');
        if (!canvas) {
            particleAnimId = null;
            return;
        }

        if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
        }

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        canvasParticles = canvasParticles.filter(p => p.alpha > 0);

        canvasParticles.forEach(p => {
            p.update();
            p.draw(ctx);
        });

        if (canvasParticles.length > 0) {
            particleAnimId = requestAnimationFrame(loop);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particleAnimId = null;
        }
    };

    particleAnimId = requestAnimationFrame(loop);
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

function displayFloatingChat(color, message) {
    const cardEl = document.getElementById(`card-${color}`);
    if (!cardEl) return;
    
    const bubble = document.createElement('div');
    bubble.className = 'floating-chat-bubble';
    bubble.textContent = message;
    
    const rect = cardEl.getBoundingClientRect();
    const x = rect.left + window.scrollX + (rect.width / 2);
    const y = rect.top + window.scrollY - 15;
    
    bubble.style.left = `${x}px`;
    bubble.style.top = `${y}px`;
    bubble.style.transform = 'translateX(-50%)';
    bubble.style.borderColor = `var(--color-${color})`;
    bubble.style.boxShadow = `0 0 15px var(--color-${color}-glow)`;
    
    document.body.appendChild(bubble);
    
    setTimeout(() => {
        bubble.remove();
    }, 2500);
}

// 8. Session Management (Start, Reset, End)
function startLudoGame(override = false) {
    if (!override && !isOnline) {
        // Read Game Board Mode
        const boardModeSelect = document.getElementById('local-board-mode-select');
        let boardMode = 4;
        if (boardModeSelect) {
            boardMode = parseInt(boardModeSelect.value, 10) || 4;
        }
        setupBoardGeometry(boardMode);

        // Read setup screen radio inputs
        colors.forEach(color => {
            const checkedInput = document.querySelector(`input[name="p-${color}"]:checked`);
            playerTypes[color] = checkedInput ? checkedInput.value : 'off';

            // Read custom names
            const nameInput = document.getElementById(`name-${color}`);
            if (nameInput && playerTypes[color] !== 'off') {
                playerNames[color] = nameInput.value.trim() || `Player ${allColors.indexOf(color) + 1}`;
            }

            // Read AI difficulty
            const diffSelect = document.getElementById(`difficulty-${color}`);
            if (diffSelect) {
                playerDifficulties[color] = diffSelect.value || 'balanced';
            }
        });

        // Set unused colors to 'off'
        allColors.forEach(color => {
            if (!colors.includes(color)) {
                playerTypes[color] = 'off';
            }
        });

        // Read game options
        const tokensSelect = document.getElementById('local-tokens-count-select');
        if (tokensSelect) {
            tokensCount = parseInt(tokensSelect.value, 10) || 4;
        }
        const releaseSelect = document.getElementById('local-release-rule-select');
        if (releaseSelect) {
            releaseRule = releaseSelect.value || '6';
        }
    }

    // Validate player count (minimum 2 active players)
    activePlayersOrder = colors.filter(c => playerTypes[c] !== 'off');
    if (activePlayersOrder.length < 2) {
        alert("Arena needs at least 2 active players to initiate Ludo combat!");
        return;
    }

    // Initialize/Resume Audio Context
    getAudio().init();

    // Reset states dynamically matching tokensCount for all potential colors
    const initialTokens = Array.from({ length: tokensCount }, () => ({ step: -1 }));
    players = {};
    allColors.forEach(color => {
        players[color] = { tokens: JSON.parse(JSON.stringify(initialTokens)), finished: false };
    });
    
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
    
    // Initialize HTML dynamic path DOM structures
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

function updateNameInputStates() {
    allColors.forEach(color => {
        const checkedInput = document.querySelector(`input[name="p-${color}"]:checked`);
        const type = checkedInput ? checkedInput.value : 'off';
        const nameInput = document.getElementById(`name-${color}`);
        if (!nameInput) return;
        
        if (type === 'off' || !colors.includes(color)) {
            nameInput.disabled = true;
        } else {
            nameInput.disabled = false;
            if (type === 'ai' && (nameInput.value === `Player ${allColors.indexOf(color) + 1}` || nameInput.value === '')) {
                nameInput.value = `NeonBot ${color.charAt(0).toUpperCase() + color.slice(1)}`;
            } else if (type === 'human' && nameInput.value.startsWith('NeonBot ')) {
                nameInput.value = `Player ${allColors.indexOf(color) + 1}`;
            }
        }
    });
}

// 9. Event Listeners Setup
document.addEventListener('DOMContentLoaded', () => {
    // Player configuration inputs change listener
    allColors.forEach(color => {
        const radios = document.querySelectorAll(`input[name="p-${color}"]`);
        radios.forEach(radio => {
            radio.addEventListener('change', updateNameInputStates);
        });
    });

    // Board Mode selector change listener
    const boardModeSelect = document.getElementById('local-board-mode-select');
    if (boardModeSelect) {
        boardModeSelect.addEventListener('change', () => {
            const boardMode = parseInt(boardModeSelect.value, 10) || 4;
            
            // Adjust visual lobby card elements
            allColors.forEach((color, idx) => {
                const card = document.getElementById(`config-card-${color}`);
                if (card) {
                    if (idx < boardMode) {
                        card.classList.remove('hidden');
                    } else {
                        card.classList.add('hidden');
                        // Reset player type to off when hidden
                        const offRadio = document.querySelector(`input[name="p-${color}"][value="off"]`);
                        if (offRadio) offRadio.checked = true;
                    }
                }
            });

            // Re-setup board geometry for local state reference
            setupBoardGeometry(boardMode);
            updateNameInputStates();
        });
    }

    // Online Lobby Settings selector change listeners (Host only)
    const onlineBoardModeSelect = document.getElementById('online-board-mode-select');
    if (onlineBoardModeSelect) {
        onlineBoardModeSelect.addEventListener('change', () => {
            if (!isOnline || !isHost) return;
            const boardMode = parseInt(onlineBoardModeSelect.value, 10) || 4;
            
            setupBoardGeometry(boardMode);
            
            // Adjust player types locally on host
            colors.forEach(c => {
                if (playerTypes[c] === 'off') {
                    playerTypes[c] = 'ai';
                }
            });
            allColors.forEach(c => {
                if (!colors.includes(c)) {
                    playerTypes[c] = 'off';
                }
            });
            
            broadcastLobbyState();
        });
    }

    const onlineTokensCountSelect = document.getElementById('online-tokens-count-select');
    if (onlineTokensCountSelect) {
        onlineTokensCountSelect.addEventListener('change', () => {
            if (!isOnline || !isHost) return;
            tokensCount = parseInt(onlineTokensCountSelect.value, 10) || 4;
            broadcastLobbyState();
        });
    }

    const onlineReleaseRuleSelect = document.getElementById('online-release-rule-select');
    if (onlineReleaseRuleSelect) {
        onlineReleaseRuleSelect.addEventListener('change', () => {
            if (!isOnline || !isHost) return;
            releaseRule = onlineReleaseRuleSelect.value || '6';
            broadcastLobbyState();
        });
    }

    // Call dynamic setup for default 4 players mode initially
    setupBoardGeometry(4);
    updateNameInputStates();

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

    // Audio settings modal toggles
    const audioModal = document.getElementById('audio-settings-modal');
    const showAudio = () => {
        document.getElementById('music-volume-slider').value = getAudio().musicVolume;
        document.getElementById('music-vol-txt').textContent = `${Math.round(getAudio().musicVolume * 100)}%`;
        document.getElementById('sfx-volume-slider').value = getAudio().sfxVolume;
        document.getElementById('sfx-vol-txt').textContent = `${Math.round(getAudio().sfxVolume * 100)}%`;
        audioModal.classList.remove('hidden');
    };
    const hideAudio = () => audioModal.classList.add('hidden');

    const audioSettingsBtn = document.getElementById('audio-settings-btn');
    if (audioSettingsBtn) audioSettingsBtn.addEventListener('click', showAudio);
    
    document.getElementById('close-audio-btn').addEventListener('click', hideAudio);
    document.getElementById('close-audio-footer-btn').addEventListener('click', hideAudio);
    
    audioModal.addEventListener('click', (e) => {
        if (e.target === audioModal) hideAudio();
    });

    // Volume sliders change listeners
    const musicSlider = document.getElementById('music-volume-slider');
    if (musicSlider) {
        musicSlider.addEventListener('input', (e) => {
            const vol = parseFloat(e.target.value);
            getAudio().setMusicVolume(vol);
            document.getElementById('music-vol-txt').textContent = `${Math.round(vol * 100)}%`;
        });
    }

    const sfxSlider = document.getElementById('sfx-volume-slider');
    if (sfxSlider) {
        sfxSlider.addEventListener('input', (e) => {
            const vol = parseFloat(e.target.value);
            getAudio().setSfxVolume(vol);
            document.getElementById('sfx-vol-txt').textContent = `${Math.round(vol * 100)}%`;
        });
    }

    // Dice Skin change listener
    const diceSkinSelect = document.getElementById('dice-skin-select');
    if (diceSkinSelect) {
        diceSkinSelect.addEventListener('change', (e) => {
            const skin = e.target.value;
            const diceEl = document.getElementById('dice');
            if (diceEl) {
                diceEl.classList.remove('dice-skin-chromeglass', 'dice-skin-matrix');
                if (skin === 'chromeglass') {
                    diceEl.classList.add('dice-skin-chromeglass');
                } else if (skin === 'matrix') {
                    diceEl.classList.add('dice-skin-matrix');
                }
            }
        });
    }

    // Quick Chat event listener
    const reactionButtons = document.querySelectorAll('.chat-reaction-btn');
    reactionButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const msg = btn.getAttribute('data-msg');
            if (isOnline) {
                if (isHost) {
                    connections.forEach(conn => {
                        if (conn.open) {
                            conn.send({
                                type: 'CHAT_MSG',
                                color: myColor,
                                message: msg
                            });
                        }
                    });
                } else {
                    if (hostConn && hostConn.open) {
                        hostConn.send({
                            type: 'CHAT_MSG',
                            color: myColor,
                            message: msg
                        });
                    }
                }
            }
            displayFloatingChat(myColor, msg);
            logMessage(`[CHAT] ${getPlayerName(myColor)}: ${msg}`, myColor);
        });
    });

    // Auto-start music loop on first user interaction
    const startMusicOnGesture = () => {
        getAudio().startMusic();
        document.removeEventListener('click', startMusicOnGesture);
        document.removeEventListener('keydown', startMusicOnGesture);
    };
    document.addEventListener('click', startMusicOnGesture);
    document.addEventListener('keydown', startMusicOnGesture);

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
    
    // Read local username
    const onlineName = document.getElementById('online-player-name').value.trim() || 'Guest';
    playerNames.red = onlineName;

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
        
        // Enable online settings dropdowns and show container for host
        const onlineSettings = document.querySelector('.online-settings-container');
        if (onlineSettings) onlineSettings.classList.remove('hidden');

        const boardModeSelect = document.getElementById('online-board-mode-select');
        const tokensSelect = document.getElementById('online-tokens-count-select');
        const releaseSelect = document.getElementById('online-release-rule-select');
        if (boardModeSelect) boardModeSelect.disabled = false;
        if (tokensSelect) tokensSelect.disabled = false;
        if (releaseSelect) releaseSelect.disabled = false;

        const boardMode = boardModeSelect ? parseInt(boardModeSelect.value, 10) : 4;
        setupBoardGeometry(boardMode);

        if (tokensSelect) tokensCount = parseInt(tokensSelect.value, 10) || 4;
        if (releaseSelect) releaseRule = releaseSelect.value || '6';

        // Reset player types locally
        colors.forEach(c => {
            playerTypes[c] = (c === 'red') ? 'human' : 'ai';
        });
        allColors.forEach(c => {
            if (!colors.includes(c)) {
                playerTypes[c] = 'off';
            }
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
            playerTypes: playerTypes,
            colors: colors,
            tokensCount: tokensCount,
            releaseRule: releaseRule
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
        playerTypes: playerTypes,
        playerNames: playerNames,
        colors: colors,
        tokensCount: tokensCount,
        releaseRule: releaseRule
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

            // Hide online settings dropdowns for clients completely
            const onlineSettings = document.querySelector('.online-settings-container');
            if (onlineSettings) onlineSettings.classList.add('hidden');

            const boardModeSelect = document.getElementById('online-board-mode-select');
            const tokensSelect = document.getElementById('online-tokens-count-select');
            const releaseSelect = document.getElementById('online-release-rule-select');
            if (boardModeSelect) boardModeSelect.disabled = true;
            if (tokensSelect) tokensSelect.disabled = true;
            if (releaseSelect) releaseSelect.disabled = true;
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
            if (data.colors) {
                setupBoardGeometry(data.colors.length);
                const select = document.getElementById('online-board-mode-select');
                if (select) select.value = data.colors.length;
            }
            if (data.tokensCount) {
                tokensCount = data.tokensCount;
                const select = document.getElementById('online-tokens-count-select');
                if (select) select.value = tokensCount;
            }
            if (data.releaseRule) {
                releaseRule = data.releaseRule;
                const select = document.getElementById('online-release-rule-select');
                if (select) select.value = releaseRule;
            }
            
            // Send client name to host
            const onlineName = document.getElementById('online-player-name').value.trim() || 'Guest';
            hostConn.send({
                type: 'SET_PLAYER_NAME',
                name: onlineName
            });

            logMessage(`Connected as ${getPlayerName(myColor)}!`, myColor);
            updateOnlineLobbyUI();
            break;
            
        case 'LOBBY_UPDATE':
            playerTypes = data.playerTypes;
            if (data.playerNames) {
                playerNames = data.playerNames;
            }
            if (data.colors) {
                setupBoardGeometry(data.colors.length);
                const select = document.getElementById('online-board-mode-select');
                if (select) select.value = data.colors.length;
            }
            if (data.tokensCount) {
                tokensCount = data.tokensCount;
                const select = document.getElementById('online-tokens-count-select');
                if (select) select.value = tokensCount;
            }
            if (data.releaseRule) {
                releaseRule = data.releaseRule;
                const select = document.getElementById('online-release-rule-select');
                if (select) select.value = releaseRule;
            }
            updateOnlineLobbyUI();
            break;
            
        case 'LOBBY_FULL':
            alert("Lobby is full!");
            resetOnlineState();
            break;
            
        case 'GAME_START':
            playerTypes = data.playerTypes;
            if (data.playerNames) playerNames = data.playerNames;
            if (data.tokensCount) tokensCount = data.tokensCount;
            if (data.releaseRule) releaseRule = data.releaseRule;
            activePlayersOrder = data.activePlayersOrder;
            currentTurnColor = data.currentTurnColor;
            
            if (data.colors) {
                setupBoardGeometry(data.colors.length);
            } else {
                setupBoardGeometry(4);
            }
            
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
            if (data.state.playerNames) playerNames = data.state.playerNames;
            if (data.state.tokensCount) tokensCount = data.state.tokensCount;
            if (data.state.releaseRule) releaseRule = data.state.releaseRule;
            
            if (data.state.colors) {
                setupBoardGeometry(data.state.colors.length);
            }
            
            initBoardDOM();
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
            displayFloatingChat(data.color, data.message);
            logMessage(`[CHAT] ${getPlayerName(data.color)}: ${data.message}`, data.color);
            break;
    }
}

function handleHostReceivedData(peerId, data) {
    const senderColor = peerIdToColorMap[peerId];
    if (!senderColor) return;

    switch (data.type) {
        case 'SET_PLAYER_NAME':
            if (data.name) {
                playerNames[senderColor] = data.name;
                logMessage(`Player ${senderColor.toUpperCase()} set name to "${data.name}".`, senderColor);
                broadcastLobbyState();
            }
            break;

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

        case 'CHAT_MSG':
            // Re-broadcast to all other clients
            connections.forEach(conn => {
                if (conn.open && conn.peer !== peerId) {
                    conn.send({
                        type: 'CHAT_MSG',
                        color: data.color,
                        message: data.message
                    });
                }
            });
            displayFloatingChat(data.color, data.message);
            logMessage(`[CHAT] ${getPlayerName(data.color)}: ${data.message}`, data.color);
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
            playerTypes: playerTypes,
            playerNames: playerNames,
            tokensCount: tokensCount,
            releaseRule: releaseRule,
            colors: colors
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
    
    // Read Board Mode
    const boardModeSelect = document.getElementById('board-mode-select');
    let boardMode = 4;
    if (boardModeSelect) {
        boardMode = parseInt(boardModeSelect.value, 10) || 4;
    }
    setupBoardGeometry(boardMode);

    activePlayersOrder = colors.filter(c => playerTypes[c] !== 'off');
    if (activePlayersOrder.length < 2) {
        alert("Lobby needs at least 2 active players to initiate!");
        return;
    }
    
    // Read local options to start game with correct configuration
    const tokensSelect = document.getElementById('tokens-count-select');
    if (tokensSelect) {
        tokensCount = parseInt(tokensSelect.value, 10) || 4;
    }
    const releaseSelect = document.getElementById('release-rule-select');
    if (releaseSelect) {
        releaseRule = releaseSelect.value || '6';
    }

    // Broadcast start to clients
    connections.forEach(conn => {
        if (conn.open) {
            conn.send({
                type: 'GAME_START',
                playerTypes: playerTypes,
                playerNames: playerNames,
                tokensCount: tokensCount,
                releaseRule: releaseRule,
                activePlayersOrder: activePlayersOrder,
                currentTurnColor: currentTurnColor,
                colors: colors
            });
        }
    });
    
    startLudoGame(true);
}

function updateOnlineLobbyUI() {
    allColors.forEach(color => {
        const pill = document.getElementById(`slot-pill-${color}`);
        const nameSpan = document.getElementById(`slot-name-${color}`);
        if (!pill || !nameSpan) return;

        if (!colors.includes(color)) {
            pill.classList.add('hidden');
            return;
        }
        pill.classList.remove('hidden');
        pill.className = `player-slot-pill pill-${color}`;

        if (playerTypes[color] === 'human') {
            pill.classList.remove('empty-slot');
            let labelSuffix = '';
            if (color === 'red') {
                labelSuffix = isHost ? ' (Host) (You)' : ' (Host)';
            } else {
                if (isOnline) {
                    labelSuffix = (color === myColor) ? ' (You)' : ' (Client)';
                }
            }
            nameSpan.textContent = `${getPlayerName(color)}${labelSuffix}`;
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

    const onlineSettings = document.querySelector('.online-settings-container');
    if (onlineSettings) onlineSettings.classList.add('hidden');
    
    const joinStatus = document.getElementById('join-status-txt');
    if (joinStatus) joinStatus.textContent = '';
    
    const codeTxt = document.getElementById('lobby-code-txt');
    if (codeTxt) codeTxt.textContent = 'NEON-XXXX';
    
    const codeInput = document.getElementById('join-code-input');
    if (codeInput) codeInput.value = '';
    
    setupBoardGeometry(4);
    colors.forEach(c => {
        playerTypes[c] = (c === 'red') ? 'human' : 'ai';
    });
    allColors.forEach(c => {
        if (!colors.includes(c)) {
            playerTypes[c] = 'off';
        }
    });
    playerNames = {
        red: 'Player 1 (Red)',
        green: 'Player 2 (Green)',
        yellow: 'Player 3 (Yellow)',
        blue: 'Player 4 (Blue)',
        orange: 'Player 5 (Orange)',
        purple: 'Player 6 (Purple)'
    };
    playerDifficulties = {
        red: 'balanced',
        green: 'balanced',
        yellow: 'balanced',
        blue: 'balanced',
        orange: 'balanced',
        purple: 'balanced'
    };
    tokensCount = 4;
    releaseRule = '6';
    
    updateOnlineLobbyUI();
}
