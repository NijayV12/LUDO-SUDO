import React, { useEffect, useRef, useCallback } from 'react';
import { useGame } from '../../context/GameContext.jsx';
import { PHASE_MOVE } from '../../hooks/useGameEngine.js';
import {
  isHomeLaneStep, isSafeCell, getSafeColor, getPerimeterIndex
} from '../../engine/boardGeometry.js';
import { canTokenMove } from '../../engine/gameLogic.js';

// ─── Canvas Particle System ───────────────────────────────────────────────────
let canvasParticles = [];
let particleAnimId = null;

class CanvasParticle {
  constructor(x, y, color) {
    this.x = x; this.y = y; this.color = color;
    this.size = Math.random() * 3 + 2;
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 5 + 2;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.alpha = 1;
    this.decay = Math.random() * 0.02 + 0.015;
  }
  update() { this.x += this.vx; this.y += this.vy; this.alpha -= this.decay; }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 10; ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function _spawnParticles(canvasEl, boardEl, el, colorCode, count = 12) {
  if (!el || !canvasEl || !boardEl) return;
  const rect = el.getBoundingClientRect();
  const boardRect = boardEl.getBoundingClientRect();
  const scaleX = canvasEl.width / boardRect.width;
  const scaleY = canvasEl.height / boardRect.height;
  const x = (rect.left - boardRect.left + rect.width / 2) * scaleX;
  const y = (rect.top - boardRect.top + rect.height / 2) * scaleY;

  let finalColor = colorCode;
  if (colorCode.startsWith('var(')) {
    const name = colorCode.slice(4, -1).trim();
    finalColor = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#fff';
  }

  for (let i = 0; i < count; i++) canvasParticles.push(new CanvasParticle(x, y, finalColor));
  startParticleLoop(canvasEl);
}

function startParticleLoop(canvasEl) {
  if (particleAnimId) return;
  const loop = () => {
    if (!canvasEl) { particleAnimId = null; return; }
    if (canvasEl.width !== canvasEl.clientWidth || canvasEl.height !== canvasEl.clientHeight) {
      canvasEl.width = canvasEl.clientWidth;
      canvasEl.height = canvasEl.clientHeight;
    }
    const ctx = canvasEl.getContext('2d');
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    canvasParticles = canvasParticles.filter(p => p.alpha > 0);
    canvasParticles.forEach(p => { p.update(); p.draw(ctx); });
    if (canvasParticles.length > 0) {
      particleAnimId = requestAnimationFrame(loop);
    } else {
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      particleAnimId = null;
    }
  };
  particleAnimId = requestAnimationFrame(loop);
}

// ─── Token Component ──────────────────────────────────────────────────────────
function Token({ color, tokenId }) {
  const { state, handleTokenClick } = useGame();
  const { phase, currentTurnColor, playerTypes, isAnimating, currentRoll, geo, players, releaseRule, movingTokenKey } = state;

  const isMovable = phase === PHASE_MOVE &&
    color === currentTurnColor &&
    playerTypes[color] === 'human' &&
    !isAnimating &&
    geo &&
    canTokenMove(geo, players, releaseRule, color, tokenId, currentRoll);

  const isMoving = movingTokenKey === `${color}-${tokenId}`;

  const handleClick = useCallback(() => {
    if (isMovable) handleTokenClick(color, tokenId);
  }, [isMovable, handleTokenClick, color, tokenId]);

  let classes = `token token-${color}`;
  if (isMovable) classes += ' movable';
  if (isMoving) classes += ' token-moving';

  return (
    <div
      className={classes}
      data-color={color}
      data-tokenid={tokenId}
      onClick={handleClick}
      style={isMovable ? { cursor: 'pointer', pointerEvents: 'auto' } : {}}
    />
  );
}

// ─── Main Board Component ─────────────────────────────────────────────────────
export default function LudoBoard() {
  const { state } = useGame();
  const { geo, players, playerTypes } = state;

  const boardRef = useRef(null);
  const canvasRef = useRef(null);

  // Resize canvas on board size change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  if (!geo) {
    return (
      <div className="ludo-board" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-muted)' }}>Loading board...</span>
      </div>
    );
  }

  // ── Collect tokens by cell ──
  const cellTokens = new Map();
  const baseTokens = {};
  const homeTokens = {};

  geo.colors.forEach(color => {
    if (playerTypes[color] === 'off') return;
    players[color].tokens.forEach((token, tokenId) => {
      const step = token.step;
      if (step === -1) {
        if (!baseTokens[color]) baseTokens[color] = [];
        baseTokens[color].push(tokenId);
      } else if (step === geo.finalStep) {
        if (!homeTokens[color]) homeTokens[color] = [];
        homeTokens[color].push(tokenId);
      } else {
        let cellId;
        if (isHomeLaneStep(geo, step)) {
          cellId = `h-${color}-${step}`;
        } else {
          const idx = getPerimeterIndex(geo, color, step);
          cellId = `p-${idx}`;
        }
        if (!cellTokens.has(cellId)) cellTokens.set(cellId, []);
        cellTokens.get(cellId).push({ color, tokenId });
      }
    });
  });

  const homeEntryStep = geo.homeEntryStep;

  return (
    <div className="ludo-board" ref={boardRef}>
      {/* Background SVG triangles */}
      <svg className="home-triangles-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
        {geo.colors.map(color => (
          <polygon
            key={color}
            points={geo.homeTrianglePoints[color]}
            style={{
              fill: `var(--color-${color})`,
              opacity: 0.85,
              filter: `drop-shadow(0 0 4px var(--color-${color}-glow))`
            }}
          />
        ))}
      </svg>

      {/* Center star */}
      <div className="center-star-badge">
        <svg viewBox="0 0 24 24" width="28" height="28">
          <path fill="#ffffff" d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z"/>
        </svg>
      </div>

      {/* Bases */}
      {geo.colors.map(color => {
        const coord = geo.baseCoordinates[color];
        return (
          <div
            key={color}
            className={`base ${color}-base`}
            style={{
              position: 'absolute',
              left: `${coord.x}%`, top: `${coord.y}%`,
              width: '20%', height: '20%',
              transform: 'translate(-50%,-50%)'
            }}
          >
            <div className="base-inner">
              {Array.from({ length: players[color]?.tokens?.length || 4 }).map((_, i) => (
                <div key={i} className={`token-slot ${color}-slot`}>
                  {baseTokens[color]?.includes(i) && <Token color={color} tokenId={i} />}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Home triangle token areas */}
      {geo.colors.map(color => {
        const coord = geo.homeTokenCoordinates[color];
        return (
          <div
            key={color}
            className={`home-triangle triangle-${color}`}
            style={{ left: `${coord.x}%`, top: `${coord.y}%`, transform: 'translate(-50%,-50%)' }}
          >
            {(homeTokens[color] || []).map(tokenId => (
              <Token key={tokenId} color={color} tokenId={tokenId} />
            ))}
          </div>
        );
      })}

      {/* Perimeter cells */}
      {geo.perimeterCoordinates.map((coord, idx) => {
        const isStart = geo.colors.some((c, p) => idx === p * 13 + 8);
        const startColorIdx = isStart ? geo.colors.findIndex((c, p) => idx === p * 13 + 8) : -1;
        const startColor = startColorIdx >= 0 ? geo.colors[startColorIdx] : null;
        const safe = isSafeCell(geo, idx);
        const safeColor = safe ? getSafeColor(geo, idx) : null;
        const arrowAngle = startColor ? (geo.alphaMap[startColor] * 180 / Math.PI) + 180 : 0;

        const tokens = cellTokens.get(`p-${idx}`) || [];
        const stackClass = tokens.length > 0 ? `stack-${Math.min(tokens.length, 4)}` : '';

        let classes = `cell ${stackClass}`;
        if (startColor) classes += ` path-${startColor}-start`;
        if (safe) classes += ` safe-cell safe-cell-${safeColor}`;

        return (
          <div
            key={idx}
            className={classes}
            style={{
              left: `${coord.x}%`, top: `${coord.y}%`,
              width: '5.2%', height: '5.2%',
              transform: 'translate(-50%,-50%)'
            }}
          >
            {startColor && (
              <div className="start-arrow" style={{ transform: `rotate(${arrowAngle}deg)`, color: `var(--color-${startColor})` }}>
                &gt;
              </div>
            )}
            {tokens.map(({ color, tokenId }) => (
              <Token key={`${color}-${tokenId}`} color={color} tokenId={tokenId} />
            ))}
          </div>
        );
      })}

      {/* Home lane cells */}
      {geo.colors.map(color =>
        Array.from({ length: 5 }, (_, i) => {
          const step = homeEntryStep + i;
          const coord = geo.playerPaths[color][step];
          if (!coord) return null;
          const tokens = cellTokens.get(`h-${color}-${step}`) || [];
          const stackClass = tokens.length > 0 ? `stack-${Math.min(tokens.length, 4)}` : '';
          return (
            <div
              key={`${color}-home-${step}`}
              className={`cell ${color}-home-path ${stackClass}`}
              style={{
                left: `${coord.x}%`, top: `${coord.y}%`,
                width: '5.2%', height: '5.2%',
                transform: 'translate(-50%,-50%)'
              }}
            >
              {tokens.map(({ color: tc, tokenId }) => (
                <Token key={`${tc}-${tokenId}`} color={tc} tokenId={tokenId} />
              ))}
            </div>
          );
        })
      )}

      {/* Effects canvas */}
      <canvas id="effects-canvas" ref={canvasRef} />
    </div>
  );
}
