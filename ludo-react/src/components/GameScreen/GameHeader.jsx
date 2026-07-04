import React, { useState } from 'react';
import { useGame } from '../../context/GameContext.jsx';

export default function GameHeader({ onShowRules, onShowAudio, onReset }) {
  const { audioManager } = useGame();
  const [muted, setMuted] = useState(false);

  const handleMute = () => {
    const isMuted = audioManager.toggleMute();
    setMuted(isMuted);
  };

  return (
    <header className="game-header glass-panel">
      <div className="header-title">
        <h2>LUDO <span className="accent-text">NEON</span></h2>
      </div>
      <div className="header-controls">
        <button className="icon-btn" onClick={handleMute} title="Toggle Sound">
          {muted ? (
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M12,4L9.91,6.09L12,8.18M4.27,3L3,4.27L7.73,9H3V15H7L12,20V13.27L16.25,17.53C15.58,18.04 14.83,18.46 14,18.7V20.77C15.38,20.44 16.63,19.78 17.7,18.9L20.73,21.93L22,20.66L4.27,3M19,12C19,12.9 18.84,13.75 18.57,14.54L20.12,16.1C20.67,14.87 21,13.5 21,12C21,7.72 18.01,4.14 14,3.23V5.29C16.89,6.15 19,8.83 19,12M16.5,12C16.5,10.23 15.5,8.71 14,7.97V10.18L16.45,12.63C16.48,12.43 16.5,12.22 16.5,12Z"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.85 14,18.7V20.77C18.01,19.86 21,16.28 21,12C21,7.72 18.01,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.77 16.5,12M3,9V15H7L12,20V4L7,9H3Z"/>
            </svg>
          )}
        </button>
        <button className="icon-btn" onClick={onShowAudio} title="Audio Settings">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path fill="currentColor" d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.47,5.34 14.86,5.08L14.48,2.42C14.44,2.18 14.23,2 14,2H10C9.77,2 9.56,2.18 9.52,2.42L9.14,5.08C8.53,5.34 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.95C7.96,18.34 8.53,18.66 9.14,18.92L9.52,21.58C9.56,21.82 9.77,22 10,22H14C14.23,22 14.44,21.82 14.48,21.58L14.86,18.92C15.47,18.66 16.04,18.34 16.56,17.95L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/>
          </svg>
        </button>
        <button className="btn secondary-btn compact-btn" onClick={onShowRules}>Rules</button>
        <button className="btn warning-btn compact-btn" onClick={onReset}>Reset Board</button>
      </div>
    </header>
  );
}
