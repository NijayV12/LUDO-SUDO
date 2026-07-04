import React, { useEffect } from 'react';
import { GameContext } from './context/GameContext.jsx';
import { useGameEngine, PHASE_SETUP } from './hooks/useGameEngine.js';
import SetupScreen from './components/SetupScreen/SetupScreen.jsx';
import GameScreen from './components/GameScreen/GameScreen.jsx';

export default function App() {
  const engine = useGameEngine();
  const { state, resetGame, audioManager } = engine;

  // Start background music on first user interaction
  useEffect(() => {
    const startMusic = () => {
      audioManager.startMusic();
      window.removeEventListener('click', startMusic);
      window.removeEventListener('keydown', startMusic);
    };
    window.addEventListener('click', startMusic);
    window.addEventListener('keydown', startMusic);
    return () => {
      window.removeEventListener('click', startMusic);
      window.removeEventListener('keydown', startMusic);
    };
  }, [audioManager]);

  return (
    <GameContext.Provider value={engine}>
      {/* Ambient neon blobs */}
      <div className="neon-blob blob-red" />
      <div className="neon-blob blob-green" />
      <div className="neon-blob blob-blue" />
      <div className="neon-blob blob-yellow" />

      <div className="app-container">
        {state.phase === PHASE_SETUP ? (
          <SetupScreen />
        ) : (
          <GameScreen onReset={resetGame} />
        )}
      </div>
    </GameContext.Provider>
  );
}
