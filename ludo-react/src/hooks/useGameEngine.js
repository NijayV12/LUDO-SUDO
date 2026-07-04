import { useReducer, useCallback, useRef, useEffect } from 'react';
import { buildBoardGeometry, ALL_COLORS } from '../engine/boardGeometry.js';
import {
  canTokenMove, getMovableTokenIds, hasValidMoves,
  resolveLanding, pickAITokenId, rollDice
} from '../engine/gameLogic.js';
import { audioManager } from '../engine/audioManager.js';

// ─── Phases ───────────────────────────────────────────────────────────────────
export const PHASE_SETUP = 'setup';
export const PHASE_ROLL  = 'roll';
export const PHASE_MOVE  = 'move';
export const PHASE_OVER  = 'over';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Initial State ────────────────────────────────────────────────────────────
function makeInitialPlayers(tokensCount) {
  const tokens = Array.from({ length: tokensCount }, () => ({ step: -1 }));
  const players = {};
  ALL_COLORS.forEach(c => { players[c] = { tokens: JSON.parse(JSON.stringify(tokens)), finished: false }; });
  return players;
}

const DEFAULT_STATE = {
  playerTypes:        { red:'human', green:'ai', yellow:'ai', blue:'ai', orange:'ai', purple:'ai' },
  playerNames:        { red:'Player 1', green:'Player 2', yellow:'Player 3', blue:'Player 4', orange:'Player 5', purple:'Player 6' },
  playerDifficulties: { red:'balanced', green:'balanced', yellow:'balanced', blue:'balanced', orange:'balanced', purple:'balanced' },
  tokensCount:        4,
  releaseRule:        '6',
  diceMode:           'boosted',
  bonusRollRule:      'all',
  tripleSixRule:      'skip',
  boardMode:          4,
  geo:                null,
  phase:              PHASE_SETUP,
  players:            makeInitialPlayers(4),
  activePlayersOrder: [],
  activeOrderIndex:   0,
  currentTurnColor:   'red',
  currentRoll:        0,
  consecutiveSixes:   0,
  isRolling:          false,
  isAnimating:        false,
  movingTokenKey:     null,
  gameWinnerList:     [],
  logs:               [{ text: 'Welcome to LUDO NEON! Ready to play.', color: 'system', id: 0 }],
  logCounter:         1,
  isOnline:           false,
  isHost:             false,
  myColor:            'red',
  diceSkin:           'hologram',
};

