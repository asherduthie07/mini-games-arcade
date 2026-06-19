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
const MAP_LENGTH = 3000; // Simpler, shorter track for quick, satisfying rounds
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
    { x: 925, y: GROUND_LEVEL - 50, label: 'Waystation Alpha' },
    { x: 1750, y: GROUND_LEVEL, label: 'Waystation Beta' },
    { x: 2520, y: GROUND_LEVEL - 40, label: 'Final Stretch' }
  ];

  // Easy static platforms designed with adequate spacing for solid, predictable platforming
  const platforms = useRef<Platform[]>([
    { x: 0, y: GROUND_LEVEL, w: 700, h: 60, style: 'stone' },
    // First jump gap step
    { x: 800, y: GROUND_LEVEL - 50, w: 250, h: 200, style: 'stone' },
    { x: 1150, y: GROUND_LEVEL - 100, w: 300, h: 250, style: 'stone' },
    // Lower bridge floor
    { x: 1550, y: GROUND_LEVEL, w: 400, h: 60, style: 'stone' },
    // Rising steps
    { x: 2050, y: GROUND_LEVEL - 60, w: 120, h: 120, style: 'stone' },
    { x: 2250, y: GROUND_LEVEL - 120, w: 120, h: 180, style: 'stone' },
    { x: 2470, y: GROUND_LEVEL - 40, w: 150, h: 100, style: 'stone' },
    // Final flat zone and goals
    { x: 2700, y: GROUND_LEVEL, w: 400, h: 60, style: 'stone' }
  ]);

  // Gentle moving platforms that slide predictably side-to-side (corrected speed variables for pure buttery smoothness!)
  const movingPlatforms = useRef<MovingPlatform[]>([
    { id: 1, x: 700, y: GROUND_LEVEL - 40, w: 100, h: 15, startX: 700, rangeX: 100, speed: 0.0016 },
    { id: 2, x: 1450, y: GROUND_LEVEL - 80, w: 100, h: 15, startX: 1450, rangeX: 110, speed: 0.0012 }
  ]);

  // Hazards which are highly visible and static to minimize visual clutter
  const hazards = useRef<Hazard[]>([
    // Easy to dodge spikes in the platform pits
    { id: 101, x: 700, y: GROUND_LEVEL + 40, w: 100, h: 20, type: 'spike' },
    { id: 102, x: 1100, y: GROUND_LEVEL + 40, w: 50, h: 20, type: 'spike' },
    { id: 103, x: 1450, y: GROUND_LEVEL + 40, w: 100, h: 20, type: 'spike' },
    { id: 104, x: 1950, y: GROUND_LEVEL + 40, w: 100, h: 20, type: 'spike' },
    { id: 105, x: 2370, y: GROUND_LEVEL + 40, w: 100, h: 20, type: 'spike' },

    // A few clear, static neon-orange energy orbs in the air (no chaotic speed spikes)
    { id: 201, x: 920, y: GROUND_LEVEL - 100, w: 25, h: 25, type: 'slow_orb' },
    { id: 202, x: 1300, y: GROUND_LEVEL - 160, w: 25, h: 25, type: 'slow_orb' },
    { id: 203, x: 2110, y: GROUND_LEVEL - 120, w: 25, h: 25, type: 'slow_orb' }
  ]);

  // Simple collectible boost items
  const boostPads = useRef<BoostPad[]>([
    { id: 301, x: 400, y: GROUND_LEVEL - 20, type: 'speed' },
    { id: 302, x: 1250, y: GROUND_LEVEL - 120, type: 'super_jump' },
    { id: 303, x: 1750, y: GROUND_LEVEL - 20, type: 'speed' },
    { id: 304, x: 2550, y: GROUND_LEVEL - 60, type: 'super_jump' }
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

    const updatePhysics = () => {
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
          my.vy = -7.8;
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
      if (my.x >= 2850 && !my.finished) {
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
      setPercentComplete(Math.min(100, Math.round((my.x / 2850) * 100)));
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

    const drawGame = () => {
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
      const finishGateX = 2850 - camX;
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
              const pPercent = Math.min(100, Math.round((plyr.x_position / 2850) * 100));
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
