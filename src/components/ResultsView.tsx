import React, { useEffect } from 'react';
import { useGameStore } from '../useGameStore';
import { playVictorySound, playBeep } from '../utils/audio';
import { Trophy, Home, RotateCcw, ArrowRight, ShieldCheck, Gamepad } from 'lucide-react';
import { motion } from 'motion/react';

interface ResultsViewProps {
  code: string;
}

export default function ResultsView({ code }: ResultsViewProps) {
  const {
    room,
    players,
    isHost,
    resetRoomToLobby,
    leaveRoom
  } = useGameStore();

  useEffect(() => {
    // Play celebratory theme on mount
    playVictorySound();
  }, []);

  const handleRestartLobby = async () => {
    if (!isHost) return;
    playBeep(900, 0.1, 'triangle');
    await resetRoomToLobby();
    
    // Redirect rooms back to pre-game lobbies
    window.history.pushState(null, '', `/room/${code}`);
    window.dispatchEvent(new Event('pushstate'));
  };

  const handleLeave = async () => {
    playBeep(400, 0.1, 'sine');
    await leaveRoom();
    window.history.pushState(null, '', '/');
    window.dispatchEvent(new Event('pushstate'));
  };

  // Sort players by distance hierarchy or finished flags
  const sortedStandings = [...players].sort((a, b) => {
    if (a.finished && !b.finished) return -1;
    if (!a.finished && b.finished) return 1;
    
    // If finished / completed, or sort by progress/positions
    return b.y_position - a.y_position; 
  });

  const goldWinner = sortedStandings[0];
  const silverWinner = sortedStandings[1];
  const bronzeWinner = sortedStandings[2];

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-12 text-stone-800 min-h-[85vh] flex flex-col items-center justify-center">
      
      {/* Title Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <span className="bg-stone-100 text-stone-600 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider border border-stone-200 shadow-xs inline-flex items-center gap-1.5 mb-3">
          <Trophy size={12} className="text-amber-500" /> GP Grand Prix Complete
        </span>
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-stone-900">
          Race Results
        </h1>
        <p className="text-xs text-stone-500 mt-2 font-light">
          The race is complete. Congratulations to the victors of the Grand Prix track!
        </p>
      </motion.div>

      {/* Cyber Podium Vector Graphics */}
      <div className="grid grid-cols-3 max-w-lg w-full items-end gap-2 md:gap-4 mb-16 px-4">
        
        {/* Silver Medal (2nd) */}
        <div className="flex flex-col items-center">
          {silverWinner ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center mb-2"
            >
              <div className="w-10 h-10 rounded-full bg-stone-200 border border-stone-300 flex items-center justify-center font-bold text-xs text-stone-700 mx-auto shadow-xs">
                2nd
              </div>
              <p className="text-xs font-bold text-stone-700 mt-1 truncate max-w-[80px]">{silverWinner.username}</p>
            </motion.div>
          ) : (
            <div className="h-10 w-10 bg-stone-50 rounded-full border border-stone-200 mb-2 flex items-center justify-center text-xs text-stone-400">-</div>
          )}
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 80 }}
            transition={{ delay: 0.2 }}
            className="w-full bg-stone-100 border border-stone-250 rounded-t-xl flex items-center justify-center font-black text-2xl text-stone-400 font-mono shadow-xs"
          >
            II
          </motion.div>
        </div>

        {/* Gold Medal (1st) */}
        <div className="flex flex-col items-center">
          {goldWinner ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center mb-2"
            >
              <div className="w-14 h-14 rounded-full bg-amber-100 border-2 border-amber-400 flex items-center justify-center font-black text-lg text-amber-700 shadow-md mx-auto animate-bounce" style={{ animationDuration: '3s' }}>
                👑
              </div>
              <p className="text-sm font-extrabold text-amber-700 mt-1 truncate max-w-[100px]">
                {goldWinner.username}
              </p>
            </motion.div>
          ) : (
            <div className="h-14 w-14 bg-stone-50 rounded-full border border-stone-200 mb-2 flex items-center justify-center text-xs text-stone-400">-</div>
          )}
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 120 }}
            className="w-full bg-stone-200/60 border border-stone-300 rounded-t-xl flex items-center justify-center font-black text-4xl text-stone-550 font-mono shadow-xs relative overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-1 bg-amber-400/50" />
            I
          </motion.div>
        </div>

        {/* Bronze Medal (3rd) */}
        <div className="flex flex-col items-center">
          {bronzeWinner ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center mb-2"
            >
              <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-305 flex items-center justify-center font-bold text-xs text-amber-700 mx-auto shadow-xs">
                3rd
              </div>
              <p className="text-xs font-bold text-amber-700 mt-1 truncate max-w-[80px]">{bronzeWinner.username}</p>
            </motion.div>
          ) : (
            <div className="h-10 w-10 bg-stone-50 rounded-full border border-stone-200 mb-2 flex items-center justify-center text-xs text-stone-400">-</div>
          )}
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 60 }}
            transition={{ delay: 0.4 }}
            className="w-full bg-stone-100/60 border border-stone-200 rounded-t-xl flex items-center justify-center font-black text-xl text-stone-400 font-mono shadow-xs"
          >
            III
          </motion.div>
        </div>

      </div>

      {/* Structured Standings Listing */}
      <div className="w-full max-w-xl bg-white border border-stone-200 p-6 rounded-2xl mb-8 shadow-xs">
        <h3 className="font-bold text-xs uppercase tracking-wider text-stone-600 mb-4 border-b border-stone-150 pb-2">
          Final standings listing
        </h3>

        <div className="flex flex-col gap-2.5">
          {sortedStandings.map((plyr, idx) => (
            <div
              key={plyr.id}
              className="flex items-center justify-between p-3 bg-stone-50/60 rounded-xl border border-stone-150"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-stone-400 font-mono w-4">
                  #{idx + 1}
                </span>
                <span className="text-sm font-bold text-stone-800">
                  {plyr.username}
                </span>
              </div>

              <span className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border ${plyr.finished ? 'bg-green-50 text-green-700 border-green-250' : 'bg-red-50 text-red-700 border-red-250'}`}>
                {plyr.finished ? 'Complete' : 'DNF'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer controls */}
      <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-xl justify-center">
        <button
          onClick={handleLeave}
          className="w-full sm:w-auto px-6 py-3 bg-white hover:bg-stone-50 text-stone-700 font-semibold rounded-xl border border-stone-250 hover:border-stone-350 transition-colors inline-flex items-center justify-center gap-2 text-sm shadow-xs"
        >
          <Home size={14} /> Back to dashboard
        </button>

        {isHost ? (
          <button
            onClick={handleRestartLobby}
            className="w-full sm:w-auto px-6 py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl shadow-xs transition-all inline-flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
          >
            <RotateCcw size={14} /> Reset Room Lobby
          </button>
        ) : (
          <div className="text-xs text-stone-500 font-medium flex items-center gap-1.5 bg-stone-50 p-3 rounded-xl border border-stone-200">
            <ShieldCheck size={14} className="text-stone-400" /> Wait for the Host to restart...
          </div>
        )}
      </div>

    </div>
  );
}
