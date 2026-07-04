import React, { useState } from 'react';
import { useGame } from '../../context/GameContext.jsx';
import { buildBoardGeometry } from '../../engine/boardGeometry.js';
import { Peer } from 'peerjs';

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return `NEON-${code}`;
}

const COLOR_LABELS = {
  red: 'Player 1 (Red)', green: 'Player 2 (Green)', yellow: 'Player 3 (Yellow)',
  blue: 'Player 4 (Blue)', orange: 'Player 5 (Orange)', purple: 'Player 6 (Purple)',
};

export default function OnlineLobby({ onShowRules }) {
  const { startGame } = useGame();

  const [username, setUsername] = useState('Guest');
  const [mode, setMode] = useState(null); // 'host' | 'client'
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinStatus, setJoinStatus] = useState('');
  const [connections, setConnections] = useState([]);
  const [myColor, setMyColor] = useState('red');
  const [playerTypes, setPlayerTypes] = useState({
    red: 'human', green: 'ai', yellow: 'ai', blue: 'ai', orange: 'ai', purple: 'ai'
  });
  const [playerNames, setPlayerNames] = useState({
    red: 'Host', green: 'Player 2', yellow: 'Player 3', blue: 'Player 4', orange: 'Player 5', purple: 'Player 6',
  });
  const [colors, setColors] = useState(['red', 'green', 'yellow', 'blue']);
  const [tokensCount, setTokensCount] = useState(4);
  const [releaseRule, setReleaseRule] = useState('6');
  const [boardMode] = useState(4);
  const [isConnected, setIsConnected] = useState(false);
  const [showPlayerList, setShowPlayerList] = useState(false);
  const [isHost, setIsHost] = useState(false);

  const handleCreateLobby = () => {
    const code = generateRoomCode();
    setRoomCode(code);
    setMode('host');
    setIsHost(true);
    const newPeer = new Peer(code, { host: '0.peerjs.com', port: 443, secure: true });

    const newColors = buildBoardGeometry(boardMode).colors;
    setColors(newColors);

    const initTypes = {};
    newColors.forEach(c => { initTypes[c] = c === 'red' ? 'human' : 'ai'; });
    setPlayerTypes(initTypes);
    const initNames = { ...playerNames, red: username };
    setPlayerNames(initNames);

    newPeer.on('open', () => {
      setIsConnected(true);
      setShowPlayerList(true);
    });

    newPeer.on('connection', (conn) => {
      const assignedColor = newColors.find(c => initTypes[c] === 'ai');
      if (!assignedColor) { conn.on('open', () => conn.send({ type: 'LOBBY_FULL' })); return; }

      setPlayerTypes(prev => ({ ...prev, [assignedColor]: 'human' }));
      setConnections(prev => [...prev, conn]);

      conn.on('open', () => {
        conn.send({
          type: 'HANDSHAKE', color: assignedColor,
          playerTypes: initTypes, colors: newColors, tokensCount, releaseRule
        });
      });
      conn.on('data', (data) => {
        if (data.type === 'SET_PLAYER_NAME' && data.name) {
          setPlayerNames(prev => ({ ...prev, [assignedColor]: data.name }));
        }
      });
    });

    newPeer.on('error', (err) => {
      alert(`Peer error: ${err.message}`);
      setIsConnected(false); setMode(null);
    });
  };

  const handleJoinLobby = () => {
    if (!joinCode.trim()) { alert('Enter a room code!'); return; }
    const code = joinCode.trim().toUpperCase();
    const finalCode = code.startsWith('NEON-') ? code : `NEON-${code}`;
    setJoinStatus('Connecting...');
    setMode('client');

    const newPeer = new Peer({ host: '0.peerjs.com', port: 443, secure: true });

    newPeer.on('open', () => {
      const conn = newPeer.connect(finalCode);
      conn.on('open', () => {
        setIsConnected(true);
        setShowPlayerList(true);
        setJoinStatus('Connected!');
        conn.send({ type: 'SET_PLAYER_NAME', name: username });
      });
      conn.on('data', (data) => {
        if (data.type === 'HANDSHAKE') {
          setMyColor(data.color);
          setPlayerTypes(data.playerTypes);
          if (data.colors) setColors(data.colors);
          if (data.tokensCount) setTokensCount(data.tokensCount);
          if (data.releaseRule) setReleaseRule(data.releaseRule);
        }
        if (data.type === 'LOBBY_FULL') { alert('Lobby is full!'); }
      });
      conn.on('close', () => { alert('Host disconnected!'); setIsConnected(false); });
    });

    newPeer.on('error', (err) => {
      alert(`Connection failed: ${err.message}`);
      setJoinStatus('Failed.'); setMode(null);
    });
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
  };

  const handleStartOnline = () => {
    const geo = buildBoardGeometry(boardMode);
    const activePlayersOrder = geo.colors.filter(c => playerTypes[c] !== 'off');
    if (activePlayersOrder.length < 2) { alert('Need at least 2 players!'); return; }

    const startData = { type: 'GAME_START', playerTypes, playerNames, tokensCount, releaseRule, activePlayersOrder, colors: geo.colors };
    connections.forEach(c => { if (c.open) c.send(startData); });

    startGame({
      playerTypes, playerNames,
      playerDifficulties: {},
      tokensCount, releaseRule, diceMode: 'boosted', bonusRollRule: 'all', tripleSixRule: 'skip', boardMode
    });
  };

  const hasClient = colors.some(c => c !== 'red' && playerTypes[c] === 'human');

  return (
    <div>
      <div className="online-name-wrapper">
        <label className="online-label">Your Username</label>
        <input
          type="text"
          className="text-input"
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="ENTER YOUR NAME"
          maxLength={15}
          disabled={isConnected}
        />
      </div>

      {!isConnected && (
        <div className="online-setup-box">
          <div className="lobby-action-box">
            <button className="btn primary-btn btn-glow w-full" onClick={handleCreateLobby}>
              Host a New Game
            </button>
          </div>
          <div className="online-divider"><span>OR JOIN AN EXISTING GAME</span></div>
          <div className="lobby-action-box form-group" style={{ display: 'flex', gap: 10 }}>
            <input
              type="text"
              className="text-input"
              placeholder="ENTER ROOM CODE"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value)}
              maxLength={15}
            />
            <button className="btn primary-btn btn-glow" onClick={handleJoinLobby}>Join</button>
          </div>
          {joinStatus && <p className="join-status-txt">{joinStatus}</p>}
        </div>
      )}

      {isConnected && mode === 'host' && (
        <div className="room-code-box">
          <span className="code-label">LOBBY CODE</span>
          <div className="code-value-wrapper">
            <h2>{roomCode}</h2>
            <button className="btn secondary-btn compact-btn" onClick={handleCopyCode}>Copy</button>
          </div>
          <p className="lobby-subtext">Share this code with your friends!</p>
        </div>
      )}

      {showPlayerList && (
        <div className="lobby-player-list">
          <h3>Players in Lobby</h3>
          <div className="online-player-grid">
            {colors.map(color => (
              <div key={color} className={`player-slot-pill pill-${color}${playerTypes[color] !== 'human' ? ' empty-slot' : ''}`}>
                <span className="slot-color-dot" style={{ background: `var(--color-${color})` }} />
                <span className="slot-player-name">
                  {playerTypes[color] === 'human'
                    ? `${playerNames[color]}${color === myColor ? ' (You)' : ''}`
                    : `${COLOR_LABELS[color]}: AI Bot`}
                </span>
              </div>
            ))}
          </div>

          <div className="online-start-actions">
            {isHost ? (
              <button
                className="btn primary-btn btn-glow"
                onClick={handleStartOnline}
                disabled={!hasClient}
              >
                Start Battle
              </button>
            ) : (
              <p className="lobby-subtext">Waiting for host to start...</p>
            )}
          </div>
        </div>
      )}

      <div className="setup-actions" style={{ marginTop: 20 }}>
        <button className="btn secondary-btn" onClick={onShowRules}>View Rules</button>
      </div>
    </div>
  );
}
