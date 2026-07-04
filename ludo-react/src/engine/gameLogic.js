// LUDO NEON - Core Game Logic (Pure Functions)
// No DOM/React dependencies — all functions take game state as parameters

import {
  isPerimeterStep, isSafeCell, getPerimeterIndex,
  getFinalStep, getStepsAway
} from './boardGeometry.js';

// ─── Token Movement Rules ────────────────────────────────────────────────────

export function canTokenMove(geo, players, releaseRule, color, tokenId, roll) {
  if (!players[color]?.tokens?.[tokenId]) return false;
  const step = players[color].tokens[tokenId].step;
  if (step === -1) {
    return releaseRule === '1or6' ? (roll === 1 || roll === 6) : roll === 6;
  }
  if (step === getFinalStep(geo)) return false;
  return step + roll <= getFinalStep(geo);
}

export function getMovableTokenIds(geo, players, releaseRule, color, roll) {
  return players[color].tokens
    .map((_, id) => id)
    .filter(id => canTokenMove(geo, players, releaseRule, color, id, roll));
}

export function hasValidMoves(geo, players, releaseRule, color, roll) {
  return players[color].tokens.some((_, id) =>
    canTokenMove(geo, players, releaseRule, color, id, roll)
  );
}

// ─── Landing / Capture Resolution ────────────────────────────────────────────

export function resolveLanding(geo, players, playerTypes, color, tokenId) {
  const step = players[color].tokens[tokenId].step;
  const finalStep = getFinalStep(geo);

  let isCapture = false;
  let isHomeRun = step === finalStep;
  const capturedTokens = [];

  // Check captures (only on perimeter, not safe cells)
  if (isPerimeterStep(geo, step)) {
    const myIdx = getPerimeterIndex(geo, color, step);
    if (!isSafeCell(geo, myIdx)) {
      for (const otherColor of geo.colors) {
        if (otherColor === color || playerTypes[otherColor] === 'off') continue;
        players[otherColor].tokens.forEach((othToken, othId) => {
          if (isPerimeterStep(geo, othToken.step)) {
            const othIdx = getPerimeterIndex(geo, otherColor, othToken.step);
            if (othIdx === myIdx) {
              othToken.step = -1;
              isCapture = true;
              capturedTokens.push({ color: otherColor, tokenId: othId });
            }
          }
        });
      }
    }
  }

  if (isHomeRun) {
    const finishedCount = players[color].tokens.filter(t => t.step === finalStep).length;
    if (finishedCount === players[color].tokens.length) {
      players[color].finished = true;
    }
  }

  return { isCapture, isHomeRun, capturedTokens };
}

// ─── AI Decision Engine ──────────────────────────────────────────────────────

export function evaluateAIMove(geo, players, playerTypes, releaseRule, difficulty, color, tokenId, roll) {
  const token = players[color].tokens[tokenId];
  const currentStep = token.step;
  const nextStep = currentStep === -1 ? 0 : currentStep + roll;
  const finalStep = getFinalStep(geo);

  let score = 0;
  const diff = difficulty || 'balanced';
  const nextIdx = isPerimeterStep(geo, nextStep) ? getPerimeterIndex(geo, color, nextStep) : -1;

  // 1. Capture opportunity
  if (isPerimeterStep(geo, nextStep) && !isSafeCell(geo, nextIdx)) {
    for (const otherColor of geo.colors) {
      if (otherColor === color || playerTypes[otherColor] === 'off') continue;
      players[otherColor].tokens.forEach(othToken => {
        if (isPerimeterStep(geo, othToken.step)) {
          const othIdx = getPerimeterIndex(geo, otherColor, othToken.step);
          if (othIdx === nextIdx) {
            score += diff === 'aggressive' ? 2500 : 1200;
          }
        }
      });
    }
  }

  // 2. Reach home
  if (nextStep === finalStep) {
    score += diff === 'aggressive' ? 500 : 1000;
  }

  // 3. Release from base
  const canRelease = releaseRule === '1or6' ? (roll === 1 || roll === 6) : roll === 6;
  if (currentStep === -1 && canRelease) {
    const activeCount = players[color].tokens.filter(t => t.step >= 0 && t.step < finalStep).length;
    score += activeCount === 0
      ? (diff === 'aggressive' ? 1200 : 800)
      : (diff === 'aggressive' ? 600 : 450);
  }

  // 4. Enter safe zone
  if (currentStep >= 0) {
    const currentIdx = getPerimeterIndex(geo, color, currentStep);
    if (isPerimeterStep(geo, nextStep) && isSafeCell(geo, nextIdx) &&
        (currentStep === -1 || !isSafeCell(geo, currentIdx))) {
      score += diff === 'aggressive' ? -100 : 300;
    }

    // 5. Escape danger
    if (isPerimeterStep(geo, currentStep) && !isSafeCell(geo, currentIdx)) {
      let isThreatened = false;
      for (const otherColor of geo.colors) {
        if (otherColor === color || playerTypes[otherColor] === 'off') continue;
        players[otherColor].tokens.forEach(othToken => {
          if (isPerimeterStep(geo, othToken.step)) {
            const dist = getStepsAway(geo, otherColor, othToken.step, color, currentStep);
            if (dist > 0 && dist <= 6) isThreatened = true;
          }
        });
      }
      if (isThreatened) {
        score += diff === 'aggressive' ? 100 : 400;
      }
    }
  }

  // 6. Advance preference
  if (currentStep > 35) {
    score += nextStep * 1.5;
  } else {
    score += nextStep * 0.5;
  }

  score += Math.random() * 15;
  return score;
}

export function pickAITokenId(geo, players, playerTypes, playerDifficulties, releaseRule, color, roll) {
  const validIds = players[color].tokens
    .map((_, id) => id)
    .filter(id => canTokenMove(geo, players, releaseRule, color, id, roll));

  if (validIds.length === 0) return null;

  const diff = playerDifficulties[color] || 'balanced';
  if (diff === 'easy') {
    return validIds[Math.floor(Math.random() * validIds.length)];
  }

  let best = validIds[0];
  let bestScore = -Infinity;
  validIds.forEach(id => {
    const s = evaluateAIMove(geo, players, playerTypes, releaseRule, diff, color, id, roll);
    if (s > bestScore) { bestScore = s; best = id; }
  });
  return best;
}

// ─── Dice ─────────────────────────────────────────────────────────────────────

export function rollDice(players, color, diceMode, finalStep) {
  if (diceMode === 'boosted') {
    const activeCount = players[color].tokens.filter(
      t => t.step >= 0 && t.step < finalStep
    ).length;
    if (activeCount === 0) {
      return Math.random() < 0.35 ? 6 : Math.floor(Math.random() * 5) + 1;
    }
  }
  return Math.floor(Math.random() * 6) + 1;
}
