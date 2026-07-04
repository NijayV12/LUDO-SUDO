// LUDO NEON - Board Geometry Engine (Pure Functions)
// Ported from game.js — no DOM/React dependencies

export const ALL_COLORS = ['red', 'green', 'yellow', 'blue', 'orange', 'purple'];

export function buildBoardGeometry(numPlayers) {
  const colors = ALL_COLORS.slice(0, numPlayers);

  let perimeterCoordinates = [];
  const colorStartIndices = {};
  const safeCellIndices = [];
  const playerPaths = {};
  const baseCoordinates = {};
  const homeTokenCoordinates = {};

  const C = { x: 50, y: 50 };
  const r_inner = 12.0;
  const r_outer = 37.5;
  const r_tip = 42.0;
  const w = 5.5;

  const r = [];
  for (let i = 0; i < 6; i++) {
    r.push(r_outer - i * (r_outer - r_inner) / 5);
  }

  const alpha = [];
  const beta = [];
  for (let p = 0; p < numPlayers; p++) {
    const a = p * (2 * Math.PI / numPlayers) - Math.PI;
    alpha.push(a);
    beta.push(a + Math.PI / numPlayers);
  }

  // Build perimeter track
  for (let p = 0; p < numPlayers; p++) {
    const u = { x: Math.cos(alpha[p]), y: Math.sin(alpha[p]) };
    const v = { x: -Math.sin(alpha[p]), y: Math.cos(alpha[p]) };
    const armIndexStart = perimeterCoordinates.length;

    // Outgoing cells (6 cells)
    for (let i = 5; i >= 0; i--) {
      perimeterCoordinates.push({
        x: C.x + r[i] * u.x - w * v.x,
        y: C.y + r[i] * u.y - w * v.y,
      });
    }
    // Outer tip (1 cell)
    perimeterCoordinates.push({ x: C.x + r_tip * u.x, y: C.y + r_tip * u.y });
    // Ingoing cells (6 cells)
    for (let i = 0; i < 6; i++) {
      perimeterCoordinates.push({
        x: C.x + r[i] * u.x + w * v.x,
        y: C.y + r[i] * u.y + w * v.y,
      });
    }

    const color = colors[p];
    colorStartIndices[color] = armIndexStart + 8;
    safeCellIndices.push(armIndexStart + 8);
    safeCellIndices.push(armIndexStart + 3);

    baseCoordinates[color] = {
      x: C.x + 34.0 * Math.cos(beta[p]),
      y: C.y + 34.0 * Math.sin(beta[p]),
    };
    homeTokenCoordinates[color] = {
      x: C.x + 7.5 * Math.cos(alpha[p]),
      y: C.y + 7.5 * Math.sin(alpha[p]),
    };
  }

  // Build player paths
  const homeEntryStep = perimeterCoordinates.length - 1;
  colors.forEach((color, p) => {
    const path = [];
    const startIdx = colorStartIndices[color];
    const N = perimeterCoordinates.length;

    for (let i = 0; i < homeEntryStep; i++) {
      const idx = (startIdx + i) % N;
      path.push(perimeterCoordinates[idx]);
    }

    const u = { x: Math.cos(alpha[p]), y: Math.sin(alpha[p]) };
    for (let i = 1; i <= 5; i++) {
      path.push({ x: C.x + r[i] * u.x, y: C.y + r[i] * u.y });
    }
    path.push({ x: homeTokenCoordinates[color].x, y: homeTokenCoordinates[color].y });

    playerPaths[color] = path;
  });

  // Home SVG triangle corner points
  const R_home_corner = 15.0;
  const homeTrianglePoints = {};
  colors.forEach((color, p) => {
    const prevBeta = beta[(p - 1 + numPlayers) % numPlayers];
    const currBeta = beta[p];
    const x1 = 50 + R_home_corner * Math.cos(prevBeta);
    const y1 = 50 + R_home_corner * Math.sin(prevBeta);
    const x2 = 50 + R_home_corner * Math.cos(currBeta);
    const y2 = 50 + R_home_corner * Math.sin(currBeta);
    homeTrianglePoints[color] = `50,50 ${x1.toFixed(2)},${y1.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)}`;
  });

  // Alpha angles (for start arrows)
  const alphaMap = {};
  colors.forEach((color, p) => { alphaMap[color] = alpha[p]; });

  return {
    colors,
    perimeterCoordinates,
    colorStartIndices,
    safeCellIndices,
    playerPaths,
    baseCoordinates,
    homeTokenCoordinates,
    homeTrianglePoints,
    alphaMap,
    homeEntryStep,
    finalStep: homeEntryStep + 6, // homeEntryStep + 5 lane cells + 1 center
  };
}

export function getFinalStep(geo) {
  return geo.finalStep;
}

export function getHomeEntryStep(geo) {
  return geo.homeEntryStep;
}

export function isPerimeterStep(geo, step) {
  return step >= 0 && step < geo.homeEntryStep;
}

export function isHomeLaneStep(geo, step) {
  return step >= geo.homeEntryStep && step < getFinalStep(geo);
}

export function isSafeCell(geo, perimeterIdx) {
  return geo.safeCellIndices.includes(perimeterIdx);
}

export function getSafeColor(geo, perimeterIdx) {
  const P = geo.colors.length;
  for (let p = 0; p < P; p++) {
    const color = geo.colors[p];
    if (perimeterIdx === p * 13 + 8 || perimeterIdx === p * 13 + 3) return color;
  }
  return 'neutral';
}

export function getPerimeterIndex(geo, color, step) {
  return (geo.colorStartIndices[color] + step) % geo.perimeterCoordinates.length;
}

export function getStepsAway(geo, colorA, stepA, colorB, stepB) {
  if (!isPerimeterStep(geo, stepA) || !isPerimeterStep(geo, stepB)) return -1;
  const idxA = getPerimeterIndex(geo, colorA, stepA);
  const idxB = getPerimeterIndex(geo, colorB, stepB);
  const N = geo.perimeterCoordinates.length;
  return (idxB - idxA + N) % N;
}
