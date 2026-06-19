import React, { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../useGameStore';
import { getSupabase } from '../supabaseClient';
import { playCrashSound, playBoostSound, playVictorySound, playBeep } from '../utils/audio';
import {
  Trophy,
  ArrowLeft,
  Zap,
  Shield,
  Clock,
  Volume2,
  Tv,
  Users,
  Flag,
  RotateCcw,
  Sparkles
} from 'lucide-react';

interface GameViewProps {
  code: string;
}

// Map Dimensions
const MAP_LENGTH = 5000; // Simpler, shorter track for quick, satisfying rounds
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;
const GROUND_LEVEL = 440;

// Simple, clear platform styling
interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  style: 'stone' | 'neon';
}

interface MovingPlatform {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  startX: number;
  rangeX: number;
  speed: number;
}

interface Hazard {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'spike' | 'slow_orb';
}

interface BoostPad {
  id: number;
  x: number;
  y: number;
  type: 'speed' | 'super_jump';
}

export default function GameView({ code }: GameViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  // --- DESIGN STRATEGY: SIMPLER, PREDICTABLE MAP CONFIGURATION ---
  // Easy checkpoints to avoid frustrating restarts from scratch (incorporating explicit platform surfaces)
  const checkpoints = [
    { x: 100, y: GROUND_LEVEL, label: 'Start Line' },
    { x: 1250, y: GROUND_LEVEL, label: 'Waystation Alpha' },
    { x: 2450, y: GROUND_LEVEL, label: 'Waystation Beta' },
    { x: 3800, y: GROUND_LEVEL - 80, label: 'Waystation Gamma' }
  ];

  // Easy static platforms designed with adequate spacing for solid, predictable platforming
  const platforms = useRef<Platform[]>([
    { x: 0, y: GROUND_LEVEL, w: 750, h: 60, style: 'stone' },
    // First jump gap step
    { x: 820, y: GROUND_LEVEL - 40, w: 200, h: 100, style: 'stone' },
    // Safe Alpha checkpoint house
    { x: 1100, y: GROUND_LEVEL, w: 320, h: 60, style: 'stone' },
    // Lower bridge floors
    { x: 1500, y: GROUND_LEVEL - 60, w: 220, h: 120, style: 'stone' },
    { x: 1800, y: GROUND_LEVEL - 120, w: 220, h: 180, style: 'stone' },
    { x: 2100, y: GROUND_LEVEL, w: 180, h: 60, style: 'stone' },
    // Safe Beta checkpoint house
    { x: 2350, y: GROUND_LEVEL, w: 300, h: 60, style: 'stone' },
    // Rising mid obstacles
    { x: 2750, y: GROUND_LEVEL - 50, w: 200, h: 110, style: 'stone' },
    { x: 3050, y: GROUND_LEVEL - 100, w: 250, h: 160, style: 'stone' },
    { x: 3400, y: GROUND_LEVEL - 40, w: 180, h: 100, style: 'stone' },
    // Safe Gamma checkpoint house
    { x: 3650, y: GROUND_LEVEL - 80, w: 320, h: 140, style: 'stone' },
    // Final pre-goal bridge steps
    { x: 4050, y: GROUND_LEVEL - 40, w: 200, h: 100, style: 'stone' },
    { x: 4350, y: GROUND_LEVEL - 100, w: 120, h: 160, style: 'stone' },
    // Final flat zone and goals
    { x: 4550, y: GROUND_LEVEL, w: 500, h: 60, style: 'stone' }
  ]);

  // Gentle moving platforms that slide predictably side-to-side (corrected speed variables for pure buttery smoothness!)
  const movingPlatforms = useRef<MovingPlatform[]>([
    { id: 1, x: 700, y: GROUND_LEVEL - 40, w: 110, h: 15, startX: 700, rangeX: 100, speed: 0.0012 },
    { id: 2, x: 1400, y: GROUND_LEVEL - 50, w: 100, h: 15, startX: 1400, rangeX: 100, speed: 0.001 },
    { id: 3, x: 2000, y: GROUND_LEVEL - 80, w: 100, h: 15, startX: 2000, rangeX: 100, speed: 0.0011 },
    { id: 4, x: 2650, y: GROUND_LEVEL - 40, w: 100, h: 15, startX: 2650, rangeX: 100, speed: 0.0009 },
    { id: 5, x: 3300, y: GROUND_LEVEL - 60, w: 100, h: 15, startX: 3300, rangeX: 100, speed: 0.0012 },
    { id: 6, x: 3950, y: GROUND_LEVEL - 40, w: 100, h: 15, startX: 3950, rangeX: 100, speed: 0.001 },
    { id: 7, x: 4230, y: GROUND_LEVEL - 80, w: 110, h: 15, startX: 4230, rangeX: 100, speed: 0.0013 }
  ]);

  // Hazards which are highly visible and static to minimize visual clutter
  const hazards = useRef<Hazard[]>([
    // Easy to dodge spikes in deep pit gaps below the platforms
    { id: 101, x: 785, y: GROUND_LEVEL + 40, w: 70, h: 20, type: 'spike' },
    { id: 102, x: 1060, y: GROUND_LEVEL + 40, w: 80, h: 20, type: 'spike' },
    { id: 103, x: 1460, y: GROUND_LEVEL + 40, w: 80, h: 20, type: 'spike' },
    { id: 104, x: 1760, y: GROUND_LEVEL + 40, w: 80, h: 20, type: 'spike' },
    { id: 105, x: 2060, y: GROUND_LEVEL + 40, w: 80, h: 20, type: 'spike' },
    { id: 106, x: 2310, y: GROUND_LEVEL + 40, w: 70, h: 20, type: 'spike' },
    { id: 107, x: 2700, y: GROUND_LEVEL + 40, w: 100, h: 20, type: 'spike' },
    { id: 108, x: 3000, y: GROUND_LEVEL + 40, w: 100, h: 20, type: 'spike' },
    { id: 109, x: 3350, y: GROUND_LEVEL + 40, w: 100, h: 20, type: 'spike' },
    { id: 110, x: 3615, y: GROUND_LEVEL + 40, w: 70, h: 20, type: 'spike' },
    { id: 111, x: 4010, y: GROUND_LEVEL + 40, w: 80, h: 20, type: 'spike' },
    { id: 112, x: 4300, y: GROUND_LEVEL + 40, w: 100, h: 20, type: 'spike' },
    { id: 113, x: 4510, y: GROUND_LEVEL + 40, w: 80, h: 20, type: 'spike' },

    // A few clear, static neon-orange energy orbs in the air (no chaotic speed spikes)
    { id: 201, x: 920, y: GROUND_LEVEL - 120, w: 25, h: 25, type: 'slow_orb' },
    { id: 202, x: 1610, y: GROUND_LEVEL - 140, w: 25, h: 25, type: 'slow_orb' },
    { id: 203, x: 1910, y: GROUND_LEVEL - 200, w: 25, h: 25, type: 'slow_orb' },
    { id: 204, x: 2200, y: GROUND_LEVEL - 100, w: 25, h: 25, type: 'slow_orb' },
    { id: 205, x: 2850, y: GROUND_LEVEL - 150, w: 25, h: 25, type: 'slow_orb' },
    { id: 206, x: 3175, y: GROUND_LEVEL - 180, w: 25, h: 25, type: 'slow_orb' },
    { id: 207, x: 3490, y: GROUND_LEVEL - 120, w: 25, h: 25, type: 'slow_orb' },
    { id: 208, x: 4150, y: GROUND_LEVEL - 140, w: 25, h: 25, type: 'slow_orb' },
    { id: 209, x: 4410, y: GROUND_LEVEL - 180, w: 25, h: 25, type: 'slow_orb' }
  ]);

  // Simple collectible boost items
  const boostPads = useRef<BoostPad[]>([
    { id: 301, x: 400, y: GROUND_LEVEL - 20, type: 'speed' },
    { id: 302, x: 1200, y: GROUND_LEVEL - 20, type: 'super_jump' },
    { id: 303, x: 1900, y: GROUND_LEVEL - 140, type: 'speed' },
    { id: 304, x: 2550, y: GROUND_LEVEL - 20, type: 'super_jump' },
    { id: 305, x: 3150, y: GROUND_LEVEL - 120, type: 'speed' },
    { id: 306, x: 3850, y: GROUND_LEVEL - 100, type: 'super_jump' },
    { id: 307, x: 4620, y: GROUND_LEVEL - 20, type: 'speed' }
  ]);

  // List of collected item IDs for this run
  const [collectedBoostIds, setCollectedBoostIds] = useState<Set<number>>(new Set());

  // Local physical state of our character
  const myPlayerRef = useRef({
    x: 100,
    y: GROUND_LEVEL - 40,
    vx: 0,
    vy: 0,
    facingRight: true,
    isGrounded: true,
    doubleJumpsUsed: 0,

    // Jump Buffers & Simple Speed Coefficients
    boostTimer: 0,
    superJumpTimer: 0,

    // Statistics Tracker
    latestCheckpointX: 100,
    latestCheckpointY: GROUND_LEVEL,
    latestCheckpointLabel: 'Start Line',
    finished: false,
    finishTime: 0,
    finishPlacement: 0,
    deaths: 0,
    shoves: 0,
    score: 0
  });

  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // --- SPACE DODGE (SPACE DOGE) ENDLESS SURVIVAL STRUCTURES ---
  interface Asteroid {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    rotation: number;
    rotSpeed: number;
    type: 'normal' | 'fast' | 'heavy' | 'splitter' | 'fake';
    color: string;
    hasSplit?: boolean;
    fakeRedirected?: boolean;
    nearMissRegistered?: boolean;
    trail: { x: number; y: number }[];
  }

  interface SpaceDogePowerUp {
    id: number;
    x: number;
    y: number;
    vy: number;
    type: 'shield' | 'speed' | 'slow_time' | 'tiny_mode' | 'magnet';
    color: string;
    size: number;
  }

  interface ExplosionSpark {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    color: string;
    size: number;
    text?: string;
  }

  interface LandCrater {
    x: number;
    y: number;
    size: number;
    life: number;
  }

  const spaceDogeRef = useRef({
    asteroids: [] as Asteroid[],
    powerups: [] as SpaceDogePowerUp[],
    particles: [] as ExplosionSpark[],
    craters: [] as LandCrater[],
    score: 0,
    lives: 3,
    activePowerUp: null as 'shield' | 'speed' | 'slow_time' | 'tiny_mode' | 'magnet' | null,
    powerUpTimer: 0,
    difficultyTier: 1,
    secondsElapsed: 0,
    startTime: 0,
    screenShake: 0,
    flashEffect: 0,
    bgScroll: 0,
    gameOver: false,
    lastSpawnTime: 0,
    safeZoneTimer: 0,
    invulnerabilityTimer: 0
  });

  // Spawn asteroid logic helper
  const spawnAsteroid = () => {
    const sd = spaceDogeRef.current;
    const size = Math.random() * 20 + 12; // 12 to 32
    const typeRoll = Math.random();
    let type: 'normal' | 'fast' | 'heavy' | 'splitter' | 'fake' = 'normal';
    let speedMult = 1.0;
    let color = '#ef4444'; // default red

    if (typeRoll < 0.22) {
      type = 'fast';
      speedMult = 1.65;
      color = '#f97316'; // orange fast
    } else if (typeRoll < 0.38) {
      type = 'heavy';
      speedMult = 0.65;
      color = '#7f1d1d'; // maroon heavy
    } else if (typeRoll < 0.50) {
      type = 'splitter';
      speedMult = 0.85;
      color = '#a855f7'; // violet splitter
    } else if (typeRoll < 0.62) {
      type = 'fake';
      speedMult = 1.05;
      color = '#3b82f6'; // blue fake
    }

    const fallsFromLeft = Math.random() > 0.5;
    let x = Math.random() * CANVAS_WIDTH;
    let vx = 0;
    let vy = (Math.random() * 2 + 2) * speedMult * (1 + (sd.difficultyTier - 1) * 0.15);

    if (fallsFromLeft) {
      x = Math.random() * (CANVAS_WIDTH / 3);
      vx = Math.random() * 2 + 0.8;
    } else {
      x = CANVAS_WIDTH - Math.random() * (CANVAS_WIDTH / 3);
      vx = -(Math.random() * 2 + 0.8);
    }

    if (sd.activePowerUp === 'slow_time') {
      vx *= 0.5;
      vy *= 0.5;
    }

    sd.asteroids.push({
      id: Math.random(),
      x,
      y: -35,
      vx,
      vy,
      size,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() * 0.05 + 0.01) * (Math.random() > 0.5 ? 1 : -1),
      type,
      color,
      trail: []
    });
  };

  const spawnPowerUp = () => {
    const sd = spaceDogeRef.current;
    const types: ('shield' | 'speed' | 'slow_time' | 'tiny_mode' | 'magnet')[] = [
      'shield', 'speed', 'slow_time', 'tiny_mode', 'magnet'
    ];
    const type = types[Math.floor(Math.random() * types.length)];
    let color = '#3b82f6'; // shield: blue
    if (type === 'speed') color = '#22c55e'; // green
    if (type === 'slow_time') color = '#eab308'; // yellow
    if (type === 'tiny_mode') color = '#ec4899'; // pink
    if (type === 'magnet') color = '#a855f7'; // violet

    sd.powerups.push({
      id: Math.random(),
      x: Math.random() * (CANVAS_WIDTH - 80) + 40,
      y: -20,
      vy: 1.4,
      type,
      color,
      size: 15
    });
  };

  // Run initialization on game modes
  useEffect(() => {
    if (gameMode === 'Space Dodge' || gameMode === 'Space Doge') {
      const my = myPlayerRef.current;
      my.x = 400;
      my.y = GROUND_LEVEL - 36;
      my.vx = 0;
      my.vy = 0;
      my.finished = false;
      my.score = 0;

      // Reset Space Dodge config ref
      const sd = spaceDogeRef.current;
      sd.asteroids = [];
      sd.powerups = [];
      sd.particles = [];
      sd.craters = [];
      sd.score = 0;
      sd.lives = 3;
      sd.activePowerUp = null;
      sd.powerUpTimer = 0;
      sd.difficultyTier = 1;
      sd.secondsElapsed = 0;
      sd.startTime = Date.now();
      sd.screenShake = 0;
      sd.flashEffect = 0;
      sd.bgScroll = 0;
      sd.gameOver = false;
      sd.lastSpawnTime = Date.now();
      sd.safeZoneTimer = 0;
      sd.invulnerabilityTimer = 0;
    }
  }, [gameMode]);

  // Interpolation cache for smooth rendering of other competitors
  const interpolationsRef = useRef<{
    [id: string]: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      finished: boolean;
      score: number;
      shieldActive?: boolean;
    };
  }>({});

  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [percentComplete, setPercentComplete] = useState(0);

  // Subordinated statistics for side panel
  const [statsSummary, setStatsSummary] = useState({
    deaths: 0,
    shoves: 0,
    checkpoint: 'Start Line'
  });

  // Confetti arrays for celebration
  const [confetti, setConfetti] = useState<{ x: number; y: number; vx: number; vy: number; color: string }[]>([]);

  // 1. Setup real-time postgres hit listeners for gentle shoves from other players
  useEffect(() => {
    if (!room?.id) return;
    const supabase = getSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel(`combat_simple_${room.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'game_events',
        filter: `room_id=eq.${room.id}`
      }, (payload) => {
        const evt = payload.new as any;
        if (evt.type === 'combat_hit') {
          const { targetId, vx, vy, attackerName } = evt.payload;
          if (targetId === currentUserId) {
            // Apply a slight knockback sideways to create competitive play - NO frustrating stun/lock screens
            myPlayerRef.current.vx = vx;
            myPlayerRef.current.vy = vy;
            playBeep(260, 0.1, 'sine');
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id, currentUserId]);

  // 2. Clear Key Handlers
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

  // 3. Simple sync rate loop
  useEffect(() => {
    const syncInterval = setInterval(() => {
      const my = myPlayerRef.current;
      if (my.finished) return; // Wait to submit results and switch screen

      // Transferred properties in velocity payload wrapper
      const payloadStats = {
        deaths: my.deaths,
        punches: my.shoves, // Maps to 'punches' in overall stats schema
        falls: my.deaths, // Count as total falls
        sabotages: my.shoves,
        isSliding: false,
        isDashing: false,
        isStunned: false,
        shieldActive: my.superJumpTimer > 0
      };

      updatePlayerPosition(my.x, my.y, my.vx, my.vy, my.finished, my.score, 0, payloadStats);
    }, 120);

    return () => clearInterval(syncInterval);
  }, [updatePlayerPosition]);

  // 4. Main Animation & Physics Loop
  useEffect(() => {
    let animationId: number;

    const gameLoop = () => {
      updatePhysics();
      drawGame();
      animationId = requestAnimationFrame(gameLoop);
    };

    const updateSpaceDogePhysics = () => {
      const sd = spaceDogeRef.current;
      const my = myPlayerRef.current;
      const keys = keysPressed.current;

      if (sd.gameOver) {
        // Slow down drift
        my.vx *= 0.9;
        my.x += my.vx;
        my.x = Math.max(15, Math.min(785, my.x));

        // Let background drift a tiny bit
        sd.bgScroll += 0.3;

        // Decaying existing timers & particles
        if (sd.screenShake > 0) sd.screenShake *= 0.88;
        if (sd.flashEffect > 0) sd.flashEffect -= 0.5;

        sd.particles.forEach((p, index) => {
          p.life++;
          p.x += p.vx;
          p.y += p.vy;
          if (p.life >= p.maxLife) {
            sd.particles.splice(index, 1);
          }
        });

        sd.craters.forEach((c, index) => {
          c.life--;
          if (c.life <= 0) {
            sd.craters.splice(index, 1);
          }
        });
        return;
      }

      // 1. Decaying Timers
      if (sd.powerUpTimer > 0) {
        sd.powerUpTimer--;
        if (sd.powerUpTimer <= 0) {
          sd.activePowerUp = null;
          playBeep(320, 0.1, 'sine'); // chime off
        }
      }

      if (sd.invulnerabilityTimer > 0) {
        sd.invulnerabilityTimer--;
      }

      if (sd.safeZoneTimer > 0) {
        sd.safeZoneTimer--;
      }

      // 2. Incremental Difficulty scaling & timers
      if (!sd.startTime) {
        sd.startTime = Date.now();
      }
      const elapsed = Math.floor((Date.now() - sd.startTime) / 1000);
      sd.secondsElapsed = elapsed;

      // Tier increases every 20 seconds up to max 10
      sd.difficultyTier = Math.min(10, Math.floor(elapsed / 20) + 1);

      // Score base tick reward
      sd.score += 1;
      my.score = sd.score;

      // 3. Safe Zone Logic (fewer asteroids for breathing room every 40 seconds)
      if (elapsed > 0 && elapsed % 50 === 0 && sd.safeZoneTimer <= 0 && sd.difficultyTier > 1) {
        sd.safeZoneTimer = 300; // 5 seconds of peace
        // Spawn shield/heart floating message
        sd.particles.push({
          x: my.x,
          y: GROUND_LEVEL - 55,
          vx: 0,
          vy: -1.0,
          life: 0,
          maxLife: 50,
          color: '#34d399',
          size: 13,
          text: '⚠️ SAFE ZONE DETECTED - BREATHE!'
        });
      }

      // 4. Asteroid Spawning Logic
      const spawnInterval = Math.max(10, 48 - sd.difficultyTier * 4.2);
      if (sd.safeZoneTimer <= 0 && Date.now() - sd.lastSpawnTime > spawnInterval * 16.7) {
        const simCount = Math.floor(Math.random() * (sd.difficultyTier >= 6 ? 2 : 1)) + 1;
        for (let i = 0; i < simCount; i++) {
          spawnAsteroid();
        }
        sd.lastSpawnTime = Date.now();
      }

      // Power-up spawning (small random chance, max 2 on screen)
      if (Math.random() < 0.003 && sd.powerups.length < 2) {
        spawnPowerUp();
      }

      // 5. Player horizontal controls
      let speedMult = 1.0;
      if (sd.activePowerUp === 'speed') {
        speedMult = 1.55;
      }

      let lateralInput = 0;
      if (keys['ArrowLeft'] || keys['a'] || keys['A']) lateralInput = -1;
      if (keys['ArrowRight'] || keys['d'] || keys['D']) lateralInput = 1;

      const acceleration = 0.58 * speedMult;
      const friction = 0.16;
      const maxSpeed = 6.4 * speedMult;

      if (lateralInput !== 0) {
        my.vx += lateralInput * acceleration;
        my.facingRight = lateralInput > 0;
      } else {
        my.vx *= (1 - friction);
      }
      my.vx = Math.max(-maxSpeed, Math.min(maxSpeed, my.vx));
      my.x += my.vx;

      // Map limits
      my.x = Math.max(15, Math.min(785, my.x));
      my.y = GROUND_LEVEL - 36;

      // 6. Physics and updates of active Asteroids
      sd.asteroids.forEach((ast, index) => {
        // Leave fire trails
        if (Math.random() < 0.45) {
          ast.trail.push({ x: ast.x, y: ast.y });
          if (ast.trail.length > 7) {
            ast.trail.shift();
          }
        }

        // Apply velocities
        ast.x += ast.vx;
        ast.y += ast.vy;
        ast.rotation += ast.rotSpeed;

        // Splitter breaking down
        if (ast.type === 'splitter' && !ast.hasSplit && ast.y > 170 + Math.random() * 80) {
          ast.hasSplit = true;
          playBeep(400, 0.05, 'triangle');
          for (let i = 0; i < 2; i++) {
            sd.asteroids.push({
              id: Math.random(),
              x: ast.x,
              y: ast.y,
              vx: ast.vx + (i === 0 ? -1.4 : 1.4),
              vy: ast.vy * 1.15,
              size: ast.size * 0.55,
              rotation: Math.random() * Math.PI,
              rotSpeed: ast.rotSpeed * 1.5,
              type: 'normal',
              color: '#d946ef', // purple splitter pieces
              trail: []
            });
          }
        }

        // Fake redirecting mid-fall
        if (ast.type === 'fake' && !ast.fakeRedirected && ast.y > 110 + Math.random() * 100) {
          ast.fakeRedirected = true;
          ast.vx = -ast.vx * 1.35;
          playBeep(450, 0.05, 'triangle');
        }

        // Hit box evaluation
        const halfSize = ast.size * 0.4;
        const playerHitboxSize = sd.activePowerUp === 'tiny_mode' ? 8 : 13;
        const collisionDist = Math.hypot(ast.x - my.x, ast.y - (GROUND_LEVEL - 18));

        if (collisionDist < halfSize + playerHitboxSize && !sd.gameOver) {
          // Remove hit asteroid
          sd.asteroids.splice(index, 1);

          if (sd.invulnerabilityTimer <= 0) {
            if (sd.activePowerUp === 'shield') {
              // Shield breaks
              sd.activePowerUp = null;
              sd.invulnerabilityTimer = 60; // 1s invuln
              sd.screenShake = 10;
              playCrashSound();

              // Spawn blue shatter sparks
              for (let i = 0; i < 15; i++) {
                sd.particles.push({
                  x: my.x,
                  y: GROUND_LEVEL - 18,
                  vx: (Math.random() - 0.5) * 6,
                  vy: (Math.random() - 0.5) * 6,
                  life: 0,
                  maxLife: 20 + Math.random() * 15,
                  color: '#60a5fa',
                  size: Math.random() * 2 + 2
                });
              }

              sd.particles.push({
                x: my.x,
                y: GROUND_LEVEL - 50,
                vx: 0,
                vy: -1.0,
                life: 0,
                maxLife: 40,
                color: '#60a5fa',
                size: 11,
                text: 'SHIELD DEFLECTED!'
              });
            } else {
              // Lose a life
              sd.lives--;
              sd.screenShake = 18;
              sd.flashEffect = 12;
              playCrashSound();

              if (sd.lives <= 0) {
                // Total destruction!
                sd.gameOver = true;
                my.finished = true;
                my.finishTime = Date.now();

                // Spark explosion
                for (let i = 0; i < 30; i++) {
                  sd.particles.push({
                    x: my.x,
                    y: GROUND_LEVEL - 18,
                    vx: (Math.random() - 0.5) * 9,
                    vy: (Math.random() - 0.5) * 9 - 2,
                    life: 0,
                    maxLife: 40,
                    color: i % 2 === 0 ? '#ef4444' : '#fbbf24',
                    size: Math.random() * 3 + 2
                  });
                }

                // Sync scores
                updatePlayerPosition(my.x, my.y, 0, 0, true, my.score, 0);
                sendGameEvent('chat_log_broadcast', { text: `💥 ${username} died of asteroid impact! Score: ${sd.score}` });

                // Redirect to scoreboard results in 4.5s
                setTimeout(() => {
                  window.history.pushState(null, '', `/results/${code}`);
                  window.dispatchEvent(new Event('pushstate'));
                }, 4500);

              } else {
                // Give safe invulnerability
                sd.invulnerabilityTimer = 110;

                // Red sparks
                for (let i = 0; i < 10; i++) {
                  sd.particles.push({
                    x: my.x,
                    y: GROUND_LEVEL - 18,
                    vx: (Math.random() - 0.5) * 5,
                    vy: (Math.random() - 0.5) * 5,
                    life: 0,
                    maxLife: 20,
                    color: '#f43f5e',
                    size: Math.random() * 2 + 1
                  });
                }

                sd.particles.push({
                  x: my.x,
                  y: GROUND_LEVEL - 50,
                  vx: 0,
                  vy: -1.0,
                  life: 0,
                  maxLife: 45,
                  color: '#ef4444',
                  size: 11,
                  text: `-1 LIFE! (${sd.lives} LEFT)`
                });
              }
            }
          }
          return;
        }

        // Asteroid hits ground base
        if (ast.y >= GROUND_LEVEL) {
          sd.asteroids.splice(index, 1);

          // Near miss check reward - if we are within range and didn't crash
          const lateralDiff = Math.abs(ast.x - my.x);
          if (lateralDiff < 44 && !sd.gameOver) {
            sd.score += 70;
            playBeep(650, 0.05, 'sine');
            sd.particles.push({
              x: my.x,
              y: GROUND_LEVEL - 42,
              vx: 0,
              vy: -1.3,
              life: 0,
              maxLife: 40,
              color: '#f59e0b',
              size: 11,
              text: 'DODGED! NEAR MISS! +70'
            });
          }

          // Screen impacts
          sd.screenShake = ast.type === 'heavy' ? 12 : 5.5;
          sd.flashEffect = ast.type === 'heavy' ? 7 : 3;
          playBeep(ast.type === 'heavy' ? 130 : 190, 0.1, 'sawtooth');

          // Spawning ground crater
          sd.craters.push({
            x: ast.x,
            y: GROUND_LEVEL,
            size: ast.type === 'heavy' ? 22 : 11,
            life: 200
          });

          // Ground impact dust spikes
          const sparkCount = ast.type === 'heavy' ? 14 : 7;
          for (let i = 0; i < sparkCount; i++) {
            sd.particles.push({
              x: ast.x,
              y: GROUND_LEVEL - 2,
              vx: (Math.random() - 0.5) * (ast.type === 'heavy' ? 5.5 : 3.5),
              vy: -Math.random() * (ast.type === 'heavy' ? 4.5 : 2.5) - 1,
              life: 0,
              maxLife: 20 + Math.random() * 12,
              color: ast.color,
              size: Math.random() * (ast.type === 'heavy' ? 3.5 : 2) + 1
            });
          }
        }
      });

      // 7. Powerup interaction updates
      sd.powerups.forEach((pu, index) => {
        pu.y += pu.vy;

        // Active Magnet pulls items in range
        if (sd.activePowerUp === 'magnet') {
          const dx = my.x - pu.x;
          const dy = (GROUND_LEVEL - 18) - pu.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 180) {
            pu.x += (dx / dist) * 3.4;
            pu.y += (dy / dist) * 3.4;
          }
        }

        if (pu.y >= GROUND_LEVEL - 12) {
          pu.y = GROUND_LEVEL - 12;
          pu.vy = 0;
        }

        const collDist = Math.hypot(pu.x - my.x, pu.y - (GROUND_LEVEL - 18));
        if (collDist < 26 && !sd.gameOver) {
          sd.powerups.splice(index, 1);
          sd.activePowerUp = pu.type;
          sd.powerUpTimer = 300; // 5 seconds
          playBoostSound();

          // Spark blast
          for (let i = 0; i < 10; i++) {
            sd.particles.push({
              x: pu.x,
              y: pu.y,
              vx: (Math.random() - 0.5) * 4,
              vy: (Math.random() - 0.5) * 4,
              life: 0,
              maxLife: 15,
              color: pu.color,
              size: Math.random() * 2 + 1.5
            });
          }

          const labels = {
            shield: '🔵 SHIELD EQUIPPED!',
            speed: '🟢 HYPER SPEED BOOST!',
            slow_time: '🟡 TIME DIATION ENGAGED!',
            tiny_mode: '🌸 MICRO SIZE SUIT!',
            magnet: '🧲 COGNITIVE POWER MAGNET!'
          };

          sd.particles.push({
            x: my.x,
            y: GROUND_LEVEL - 45,
            vx: 0,
            vy: -1.2,
            life: 0,
            maxLife: 45,
            color: pu.color,
            size: 12,
            text: labels[pu.type]
          });
        }
      });

      // 8. Decay miscellaneous objects
      if (sd.screenShake > 0) sd.screenShake *= 0.88;
      if (sd.flashEffect > 0) sd.flashEffect -= 0.5;

      sd.particles.forEach((p, index) => {
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        if (p.life >= p.maxLife) {
          sd.particles.splice(index, 1);
        }
      });

      sd.craters.forEach((c, index) => {
        c.life--;
        if (c.life <= 0) {
          sd.craters.splice(index, 1);
        }
      });

      // Smoothly offset scrolling ground illusion
      sd.bgScroll += (my.vx * 0.35) + 1.25;

      // Sync React state statistics
      setCurrentSpeed(Math.round(Math.abs(my.vx) * 10));
      setPercentComplete(Math.min(100, Math.round((sd.score / 1500) * 100)));
      setStatsSummary({
        deaths: 3 - sd.lives,
        shoves: sd.score,
        checkpoint: `Tier ${sd.difficultyTier} ${sd.safeZoneTimer > 0 ? '(SAFE)' : ''}`
      });
    };

    const updatePhysics = () => {
      if (gameMode === 'Space Dodge' || gameMode === 'Space Doge') {
        updateSpaceDogePhysics();
        return;
      }
      const my = myPlayerRef.current;
      const keys = keysPressed.current;

      if (my.finished) {
        // Decelerate and enjoy the view
        my.vx *= 0.9;
        my.vy *= 0.9;
        my.x += my.vx;
        my.y += my.vy;

        // Falling victory confetti
        if (Math.random() < 0.25) {
          const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6'];
          setConfetti(prev => [
            ...prev,
            {
              x: Math.random() * CANVAS_WIDTH,
              y: -10,
              vx: Math.random() * 3 - 1.5,
              vy: Math.random() * 2 + 1.5,
              color: colors[Math.floor(Math.random() * colors.length)]
            }
          ].slice(-50));
        }
        return;
      }

      // Safe Timers decay
      if (my.boostTimer > 0) my.boostTimer--;
      if (my.superJumpTimer > 0) my.superJumpTimer--;

      // Horizontal controls handling
      let lateralInput = 0;
      if (keys['ArrowLeft'] || keys['a'] || keys['A']) lateralInput = -1;
      if (keys['ArrowRight'] || keys['d'] || keys['D']) lateralInput = 1;

      // Simple physics constants (perfectly balanced, responsive and super stable)
      const acceleration = 0.45;
      const baseFriction = 0.12;
      const gravity = 0.42;
      const maxNormalSpeed = my.boostTimer > 0 ? 7.6 : 5.0;

      if (lateralInput !== 0) {
        my.vx += lateralInput * acceleration;
        my.facingRight = lateralInput > 0;
      } else {
        my.vx *= (1 - baseFriction);
      }

      // Lock maximal horizontal caps
      my.vx = Math.max(-maxNormalSpeed, Math.min(maxNormalSpeed, my.vx));

      // Vertical jumping controls
      const jumpPressed = keys[' '] || keys['ArrowUp'] || keys['w'] || keys['W'];
      if (jumpPressed) {
        if (my.isGrounded) {
          // Normal jump or high double jump
          const jumpPower = my.superJumpTimer > 0 ? -11.0 : -9.0;
          my.vy = jumpPower;
          my.isGrounded = false;
          my.doubleJumpsUsed = 0;
          playBeep(480, 0.1, 'sine');
          
          keysPressed.current[' '] = false;
          keysPressed.current['ArrowUp'] = false;
          keysPressed.current['w'] = false;
        } else if (my.doubleJumpsUsed < 1) {
          // Double jump
          my.vy = -6.7;
          my.doubleJumpsUsed++;
          playBeep(580, 0.08, 'sine');

          keysPressed.current[' '] = false;
          keysPressed.current['ArrowUp'] = false;
          keysPressed.current['w'] = false;
        }
      }

      // Add simple gravity fall down
      if (!my.isGrounded) {
        my.vy += gravity;
      }

      // Apply coordinates shift
      my.x += my.vx;
      my.y += my.vy;

      // Lock borders
      my.x = Math.max(15, Math.min(MAP_LENGTH, my.x));

      // Reset grounding state
      my.isGrounded = false;

      // Platform Collisions - Clean, axis-aligned bounding check
      platforms.current.forEach((plat) => {
        const playerWidth = 24;
        const playerHeight = 36;
        const halfW = playerWidth / 2;

        if (
          my.x + halfW > plat.x &&
          my.x - halfW < plat.x + plat.w &&
          my.y + playerHeight > plat.y &&
          my.y < plat.y + plat.h
        ) {
          // Grounding check: falling onto platform from top
          if (my.vy >= 0 && (my.y - my.vy) + playerHeight <= plat.y + 6) {
            my.y = plat.y - playerHeight;
            my.vy = 0;
            my.isGrounded = true;
            my.doubleJumpsUsed = 0;
          } else if (my.vy < 0 && (my.y - my.vy) >= plat.y + plat.h - 6) {
            // Bumped head from below
            my.y = plat.y + plat.h;
            my.vy = 0.5;
          } else {
            // Push player out horizontally from blockages
            my.x -= my.vx;
            my.vx = -my.vx * 0.2;
          }
        }
      });

      // Moving Platform update & collisions
      const now = Date.now();
      movingPlatforms.current.forEach((plat) => {
        // Predictable side-to-side oscillation
        const curX = plat.startX + Math.sin(now * plat.speed) * plat.rangeX;
        const curY = plat.y;
        
        const playerWidth = 24;
        const playerHeight = 36;
        const halfW = playerWidth / 2;

        if (
          my.x + halfW > curX &&
          my.x - halfW < curX + plat.w &&
          my.y + playerHeight > curY &&
          my.y < curY + plat.h
        ) {
          if (my.vy >= 0 && (my.y - my.vy) + playerHeight <= curY + 6) {
            my.y = curY - playerHeight;
            my.vy = 0;
            my.isGrounded = true;
            my.doubleJumpsUsed = 0;

            // Move character along with platform
            const platformVx = Math.cos(now * plat.speed) * plat.rangeX * plat.speed;
            my.x += platformVx;
          }
        }
      });

      // Check Checkpoints coordinates
      checkpoints.forEach((checkpoint) => {
        if (my.x >= checkpoint.x && checkpoint.x > my.latestCheckpointX) {
          my.latestCheckpointX = checkpoint.x;
          my.latestCheckpointY = checkpoint.y;
          my.latestCheckpointLabel = checkpoint.label;
          playBeep(650, 0.15, 'sine');
          sendGameEvent('chat_log_broadcast', { text: `${username} reached checkpoint: ${checkpoint.label}!` });
        }
      });

      // Pit fall check
      if (my.y > CANVAS_HEIGHT + 60) {
        my.deaths++;
        playCrashSound();
        respawnAtCheckpoint();
      }

      // Check Hazards collisions (using mathematically accurate aligned pixel-perfect boundaries)
      hazards.current.forEach((haz) => {
        const playerWidth = 24;
        const playerHeight = 36;
        
        if (haz.type === 'spike') {
          // Precise rectangular bounding box aligned with triangles drawn upwards from haz.y base
          if (
            my.x + playerWidth / 2 > haz.x - haz.w / 2 &&
            my.x - playerWidth / 2 < haz.x + haz.w / 2 &&
            my.y + playerHeight > haz.y - haz.h &&
            my.y < haz.y
          ) {
            my.deaths++;
            playCrashSound();
            respawnAtCheckpoint();
          }
        } else if (haz.type === 'slow_orb') {
          // Precise radial circle check targeting the actual center of our local bubble character
          const dist = Math.hypot(my.x - haz.x, (my.y + 18) - haz.y);
          if (dist < (haz.w / 2) + 10) {
            my.deaths++;
            playCrashSound();
            respawnAtCheckpoint();
          }
        }
      });

      // Check collectible Boost pads (calculated against the center of the player's body for high reliability of collection)
      boostPads.current.forEach((pad) => {
        if (collectedBoostIds.has(pad.id)) return;

        const distance = Math.hypot(my.x - pad.x, (my.y + 18) - pad.y);
        if (distance < 24) {
          playBoostSound();
          setCollectedBoostIds(prev => {
            const copy = new Set(prev);
            copy.add(pad.id);
            return copy;
          });

          if (pad.type === 'speed') {
            my.boostTimer = 180; // 3 seconds fast run
          } else {
            my.superJumpTimer = 220; // 3.6 seconds of super high jumps
          }
        }
      });

      // Competitive Interaction: "F" to execute safe, fun shove (pushes other player sideways)
      const shoveKeyPressed = keys['f'] || keys['F'];
      if (shoveKeyPressed && !my.finished) {
        // Small swish sound
        playBeep(700, 0.05, 'triangle');
        keysPressed.current['f'] = false;
        keysPressed.current['F'] = false;

        players.forEach((p) => {
          if (p.id === currentUserId) return;
          const otherX = p.x_position;
          const otherY = p.y_position;

          const distance = Math.hypot(my.x - otherX, my.y - otherY);
          if (distance < 50) {
            my.shoves++;
            const kickX = my.facingRight ? 9 : -9;
            const kickY = -3.5;

            // Send combat shove via real-time postgres insertion triggers cleanly
            sendGameEvent('combat_hit', {
              attackerId: currentUserId,
              attackerName: username,
              targetId: p.id,
              type: 'punch', // standard type handled on client
              vx: kickX,
              vy: kickY
            });

            sendGameEvent('chat_log_broadcast', { text: `${username} nudged ${p.username}!` });
          }
        });
      }

      // Reaching the finish line checks!
      if (my.x >= 4800 && !my.finished) {
        my.finished = true;
        my.finishTime = Date.now();
        playVictorySound();

        const finishedTimes = players.filter(p => p.finished).length;
        my.finishPlacement = finishedTimes + 1;

        // Share result with room lobby
        updatePlayerPosition(my.x, my.y, 0, 0, true, my.score, 0);

        sendGameEvent('race_complete', {
          username: username,
          finishTime: my.finishTime,
          placement: my.finishPlacement,
          stats: {
            deaths: my.deaths,
            punches: my.shoves,
            falls: my.deaths,
            sabotages: my.shoves
          }
        });

        // Safe redirect wait to grand GP leaderboard standings screen
        setTimeout(() => {
          window.history.pushState(null, '', `/results/${code}`);
          window.dispatchEvent(new Event('pushstate'));
        }, 3200);
      }

      // Sync React indicators
      setCurrentSpeed(Math.round(Math.abs(my.vx) * 10));
      setPercentComplete(Math.min(100, Math.round((my.x / 4800) * 100)));
      setStatsSummary({
        deaths: my.deaths,
        shoves: my.shoves,
        checkpoint: my.latestCheckpointLabel
      });
    };

    const respawnAtCheckpoint = () => {
      const my = myPlayerRef.current;
      my.x = my.latestCheckpointX;
      my.y = my.latestCheckpointY - 50; // Use checkpoint's Y coordinate to drop safely onto platforms
      my.vx = 0;
      my.vy = 0;
      my.boostTimer = 0;
      my.superJumpTimer = 0;
    };

    const drawSpaceDoge = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const sd = spaceDogeRef.current;
      const my = myPlayerRef.current;
      const now = Date.now();

      // Ensure dimensions matches viewport
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;

      ctx.save();
      // Apply screen shaking
      if (sd.screenShake > 0.4) {
        const shakeX = (Math.random() - 0.5) * sd.screenShake;
        const shakeY = (Math.random() - 0.5) * sd.screenShake;
        ctx.translate(shakeX, shakeY);
      }

      // 1. Cosmic Deep Slate Sky Background
      ctx.fillStyle = '#060a16';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Red-alert flashing overlay on hit
      if (sd.flashEffect > 0.4) {
        ctx.fillStyle = `rgba(239, 68, 68, ${Math.min(0.24, sd.flashEffect / 14)})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }

      // 2. Parallax 1: Infinite stars
      ctx.fillStyle = '#64748b';
      for (let i = 0; i < 45; i++) {
        const starX = (i * 117 + sd.bgScroll * 0.12) % CANVAS_WIDTH;
        const starY = (i * 81) % (CANVAS_HEIGHT * 0.72);
        const starSize = i % 4 === 0 ? 1.4 : 0.9;
        ctx.fillRect(starX, starY, starSize, starSize);
      }

      // 3. Parallax 2: Falling Moon and shooting stars
      const moonX = (CANVAS_WIDTH * 0.75 - sd.bgScroll * 0.04) % CANVAS_WIDTH;
      const correctedMoonX = moonX < -100 ? moonX + CANVAS_WIDTH + 100 : moonX;
      ctx.fillStyle = '#881337'; // ominous apocalypse rose red moon
      ctx.beginPath();
      ctx.arc(correctedMoonX, 90, 36, 0, Math.PI * 2);
      ctx.fill();

      // Moon craters
      ctx.fillStyle = '#6b0726';
      ctx.beginPath();
      ctx.arc(correctedMoonX - 12, 84, 8, 0, Math.PI * 2);
      ctx.arc(correctedMoonX + 15, 102, 11, 0, Math.PI * 2);
      ctx.fill();

      // Random shooting stars
      if (Math.random() < 0.015) {
        sd.particles.push({
          x: Math.random() * CANVAS_WIDTH,
          y: 0,
          vx: -5 - Math.random() * 4,
          vy: 5 + Math.random() * 4,
          life: 0,
          maxLife: 20,
          color: 'rgba(255, 255, 255, 0.45)',
          size: 1.2
        });
      }

      // 4. Ground rendering - Dino style
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, GROUND_LEVEL, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_LEVEL);

      // Scroll lines on ground
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      for (let i = 0; i < 18; i++) {
        const linesX = (i * 75 - sd.bgScroll) % CANVAS_WIDTH;
        const finalLX = linesX < -50 ? linesX + CANVAS_WIDTH + 50 : linesX;
        ctx.moveTo(finalLX, GROUND_LEVEL + 4);
        ctx.lineTo(finalLX + 18, GROUND_LEVEL + 4);
        ctx.moveTo(finalLX - 15, GROUND_LEVEL + 16);
        ctx.lineTo(finalLX + 5, GROUND_LEVEL + 16);
      }
      ctx.stroke();

      // Craters on ground from hits
      sd.craters.forEach((cr) => {
        ctx.fillStyle = '#030712';
        ctx.beginPath();
        ctx.arc(cr.x, cr.y, cr.size, Math.PI, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#27272a';
        ctx.stroke();
      });

      // 5. Draw active Asteroids fire trails
      sd.asteroids.forEach((ast) => {
        if (ast.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(ast.trail[0].x, ast.trail[0].y);
          for (let pInc = 1; pInc < ast.trail.length; pInc++) {
            ctx.lineTo(ast.trail[pInc].x, ast.trail[pInc].y);
          }
          ctx.strokeStyle = ast.color + '4c'; // semi-transparent glow trail
          ctx.lineWidth = ast.size * 0.45;
          ctx.stroke();
        }
      });

      // 6. Draw Asteroids (Chrome Dino pixel rocky look)
      sd.asteroids.forEach((ast) => {
        ctx.save();
        ctx.translate(ast.x, ast.y);
        ctx.rotate(ast.rotation);

        // Core dynamic rocket lighting gradient
        const radiusGlow = ast.size * 1.5;
        const dynamicGrad = ctx.createRadialGradient(0, 0, ast.size * 0.1, 0, 0, radiusGlow);
        dynamicGrad.addColorStop(0, ast.color);
        dynamicGrad.addColorStop(0.3, ast.color + 'aa');
        dynamicGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = dynamicGrad;
        ctx.beginPath();
        ctx.arc(0, 0, radiusGlow, 0, Math.PI * 2);
        ctx.fill();

        // Asteroid core
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = ast.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let vertex = 0; vertex < 8; vertex++) {
          const radialAngle = (vertex * Math.PI) / 4;
          const noise = ast.size * (0.8 + Math.abs(Math.sin(ast.id * 800 + vertex)) * 0.3);
          const vertexX = Math.cos(radialAngle) * noise;
          const vertexY = Math.sin(radialAngle) * noise;
          if (vertex === 0) ctx.moveTo(vertexX, vertexY);
          else ctx.lineTo(vertexX, vertexY);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      });

      // 7. Draw Power-Ups
      sd.powerups.forEach((pu) => {
        const floatDelta = Math.sin(now * 0.007 + pu.id) * 3;
        ctx.save();
        ctx.translate(pu.x, pu.y + floatDelta);

        // Glowing outer halo
        ctx.strokeStyle = pu.color + '44';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, pu.size * 1.3, 0, Math.PI * 2);
        ctx.stroke();

        // Solid core diamond
        ctx.fillStyle = pu.color;
        ctx.beginPath();
        ctx.moveTo(0, -pu.size);
        ctx.lineTo(pu.size, 0);
        ctx.lineTo(0, pu.size);
        ctx.lineTo(-pu.size, 0);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Symbol text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        let symbolText = '❓';
        if (pu.type === 'shield') symbolText = '🛡️';
        if (pu.type === 'speed') symbolText = '⚡';
        if (pu.type === 'slow_time') symbolText = '⏱️';
        if (pu.type === 'tiny_mode') symbolText = '🌸';
        if (pu.type === 'magnet') symbolText = '🧲';
        ctx.fillText(symbolText, 0, 3);

        ctx.restore();
      });

      // 8. Draw Competitor characters (transparent space ghosts on ground)
      players.forEach((p) => {
        if (p.id === currentUserId) return;

        let lerp = interpolationsRef.current[p.id];
        if (!lerp) {
          interpolationsRef.current[p.id] = {
            x: p.x_position,
            y: p.y_position,
            vx: (p.velocity as any)?.x || 0,
            vy: (p.velocity as any)?.y || 0,
            finished: p.finished,
            score: p.score || 0
          };
          lerp = interpolationsRef.current[p.id];
        } else {
          lerp.x += (p.x_position - lerp.x) * 0.16;
          lerp.y += (p.y_position - lerp.y) * 0.16;
          lerp.finished = p.finished;
          lerp.score = p.score || 0;
        }

        const px = lerp.x;
        const py = GROUND_LEVEL - 36;

        if (lerp.finished) {
          // Fallen space dust representation
          ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
          ctx.beginPath();
          ctx.arc(px, py + 18, 12, 0, Math.PI * 2);
          ctx.fill();
          return;
        }

        // Draw basic competitor outline
        ctx.fillStyle = 'rgba(147, 197, 253, 0.5)'; // transparent ice blue
        ctx.fillRect(px - 10, py, 20, 36);

        ctx.strokeStyle = 'rgba(191, 219, 254, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px - 10, py, 20, 36);

        // Competitor score indicator bubble
        ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
        ctx.fillRect(px - 45, py - 32, 90, 24);
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.4)';
        ctx.strokeRect(px - 45, py - 32, 90, 24);

        ctx.fillStyle = '#ffffff';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(p.username.slice(0, 10), px, py - 22);
        ctx.fillStyle = '#f59e0b'; // amber points
        ctx.fillText(`${lerp.score} pts`, px, py - 12);
      });

      // 9. Draw our own Pixel Human Suit
      const myPX = my.x;
      const myY = GROUND_LEVEL - 36;
      const isInvulnerable = sd.invulnerabilityTimer > 0;

      if (!sd.gameOver) {
        if (!isInvulnerable || Math.floor(now / 80) % 2 === 0) {
          
          // Magnet attraction wave rings
          if (sd.activePowerUp === 'magnet') {
            ctx.strokeStyle = 'rgba(168, 85, 247, 0.28)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(myPX, myY + 18, 70 + Math.sin(now * 0.016) * 12, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Dynamic shield orb around player
          if (sd.activePowerUp === 'shield') {
            ctx.fillStyle = 'rgba(59, 130, 246, 0.28)';
            ctx.beginPath();
            ctx.arc(myPX, myY + 18, 26, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            ctx.stroke();
          } else if (sd.activePowerUp === 'speed') {
            ctx.fillStyle = 'rgba(34, 197, 94, 0.22)';
            ctx.beginPath();
            ctx.arc(myPX, myY + 18, 25, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2;
            ctx.stroke();
          } else if (sd.activePowerUp === 'slow_time') {
            ctx.fillStyle = 'rgba(234, 179, 8, 0.22)';
            ctx.beginPath();
            ctx.arc(myPX, myY + 18, 25, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          // Local green space suit human!
          const visualHeight = sd.activePowerUp === 'tiny_mode' ? 20 : 36;
          const visualWidth = sd.activePowerUp === 'tiny_mode' ? 12 : 20;
          const correctedYy = GROUND_LEVEL - visualHeight;

          ctx.fillStyle = '#10b981'; // high quality cosmic emerald
          ctx.fillRect(myPX - visualWidth / 2, correctedYy, visualWidth, visualHeight);

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.strokeRect(myPX - visualWidth / 2, correctedYy, visualWidth, visualHeight);

          // Helmet Glass visor
          ctx.fillStyle = '#06b6d4'; // cyan visor
          const helmetVisorX = my.facingRight ? myPX + (visualWidth / 2 - 8) : myPX - (visualWidth / 2);
          ctx.fillRect(helmetVisorX, correctedYy + 4, 8, 8);

          // Local status tag above head
          ctx.fillStyle = 'rgba(16, 185, 129, 0.95)';
          ctx.fillRect(myPX - 35, correctedYy - 18, 70, 13);
          ctx.strokeStyle = '#ffffff';
          ctx.strokeRect(myPX - 35, correctedYy - 18, 70, 13);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 8px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('YOU', myPX, correctedYy - 9);
        }
      }

      // 10. Draw Particle system explosions / message overlays
      sd.particles.forEach((p) => {
        if (p.text) {
          ctx.fillStyle = p.color;
          ctx.font = `bold ${p.size}px monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(p.text, p.x, p.y);
        } else {
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, p.size, p.size);
        }
      });

      ctx.restore();
    };

    const drawGame = () => {
      if (gameMode === 'Space Dodge' || gameMode === 'Space Doge') {
        drawSpaceDoge();
        return;
      }
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const my = myPlayerRef.current;
      const now = Date.now();

      // Fit layout dimensions
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;

      // Clean horizontal sliding camera interpolation
      const camX = Math.max(0, Math.min(MAP_LENGTH - CANVAS_WIDTH, my.x - 220));

      // 1. Draw Clean Sky Pastel Backdrop
      ctx.fillStyle = gameMode === 'Space Dodge' ? '#0f172a' : '#1e293b'; // eye-safe dark slate
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Simple grid landscape lines for solid vector retro platformer aesthetic
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let gridX = 0; gridX < CANVAS_WIDTH; gridX += 40) {
        ctx.beginPath();
        const screenLineX = gridX - (camX * 0.45) % 40;
        ctx.moveTo(screenLineX, 0);
        ctx.lineTo(screenLineX, CANVAS_HEIGHT);
        ctx.stroke();
      }

      // 2. Render Platforms
      platforms.current.forEach((plat) => {
        const px = plat.x - camX;
        if (px + plat.w < -20 || px > CANVAS_WIDTH + 20) return;

        // Clean deep stone charcoal blocks
        ctx.fillStyle = '#334155';
        ctx.fillRect(px, plat.y, plat.w, plat.h);

        // Vibrant neon glow boundaries (cyber aesthetic tracking)
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(px, plat.y, plat.w, plat.h);
      });

      // 3. Render moving slow elevators
      movingPlatforms.current.forEach((plat) => {
        const curX = plat.startX + Math.sin(now * plat.speed) * plat.rangeX;
        const px = curX - camX;

        ctx.fillStyle = '#475569';
        ctx.fillRect(px, plat.y, plat.w, plat.h);

        ctx.strokeStyle = '#f59e0b'; // golden frame moving platforms
        ctx.lineWidth = 2;
        ctx.strokeRect(px, plat.y, plat.w, plat.h);
      });

      // 4. Render Boost pads & super jump springs
      boostPads.current.forEach((pad) => {
        if (collectedBoostIds.has(pad.id)) return;
        const px = pad.x - camX;
        if (px < -30 || px > CANVAS_WIDTH + 30) return;

        // Soft floating bounce animation
        const floatY = pad.y + Math.sin(Date.now() * 0.006 + pad.id) * 4;

        ctx.fillStyle = pad.type === 'speed' ? '#10b981' : '#a855f7';
        ctx.beginPath();
        ctx.arc(px, floatY, 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pad.type === 'speed' ? '⚡' : '🦘', px, floatY);
      });

      // 5. Render Hazards
      hazards.current.forEach((haz) => {
        const px = haz.x - camX;
        if (px < -100 || px > CANVAS_WIDTH + 100) return;

        if (haz.type === 'spike') {
          // Simplistic static spikes triangle layout
          ctx.fillStyle = '#ef4444'; // Bright crimson
          const columns = Math.ceil(haz.w / 14);
          for (let i = 0; i < columns; i++) {
            const spX = px - haz.w / 2 + i * 14;
            ctx.beginPath();
            ctx.moveTo(spX, haz.y);
            ctx.lineTo(spX + 7, haz.y - haz.h);
            ctx.lineTo(spX + 14, haz.y);
            ctx.closePath();
            ctx.fill();
          }
        } else if (haz.type === 'slow_orb') {
          // Clean pulsing security energy orb
          const pulse = 1 + Math.sin(Date.now() * 0.008 + haz.id) * 0.15;
          const radius = (haz.w / 2) * pulse;

          ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
          ctx.beginPath();
          ctx.arc(px, haz.y, radius + 5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#f97316'; // Vivid orange core
          ctx.beginPath();
          ctx.arc(px, haz.y, radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });

      // 6. Draw Checkpoints Flags (drawn perfectly standing tall on top of their respective platforms)
      checkpoints.forEach((checkpoint) => {
        const px = checkpoint.x - camX;
        if (px < -60 || px > CANVAS_WIDTH + 60) return;

        const active = my.latestCheckpointX >= checkpoint.x;
        const cy = checkpoint.y;

        // Pole
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(px, cy);
        ctx.lineTo(px, cy - 50);
        ctx.stroke();

        // Flag
        ctx.fillStyle = active ? '#10b981' : '#dc2626';
        ctx.beginPath();
        ctx.moveTo(px, cy - 50);
        ctx.lineTo(px + 18, cy - 42);
        ctx.lineTo(px, cy - 34);
        ctx.closePath();
        ctx.fill();

        // Label
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'semibold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(checkpoint.label, px, cy - 56);
      });

      // 7. Render Finish goal gateway banner
      const finishGateX = 4800 - camX;
      if (finishGateX > -100 && finishGateX < CANVAS_WIDTH + 100) {
        // High cyber columns
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(finishGateX - 8, GROUND_LEVEL - 120, 16, 120);

        ctx.strokeStyle = '#10b981'; // Green neon gate
        ctx.lineWidth = 4;
        ctx.strokeRect(finishGateX - 8, GROUND_LEVEL - 120, 16, 120);

        // Checkerboard panels
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 15px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('🏁 GOAL 🏁', finishGateX, GROUND_LEVEL - 130);
      }

      // 8. Draw Competitors Smoothly (Interpolated targets)
      players.forEach((p) => {
        if (p.id === currentUserId) return; // Render our character separately below

        let lerp = interpolationsRef.current[p.id];
        if (!lerp) {
          interpolationsRef.current[p.id] = {
            x: p.x_position,
            y: p.y_position,
            vx: (p.velocity as any)?.x || 0,
            vy: (p.velocity as any)?.y || 0,
            finished: p.finished,
            score: p.score || 0
          };
          lerp = interpolationsRef.current[p.id];
        } else {
          // Gentle linear lerp to avoid teleport glitches
          lerp.x += (p.x_position - lerp.x) * 0.16;
          lerp.y += (p.y_position - lerp.y) * 0.16;
          lerp.finished = p.finished;
        }

        const px = lerp.x - camX;
        const py = lerp.y;

        if (px < -30 || px > CANVAS_WIDTH + 30) return;

        // Draw basic competitor orb body
        ctx.fillStyle = '#64748b'; // generic silver
        ctx.beginPath();
        ctx.arc(px, py + 18, 14, 0, Math.PI * 2);
        ctx.fill();

        // Soft white ring
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Player Tag
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.fillRect(px - 40, py - 18, 80, 14);
        ctx.strokeStyle = 'cyan';
        ctx.strokeRect(px - 40, py - 18, 80, 14);

        ctx.fillStyle = '#ffffff';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.username.slice(0, 12), px, py - 8);
      });

      // 9. Render our own character block
      const myPX = my.x - camX;
      const myHeight = 36;
      const myY = my.y;

      // Draw active visual boost states or default neon green bubble
      if (my.boostTimer > 0) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.35)'; // outer shield speed glow
        ctx.beginPath();
        ctx.arc(myPX, myY + myHeight / 2, 22, 0, Math.PI * 2);
        ctx.fill();
      }
      if (my.superJumpTimer > 0) {
        ctx.fillStyle = 'rgba(168, 85, 247, 0.35)'; // high jump jump wave
        ctx.beginPath();
        ctx.arc(myPX, myY + myHeight / 2, 22, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#22c55e'; // Vibrant main player green
      ctx.beginPath();
      ctx.arc(myPX, myY + myHeight / 2, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Mini eye or arrow indicating direction
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      const eyeDirX = my.facingRight ? 4 : -4;
      ctx.arc(myPX + eyeDirX, myY + myHeight / 2 - 2, 3, 0, Math.PI * 2);
      ctx.fill();

      // Local player identifier
      ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
      ctx.fillRect(myPX - 40, myY - 18, 80, 14);
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect(myPX - 40, myY - 18, 80, 14);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('YOU', myPX, myY - 8);

      // Rendering celebration victory screen elements
      confetti.forEach((conf) => {
        conf.x += conf.vx;
        conf.y += conf.vy;

        ctx.fillStyle = conf.color;
        ctx.fillRect(conf.x, conf.y, 4, 4);
      });
    };

    gameLoop();
    return () => cancelAnimationFrame(animationId);
  }, [code, room, players]);

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-slate-950 font-sans text-slate-100 overflow-hidden" id="physics_main_container">
      {/* 2D Canvas Display viewport column */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 lg:p-6" id="canvas_viewport_container">
        <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-4" id="canvas_sub_panel">
          
          {/* Header Controls stats */}
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3" id="hud_top_row">
            <div className="flex items-center gap-2">
              <Tv className="text-sky-400 w-5 h-5" />
              <div>
                <h1 className="text-md font-bold text-sky-400">Competitive Obstacle Dash</h1>
                <p className="text-xs text-slate-400 font-mono">CODE: {code}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-slate-400 font-mono">TRACK POSITION</p>
                <div className="flex items-center gap-1.5 justify-end">
                  <Flag className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-bold text-emerald-400 font-mono">{percentComplete}%</span>
                </div>
              </div>

              <div className="w-[1px] h-8 bg-slate-800" />

              <div className="text-right">
                <p className="text-xs text-slate-400 font-mono">SPEED</p>
                <span className="font-bold text-sky-400 font-mono">{currentSpeed} km/h</span>
              </div>
            </div>
          </div>

          {/* Core Interactive Race Canvas */}
          <div className="relative border border-slate-800 rounded-lg overflow-hidden bg-slate-950 flex justify-center" id="race_stage">
            <canvas
              ref={canvasRef}
              className="w-full aspect-[8/5] bg-transparent"
              style={{ maxWidth: '800px' }}
            />

            {/* If our local player successfully crossed lines */}
            {myPlayerRef.current.finished && (
              <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center text-center animate-fade-in z-20" id="goal_complete_overlay">
                <Trophy className="text-amber-400 w-16 h-16 mb-4 animate-bounce" />
                <h2 className="text-3xl font-extrabold text-white tracking-tight">FINISHED RALLY!</h2>
                <p className="text-amber-300 mt-2 font-mono text-lg font-bold">PLACEMENT: #{myPlayerRef.current.finishPlacement}</p>
                <p className="text-slate-400 mt-1 font-mono text-sm">Synchronizing results... stand by for GP rankings</p>
              </div>
            )}
          </div>

          {/* Quick instructions footers info */}
          <div className="flex flex-wrap gap-4 items-center justify-between mt-4 text-xs text-slate-400 pt-2 border-t border-slate-800" id="controls_legend">
            <div className="flex items-center gap-2">
              <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-200">A / D / Arrow Keys</span>
              <span>Move Left & Right</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-200">Space / W / Up</span>
              <span>Jump (Press twice for double-jump)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-slate-800 px-2 py-0.5 rounded text-amber-300 font-bold font-mono">F Key</span>
              <span>Shove near opponents</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Standings sidebar column */}
      <div className="w-full lg:w-80 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 p-6 flex flex-col justify-between" id="leaderboard_column">
        <div id="leaderboard_sub_panel">
          <div className="flex items-center gap-2 mb-6" id="sb_head">
            <Users className="text-sky-400 w-5 h-5" />
            <h2 className="text-lg font-bold">Lobby Competitors</h2>
          </div>

          {/* Live Progress table of players */}
          <div className="space-y-3" id="live_progress_box">
            {players.map((plyr, idx) => {
              const pPercent = Math.min(100, Math.round((plyr.x_position / 4800) * 100));
              const isSelf = plyr.id === currentUserId;

              return (
                <div
                  key={plyr.id}
                  className={`p-3 rounded-lg border flex flex-col gap-2 ${
                    isSelf ? 'bg-emerald-950/40 border-emerald-800/60' : 'bg-slate-950/60 border-slate-800/40'
                  }`}
                  id={`plyr_row_${plyr.id}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm truncate flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isSelf ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                      {plyr.username}
                      {isSelf && <span className="text-[10px] bg-emerald-800 text-emerald-200 px-1 py-0.2 rounded font-mono">YOU</span>}
                    </span>
                    {plyr.finished ? (
                      <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-bold">FINISHED</span>
                    ) : (
                      <span className="text-xs font-mono font-semibold text-slate-400">{pPercent}%</span>
                    )}
                  </div>

                  {/* Visual mini progress track bar */}
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden" id="bar_cont">
                    <div
                      className={`h-full transition-all duration-300 ${isSelf ? 'bg-emerald-400' : 'bg-sky-400'}`}
                      style={{ width: `${pPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Simple local round summary stats info */}
          <div className="mt-8 pt-6 border-t border-slate-800 space-y-4" id="stat_indicators">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">YOUR PERFORMANCE</h3>
            
            <div className="grid grid-cols-2 gap-3" id="sub_stat_grid">
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-center">
                <span className="text-xs text-slate-400 block font-mono">FAILURES</span>
                <span className="text-lg font-bold text-red-400 font-mono">{statsSummary.deaths}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-center">
                <span className="text-xs text-slate-400 block font-mono">SHOVES</span>
                <span className="text-lg font-bold text-sky-400 font-mono">{statsSummary.shoves}</span>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">CHECKPOINT</span>
              <span className="text-xs text-slate-200 font-semibold truncate max-w-[130px]">{statsSummary.checkpoint}</span>
            </div>
          </div>
        </div>

        {/* Action Controls Column Footer */}
        <div className="pt-6 border-t border-slate-800" id="exit_lobby_panel">
          <button
            onClick={async () => {
              if (confirm('Are you sure you want to abandon the match?')) {
                await leaveRoom();
                window.location.hash = '';
                window.location.pathname = '/';
              }
            }}
            className="w-full flex items-center justify-center gap-2 bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 border border-rose-900/50 py-2.5 px-4 rounded-lg transition-colors text-sm font-semibold"
            id="btn_abort_match"
          >
            <ArrowLeft className="w-4 h-4" />
            Quit Match
          </button>
        </div>
      </div>
    </div>
  );
}
