import React, { useState } from 'react';
import GameHeader from './GameHeader.jsx';
import PlayersColumn from './PlayersColumn.jsx';
import LudoBoard from './LudoBoard.jsx';
import ControlsColumn from './ControlsColumn.jsx';
import RulesModal from '../Modals/RulesModal.jsx';
import AudioSettingsModal from '../Modals/AudioSettingsModal.jsx';

export default function GameScreen({ onReset }) {
  const [showRules, setShowRules] = useState(false);
  const [showAudio, setShowAudio] = useState(false);

  return (
    <div className="game-layout">
      <GameHeader
        onShowRules={() => setShowRules(true)}
        onShowAudio={() => setShowAudio(true)}
        onReset={onReset}
      />

      <div className="main-content-grid">
        <PlayersColumn />
        <div className="board-column">
          <div className="board-wrapper glass-panel">
            <LudoBoard />
          </div>
        </div>
        <ControlsColumn
          onShowRules={() => setShowRules(true)}
          onShowAudio={() => setShowAudio(true)}
        />
      </div>

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      {showAudio && <AudioSettingsModal onClose={() => setShowAudio(false)} />}
    </div>
  );
}
