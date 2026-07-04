import React from 'react';

export default function RulesModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content glass-panel">
        <div className="modal-header">
          <h2>Rules of <span className="accent-text">LUDO NEON</span></h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <ul className="rules-list">
            <li><strong>Player Configurations:</strong> The game supports 4, 5, or 6-player board modes. Seats can be set as <em>Human</em>, <em>Computer AI</em>, or disabled (<em>Off</em>).</li>
            <li><strong>Board Anatomy:</strong>
              <ul>
                <li><strong>Bases:</strong> The circular slots where tokens start.</li>
                <li><strong>Safe Zones:</strong> Squares marked with a Star (★) protect tokens. Multiple tokens can occupy a safe zone without capturing each other.</li>
                <li><strong>Home Run Paths:</strong> The colored lanes leading into the center Home.</li>
              </ul>
            </li>
            <li><strong>Releasing Tokens:</strong> By default you must roll a <strong>6</strong> to move a token out of base. Setup can also allow releases on <strong>1 or 6</strong>.</li>
            <li><strong>Capturing:</strong> Landing on a cell occupied by a single opponent token (outside a Safe Zone) captures it, sending it back to base. Capturing grants you an <strong>extra roll</strong>!</li>
            <li><strong>Consecutive Rolls:</strong> You get an extra roll if:
              <ul>
                <li>You roll a <strong>6</strong> (up to 2 times; rolling three 6s skips your turn).</li>
                <li>You capture an opponent's token.</li>
                <li>One of your tokens reaches the Home center.</li>
              </ul>
            </li>
            <li><strong>Entering Home:</strong> A token can only enter Home with an <strong>exact</strong> roll.</li>
            <li><strong>Winning:</strong> The first player to get all tokens into the center Home wins.</li>
          </ul>
        </div>
        <div className="modal-footer">
          <button className="btn primary-btn" onClick={onClose}>Got It!</button>
        </div>
      </div>
    </div>
  );
}
