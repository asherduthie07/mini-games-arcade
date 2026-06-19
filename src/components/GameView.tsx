import React, { useEffect, useRef, useState } from 'react';
import { useGameStore, Player } from '../useGameStore';
import { playCrashSound, playBoostSound, playVictorySound } from '../utils/audio';
import { Trophy, ArrowLeft, Zap, Orbit, Compass, Volume2 } from 'lucide-react';
import { motion } from 'motion/react';

interface GameViewProps {
  code: string;
}

// Predefined deterministic obstacles (y-coordinate, base x-position, horizontal amplitude, horizontal speed, width, height)
interface Obstacle {
  id: number;
  y: number;
  xBase: number;
  amp: number;
  speed: number;
  w: number;
  h: number;
  style: string; // 'neon-red' | 'cyber-barrier' | 'debris' | 'asteroid' | 'floor-gap' | 'high-wall' | 'low-hurdle' | 'energy-gate'
}

// 1. Obstacle Dash Obstacles
const OBSTACLES_OBSTACLE_DASH: Obstacle[] = [
  { id: 1, y: 2400, xBase: 350, amp: 100, speed: 0.002, w: 90, h: 24, style: 'cyber-barrier' },
  { id: 2, y: 2200, xBase: 450, amp: 120, speed: 0.003, w: 80, h: 20, style: 'neon-red' },
  { id: 3, y: 2000, xBase: 250, amp: 80, speed: 0.0025, w: 100, h: 24, style: 'debris' },
  { id: 4, y: 1800, xBase: 400, amp: 160, speed: 0.004, w: 120, h: 24, style: 'neon-red' },
  { id: 5, y: 1600, xBase: 300, amp: 140, speed: 0.005, w: 80, h: 28, style: 'cyber-barrier' },
  { id: 6, y: 1400, xBase: 500, amp: 180, speed: 0.0035, w: 110, h: 20, style: 'debris' },
  { id: 7, y: 1100, xBase: 400, amp: 200, speed: 0.006, w: 140, h: 24, style: 'neon-red' },
  { id: 8, y: 900, xBase: 300, amp: 180, speed: 0.0055, w: 100, h: 24, style: 'cyber-barrier' },
  { id: 9, y: 700, xBase: 450, amp: 220, speed: 0.007, w: 130, h: 24, style: 'neon-red' },
  { id: 10, y: 450, xBase: 350, amp: 120, speed: 0.008, w: 150, h: 30, style: 'cyber-barrier' },
];

// 2. Space Dodge Obstacles (Asteroids)
const OBSTACLES_SPACE_DODGE: Obstacle[] = [
  { id: 201, y: 2500, xBase: 200, amp: 110, speed: 0.002, w: 45, h: 45, style: 'asteroid' },
  { id: 202, y: 2300, xBase: 500, amp: 130, speed: 0.003, w: 50, h: 50, style: 'asteroid' },
  { id: 203, y: 2100, xBase: 350, amp: 120, speed: 0.0015, w: 60, h: 60, style: 'asteroid' },
  { id: 204, y: 1900, xBase: 600, amp: 90, speed: 0.004, w: 40, h: 40, style: 'asteroid' },
  { id: 205, y: 1700, xBase: 150, amp: 150, speed: 0.0025, w: 55, h: 55, style: 'asteroid' },
  { id: 206, y: 1500, xBase: 400, amp: 100, speed: 0.0035, w: 52, h: 52, style: 'asteroid' },
  { id: 207, y: 1300, xBase: 250, amp: 140, speed: 0.005, w: 42, h: 42, style: 'asteroid' },
  { id: 208, y: 1100, xBase: 550, amp: 90, speed: 0.002, w: 65, h: 65, style: 'asteroid' },
  { id: 209, y: 900, xBase: 300, amp: 170, speed: 0.004, w: 45, h: 45, style: 'asteroid' },
  { id: 210, y: 700, xBase: 450, amp: 120, speed: 0.003, w: 48, h: 48, style: 'asteroid' },
  { id: 211, y: 500, xBase: 350, amp: 160, speed: 0.006, w: 55, h: 55, style: 'asteroid' },
];

// 3. Neon Coin Rush Obstacles
const OBSTACLES_NEON_COIN_RUSH: Obstacle[] = [
  { id: 301, y: 2400, xBase: 300, amp: 70, speed: 0.001, w: 80, h: 20, style: 'energy-gate' },
  { id: 302, y: 2100, xBase: 500, amp: 90, speed: 0.002, w: 90, h: 20, style: 'energy-gate' },
  { id: 303, y: 1800, xBase: 250, amp: 85, speed: 0.0015, w: 80, h: 20, style: 'energy-gate' },
  { id: 304, y: 1500, xBase: 450, amp: 110, speed: 0.002, w: 100, h: 20, style: 'energy-gate' },
  { id: 305, y: 1200, xBase: 350, amp: 95, speed: 0.0025, w: 85, h: 20, style: 'energy-gate' },
  { id: 306, y: 900, xBase: 550, amp: 120, speed: 0.0018, w: 90, h: 20, style: 'energy-gate' },
  { id: 307, y: 600, xBase: 300, amp: 130, speed: 0.003, w: 120, h: 20, style: 'energy-gate' },
];

