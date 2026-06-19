import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../useGameStore';
import { playBeep, playCountdownTick } from '../utils/audio';
import { Users, Copy, Check, MessageSquare, Shield, Power, Play, Trash2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LobbyViewProps {
  code: string;
}

const ARCADE_GAMES = [
  {
    id: 'Obstacle Dash',
    name: 'Obstacle Dash',
    description: 'Avoid high-speed static and pulsing barriers to finish first.',
    color: 'from-red-500 to-orange-500',
    icon: '🔥'
  },
  {
    id: 'Space Dodge',
    name: 'Space Dodge',
    description: 'Dodge endless falling asteroids! Survival duration dictating triumph.',
    color: 'from-blue-500 to-indigo-500',
    icon: '☄️'
  },
  {
    id: 'Neon Coin Rush',
    name: 'Neon Coin Rush',
    description: 'Collect maximum glowing nodes. Grid winner is decided by coin scores.',
    color: 'from-green-500 to-teal-500',
    icon: '💎'
  },
  {
    id: 'Parkour Extreme',
    name: 'Parkour Extreme',
    description: 'Jump over deep pits and hurdles using Spacebar! Precise timing is key.',
    color: 'from-pink-500 to-rose-500',
    icon: '🏃'
  }
];

export default function LobbyView({ code }: LobbyViewProps) {
  const [copied, setCopied] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    room,
    players,
    messages,
    isHost,
    currentUserId,
    username,
    isConnected,
    isConnecting,
    error,
    joinRoom,
    leaveRoom,
    toggleReady,
    startGame,
    sendChatMessage,
    kickPlayer,
    submitGameVote,
    hostSelectGame,
    hostClearOverride
  } = useGameStore();

  // Handle automatic joining if room is refreshed or deep linked directly
  useEffect(() => {
    if (!room) {
      const runJoin = async () => {
        // Ensure username is generated or loaded
        await joinRoom(code);
      };
      runJoin();
    }
  }, [room, code]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin + `/room/${code}`);
    setCopied(true);
    playBeep(900, 0.08, 'sine');
    setTimeout(() => setCopied(false), 2000);
  };

  const scrollChatToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollChatToBottom();
  }, [messages]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput.trim());
    setChatInput('');
    playBeep(500, 0.05, 'triangle');
  };

  const handleLeave = async () => {
    playBeep(400, 0.1, 'sine');
    await leaveRoom();
    window.history.pushState(null, '', '/');
    window.dispatchEvent(new Event('pushstate'));
  };

  const handleStartGame = async () => {
    if (!isHost) return;
    
    // Check if anyone else is here
    // Wait, let's verify if all players are ready as well
    const unreadyPlayers = players.filter(p => !p.ready);
    if (unreadyPlayers.length > 0) {
      if (!window.confirm('Some players are not ready. Start anyway?')) {
        return;
      }
    }

    playBeep(950, 0.2, 'sawtooth');
    await startGame();
  };

  if (!room) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-stone-200">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500/20 border-t-red-500 mb-4" />
        <p className="text-sm text-stone-400 font-light">
          {isConnecting ? 'Registering anonymous guest auth session...' : 'Synchronizing lobby room states...'}
        </p>
      </div>
    );
  }

  // Detect when countdown begins and initiate countdown transition
  const countdownActive = room?.status === 'playing' || room?.game_state?.status === 'countdown';

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 text-stone-800 min-h-[85vh]">
      
      {/* Lobby Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <button
            onClick={handleLeave}
            className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800 transition-colors mb-3"
          >
            <ArrowLeft size={14} /> Back to dashboard
          </button>
          
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-stone-900">
              GAME LOBBY: <span className="text-stone-800 font-extrabold">{room.current_game}</span>
            </h1>
            <div className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isConnected ? 'bg-green-155 text-green-700 border border-green-200' : 'bg-stone-100 text-stone-500 border border-stone-200'}`}>
              ● {isConnected ? 'Synchronized' : 'Offline'}
            </div>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Max 5 players. Connect with roommates and race under physical constraints.
          </p>
        </div>

        {/* Invite Code Wrapper */}
        <div className="bg-white border border-stone-200/95 rounded-xl p-3 flex items-center justify-between gap-4 shadow-xs">
          <div>
            <p className="text-xs text-stone-500 font-medium">ROOM CODE</p>
            <p className="text-lg font-black font-mono tracking-widest text-stone-900">{code}</p>
          </div>
          <button
            onClick={handleCopyLink}
            className="p-2.5 bg-stone-50 hover:bg-stone-100 text-stone-500 hover:text-stone-800 rounded-lg border border-stone-200 transition-colors"
            title="Copy room invite link"
          >
            {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* PLAYER LIST SYSTEM */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-white border border-stone-200 p-6 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between border-b border-stone-150 pb-4 mb-4">
              <h2 className="font-bold uppercase tracking-wide text-sm text-stone-600 flex items-center gap-2">
                <Users size={16} className="text-stone-500" /> Players list ({players.length}/5)
              </h2>
              {isHost && (
                <span className="text-xs bg-stone-100 text-stone-700 border border-stone-205 font-bold px-2 py-0.5 rounded shadow-xs">
                  Host Admin
                </span>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <AnimatePresence>
                {players.map((plyr) => {
                  const isUser = plyr.id === currentUserId;
                  const isLobbyHost = plyr.id === room.host_id;

                  return (
                    <motion.div
                      key={plyr.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className={`flex items-center justify-between p-3.5 rounded-xl border ${isUser ? 'bg-stone-50 border-stone-300 shadow-xs' : 'bg-white border-stone-150'} transition-all`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${plyr.ready ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-sm">
                            <span className={isUser ? 'text-stone-900 font-extrabold' : 'text-stone-755'}>
                              {plyr.username}
                            </span>
                            {isUser && <span className="text-xs text-stone-400 font-light">(You)</span>}
                            {isLobbyHost && <Shield size={12} className="text-stone-550 ml-1" title="Lobby Host" />}
                          </div>
                          <span className="text-xs text-stone-450 font-light">
                            {plyr.ready ? 'Ready to Start' : 'Assembling gears...'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* KICK BUTTON FOR HOST */}
                        {isHost && !isUser && (
                          <button
                            onClick={() => {
                              playBeep(300, 0.15, 'sawtooth');
                              kickPlayer(plyr.id);
                            }}
                            className="p-1.5 hover:bg-red-50 text-stone-400 hover:text-red-600 rounded border border-transparent hover:border-red-200 transition-colors"
                            title="Kick player"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        
                        <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase border ${plyr.ready ? 'bg-green-50 text-green-700 border-green-250' : 'bg-amber-50 text-amber-700 border-amber-250'}`}>
                          {plyr.ready ? 'Ready' : 'Not Ready'}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* GAME SELECTION / VOTING SYSTEM */}
          <div className="bg-white border border-stone-200 p-6 rounded-2xl flex flex-col gap-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-stone-150 pb-4 gap-2">
              <div>
                <h3 className="font-bold uppercase tracking-wide text-sm text-stone-800">
                  Select Game Mode Arena
                </h3>
                <p className="text-xs text-stone-500 font-light mt-0.5">
                  Play the most-voted game or let the host directly override.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isHost && room?.game_state?.hostOverride && (
                  <button
                    onClick={() => {
                      playBeep(600, 0.08, 'sine');
                      hostClearOverride();
                    }}
                    className="text-xs bg-amber-50 hover:bg-amber-120 text-amber-700 font-bold border border-amber-250 px-3 py-1 rounded-xl transition-all shadow-xs"
                    title="Unlock to use the player votes"
                  >
                    🗳️ Follow Voting Majority
                  </button>
                )}
                <span className="self-start sm:self-center text-xs font-semibold px-2.5 py-1 bg-stone-50 text-stone-600 rounded-lg border border-stone-200 font-mono">
                  Votes: {Object.keys(room?.game_state?.votes || {}).length} / {players.length}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {(() => {
                // Calculate majority vote winner in real time
                const voteCounts: Record<string, number> = {};
                players.forEach((p) => {
                  const v = room?.game_state?.votes?.[p.id];
                  if (v) voteCounts[v] = (voteCounts[v] || 0) + 1;
                });

                let majorityGameId = '';
                let maxVotesCount = 0;
                for (const [gName, count] of Object.entries(voteCounts)) {
                  if (count > maxVotesCount) {
                    maxVotesCount = count;
                    majorityGameId = gName;
                  } else if (count === maxVotesCount && gName === room?.game_state?.votes?.[room.host_id || '']) {
                    // Host breaks ties
                    majorityGameId = gName;
                  }
                }

                const isHostOverridden = room?.game_state?.hostOverride === true;

                return ARCADE_GAMES.map((game) => {
                  const isSelected = room?.current_game === game.id;
                  const isPopularMajority = game.id === majorityGameId && maxVotesCount > 0;
                  const votes = players.filter(p => room?.game_state?.votes?.[p.id] === game.id);
                  const hasMyVote = room?.game_state?.votes?.[currentUserId || ''] === game.id;

                  return (
                    <div
                      key={game.id}
                      className={`relative rounded-xl p-4 border transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'bg-stone-50/70 border-stone-400 shadow-sm'
                          : 'bg-white border-stone-200/85 hover:border-stone-300'
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute -top-2.5 left-3 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-stone-900 text-stone-50 rounded-md border border-stone-800 shadow-xs">
                          {isHostOverridden && room?.game_state?.hostSelectedGame === game.id ? '👑 Host Select' : '🗳️ Vote Choice'}
                        </span>
                      )}

                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">{game.icon}</span>
                          <h4 className="font-bold text-sm text-stone-800">{game.name}</h4>
                        </div>
                        <p className="text-xs text-stone-500 leading-relaxed font-light">
                          {game.description}
                        </p>
                      </div>

                      <div className="space-y-3">
                        {/* Vote tags */}
                        {votes.length > 0 ? (
                          <div className="flex flex-wrap gap-1 pt-2 border-t border-stone-150">
                            {votes.map(v => (
                              <span
                                key={v.id}
                                className="text-[9px] bg-stone-100 border border-stone-200/70 text-stone-600 px-1.5 py-0.5 rounded font-mono truncate max-w-full"
                                title={`${v.username} voted for this`}
                              >
                                🗳️ {v.username}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-stone-150 text-[9px] text-stone-400 font-mono">
                            No current votes
                          </div>
                        )}

                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => {
                              playBeep(600, 0.08, 'sine');
                              submitGameVote(game.id);
                            }}
                            className={`w-full py-1.5 text-xs font-bold rounded-lg border transition-all ${
                              hasMyVote
                                ? 'bg-emerald-600 text-white border-transparent'
                                : 'bg-stone-900 hover:bg-stone-800 text-white border-transparent cursor-pointer'
                            }`}
                          >
                            {hasMyVote ? '✓ Voted' : 'Vote'}
                          </button>

                          {isHost && (
                            <button
                              onClick={() => {
                                playBeep(850, 0.08, 'sawtooth');
                                hostSelectGame(game.id);
                              }}
                              className={`w-full py-1 text-[9px] uppercase tracking-wide font-bold rounded-md border transition-all ${
                                isHostOverridden && room?.game_state?.hostSelectedGame === game.id
                                  ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-default'
                                  : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-900 hover:text-white hover:border-transparent cursor-pointer'
                              }`}
                              disabled={isHostOverridden && room?.game_state?.hostSelectedGame === game.id}
                            >
                              {isHostOverridden && room?.game_state?.hostSelectedGame === game.id ? '👑 Override Active' : 'Host Override'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* LOBBY STANDBY SETTINGS */}
          <div className="bg-white border border-stone-200 p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
            <div>
              <p className="font-bold text-sm uppercase tracking-wider text-stone-700">Match controls</p>
              <p className="text-xs text-stone-500 font-light">
                {isHost
                  ? 'As host, configure and coordinate start intervals once everyone joins.'
                  : 'Declare ready status so the host can ignite the racing tracking.'}
              </p>
            </div>

            <div className="flex items-center w-full sm:w-auto gap-3">
              {/* Ready btn */}
              <button
                onClick={toggleReady}
                className="flex-1 sm:flex-initial px-6 py-3 bg-white hover:bg-stone-50 text-stone-700 font-semibold rounded-xl border border-stone-250 hover:border-stone-350 transition-colors inline-flex items-center justify-center gap-2 text-sm shadow-xs cursor-pointer"
              >
                <Power size={14} className="text-stone-500" />
                Change Ready
              </button>

              {/* Start btn for HOST */}
              {isHost && (
                <button
                  onClick={handleStartGame}
                  className="flex-1 sm:flex-initial px-6 py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl shadow-xs transition-colors inline-flex items-center justify-center gap-2 text-sm uppercase tracking-wider cursor-pointer"
                >
                  <Play size={14} fill="currentColor" />
                  Ignite Dash: {room?.current_game || 'Obstacle Dash'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* CHAT PANEL */}
        <div className="bg-white border border-stone-200 rounded-2xl flex flex-col h-[500px] shadow-xs">
          <div className="p-4 border-b border-stone-150 flex items-center justify-between">
            <h3 className="font-bold uppercase tracking-wide text-xs text-stone-700 flex items-center gap-1.5">
              <MessageSquare size={14} className="text-stone-500" /> Lobby chat
            </h3>
            <span className="text-[10px] text-stone-400">Live Updates</span>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 font-light text-sm bg-stone-50/40">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <MessageSquare size={30} className="text-stone-300 mb-2" />
                <p className="text-xs text-stone-500">Send a greeting message to start the room chatter!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isSystem = msg.username === 'System' || msg.username === 'SYSTEM';
                const isSelf = msg.player_id === currentUserId;

                if (isSystem) {
                  return (
                    <div key={msg.id} className="text-center">
                      <span className="bg-stone-100 text-stone-500 text-[10px] px-2 py-0.5 rounded border border-stone-200">
                        {msg.message}
                      </span>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-stone-400 mb-0.5">
                      {isSelf ? 'You' : msg.username}
                    </span>
                    <div className={`px-3 py-2 rounded-xl text-xs max-w-[85%] ${isSelf ? 'bg-stone-905 text-white rounded-tr-none' : 'bg-white text-stone-800 rounded-tl-none border border-stone-200 shadow-xs'}`}>
                      {msg.message}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Form Area */}
          <form onSubmit={handleSendChat} className="p-3 border-t border-stone-150 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type your message..."
              maxLength={150}
              className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-stone-400 text-stone-900"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="px-4 py-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-xs font-bold text-white rounded-xl transition-all"
            >
              Send
            </button>
          </form>
        </div>

      </div>

      {/* Countdown overlay overlay */}
      {countdownActive && (
        <CountdownOverlay seconds={room.game_state?.countdown || 5} gameName={room.current_game} />
      )}
    </div>
  );
}

// Simple internal countdown countdown overlay
function CountdownOverlay({ seconds, gameName }: { seconds: number; gameName: string }) {
  const [internalSeconds, setInternalSeconds] = useState(seconds);

  useEffect(() => {
    // Keep local timer updated
    if (seconds > 0) {
      setInternalSeconds(seconds);
    }
  }, [seconds]);

  useEffect(() => {
    const timer = setInterval(() => {
      setInternalSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        playCountdownTick();
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/90 backdrop-blur-md flex flex-col items-center justify-center">
      <motion.div
        key={internalSeconds}
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.5 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <p className="text-stone-500 uppercase tracking-widest text-sm mb-2 font-bold animate-pulse">Launching {gameName}</p>
        <span className="text-8xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-orange-500 font-mono">
          {internalSeconds > 0 ? internalSeconds : 'GO!'}
        </span>
      </motion.div>
    </div>
  );
}
