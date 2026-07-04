import React from 'react';
import { useGame } from '../../context/GameContext.jsx';
import { PHASE_ROLL, PHASE_MOVE, PHASE_OVER } from '../../hooks/useGameEngine.js';
import DiceSection from './DiceSection.jsx';

export default function ControlsColumn() {
  const { state, addLog } = useGame();
  const { phase, currentTurnColor, playerTypes, gameWinnerList, playerNames } = state;

  const getPlayerName = (color) => playerNames[color] || color.toUpperCase();

  const getTurnInstruction = () => {
    if (phase === PHASE_OVER) {
      const winner = gameWinnerList[0];
      return `MATCH OVER! ${getPlayerName(winner).toUpperCase()} IS VICTORIOUS!`;
    }
    if (phase === PHASE_ROLL) {
      if (playerTypes[currentTurnColor] === 'human') return "Click 'Roll Dice' or click the cube!";
      return "Computer is thinking...";
    }
    if (phase === PHASE_MOVE) {
      if (playerTypes[currentTurnColor] === 'human') return "Choose one of your glowing tokens to move.";
      return "Computer is choosing a move...";
    }
    return "Ready!";
  };

  const reactions = [
    { label: 'Nice', msg: 'Nice move!' },
    { label: 'Hit', msg: 'Gotcha!' },
    { label: 'Oops', msg: 'Oh no!' },
    { label: 'Roll', msg: 'Lucky roll!' },
    { label: 'GG', msg: 'Good game!' },
    { label: 'Wait', msg: 'Hurry up!' },
  ];

  const handleReaction = (msg) => {
    addLog(`[CHAT] ${getPlayerName(currentTurnColor)}: ${msg}`, currentTurnColor);
  };

  const turnColorClass = phase === PHASE_OVER ? 'accent-text' : `${currentTurnColor}-text`;
  const turnLabel = phase === PHASE_OVER ? 'GAME OVER' : getPlayerName(currentTurnColor);

  return (
    <div className="controls-column">
      <div className="action-card glass-panel">
        <div className="turn-announcement">
          <span className="announcement-prefix">CURRENT TURN</span>
          <h2 className={`current-player-turn-label ${turnColorClass}`}>{turnLabel}</h2>
        </div>

        <DiceSection />

        <div className="turn-instruction">{getTurnInstruction()}</div>
      </div>

      <div className="quick-chat-card glass-panel">
        <h3 className="quick-chat-title">Battle Reactions</h3>
        <div className="quick-chat-grid">
          {reactions.map(r => (
            <button
              key={r.label}
              className="chat-reaction-btn"
              onClick={() => handleReaction(r.msg)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <ArenaLogs />
    </div>
  );
}

function ArenaLogs() {
  const { state } = useGame();
  const { logs } = state;
  const logsRef = React.useRef(null);

  React.useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="logs-card glass-panel">
      <h3>Arena Logs</h3>
      <div className="logs-container" ref={logsRef}>
        {logs.map(log => (
          <div key={log.id} className={`log-entry ${log.color}-log`}>
            {log.text}
          </div>
        ))}
      </div>
    </div>
  );
}