// ─── Reducer ──────────────────────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {
    case 'START_GAME': {
      const p = action.payload;
      return {
        ...state,
        geo: p.geo, activePlayersOrder: p.activePlayersOrder, players: p.players,
        playerTypes: p.playerTypes, playerNames: p.playerNames, playerDifficulties: p.playerDifficulties,
        tokensCount: p.tokensCount, releaseRule: p.releaseRule, diceMode: p.diceMode,
        bonusRollRule: p.bonusRollRule, tripleSixRule: p.tripleSixRule,
        phase: PHASE_ROLL, activeOrderIndex: 0, currentTurnColor: p.activePlayersOrder[0],
        currentRoll: 0, consecutiveSixes: 0, isRolling: false, isAnimating: false,
        movingTokenKey: null, gameWinnerList: [],
        logs: [
          { text: '--- GAME STARTED ---', color: 'system', id: 0 },
          { text: `Warriors: ${p.activePlayersOrder.map(c => c.toUpperCase()).join(', ')}`, color: 'system', id: 1 }
        ],
        logCounter: 2,
      };
    }
    case 'ADD_LOG': {
      return {
        ...state,
        logs: [...state.logs, { text: action.payload.text, color: action.payload.color, id: state.logCounter }],
        logCounter: state.logCounter + 1,
      };
    }
    case 'SET_ROLLING': return { ...state, isRolling: action.payload };
    case 'SET_ROLL_RESULT': return { ...state, currentRoll: action.payload.roll, consecutiveSixes: action.payload.consecutiveSixes, isRolling: false };
    case 'SET_PHASE': return { ...state, phase: action.payload };
    case 'SET_ANIMATING': return { ...state, isAnimating: action.payload, movingTokenKey: action.payload ? state.movingTokenKey : null };
    case 'SET_MOVING_TOKEN': return { ...state, movingTokenKey: action.payload };
    case 'UPDATE_TOKEN_STEP': {
      const { color, tokenId, step } = action.payload;
      const newPlayers = JSON.parse(JSON.stringify(state.players));
      newPlayers[color].tokens[tokenId].step = step;
      return { ...state, players: newPlayers };
    }
    case 'APPLY_LANDING': {
      return { ...state, players: JSON.parse(JSON.stringify(action.payload.players)), gameWinnerList: action.payload.gameWinnerList };
    }
    case 'NEXT_TURN': {
      const { activeOrderIndex, currentTurnColor, consecutiveSixes } = action.payload;
      return { ...state, phase: PHASE_ROLL, activeOrderIndex, currentTurnColor, consecutiveSixes, currentRoll: 0, isRolling: false, isAnimating: false, movingTokenKey: null };
    }
    case 'GAME_OVER': return { ...state, phase: PHASE_OVER, gameWinnerList: action.payload };
    case 'RESET': return { ...DEFAULT_STATE };
    case 'SET_DICE_SKIN': return { ...state, diceSkin: action.payload };
    default: return state;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useGameEngine() {
  const [state, dispatch] = useReducer(reducer, DEFAULT_STATE);

  // Always-fresh state ref — so async callbacks never capture stale state
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Prevent double moves
  const pendingMove = useRef(false);

  // ── Logging ──
  const addLog = useCallback((text, color = 'system') => {
    dispatch({ type: 'ADD_LOG', payload: { text, color } });
  }, []);

  const getPlayerName = useCallback((color) => {
    return stateRef.current.playerNames[color] || color.toUpperCase();
  }, []);

  // ── Start Game ──
  const startGame = useCallback((config) => {
    const { playerTypes, playerNames, playerDifficulties, tokensCount, releaseRule, diceMode, bonusRollRule, tripleSixRule, boardMode } = config;
    const geo = buildBoardGeometry(boardMode);
    const activePlayersOrder = geo.colors.filter(c => playerTypes[c] !== 'off');
    if (activePlayersOrder.length < 2) { alert('Need at least 2 active players!'); return false; }

    audioManager.init();
    const players = makeInitialPlayers(tokensCount);
    dispatch({ type: 'START_GAME', payload: { geo, activePlayersOrder, players, playerTypes, playerNames, playerDifficulties, tokensCount, releaseRule, diceMode, bonusRollRule, tripleSixRule } });
    return true;
  }, []);

  // ── Advance Turn (reads from stateRef for freshness) ──
  const advanceTurn = useCallback((overrideState) => {
    const s = overrideState || stateRef.current;
    const { activePlayersOrder, activeOrderIndex, playerTypes, players } = s;
    let nextIdx = activeOrderIndex;
    let loops = 0;
    do {
      nextIdx = (nextIdx + 1) % activePlayersOrder.length;
      loops++;
    } while (
      (playerTypes[activePlayersOrder[nextIdx]] === 'off' || players[activePlayersOrder[nextIdx]]?.finished)
      && loops <= activePlayersOrder.length
    );

    const nextColor = activePlayersOrder[nextIdx];
    dispatch({ type: 'ADD_LOG', payload: { text: `${s.playerNames[nextColor] || nextColor}'s turn.`, color: nextColor } });
    dispatch({ type: 'NEXT_TURN', payload: { activeOrderIndex: nextIdx, currentTurnColor: nextColor, consecutiveSixes: 0 } });

    // Schedule AI turn
    if (playerTypes[nextColor] === 'ai') {
      setTimeout(() => rollRef.current(), 1000);
    }
  }, []);

  // ── Execute move ──
  const doMove = useCallback(async (color, tokenId, roll, overrideState) => {
    if (pendingMove.current) return;
    pendingMove.current = true;

    const s = overrideState || stateRef.current;
    const { geo, playerTypes, activePlayersOrder, activeOrderIndex, gameWinnerList: origWinners } = s;

    // Clone players to work with
    const workPlayers = JSON.parse(JSON.stringify(s.players));
    const token = workPlayers[color].tokens[tokenId];
    const startStep = token.step;
    const finalStep = geo.finalStep;

    dispatch({ type: 'SET_ANIMATING', payload: true });
    dispatch({ type: 'SET_MOVING_TOKEN', payload: `${color}-${tokenId}` });

    if (startStep === -1) {
      token.step = 0;
      audioManager.playRelease();
      addLog(`${getPlayerName(color)} released token ${tokenId + 1}.`, color);
      dispatch({ type: 'UPDATE_TOKEN_STEP', payload: { color, tokenId, step: 0 } });
      await sleep(200);
    } else {
      const targetStep = Math.min(startStep + roll, finalStep);
      for (let step = startStep + 1; step <= targetStep; step++) {
        token.step = step;
        audioManager.playStep(step - startStep);
        dispatch({ type: 'UPDATE_TOKEN_STEP', payload: { color, tokenId, step } });
        await sleep(160);
      }
    }

    dispatch({ type: 'SET_MOVING_TOKEN', payload: null });

    // Resolve landing (modifies workPlayers in place)
    const { isCapture, isHomeRun, capturedTokens } = resolveLanding(geo, workPlayers, playerTypes, color, tokenId);

    if (isCapture) {
      audioManager.playCapture();
      capturedTokens.forEach(ct => {
        addLog(`BOOM! ${getPlayerName(color)} captured ${getPlayerName(ct.color)}'s token!`, color);
        dispatch({ type: 'UPDATE_TOKEN_STEP', payload: { color: ct.color, tokenId: ct.tokenId, step: -1 } });
      });
    }
    if (isHomeRun) {
      audioManager.playHome();
      addLog(`${getPlayerName(color)} got token ${tokenId + 1} home!`, color);
    }

    // Check winner
    let newWinners = [...origWinners];
    if (isHomeRun && workPlayers[color].finished && !newWinners.includes(color)) {
      newWinners.push(color);
      const place = newWinners.length;
      const suffix = place === 1 ? 'st' : place === 2 ? 'nd' : place === 3 ? 'rd' : 'th';
      addLog(`🏆 ${getPlayerName(color)} finishes ${place}${suffix}!`, color);
    }

    dispatch({ type: 'APPLY_LANDING', payload: { players: workPlayers, gameWinnerList: newWinners } });
    dispatch({ type: 'SET_ANIMATING', payload: false });
    pendingMove.current = false;

    // Game over?
    const finishedCount = activePlayersOrder.filter(c => workPlayers[c].finished).length;
    if (finishedCount >= activePlayersOrder.length - 1) {
      audioManager.playWin();
      addLog('--- MATCH CONCLUDED ---', 'system');
      dispatch({ type: 'GAME_OVER', payload: newWinners });
      return;
    }

    // Extra roll?
    const bonusRule = s.bonusRollRule;
    const getsBonus =
      ((roll === 6 && bonusRule !== 'none') ||
       (isCapture && bonusRule === 'all') ||
       (isHomeRun && bonusRule === 'all')) &&
      !workPlayers[color].finished;

    if (getsBonus) {
      addLog(`${getPlayerName(color)} earns an extra roll!`, color);
      dispatch({ type: 'SET_PHASE', payload: PHASE_ROLL });
      if (playerTypes[color] === 'ai') {
        await sleep(800);
        rollRef.current();
      }
    } else {
      const nextState = { ...stateRef.current, players: workPlayers, gameWinnerList: newWinners, activeOrderIndex };
      advanceTurn(nextState);
    }
  }, [addLog, getPlayerName, advanceTurn]);

  // ── Roll Dice ──
  const triggerDiceRoll = useCallback(async () => {
    const s = stateRef.current;
    if (s.isRolling || s.isAnimating || s.phase !== PHASE_ROLL) return;

    dispatch({ type: 'SET_ROLLING', payload: true });
    audioManager.playRoll();
    await sleep(700);

    const roll = rollDice(s.players, s.currentTurnColor, s.diceMode, s.geo ? s.geo.finalStep : 56);
    const newSixes = roll === 6 ? s.consecutiveSixes + 1 : 0;

    dispatch({ type: 'SET_ROLL_RESULT', payload: { roll, consecutiveSixes: newSixes } });
    addLog(`${getPlayerName(s.currentTurnColor)} rolled a ${roll}!`, s.currentTurnColor);

    const color = s.currentTurnColor;
    const { geo, players, playerTypes, playerDifficulties, releaseRule, tripleSixRule } = s;

    // Three 6s check
    if (roll === 6 && newSixes >= 3 && tripleSixRule === 'skip') {
      addLog('Three consecutive 6s! Turn skipped.', 'system');
      dispatch({ type: 'SET_PHASE', payload: PHASE_MOVE });
      await sleep(1200);
      advanceTurn({ ...stateRef.current, consecutiveSixes: 0 });
      return;
    }

    dispatch({ type: 'SET_PHASE', payload: PHASE_MOVE });

    // Valid moves?
    if (!hasValidMoves(geo, players, releaseRule, color, roll)) {
      addLog(`No valid moves for ${getPlayerName(color)}.`, 'system');
      await sleep(1200);
      advanceTurn(stateRef.current);
      return;
    }

    // Human or AI?
    if (playerTypes[color] === 'human') {
      const movable = getMovableTokenIds(geo, players, releaseRule, color, roll);
      if (movable.length === 1) {
        addLog('Auto-moving only token.', color);
        await sleep(350);
        await doMove(color, movable[0], roll, { ...stateRef.current, currentRoll: roll });
      }
      // else: wait for click
    } else {
      await sleep(900);
      const bestId = pickAITokenId(geo, players, playerTypes, playerDifficulties, releaseRule, color, roll);
      if (bestId !== null) {
        await doMove(color, bestId, roll, { ...stateRef.current, currentRoll: roll });
      } else {
        advanceTurn(stateRef.current);
      }
    }
  }, [addLog, getPlayerName, advanceTurn, doMove]);

  // Stable ref so advanceTurn & doMove can call triggerDiceRoll without circular dep
  const rollRef = useRef(triggerDiceRoll);
  useEffect(() => { rollRef.current = triggerDiceRoll; }, [triggerDiceRoll]);

  // ── Handle AI auto-start after START_GAME ──
  useEffect(() => {
    if (state.phase === PHASE_ROLL && !state.isRolling && !state.isAnimating && state.geo) {
      if (state.playerTypes[state.currentTurnColor] === 'ai') {
        const timer = setTimeout(() => rollRef.current(), 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [state.phase, state.currentTurnColor, state.geo, state.isRolling, state.isAnimating, state.playerTypes]);

  // ── Human Token Click ──
  const handleTokenClick = useCallback(async (color, tokenId) => {
    const s = stateRef.current;
    if (pendingMove.current) return;
    if (s.phase !== PHASE_MOVE || color !== s.currentTurnColor || s.playerTypes[color] !== 'human' || s.isAnimating) return;
    if (!canTokenMove(s.geo, s.players, s.releaseRule, color, tokenId, s.currentRoll)) return;

    await doMove(color, tokenId, s.currentRoll, s);
  }, [doMove]);

  // ── Reset ──
  const resetGame = useCallback(() => {
    pendingMove.current = false;
    dispatch({ type: 'RESET' });
  }, []);

  return {
    state,
    dispatch,
    startGame,
    triggerDiceRoll,
    handleTokenClick,
    resetGame,
    addLog,
    getPlayerName,
    audioManager,
  };
}
