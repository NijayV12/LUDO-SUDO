import React, { useState } from 'react';
import { useGame } from '../../context/GameContext.jsx';
import { ALL_COLORS } from '../../engine/boardGeometry.js';
import RulesModal from '../Modals/RulesModal.jsx';
import OnlineLobby from './OnlineLobby.jsx';

const COLOR_LABELS = {
  red: 'Player 1 (Red)',
  green: 'Player 2 (Green)',
  yellow: 'Player 3 (Yellow)',
  blue: 'Player 4 (Blue)',
  orange: 'Player 5 (Orange)',
  purple: 'Player 6 (Purple)',
};

const BOARD_MODE_COLORS = {
  4: ['red', 'green', 'yellow', 'blue'],
  5: ['red', 'green', 'yellow', 'blue', 'orange'],
  6: ['red', 'green', 'yellow', 'blue', 'orange', 'purple'],
};

export default function SetupScreen() {
  const { startGame } = useGame();
  const [activeTab, setActiveTab] = useState('local');
  const [showRules, setShowRules] = useState(false);
  const [boardMode, setBoardMode] = useState(4);
  const [tokensCount, setTokensCount] = useState(4);
  const [releaseRule, setReleaseRule] = useState('6');
  const [diceMode, setDiceMode] = useState('boosted');
  const [bonusRollRule, setBonusRollRule] = useState('all');
  const [tripleSixRule, setTripleSixRule] = useState('skip');

  const activeColors = BOARD_MODE_COLORS[boardMode] || BOARD_MODE_COLORS[4];

  const [playerConfigs, setPlayerConfigs] = useState({
    red:    { type: 'human', name: 'Player 1', difficulty: 'balanced' },
    green:  { type: 'ai',    name: 'Player 2', difficulty: 'balanced' },
    yellow: { type: 'ai',    name: 'Player 3', difficulty: 'balanced' },
    blue:   { type: 'ai',    name: 'Player 4', difficulty: 'balanced' },
    orange: { type: 'ai',    name: 'Player 5', difficulty: 'balanced' },
    purple: { type: 'ai',    name: 'Player 6', difficulty: 'balanced' },
  });

  const updateConfig = (color, field, value) => {
    setPlayerConfigs(prev => {
      const updated = { ...prev, [color]: { ...prev[color], [field]: value } };
      // Auto-update name when switching type
      if (field === 'type') {
        if (value === 'ai' && !prev[color].name.startsWith('NeonBot')) {
          updated[color].name = `NeonBot ${color.charAt(0).toUpperCase() + color.slice(1)}`;
        } else if (value === 'human' && prev[color].name.startsWith('NeonBot')) {
          updated[color].name = COLOR_LABELS[color].split(' ')[0] + ' ' + COLOR_LABELS[color].split(' ')[1];
        }
      }
      return updated;
    });
  };

  const handleBoardModeChange = (mode) => {
    const m = parseInt(mode, 10);
    setBoardMode(m);
  };

  const handleStart = () => {
    const playerTypes = {};
    const playerNames = {};
    const playerDifficulties = {};

    ALL_COLORS.forEach(color => {
      if (activeColors.includes(color)) {
        playerTypes[color] = playerConfigs[color].type;
        playerNames[color] = playerConfigs[color].name || COLOR_LABELS[color];
        playerDifficulties[color] = playerConfigs[color].difficulty;
      } else {
        playerTypes[color] = 'off';
        playerNames[color] = COLOR_LABELS[color];
        playerDifficulties[color] = 'balanced';
      }
    });

    startGame({ playerTypes, playerNames, playerDifficulties, tokensCount, releaseRule, diceMode, bonusRollRule, tripleSixRule, boardMode });
  };

  return (
    <div className="setup-card glass-panel">
      <h1 className="game-logo">LUDO <span className="accent-text">NEON</span></h1>
      <p className="tagline">A premium 4-player board game experience</p>

      <div className="lobby-tabs">
        <button
          className={`tab-btn${activeTab === 'local' ? ' active' : ''}`}
          onClick={() => setActiveTab('local')}
        >Local Play</button>
        <button
          className={`tab-btn${activeTab === 'online' ? ' active' : ''}`}
          onClick={() => setActiveTab('online')}
        >Online Play</button>
      </div>

      {activeTab === 'local' ? (
        <>
          <div className="player-config-grid">
            {activeColors.map(color => (
              <PlayerConfigCard
                key={color}
                color={color}
                config={playerConfigs[color]}
                onChange={(field, value) => updateConfig(color, field, value)}
              />
            ))}
          </div>

          <div className="settings-container">
            <h3 className="settings-title">GAME SETTINGS</h3>
            <div className="settings-grid">
              <div className="settings-item">
                <label>Game Board Mode</label>
                <select className="custom-select" value={boardMode} onChange={e => handleBoardModeChange(e.target.value)}>
                  <option value="4">4 Players (Classic)</option>
                  <option value="5">5 Players (Star Arena)</option>
                  <option value="6">6 Players (Neon Hexagon)</option>
                </select>
              </div>
              <div className="settings-item">
                <label>Tokens per Player</label>
                <select className="custom-select" value={tokensCount} onChange={e => setTokensCount(parseInt(e.target.value, 10))}>
                  <option value="4">Classic (4 Tokens)</option>
                  <option value="2">Speed (2 Tokens)</option>
                </select>
              </div>
              <div className="settings-item">
                <label>Release Token On</label>
                <select className="custom-select" value={releaseRule} onChange={e => setReleaseRule(e.target.value)}>
                  <option value="6">6 Only</option>
                  <option value="1or6">1 or 6</option>
                </select>
              </div>
              <div className="settings-item">
                <label>Dice Mode</label>
                <select className="custom-select" value={diceMode} onChange={e => setDiceMode(e.target.value)}>
                  <option value="boosted">Fast Start</option>
                  <option value="fair">Fair Dice</option>
                </select>
              </div>
              <div className="settings-item">
                <label>Bonus Rolls</label>
                <select className="custom-select" value={bonusRollRule} onChange={e => setBonusRollRule(e.target.value)}>
                  <option value="all">6, Capture, Home</option>
                  <option value="sixOnly">6 Only</option>
                  <option value="none">Off</option>
                </select>
              </div>
              <div className="settings-item">
                <label>Three Sixes</label>
                <select className="custom-select" value={tripleSixRule} onChange={e => setTripleSixRule(e.target.value)}>
                  <option value="skip">Skip Turn</option>
                  <option value="allow">Allow</option>
                </select>
              </div>
            </div>
          </div>

          <div className="setup-actions">
            <button className="btn primary-btn btn-glow" onClick={handleStart}>
              ⚔ Battle Arena
            </button>
            <button className="btn secondary-btn" onClick={() => setShowRules(true)}>
              View Rules
            </button>
          </div>
        </>
      ) : (
        <OnlineLobby onShowRules={() => setShowRules(true)} />
      )}

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}

function PlayerConfigCard({ color, config, onChange }) {
  return (
    <div className={`config-card player-${color}-theme`}>
      <div className="player-color-header">
        <div className={`color-dot ${color}-dot`} />
        <h3>{COLOR_LABELS[color]}</h3>
      </div>

      <div className="name-input-wrapper">
        <input
          type="text"
          className="player-name-input"
          value={config.name}
          disabled={config.type === 'off'}
          onChange={e => onChange('name', e.target.value)}
          placeholder="Enter Name"
        />
      </div>

      {config.type === 'ai' && (
        <div className="difficulty-wrapper">
          <select
            className="custom-select difficulty-select"
            value={config.difficulty}
            onChange={e => onChange('difficulty', e.target.value)}
          >
            <option value="easy">Easy Bot</option>
            <option value="balanced">Balanced Bot</option>
            <option value="aggressive">Aggressive Bot</option>
          </select>
        </div>
      )}

      <div className="radio-group">
        {['human', 'ai', 'off'].map(type => (
          <label key={type} className="radio-label">
            <input
              type="radio"
              name={`p-${color}`}
              value={type}
              checked={config.type === type}
              onChange={() => onChange('type', type)}
            />
            <span className="custom-radio">
              {type === 'human' ? 'Human' : type === 'ai' ? 'Computer AI' : 'Off'}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
