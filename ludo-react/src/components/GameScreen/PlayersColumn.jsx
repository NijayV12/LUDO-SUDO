import React from 'react';
import { useGame } from '../../context/GameContext.jsx';
import { PHASE_SETUP, PHASE_OVER } from '../../hooks/useGameEngine.js';

export default function PlayersColumn() {
  const { state } = useGame();
  const { geo, players, playerTypes, playerNames, phase, currentTurnColor, tokensCount } = state;

  if (!geo) return null;

  return (
    <div className="players-column">
      {geo.colors.map((color) => {
        if (playerTypes[color] === 'off') return null;

        const isActive = phase !== PHASE_SETUP && phase !== PHASE_OVER && color === currentTurnColor;
        const homeCount = players[color]?.tokens.filter(t => t.step === geo.finalStep).length ?? 0;
        const type = playerTypes[color];
        const name = playerNames[color] || color.toUpperCase();

        return (
          <div
            key={color}
            className={`player-status-card player-${color}-card glass-panel${isActive ? ' active-turn' : ''}`}
          >
            <div className="status-color-bar" style={{ background: `var(--color-${color})` }} />
            <div className="status-header" style={{ paddingLeft: '12px' }}>
              <span className="player-name">{name}</span>
              <span className={`player-type-badge ${color}-badge`}>
                {type === 'human' ? 'Human' : 'AI'}
              </span>
            </div>
            <div className="status-body" style={{ paddingLeft: '12px' }}>
              <div className="home-stat">
                Tokens Home: <span className="stat-num">{homeCount}/{tokensCount}</span>
              </div>
              <RollHistory color={color} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RollHistory({ color }) {
  const { state } = useGame();
  // Extract last 8 rolls from logs for this color
  const rolls = state.logs
    .filter(l => l.color === color && /rolled a (\d)/.test(l.text))
    .map(l => l.text.match(/rolled a (\d)/)[1])
    .slice(-8);

  return (
    <div className="history-list">
      {rolls.map((roll, i) => (
        <div key={i} className="history-roll">{roll}</div>
      ))}
    </div>
  );
}
