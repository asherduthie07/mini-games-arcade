import { create } from 'zustand';
import { getSupabase, isSupabaseConfigured } from './supabaseClient';

export interface Player {
  id: string;
  room_id: string;
  username: string;
  x_position: number;
  y_position: number;
  velocity: { x: number; y: number };
  score: number;
  ready: boolean;
  finished: boolean;
  connected: boolean;
}

export interface Room {
  id: string;
  room_code: string;
  host_id: string;
  game_state: {
    status?: 'lobby' | 'countdown' | 'playing' | 'results';
    countdown?: number;
    winnerId?: string;
    startTime?: number;
    votes?: Record<string, string>; // player_id -> game_name
  };
  current_game: string;
  status: 'lobby' | 'playing' | 'finished';
  created_at: string;
}

export interface Message {
  id: string;
  room_id: string;
  player_id: string;
  username: string;
  message: string;
  timestamp: string;
}

export interface GameEvent {
  id: string;
  room_id: string;
  type: string;
  payload: any;
  created_at: string;
}

interface GameStoreState {
  roomId: string | null;
  roomCode: string | null;
  currentUserId: string | null;
  username: string;
  isHost: boolean;
  room: Room | null;
  players: Player[];
  messages: Message[];
  isConnected: boolean;
  error: string | null;
  isConnecting: boolean;

  // Actions
  initializeSession: (usernameInput?: string) => Promise<string | null>;
  createRoom: () => Promise<string | null>;
  joinRoom: (code: string) => Promise<boolean>;
  leaveRoom: () => Promise<void>;
  toggleReady: () => Promise<void>;
  startGame: () => Promise<void>;
  updatePlayerPosition: (x: number, y: number, vx: number, vy: number, finished?: boolean, score?: number) => Promise<void>;
  sendChatMessage: (text: string) => Promise<void>;
  sendGameEvent: (type: string, payload: any) => Promise<void>;
  kickPlayer: (playerId: string) => Promise<void>;
  resetRoomToLobby: () => Promise<void>;
  submitGameVote: (gameName: string) => Promise<void>;
  hostSelectGame: (gameName: string) => Promise<void>;
  subscribeToRoom: (roomCode: string) => void;
  unsubscribeFromRoom: () => void;
}

// Keep a local subscription reference
let realtimeChannel: any = null;