// 4. Parkour Extreme Obstacles (Gaps and Walls)
const OBSTACLES_PARKOUR: Obstacle[] = [
  { id: 401, y: 2500, xBase: 400, amp: 0, speed: 0, w: 200, h: 70, style: 'floor-gap' },
  { id: 402, y: 2300, xBase: 255, amp: 0, speed: 0, w: 110, h: 24, style: 'low-hurdle' },
  { id: 403, y: 2100, xBase: 545, amp: 0, speed: 0, w: 110, h: 24, style: 'high-wall' },
  { id: 404, y: 1900, xBase: 305, amp: 0, speed: 0, w: 240, h: 80, style: 'floor-gap' },
  { id: 405, y: 1700, xBase: 450, amp: 115, speed: 0.002, w: 100, h: 20, style: 'low-hurdle' },
  { id: 406, y: 1500, xBase: 355, amp: 0, speed: 0, w: 180, h: 24, style: 'high-wall' },
  { id: 407, y: 1300, xBase: 400, amp: 0, speed: 0, w: 260, h: 90, style: 'floor-gap' },
  { id: 408, y: 1105, xBase: 250, amp: 0, speed: 0, w: 120, h: 20, style: 'low-hurdle' },
  { id: 409, y: 905, xBase: 505, amp: 95, speed: 0.003, w: 100, h: 20, style: 'low-hurdle' },
  { id: 410, y: 650, xBase: 400, amp: 0, speed: 0, w: 300, h: 110, style: 'floor-gap' },
];

const getActiveObstacles = (gameMode: string): Obstacle[] => {
  if (gameMode === 'Space Dodge') return OBSTACLES_SPACE_DODGE;
  if (gameMode === 'Neon Coin Rush') return OBSTACLES_NEON_COIN_RUSH;
  if (gameMode === 'Parkour Extreme') return OBSTACLES_PARKOUR;
  return OBSTACLES_OBSTACLE_DASH;
};

// Predefined deterministic powerups [ {id, x, y, collected} ]
interface PowerBoost {
  id: number;
  x: number;
  y: number;
  type: 'speed' | 'shield' | 'coin' | 'parkour-boost';
}

const CONSTS_BOOSTS_DASH: PowerBoost[] = [
  { id: 101, x: 250, y: 2500, type: 'speed' },
  { id: 102, x: 550, y: 2100, type: 'speed' },
  { id: 103, x: 300, y: 1700, type: 'speed' },
  { id: 104, x: 450, y: 1250, type: 'speed' },
  { id: 105, x: 350, y: 800, type: 'speed' },
  { id: 106, x: 500, y: 500, type: 'speed' },
];

const CONSTS_BOOSTS_SPACE: PowerBoost[] = [
  { id: 501, x: 200, y: 2400, type: 'shield' },
  { id: 502, x: 600, y: 2100, type: 'shield' },
  { id: 503, x: 400, y: 1800, type: 'shield' },
  { id: 504, x: 300, y: 1300, type: 'shield' },
  { id: 505, x: 500, y: 900, type: 'shield' },
  { id: 506, x: 250, y: 600, type: 'shield' },
];

const CONSTS_BOOSTS_COINS: PowerBoost[] = [
  { id: 601, x: 250, y: 2605, type: 'coin' },
  { id: 602, x: 250, y: 2555, type: 'coin' },
  { id: 603, x: 250, y: 2505, type: 'coin' },
  { id: 604, x: 550, y: 2305, type: 'coin' },
  { id: 605, x: 550, y: 2255, type: 'coin' },
  { id: 606, x: 550, y: 2205, type: 'coin' },
  { id: 607, x: 400, y: 2005, type: 'coin' },
  { id: 608, x: 400, y: 1955, type: 'coin' },
  { id: 609, x: 400, y: 1905, type: 'coin' },
  { id: 610, x: 300, y: 1605, type: 'coin' },
  { id: 611, x: 320, y: 1555, type: 'coin' },
  { id: 612, x: 340, y: 1505, type: 'coin' },
  { id: 613, x: 500, y: 1305, type: 'coin' },
  { id: 614, x: 480, y: 1255, type: 'coin' },
  { id: 615, x: 460, y: 1205, type: 'coin' },
  { id: 616, x: 350, y: 905, type: 'coin' },
  { id: 617, x: 350, y: 855, type: 'coin' },
  { id: 618, x: 350, y: 805, type: 'coin' },
  { id: 619, x: 450, y: 605, type: 'coin' },
  { id: 620, x: 450, y: 555, type: 'coin' },
  { id: 621, x: 450, y: 505, type: 'coin' },
];

const CONSTS_BOOSTS_PARKOUR: PowerBoost[] = [
  { id: 701, x: 400, y: 2600, type: 'parkour-boost' },
  { id: 702, x: 300, y: 2000, type: 'parkour-boost' },
  { id: 703, x: 500, y: 1450, type: 'parkour-boost' },
  { id: 704, x: 400, y: 800, type: 'parkour-boost' },
];

