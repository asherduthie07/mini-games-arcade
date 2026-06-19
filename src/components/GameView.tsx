import React, { useEffect, useRef, useState } from 'react';
import { useGameStore, Player } from '../useGameStore';
import { getSupabase } from '../supabaseClient';
import { playCrashSound, playBoostSound, playVictorySound, playBeep } from '../utils/audio';
import {
  Trophy,
  ArrowLeft,
  Zap,
  Orbit,
  Shield,
  Sparkles,
  AlertTriangle,
  Swords,
  Footprints,
  Skull,
  Award,
  CircleAlert,
  HelpCircle,
  Clock,
  Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GameViewProps {
  code: string;
}

// Map Dimensions
const MAP_LENGTH = 4000;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 560;
const GROUND_LEVEL = 500;

// Type Definitions for Map Elements
interface StaticPlatform {
  x: number;
  y: number;
  w: number;
  h: number;
  style: 'stone' | 'wood' | 'neon' | 'hazard' | 'ice';
  isFalling?: boolean;
  fallTimer?: number; // frames shaking before drop
  hasFallen?: boolean;
  isDisappearing?: boolean;
  isTrampoline?: boolean;
}

interface MovingPlatform {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  xBase: number;
  yBase: number;
  rangeX: number;
  rangeY: number;
  speed: number;
}

interface Hazard {
  id: number;
  type: 'spike' | 'crusher' | 'blade' | 'laser' | 'barrel_spawner';
  x: number;
  y: number;
  w: number;
  h: number;
  speed?: number;
  amp?: number;
  stateTimer?: number;
}

interface PowerUp {
  id: number;
  x: number;
  y: number;
  type: 'speed' | 'shield' | 'triple_jump' | 'immunity' | 'super_punch' | 'ghost';
  collected: boolean;
}

interface BananaPeel {
  id: number;
  x: number;
  y: number;
  active: boolean;
}

interface RollingBarrel {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

// Deterministic Map layouts based on selected mode
interface MapLayout {
  platforms: StaticPlatform[];
  movingPlatforms: MovingPlatform[];
  hazards: Hazard[];
  powerups: PowerUp[];
  checkpoints: { x: number; label: string }[];
}

const generateMapLayout = (mode: string): MapLayout => {
  const isSpace = mode === 'Space Dodge';
  const isCoin = mode === 'Neon Coin Rush';
  const isParkour = mode === 'Parkour Extreme';

  // Define static platforms
  const platforms: StaticPlatform[] = [
    // Starting floor
    { x: 0, y: GROUND_LEVEL, w: 750, h: 100, style: isSpace ? 'neon' : (isCoin ? 'neon' : 'stone') },
    
    // Low obstacle block / hurdle
    { x: 550, y: GROUND_LEVEL - 35, w: 40, h: 35, style: 'hazard' },
    
    // First high structure
    { x: 1050, y: GROUND_LEVEL - 50, w: 500, h: 150, style: isSpace ? 'ice' : 'wood' },
    
    // Underwear safety net platform for chasm 1 below
    { x: 820, y: GROUND_LEVEL + 60, w: 100, h: 15, style: isCoin ? 'neon' : 'wood', isFalling: true },

    // Moving step indicators & tunnel passage ceiling block
    { x: 1900, y: GROUND_LEVEL - 120, w: 220, h: 20, style: 'stone' },
    { x: 2120, y: GROUND_LEVEL, w: 350, h: 100, style: 'stone' }, // Ground floor for sliding tunnel
    { x: 2150, y: GROUND_LEVEL - 145, w: 260, h: 120, style: 'stone' }, // Ceiling creating a nice sliding crawlway!

    // Stepping stones climbing stairs
    { x: 1650, y: GROUND_LEVEL - 80, w: 80, h: 200, style: 'stone' },
    { x: 1780, y: GROUND_LEVEL - 150, w: 60, h: 20, style: 'wood' },
    
    // Holographic disappearing platforms (Neon style) or fragile bridges
    { x: 2550, y: GROUND_LEVEL - 80, w: 120, h: 15, style: 'neon', isDisappearing: true },
    { x: 2750, y: GROUND_LEVEL - 80, w: 120, h: 15, style: 'neon', isDisappearing: true },

    // Falling bridges sequence
    { x: 2950, y: GROUND_LEVEL - 40, w: 80, h: 15, style: 'wood', isFalling: true },
    { x: 3080, y: GROUND_LEVEL - 80, w: 80, h: 15, style: 'wood', isFalling: true },
    { x: 3210, y: GROUND_LEVEL - 40, w: 80, h: 15, style: 'wood', isFalling: true },

    // Final sprint run
    { x: 3350, y: GROUND_LEVEL, w: 800, h: 100, style: isSpace ? 'neon' : 'stone' },
    
    // Launch pad / Trampoline (bounce player up)
    { x: 3450, y: GROUND_LEVEL - 10, w: 50, h: 10, style: 'hazard', isTrampoline: true }
  ];

  // Moving platforms
  const movingPlatforms: MovingPlatform[] = [
    { id: 1, x: 800, y: GROUND_LEVEL - 40, w: 120, h: 15, xBase: 800, yBase: GROUND_LEVEL - 40, rangeX: 110, rangeY: 0, speed: 0.02 },
    { id: 2, x: 1580, y: GROUND_LEVEL - 90, w: 110, h: 15, xBase: 1580, yBase: GROUND_LEVEL - 110, rangeX: 0, rangeY: 80, speed: 0.025 }
  ];

  // Map hazards
  const hazards: Hazard[] = [
    // Spike clusters in major pits
    { id: 10, type: 'spike', x: 800, y: GROUND_LEVEL + 45, w: 250, h: 15 },
    { id: 11, type: 'spike', x: 1600, y: GROUND_LEVEL + 45, w: 300, h: 15 },
    
    // Spikes on flat structures
    { id: 12, type: 'spike', x: 1250, y: GROUND_LEVEL - 65, w: 80, h: 15 },

    // Swinging pendulum blade
    { id: 13, type: 'blade', x: 1400, y: GROUND_LEVEL - 190, w: 40, h: 40, speed: 0.03, amp: 85 },
    { id: 14, type: 'blade', x: 3600, y: GROUND_LEVEL - 200, w: 50, h: 50, speed: 0.035, amp: 100 },

    // Crushing heavy pistons
    { id: 15, type: 'crusher', x: 2400, y: GROUND_LEVEL - 200, w: 60, h: 140, speed: 0.04 },
    { id: 16, type: 'crusher', x: 3750, y: GROUND_LEVEL - 220, w: 70, h: 160, speed: 0.03 },

    // Laser beam grids
    { id: 17, type: 'laser', x: 1980, y: GROUND_LEVEL - 240, w: 6, h: 120 },
    { id: 18, type: 'laser', x: 3400, y: GROUND_LEVEL - 120, w: 6, h: 120 },

    // Rolling boulder/barrel spawner
    { id: 19, type: 'barrel_spawner', x: 3100, y: GROUND_LEVEL - 280, w: 30, h: 30 }
  ];

  // Specific powerup items dispersed across the zone
  const powerups: PowerUp[] = [
    { id: 50, x: 420, y: GROUND_LEVEL - 30, type: 'speed', collected: false },
    { id: 51, x: 1120, y: GROUND_LEVEL - 80, type: 'shield', collected: false },
    { id: 52, x: 1480, y: GROUND_LEVEL - 160, type: 'triple_jump', collected: false },
    { id: 53, x: 2000, y: GROUND_LEVEL - 160, type: 'immunity', collected: false },
    { id: 54, x: 2320, y: GROUND_LEVEL - 40, type: 'ghost', collected: false },
    { id: 55, x: 2800, y: GROUND_LEVEL - 130, type: 'super_punch', collected: false },
    { id: 56, x: 3470, y: GROUND_LEVEL - 180, type: 'speed', collected: false }
  ];

  // Five distinct checkpoints for competitive progression resetting
  const checkpoints = [
    { x: 150, label: 'Start Gate' },
    { x: 1100, label: 'Valley Outpost' },
    { x: 1950, label: 'Cavern Steps' },
    { x: 2750, label: 'Fragile Chasm' },
    { x: 3500, label: 'Final Ascent' }
  ];

  return { platforms, movingPlatforms, hazards, powerups, checkpoints };
};

export default function GameView({ code }: GameViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    room,
    players,
    currentUserId,
    username,
    updatePlayerPosition,
    leaveRoom,
    sendGameEvent
  } = useGameStore();

  const gameMode = room?.current_game || 'Obstacle Dash';

  // Deterministic local game map
  const mapLayout = useRef<MapLayout>(generateMapLayout(gameMode));

  // Current local dynamic hazards state (falling platforms timer, laser cycle etc)
  const [fragilePlatforms, setFragilePlatforms] = useState<{ [index: number]: { yOffset: number; state: 'stable' | 'shaking' | 'fallen'; shakeTimer: number } }>({});
  const fallStates = useRef<{ [index: number]: { yOffset: number; state: 'stable' | 'shaking' | 'fallen'; shakeTimer: number } }>({});

  const [collectedBoostIds, setCollectedBoostIds] = useState<Set<number>>(new Set());

  // Local physical parameters of local player character
  const myPlayerRef = useRef<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    heading: number;
    facingRight: boolean;

    // Movement states
    isGrounded: boolean;
    doubleJumpsUsed: number;

    // Status / Timer loops
    boostTimer: number;
    crashTimer: number; // Stun recovery
    slideTimer: number;
    slideCooldown: number;
    dashTimer: number;
    dashCooldown: number;
    punchCooldown: number;
    grabCooldown: number;
    grabTimer: number; // Stuck grabbed
    immunityTimer: number; // Shield active
    tripleJumpTimer: number;
    superPunchTimer: number;
    ghostTimer: number;

    // Banana peel slip state
    slipTimer: number;

    // Checkpoint
    latestCheckpointX: number;
    latestCheckpointLabel: string;

    // Synchronized competitive statistics
    score: number;
    finished: boolean;
    finishTime: number;
    finishPlacement: number;
    statsDeaths: number;
    statsPunches: number;
    statsFalls: number;
    statsSabotages: number;
  }>({
    x: 150,
    y: GROUND_LEVEL - 40,
    vx: 0,
    vy: 0,
    heading: 0,
    facingRight: true,
    isGrounded: true,
    doubleJumpsUsed: 0,
    boostTimer: 0,
    crashTimer: 0,
    slideTimer: 0,
    slideCooldown: 0,
    dashTimer: 0,
    dashCooldown: 0,
    punchCooldown: 0,
    grabCooldown: 0,
    grabTimer: 0,
    immunityTimer: 0,
    tripleJumpTimer: 0,
    superPunchTimer: 0,
    ghostTimer: 0,
    slipTimer: 0,
    latestCheckpointX: 150,
    latestCheckpointLabel: 'Start Gate',
    score: 0,
    finished: false,
    finishTime: 0,
    finishPlacement: 0,
    statsDeaths: 0,
    statsPunches: 0,
    statsFalls: 0,
    statsSabotages: 0
  });

  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // Interpolated targets for other players
  const interpolationsRef = useRef<{
    [id: string]: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      finished: boolean;
      score: number;
      z: number;
      deaths: number;
      punches: number;
      falls: number;
      sabotages: number;
      isSliding: boolean;
      isDashing: boolean;
      isPunching: boolean;
      isStunned: boolean;
      shieldActive: boolean;
    };
  }>({});

  // Dynamic objects
  const [barrels, setBarrels] = useState<RollingBarrel[]>([]);
  const barrelsRef = useRef<RollingBarrel[]>([]);
  const barrelSpawnCooldown = useRef<number>(0);

  // Active Banana peels on floor
  const bananaPeels = useRef<BananaPeel[]>([
    { id: 901, x: 700, y: GROUND_LEVEL - 5, active: true },
    { id: 902, x: 1300, y: GROUND_LEVEL - 50 - 5, active: true },
    { id: 903, x: 2300, y: GROUND_LEVEL - 5, active: true },
    { id: 904, x: 3550, y: GROUND_LEVEL - 5, active: true }
  ]);

  // Current active Chaos Event mid-race
  const [activeChaosEvent, setActiveChaosEvent] = useState<string | null>(null);
  const [chaosAnnouncement, setChaosAnnouncement] = useState<string | null>(null);
  const chaosTimer = useRef<number>(400); // Trigger countdown

  // Multiplier speed tracker
  const [speedVal, setSpeedVal] = useState(0);

  // Synced local states for rendering in sidebars
  const [localStats, setLocalStats] = useState({
    deaths: 0,
    punches: 0,
    falls: 0,
    sabotages: 0,
    powerup: 'None'
  });

  // Complete Confetti list
  const [confetti, setConfetti] = useState<{ x: number; y: number; vx: number; vy: number; color: string }[]>([]);

  // 1. Setup real-time postgres INSERT listener for combat punch, tackle, and stun events
  useEffect(() => {
    if (!room?.id) return;
    const supabase = getSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel(`combat_${room.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'game_events',
        filter: `room_id=eq.${room.id}`
      }, (payload) => {
        const evt = payload.new as any;
        if (evt.type === 'combat_hit') {
          const { attackerId, targetId, type, vx, vy, attackerName } = evt.payload;
          if (targetId === currentUserId) {
            const my = myPlayerRef.current;
            // Shield immunity absorbs hits
            if (my.immunityTimer > 0) {
              my.immunityTimer = 0; // consume shield
              playBeep(260, 0.15, 'sine');
              return;
            }

            if (type === 'punch') {
              my.vx = vx;
              my.vy = vy;
              my.crashTimer = 50; // stun for 50 frames
              my.statsDeaths += 0; // doesn't count as outright death
              playCrashSound();
            } else if (type === 'grab') {
              my.vx = 0;
              my.vy = 0;
              my.grabTimer = 60; // immobilize for 1 sec (60 frames)
              playBeep(220, 0.25, 'triangle');
            } else if (type === 'tackle') {
              my.vx = vx;
              my.vy = vy;
              my.crashTimer = 65; // heavy stun
              playCrashSound();
            } else if (type === 'stomp') {
              my.vy = 2;
              my.crashTimer = 55; // squeak stun
              playBeep(330, 0.2, 'sawtooth');
            }
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id, currentUserId]);

  // 2. Control Key Event Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 's', 'a', 'd', ' '].includes(k)) {
        e.preventDefault();
      }
      keysPressed.current[e.key] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // 3. Realtime position sync interval
  useEffect(() => {
    const syncInterval = setInterval(() => {
      const my = myPlayerRef.current;
      if (my.finished) return; // Wait to submit final results

      // Aggregate extra properties on the velocity payload JSON
      const statsObject = {
        deaths: my.statsDeaths,
        punches: my.statsPunches,
        falls: my.statsFalls,
        sabotages: my.statsSabotages,
        isSliding: my.slideTimer > 0,
        isDashing: my.dashTimer > 0,
        isPunching: my.punchCooldown > 20,
        isStunned: my.crashTimer > 0 || my.grabTimer > 0 || my.slipTimer > 0,
        shieldActive: my.immunityTimer > 0
      };

      updatePlayerPosition(my.x, my.y, my.vx, my.vy, my.finished, my.score, 0, statsObject);
    }, 100);

    return () => clearInterval(syncInterval);
  }, [updatePlayerPosition]);

  // 4. Main Animation Frame update and physics hook
  useEffect(() => {
    let animationId: number;

    const gameLoop = () => {
      updatePhysics();
      drawGame();
      animationId = requestAnimationFrame(gameLoop);
    };

    const updatePhysics = () => {
      const my = myPlayerRef.current;
      const keys = keysPressed.current;

      // Handle win/finish decay
      if (my.finished) {
        my.vx *= 0.92;
        my.vy *= 0.92;
        my.x += my.vx;
        my.y += my.vy;
        
        // Spawn pretty confetti near the screen centers
        if (Math.random() < 0.3) {
          const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6'];
          setConfetti(prev => [
            ...prev,
            {
              x: my.x - (my.x - 300) + Math.random() * 400 - 200,
              y: Math.random() * 200 + 100,
              vx: Math.random() * 4 - 2,
              vy: Math.random() * 3 + 1,
              color: colors[Math.floor(Math.random() * colors.length)]
            }
          ].slice(-60));
        }
        return;
      }

      // Decrement timers
      if (my.boostTimer > 0) my.boostTimer--;
      if (my.crashTimer > 0) my.crashTimer--;
      if (my.slideTimer > 0) my.slideTimer--;
      if (my.slideCooldown > 0) my.slideCooldown--;
      if (my.dashTimer > 0) my.dashTimer--;
      if (my.dashCooldown > 0) my.dashCooldown--;
      if (my.punchCooldown > 0) my.punchCooldown--;
      if (my.grabCooldown > 0) my.grabCooldown--;
      if (my.grabTimer > 0) my.grabTimer--;
      if (my.immunityTimer > 0) my.immunityTimer--;
      if (my.tripleJumpTimer > 0) my.tripleJumpTimer--;
      if (my.superPunchTimer > 0) my.superPunchTimer--;
      if (my.ghostTimer > 0) my.ghostTimer--;
      if (my.slipTimer > 0) my.slipTimer--;

      // Update falling and shaking platforms
      const updatedFalls = { ...fallStates.current };
      mapLayout.current.platforms.forEach((plat, idx) => {
        if (plat.isFalling) {
          const state = updatedFalls[idx] || { yOffset: 0, state: 'stable', shakeTimer: 45 };
          if (state.state === 'shaking') {
            state.shakeTimer--;
            if (state.shakeTimer <= 0) {
              state.state = 'fallen';
            }
          }
          if (state.state === 'fallen') {
            state.yOffset += 4; // fall down
          }
          updatedFalls[idx] = state;
        }
      });
      fallStates.current = updatedFalls;
      setFragilePlatforms(updatedFalls);

      // Main Chaos Events Scheduler (Add hilarious elements every 15-20 seconds)
      chaosTimer.current--;
      if (chaosTimer.current <= 0) {
        chaosTimer.current = 900; // Reset every 15 seconds
        const events = ['Tiny Mode', 'Reverse Controls', 'Wind Zone (Left)', 'Speed Frenzy', 'Ice Age'];
        const chosen = events[Math.floor(Math.random() * events.length)];
        setActiveChaosEvent(chosen);
        setChaosAnnouncement(`⚠️ CHAOS EVENT: ${chosen.toUpperCase()}! ⚠️`);
        setTimeout(() => setChaosAnnouncement(null), 3500);

        // Reset chaos events after 8 seconds
        setTimeout(() => {
          setActiveChaosEvent(null);
        }, 8000);
      }

      // Setup physics movement variables depending on chaos events
      const isReverse = activeChaosEvent === 'Reverse Controls';
      const isIce = activeChaosEvent === 'Ice Age' || gameMode === 'Space Dodge';
      const isWindLeft = activeChaosEvent === 'Wind Zone (Left)';

      // Running control logic
      let lateralInput = 0;
      if (keys['ArrowLeft'] || keys['a'] || keys['A']) lateralInput = isReverse ? 1 : -1;
      if (keys['ArrowRight'] || keys['d'] || keys['D']) lateralInput = isReverse ? -1 : 1;

      // Base gravity and speed caps
      let gravity = gameMode === 'Space Dodge' ? 0.28 : 0.52;
      const friction = isIce ? 0.025 : 0.16;
      const baseAcceleration = 0.75;
      const maxNormalSpeed = my.boostTimer > 0 ? 10.5 : 6.2;

      // Height of players differs when sliding
      const normalHeight = activeChaosEvent === 'Tiny Mode' ? 18 : 46;
      const slideHeight = activeChaosEvent === 'Tiny Mode' ? 9 : 22;
      const currentHeight = my.slideTimer > 0 ? slideHeight : normalHeight;

      // Handle stuns / slips
      const isRestrained = my.crashTimer > 0 || my.grabTimer > 0 || my.slipTimer > 0;

      if (!isRestrained) {
        // Build-up speed over time if moving forward consistently
        if (lateralInput > 0) {
          my.vx += baseAcceleration;
          my.facingRight = true;
        } else if (lateralInput < 0) {
          my.vx -= baseAcceleration;
          my.facingRight = false;
        } else {
          my.vx *= (1 - friction);
        }

        // Apply constant Wind drift
        if (isWindLeft) {
          my.vx -= 0.35;
        }

        // Limit maximum speed
        my.vx = Math.max(-maxNormalSpeed, Math.min(maxNormalSpeed, my.vx));
      } else {
        // decay speed slowly when stunned
        my.vx *= 0.94;
      }

      // SLIDERS: press S or ArrowDown to slide!
      const isSlideTriggered = keys['ArrowDown'] || keys['s'] || keys['S'];
      if (isSlideTriggered && my.slideCooldown <= 0 && my.isGrounded && !isRestrained) {
        my.slideTimer = 35; // slide for 35 frames
        my.slideCooldown = 65; // cooldown
        my.vx = my.facingRight ? 11 : -11; // slide speed burst!
        playBeep(220, 0.1, 'sine');
      }

      // DASH SHIFT Forward
      const isDashTriggered = keys['Shift'] || keys['e'] || keys['E'];
      if (isDashTriggered && my.dashCooldown <= 0 && !isRestrained) {
        my.dashTimer = 18;
        my.dashCooldown = 90; // 1.5s cooldown
        my.vx = my.facingRight ? 17 : -17;
        my.vy = -1.5; // subtle float
        playBeep(650, 0.15, 'sawtooth');
      }

      // JUMP & DOUBLE JUMP
      const isJumpPressed = keys[' '] || keys['ArrowUp'] || keys['w'] || keys['W'];
      if (isJumpPressed && !isRestrained) {
        const canDoubleJump = my.doubleJumpsUsed < (my.tripleJumpTimer > 0 ? 2 : 1);
        if (my.isGrounded) {
          // Normal jump
          my.vy = gameMode === 'Space Dodge' ? -8.5 : -11.5;
          my.isGrounded = false;
          my.doubleJumpsUsed = 0;
          keysPressed.current[' '] = false; // consume press
          keysPressed.current['ArrowUp'] = false;
          keysPressed.current['w'] = false;
          keysPressed.current['W'] = false;
          playBeep(480, 0.12, 'triangle');
        } else if (canDoubleJump) {
          // Double jump allowed once in air
          my.vy = gameMode === 'Space Dodge' ? -7.5 : -10.0;
          my.doubleJumpsUsed++;
          keysPressed.current[' '] = false; // consume press
          keysPressed.current['ArrowUp'] = false;
          keysPressed.current['w'] = false;
          keysPressed.current['W'] = false;
          playBeep(600, 0.1, 'triangle');
        }
      }

      // Apply vertical gravity force
      if (!my.isGrounded) {
        my.vy += gravity;
      }

      // Apply coordinates calculations
      my.x += my.vx;
      my.y += my.vy;

      // Bound player block to Map margins
      my.x = Math.max(20, Math.min(MAP_LENGTH, my.x));

      // 5. PLATFORMS & GAPS COLLISIONS
      my.isGrounded = false;

      // Check static platform boundaries
      mapLayout.current.platforms.forEach((plat, idx) => {
        const platOffset = fallStates.current[idx]?.yOffset || 0;
        const currentPlatY = plat.y + platOffset;

        // Disappearing blinking platform block (Blinks every 1.5 seconds)
        if (plat.isDisappearing && Math.floor(Date.now() / 1500) % 2 === 0) {
          return; // inactive
        }

        // Standard AABB Axis-Aligned side-scrolling platformer block intersection
        const pw = plat.w;
        const ph = plat.h;

        const playerHalfW = (activeChaosEvent === 'Tiny Mode' ? 7 : 16);
        const playerHalfH = currentHeight / 2;

        if (
          my.x + playerHalfW > plat.x &&
          my.x - playerHalfW < plat.x + pw &&
          my.y + playerHalfH > currentPlatY &&
          my.y - playerHalfH < currentPlatY + ph
        ) {
          // Collision occurred! Did we fall on it from above?
          if (my.vy >= 0 && (my.y - my.vy) + playerHalfH <= currentPlatY + 6) {
            my.y = currentPlatY - playerHalfH;
            my.vy = 0;
            my.isGrounded = true;
            my.doubleJumpsUsed = 0;

            // Trigger trampoline jump
            if (plat.isTrampoline) {
              my.vy = -17;
              my.isGrounded = false;
              playBeep(700, 0.15, 'sawtooth');
            }

            // Trigger falling block shake!
            if (plat.isFalling && (!fallStates.current[idx] || fallStates.current[idx].state === 'stable')) {
              fallStates.current[idx] = { yOffset: 0, state: 'shaking', shakeTimer: 45 };
              playBeep(180, 0.18, 'triangle');
            }
          } else {
            // side/head bump, push outward
            my.x -= my.vx;
            my.vx = -my.vx * 0.3;
          }
        }
      });

      // Check moving platform collisions
      mapLayout.current.movingPlatforms.forEach((plat) => {
        // Calculate dynamic real-time moving coordinates
        const now = Date.now();
        const curX = plat.xBase + (plat.rangeX > 0 ? Math.sin(now * plat.speed) * plat.rangeX : 0);
        const curY = plat.yBase + (plat.rangeY > 0 ? Math.sin(now * plat.speed) * plat.rangeY : 0);

        const playerHalfW = (activeChaosEvent === 'Tiny Mode' ? 7 : 16);
        const playerHalfH = currentHeight / 2;

        if (
          my.x + playerHalfW > curX &&
          my.x - playerHalfW < curX + plat.w &&
          my.y + playerHalfH > curY &&
          my.y - playerHalfH < curY + plat.h
        ) {
          if (my.vy >= 0 && (my.y - my.vy) + playerHalfH <= curY + 6) {
            my.y = curY - playerHalfH;
            my.vy = 0;
            my.isGrounded = true;
            my.doubleJumpsUsed = 0;

            // Carry player sideways or vertically along with platform movement!
            if (plat.rangeX > 0) {
              const platformVx = Math.cos(now * plat.speed) * plat.rangeX * plat.speed;
              my.x += platformVx;
            }
          }
        }
      });

      // 6. DETECT HAZARD HITS
      mapLayout.current.hazards.forEach((haz) => {
        // Compute pendulum block position or crusher piston height
        let hX = haz.x;
        let hY = haz.y;
        const now = Date.now();

        if (haz.type === 'blade') {
          const angle = Math.sin(now * (haz.speed || 0.03)) * (haz.amp || 80) * (Math.PI / 180);
          hX = haz.x + Math.sin(angle) * 120;
          hY = haz.y + Math.cos(angle) * 120;
        } else if (haz.type === 'crusher') {
          // drops flat, then lifts up slowly
          const loop = now % 3000;
          if (loop < 500) {
            hY = haz.y + (loop / 500) * 120; // dropping down rapidly
          } else if (loop < 1100) {
            hY = haz.y + 120; // flattened stay
          } else {
            hY = haz.y + 120 - ((loop - 1100) / 1900) * 120; // slow retreat up
          }
        } else if (haz.type === 'laser') {
          // Blinks continuous state on/off
          if (Math.floor(now / 1000) % 2 === 0) {
            return; // safe laser is off
          }
        } else if (haz.type === 'barrel_spawner') {
          // Barrel spawners sprout actual rotating physics barrels that fall/roll
          barrelSpawnCooldown.current--;
          if (barrelSpawnCooldown.current <= 0) {
            barrelSpawnCooldown.current = 130; // spawn every 2.1 seconds
            const bId = Math.random();
            barrelsRef.current.push({
              id: bId,
              x: haz.x,
              y: haz.y + 10,
              vx: -4.5 - Math.random() * 2.5,
              vy: 0,
              radius: 14
            });
            setBarrels([...barrelsRef.current]);
          }
          return;
        }

        // Standard collision with the computed active target bounding box
        const playerHalfW = (activeChaosEvent === 'Tiny Mode' ? 7 : 16);
        const playerHalfH = currentHeight / 2;

        if (
          my.x + playerHalfW > hX - haz.w / 2 &&
          my.x - playerHalfW < hX + haz.w / 2 &&
          my.y + playerHalfH > hY - haz.h / 2 &&
          my.y - playerHalfH < hY + haz.h / 2
        ) {
          triggerCheckpointRespawn();
        }
      });

      // Check dynamic rolling barrels collisions
      barrelsRef.current.forEach((bar, bIdx) => {
        // Roll barrel on ground
        bar.x += bar.vx;
        bar.vy += 0.45; // gravity
        bar.y += bar.vy;

        // Collision with floor coordinates
        if (bar.y >= GROUND_LEVEL - bar.radius) {
          bar.y = GROUND_LEVEL - bar.radius;
          bar.vy = -3.5 - Math.random() * 2; // bouncing barrels!
        }

        // Remove barrels out of bounds
        if (bar.x < -100) {
          barrelsRef.current.splice(bIdx, 1);
          setBarrels([...barrelsRef.current]);
          return;
        }

        const distance = Math.hypot(my.x - bar.x, my.y - bar.y);
        if (distance < bar.radius + 18) {
          triggerCheckpointRespawn();
        }
      });

      // 7. BANANA SLIPS AND COINS/POWERUPS COLLECTION
      bananaPeels.current.forEach((peel) => {
        if (!peel.active) return;
        const distance = Math.hypot(my.x - peel.x, my.y - peel.y);
        if (distance < 24) {
          peel.active = false;
          my.slipTimer = 75; // slip helplessly for 1.25s (75 frames)
          my.vx = my.facingRight ? 12 : -12; // slide uncontrollably
          my.vy = -2.5;
          playBeep(200, 0.4, 'sawtooth');
        }
      });

      // Check powerups overlap
      mapLayout.current.powerups.forEach((pw) => {
        if (collectedBoostIds.has(pw.id)) return;
        const distance = Math.hypot(my.x - pw.x, my.y - pw.y);
        if (distance < 26) {
          playBoostSound();
          setCollectedBoostIds(prev => {
            const up = new Set(prev);
            up.add(pw.id);
            return up;
          });

          // Apply specific powerups status coefficients
          if (pw.type === 'speed') {
            my.boostTimer = 180; // 3 seconds fast run
          } else if (pw.type === 'shield') {
            my.immunityTimer = 500; // Shield duration (8.3 seconds)
          } else if (pw.type === 'triple_jump') {
            my.tripleJumpTimer = 400; // Allows 3 air leaps
          } else if (pw.type === 'immunity') {
            my.immunityTimer = 450; // Iron body
          } else if (pw.type === 'super_punch') {
            my.superPunchTimer = 500;
          } else if (pw.type === 'ghost') {
            my.ghostTimer = 200; // Walk through players
          }
        }
      });

      // 8. FALL OFF CHASM HOLES death detection
      if (my.y > GROUND_LEVEL + 120) {
        my.statsFalls++;
        triggerCheckpointRespawn();
      }

      // 9. CHECKPOINTS ACTIVATION PROGRESS
      mapLayout.current.checkpoints.forEach((checkpoint) => {
        if (my.x >= checkpoint.x && checkpoint.x > my.latestCheckpointX) {
          my.latestCheckpointX = checkpoint.x;
          my.latestCheckpointLabel = checkpoint.label;
          playBeep(520, 0.2, 'sine');
          sendGameEvent('chat_log_broadcast', { text: `${username} activated Checkpoint: ${checkpoint.label}!` });
        }
      });

      // 10. EVALUATE ATTACEK PUNCH & GRABS COOLDOWN / HITBOX INTERSECTIONS
      const isPunchKey = keys['f'] || keys['F'];
      if (isPunchKey && my.punchCooldown <= 0 && !isRestrained) {
        my.punchCooldown = 35; // punch animation frame length
        const punchReach = my.superPunchTimer > 0 ? 110 : 55;
        const targetHeadingX = my.x + (my.facingRight ? punchReach : -punchReach);

        // Play quick swish beep sound
        playBeep(600, 0.08, 'triangle');

        // Loop over other players in lobby to verify punch hits
        players.forEach((p) => {
          if (p.id === currentUserId) return;
          const otherX = p.x_position;
          const otherY = p.y_position;

          const dist = Math.hypot(targetHeadingX - otherX, my.y - otherY);
          if (dist < 40) {
            // Punch hit! Apply massive horizontal throw momentum
            const throwKnockbackX = my.facingRight ? 14 : -14;
            const throwKnockbackY = -4.5;

            my.statsPunches++;
            my.statsSabotages++;

            // Broadcast combat hit to target through postgres realtime triggers safely
            sendGameEvent('combat_hit', {
              attackerId: currentUserId,
              attackerName: username,
              targetId: p.id,
              type: 'punch',
              vx: throwKnockbackX,
              vy: throwKnockbackY
            });
            sendGameEvent('chat_log_broadcast', { text: `${username} punched ${p.username}!` });
          }
        });
      }

      // 11. SOLID COMBAT COLLISION BODY BLOCKING & DASH CLASHES BETWEEN LOBBY PLAYERS
      players.forEach((p) => {
        if (p.id === currentUserId) return;
        const otherX = p.x_position;
        const otherY = p.y_position;

        const distance = Math.hypot(my.x - otherX, my.y - otherY);
        if (distance < 36 && my.ghostTimer <= 0) {
          // Verify if top player is stomping the bottom player's head
          const verticalOverlap = my.y + (currentHeight / 2) - (otherY - 20);
          if (my.vy > 1.2 && verticalOverlap > 0 && my.y < otherY - 14) {
            // BOUNCE BOOST!
            my.vy = -12;
            my.doubleJumpsUsed = 0;
            my.isGrounded = false;
            my.statsSabotages++;

            // Stomp smash the bottom target
            sendGameEvent('combat_hit', {
              attackerId: currentUserId,
              attackerName: username,
              targetId: p.id,
              type: 'stomp'
            });
            playBeep(800, 0.1, 'sawtooth');
            return;
          }

          // Shove / Momentum Transfer
          const diffX = my.x - otherX;
          const pushAmount = (Math.abs(my.vx) + 2.5) * 0.45;
          my.vx += Math.sign(diffX) * pushAmount;

          // Double Dash Clash recoil
          const otherIsDashing = (p.velocity as any)?.isDashing;
          if (my.dashTimer > 0 && otherIsDashing) {
            my.vx = my.facingRight ? -14 : 14;
            my.vy = -3;
            my.crashTimer = 60; // Recoil dazed stun
            playCrashSound();
          }
        }
      });

      // 12. RUNNING OVER THE FINISH LINE PORTAL GATES
      if (my.x >= 3800 && !my.finished) {
        my.finished = true;
        my.finishTime = Date.now();
        playVictorySound();

        // Calculate competitive final placement inside this dynamic lobby session
        const finishedInRooms = players.filter(p => p.finished).length;
        const placement = finishedInRooms + 1;
        my.finishPlacement = placement;

        // Broadcast final competitive race run stats to other lobby members
        updatePlayerPosition(my.x, my.y, 0, 0, true, my.score, 0);
        sendGameEvent('race_complete', {
          username: username,
          finishTime: my.finishTime,
          placement: placement,
          stats: {
            deaths: my.statsDeaths,
            punches: my.statsPunches,
            falls: my.statsFalls,
            sabotages: my.statsSabotages
          }
        });

        // Push players to final GP grand results summary screen after a short wait
        setTimeout(() => {
          window.history.pushState(null, '', `/results/${code}`);
          window.dispatchEvent(new Event('pushstate'));
        }, 4000);
      }

      // Sync React states
      setSpeedVal(Math.round(Math.abs(my.vx) * 11));
      setLocalStats({
        deaths: my.statsDeaths,
        punches: my.statsPunches,
        falls: my.statsFalls,
        sabotages: my.statsSabotages,
        powerup: my.boostTimer > 0 ? 'Speed Hyper' : (my.immunityTimer > 0 ? 'Iron Shield' : (my.tripleJumpTimer > 0 ? 'Triple Jump' : (my.superPunchTimer > 0 ? 'Super Punch' : 'None')))
      });
    };

    const triggerCheckpointRespawn = () => {
      const my = myPlayerRef.current;
      playCrashSound();
      my.statsDeaths++;
      
      // Flash red alert on background
      my.x = my.latestCheckpointX;
      my.y = GROUND_LEVEL - 50;
      my.vx = 0;
      my.vy = 0;
      my.crashTimer = 40; // Stun recovery frame buffers (0.6s)
      my.slideTimer = 0;
      my.boostTimer = 0;
      my.tripleJumpTimer = 0;
      my.immunityTimer = 0;
    };

    // 13. SIDE-SCROLLING RENDERING ENGINE PIPELINE
    const drawGame = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const my = myPlayerRef.current;

      // Fit layout bounds
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;

      // Dynamic side-scrolling camera interpolation locked to local player character
      const camX = Math.max(0, Math.min(MAP_LENGTH - CANVAS_WIDTH, my.x - 220));

      // 1. Render Scrolling Parallax Backgrounds
      ctx.fillStyle = gameMode === 'Space Dodge' ? '#0f172a' : (gameMode === 'Neon Coin Rush' ? '#020617' : '#e0f2fe');
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Render mountains or star fields depending on the GP Track
      if (gameMode === 'Space Dodge') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        for (let star = 0; star < 40; star++) {
          const sX = (star * 112 - camX * 0.15 + MAP_LENGTH) % CANVAS_WIDTH;
          const sY = (star * 37) % CANVAS_HEIGHT;
          ctx.beginPath();
          ctx.arc(sX, sY, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (gameMode === 'Neon Coin Rush') {
        // Neon grid lines
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 0.5;
        for (let l = 0; l < CANVAS_WIDTH; l += 50) {
          ctx.beginPath();
          ctx.moveTo(l - (camX * 0.35) % 50, 0);
          ctx.lineTo(l - (camX * 0.35) % 50, CANVAS_HEIGHT);
          ctx.stroke();
        }
      } else {
        // Natural wooden mountain vectors for Obstacle Dash
        ctx.fillStyle = 'rgba(125, 211, 252, 0.45)';
        ctx.beginPath();
        ctx.moveTo(0, CANVAS_HEIGHT);
        ctx.lineTo(150 - camX * 0.2, 280);
        ctx.lineTo(400 - camX * 0.2, 420);
        ctx.lineTo(650 - camX * 0.2, 330);
        ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.closePath();
        ctx.fill();
      }

      // Wind visual vectors
      if (activeChaosEvent === 'Wind Zone (Left)') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 2;
        const now = Date.now();
        for (let windLine = 0; windLine < 8; windLine++) {
          const wY = windLine * 70 + 40;
          const wX = (now * 0.45 + windLine * 220) % CANVAS_WIDTH;
          ctx.beginPath();
          ctx.moveTo(wX, wY);
          ctx.lineTo(wX - 45, wY);
          ctx.stroke();
        }
      }

      // 2. Render Platforms
      mapLayout.current.platforms.forEach((plat, idx) => {
        const platOffset = fragilePlatforms[idx]?.yOffset || 0;
        const px = plat.x - camX;
        const py = plat.y + platOffset;

        if (px + plat.w < -50 || px > CANVAS_WIDTH + 50) return; // Out of viewport

        // Blinking Hologram state neon platforms
        if (plat.isDisappearing && Math.floor(Date.now() / 1500) % 2 === 0) {
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(px, py, plat.w, plat.h);
          ctx.setLineDash([]);
          return;
        }

        // Draw Platform filling colors
        if (plat.isTrampoline) {
          ctx.fillStyle = '#f43f5e';
        } else if (plat.style === 'wood') {
          ctx.fillStyle = '#b45309'; // warm wood-brown
        } else if (plat.style === 'neon') {
          ctx.fillStyle = '#0f172a';
        } else if (plat.style === 'ice') {
          ctx.fillStyle = '#38bdf8'; // slippery light azure ice
        } else {
          ctx.fillStyle = '#57534e'; // grey quarry stone
        }

        ctx.fillRect(px, py, plat.w, plat.h);

        // Render Platform Borders
        if (plat.style === 'neon') {
          ctx.strokeStyle = '#a21caf'; // purple glowing borders
          ctx.lineWidth = 3;
          ctx.strokeRect(px, py, plat.w, plat.h);
        } else if (plat.style === 'ice') {
          ctx.strokeStyle = '#e0f2fe';
          ctx.lineWidth = 2;
          ctx.strokeRect(px, py, plat.w, plat.h);
        } else {
          ctx.strokeStyle = 'rgba(0,0,0,0.2)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(px, py, plat.w, plat.h);
        }

        // Draw trampoline springboards visual elements
        if (plat.isTrampoline) {
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 8px monospace';
          ctx.fillText('BOUNCER', px + 5, py + 8);
        }
      });

      // Render Moving platforms
      mapLayout.current.movingPlatforms.forEach((plat) => {
        const now = Date.now();
        const curX = plat.xBase + (plat.rangeX > 0 ? Math.sin(now * plat.speed) * plat.rangeX : 0);
        const curY = plat.yBase + (plat.rangeY > 0 ? Math.sin(now * plat.speed) * plat.rangeY : 0);
        const px = curX - camX;

        ctx.fillStyle = '#d97706'; // brass platform
        ctx.fillRect(px, curY, plat.w, plat.h);

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px, curY, plat.w, plat.h);

        // draw chains or tracks connecting the platform back to base anchor
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(plat.xBase - camX + plat.w / 2, plat.yBase);
        ctx.lineTo(px + plat.w / 2, curY);
        ctx.stroke();
      });

      // 3. Render Banana Peels on track
      bananaPeels.current.forEach((peel) => {
        if (!peel.active) return;
        const px = peel.x - camX;
        if (px < -50 || px > CANVAS_WIDTH + 50) return;

        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(px, peel.y, 8, Math.PI, Math.PI * 1.8);
        ctx.stroke();

        ctx.fillStyle = '#fef08a';
        ctx.font = '6px sans-serif';
        ctx.fillText('🍌', px - 4, peel.y - 2);
      });

      // 4. Render Powerups items on map
      mapLayout.current.powerups.forEach((pw) => {
        if (collectedBoostIds.has(pw.id)) return;
        const px = pw.x - camX;
        if (px < -40 || px > CANVAS_WIDTH + 40) return;

        // Floating hover
        const yHover = pw.y + Math.sin(Date.now() * 0.005 + pw.id) * 6;

        const colors = {
          speed: '#10b981',
          shield: '#3b82f6',
          triple_jump: '#a855f7',
          immunity: '#f59e0b',
          super_punch: '#ec4899',
          ghost: '#64748b'
        };

        const logos = {
          speed: '⚡',
          shield: '🛡️',
          triple_jump: '🦘',
          immunity: '💎',
          super_punch: '🥊',
          ghost: '👻'
        };

        // Outermost outer glowing aura
        ctx.beginPath();
        ctx.arc(px, yHover, 13, 0, Math.PI * 2);
        ctx.fillStyle = colors[pw.type] + '33';
        ctx.fill();

        // Core filling
        ctx.beginPath();
        ctx.arc(px, yHover, 10, 0, Math.PI * 2);
        ctx.fillStyle = colors[pw.type];
        ctx.fill();

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Symbol text
        ctx.fillStyle = '#fff';
        ctx.font = '9px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(logos[pw.type], px, yHover);
      });

      // 5. Render active Hazards (Spikes, pendulums, crushers)
      mapLayout.current.hazards.forEach((haz) => {
        const now = Date.now();
        let hX = haz.x;
        let hY = haz.y;

        if (haz.type === 'blade') {
          const angle = Math.sin(now * (haz.speed || 0.03)) * (haz.amp || 80) * (Math.PI / 180);
          hX = haz.x + Math.sin(angle) * 120;
          hY = haz.y + Math.cos(angle) * 120;

          // Drawing string/chord
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(haz.x - camX, haz.y);
          ctx.lineTo(hX - camX, hY);
          ctx.stroke();
        } else if (haz.type === 'crusher') {
          const loop = now % 3000;
          if (loop < 500) {
            hY = haz.y + (loop / 500) * 120;
          } else if (loop < 1100) {
            hY = haz.y + 120;
          } else {
            hY = haz.y + 120 - ((loop - 1100) / 1900) * 120;
          }
        }

        const px = hX - camX;
        if (px + haz.w < -100 || px > CANVAS_WIDTH + 100) return;

        if (haz.type === 'spike') {
          // Render jagged metallic row
          ctx.fillStyle = '#e11d48'; // warning red spikes
          for (let sp = px - haz.w / 2; sp < px + haz.w / 2; sp += 15) {
            ctx.beginPath();
            ctx.moveTo(sp, haz.y);
            ctx.lineTo(sp + 7.5, haz.y - haz.h);
            ctx.lineTo(sp + 15, haz.y);
            ctx.closePath();
            ctx.fill();
          }
        } else if (haz.type === 'blade') {
          // Pendulum circular spinning saw
          ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.arc(px, hY, haz.w / 2, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#e11d48';
          ctx.lineWidth = 35;
          ctx.setLineDash([4, 6]);
          ctx.beginPath();
          ctx.arc(px, hY, haz.w / 2 - 2, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (haz.type === 'crusher') {
          // Piston slab
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(px - haz.w / 2, hY - haz.h / 2, haz.w, haz.h);

          // Yellow caution bands
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(px - haz.w / 2, hY - haz.h / 2 + 10, haz.w, 15);
          ctx.fillStyle = '#000';
          ctx.font = 'bold 8px monospace';
          ctx.fillText('CRUSHER', px - 18, hY - haz.h / 2 + 21);
        } else if (haz.type === 'laser') {
          // Vertical red lasers
          ctx.strokeStyle = '#f43f5e';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(px, haz.y);
          ctx.lineTo(px, haz.y + haz.h);
          ctx.stroke();

          // Outer bloom glow
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
          ctx.lineWidth = 11;
          ctx.stroke();
        }
      });

      // Render Dynamic barrels
      barrels.forEach((bar) => {
        const px = bar.x - camX;
        ctx.save();
        ctx.translate(px, bar.y);
        ctx.rotate(Date.now() * -0.015); // spins backwards!

        // Outer wood barrel wheel
        ctx.beginPath();
        ctx.arc(0, 0, bar.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#78350f';
        ctx.fill();

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Draw spokes
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-bar.radius, 0); ctx.lineTo(bar.radius, 0);
        ctx.moveTo(0, -bar.radius); ctx.lineTo(0, bar.radius);
        ctx.stroke();

        ctx.restore();
      });

      // Render Checkpoints
      mapLayout.current.checkpoints.forEach((checkpoint) => {
        const px = checkpoint.x - camX;
        if (px < -50 || px > CANVAS_WIDTH + 50) return;

        // Draw checkpoint flag pole
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(px, GROUND_LEVEL);
        ctx.lineTo(px, GROUND_LEVEL - 70);
        ctx.stroke();

        const isActivated = my.latestCheckpointX >= checkpoint.x;

        // Wave banner
        ctx.fillStyle = isActivated ? '#22c55e' : '#64748b'; // Green activated, grey inactive
        ctx.beginPath();
        ctx.moveTo(px, GROUND_LEVEL - 70);
        ctx.lineTo(px + 24, GROUND_LEVEL - 60 + Math.sin(Date.now() * 0.01) * 3);
        ctx.lineTo(px, GROUND_LEVEL - 50);
        ctx.closePath();
        ctx.fill();

        // Label flag tag
        ctx.fillStyle = '#334155';
        ctx.font = '8px sans-serif';
        ctx.fillText(checkpoint.label, px - 15, GROUND_LEVEL - 76);
      });

      // 6. DRAW CHECKERED FINISH LINE PORTAL
      const finishPortalX = 3800 - camX;
      if (finishPortalX > -150 && finishPortalX < CANVAS_WIDTH + 150) {
        // High arch support beams
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(finishPortalX - 10, GROUND_LEVEL - 180, 20, 180);

        // Grid checkered banner panel
        const checkedBlockSize = 8;
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 12; col++) {
            const blkX = finishPortalX - 48 + col * checkedBlockSize;
            const blkY = GROUND_LEVEL - 170 + row * checkedBlockSize;
            ctx.fillStyle = (row + col) % 2 === 0 ? '#000' : '#fff';
            ctx.fillRect(blkX, blkY, checkedBlockSize, checkedBlockSize);
          }
        }

        // TEXT GLOW GOAL
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 15px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('🏆 WINNER 🏆', finishPortalX, GROUND_LEVEL - 184);
      }

      // 7. DRAW OTHER PLAYERS (INTERPOLATED TARGETS)
      players.forEach((plyr) => {
        if (plyr.id === currentUserId) return; // Draw ourselves last

        let lerpObj = interpolationsRef.current[plyr.id];
        if (!lerpObj) {
          interpolationsRef.current[plyr.id] = {
            x: plyr.x_position,
            y: plyr.y_position,
            vx: (plyr.velocity as any)?.x || 0,
            vy: (plyr.velocity as any)?.y || 0,
            finished: plyr.finished,
            score: plyr.score || 0,
            z: 0,
            deaths: (plyr.velocity as any)?.deaths || 0,
            punches: (plyr.velocity as any)?.punches || 0,
            falls: (plyr.velocity as any)?.falls || 0,
            sabotages: (plyr.velocity as any)?.sabotages || 0,
            isSliding: (plyr.velocity as any)?.isSliding || false,
            isDashing: (plyr.velocity as any)?.isDashing || false,
            isPunching: (plyr.velocity as any)?.isPunching || false,
            isStunned: (plyr.velocity as any)?.isStunned || false,
            shieldActive: (plyr.velocity as any)?.shieldActive || false
          };
          lerpObj = interpolationsRef.current[plyr.id];
        } else {
          // Lerp vectors
          lerpObj.x += (plyr.x_position - lerpObj.x) * 0.16;
          lerpObj.y += (plyr.y_position - lerpObj.y) * 0.16;
          lerpObj.vx += (((plyr.velocity as any)?.x || 0) - lerpObj.vx) * 0.16;
          lerpObj.vy += (((plyr.velocity as any)?.y || 0) - lerpObj.vy) * 0.16;
          lerpObj.finished = plyr.finished;
          lerpObj.score = plyr.score || 0;
          lerpObj.deaths = (plyr.velocity as any)?.deaths || 0;
          lerpObj.punches = (plyr.velocity as any)?.punches || 0;
          lerpObj.falls = (plyr.velocity as any)?.falls || 0;
          lerpObj.sabotages = (plyr.velocity as any)?.sabotages || 0;
          lerpObj.isSliding = (plyr.velocity as any)?.isSliding || false;
          lerpObj.isDashing = (plyr.velocity as any)?.isDashing || false;
          lerpObj.isPunching = (plyr.velocity as any)?.isPunching || false;
          lerpObj.isStunned = (plyr.velocity as any)?.isStunned || false;
          lerpObj.shieldActive = (plyr.velocity as any)?.shieldActive || false;
        }

        const ry = lerpObj.y;
        const px = lerpObj.x - camX;

        if (px > -40 && px < CANVAS_WIDTH + 40) {
          drawCharacterSprite(
            ctx,
            px,
            ry,
            plyr.username,
            false,
            lerpObj.finished,
            lerpObj.isStunned,
            lerpObj.isSliding,
            lerpObj.isDashing,
            lerpObj.isPunching,
            lerpObj.shieldActive
          );
        }
      });

      // 8. DRAW LOCAL PLAYER
      const myRy = my.y;
      const myPx = my.x - camX;
      drawCharacterSprite(
        ctx,
        myPx,
        myRy,
        username,
        true,
        my.finished,
        my.crashTimer > 0 || my.grabTimer > 0 || my.slipTimer > 0,
        my.slideTimer > 0,
        my.dashTimer > 0,
        my.punchCooldown > 20,
        my.immunityTimer > 0
      );
    };

    // Vector sprite drawer for individual player blocks
    const drawCharacterSprite = (
      ctx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      uName: string,
      isSelf: boolean,
      finished: boolean,
      isStunned: boolean,
      isSliding: boolean,
      isDashing: boolean,
      isPunching: boolean,
      shieldActive: boolean
    ) => {
      ctx.save();

      // Tiny Mode scales down
      const isTiny = activeChaosEvent === 'Tiny Mode';
      if (isTiny) {
        ctx.translate(cx, cy);
        ctx.scale(0.45, 0.45);
        ctx.translate(-cx, -cy);
      }

      // 1. Draw Ground Shadow vector
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + (isSliding ? 11 : 23), isSliding ? 18 : 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Dashing breeze path shadows
      if (isDashing) {
        ctx.fillStyle = isSelf ? 'rgba(59, 130, 246, 0.25)' : 'rgba(120, 113, 108, 0.25)';
        ctx.fillRect(cx - (myPlayerRef.current.facingRight ? 45 : -25), cy - (isSliding ? 11 : 23), 20, isSliding ? 22 : 46);
      }

      // Base design colors
      ctx.fillStyle = isSelf ? '#1e3a8a' : '#475569'; // Blue self, Grey enemy
      if (isStunned) {
        ctx.fillStyle = '#dc2626'; // Red dazed
      }
      if (finished) {
        ctx.fillStyle = '#10b981'; // Green complete
      }

      // Draw sliding or solid vertical rectangular player body capsule
      ctx.beginPath();
      if (isSliding) {
        ctx.roundRect(cx - 18, cy - 11, 36, 22, 6);
      } else {
        ctx.roundRect(cx - 13, cy - 23, 26, 46, 8);
      }
      ctx.fill();

      // Face bandanna or eye indicators
      ctx.fillStyle = '#fff';
      const lookDirX = myPlayerRef.current.facingRight ? cx + 5 : cx - 12;
      ctx.fillRect(lookDirX, cy - 14, 7, 5);

      ctx.fillStyle = '#000';
      ctx.fillRect(lookDirX + (myPlayerRef.current.facingRight ? 4 : 1), cy - 12, 2, 2);

      // Cute bandanna ribbon flinging behind
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const tailX = myPlayerRef.current.facingRight ? cx - 15 : cx + 15;
      ctx.moveTo(tailX, cy - 14);
      ctx.lineTo(tailX - (myPlayerRef.current.facingRight ? 6 : -6), cy - 10 + Math.sin(Date.now() * 0.01) * 3);
      ctx.stroke();

      // Punch fist vector triggered during cooling
      if (isPunching) {
        ctx.fillStyle = '#fbbf24';
        const fistX = myPlayerRef.current.facingRight ? cx + 22 : cx - 28;
        ctx.beginPath();
        ctx.arc(fistX, cy - 4, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Draw Spinning stars indicating Dazed/Stun states
      if (isStunned) {
        ctx.fillStyle = '#fef08a';
        ctx.font = '8px system-ui';
        const spinX = cx + Math.sin(Date.now() * 0.02) * 14;
        const spinY = cy - 31;
        ctx.fillText('⭐', spinX - 3, spinY);
      }

      // Shield overlay
      if (shieldActive) {
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 30, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Username tag above head
      ctx.fillStyle = isSelf ? 'rgba(30, 58, 138, 0.95)' : 'rgba(71, 85, 105, 0.9)';
      ctx.font = 'bold 10px monospace';
      const measure = ctx.measureText(uName);
      ctx.fillRect(cx - measure.width / 2 - 4, cy - 38, measure.width + 8, 13);

      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(uName, cx, cy - 28);

      ctx.restore();
    };

    gameLoop();
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [players, collectedBoostIds, fragilePlatforms, activeChaosEvent, barrels]);

  const handleReturnToLobby = async () => {
    await leaveRoom();
    window.history.pushState(null, '', '/');
    window.dispatchEvent(new Event('pushstate'));
  };

  const myX = myPlayerRef.current.x;
  const progressPercent = Math.max(0, Math.min(100, Math.round(((myX - 150) / 3650) * 100)));

  // Competitive realtime rankings sorted based on horizontal distance or finished flags
  const sortedLeadboard = [...players]
    .map(p => {
      const isSelf = p.id === currentUserId;
      let playerX = p.x_position;
      let playerScore = p.score || 0;
      let pFinished = p.finished;
      
      let pDeaths = (p.velocity as any)?.deaths || 0;
      let pPunches = (p.velocity as any)?.punches || 0;
      let pFalls = (p.velocity as any)?.falls || 0;
      let pSabotages = (p.velocity as any)?.sabotages || 0;

      if (isSelf) {
        playerX = myPlayerRef.current.x;
        playerScore = myPlayerRef.current.score;
        pFinished = myPlayerRef.current.finished;
        pDeaths = myPlayerRef.current.statsDeaths;
        pPunches = myPlayerRef.current.statsPunches;
        pFalls = myPlayerRef.current.statsFalls;
        pSabotages = myPlayerRef.current.statsSabotages;
      }

      const pct = Math.max(0, Math.min(100, Math.round(((playerX - 150) / 3650) * 100)));
      return {
        name: p.username,
        progress: pct,
        finished: pFinished,
        score: playerScore,
        deaths: pDeaths,
        punches: pPunches,
        falls: pFalls,
        sabotages: pSabotages,
        isSelf
      };
    })
    .sort((a, b) => {
      if (a.finished && !b.finished) return -1;
      if (!a.finished && b.finished) return 1;
      return b.progress - a.progress;
    });

  return (
    <div ref={containerRef} className="w-full max-w-7xl mx-auto p-4 md:py-6 text-stone-800 min-h-[90vh]">
      
      {/* Banner / Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 border-b border-stone-100 pb-4">
        <div>
          <button
            onClick={handleReturnToLobby}
            className="flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-700 transition-colors mb-1.5 font-bold font-mono tracking-wider uppercase"
          >
            <ArrowLeft size={10} /> Disconnect Race Game
          </button>
          
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight flex items-center gap-2 text-stone-900 font-mono">
            <Orbit className="text-stone-700 animate-spin" style={{ animationDuration: '6s' }} size={20} />
            {gameMode} Track Session
          </h1>
          <p className="text-xs text-stone-500 font-mono">
            Race to the right finish line! Punch enemies with <kbd className="bg-stone-100 border px-1 py-0.5 rounded text-[10px] font-bold">F</kbd>, slip on banana peels, slide through tight vaults, and avoid pendulums spike clusters!
          </p>
        </div>

        {/* Live Active Chaos Alerts Banner */}
        <AnimatePresence>
          {chaosAnnouncement && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: -10 }}
              className="bg-amber-500 border-2 border-amber-600 text-stone-950 px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 font-mono"
            >
              <AlertTriangle size={15} className="animate-bounce" />
              <span className="text-xs font-black tracking-wide">{chaosAnnouncement}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        
        {/* SIDEBAR telemetry board */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          
          {/* Telemetry Speeder */}
          <div className="bg-white border border-stone-200 p-4 rounded-xl shadow-xs">
            <h3 className="font-bold uppercase tracking-wider text-[10px] text-stone-500 mb-2.5 flex items-center gap-1.5 border-b border-stone-100 pb-1.5 font-mono">
              <Zap size={11} className="text-amber-500" /> Speed & Position
            </h3>
            
            <div className="flex items-center justify-between py-1">
              <div className="text-center bg-stone-50 p-2 rounded-xl border border-stone-150 flex-1 mr-2">
                <span className="text-2xl font-black font-mono text-stone-90; block">
                  {speedVal}
                </span>
                <span className="text-[9px] text-stone-400 font-bold uppercase tracking-wider font-mono">MPH</span>
              </div>
              <div className="text-center bg-stone-50 p-2 rounded-xl border border-stone-150 flex-1">
                <span className="text-2xl font-black font-mono text-stone-900 block">
                  {progressPercent}%
                </span>
                <span className="text-[9px] text-stone-400 font-bold uppercase tracking-wider font-mono">Progress</span>
              </div>
            </div>

            {/* Checkpoint Indicators tracker */}
            <div className="mt-3 bg-stone-50 p-2 rounded-lg border border-stone-150">
              <span className="text-[10px] font-bold text-stone-400 uppercase font-mono block mb-1">Latest Checkpoint:</span>
              <span className="text-xs font-bold text-stone-700 font-mono">🚩 {myPlayerRef.current.latestCheckpointLabel}</span>
            </div>
            
            {/* Completion metrics bar */}
            <div className="mt-3.5">
              <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden border border-stone-200">
                <div
                  className="h-full rounded-full transition-all bg-stone-900"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Local match statistics HUD */}
          <div className="bg-white border border-stone-200 p-4 rounded-xl shadow-xs">
            <h3 className="font-bold uppercase tracking-wider text-[10px] text-stone-500 mb-2.5 flex items-center gap-1.5 border-b border-stone-100 pb-1.5 font-mono">
              <Swords size={11} className="text-stone-700" /> My Match Statistics
            </h3>
            
            <div className="grid grid-cols-2 gap-2 text-center font-mono text-xs">
              <div className="bg-stone-50/50 p-2 rounded-lg border border-stone-150">
                <span className="text-[9px] text-stone-400 uppercase font-bold block">Punches 🥊</span>
                <span className="text-base font-black text-stone-800">{localStats.punches}</span>
              </div>
              <div className="bg-stone-50/50 p-2 rounded-lg border border-stone-150">
                <span className="text-[9px] text-stone-400 uppercase font-bold block">Falls 🕳️</span>
                <span className="text-base font-black text-stone-800">{localStats.falls}</span>
              </div>
              <div className="bg-stone-50/50 p-2 rounded-lg border border-stone-150">
                <span className="text-[9px] text-stone-400 uppercase font-bold block">Deaths ☠️</span>
                <span className="text-base font-black text-stone-800">{localStats.deaths}</span>
              </div>
              <div className="bg-stone-50/50 p-2 rounded-lg border border-stone-150">
                <span className="text-[9px] text-stone-400 uppercase font-bold block">Powerup 👑</span>
                <span className="text-[9px] font-black text-stone-700 truncate block mt-1">{localStats.powerup}</span>
              </div>
            </div>
          </div>

          {/* Leaders Grand Board Dashboard */}
          <div className="bg-white border border-stone-200 p-4 rounded-xl flex-1 flex flex-col shadow-xs">
            <h3 className="font-bold uppercase tracking-wider text-[10px] text-stone-500 mb-3 flex items-center gap-1.5 border-b border-stone-100 pb-1.5 font-mono">
              <Trophy size={11} className="text-amber-500" /> Live Standings
            </h3>

            <div className="flex flex-col gap-2 flex-1 overflow-y-auto max-h-[220px] lg:max-h-none">
              {sortedLeadboard.map((entry, index) => (
                <div
                  key={entry.name}
                  className={`flex flex-col p-2.5 rounded-lg border font-mono ${entry.isSelf ? 'bg-indigo-50/45 border-indigo-200 shadow-xs' : 'bg-stone-50/30 border-stone-150'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-black text-xs text-stone-400">
                        #{index + 1}
                      </span>
                      <p className={`text-xs font-black truncate max-w-[110px] ${entry.isSelf ? 'text-indigo-900' : 'text-stone-700'}`}>
                        {entry.name}
                      </p>
                    </div>

                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${entry.finished ? 'bg-green-100 text-green-800' : 'bg-stone-100 text-stone-500'}`}>
                      {entry.finished ? 'FINISH' : `${entry.progress}%`}
                    </span>
                  </div>

                  {/* Tiny statistics line */}
                  <div className="flex items-center justify-between text-[9px] text-stone-400 mt-1.5 pt-1.5 border-t border-dashed border-stone-200">
                    <span>🥊 {entry.punches}</span>
                    <span>🕳️ {entry.falls}</span>
                    <span>☠️ {entry.deaths}</span>
                    <span>⚡ {entry.sabotages}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2D SIDECROLLING GRAPHICS FIELD */}
        <div className="lg:col-span-3 flex flex-col bg-white border border-stone-200 rounded-xl overflow-hidden p-2 relative shadow-xs">
          
          {/* Virtual manual joystick controllers overlays for mouse inputs on tablet-size viewports */}
          <canvas
            ref={canvasRef}
            className="w-full bg-slate-900 rounded-lg max-h-[70vh] border border-stone-200 aspect-[80/56]"
          />

          {/* Direct Key Controls Legend Card */}
          <div className="grid grid-cols-4 md:grid-cols-5 gap-2.5 p-2 bg-stone-50 rounded-lg border border-stone-200 mt-2 font-mono text-[9px]">
            <div className="flex flex-col px-1">
              <span className="text-stone-400 font-bold uppercase">Run Controls</span>
              <span className="text-stone-800 font-black">A, D / ArrowLeft, Right</span>
            </div>
            <div className="flex flex-col px-1">
              <span className="text-stone-400 font-bold uppercase">Jump / Double</span>
              <span className="text-stone-800 font-black">Space, W / ArrowUp</span>
            </div>
            <div className="flex flex-col px-1">
              <span className="text-stone-400 font-bold uppercase">Slide (Tight Vaults)</span>
              <span className="text-stone-800 font-black">S / ArrowDown</span>
            </div>
            <div className="flex flex-col px-1">
              <span className="text-stone-400 font-bold uppercase">Dash Fwd</span>
              <span className="text-stone-800 font-black">Shift / E Key</span>
            </div>
            <div className="hidden md:flex flex-col px-1">
              <span className="text-stone-400 font-bold uppercase">Sabotage Intersect</span>
              <span className="text-stone-800 font-black">F (Punch!)</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