export const useGameStore = create<GameStoreState>((set, get) => {
  // Helper to get raw supabase client
  const getClient = (): any => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase is not configured.');
    }
    return getSupabase() as any;
  };

  return {
    roomId: null,
    roomCode: null,
    currentUserId: localStorage.getItem('multiplayer_player_id') || null,
    username: localStorage.getItem('multiplayer_username') || '',
    isHost: false,
    room: null,
    players: [],
    messages: [],
    isConnected: false,
    error: null,
    isConnecting: false,

    initializeSession: async (usernameInput) => {
      set({ error: null });
      const finalUsername = usernameInput || get().username;
      if (!finalUsername) return null;

      try {
        let userId = get().currentUserId;

        if (isSupabaseConfigured()) {
          const supabase = getClient();
          const { data: authData, error: authErr } = await supabase.auth.signInAnonymously();
          if (authErr) throw authErr;
          
          userId = authData?.user?.id || null;
        }

        // Fallback or override with standard UUID if needed
        if (!userId) {
          userId = crypto.randomUUID();
        }

        localStorage.setItem('multiplayer_player_id', userId);
        localStorage.setItem('multiplayer_username', finalUsername);

        set({ currentUserId: userId, username: finalUsername });
        return userId;
      } catch (err: any) {
        set({ error: `Auth Error: ${err.message || err}` });
        // Return standard local fallback so users can practice locally or with fake connections
        const fallbackId = get().currentUserId || crypto.randomUUID();
        localStorage.setItem('multiplayer_player_id', fallbackId);
        localStorage.setItem('multiplayer_username', finalUsername);
        set({ currentUserId: fallbackId, username: finalUsername });
        return fallbackId;
      }
    },

    createRoom: async () => {
      const { currentUserId, username } = get();
      if (!currentUserId || !username) {
        set({ error: 'Please set your username first' });
        return null;
      }

      set({ error: null, isConnecting: true });
      try {
        const supabase = getClient();
        
        // Generate a random 6 character uppercase alphanumeric code
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        // Insert new Room
        const { data: roomData, error: roomErr } = await supabase
          .from('rooms')
          .insert({
            room_code: code,
            host_id: currentUserId,
            game_state: { status: 'lobby' },
            current_game: 'Obstacle Dash',
            status: 'lobby'
          })
          .select()
          .single();

        if (roomErr || !roomData) throw roomErr || new Error('Room insertion failed');

        // Insert Current Host Player
        const { error: playerErr } = await supabase
          .from('players')
          .insert({
            id: currentUserId,
            room_id: roomData.id,
            username: username,
            x_position: 400,
            y_position: 2800,
            velocity: { x: 0, y: 0 },
            score: 0,
            ready: true, // host is ready by default
            finished: false,
            connected: true
          });

        if (playerErr) throw playerErr;

        set({
          roomId: roomData.id,
          roomCode: code,
          room: roomData,
          isHost: true,
          isConnecting: false
        });

        get().subscribeToRoom(code);
        return code;
      } catch (err: any) {
        set({ error: `Create Room Failed: ${err.message || err}`, isConnecting: false });
        return null;
      }
    },

    joinRoom: async (code) => {
      const cleanCode = code.trim().toUpperCase();
      const { currentUserId, username } = get();
      if (!currentUserId || !username) {
        set({ error: 'Please set your username first' });
        return false;
      }

      set({ error: null, isConnecting: true });
      try {
        const supabase = getClient();

        // 1. Fetch Room details
        const { data: roomData, error: roomErr } = await supabase
          .from('rooms')
          .select()
          .eq('room_code', cleanCode)
          .single();

        if (roomErr || !roomData) {
          throw new Error('Room not found. Please verify the code.');
        }

        // 2. Check room capacity (max 5 players)
        const { data: playersData, error: countErr } = await supabase
          .from('players')
          .select('id')
          .eq('room_id', roomData.id);

        if (countErr) throw countErr;

        const isReconnecting = playersData.some((p: any) => p.id === currentUserId);
        if (!isReconnecting && playersData.length >= 5) {
          throw new Error('Room is full (Max 5 players).');
        }

        // 3. Insert or update the player row
        const { error: playerInsertErr } = await supabase
          .from('players')
          .upsert({
            id: currentUserId,
            room_id: roomData.id,
            username: username,
            x_position: 400,
            y_position: 2800,
            velocity: { x: 0, y: 0 },
            ready: currentUserId === roomData.host_id, // Host ready by default, others false
            finished: false,
            connected: true
          });

        if (playerInsertErr) throw playerInsertErr;

        set({
          roomId: roomData.id,
          roomCode: cleanCode,
          room: roomData,
          isHost: currentUserId === roomData.host_id,
          isConnecting: false
        });

        get().subscribeToRoom(cleanCode);
        return true;
      } catch (err: any) {
        set({ error: err.message || 'Failed to join room', isConnecting: false });
        return false;
      }
    },

    leaveRoom: async () => {
      const { roomId, currentUserId, roomCode } = get();
      if (!roomId || !currentUserId) return;

      try {
        const supabase = getClient();
        get().unsubscribeFromRoom();

        // If host leaves, delete the room, or reassign host
        if (get().isHost) {
          // Check if there are other players
          const otherPlayers = get().players.filter(p => p.id !== currentUserId);
          if (otherPlayers.length > 0) {
            // Reassign to another player
            const newHost = otherPlayers[0];
            await supabase
              .from('rooms')
              .update({ host_id: newHost.id })
              .eq('id', roomId);
          } else {
            // Delete room
            await supabase
              .from('rooms')
              .delete()
              .eq('id', roomId);
          }
        }

        // Delete player record or set as disconnected
        await supabase
          .from('players')
          .delete()
          .eq('id', currentUserId);

        // Send a goodbye chat message
        await supabase
          .from('messages')
          .insert({
            room_id: roomId,
            player_id: currentUserId,
            username: 'System',
            message: `${get().username} has left the room.`
          });

      } catch (err) {
        console.error('Error leaving room:', err);
      } finally {
        set({
          roomId: null,
          roomCode: null,
          room: null,
          players: [],
          messages: [],
          isHost: false
        });
      }
    },

    toggleReady: async () => {
      const { roomId, currentUserId, players } = get();
      if (!roomId || !currentUserId) return;

      const player = players.find(p => p.id === currentUserId);
      if (!player) return;

      const newReadyState = !player.ready;

      try {
        const supabase = getClient();
        await supabase
          .from('players')
          .update({ ready: newReadyState })
          .eq('id', currentUserId);
      } catch (err) {
        console.error('Toggle ready failed:', err);
      }
    },

    startGame: async () => {
      const { roomId, isHost } = get();
      if (!roomId || !isHost) return;

      try {
        const supabase = getClient();
        
        // Fetch current room state to count votes dynamically
        const { data: latestRoom, error: fetchErr } = await supabase
          .from('rooms')
          .select('game_state, current_game')
          .eq('id', roomId)
          .single();

        if (fetchErr) throw fetchErr;

        let finalGame = latestRoom?.current_game || 'Obstacle Dash';
        const votes = latestRoom?.game_state?.votes || {};
        
        if (Object.keys(votes).length > 0) {
          const voteCounts: Record<string, number> = {};
          Object.values(votes).forEach((gName: any) => {
            voteCounts[gName] = (voteCounts[gName] || 0) + 1;
          });

          let maxVotes = 0;
          let votedWinner = finalGame;
          for (const [gName, count] of Object.entries(voteCounts)) {
            if (count > maxVotes) {
              maxVotes = count;
              votedWinner = gName;
            }
          }
          finalGame = votedWinner;
        }

        // Reset player positions, scores, and finished flags
        await supabase
          .from('players')
          .update({
            x_position: 400,
            y_position: 2800,
            velocity: { x: 0, y: 0 },
            finished: false,
            score: 0 // Reset scores for matches like Coin Rush
          })
          .eq('room_id', roomId);

        // Transition room to active playing with a countdown, preserving the votes in state
        await supabase
          .from('rooms')
          .update({
            status: 'playing',
            current_game: finalGame,
            game_state: {
              status: 'countdown',
              countdown: 5,
              startTime: Date.now() + 5000,
              votes: votes
            }
          })
          .eq('id', roomId);

        // Broadcast a game event
        await supabase
          .from('game_events')
          .insert({
            room_id: roomId,
            type: 'game_start',
            payload: { startTime: Date.now() + 5000, gameMode: finalGame }
          });

      } catch (err) {
        console.error('Failed to start game:', err);
      }
    },

    updatePlayerPosition: async (x, y, vx, vy, finished = false, score?: number) => {
      const { roomId, currentUserId } = get();
      if (!roomId || !currentUserId) return;

      try {
        const supabase = getClient();
        const payload: any = {
          x_position: x,
          y_position: y,
          velocity: { x: vx, y: vy },
          finished: finished
        };
        
        if (score !== undefined) {
          payload.score = score;
        }

        await supabase
          .from('players')
          .update(payload)
          .eq('id', currentUserId);
      } catch (err) {
        console.error('Failed to sync player position:', err);
      }
    },

    sendChatMessage: async (text) => {
      const { roomId, currentUserId, username } = get();
      if (!roomId || !currentUserId || !text.trim()) return;

      try {
        const supabase = getClient();
        await supabase
          .from('messages')
          .insert({
            room_id: roomId,
            player_id: currentUserId,
            username: username,
            message: text.trim()
          });
      } catch (err) {
        console.error('Failed to send message:', err);
      }
    },

    sendGameEvent: async (type, payload) => {
      const { roomId } = get();
      if (!roomId) return;

      try {
        const supabase = getClient();
        await supabase
          .from('game_events')
          .insert({
            room_id: roomId,
            type,
            payload
          });
      } catch (err) {
        console.error('Failed to send game event:', err);
      }
    },

    kickPlayer: async (playerId) => {
      const { roomId, isHost } = get();
      if (!roomId || !isHost) return;

      try {
        const supabase = getClient();
        
        // Remove player record
        await supabase
          .from('players')
          .delete()
          .eq('id', playerId);

        // Send a kick chat message
        await supabase
          .from('messages')
          .insert({
            room_id: roomId,
            player_id: 'SYSTEM',
            username: 'System',
            message: `A player was kicked from the lobby.`
          });

        // Publish a kick event
        await supabase
          .from('game_events')
          .insert({
            room_id: roomId,
            type: 'player_kicked',
            payload: { kickedId: playerId }
          });

      } catch (err) {
        console.error('Failed to kick player:', err);
      }
    },

    resetRoomToLobby: async () => {
      const { roomId, isHost } = get();
      if (!roomId || !isHost) return;

      try {
        const supabase = getClient();
        
        // Reset players to not ready and not finished
        await supabase
          .from('players')
          .update({
            ready: false,
            finished: false,
            x_position: 400,
            y_position: 2800,
            velocity: { x: 0, y: 0 }
          })
          .eq('room_id', roomId);

        // Update room status back to lobby
        await supabase
          .from('rooms')
          .update({
            status: 'lobby',
            game_state: { status: 'lobby' }
          })
          .eq('id', roomId);

        // Send chat alert
        await supabase
          .from('messages')
          .insert({
            room_id: roomId,
            player_id: 'SYSTEM',
            username: 'System',
            message: `The game is complete. Setting lobby back to standby.`
          });

      } catch (err) {
        console.error('Failed to reset room:', err);
      }
    },

    submitGameVote: async (gameName) => {
      const { roomId, currentUserId } = get();
      if (!roomId || !currentUserId) return;

      try {
        const supabase = getClient();
        
        // Fetch current room to prevent overwriting keys in game_state
        const { data: roomData, error: fetchErr } = await supabase
          .from('rooms')
          .select('game_state')
          .eq('id', roomId)
          .single();

        if (fetchErr) throw fetchErr;

        const currentGameState = roomData?.game_state || {};
        const currentVotes = currentGameState.votes || {};

        const updatedGameState = {
          ...currentGameState,
          votes: {
            ...currentVotes,
            [currentUserId]: gameName
          }
        };

        await supabase
          .from('rooms')
          .update({
            game_state: updatedGameState
          })
          .eq('id', roomId);

      } catch (err) {
        console.error('Failed to submit game vote:', err);
      }
    },

    hostSelectGame: async (gameName) => {
      const { roomId, isHost } = get();
      if (!roomId || !isHost) return;

      try {
        const supabase = getClient();
        
        await supabase
          .from('rooms')
          .update({
            current_game: gameName
          })
          .eq('id', roomId);

        // Also add a system message when host overrides selection
        await supabase
          .from('messages')
          .insert({
            room_id: roomId,
            player_id: 'SYSTEM',
            username: 'System',
            message: `Host changed the active game to "${gameName}".`
          });

      } catch (err) {
        console.error('Failed host game selection:', err);
      }
    },

    subscribeToRoom: (roomCode) => {
      if (!isSupabaseConfigured()) return;
      const supabase = getClient();

      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }

      const { roomId, currentUserId } = get();
      if (!roomId) return;

      // Fetch initial players and messages synchronously
      const fetchInitialData = async () => {
        const [playersRes, messagesRes] = await Promise.all([
          supabase.from('players').select().eq('room_id', roomId),
          supabase.from('messages').select().eq('room_id', roomId).order('timestamp', { ascending: true })
        ]);

        if (playersRes.data) {
          set({ players: playersRes.data });
        }
        if (messagesRes.data) {
          set({ messages: messagesRes.data });
        }
      };

      fetchInitialData();

      // Listen to DB shifts
      realtimeChannel = supabase
        .channel(`lobby-channel-${roomCode}`)
        // Listen to room table changes
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`
        }, (payload) => {
          const updatedRoom = payload.new as Room;
          set({ room: updatedRoom });
        })
        // Listen to players table changes
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${roomId}`
        }, async (payload) => {
          const eventType = payload.eventType;
          
          if (eventType === 'DELETE') {
            const oldPlayerId = payload.old.id;
            
            // If we are the one deleted/kicked, emit leave and navigate home
            if (oldPlayerId === currentUserId) {
              set({ error: 'You have been kicked or disconnected from the room.' });
              get().leaveRoom();
              return;
            }

            set(state => ({
              players: state.players.filter(p => p.id !== oldPlayerId)
            }));
          } else {
            const newPlayer = payload.new as Player;
            
            set(state => {
              const existingIdx = state.players.findIndex(p => p.id === newPlayer.id);
              if (existingIdx !== -1) {
                const copy = [...state.players];
                copy[existingIdx] = newPlayer;
                return { players: copy };
              } else {
                return { players: [...state.players, newPlayer] };
              }
            });
          }
        })
        // Listen to messages table changes
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`
        }, (payload) => {
          const newMessage = payload.new as Message;
          set(state => {
            if (state.messages.some(m => m.id === newMessage.id)) return {};
            return { messages: [...state.messages, newMessage] };
          });
        })
        // Listen to game events
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'game_events',
          filter: `room_id=eq.${roomId}`
        }, (payload) => {
          const newEvent = payload.new as GameEvent;
          
          if (newEvent.type === 'player_kicked' && newEvent.payload?.kickedId === currentUserId) {
            set({ error: 'You have been kicked by the host.' });
            get().leaveRoom();
            window.location.href = '/';
            return;
          }

          if (newEvent.type === 'game_start') {
            // Refresh countdown state
            const targetRoom = get().room;
            if (targetRoom) {
              set({
                room: {
                  ...targetRoom,
                  status: 'playing',
                  game_state: {
                    status: 'countdown',
                    countdown: 5,
                    startTime: newEvent.payload.startTime
                  }
                }
              });
            }
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            set({ isConnected: true });
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            set({ isConnected: false });
          }
        });
    },

    unsubscribeFromRoom: () => {
      const supabase = getClient();
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
        realtimeChannel = null;
      }
      set({ isConnected: false });
    }
  };
});
