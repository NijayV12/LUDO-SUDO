import React, { useState } from 'react';
import { useGame } from '../../context/GameContext.jsx';

export default function AudioSettingsModal({ onClose }) {
  const { audioManager, state, dispatch } = useGame();
  const [musicVol, setMusicVol] = useState(audioManager.musicVolume);
  const [sfxVol, setSfxVol] = useState(audioManager.sfxVolume);

  const handleMusicChange = (e) => {
    const vol = parseFloat(e.target.value);
    setMusicVol(vol);
    audioManager.setMusicVolume(vol);
  };

  const handleSfxChange = (e) => {
    const vol = parseFloat(e.target.value);
    setSfxVol(vol);
    audioManager.setSfxVolume(vol);
  };

  const handleSkinChange = (e) => {
    dispatch({ type: 'SET_DICE_SKIN', payload: e.target.value });
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content glass-panel" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2>Game &amp; Audio Settings</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body audio-modal-body">
          <div className="settings-item">
            <label>Background Music</label>
            <div className="vol-row">
              <input type="range" min="0" max="1" step="0.05" value={musicVol} onChange={handleMusicChange} />
              <span className="vol-txt">{Math.round(musicVol * 100)}%</span>
            </div>
          </div>
          <div className="settings-item">
            <label>Sound Effects (SFX)</label>
            <div className="vol-row">
              <input type="range" min="0" max="1" step="0.05" value={sfxVol} onChange={handleSfxChange} />
              <span className="vol-txt">{Math.round(sfxVol * 100)}%</span>
            </div>
          </div>
          <div className="settings-item">
            <label>Dice Visual Skin</label>
            <select className="custom-select" value={state.diceSkin} onChange={handleSkinChange} style={{ width: '100%' }}>
              <option value="hologram">Neon Hologram</option>
              <option value="chromeglass">Chrome Glass</option>
              <option value="matrix">Cyberpunk Matrix</option>
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn primary-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
