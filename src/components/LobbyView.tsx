import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../useGameStore';
import { playBeep, playCountdownTick } from '../utils/audio';
import { Users, Copy, Check, MessageSquare, Shield, Power, Play, Trash2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LobbyViewProps {
  code: string;
}

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
    kickPlayer
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
    <div className="w-full max-w-6xl mx-auto px-4 py-8 text-white min-h-[85vh]">
      
      {/* Lobby Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <button
            onClick={handleLeave}
            className="flex items-center gap-1 text-sm text-stone-400 hover:text-red-400 transition-colors mb-3"
          >
            <ArrowLeft size={14} /> Back to dashboard
          </button>
          
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
              GAME LOBBY: <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">{room.current_game}</span>
            </h1>
            <div className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isConnected ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-stone-500/10 text-stone-400 border border-stone-500/20'}`}>
              ● {isConnected ? 'Synchronized' : 'Offline'}
            </div>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Max 5 players. Connect with roommates and race under physical constraints.
          </p>
        </div>

        {/* Invite Code Wrapper */}
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-stone-500 font-medium">ROOM CODE</p>
            <p className="text-lg font-black font-mono tracking-widest text-red-400">{code}</p>
          </div>
          <button
            onClick={handleCopyLink}
            className="p-2.5 bg-stone-950 hover:bg-stone-800 text-stone-400 hover:text-white rounded-lg border border-stone-800 transition-colors"
            title="Copy room invite link"
          >
            {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* PLAYER LIST SYSTEM */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-stone-900/60 border border-stone-800 p-6 rounded-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-4 mb-4">
              <h2 className="font-bold uppercase tracking-wide text-sm text-stone-400 flex items-center gap-2">
                <Users size={16} /> Players list ({players.length}/5)
              </h2>
              {isHost && (
                <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 font-bold px-2 py-0.5 rounded">
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
                      className={`flex items-center justify-between p-4 rounded-xl border ${isUser ? 'bg-gradient-to-r from-stone-950 to-stone-900/50 border-stone-700/60' : 'bg-stone-950/40 border-stone-800/80'} transition-all`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${plyr.ready ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-sm">
                            <span className={isUser ? 'text-red-400' : 'text-stone-200'}>
                              {plyr.username}
                            </span>
                            {isUser && <span className="text-xs text-stone-500 font-light">(You)</span>}
                            {isLobbyHost && <Shield size={12} className="text-orange-500 ml-1" title="Lobby Host" />}
                          </div>
                          <span className="text-xs text-stone-500 font-light">
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
                            className="p-1.5 hover:bg-red-500/10 text-stone-500 hover:text-red-500 rounded border border-transparent hover:border-red-500/20 transition-colors"
                            title="Kick player"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase ${plyr.ready ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'}`}>
                          {plyr.ready ? 'Ready' : 'Not Ready'}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* LOBBY STANDBY SETTINGS */}
          <div className="bg-stone-900/60 border border-stone-800 p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-bold text-sm uppercase tracking-wider text-stone-400">Match controls</p>
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
                className="flex-1 sm:flex-initial px-6 py-3 bg-stone-950 hover:bg-stone-900 text-stone-300 font-semibold rounded-xl border border-stone-800 hover:border-stone-700 transition-colors inline-flex items-center justify-center gap-2 text-sm"
              >
                <Power size={14} className="text-orange-500" />
                Change Ready
              </button>

              {/* Start btn for HOST */}
              {isHost && (
                <button
                  onClick={handleStartGame}
                  className="flex-1 sm:flex-initial px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-stone-100 font-bold rounded-xl shadow-lg shadow-red-950/20 hover:shadow-orange-900/10 transition-all inline-flex items-center justify-center gap-2 text-sm uppercase tracking-wide"
                >
                  <Play size={14} fill="currentColor" />
                  Ignite Dash
                </button>
              )}
            </div>
          </div>
        </div>

        {/* CHAT PANEL */}
        <div className="bg-stone-900/60 border border-stone-800 rounded-2xl flex flex-col h-[500px]">
          <div className="p-4 border-b border-stone-800 flex items-center justify-between">
            <h3 className="font-bold uppercase tracking-wide text-xs text-stone-400 flex items-center gap-1.5">
              <MessageSquare size={14} /> Lobby chat
            </h3>
            <span className="text-[10px] text-stone-500">Live Updates</span>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 font-light text-sm">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <MessageSquare size={30} className="text-stone-700 mb-2" />
                <p className="text-xs text-stone-600">Send a greeting message to start the room chatter!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isSystem = msg.username === 'System' || msg.username === 'SYSTEM';
                const isSelf = msg.player_id === currentUserId;

                if (isSystem) {
                  return (
                    <div key={msg.id} className="text-center">
                      <span className="bg-stone-950 text-stone-500 text-[10px] px-2 py-0.5 rounded border border-stone-900">
                        {msg.message}
                      </span>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-stone-500 mb-0.5">
                      {isSelf ? 'You' : msg.username}
                    </span>
                    <div className={`px-3 py-2 rounded-xl text-xs max-w-[85%] ${isSelf ? 'bg-red-600 text-white rounded-tr-none' : 'bg-stone-950 text-stone-200 rounded-tl-none border border-stone-800'}`}>
                      {msg.message}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Form Area */}
          <form onSubmit={handleSendChat} className="p-3 border-t border-stone-800 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type your message..."
              maxLength={150}
              className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-red-500 text-white"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="px-3 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-xs font-bold rounded-xl transition-all"
            >
              Send
            </button>
          </form>
        </div>

      </div>

      {/* Countdown overlay overlay */}
      {countdownActive && (
        <CountdownOverlay seconds={room.game_state?.countdown || 5} />
      )}
    </div>
  );
}

// Simple internal countdown countdown overlay
function CountdownOverlay({ seconds }: { seconds: number }) {
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
        <p className="text-stone-500 uppercase tracking-widest text-sm mb-2 font-bold animate-pulse">Launching Obstacle Dash</p>
        <span className="text-8xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-orange-500 font-mono">
          {internalSeconds > 0 ? internalSeconds : 'GO!'}
        </span>
      </motion.div>
    </div>
  );
}
