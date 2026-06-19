import React, { useState, useEffect } from 'react';
import { useGameStore } from './useGameStore';
import { isSupabaseConfigured } from './supabaseClient';
import HomeView from './components/HomeView';
import LobbyView from './components/LobbyView';
import GameView from './components/GameView';
import ResultsView from './components/ResultsView';
import { Gamepad2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// A simple path-based client router to support standard URLs:
// - /
// - /room/[code]
// - /results/[code]
function parsePath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts.length === 0) {
    return { route: 'home', code: null };
  }
  if (parts[0] === 'room' && parts[1]) {
    return { route: 'room', code: parts[1].toUpperCase() };
  }
  if (parts[0] === 'results' && parts[1]) {
    return { route: 'results', code: parts[1].toUpperCase() };
  }
  return { route: 'home', code: null };
}

export default function App() {
  const [currentPath, setCurrentPath] = useState(parsePath());
  const { username, initializeSession, isConnecting, room } = useGameStore();
  const [guestNameInput, setGuestNameInput] = useState('');

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(parsePath());
    };
    
    // Wire up listeners for client navigation events
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('pushstate', handleLocationChange);
    window.addEventListener('replacestate', handleLocationChange);
    
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('pushstate', handleLocationChange);
      window.removeEventListener('replacestate', handleLocationChange);
    };
  }, []);

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestNameInput.trim()) return;
    await initializeSession(guestNameInput.trim());
  };

  // Render correct view based on route state
  const renderContent = () => {
    const { route, code } = currentPath;

    if (route === 'home') {
      return <HomeView />;
    }

    // Direct link or Refresh support
    // If we have a code but the active player hasn't declared a username:
    if (code && !username) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[75vh] p-4 text-white">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-2xl p-8 relative overflow-hidden"
          >
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500 to-orange-500" />
            <h2 className="text-xl font-black uppercase text-stone-200 mb-2">Join Multiplayer Race</h2>
            <p className="text-xs text-stone-500 font-light mb-6">
              Enter a guest name below to register your session for room <span className="text-red-400 font-mono font-bold">{code}</span>.
            </p>

            <form onSubmit={handleGuestSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2 font-bold">
                  Your Nickname
                </label>
                <input
                  type="text"
                  required
                  maxLength={15}
                  value={guestNameInput}
                  onChange={(e) => setGuestNameInput(e.target.value)}
                  placeholder="TurboRacer"
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isConnecting || !guestNameInput.trim()}
                className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-sm font-bold text-white rounded-xl uppercase tracking-wider transition-all"
              >
                {isConnecting ? 'Registering session...' : 'Connect and Enter'}
              </button>
            </form>
          </motion.div>
        </div>
      );
    }

    if (route === 'room' && code) {
      // Dynamic shift: If the room metadata table is loaded AND states are in 'playing',
      // automatically swap Lobby page to GameView track canvas!
      if (room && room.status === 'playing') {
        return <GameView code={code} />;
      }
      return <LobbyView code={code} />;
    }

    if (route === 'results' && code) {
      return <ResultsView code={code} />;
    }

    return <HomeView />;
  };

  return (
    <div className="min-h-screen bg-black select-none overflow-x-hidden font-sans">
      
      {/* Decorative ambient overhead glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[120px] bg-red-500/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Global Header Bar */}
      <header className="border-b border-stone-900 bg-black/60 backdrop-blur-md sticky top-0 z-40 px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div
            onClick={() => {
              window.history.pushState(null, '', '/');
              window.dispatchEvent(new Event('pushstate'));
            }}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="bg-red-500/10 text-red-500 p-2 rounded-xl group-hover:bg-red-500 group-hover:text-black transition-colors duration-200">
              <Gamepad2 size={16} className="orbit-spin-icon" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-stone-200">neonGP</p>
              <p className="text-[9px] text-stone-600 font-medium">Multiplayer Arcade</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            {username && (
              <span className="text-stone-500 font-light flex items-center gap-1.5 bg-stone-950/40 p-2 rounded-lg border border-stone-900">
                Logged in as <span className="text-stone-300 font-bold">@{username}</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Core Body Container */}
      <main className="relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPath.route + (currentPath.code || '')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer Branding */}
      <footer className="border-t border-stone-900 py-6 text-center text-[10px] text-stone-600 font-light mt-12 bg-stone-950/20">
        <p>© 2026 NEON GRAND PRIX INC. OPTIMIZED FOR HIGH-PERFORMANCE LOW-LATENCY SYNC CLIENTS.</p>
      </footer>
    </div>
  );
}
