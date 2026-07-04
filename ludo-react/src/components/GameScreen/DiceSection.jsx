import React, { useRef, useEffect } from 'react';
import { useGame } from '../../context/GameContext.jsx';
import { PHASE_ROLL } from '../../hooks/useGameEngine.js';

export default function DiceSection() {
  const { state, triggerDiceRoll } = useGame();
  const { currentRoll, isRolling, phase, playerTypes, currentTurnColor, isAnimating, diceSkin } = state;
  const diceRef = useRef(null);

  const canRoll =
    phase === PHASE_ROLL &&
    !isRolling &&
    !isAnimating &&
    playerTypes[currentTurnColor] === 'human';

  useEffect(() => {
    const dice = diceRef.current;
    if (!dice) return;

    if (isRolling) {
      dice.classList.add('rolling');
    } else {
      dice.classList.remove('rolling');
      // Set show face
      for (let i = 1; i <= 6; i++) dice.classList.remove(`show-${i}`);
      if (currentRoll >= 1 && currentRoll <= 6) {
        dice.classList.add(`show-${currentRoll}`);
        dice.classList.add('dice-result-pop');
        const timer = setTimeout(() => dice.classList.remove('dice-result-pop'), 450);
        return () => clearTimeout(timer);
      }
    }
  }, [isRolling, currentRoll]);

  const skinClass = diceSkin === 'chromeglass' ? 'dice-skin-chromeglass' :
                    diceSkin === 'matrix' ? 'dice-skin-matrix' : '';

  return (
    <div className="dice-section">
      <div className="dice-perspective">
        <div
          ref={diceRef}
          className={`dice-cube show-${currentRoll || 1} ${skinClass}`}
          onClick={canRoll ? triggerDiceRoll : undefined}
          style={{ cursor: canRoll ? 'pointer' : 'default' }}
        >
          <div className="face front face-1"><span className="dot" /></div>
          <div className="face back face-6">
            <span className="dot" /><span className="dot" /><span className="dot" />
            <span className="dot" /><span className="dot" /><span className="dot" />
          </div>
          <div className="face right face-3">
            <span className="dot" /><span className="dot" /><span className="dot" />
          </div>
          <div className="face left face-4">
            <span className="dot" /><span className="dot" />
            <span className="dot" /><span className="dot" />
          </div>
          <div className="face top face-2">
            <span className="dot" /><span className="dot" />
          </div>
          <div className="face bottom face-5">
            <span className="dot" /><span className="dot" />
            <span className="dot" /><span className="dot" />
            <span className="dot" />
          </div>
        </div>
      </div>

      <button
        id="roll-btn"
        className="btn primary-btn btn-glow"
        onClick={triggerDiceRoll}
        disabled={!canRoll}
      >
        Roll Dice
      </button>
    </div>
  );
}
