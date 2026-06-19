import React, { useState, useEffect } from 'react';
import { useGameStore } from '../useGameStore';
import { isSupabaseConfigured } from '../supabaseClient';
import { Gamepad2, Users, Flame, Plus, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { playBeep } from '../utils/audio';

export default function HomeView() {
  const [usernameInput, setUsernameInput] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [isJoiningMode, setIsJoiningMode] = useState(false);
  const [setupStep, setSetupStep] = useState(1); // 1: Username, 2: Room Choice / Action

  const {
    username,
    initializeSession,
    createRoom,
    joinRoom,
    isConnecting,
    error,
  } = useGameStore();

  useEffect(() => {
    // If username is already persisted, skip directly to action step
    if (username) {
      setUsernameInput(username);
      setSetupStep(2);
    }
  }, [username]);

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;

    playBeep(600, 0.1, 'sine');
    const uId = await initializeSession(usernameInput.trim());
    if (uId) {
      setSetupStep(2);
    }
  };

  const handleCreateRoom = async () => {
    playBeep(800, 0.12, 'triangle');
    const code = await createRoom();
    if (code) {
      // Successful navigation is handled by the root pathname watch in App.tsx
      window.history.pushState(null, '', `/room/${code}`);
      window.dispatchEvent(new Event('pushstate'));
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = roomCodeInput.trim().toUpperCase();
    if (cleanCode.length !== 6) return;

    playBeep(800, 0.12, 'triangle');
    const success = await joinRoom(cleanCode);
    if (success) {
      window.history.pushState(null, '', `/room/${cleanCode}`);
      window.dispatchEvent(new Event('pushstate'));
    }
  };

  const dbConfigured = isSupabaseConfigured();

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] text-stone-850 p-4">
      {/* Platform Title */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <span className="bg-stone-100 text-stone-600 text-[11px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider border border-stone-200 shadow-xs inline-flex items-center gap-1.5 mb-4">
          <Flame size={12} className="text-amber-500 animate-pulse" /> May the best nigga/chigga win
        </span>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight uppercase text-stone-900">
          The Mini-Game Arcade
        </h1>
        <p className="text-stone-500 mt-2 text-sm md:text-base font-light max-w-md mx-auto">
          High-performance, minimal real-time multiplayer games.
        </p>
      </motion.div>

      {/* Database Warning */}
      {!dbConfigured && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-amber-50 border border-amber-200/80 text-amber-800 p-4 rounded-xl max-w-md mb-8 text-sm text-center shadow-xs"
        >
          <p className="font-semibold mb-1">🎮 Local Sandbox Warning</p>
          <p className="font-light text-amber-800/80">
            Supabase is not configured yet. Set <code className="bg-amber-100/50 px-1 py-0.5 rounded font-mono">NEXT_PUBLIC_SUPABASE_URL</code> in your <code className="font-mono">.env.example</code> to enable real multiplayer rooms.
          </p>
        </motion.div>
      )}

      {/* Main card box */}
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-white border border-stone-200/80 p-8 rounded-2xl shadow-sm relative overflow-hidden"
      >

        <AnimatePresence mode="wait">
          {/* STEP 1: Username Config */}
          {setupStep === 1 ? (
            <motion.form
              key="step-username"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleUsernameSubmit}
              className="flex flex-col gap-5"
            >
              <div>
                <label className="block text-xs uppercase tracking-wider text-stone-500 mb-2 font-semibold">
                  Choose Username
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-stone-450 pointer-events-none">
                    @
                  </span>
                  <input
                    type="text"
                    required
                    maxLength={15}
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="SpeedSter"
                    className="w-full bg-stone-50 border border-stone-200 text-stone-900 rounded-xl py-3 pl-8 pr-4 text-base focus:border-stone-450 focus:outline-none transition-colors duration-250"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isConnecting || !usernameInput.trim()}
                className="w-full py-3 bg-stone-900 hover:bg-stone-800 disabled:opacity-55 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs"
              >
                {isConnecting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-stone-300 border-t-stone-800" />
                ) : (
                  <>
                    Continue <Check size={18} />
                  </>
                )}
              </button>
            </motion.form>
          ) : (
            /* STEP 2: Room Selection & Join Option */
            <motion.div
              key="step-action"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-6"
            >
              <div className="flex items-center gap-3 bg-stone-50 p-3 rounded-xl border border-stone-200/80">
                <div className="w-8 h-8 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center font-bold">
                  @
                </div>
                <div>
                  <p className="text-xs text-stone-500 font-medium">Logged in as</p>
                  <p className="text-sm font-semibold text-stone-800">{username}</p>
                </div>
                <button
                  onClick={() => setSetupStep(1)}
                  className="ml-auto text-xs text-stone-500 hover:text-stone-900 hover:underline"
                >
                  Change
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {/* Create Room Button */}
                <button
                  onClick={handleCreateRoom}
                  disabled={isConnecting || !dbConfigured}
                  className="w-full py-3.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed font-bold rounded-xl text-white flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <Plus size={18} /> Create New Room
                </button>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-stone-150"></div>
                  <span className="flex-shrink mx-4 text-xs tracking-wider text-stone-400 font-bold uppercase">
                    OR
                  </span>
                  <div className="flex-grow border-t border-stone-150"></div>
                </div>

                {isJoiningMode ? (
                  <form onSubmit={handleJoinSubmit} className="flex flex-col gap-3">
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-stone-500 mb-1.5 font-semibold">
                        Enter 6-char Room Code
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={roomCodeInput}
                        onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                        placeholder="XYZABC"
                        className="w-full bg-stone-50 border border-stone-200 text-stone-900 rounded-xl py-3 px-4 text-center text-lg font-mono tracking-widest uppercase focus:border-stone-450 focus:outline-none transition-colors"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setIsJoiningMode(false)}
                        className="py-2.5 bg-white hover:bg-stone-50 text-stone-500 rounded-xl text-sm font-semibold transition-colors border border-stone-200"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={isConnecting || roomCodeInput.trim().length !== 6 || !dbConfigured}
                        className="py-2.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-all shadow-sm"
                      >
                        {isConnecting ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-stone-500 border-t-white mx-auto" />
                        ) : (
                          'Confirm Join'
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => {
                      playBeep(700, 0.1, 'sine');
                      setIsJoiningMode(true);
                    }}
                    disabled={!dbConfigured}
                    className="w-full py-3.5 bg-white hover:bg-stone-50 disabled:opacity-40 text-stone-850 font-medium rounded-xl border border-stone-200 hover:border-stone-300 transition-colors flex items-center justify-center gap-2 shadow-xs"
                  >
                    <Users size={16} className="text-stone-500" /> Join Room via Code
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error message logs wrapper */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-light text-center"
          >
            {error}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