const getActiveBoosts = (gameMode: string): PowerBoost[] => {
  if (gameMode === 'Space Dodge') return CONSTS_BOOSTS_SPACE;
  if (gameMode === 'Neon Coin Rush') return CONSTS_BOOSTS_COINS;
  if (gameMode === 'Parkour Extreme') return CONSTS_BOOSTS_PARKOUR;
  return CONSTS_BOOSTS_DASH;
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

  // Local physical states for the local player's car
  const myPlayerRef = useRef<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    heading: number;
    boostTimer: number;
    crashTimer: number;
    finished: boolean;
    score: number;
    z: number;
    jumpTimer: number;
  }>({
    x: 400,
    y: 2850,
    vx: 0,
    vy: 0,
    heading: 0,
    boostTimer: 0,
    crashTimer: 0,
    finished: false,
    score: 0,
    z: 0,
    jumpTimer: 0
  });

  // Track player inputs
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // Interpolated visual vectors for other players to eliminate network jitter
  const interpolationsRef = useRef<{
    [id: string]: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      finished: boolean;
      score: number;
      z: number;
    };
  }>({});

  // Local list of active boosts to hide once collected
  const [collectedBoostIds, setCollectedBoostIds] = useState<Set<number>>(new Set());
  const [speedVal, setSpeedVal] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(30);

  // Initialize and synchronize game mode values
  useEffect(() => {
    const gameMode = room?.current_game || 'Obstacle Dash';
    if (gameMode === 'Space Dodge') {
      myPlayerRef.current.score = 1000; // Start with full shields
    } else {
      myPlayerRef.current.score = 0; // Coins or normal start at 0
    }
  }, [room?.current_game]);

  // Space Dodge countdown timer logic
  useEffect(() => {
    const gameMode = room?.current_game || 'Obstacle Dash';
    if (gameMode !== 'Space Dodge') return;

    setSecondsLeft(30);

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          
          if (!myPlayerRef.current.finished) {
            myPlayerRef.current.finished = true;
            playVictorySound();
            updatePlayerPosition(myPlayerRef.current.x, myPlayerRef.current.y, 0, 0, true, myPlayerRef.current.score);
            
            sendGameEvent('race_complete', {
              username: username,
              finishTime: Date.now(),
              score: myPlayerRef.current.score
            });

            setTimeout(() => {
              window.history.pushState(null, '', `/results/${code}`);
              window.dispatchEvent(new Event('pushstate'));
            }, 3000);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [room?.current_game, updatePlayerPosition, sendGameEvent, username, code]);

  // Keyboard Event Handlers
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

  // Sync Positions over Supabase Realtime at 10Hz (once every 100ms)
  useEffect(() => {
    const syncInterval = setInterval(() => {
      const my = myPlayerRef.current;
      if (my.finished) return; // Wait to submit final finish results

      updatePlayerPosition(my.x, my.y, my.vx, my.vy, my.finished, my.score, my.z);
    }, 100);

    return () => clearInterval(syncInterval);
  }, [updatePlayerPosition]);

  // Main 60 FPS Game Loop
  useEffect(() => {
    let animationId: number;

    const gameLoop = () => {
      updatePhysics();
      drawGame();
      animationId = requestAnimationFrame(gameLoop);
    };

    // Physics Engine Handler
    const updatePhysics = () => {
      const my = myPlayerRef.current;
      const keys = keysPressed.current;
      const gameMode = room?.current_game || 'Obstacle Dash';

      // Handle timers
      if (my.boostTimer > 0) my.boostTimer--;
      if (my.crashTimer > 0) my.crashTimer--;

      // Handle Jump states (Support space key for jump in all modes, essential in Parkour Extreme)
      const isSpacePressed = keys[' '] || keys['Spacebar'] || keys['space'];
      if (isSpacePressed && my.z === 0 && my.crashTimer <= 0) {
        my.jumpTimer = 32; // Jump duration in frames
        // Quick high-pitched jump sound
        try {
          const sCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = sCtx.createOscillator();
          const gainNode = sCtx.createGain();
          osc.connect(gainNode);
          gainNode.connect(sCtx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(400, sCtx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(750, sCtx.currentTime + 0.15);
          gainNode.gain.setValueAtTime(0.08, sCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, sCtx.currentTime + 0.15);
          osc.start();
          osc.stop(sCtx.currentTime + 0.15);
        } catch (e) {}
      }

      if (my.jumpTimer > 0) {
        my.jumpTimer--;
        my.z = Math.sin((my.jumpTimer / 32) * Math.PI) * 45; // Altitude parabolic curve peaks at 45 px
      } else {
        my.z = 0;
      }

      // If finished, decay speed
      if (my.finished) {
        my.vy *= 0.95;
        my.vx *= 0.95;
        my.x += my.vx;
        my.y += my.vy;
        return;
      }

      // 1. Steering & Lateral Displacement controls
      let steerInput = 0;
      if (keys['ArrowLeft'] || keys['a'] || keys['A']) steerInput = -1;
      if (keys['ArrowRight'] || keys['d'] || keys['D']) steerInput = 1;

      // Rotate tires slightly or update steer vector
      const currentMaxSteer = my.crashTimer > 0 ? 1 : (my.boostTimer > 0 ? 9 : 6.5);
      my.vx = steerInput * currentMaxSteer;

      // 2. Acceleration / progression controls
      let accelInput = 0;
      if (keys['ArrowUp'] || keys['w'] || keys['W']) accelInput = 1;
      if (keys['ArrowDown'] || keys['s'] || keys['S']) accelInput = -0.5;

      const baseAccelSpeed = 0.35;
      const friction = 0.08;

      if (my.crashTimer > 0) {
        // Recover gradually during recovery timer
        my.vy *= 0.9;
      } else {
        // Accelerate
        const maxScrollRate = my.boostTimer > 0 ? -19 : -12.5;
        my.vy += accelInput * -baseAccelSpeed;
        my.vy = Math.max(maxScrollRate, Math.min(0, my.vy * (1 - friction)));
      }

      // Apply positional changes
      my.x += my.vx;
      my.y += my.vy;

      // Bound car to standard neon lane constraints (left: 100px, right: 700px)
      my.x = Math.max(120, Math.min(680, my.x));

      // 3. Evaluate deterministic obstacle boundary-checks (Local Authority)
      const obstacleHit = checkCollisions(my.x, my.y);
      if (obstacleHit && my.crashTimer <= 0) {
        my.crashTimer = 90; // Frame buffer recovery timer (1.5 seconds)
        my.boostTimer = 0; // Cancel current gains
        my.vy = -1.5; // Drag down speed instantly
        
        if (gameMode === 'Space Dodge') {
          my.score = Math.max(0, my.score - 150);
        }

        playCrashSound();
        sendGameEvent('crash', { username });
      }

      // 4. Evaluate Power boosts collections
      const collectedBoost = checkBoostOverlaps(my.x, my.y);
      if (collectedBoost !== null) {
        my.boostTimer = 150; // Active speed pad frame loop (2.5 seconds)
        
        if (gameMode === 'Space Dodge') {
          my.score = Math.min(1000, my.score + 100);
        } else if (gameMode === 'Neon Coin Rush') {
          my.score += 10;
        } else if (gameMode === 'Parkour Extreme') {
          my.score += 15; // points for parkour acrobatics or collecting stars
        }

        playBoostSound();
        setCollectedBoostIds(prev => {
          const updated = new Set(prev);
          updated.add(collectedBoost);
          return updated;
        });
      }

      // 5. Evaluate Finish Gate vs Looping
      const isSpaceDodge = gameMode === 'Space Dodge';
      if (isSpaceDodge) {
        if (my.y <= 245) {
          // Reset y and let boosts reborn on the looping canvas
          my.y = 2800;
          setCollectedBoostIds(new Set());
        }
      } else {
        if (my.y <= 180 && !my.finished) {
          my.finished = true;
          playVictorySound();
          // Submit final authoritative data with score
          updatePlayerPosition(my.x, my.y, 0, 0, true, my.score, my.z);
          
          // Notify lobby victory
          sendGameEvent('race_complete', {
            username: username,
            finishTime: Date.now(),
            score: my.score
          });
          
          // Push user to results screen
          setTimeout(() => {
            window.history.pushState(null, '', `/results/${code}`);
            window.dispatchEvent(new Event('pushstate'));
          }, 3000);
        }
      }

      // Set visible speedometer value (relative)
      setSpeedVal(Math.round(Math.abs(my.vy) * 15));
    };

    // Local Helper to determine rect overlaps with altitude (z) jump height considerations
    const checkCollisions = (cx: number, cy: number): boolean => {
      const nowTime = Date.now();
      const carW = 32;
      const carH = 50;
      const my = myPlayerRef.current;
      const gameMode = room?.current_game || 'Obstacle Dash';
      const obstacles = getActiveObstacles(gameMode);

      for (const obs of obstacles) {
        // Moving displacement matching drawing loop
        const dx = obs.amp > 0 ? Math.sin(nowTime * obs.speed + obs.id) * obs.amp : 0;
        const currentObsX = obs.xBase + dx;

        // Perform standard AABB collision checking
        if (
          cx + carW / 2 > currentObsX - obs.w / 2 &&
          cx - carW / 2 < currentObsX + obs.w / 2 &&
          cy + carH / 2 > obs.y - obs.h / 2 &&
          cy - carH / 2 < obs.y + obs.h / 2
        ) {
          // If we are currently in the air jumping, we can bypass obstacles that are on the ground Level!
          if (my.z > 10) {
            // Can jump over gaps, low safety hurdles, asteroids, or static ground panels.
            // High Walls CANNOT be jumped over!
            if (obs.style !== 'high-wall') {
              continue;
            }
          }
          return true;
        }
      }
      return false;
    };

    const checkBoostOverlaps = (cx: number, cy: number): number | null => {
      const carRadius = 25;
      const gameMode = room?.current_game || 'Obstacle Dash';
      const boosts = getActiveBoosts(gameMode);

      for (const b of boosts) {
        if (collectedBoostIds.has(b.id)) continue;

        const distance = Math.hypot(cx - b.x, cy - b.y);
        if (distance < carRadius + 18) {
          return b.id;
        }
      }
      return null;
    };

    // RENDERING PIPELINE
    const drawGame = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const my = myPlayerRef.current;

      // Set canvas drawing dimensions from client boundaries
      const clientW = canvas.parentElement?.clientWidth || 600;
      canvas.width = 800; // Reference width
      canvas.height = 700; // Reference height

      // Camera Y scroll tracking
      const camY = my.y - 480;

      // 1. Draw track walls & road canvas
      ctx.fillStyle = '#fcfbf9';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid helper details
      ctx.strokeStyle = 'rgba(120, 113, 108, 0.06)';
      ctx.lineWidth = 1;
      for (let x = 100; x < 700; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      const gridOffset = Math.floor(camY) % 40;
      for (let y = -gridOffset; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(100, y);
        ctx.lineTo(700, y);
        ctx.stroke();
      }

      // Neon Lane Sidewalls
      ctx.lineWidth = 3;
      const gameMode = room?.current_game || 'Obstacle Dash';
      
      if (gameMode === 'Space Dodge') {
        ctx.strokeStyle = '#7c3aed'; // Purple
      } else if (gameMode === 'Neon Coin Rush') {
        ctx.strokeStyle = '#059669'; // Emerald
      } else {
        ctx.strokeStyle = '#292524'; // Stone-800
      }
      
      ctx.beginPath();
      ctx.moveTo(100, 0);
      ctx.lineTo(100, canvas.height);
      ctx.moveTo(700, 0);
      ctx.lineTo(700, canvas.height);
      ctx.stroke();

      // Warning dashes
      if (gameMode === 'Space Dodge') {
        ctx.fillStyle = 'rgba(124, 58, 237, 0.1)';
      } else if (gameMode === 'Neon Coin Rush') {
        ctx.fillStyle = 'rgba(5, 150, 105, 0.1)';
      } else {
        ctx.fillStyle = 'rgba(120, 113, 108, 0.08)';
      }

      for (let y = 0; y < 3000; y += 120) {
        const renderYOffset = y - camY;
        if (renderYOffset > -50 && renderYOffset < canvas.height + 50) {
          ctx.fillRect(95, renderYOffset, 10, 30);
          ctx.fillRect(695, renderYOffset, 10, 30);
        }
      }

      // 2. Draw Start/Finish lines (omitted in Space Dodge Survival)
      if (gameMode !== 'Space Dodge') {
        const finishY = 180 - camY;
        ctx.fillStyle = '#059669';
        ctx.fillRect(100, finishY - 5, 600, 10);
        
        // Checkerboard finish pattern
        ctx.fillStyle = '#1c1917';
        for (let cx = 100; cx < 700; cx += 30) {
          if (Math.floor(cx / 30) % 2 === 0) {
            ctx.fillRect(cx, finishY - 5, 15, 10);
          }
        }
      }

      // 3. Draw Deterministic Power Boost nodes
      const activeBoostsList = getActiveBoosts(gameMode);
      for (const b of activeBoostsList) {
        if (collectedBoostIds.has(b.id)) continue;

        const by = b.y - camY;
        if (by > -30 && by < canvas.height + 30) {
          if (b.type === 'coin') {
            // Draw a shiny gold coin
            ctx.beginPath();
            ctx.arc(b.x, by, 10, 0, Math.PI * 2);
            ctx.fillStyle = '#f59e0b'; // Amber-500
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Inner circle
            ctx.beginPath();
            ctx.arc(b.x, by, 6, 0, Math.PI * 2);
            ctx.strokeStyle = '#dfa207';
            ctx.lineWidth = 1;
            ctx.stroke();
          } else if (b.type === 'shield') {
            // Draw purple shield
            ctx.beginPath();
            ctx.arc(b.x, by, 12, 0, Math.PI * 2);
            ctx.fillStyle = '#8b5cf6'; // Violet-500
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // S letter indicator symbol
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🛡️', b.x, by);
          } else if (b.type === 'parkour-boost') {
            // Draw cute neon blue spring/feather jump pad
            ctx.beginPath();
            ctx.arc(b.x, by, 12, 0, Math.PI * 2);
            ctx.fillStyle = '#06b6d4'; // Cyan-500
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⚡', b.x, by);
          } else {
            // Speed pad style
            ctx.beginPath();
            ctx.arc(b.x, by, 12, 0, Math.PI * 2);
            ctx.fillStyle = '#059669';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Speed chevron design
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(b.x - 4, by + 4);
            ctx.lineTo(b.x, by - 4);
            ctx.lineTo(b.x + 4, by + 4);
            ctx.closePath();
            ctx.fill();
          }
        }
      }

      // 4. Draw Deterministic Moving Obstacles (Dynamic based on selected active arena)
      const nowTime = Date.now();
      const currentObstaclesList = getActiveObstacles(gameMode);
      for (const obs of currentObstaclesList) {
        const oy = obs.y - camY;
        if (oy > -100 && oy < canvas.height + 100) {
          // Floating wave equation (if amplitude > 0)
          const dx = obs.amp > 0 ? Math.sin(nowTime * obs.speed + obs.id) * obs.amp : 0;
          const currentObsX = obs.xBase + dx;

          if (obs.style === 'asteroid') {
            // Draw cool detailed asteroid
            ctx.beginPath();
            ctx.arc(currentObsX, oy, obs.w / 2, 0, Math.PI * 2);
            ctx.fillStyle = '#4a2511'; // brownish asteroid
            ctx.fill();
            ctx.strokeStyle = '#ea580c'; // fiery borders
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw craters
            ctx.fillStyle = '#2d1508';
            ctx.beginPath();
            ctx.arc(currentObsX - obs.w / 5, oy - obs.h / 5, obs.w / 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(currentObsX + obs.w / 4, oy + obs.h / 6, obs.w / 6, 0, Math.PI * 2);
            ctx.fill();
          } else if (obs.style === 'floor-gap') {
            // Draw a bottomless pit in the track floor (must jump over!)
            ctx.fillStyle = '#1c1917'; // track background
            ctx.fillRect(currentObsX - obs.w / 2, oy - obs.h / 2, obs.w, obs.h);
            
            // Draw hazard glowing yellow/orange dashed boundaries
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 3;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(currentObsX - obs.w / 2, oy - obs.h / 2, obs.w, obs.h);
            ctx.setLineDash([]); // clear dash

            // Draw text warning "GAP!" if screen size allows
            ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('⚠️ CHASM ⚠️', currentObsX, oy + 3);
          } else if (obs.style === 'high-wall') {
            // Huge orange glowing hazard wall
            ctx.fillStyle = '#ea580c';
            ctx.fillRect(currentObsX - obs.w / 2, oy - obs.h / 2, obs.w, obs.h);

            // Highlight border
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(currentObsX - obs.w / 2, oy - obs.h / 2, obs.w, obs.h);

            // Hazard lines
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            for (let xl = currentObsX - obs.w / 2; xl < currentObsX + obs.w / 2; xl += 15) {
              ctx.moveTo(xl, oy - obs.h / 2);
              ctx.lineTo(xl + 10, oy + obs.h / 2);
            }
            ctx.stroke();
          } else if (obs.style === 'low-hurdle') {
            // Yellow warning hurdle
            ctx.fillStyle = '#eab308';
            ctx.beginPath();
            ctx.roundRect(currentObsX - obs.w / 2, oy - obs.h / 2, obs.w, obs.h, 4);
            ctx.fill();
            
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.strokeRect(currentObsX - obs.w / 2, oy - obs.h / 2, obs.w, obs.h);

            ctx.fillStyle = '#000';
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('JUMP OVER', currentObsX, oy + 3);
          } else if (obs.style === 'energy-gate') {
            // Cyan glowing energy gate
            ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
            ctx.fillRect(currentObsX - obs.w / 2, oy - obs.h / 2, obs.w, obs.h);

            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 3;
            ctx.strokeRect(currentObsX - obs.w / 2, oy - obs.h / 2, obs.w, obs.h);
          } else {
            // Obstacle Dash styles
            ctx.fillStyle = obs.style === 'neon-red' ? '#78716c' : (obs.style === 'cyber-barrier' ? '#44403c' : '#a8a29e');
            ctx.beginPath();
            ctx.roundRect(currentObsX - obs.w / 2, oy - obs.h / 2, obs.w, obs.h, 6);
            ctx.fill();

            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // 5. Draw REST OF PLAYERS (Interpolated target positions)
      players.forEach((plyr) => {
        if (plyr.id === currentUserId) return; // Wait to paint ourselves last for proper overlays

        let lerpObj = interpolationsRef.current[plyr.id];
        if (!lerpObj) {
          interpolationsRef.current[plyr.id] = {
            x: plyr.x_position,
            y: plyr.y_position,
            vx: plyr.velocity?.x || 0,
            vy: plyr.velocity?.y || 0,
            finished: plyr.finished,
            score: plyr.score || 0,
            z: plyr.velocity?.z || 0
          };
          lerpObj = interpolationsRef.current[plyr.id];
        } else {
          // Linear interpolation coefficient towards updated target
          lerpObj.x += (plyr.x_position - lerpObj.x) * 0.18;
          lerpObj.y += (plyr.y_position - lerpObj.y) * 0.18;
          lerpObj.vx += ((plyr.velocity?.x || 0) - lerpObj.vx) * 0.18;
          lerpObj.vy += ((plyr.velocity?.y || 0) - lerpObj.vy) * 0.18;
          lerpObj.z += ((plyr.velocity?.z || 0) - lerpObj.z) * 0.18;
          lerpObj.finished = plyr.finished;
          lerpObj.score = plyr.score || 0;
        }

        const ry = lerpObj.y - camY;
        if (ry > -50 && ry < canvas.height + 50) {
          drawCarObject(ctx, lerpObj.x, ry, plyr.username, false, !!plyr.finished, false, 0, lerpObj.z);
        }
      });

      // 6. Draw LOCAL PLAYER
      const localRy = my.y - camY;
      drawCarObject(
        ctx,
        my.x,
        localRy,
        username,
        true,
        my.finished,
        my.crashTimer > 0,
        my.boostTimer,
        my.z
      );
    };

    // Core Car Drawer SVG pipeline with jump height (z) rendering support
    const drawCarObject = (
      ctx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      uName: string,
      isSelf: boolean,
      finished: boolean,
      crashed: boolean,
      boostFrames: number,
      z = 0
    ) => {
      ctx.save();

      // Draw Ground Shadow under the car based on altitude altitude
      const shadowScale = Math.max(0.3, 1 - z / 85);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 14 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      const renderY = cy - z;

      // Jet engines visual particles trailing behind
      if (Math.abs(myPlayerRef.current.vy) > 2) {
        ctx.fillStyle = boostFrames > 0 ? '#10b981' : '#78716c';
        const trailLength = boostFrames > 0 ? 15 : 8;
        ctx.fillRect(cx - 8, renderY + 25, 4, trailLength);
        ctx.fillRect(cx + 4, renderY + 25, 4, trailLength);
      }

      // Base body color
      ctx.fillStyle = isSelf ? '#1c1917' : '#78716c'; // Dark slate charcoal self, warm gray team
      if (crashed) {
        ctx.fillStyle = '#a8a29e'; // Grey debris
      }
      if (finished) {
        ctx.fillStyle = '#059669'; // Green victory
      }

      // Main Capsule shape
      ctx.beginPath();
      ctx.roundRect(cx - 15, renderY - 25, 30, 50, 4);
      ctx.fill();

      // Tires
      ctx.fillStyle = '#292524';
      ctx.fillRect(cx - 17, renderY - 18, 3, 8);
      ctx.fillRect(cx + 14, renderY - 18, 3, 8);
      ctx.fillRect(cx - 17, renderY + 8, 3, 8);
      ctx.fillRect(cx + 14, renderY + 8, 3, 8);

      // Windshield glass
      ctx.fillStyle = '#f5f5f4';
      ctx.beginPath();
      ctx.roundRect(cx - 9, renderY - 12, 18, 14, 1);
      ctx.fill();

      // High-contrast custom label tag
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 11px system-ui, sans-serif';
      const measure = ctx.measureText(uName);
      ctx.fillRect(cx - measure.width / 2 - 4, renderY - 44, measure.width + 8, 16);

      ctx.strokeStyle = 'rgba(120, 113, 108, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - measure.width / 2 - 4, renderY - 44, measure.width + 8, 16);

      ctx.fillStyle = '#1c1917';
      ctx.textAlign = 'center';
      ctx.fillText(uName, cx, renderY - 32);

      // Glowing powerup halo
      if (boostFrames > 0) {
        ctx.strokeStyle = 'rgba(5, 150, 105, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, renderY, 32, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    };

    gameLoop();
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [players, collectedBoostIds]);

  const handleReturnToLobby = async () => {
    await leaveRoom();
    window.history.pushState(null, '', '/');
    window.dispatchEvent(new Event('pushstate'));
  };

  // Compile real distance completion calculations
  const myY = myPlayerRef.current.y;
  const progressPercent = Math.max(0, Math.min(100, Math.round(((2850 - myY) / 2670) * 100)));

  // Live sidebar leaderboard
  interface LeaderboardEntry {
    name: string;
    progress: number;
    finished: boolean;
    score: number;
    isSelf: boolean;
  }

  const gameMode = room?.current_game || 'Obstacle Dash';

  const sortedLeadboard: LeaderboardEntry[] = players
    .map(p => {
      const isSelf = p.id === currentUserId;
      let playerY = p.y_position;
      let playerScore = p.score || 0;
      
      if (isSelf) {
        playerY = myPlayerRef.current.y;
        playerScore = myPlayerRef.current.score;
      }

      const pct = Math.max(0, Math.min(100, Math.round(((2850 - playerY) / 2670) * 100)));
      return {
        name: p.username,
        progress: pct,
        finished: isSelf ? myPlayerRef.current.finished : p.finished,
        score: playerScore,
        isSelf
      };
    })
    .sort((a, b) => {
      if (gameMode === 'Space Dodge') {
        const aFinDef = a.finished ? 1 : 0;
        const bFinDef = b.finished ? 1 : 0;
        if (aFinDef !== bFinDef) return bFinDef - aFinDef;
        return b.score - a.score;
      } else if (gameMode === 'Neon Coin Rush') {
        const aFinDef = a.finished ? 1 : 0;
        const bFinDef = b.finished ? 1 : 0;
        if (aFinDef !== bFinDef) return bFinDef - aFinDef;
        if (b.score !== a.score) return b.score - a.score;
        return b.progress - a.progress;
      } else {
        const aFinDef = a.finished ? 1 : 0;
        const bFinDef = b.finished ? 1 : 0;
        if (aFinDef !== bFinDef) return bFinDef - aFinDef;
        return b.progress - a.progress;
      }
    });

  return (
    <div ref={containerRef} className="w-full max-w-7xl mx-auto p-4 md:py-8 text-stone-800 min-h-[85vh]">
      
      {/* Game navigation banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <button
            onClick={handleReturnToLobby}
            className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-750 transition-colors mb-2"
          >
            <ArrowLeft size={12} /> Disconnect from session
          </button>
          
          <h1 className="text-xl md:text-2xl font-bold uppercase tracking-tight flex items-center gap-2 text-stone-950">
            <Orbit className={`${gameMode === 'Space Dodge' ? 'text-stone-600' : (gameMode === 'Neon Coin Rush' ? 'text-stone-600' : 'text-stone-900')} animate-spin`} style={{ animationDuration: '6s' }} size={20} />
            {gameMode}
          </h1>
          <p className="text-xs text-stone-500 font-light max-w-xl">
            {gameMode === 'Space Dodge'
              ? 'Survive the endless space debris! Avoid asteroids and collisions to preserve your shields.'
              : gameMode === 'Neon Coin Rush'
              ? 'Gather glowing energy node diamonds to maximize your high score before crossing the finish line.'
              : 'Dodge dynamic obstacles, grab glowing speed pads and reach the finish line first.'}
          </p>
        </div>

        {/* Action guidelines */}
        <div className="flex items-center gap-3 text-xs bg-white border border-stone-200 p-2.5 rounded-xl shadow-xs">
          <Zap className="text-stone-500 fill-stone-500 animate-bounce" size={14} />
          <span className="text-stone-600 font-bold font-mono text-[10px] uppercase">Use W, S, A, D or Arrows to control!</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* SIDE BAR DASH PANEL */}
        <div className="lg:col-span-1 flex flex-col gap-5">
          
          {/* Real-time Speeder */}
          <div className="bg-white border border-stone-200 p-5 rounded-2xl shadow-xs">
            {gameMode === 'Space Dodge' ? (
              <>
                <h3 className="font-bold uppercase tracking-wider text-xs text-stone-500 mb-3 flex items-center gap-1.5 border-b border-stone-150 pb-2">
                  <Compass size={14} /> Shield Integrity
                </h3>
                <div className="text-center py-2">
                  <span className="text-3xl font-black font-mono text-stone-900">
                    {myPlayerRef.current.score}
                  </span>
                  <span className="text-xs text-stone-400 font-bold uppercase tracking-wider ml-1">HP</span>
                </div>
              </>
            ) : gameMode === 'Neon Coin Rush' ? (
              <>
                <h3 className="font-bold uppercase tracking-wider text-xs text-stone-500 mb-3 flex items-center gap-1.5 border-b border-stone-150 pb-2">
                  <Compass size={14} /> Energy Nodes
                </h3>
                <div className="text-center py-2">
                  <span className="text-3xl font-black font-mono text-stone-900">
                    {myPlayerRef.current.score}
                  </span>
                  <span className="text-xs text-stone-400 font-bold uppercase tracking-wider ml-1">PTS</span>
                </div>
              </>
            ) : (
              <>
                <h3 className="font-bold uppercase tracking-wider text-xs text-stone-500 mb-3 flex items-center gap-1.5 border-b border-stone-150 pb-2">
                  <Compass size={14} /> telemetry
                </h3>
                <div className="text-center py-2">
                  <span className="text-3xl font-black font-mono text-stone-800">
                    {speedVal}
                  </span>
                  <span className="text-xs text-stone-400 font-bold uppercase tracking-wider ml-1">KPH</span>
                </div>
              </>
            )}
            
            {/* Completion metrics bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-stone-500 mb-1.5 font-light">
                {gameMode === 'Space Dodge' ? (
                  <>
                    <span>Time Remaining:</span>
                    <span className="font-bold font-mono text-stone-700">{secondsLeft}s</span>
                  </>
                ) : (
                  <>
                    <span>Progress:</span>
                    <span className="font-bold text-stone-700">{progressPercent}%</span>
                  </>
                )}
              </div>
              <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden border border-stone-200">
                <div
                  className="h-full rounded-full transition-all bg-stone-900"
                  style={{
                    width: `${gameMode === 'Space Dodge' ? (secondsLeft / 30) * 100 : progressPercent}%`
                  }}
                />
              </div>
            </div>
          </div>

          {/* Leaders Dashboard */}
          <div className="bg-white border border-stone-200 p-5 rounded-2xl flex-1 flex flex-col shadow-xs">
            <h3 className="font-bold uppercase tracking-wider text-xs text-stone-500 mb-4 flex items-center gap-1.5 border-b border-stone-150 pb-2">
              <Trophy size={14} /> Real-time Leaders
            </h3>

            <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
              {sortedLeadboard.map((entry, index) => (
                <div
                  key={entry.name}
                  className={`flex items-center justify-between p-3 rounded-xl border ${entry.isSelf ? 'bg-stone-50 border-stone-300 shadow-xs' : 'bg-white border-stone-150'}`}
                >
                  <div className="flex items-center gap-2 w-[70%]">
                    <span className="font-bold text-xs text-stone-400 font-mono w-4">
                      #{index + 1}
                    </span>
                    <div className="truncate">
                      <p className={`text-xs font-bold truncate ${entry.isSelf ? 'text-stone-900' : 'text-stone-700'}`}>
                        {entry.name}
                      </p>
                      <p className="text-[10px] text-stone-400 font-light">
                        {entry.finished ? 'Complete' : 'Racing'}
                      </p>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${entry.finished ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-stone-50 text-stone-500'}`}>
                    {entry.finished
                      ? 'Finished'
                      : gameMode === 'Space Dodge'
                      ? `${entry.score} HP`
                      : gameMode === 'Neon Coin Rush'
                      ? `${entry.score} pts`
                      : `${entry.progress}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2D CANVAS GAMEFIELD */}
        <div className="lg:col-span-3 flex flex-col bg-white border border-stone-200 rounded-2xl overflow-hidden p-3 relative shadow-xs">
          <canvas
            ref={canvasRef}
            className="w-full bg-stone-50 rounded-xl max-h-[70vh] border border-stone-200/80 aspect-[8/7]"
          />
        </div>

      </div>
    </div>
  );
}
