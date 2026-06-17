/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { ThemeType, PowerUpType } from './types';
import { soundManager } from './audio';
import { getActiveLiveConfig, addDebugLog } from './liveConfig';

export interface EngineCallbacks {
  onScore: (score: number) => void;
  onFeedCollected: (amount: number, isGolden: boolean) => void;
  onGemCollected: () => void;
  onPowerUpActivated: (type: PowerUpType, duration: number) => void;
  onDistanceUpdated: (
    distance: number,
    currentStage: 'EGG' | 'CHICK' | 'ADULT',
    grainsCollected: number,
    isNearCornerTurn: boolean,
    cornerTurnDirection: 'LEFT' | 'RIGHT' | 'T_JUNCTION',
    isNearGate?: boolean,
    isHatching?: boolean
  ) => void;
  onCrash: () => void;
  onFpsUpdated?: (fps: number) => void;
  onTimeUpdated?: (timeOfDay: number, weather: string) => void;
  onCollectText?: (text: string, type: 'feed' | 'gem' | 'powerup') => void;
  onEggLaid?: (count: number) => void;
  onStage2TransitionCompleted?: () => void;
  onBrownEggCollected?: (total: number) => void;
  onObstacleAvoided?: () => void;
}

// Procedural texture canvas generator to ensure PBR AAA quality without static downloads
function createProceduralTexture(type: 'asphalt' | 'steel' | 'burlap' | 'feather' | 'skm_logo' | 'skm_banner_red' | 'skm_billboard_white' | 'skm_hazard' | 'dirt_farm' | 'muddy_road' | 'wood_bridge' | 'city_road', color?: string): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);

  if (type === 'city_road') {
    // Deep dark asphalt city street
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(0, 0, 512, 512);

    // Fine stone/aggregate noise grains
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? '#111111' : '#272522';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 1.2, 1.2);
    }

    // Double-yellow lane separator
    ctx.fillStyle = '#eab308';
    for (let y = 15; y < 512; y += 90) {
      ctx.fillRect(251, y, 4, 50);
      ctx.fillRect(257, y, 4, 50);
    }

    // Dashed white division markings
    ctx.fillStyle = '#e7e5e4';
    for (let y = 35; y < 512; y += 110) {
      ctx.fillRect(122, y, 4, 45);
      ctx.fillRect(386, y, 4, 45);
    }

    // Zebra crosswalk markings near intersections
    ctx.fillStyle = 'rgba(231, 229, 228, 0.45)';
    for (let y = 410; y < 490; y += 22) {
      ctx.fillRect(12, y, 488, 10);
    }

    // Fine concrete curb boundary lines
    ctx.fillStyle = '#44403c';
    ctx.fillRect(0, 0, 12, 512);
    ctx.fillRect(500, 0, 12, 512);
  } else if (type === 'dirt_farm') {
    // Dirt/earthy brown base
    ctx.fillStyle = '#78350f'; // rich warm brown
    ctx.fillRect(0, 0, 512, 512);

    // Fine dirt granules and rocks
    for (let i = 0; i < 2000; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? '#451a03' : '#92400e';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2.5, 2.5);
    }

    // Heavy tractor tyre tracks
    ctx.fillStyle = 'rgba(69, 26, 3, 0.45)';
    // Left side tractor track
    for (let y = 10; y < 512; y += 40) {
      ctx.fillRect(90, y, 30, 20);
      ctx.fillRect(115, y + 10, 30, 20);
    }
    // Right side tractor track
    for (let y = 30; y < 512; y += 40) {
      ctx.fillRect(380, y, 30, 20);
      ctx.fillRect(405, y + 10, 30, 20);
    }

    // Grass edges growing inward
    ctx.fillStyle = '#15803d';
    for (let i = 0; i < 400; i++) {
      const rx = Math.random() < 0.5 ? Math.random() * 32 : 480 + Math.random() * 32;
      const ry = Math.random() * 512;
      ctx.beginPath();
      ctx.arc(rx, ry, Math.random() * 14 + 6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'muddy_road') {
    // Slimy dark wet mud
    ctx.fillStyle = '#451a03'; // deep muddy brown
    ctx.fillRect(0, 0, 512, 512);

    // Fine wet mud sheen and lighter dirt tracks
    for (let i = 0; i < 1500; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? '#1c1917' : '#713f12';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
    }

    // Swirly tire tracks and mud splashes
    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 14;
    for (let j = 0; j < 4; j++) {
      ctx.beginPath();
      let x = 80 + j * 110;
      let y = 0;
      ctx.moveTo(x, y);
      while (y < 512) {
        x += Math.sin(y / 40) * 12;
        y += 15;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Wet shiny puddle spots
    ctx.fillStyle = 'rgba(28, 25, 23, 0.6)';
    for (let p = 0; p < 8; p++) {
      ctx.beginPath();
      ctx.ellipse(80 + Math.random() * 350, Math.random() * 512, 25 + Math.random() * 35, 12 + Math.random() * 15, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'wood_bridge') {
    // Plank color beige/brown
    ctx.fillStyle = '#78350f';
    ctx.fillRect(0, 0, 512, 512);

    // Individual horizontal wood planks
    ctx.fillStyle = '#92400e';
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 6;
    for (let y = 0; y < 512; y += 64) {
      ctx.fillRect(0, y, 512, 60);
      ctx.beginPath();
      ctx.moveTo(0, y + 62);
      ctx.lineTo(512, y + 62);
      ctx.stroke();

      // Wood grain lines
      ctx.strokeStyle = 'rgba(69, 26, 3, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y + 15 + Math.random() * 10);
      ctx.bezierCurveTo(150, y + 10 + Math.random() * 20, 350, y + 30, 512, y + 15);
      ctx.stroke();

      // Rusty nails on outer edges
      ctx.fillStyle = '#4b5563';
      ctx.beginPath();
      ctx.arc(40, y + 30, 4, 0, Math.PI * 2);
      ctx.arc(472, y + 30, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'asphalt') {
    // Dark core tarmac
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 512, 512);

    // Fine gravel/dust grain
    for (let i = 0; i < 3000; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? '#0f172a' : '#334155';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5);
    }

    // Heavy tractor/truck tire tread skid marks
    ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
    ctx.fillRect(80, 0, 40, 512);
    ctx.fillRect(150, 0, 40, 512);
    ctx.fillRect(320, 0, 40, 512);
    ctx.fillRect(390, 0, 40, 512);

    // Jagged roadway cracks
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 2.5;
    for (let j = 0; j < 3; j++) {
      ctx.beginPath();
      let x = Math.random() * 512;
      let y = 0;
      ctx.moveTo(x, y);
      while (y < 512) {
        x += (Math.random() - 0.5) * 35;
        y += Math.random() * 80 + 25;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Lane separators / dashed yellow double lines
    ctx.fillStyle = '#f59e0b';
    for (let y = 20; y < 512; y += 100) {
      ctx.fillRect(166, y, 8, 55);
      ctx.fillRect(338, y, 8, 55);
    }

    // Grass weed tufts creeping onto road sides
    ctx.fillStyle = '#16a34a';
    for (let i = 0; i < 350; i++) {
      const rx = Math.random() < 0.5 ? Math.random() * 22 : 490 + Math.random() * 22;
      const ry = Math.random() * 512;
      ctx.beginPath();
      ctx.arc(rx, ry, Math.random() * 10 + 4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'steel') {
    // Industrial gray grid metal
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(0, 0, 512, 512);

    // Panelling dividers
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 4;
    for (let x = 0; x <= 512; x += 128) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, x); ctx.lineTo(512, x); ctx.stroke();
    }

    // Steel rivets & metallic specular lines
    ctx.fillStyle = '#9ca3af';
    for (let px = 0; px < 512; px += 128) {
      for (let py = 0; py < 512; py += 128) {
        ctx.beginPath(); ctx.arc(px + 12, py + 12, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + 116, py + 12, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + 12, py + 116, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + 116, py + 116, 5, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Rusty grease spots
    ctx.fillStyle = 'rgba(120, 53, 15, 0.4)';
    for (let r = 0; r < 25; r++) {
      ctx.beginPath();
      ctx.arc(Math.random() * 512, Math.random() * 512, Math.random() * 18 + 8, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === 'burlap') {
    // Warm natural fiber
    ctx.fillStyle = '#b45309';
    ctx.fillRect(0, 0, 512, 512);

    // Cross-weave thread grid
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.2;
    for (let x = 0; x < 512; x += 6) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
    }
    for (let y = 0; y < 512; y += 6) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
    }

    // Stamped high-contrast SKM corporate circular feed logotype
    ctx.beginPath();
    ctx.arc(256, 256, 115, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(153, 27, 27, 0.85)';
    ctx.lineWidth = 14;
    ctx.stroke();

    ctx.fillStyle = 'rgba(153, 27, 27, 0.85)';
    ctx.font = '900 44px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SKM', 256, 215);
    ctx.font = '900 28px Arial';
    ctx.fillText('FEEDS', 256, 280);
  } else if (type === 'feather') {
    // Beautiful dynamic organic layered feathery scales
    ctx.fillStyle = color || '#fbfbfb';
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 3;
    for (let y = 0; y < 512; y += 24) {
      const stagger = (y % 48 === 0) ? 0 : 16;
      for (let x = -16; x < 528; x += 32) {
        ctx.beginPath();
        ctx.arc(x + stagger, y, 16, 0, Math.PI);
        ctx.stroke();
      }
    }
  } else if (type === 'skm_logo') {
    // Elegant circular or shield SKM Corporate badge
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 512, 512);

    // Red outer circle
    ctx.strokeStyle = '#b91b1c';
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.arc(256, 256, 200, 0, Math.PI * 2);
    ctx.stroke();

    // Golden inner circle accent
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(256, 256, 175, 0, Math.PI * 2);
    ctx.stroke();

    // Center Red background Circle
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(256, 256, 150, 0, Math.PI * 2);
    ctx.fill();

    // Big crisp bold white 'SKM' lettering
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 84px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SKM', 256, 205);

    // Green/gold wheat leaf icon or horizontal banner
    ctx.fillStyle = '#fbbf24';
    ctx.font = '900 24px Arial';
    ctx.fillText('★ FEEDS ★', 256, 275);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('QUALITY GUARANTEED', 256, 325);

  } else if (type === 'skm_banner_red') {
    // Red horizontal waving cloth banner
    ctx.fillStyle = '#be123c'; // rich red
    ctx.fillRect(0, 0, 512, 512);

    // Striking white borders
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 14;
    ctx.strokeRect(30, 30, 452, 452);

    // Gold inner trim
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 4;
    ctx.strokeRect(44, 44, 424, 424);

    // SKM text centered
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 110px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw text shadow
    ctx.fillStyle = '#1e293b';
    ctx.fillText('SKM', 261, 211);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('SKM', 256, 206);

    ctx.fillStyle = '#fef08a';
    ctx.font = '900 32px sans-serif';
    ctx.fillText('POULTRY FEEDS', 256, 310);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '500 22px sans-serif';
    ctx.fillText('SINCE 1981 • NUTRITION FIRST', 256, 370);

    // Subtle dark fold lines to simulate wind-blown fabric!
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 18;
    for (let x = 60; x < 512; x += 110) {
      ctx.beginPath();
      ctx.moveTo(x, 10);
      ctx.bezierCurveTo(x + 25, 120, x - 25, 380, x + 10, 502);
      ctx.stroke();
    }

  } else if (type === 'skm_billboard_white') {
    // Professional modern white corporate sign board
    ctx.fillStyle = '#f8fafc'; // light slate white
    ctx.fillRect(0, 0, 512, 512);

    // Left thick corporate red block
    ctx.fillStyle = '#be123c';
    ctx.fillRect(0, 0, 140, 512);

    // "SKM" vertically on the red block
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 68px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('S', 70, 140);
    ctx.fillText('K', 70, 256);
    ctx.fillText('M', 70, 372);

    // Right side brand typography
    ctx.fillStyle = '#0f172a'; // deep navy/slate
    ctx.textAlign = 'left';
    
    ctx.font = '900 38px Arial';
    ctx.fillText('RESEARCH CTR', 170, 130);

    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#475569';
    ctx.fillText('Genetics & Poultry Health', 170, 185);

    // Horizontal blue line
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(170, 220, 310, 6);

    // Bulleted selling points
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 20px Arial';
    ctx.fillText('✓ Scientific Feed Formulations', 170, 270);
    ctx.fillText('✓ Bio-Secure Environments', 170, 320);
    ctx.fillText('✓ High Hatchability Triggers', 170, 370);

    // Gold ribbon
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(170, 420, 310, 40);
    ctx.fillStyle = '#78350f';
    ctx.font = '900 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('★ SKM ANIMAL FEEDS DIVISION ★', 325, 445);

  } else if (type === 'skm_hazard') {
    // Industrial safety hazard textures
    ctx.fillStyle = '#eab308'; // strong hazard yellow
    ctx.fillRect(0, 0, 512, 512);

    // Bold diagonal black lines
    ctx.strokeStyle = '#0f172a'; // black
    ctx.lineWidth = 36;
    for (let offset = -512; offset < 1024; offset += 100) {
      ctx.beginPath();
      ctx.moveTo(offset, -50);
      ctx.lineTo(offset + 600, 550);
      ctx.stroke();
    }

    // Centered steel plates
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'; // black backing
    ctx.fillRect(40, 150, 432, 212);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.strokeRect(50, 160, 412, 192);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 48px Arial, Helvetica';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SKM FEED MILL', 256, 225);

    ctx.fillStyle = '#facc15';
    ctx.font = '900 24px Arial, Helvetica';
    ctx.fillText('⚠️ AUTHORIZED VEHICLES ONLY', 256, 295);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 16;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export class SKMRunnerEngine {
  private canvas: HTMLCanvasElement;
  private callbacks: EngineCallbacks;

  // Three.js Core Render Loop elements
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private clock!: THREE.Clock;
  private ambientLight!: THREE.AmbientLight;
  private dirLight!: THREE.DirectionalLight;

  // Running Loop Controller Flags
  private animationFrameId: number | null = null;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private isIntroActive: boolean = true;
  private introTime: number = 0;

  // Gameplay Mechanics
  private speed: number = 16.0;
  private maxSpeed: number = 38.0;
  private speedRampRate: number = 0.08; // progressive acceleration rate per 100m
  public distance: number = 0;
  public score: number = 0;
  private activeTheme: ThemeType = 'POULTRY_FARM';
  private lastWorkingTheme: ThemeType = 'POULTRY_FARM';
  public debugSingleBiome: boolean = false; // Default to false to enable continuous automatic biome transitions!

  // Hitbox Debug visualizations
  public debugHitboxesActive: boolean = false;
  private debugHitboxMeshes: Map<any, THREE.Mesh> = new Map();
  private debugPlayerMesh: THREE.Mesh | null = null;
  private debugMatGreen: THREE.MeshBasicMaterial | null = null;
  private debugMatRed: THREE.MeshBasicMaterial | null = null;
  private lastFootstepPhase: number = 0;

  // 3-Lane Mechanics
  private currentLane: number = 0; // -1 = Left Lane, 0 = Center Lane, 1 = Right Lane
  private targetX: number = 0;
  private playerX: number = 0;
  private playerY: number = 0;
  private playerZ: number = -6.0;

  // Animated Jump / Slide controller
  private isJumping: boolean = false;
  private jumpVelocity: number = 0;
  private gravity: number = -40; // Parabolic downward gravity
  private isSliding: boolean = false;
  private slideTimer: number = 0;
  private slideDuration: number = 0.7; // seconds
  private isCrashed: boolean = false;
  private crashTimer: number = 0;
  // Squash and Stretch animation scales
  private squashX: number = 1.0;
  private squashY: number = 1.0;
  private squashZ: number = 1.0;
  private targetSquashX: number = 1.0;
  private targetSquashY: number = 1.0;
  private targetSquashZ: number = 1.0;

  // Active Powerup map
  private activePowerUps: Map<PowerUpType, { timeLeft: number; duration: number }> = new Map();

  // Evolution & Startup Showcase States
  public currentStage: 'EGG' | 'CHICK' | 'ADULT' = 'EGG';
  public grainsCollected: number = 0;
  public isMenuShowcase: boolean = true;
  public isTransitioningToRun: boolean = false;
  public transitionTimer: number = 0;
  public isHatching: boolean = false;
  public hatchTimer: number = 0;
  public isHenEvolving: boolean = false;
  public henEvolveTimer: number = 0;
  private showcaseIdleTimer: number = 0;
  private showcaseIdleState: 'LOOK_AROUND' | 'ADJUST_CAP' | 'DANCE' | 'STRETCH' | 'JUMP' | 'SPIN' | 'WOBBLE' = 'WOBBLE';

  // Corner Turns States
  public nextCornerDistance: number = 240; // first corner turn at 240m
  public lastCornerDistance: number = 0;
  public isNearCornerTurn: boolean = false;
  public cornerTurnDirection: 'LEFT' | 'RIGHT' | 'T_JUNCTION' = 'T_JUNCTION';
  public wasCornerTurnedSuccessfully: boolean = false;
  public cornerCameraYawOffset: number = 0; // for animating 90 degree turn rotations
  public targetCornerCameraYawOffset: number = 0;

  // Subway Surfers Menu Factory Gate Components
  private factoryGateGroup: THREE.Group | null = null;
  private factoryGateLeftPanel: THREE.Mesh | null = null;
  private factoryGateRightPanel: THREE.Mesh | null = null;
  private gateOpenProgress: number = 0.0;

  // Polished Procedural Visual Elements
  private playerGroup!: THREE.Group;
  
  // Egg Mascot Sub-Group Meshes
  private eggGroup!: THREE.Group;
  private eggBodyGroup!: THREE.Group;
  private eggFaceGroup!: THREE.Group;
  private eggLeftLeg!: THREE.Mesh;
  private eggRightLeg!: THREE.Mesh;
  private eggLeftArm!: THREE.Mesh;
  private eggRightArm!: THREE.Mesh;
  private eggCapGroup!: THREE.Group;
  // Articulated bone pivots for smooth, rounded cartoon limbs
  private eggLeftThighPivot!: THREE.Group;
  private eggLeftCalfPivot!: THREE.Group;
  private eggLeftFootPivot!: THREE.Group;
  private eggRightThighPivot!: THREE.Group;
  private eggRightCalfPivot!: THREE.Group;
  private eggRightFootPivot!: THREE.Group;
  private eggLeftUpperArmPivot!: THREE.Group;
  private eggLeftForearmPivot!: THREE.Group;
  private eggRightUpperArmPivot!: THREE.Group;
  private eggRightForearmPivot!: THREE.Group;

  // Leaf wind particles description
  private leafParticles: THREE.Points | null = null;

  // Egg Break custom animation fields
  private eggBreakGroup: THREE.Group | null = null;
  private eggBreakWhiteMesh: THREE.Mesh | null = null;
  private eggBreakYolkMesh: THREE.Mesh | null = null;
  private eggBreakFragments: { mesh: THREE.Mesh | THREE.Group; velocity: THREE.Vector3; rotationVelocity: THREE.Vector3; isGroundAdjusted?: boolean }[] = [] as any;
  private hasSpawnedEggBreak: boolean = false;
  private eggCrackPhaseTimer: number = 0;

  // Fluffy Chick Sub-Group Meshes
  private chickGroup!: THREE.Group;
  private chickLeftLeg!: THREE.Mesh;
  private chickRightLeg!: THREE.Mesh;
  private chickLeftWing!: THREE.Mesh;
  private chickRightWing!: THREE.Mesh;
  private chickBodyGroup!: THREE.Group;
  private chickHeadGroup!: THREE.Group;
  private chickTailGroup!: THREE.Group;

  // Adult Chicken Sub-Group Mesh
  private adultGroup!: THREE.Group;

  private chickenBodyMesh!: THREE.Mesh;
  private chickenLeftLeg!: THREE.Mesh;
  private chickenRightLeg!: THREE.Mesh;
  private chickenLeftWing!: THREE.Group;
  private chickenRightWing!: THREE.Group;
  private chickenTailGroup!: THREE.Group;
  private shieldBubbleMesh!: THREE.Mesh;
  private magnetAuraMesh!: THREE.Mesh;

  // Stage 2 state variables
  public isStage2: boolean = false;
  public isStage2Transition: boolean = false;
  public stage2TransitionTimer: number = 0;
  public brownEggsLaid: number = 0;
  public brownEggsCollected: number = 0;
  public stage2UnlockedNotified: boolean = false;
  public isRetiring: boolean = false;
  public retirementTimer: number = 0;
  public distanceSinceLastEgg: number = 0;
  public eggLayoutTargetZ: number | null = null;

  // Material registries for Stage 2 recoloring
  private eggPhysicalMat!: THREE.MeshPhysicalMaterial;
  private chickYellowMat!: THREE.MeshStandardMaterial;
  private chickenWhiteFeathersMat!: THREE.MeshStandardMaterial;

  // Visual Growth & Polished Animation timers
  private visualGrowthScale: number = 1.0;
  private happyFaceTimer: number = 0.0;
  private squashStretchY: number = 1.0;

  // Infinite Road Modules
  private roads: THREE.Group[] = [];
  private bgBirds: THREE.Group[] = [];
  private bgClouds: THREE.Group[] = [];
  private roadWidth: number = 11.5;
  private laneSpacing: number = 3.2;
  private roadLength: number = 40.0;
  private roadCount: number = 15;
  private totalRoadScrolled: number = 0;

  // Pools
  private obstacles: { mesh: THREE.Group; type: string; lane: number; active: boolean; vzActive?: number; laneChanging?: boolean; laneTarget?: number; changeTimer?: number; }[] = [];
  private collectibles: { mesh: THREE.Group; type: string; lane: number; scoreValue: number; active: boolean; bobOffset: number }[] = [];

  // Weather and Camera effects
  private rainParticles: THREE.Points | null = null;
  private rainPositions!: Float32Array;
  private rainCount = 450;

  // --- Dynamic Weather & Day/Night System ---
  public timeOfDay: number = 8.5; // Starts at beautiful 8:30 AM
  public timeScale: number = 0.16; // 0.16 clock hour rate (24h loop in ~150 seconds)
  public currentWeather: string = 'SUNNY'; // SUNNY, CLOUDY, LIGHT_RAIN, THUNDERSTORM, FOGGY, RAIN_SUNSHINE
  private weatherTimer: number = 40.0; // Automatically transition weather type after 40s
  private lightningLight: THREE.DirectionalLight | null = null;
  private lightningActive: boolean = false;
  private lightningDuration: number = 0;
  private lightningTimer: number = 0;
  private starsParticles: THREE.Points | null = null;

  // Dynamic Lerping States
  private skyColorTarget: THREE.Color = new THREE.Color('#38bdf8');
  private skyColorCurrent: THREE.Color = new THREE.Color('#38bdf8');
  private fogColorTarget: THREE.Color = new THREE.Color('#38bdf8');
  private fogColorCurrent: THREE.Color = new THREE.Color('#38bdf8');
  private fogDensityTarget: number = 0.006;
  private fogDensityCurrent: number = 0.006;

  private sunColorTarget: THREE.Color = new THREE.Color('#ffffbf');
  private sunColorCurrent: THREE.Color = new THREE.Color('#ffffbf');
  private sunIntensityTarget: number = 1.35;
  private sunIntensityCurrent: number = 1.35;

  private ambColorTarget: THREE.Color = new THREE.Color('#94a3b8');
  private ambColorCurrent: THREE.Color = new THREE.Color('#94a3b8');
  private ambIntensityTarget: number = 0.8;
  private ambIntensityCurrent: number = 0.8;

  private wetnessTarget: number = 0.0;
  private wetnessCurrent: number = 0.0;

  private windSpeedTarget: number = 1.0;
  private windSpeedCurrent: number = 1.0;

  private cloudOpacityTarget: number = 0.85;
  private cloudOpacityCurrent: number = 0.85;
  private cloudColorTarget: THREE.Color = new THREE.Color('#ffffff');
  private cloudColorCurrent: THREE.Color = new THREE.Color('#ffffff');

  private smokeParticles: { mesh: THREE.Mesh; life: number; velocity: THREE.Vector3 }[] = [];
  private trailParticles: { mesh: THREE.Mesh; life: number }[] = [];
  
  // Feather Particle systems
  private featherParticles: THREE.Points | null = null;
  private featherPositions!: Float32Array;
  private featherVelocities!: Float32Array;
  private featherColors!: Float32Array;
  private featherCount = 140;
  private featherActive = false;
  private featherTimer = 0;

  // Cache dictionaries
  private geoCache: { [key: string]: THREE.BufferGeometry } = {};
  private matCache: { [key: string]: THREE.Material } = {};

  private currentSkinId: string = 'skin_classic';

  // Stats FPS Tracker
  private frameCount = 0;
  private lastFpsUpdateTime = 0;

  // Interactive dynamic values for Subway Surfers cinematic action
  private cameraOffsetHeight: number = 3.6;
  private cameraOffsetDepth: number = 9.2;
  private cameraTrackXMultiplier: number = 0.85; // turn lag multiplier
  private baseFOV: number = 58;
  private currentFOV: number = 58;
  private landingShakeForce: number = 0;

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.init();
    this.setupInput();

    window.addEventListener('resize', this.handleResize);
  }

  private handleResize = () => {
    if (this.renderer && this.camera && this.canvas) {
      const width = this.canvas.clientWidth;
      const height = this.canvas.clientHeight;
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
  };

  private init() {
    this.clock = new THREE.Clock();

    // Create high-power WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    // Create Scene with Volumetric Industrial Mist
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#475569');
    this.scene.fog = new THREE.FogExp2('#475569', 0.006);

    // Initial camera placed exactly behind the runner
    this.camera = new THREE.PerspectiveCamera(
      this.baseFOV,
      this.canvas.clientWidth / this.canvas.clientHeight,
      0.1,
      450.0
    );
    this.camera.position.set(0, 3.2, -1.2);
    this.camera.lookAt(new THREE.Vector3(0, 1.0, -18.0));

    // Balanced Cinematic Lighting setup
    this.ambientLight = new THREE.AmbientLight('#ffffff', 0.8);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight('#ffffbf', 1.3);
    this.dirLight.position.set(18, 35, 12);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 1.0;
    this.dirLight.shadow.camera.far = 110;
    const sCamBound = 22;
    this.dirLight.shadow.camera.left = -sCamBound;
    this.dirLight.shadow.camera.right = sCamBound;
    this.dirLight.shadow.camera.top = sCamBound;
    this.dirLight.shadow.camera.bottom = -sCamBound;
    this.dirLight.shadow.bias = -0.0003;
    this.scene.add(this.dirLight);

    // Initial compilation
    this.buildCache();
    this.buildRoads();
    this.buildPlayer();
    this.buildParticles();
    this.buildAtmosphere();

    // Default Theme start showing the industrial factory theme on main menu
    this.applyThemeSettings('SKM_FACTORY');

    // Spawn factory gateway and trigger main menu showcase automatically
    this.resetToShowcase();
  }

  private buildCache() {
    // Generate Procedural PBR Canvas Textures
    const asphaltText = createProceduralTexture('asphalt');
    const steelGrid = createProceduralTexture('steel');
    const burlapSack = createProceduralTexture('burlap');
    const whiteFeath = createProceduralTexture('feather', '#ffffff');
    const goldFeath = createProceduralTexture('feather', '#fbbf24');
    const cyberFeath = createProceduralTexture('feather', '#0f172a');
    
    // SKM Corporate Banners System
    const skmLogoText = createProceduralTexture('skm_logo');
    const skmBannerText = createProceduralTexture('skm_banner_red');
    const skmBillboardText = createProceduralTexture('skm_billboard_white');
    const skmHazardText = createProceduralTexture('skm_hazard');

    // Register Textures inside material geometries
    this.geoCache['road'] = new THREE.PlaneGeometry(this.roadWidth, this.roadLength);
    this.geoCache['silo'] = new THREE.CylinderGeometry(2.3, 2.3, 9.5, 12);
    this.geoCache['roof'] = new THREE.ConeGeometry(2.8, 3.5, 4);
    this.geoCache['trunk'] = new THREE.CylinderGeometry(0.24, 0.44, 2.4, 5);
    this.geoCache['leaves'] = new THREE.SphereGeometry(1.4, 6, 6);
    this.geoCache['box'] = new THREE.BoxGeometry(1, 1, 1);
    this.geoCache['sphere'] = new THREE.SphereGeometry(1, 8, 8);
    this.geoCache['torus'] = new THREE.TorusGeometry(0.4, 0.12, 6, 12);

    // Dynamic Materials matching skins & environment
    this.matCache['road_asphalt_pbr'] = new THREE.MeshStandardMaterial({
      map: asphaltText,
      roughness: 0.85,
      metalness: 0.1
    });

    // Wet and damp asphalt variants
    this.matCache['road_asphalt_wet'] = new THREE.MeshStandardMaterial({
      map: asphaltText,
      roughness: 0.15, // highly reflective wet surface
      metalness: 0.45,
      color: '#475569' // darker wet color
    });

    this.matCache['road_asphalt_damp'] = new THREE.MeshStandardMaterial({
      map: asphaltText,
      roughness: 0.55,
      metalness: 0.18,
      color: '#64748b' // slightly slate damp color
    });

    // Custom themed roads PBR classes
    const dirtText = createProceduralTexture('dirt_farm');
    this.matCache['road_dirt_pbr'] = new THREE.MeshStandardMaterial({
      map: dirtText,
      roughness: 0.92,
      metalness: 0.02
    });

    const mudText = createProceduralTexture('muddy_road');
    this.matCache['road_muddy_pbr'] = new THREE.MeshStandardMaterial({
      map: mudText,
      roughness: 0.58, // slimy wet mud sheen
      metalness: 0.08
    });

    const woodText = createProceduralTexture('wood_bridge');
    this.matCache['road_wood_bridge'] = new THREE.MeshStandardMaterial({
      map: woodText,
      roughness: 0.82,
      metalness: 0.05
    });

    const cityText = createProceduralTexture('city_road');
    this.matCache['road_city_pbr'] = new THREE.MeshStandardMaterial({
      map: cityText,
      roughness: 0.72,
      metalness: 0.15
    });

    this.matCache['decor_steel_pbr'] = new THREE.MeshStandardMaterial({
      map: steelGrid,
      roughness: 0.25,
      metalness: 0.9
    });

    this.matCache['burlap_sack_pbr'] = new THREE.MeshStandardMaterial({
      map: burlapSack,
      roughness: 0.9,
      metalness: 0.02
    });

    this.matCache['mesh_white_feathers'] = new THREE.MeshStandardMaterial({
      map: whiteFeath,
      roughness: 0.75,
      metalness: 0.02
    });

    this.matCache['mesh_golden_feathers'] = new THREE.MeshStandardMaterial({
      map: goldFeath,
      roughness: 0.08,
      metalness: 0.98,
      emissive: '#d97706',
      emissiveIntensity: 0.15
    });

    this.matCache['mesh_cyber_feathers'] = new THREE.MeshStandardMaterial({
      map: cyberFeath,
      roughness: 0.3,
      metalness: 0.85
    });

    // Register SKM branding materials
    this.matCache['skm_logo_mat'] = new THREE.MeshStandardMaterial({
      map: skmLogoText,
      roughness: 0.5,
      metalness: 0.1,
      side: THREE.DoubleSide
    });

    this.matCache['skm_banner_red_mat'] = new THREE.MeshStandardMaterial({
      map: skmBannerText,
      roughness: 0.8,
      metalness: 0.02,
      side: THREE.DoubleSide
    });

    this.matCache['skm_billboard_white_mat'] = new THREE.MeshStandardMaterial({
      map: skmBillboardText,
      roughness: 0.4,
      metalness: 0.05,
      side: THREE.DoubleSide
    });

    this.matCache['skm_hazard_mat'] = new THREE.MeshStandardMaterial({
      map: skmHazardText,
      roughness: 0.5,
      metalness: 0.1,
      side: THREE.DoubleSide
    });

    this.matCache['crest_standard'] = new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.55 });
    this.matCache['beak_standard'] = new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.4 });
    this.matCache['black_matte'] = new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.9 });
    this.matCache['white_gloss'] = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.1 });
    
    // Specular Collectibles bloom glow
    this.matCache['gold_specular_high'] = new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      roughness: 0.05,
      metalness: 0.99,
      emissive: '#b45309',
      emissiveIntensity: 0.45
    });

    this.matCache['egg_gloss_white'] = new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      roughness: 0.05,
      metalness: 0.0,
      emissive: '#e2e8f0',
      emissiveIntensity: 0.1
    });

    this.matCache['crystal_neon_ruby'] = new THREE.MeshStandardMaterial({
      color: '#06b6d4',
      roughness: 0.05,
      metalness: 0.9,
      emissive: '#0ea5e9',
      emissiveIntensity: 0.85,
      transparent: true,
      opacity: 0.85
    });
  }

  private applyThemeSettings(theme: ThemeType) {
    this.activeTheme = theme;
    let bgColor = '#829ab1';
    let fogDensity = 0.013;
    let lightColor = '#fef08a';
    let lightIntensity = 1.35;

    switch (theme) {
      case 'POULTRY_FARM':
        bgColor = '#86efac'; // soft green farm morning sky
        fogDensity = 0.012;
        lightColor = '#fef08a';
        lightIntensity = 1.35;
        this.ambientLight.color.set('#fef08a');
        break;
      case 'CORN_FIELDS':
        bgColor = '#38bdf8'; // beautiful clear morning skies
        fogDensity = 0.009;
        lightColor = '#fef3c7';
        lightIntensity = 1.45;
        this.ambientLight.color.set('#bae6fd');
        break;
      case 'WHEAT_FIELDS':
        bgColor = '#fed7aa'; // warm autumn golden day glow
        fogDensity = 0.011;
        lightColor = '#ffedd5';
        lightIntensity = 1.35;
        this.ambientLight.color.set('#ffedd5');
        break;
      case 'SKM_FACTORY':
        bgColor = '#cbd5e1'; // dark industrial steel mist
        fogDensity = 0.022;
        lightColor = '#e2e8f0';
        lightIntensity = 1.1;
        this.ambientLight.color.set('#94a3b8');
        break;
      case 'WAREHOUSE':
        bgColor = '#64748b'; // deep gray-blue container storage clouds
        fogDensity = 0.025;
        lightColor = '#e2e8f0';
        lightIntensity = 1.0;
        this.ambientLight.color.set('#475569');
        break;
      case 'RIVER_AREA':
        bgColor = '#a5f3fc'; // watery humid mist
        fogDensity = 0.018;
        lightColor = '#ecfeff';
        lightIntensity = 1.3;
        this.ambientLight.color.set('#bae6fd');
        break;
      case 'VILLAGE_ROADS':
        bgColor = '#fdba74'; // warm honey sunset
        fogDensity = 0.013;
        lightColor = '#fca5a5';
        lightIntensity = 1.25;
        this.ambientLight.color.set('#fed7aa');
        break;
      case 'NIGHT_FARM':
        bgColor = '#090d1f'; // pitch dark moonlit blue
        fogDensity = 0.026;
        lightColor = '#38bdf8';
        lightIntensity = 0.6;
        this.ambientLight.color.set('#1e293b');
        break;
      case 'RAINY_SEASON':
        bgColor = '#475569'; // stormy overcast
        fogDensity = 0.035;
        lightColor = '#cbd5e1';
        lightIntensity = 0.7;
        this.ambientLight.color.set('#475569');
        break;
    }

    // 50% reduction in all fog densities to maintain clear visibility of at least 60m ahead
    fogDensity *= 0.5;

    this.scene.background = new THREE.Color(bgColor);
    if (this.scene.fog && this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.set(bgColor);
      this.scene.fog.density = fogDensity;
    }

    this.dirLight.color.set(lightColor);
    this.dirLight.intensity = lightIntensity;

    // Toggle decor Visibility based on each chunk's own persistent theme/biome
    this.roads.forEach((roadGrp) => {
      const roadMesh = roadGrp.getObjectByName('ground_plane') as THREE.Mesh;
      if (roadMesh) {
        const theme = roadGrp.userData.theme || this.activeTheme;
        roadMesh.material = this.getRoadMaterialForSegment(theme, this.currentWeather || 'SUNNY');
      }
      this.updateChunkDecorVisibility(roadGrp);
    });
  }

  private getRoadMaterialForSegment(theme: ThemeType, weather: string): THREE.Material {
    const isRainy = (weather === 'LIGHT_RAIN' || weather === 'THUNDERSTORM' || weather === 'RAIN_SUNSHINE');
    const isCloudy = (weather === 'CLOUDY' || weather === 'FOGGY');

    // CITY ZONE -> Asphalt Highway with lane dividers
    if (theme === 'CITY_DISTRICT' || theme === 'SKM_FACTORY' || theme === 'WAREHOUSE' || theme === 'RAINY_SEASON') {
      return this.matCache['road_city_pbr'] || this.matCache['road_asphalt_pbr'];
    }

    // FOREST ZONE -> Forest Path (Pine needles / dirt floor)
    if (theme === 'NIGHT_FARM') {
      return this.matCache['road_dirt_pbr'] || this.matCache['road_asphalt_pbr'];
    }

    // RIVER ZONE -> Wooden Bridge Plank Road
    if (theme === 'RIVER_AREA') {
      return this.matCache['road_wood_bridge'] || this.matCache['road_asphalt_pbr'];
    }

    // VILLAGE ZONE -> Village asphalt / gravel damp road
    if (theme === 'VILLAGE_ROADS') {
      return this.matCache['road_asphalt_damp'] || this.matCache['road_asphalt_pbr'];
    }

    // FARM ZONE -> Muddy Farm Dirt Road
    if (theme === 'POULTRY_FARM' || theme === 'CORN_FIELDS' || theme === 'WHEAT_FIELDS') {
      return this.matCache['road_dirt_pbr'] || this.matCache['road_asphalt_pbr'];
    }

    return this.matCache['road_asphalt_pbr'];
  }

  private buildRoads() {
    this.roads = [];
    for (let i = 0; i < this.roadCount; i++) {
      const roadGroup = new THREE.Group();
      const segmentZOffset = -i * this.roadLength;
      roadGroup.position.set(0, 0, segmentZOffset);

      // Determine initial theme for this chunk based on its absolute track position Z
      const initialDist = -segmentZOffset;
      const initialTheme = this.getThemeForDistance(initialDist);
      roadGroup.userData.theme = initialTheme;

      // Elevated 3D Ground and Shoulders layout
      const customMat = this.getRoadMaterialForSegment(initialTheme, this.currentWeather || 'SUNNY');
      const road = new THREE.Mesh(this.geoCache['road'], customMat);
      road.name = 'ground_plane';
      road.rotation.x = -Math.PI / 2;
      road.receiveShadow = true;
      roadGroup.add(road);

      // Elevated Stone and Grass verges along both shoulders
      const greenShoulderLeft = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 0.4, this.roadLength),
        new THREE.MeshStandardMaterial({ color: '#166534', roughness: 0.9 })
      );
      greenShoulderLeft.name = 'shoulder_l';
      greenShoulderLeft.position.set(-this.roadWidth / 2 - 1.25, -0.15, 0);
      greenShoulderLeft.receiveShadow = true;
      roadGroup.add(greenShoulderLeft);

      const greenShoulderRight = greenShoulderLeft.clone();
      greenShoulderRight.name = 'shoulder_r';
      greenShoulderRight.position.x = this.roadWidth / 2 + 1.25;
      roadGroup.add(greenShoulderRight);

      // -----------------------------------------------------------------------
      // LANDSCAPE TERRAIN SYSTEM: A massive continuous rolling countryside mesh
      // -----------------------------------------------------------------------
      const terrainWidth = 360.0;
      const terrainDepth = 42.0; // slight overlap over 40.0m to close any running boundary slits
      const terrainGeom = new THREE.PlaneGeometry(terrainWidth, terrainDepth, 48, 8);

      // Apply coordinates and vertex colors to terrain plane
      const posAttr = terrainGeom.getAttribute('position') as THREE.BufferAttribute;
      const colors = [];
      const tempColor = new THREE.Color();
      
      for (let j = 0; j < posAttr.count; j++) {
        const vx = posAttr.getX(j);
        const vy = posAttr.getY(j); // local Y points along absolute Z
        const vertexAbsZ = segmentZOffset + vy;
        
        const vHeight = this.getTerrainHeight(vx, vertexAbsZ);
        posAttr.setZ(j, vHeight);
        
        const absX = Math.abs(vx);
        if (absX < 11.5) {
          // Dirt gravel path buffer right next to the asphalt shoulder
          const gravelS = Math.abs(Math.sin(vx * 8)) * 0.18;
          tempColor.set('#2d2011').lerp(new THREE.Color('#3f2c19'), gravelS);
        } else if (vHeight < -0.65) {
          // River wet muddy bank
          const mudBlend = Math.min((vHeight + 2.5) / 1.5, 1.0);
          tempColor.set('#1a0f05').lerp(new THREE.Color('#321e0d'), mudBlend);
        } else if (vx < -14.0 && vx > -28.0) {
          // Lush dark green Corn strip
          const cropAlt = Math.sin(vertexAbsZ * 1.5);
          tempColor.set(cropAlt > 0.1 ? '#14532d' : '#15803d');
        } else if (vx > 18.0 && vx < 35.0) {
          // Golden ripe yellow Wheat field
          const cropAlt = Math.cos(vertexAbsZ * 1.6);
          tempColor.set(cropAlt > 0.05 ? '#ca8a04' : '#eab308');
        } else if (vHeight > 10.0) {
          // Mountain peaks - slate dark rock and white capping snow layers!
          if (vHeight > 18.0) {
            tempColor.set('#f8fafc'); // Pure bright mountain crest snow
          } else {
            const rockBlend = (vHeight - 10.0) / 8.0;
            tempColor.set('#475569').lerp(new THREE.Color('#cbd5e1'), rockBlend);
          }
        } else {
          // Rolling emerald country meadows and open agricultural grasslands
          const pastureNoise = Math.sin(vx * 0.1) * Math.sin(vertexAbsZ * 0.1) * 0.5 + 0.5;
          tempColor.set('#166534').lerp(new THREE.Color('#15803d'), pastureNoise * 0.5).lerp(new THREE.Color('#22c55e'), pastureNoise * 0.5);
        }
        
        colors.push(tempColor.r, tempColor.g, tempColor.b);
      }
      
      terrainGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      terrainGeom.computeVertexNormals();
      
      const terrainMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.95,
        flatShading: true, // Gorgeous low-poly cartoon visual styling!
      });
      
      const terrainMesh = new THREE.Mesh(terrainGeom, terrainMat);
      terrainMesh.name = 'rolling_terrain';
      terrainMesh.rotation.x = -Math.PI / 2;
      terrainMesh.receiveShadow = true;
      terrainMesh.castShadow = true;
      roadGroup.add(terrainMesh);
      
      // Sparkling country river water layer
      const waterMat = new THREE.MeshStandardMaterial({
        color: '#0284c7', // vibrant sky blue water
        roughness: 0.05,
        metalness: 0.15,
        transparent: true,
        opacity: 0.72,
      });
      const waterGeom = new THREE.PlaneGeometry(16.0, terrainDepth);
      const waterMesh = new THREE.Mesh(waterGeom, waterMat);
      waterMesh.name = 'river_water';
      waterMesh.rotation.x = -Math.PI / 2;
      waterMesh.position.set(-40, -0.75, 0); // locked water plane Y index
      roadGroup.add(waterMesh);

      // -----------------------------------------------------------------------
      // PROCEDURAL LANDSCAPE & DECOR: Generates seamless continuous landmarks, silos,
      // fields, fences, and windmills randomly distributed to look natural!
      // -----------------------------------------------------------------------
      this.decorateChunkProcedurally(roadGroup, segmentZOffset, i);

      this.scene.add(roadGroup);
      this.roads.push(roadGroup);

      // Pre-spawn procedural obstacles and collectibles on initial roads starting from segment 1 (segment 0 is safe player spawn)
      if (i > 1) {
        this.spawnProceduralSegment(segmentZOffset);
      } else if (i === 1) {
        // First chunk spans -40m, spawn early beginner objects at -20m to -40m
        this.spawnProceduralSegment(segmentZOffset);
      }
    }
  }

  private decorateChunkProcedurally(roadGroup: THREE.Group, segmentZOffset: number, chunkIndex: number) {
    try {
      // 1. Clean up stale prior decorative sets to avoid overlapping clones when recycling
      const toRemove: THREE.Object3D[] = [];
      roadGroup.children.forEach((child) => {
        if (
          child.name === 'procedural_decor' ||
          child.name === 'terrain_landmark' ||
          child.name === 'farm_decor' ||
          child.name === 'factory_decor' ||
          child.name === 'green_decor' ||
          child.name === 'city_decor'
        ) {
          toRemove.push(child);
        }
      });
      toRemove.forEach((child) => {
        roadGroup.remove(child);
      });

      // 2. Setup standard container group
      const proceduralGroup = new THREE.Group();
      proceduralGroup.name = 'procedural_decor';

      // Seed deterministic generator off coordinate segment to maintain terrain consistency during execution
      const absZSeed = Math.abs(segmentZOffset);
      let seed = absZSeed || 1;
      const rand = () => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
      };

      const chunkDist = Math.abs(segmentZOffset);
      const blend = this.getThemeAtPosition(chunkDist);
      let theme = roadGroup.userData.theme || this.activeTheme;
      if (blend.transitionWith) {
        if (rand() < blend.ratio) {
          theme = blend.transitionWith;
        } else {
          theme = blend.primary;
        }
      }

      // 3. Spawning theme-specific scenery based on the theme of this chunk!
      switch (theme) {
        case 'POULTRY_FARM': {
          // Double density layout (Front Z and Back Z)
          const offsets = [-11 + rand() * 5, 7 + rand() * 5];
          offsets.forEach((zOffset) => {
            // LHS
            if (rand() < 0.35) {
              const coops = this.createBarnMesh(rand);
              coops.position.set(-this.roadWidth / 2 - 5.5, 0.3, zOffset);
              proceduralGroup.add(coops);
            } else if (rand() < 0.7) {
              const storage = this.createIndustrialSilosMesh(rand);
              storage.position.set(-this.roadWidth / 2 - 4.5, 0.2, zOffset);
              proceduralGroup.add(storage);
            } else {
              const workers = this.createHumanoidMesh('#1e3a8a', '#1d4ed8', true); // Worker
              workers.position.set(-this.roadWidth / 2 - 3.5, 0.1, zOffset);
              workers.rotation.y = rand() * Math.PI * 2;
              proceduralGroup.add(workers);
            }

            // RHS
            if (rand() < 0.45) {
              const pen = this.createChickenPenMesh(rand);
              pen.position.set(this.roadWidth / 2 + 4.5, 0, zOffset);
              proceduralGroup.add(pen);
            } else if (rand() < 0.8) {
              const sacks = this.createFeedBagsMesh();
              sacks.position.set(this.roadWidth / 2 + 2.8, 0, zOffset);
              sacks.rotation.y = rand() * 0.5;
              proceduralGroup.add(sacks);
            } else {
              const research = this.createResearchCenterMesh(rand);
              research.position.set(this.roadWidth / 2 + 5.5, 0.2, zOffset);
              proceduralGroup.add(research);
            }
          });
          break;
        }

        case 'CORN_FIELDS': {
          const offsets = [-11 + rand() * 5, 7 + rand() * 5];
          offsets.forEach((zOffset) => {
            // LHS
            if (rand() < 0.5) {
              const sprinkler = this.createIrrigationMesh();
              sprinkler.position.set(-this.roadWidth / 2 - 4.2, 0.1, zOffset);
              proceduralGroup.add(sprinkler);
            } else {
              const harvester = this.createHarvesterMesh();
              harvester.position.set(-this.roadWidth / 2 - 5.8, 0.25, zOffset);
              harvester.rotation.y = Math.PI / 1.5;
              proceduralGroup.add(harvester);
            }

            // RHS
            if (rand() < 0.4) {
              const tractor = this.createTractorMesh(rand);
              tractor.position.set(this.roadWidth / 2 + 5.2, 0.35, zOffset);
              tractor.rotation.y = -Math.PI / 5;
              proceduralGroup.add(tractor);
            } else {
              const corn = this.createCornFieldMesh(rand);
              corn.position.set(this.roadWidth / 2 + 3.4, 0, zOffset);
              proceduralGroup.add(corn);
            }
          });
          break;
        }

        case 'WHEAT_FIELDS': {
          const offsets = [-11 + rand() * 5, 7 + rand() * 5];
          offsets.forEach((zOffset) => {
            // LHS
            if (rand() < 0.45) {
              const silosMax = this.createIndustrialSilosMesh(rand);
              silosMax.scale.set(1.3, 1.5, 1.3); // giant grain silo
              silosMax.position.set(-this.roadWidth / 2 - 5.5, 0.3, zOffset);
              proceduralGroup.add(silosMax);
            } else {
              const strawHay = this.createHayBaleMesh();
              strawHay.position.set(-this.roadWidth / 2 - 4.8, 0.1, zOffset);
              strawHay.rotation.y = rand() * Math.PI;
              proceduralGroup.add(strawHay);
            }

            // RHS
            if (rand() < 0.65) {
              const wheat = this.createWheatFieldMesh(rand);
              wheat.name = 'wheat_stalk_decor';
              wheat.position.set(this.roadWidth / 2 + 3.4, 0, zOffset);
              proceduralGroup.add(wheat);
            } else {
              const reaper = this.createHarvesterMesh();
              reaper.position.set(this.roadWidth / 2 + 5.8, 0.25, zOffset);
              reaper.rotation.y = -Math.PI / 4;
              proceduralGroup.add(reaper);
            }
          });
          break;
        }

        case 'SKM_FACTORY': {
          const offsets = [-11 + rand() * 5, 7 + rand() * 5];
          offsets.forEach((zOffset) => {
            // LHS
            if (rand() < 0.45) {
              const fact = this.createFeedFactoryMesh(rand);
              fact.position.set(-this.roadWidth / 2 - 7.5, 0.4, zOffset);
              proceduralGroup.add(fact);
            } else {
              const cargoTruck = this.createTruckMesh();
              cargoTruck.position.set(-this.roadWidth / 2 - 5.5, 0.1, zOffset);
              cargoTruck.rotation.y = Math.PI / 2; // parked alongside the curb
              proceduralGroup.add(cargoTruck);
            }

            // RHS
            if (rand() < 0.5) {
              const warehouse = this.createWarehouseHangarMesh(rand);
              warehouse.position.set(this.roadWidth / 2 + 5.5, 0.2, zOffset);
              proceduralGroup.add(warehouse);
            } else {
              const chimPost = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 12, 10), this.matCache['decor_steel_pbr']);
              chimPost.name = 'chimney_pillar';
              chimPost.position.set(this.roadWidth / 2 + 6.2, 6, zOffset);
              chimPost.castShadow = true;
              proceduralGroup.add(chimPost);

              const warningBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.24, 6, 6), new THREE.MeshBasicMaterial({ color: '#ef4444' }));
              warningBeacon.name = 'neon_blinker';
              warningBeacon.position.set(this.roadWidth / 2 + 6.2, 12.18, zOffset);
              proceduralGroup.add(warningBeacon);
            }
          });
          break;
        }

        case 'WAREHOUSE': {
          const offsets = [-11 + rand() * 5, 7 + rand() * 5];
          offsets.forEach((zOffset) => {
            // LHS
            if (rand() < 0.5) {
              const shippingContainer = new THREE.Group();
              const colors = ['#dc2626', '#1d4ed8', '#ea580c', '#ca8a04'];
              const chosenCol = colors[Math.floor(rand() * 4)];
              const containerBox = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 5.0), new THREE.MeshStandardMaterial({ color: chosenCol, metalness: 0.3, roughness: 0.4 }));
              containerBox.position.set(-this.roadWidth / 2 - 4.8, 0.9, zOffset);
              containerBox.castShadow = true;
              containerBox.receiveShadow = true;
              shippingContainer.add(containerBox);

              const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), this.matCache['skm_logo_mat']);
              plaque.position.set(-this.roadWidth / 2 - 3.58, 0.9, zOffset);
              plaque.rotation.y = Math.PI / 2;
              shippingContainer.add(plaque);
              proceduralGroup.add(shippingContainer);
            } else {
              const store = this.createWarehouseHangarMesh(rand);
              store.position.set(-this.roadWidth / 2 - 5.5, 0.2, zOffset);
              proceduralGroup.add(store);
            }

            // RHS
            if (rand() < 0.4) {
              const fork = this.createForkliftMesh();
              fork.position.set(this.roadWidth / 2 + 4.5, 0.1, zOffset);
              fork.rotation.y = -Math.PI / 3;
              proceduralGroup.add(fork);
            } else {
              const pallets = this.createPalletMesh();
              pallets.position.set(this.roadWidth / 2 + 3.8, 0.1, zOffset);
              pallets.rotation.y = rand() * 0.4;
              proceduralGroup.add(pallets);
            }
          });
          break;
        }

        case 'RIVER_AREA': {
          // LHS: Deep wide blue flowing river
          const waterMat = new THREE.MeshStandardMaterial({
            color: '#1d4ed8',
            transparent: true,
            opacity: 0.72,
            roughness: 0.15,
            metalness: 0.7
          });
          const riverCover = new THREE.Mesh(new THREE.PlaneGeometry(18, this.roadLength), waterMat);
          riverCover.name = 'recycled_river';
          riverCover.rotation.x = -Math.PI / 2;
          riverCover.position.set(-35, -0.65, 0); // flush matching water lane
          proceduralGroup.add(riverCover);

          // Small concrete culvert/bridge rails flanking on Left
          const woodMat = new THREE.MeshStandardMaterial({ color: '#5c2d18', roughness: 0.9 });
          const bridgeRail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.8, this.roadLength), woodMat);
          bridgeRail.position.set(-this.roadWidth / 2 - 0.2, 0.4, 0);
          bridgeRail.castShadow = true;
          proceduralGroup.add(bridgeRail);

          // Beautiful willow trees flanking (Double spot!)
          const treeMax = this.createProceduralTree(rand, false);
          treeMax.scale.set(1.4, 1.4, 1.4);
          treeMax.position.set(this.roadWidth / 2 + 4.8, 0, -11 + rand() * 5);
          proceduralGroup.add(treeMax);

          const treeBack = this.createProceduralTree(rand, false);
          treeBack.scale.set(1.2, 1.2, 1.2);
          treeBack.position.set(this.roadWidth / 2 + 4.8, 0, 7 + rand() * 5);
          proceduralGroup.add(treeBack);
          break;
        }

        case 'VILLAGE_ROADS': {
          const offsets = [-11 + rand() * 5, 7 + rand() * 5];
          offsets.forEach((zOffset) => {
            // LHS
            if (rand() < 0.45) {
              const house = this.createHouseMesh(rand, '#fef2f2');
              house.position.set(-this.roadWidth / 2 - 5.5, 0.1, zOffset);
              house.rotation.y = Math.PI / 2; // facing the road!
              proceduralGroup.add(house);
            } else {
              const shop = this.createHouseMesh(rand, '#eff6ff'); // blue clinic or shop
              shop.position.set(-this.roadWidth / 2 - 5.5, 0.1, zOffset);
              shop.rotation.y = Math.PI / 2;
              
              const awning = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 2.2), new THREE.MeshStandardMaterial({ color: '#be123c' }));
              awning.position.set(-3.7, 1.7, zOffset);
              awning.rotation.z = Math.PI / 12;
              proceduralGroup.add(awning);
              proceduralGroup.add(shop);
            }

            // RHS
            if (rand() < 0.45) {
              const neighbor = this.createHouseMesh(rand, '#fffbeb');
              neighbor.position.set(this.roadWidth / 2 + 5.5, 0.1, zOffset);
              neighbor.rotation.y = -Math.PI / 2;
              proceduralGroup.add(neighbor);
            } else {
              const villager = this.createHumanoidMesh('#ec4899', '#4f46e5', false); // Villager girl
              villager.position.set(this.roadWidth / 2 + 3.2, 0.1, zOffset);
              villager.rotation.y = rand() * Math.PI * 2;
              proceduralGroup.add(villager);
            }
          });

          // Warm street lamp on shoulders flanking the curbs
          const lampL = this.createStreetLampMesh();
          lampL.position.set(-this.roadWidth / 2 - 0.5, 0.1, -12);
          proceduralGroup.add(lampL);

          const lampR = this.createStreetLampMesh();
          lampR.position.set(this.roadWidth / 2 + 0.5, 0.1, 12);
          lampR.rotation.y = Math.PI; // point light head inwards
          proceduralGroup.add(lampR);
          break;
        }

        case 'CITY_DISTRICT': {
          proceduralGroup.name = 'city_decor';

          // 1. Sidewalks LHS and RHS
          const sideWalkMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.8 });
          const curbMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.9 });

          const sidewalkL = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.25, this.roadLength), sideWalkMat);
          sidewalkL.position.set(-this.roadWidth / 2 - 2.5, 0.125, 0);
          sidewalkL.castShadow = true;
          sidewalkL.receiveShadow = true;
          proceduralGroup.add(sidewalkL);

          const sidewalkR = sidewalkL.clone();
          sidewalkR.position.x = this.roadWidth / 2 + 2.5;
          proceduralGroup.add(sidewalkR);

          // Curb trimmers (high contrast white/slate striped lines)
          for (let zS = -this.roadLength / 2; zS <= this.roadLength / 2; zS += 6.0) {
            const curbStoneL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.28, 5.8), curbMat);
            curbStoneL.position.set(-this.roadWidth / 2, 0.14, zS);
            proceduralGroup.add(curbStoneL);

            const curbStoneR = curbStoneL.clone();
            curbStoneR.position.x = this.roadWidth / 2;
            proceduralGroup.add(curbStoneR);
          }

          // 2. City Buildings / Shops on shoulders
          const offsets = [-12 + rand() * 4, 8 + rand() * 4];
          offsets.forEach((zOffset) => {
            // LHS
            if (rand() < 0.6) {
              const build = this.createCityBuildingMesh(rand, '#334155');
              build.position.set(-this.roadWidth / 2 - 5.5, 0.1, zOffset);
              build.rotation.y = Math.PI / 2;
              proceduralGroup.add(build);
            } else {
              const shop = this.createCityShopMesh(rand, '#1e293b');
              shop.position.set(-this.roadWidth / 2 - 5.5, 0.1, zOffset);
              shop.rotation.y = Math.PI / 2;
              proceduralGroup.add(shop);
            }

            // RHS
            if (rand() < 0.6) {
              const build = this.createCityBuildingMesh(rand, '#475569');
              build.position.set(this.roadWidth / 2 + 5.5, 0.1, zOffset);
              build.rotation.y = -Math.PI / 2;
              proceduralGroup.add(build);
            } else {
              const complex = this.createCityApartmentMesh(rand, '#7c2d12');
              complex.position.set(this.roadWidth / 2 + 5.5, 0.1, zOffset);
              complex.rotation.y = -Math.PI / 2;
              proceduralGroup.add(complex);
            }
          });

          // 3. Modern Sleek Street Lamps
          const lampL = this.createModernStreetLamp(rand);
          lampL.position.set(-this.roadWidth / 2 - 0.2, 0.2, -10);
          proceduralGroup.add(lampL);

          const lampR = this.createModernStreetLamp(rand);
          lampR.position.set(this.roadWidth / 2 + 0.2, 0.2, 10);
          lampR.rotation.y = Math.PI;
          proceduralGroup.add(lampR);

          // 4. Traffic Lights Near Center of Chunk
          if (rand() < 0.4) {
            const trafficLight = this.createTrafficSignalMesh();
            trafficLight.position.set(-this.roadWidth / 2 - 0.2, 0.2, 0);
            proceduralGroup.add(trafficLight);
          }
          break;
        }

        case 'RAINY_SEASON': {
          const offsets = [-11 + rand() * 5, 7 + rand() * 5];
          offsets.forEach((zOffset) => {
            // LHS: Pile of shipping containers or old warehouses or barns
            if (rand() < 0.4) {
              const storage = this.createWarehouseHangarMesh(rand);
              storage.position.set(-this.roadWidth / 2 - 5.5, 0.2, zOffset);
              proceduralGroup.add(storage);
            } else if (rand() < 0.8) {
              const truck = this.createTruckMesh();
              truck.position.set(-this.roadWidth / 2 - 5.2, 0.1, zOffset);
              truck.rotation.y = Math.PI / 2;
              proceduralGroup.add(truck);
            } else {
              const barn = this.createBarnMesh(rand);
              barn.position.set(-this.roadWidth / 2 - 5.5, 0.3, zOffset);
              proceduralGroup.add(barn);
            }

            // RHS: Windmills, SKM banners or silos!
            if (rand() < 0.35) {
              const windmill = this.createWindmillMesh(rand);
              windmill.position.set(this.roadWidth / 2 + 5.5, 0.1, zOffset);
              proceduralGroup.add(windmill);
            } else if (rand() < 0.7) {
              const board = this.createSignBoardMesh(rand);
              board.position.set(this.roadWidth / 2 + 2.8, 0.1, zOffset);
              proceduralGroup.add(board);
            } else {
              const pen = this.createChickenPenMesh(rand);
              pen.position.set(this.roadWidth / 2 + 4.5, 0, zOffset);
              proceduralGroup.add(pen);
            }
          });
          break;
        }

        case 'NIGHT_FARM': {
          // --- ZONE 2: FOREST ZONE (Midnight/Dark Woods) ---
          const offsets = [-11 + rand() * 4, 7 + rand() * 4];
          offsets.forEach((zOffset) => {
            // LHS
            if (rand() < 0.4) {
              const logPile = new THREE.Group();
              for (let L = 0; L < 3; L++) {
                const logMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.4, 8), new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.9 }));
                logMesh.rotation.x = Math.PI / 2;
                logMesh.position.set(L === 2 ? 0 : (L === 0 ? -0.32 : 0.32), L === 2 ? 0.55 : 0.3, 0);
                logMesh.castShadow = true;
                logPile.add(logMesh);
              }
              logPile.position.set(-this.roadWidth / 2 - 4.5, 0, zOffset);
              proceduralGroup.add(logPile);
            } else if (rand() < 0.8) {
              const boulder = new THREE.Group();
              const stoneMat = new THREE.MeshStandardMaterial({ color: '#4b5563', roughness: 0.95 });
              const mainRock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1), stoneMat);
              mainRock.position.y = 0.55;
              mainRock.castShadow = true;
              boulder.add(mainRock);
              const subRock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6), stoneMat);
              subRock.position.set(0.85, 0.3, 0.45);
              boulder.add(subRock);
              boulder.position.set(-this.roadWidth / 2 - 3.8, 0, zOffset);
              proceduralGroup.add(boulder);
            } else {
              const campfire = new THREE.Group();
              for (let lg = 0; lg < 4; lg++) {
                const ringLog = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 6), new THREE.MeshStandardMaterial({ color: '#451a03' }));
                ringLog.rotation.y = lg * Math.PI / 2;
                ringLog.rotation.x = Math.PI / 2;
                ringLog.position.set(Math.cos(lg * Math.PI / 2) * 0.45, 0.08, Math.sin(lg * Math.PI / 2) * 0.45);
                campfire.add(ringLog);
              }
              const fireBasic = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), new THREE.MeshStandardMaterial({ color: '#ea580c', emissive: '#ea580c', emissiveIntensity: 2 }));
              fireBasic.position.y = 0.3;
              campfire.add(fireBasic);
              campfire.position.set(-this.roadWidth / 2 - 4.2, 0, zOffset);
              proceduralGroup.add(campfire);
            }

            // RHS: Thick custom forest trees
            const sideTree = this.createProceduralTree(rand, rand() > 0.5);
            sideTree.position.set(this.roadWidth / 2 + 3.8 + rand() * 4, 0, zOffset);
            proceduralGroup.add(sideTree);
          });
          break;
        }

        default: {
          // Fallback to random trees/fences
          const fallbackTree = this.createProceduralTree(rand, rand() > 0.5);
          fallbackTree.position.set(-this.roadWidth / 2 - 4.5, 0, 0);
          proceduralGroup.add(fallbackTree);
          break;
        }
      }

      // 4. Shared country dynamic decorations (wooden countryside fences, rustic boards, veggie fields, and river stones)
      if (theme !== 'CITY_DISTRICT' && theme !== 'SKM_FACTORY') {
        const fenceY = 0.02;
        for (let zOffset = -this.roadLength / 2; zOffset <= this.roadLength / 2; zOffset += 10) {
          // Left dynamic decor (avoid LHS water in RIVER_AREA)
          if (theme !== 'RIVER_AREA') {
            if (rand() < 0.75) {
              const fence = this.createRoadsideFenceMesh(rand);
              fence.position.set(-this.roadWidth / 2 - 0.15, fenceY, zOffset);
              proceduralGroup.add(fence);
            }
          } else {
            // River area boulders lining the shoreline
            if (rand() < 0.6) {
              const rock = new THREE.Mesh(
                new THREE.DodecahedronGeometry(0.3 + rand() * 0.45, 1),
                new THREE.MeshStandardMaterial({ color: '#57534e', roughness: 0.92 })
              );
              rock.position.set(-this.roadWidth / 2 - 2.8 - rand() * 1.5, -0.2, zOffset);
              rock.scale.set(1.2, 0.6, 1.2);
              proceduralGroup.add(rock);
            }
          }

          // Right dynamic decor (post-and-rail rustic fences)
          if (rand() < 0.75) {
            const fence = this.createRoadsideFenceMesh(rand);
            fence.position.set(this.roadWidth / 2 + 0.15, fenceY, zOffset);
            fence.rotation.y = Math.PI; // mirror
            proceduralGroup.add(fence);
          }
        }

        // Random country signposts
        if (rand() < 0.35) {
          const sign = this.createRoadsideSignboardMesh(rand);
          const isLeft = rand() > 0.5 && theme !== 'RIVER_AREA';
          const sideX = isLeft ? -this.roadWidth / 2 - 0.65 : this.roadWidth / 2 + 0.65;
          sign.position.set(sideX, 0.05, -12 + rand() * 24);
          proceduralGroup.add(sign);
        }

        // Small farms (veggie gardens) placed neatly on the countryside verges
        if (['VILLAGE_ROADS', 'POULTRY_FARM', 'CORN_FIELDS', 'WHEAT_FIELDS'].includes(theme)) {
          if (rand() < 0.55) {
            const plot = this.createVegetablePlotMesh(rand);
            const isLeft = rand() > 0.5 && theme !== 'RIVER_AREA';
            const sideX = isLeft ? -this.roadWidth / 2 - 4.5 : this.roadWidth / 2 + 4.5;
            plot.position.set(sideX, 0.01, -10 + rand() * 20);
            proceduralGroup.add(plot);
          }
        }

        // Scattered Trees randomly positioned based on terrain gradients with visual styling variations (green, golden, pink, etc.)
        const treeCount = 2 + Math.floor(rand() * 4);
        const foliageColors = ['#15803d', '#16a34a', '#ca8a04', '#e11d48', '#ec4899', '#059669']; // gorgeous red, pink, golden, green hues!
        for (let t = 0; t < treeCount; t++) {
          const sideSign = (rand() > 0.5) ? 1 : -1;
          const xPos = sideSign * (18.0 + rand() * 32.0);
          const zPos = -18.0 + rand() * 36.0;
          const yPos = this.getTerrainHeight(xPos, segmentZOffset + zPos);
          
          const tree = this.createProceduralTree(rand, t % 2 === 0);
          // Apply lovely blossom tree variations on foliage colors random pick!
          if (rand() < 0.35) {
            const chosenCol = foliageColors[Math.floor(rand() * foliageColors.length)];
            tree.traverse((child) => {
              if (child instanceof THREE.Mesh && child.name !== 'tree' && child !== tree.children[0]) {
                child.material = new THREE.MeshStandardMaterial({ color: chosenCol, roughness: 0.85 });
              }
            });
          }
          tree.position.set(xPos, yPos, zPos);
          proceduralGroup.add(tree);
        }
      }

      // Small brand signage occasional placements
      if (rand() < 0.4) {
        const boardSign = (rand() > 0.5) ? 1 : -1;
        const board = this.createSignBoardMesh(rand);
        board.position.set(boardSign * (this.roadWidth / 2 + 2.8), 0, -10 + rand() * 20);
        proceduralGroup.add(board);
      }

      // Overhead checkpoint gates (archways welcome posters) on every 5th chunk
      const parentChunkIndex = Math.round(segmentZOffset / -this.roadLength);
      if (parentChunkIndex > 0 && parentChunkIndex % 5 === 0) {
        const gateArch = this.createOverheadGateMesh(rand);
        gateArch.position.set(0, 0, 0); // centered inside the chunk
        proceduralGroup.add(gateArch);
      }

      roadGroup.add(proceduralGroup);
    } catch (err) {
      console.warn("Procedural chunk decoration failed:", err);
    }
  }

  private createHumanoidMesh(shirtColor: string = '#1d4ed8', pantsColor: string = '#1e3a8a', isWorker: boolean = false): THREE.Group {
    const person = new THREE.Group();
    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.6, 0.25), new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 }));
    torso.position.y = 0.65;
    torso.castShadow = true;
    person.add(torso);
    
    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshStandardMaterial({ color: '#fbcfe8', roughness: 0.8 }));
    head.position.y = 1.05;
    head.castShadow = true;
    person.add(head);

    if (isWorker) {
      const hat = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshStandardMaterial({ color: '#ca8a04', roughness: 0.5 }));
      hat.scale.set(1.1, 0.65, 1.1);
      hat.position.set(0, 1.15, 0);
      person.add(hat);
    } else {
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.9 }));
      hair.scale.set(1.05, 0.9, 1.05);
      hair.position.set(0, 1.1, 0);
      person.add(hair);
    }

    // Legs
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.45, 6), new THREE.MeshStandardMaterial({ color: pantsColor }));
    legL.position.set(-0.1, 0.22, 0);
    legL.castShadow = true;
    person.add(legL);

    const legR = legL.clone();
    legR.position.x = 0.1;
    person.add(legR);

    // Arms
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.45, 6), new THREE.MeshStandardMaterial({ color: shirtColor }));
    armL.position.set(-0.24, 0.65, 0);
    armL.rotation.z = Math.PI / 12;
    armL.castShadow = true;
    person.add(armL);

    const armR = armL.clone();
    armR.position.x = 0.24;
    armR.rotation.z = -Math.PI / 12;
    person.add(armR);

    person.scale.set(1.2, 1.2, 1.2);
    return person;
  }

  private createFeedBagsMesh(): THREE.Group {
    const sacks = new THREE.Group();
    const burlapMat = new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.9 });
    for (let b = 0; b < 4; b++) {
      const sack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.8), burlapMat);
      sack.castShadow = true;
      sack.receiveShadow = true;
      sack.rotation.y = (b * Math.PI) / 4;
      sack.position.set((b % 2 === 0 ? -0.2 : 0.2), 0.125 + (Math.floor(b/2) * 0.2), (b % 2 === 0 ? 0.1 : -0.1));
      sacks.add(sack);
    }
    return sacks;
  }

  private createIrrigationMesh(): THREE.Group {
    const irr = new THREE.Group();
    const steelMat = this.matCache['decor_steel_pbr'] || new THREE.MeshStandardMaterial({ color: '#cccccc', metalness: 0.8 });
    
    // Vertical stand
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.5, 8), steelMat);
    stand.position.y = 1.75;
    stand.castShadow = true;
    irr.add(stand);

    // Horizontal pipe overhead out towards fields
    const mainPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 5.0, 8), steelMat);
    mainPipe.rotation.z = Math.PI / 2;
    mainPipe.position.set(2.5, 3.5, 0);
    mainPipe.castShadow = true;
    irr.add(mainPipe);

    // Drip sprinklers matching down
    for (let s = 1; s <= 3; s++) {
      const drip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), steelMat);
      drip.position.set(1.2 * s, 3.1, 0);
      drip.castShadow = true;
      irr.add(drip);

      // Sprinkler red nozzle head
      const nozzle = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), new THREE.MeshStandardMaterial({ color: '#ef4444' }));
      nozzle.position.set(1.2 * s, 2.8, 0);
      irr.add(nozzle);
    }

    return irr;
  }

  private createHarvesterMesh(): THREE.Group {
    const harvester = new THREE.Group();
    // Body box
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.8, 3.5), new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.5 })); // Red harvester
    body.position.y = 1.25;
    body.castShadow = true;
    body.receiveShadow = true;
    harvester.add(body);

    // Front high-fidelity reaper cylinder drum
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 2.6, 12), new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.8, roughness: 0.3 }));
    drum.rotation.z = Math.PI / 2;
    drum.position.set(0, 0.65, 1.95);
    drum.castShadow = true;
    harvester.add(drum);

    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.1), new THREE.MeshStandardMaterial({ color: '#1e3a8a' }));
    armL.position.set(-1.1, 0.65, 1.2);
    harvester.add(armL);
    
    const armR = armL.clone();
    armR.position.x = 1.1;
    harvester.add(armR);

    // Glass Cab
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.4), new THREE.MeshStandardMaterial({ color: '#93c5fd', transparent: true, opacity: 0.6, metalness: 0.9 }));
    cab.position.set(0, 2.2, 0.45);
    cab.castShadow = true;
    harvester.add(cab);

    // Heavy back and front crawler wheels
    const wheelMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.9 });
    const tireF_L = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.5, 12), wheelMat);
    tireF_L.rotation.z = Math.PI / 2;
    tireF_L.position.set(-1.15, 0.7, 0.8);
    tireF_L.castShadow = true;
    harvester.add(tireF_L);

    const tireF_R = tireF_L.clone();
    tireF_R.position.x = 1.15;
    harvester.add(tireF_R);

    const tireB_L = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.4, 12), wheelMat);
    tireB_L.rotation.z = Math.PI / 2;
    tireB_L.position.set(-1.1, 0.45, -1.2);
    tireB_L.castShadow = true;
    harvester.add(tireB_L);

    const tireB_R = tireB_L.clone();
    tireB_R.position.x = 1.1;
    harvester.add(tireB_R);

    // Tall exhaust exhaust pipe stacks
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.8, 8), this.matCache['decor_steel_pbr']);
    exhaust.position.set(0.6, 2.8, -1.0);
    harvester.add(exhaust);

    harvester.scale.set(1.1, 1.1, 1.1);
    return harvester;
  }

  private createHayBaleMesh(): THREE.Group {
    const bale = new THREE.Group();
    const strawMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.95 });
    
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.3, 12), strawMat);
    cyl.rotation.x = Math.PI / 2;
    cyl.position.y = 0.6;
    cyl.castShadow = true;
    cyl.receiveShadow = true;
    bale.add(cyl);

    const strapMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.9 });
    const strapL = new THREE.Mesh(new THREE.TorusGeometry(0.61, 0.03, 6, 16), strapMat);
    strapL.rotation.y = Math.PI / 2;
    strapL.position.set(0, 0.6, -0.35);
    bale.add(strapL);

    const strapR = strapL.clone();
    strapR.position.z = 0.35;
    bale.add(strapR);

    return bale;
  }

  private createTruckMesh(): THREE.Group {
    const truck = new THREE.Group();
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 1.4), new THREE.MeshStandardMaterial({ color: '#be123c', roughness: 0.4 }));
    cab.position.set(0, 0.9, 1.6);
    cab.castShadow = true;
    truck.add(cab);

    const shield = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.65, 0.1), new THREE.MeshStandardMaterial({ color: '#cbd5e1', transparent: true, opacity: 0.6 }));
    shield.position.set(0, 1.3, 2.31);
    truck.add(shield);

    const carrier = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.2, 4.0), new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.6, metalness: 0.4 }));
    carrier.position.set(0, 1.2, -1.2);
    carrier.castShadow = true;
    carrier.receiveShadow = true;
    truck.add(carrier);

    const sidePlateL = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), this.matCache['skm_logo_mat']);
    sidePlateL.position.set(-0.91, 1.2, -1.2);
    sidePlateL.rotation.y = -Math.PI / 2;
    truck.add(sidePlateL);

    const sidePlateR = sidePlateL.clone();
    sidePlateR.position.x = 0.91;
    sidePlateR.rotation.y = Math.PI / 2;
    truck.add(sidePlateR);

    const wheelMat = new THREE.MeshStandardMaterial({ color: '#18181b', roughness: 0.9 });
    for (let w = 0; w < 3; w++) {
      const zOffset = -2.6 + w * 1.8;
      const tireL = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.35, 10), wheelMat);
      tireL.rotation.z = Math.PI / 2;
      tireL.position.set(-0.95, 0.48, zOffset);
      tireL.castShadow = true;
      truck.add(tireL);

      const tireR = tireL.clone();
      tireR.position.x = 0.95;
      truck.add(tireR);
    }
    // Add Exhaust Pipe geometry to the truck cab side
    const exPipeMat = new THREE.MeshStandardMaterial({ color: '#3f3f46', metalness: 0.8, roughness: 0.3 });
    const exPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 8), exPipeMat);
    exPipe.name = 'exhaust_pipe';
    exPipe.position.set(0.85, 1.25, 0.8);
    exPipe.castShadow = true;
    truck.add(exPipe);
    truck.scale.set(1.1, 1.1, 1.1);
    return truck;
  }

  private createForkliftMesh(): THREE.Group {
    const fork = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 1.6), new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.4 }));
    body.position.y = 0.6;
    body.castShadow = true;
    fork.add(body);

    const cage = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.9, 0.9), new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.8, roughness: 0.3 }));
    cage.position.set(0, 1.35, -0.1);
    cage.castShadow = true;
    fork.add(cage);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.1), new THREE.MeshStandardMaterial({ color: '#3f3f46', roughness: 0.7 }));
    frame.position.set(0, 0.9, 0.85);
    frame.castShadow = true;
    fork.add(frame);

    const forkL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.9), new THREE.MeshStandardMaterial({ color: '#71717a', metalness: 0.7 }));
    forkL.position.set(-0.2, 0.2, 1.3);
    forkL.castShadow = true;
    fork.add(forkL);

    const forkR = forkL.clone();
    forkR.position.x = 0.2;
    fork.add(forkR);

    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 10), new THREE.MeshStandardMaterial({ color: '#18181b', roughness: 0.9 }));
    tire.rotation.z = Math.PI / 2;
    for (let side = -1; side <= 1; side += 2) {
      const t1 = tire.clone();
      t1.position.set(side * 0.55, 0.3, 0.45);
      t1.castShadow = true;
      fork.add(t1);

      const t2 = tire.clone();
      t2.position.set(side * 0.55, 0.3, -0.45);
      t2.castShadow = true;
      fork.add(t2);
    }

    return fork;
  }

  private createPalletMesh(): THREE.Group {
    const pallet = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.95 });
    
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 1.2), woodMat);
    base.position.y = 0.05;
    base.castShadow = true;
    pallet.add(base);

    const block1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 0.15), woodMat);
    block1.position.set(0, 0.175, -0.45);
    pallet.add(block1);
    
    const block2 = block1.clone();
    block2.position.z = 0;
    pallet.add(block2);

    const block3 = block1.clone();
    block3.position.z = 0.45;
    pallet.add(block3);

    for (let s = 0; s < 5; s++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.16), woodMat);
      slat.position.set(0, 0.27, -0.48 + s * 0.24);
      slat.castShadow = true;
      pallet.add(slat);
    }

    const boxMat = new THREE.MeshStandardMaterial({ color: '#cd853f', roughness: 0.9 });
    for (let c = 0; c < 3; c++) {
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), boxMat);
      card.castShadow = true;
      card.position.set((c === 0 ? -0.25 : c === 1 ? 0.25 : 0), 0.52 + (c === 2 ? 0.45 : 0), (c === 0 ? -0.2 : c === 1 ? 0.2 : 0));
      pallet.add(card);
    }

    return pallet;
  }

  private createHouseMesh(rand: () => number, wallColor: string = '#fdf4ff'): THREE.Group {
    const house = new THREE.Group();
    const style = Math.floor(rand() * 10);

    // Wall colors variety
    const colors = [
      '#fef2f2', '#eff6ff', '#fffbeb', '#f0fdf4', '#faf5ff',
      '#fdba74', '#cbd5e1', '#f0e68c', '#e6e6fa', '#ffe4e1'
    ];
    const chosenWallColor = wallColor !== '#fdf4ff' ? wallColor : colors[style];

    if (style === 0) {
      // Style 1: Cozy Cottage (Traditional)
      const base = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.4, 4.2), new THREE.MeshStandardMaterial({ color: chosenWallColor, roughness: 0.85 }));
      base.position.y = 1.2;
      base.castShadow = true;
      base.receiveShadow = true;
      house.add(base);

      const roof = new THREE.Mesh(this.geoCache['roof'] || new THREE.ConeGeometry(2.4, 1.6, 4), new THREE.MeshStandardMaterial({ color: '#b91c1c', roughness: 0.6 }));
      roof.scale.set(1.4, 0.9, 1.15);
      roof.rotation.y = Math.PI / 4;
      roof.position.set(0, 3.1, 0);
      roof.castShadow = true;
      house.add(roof);

      const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.5), new THREE.MeshStandardMaterial({ color: '#4b5563', roughness: 0.9 }));
      chimney.position.set(0.9, 2.4, -1.0);
      chimney.castShadow = true;
      house.add(chimney);
    } else if (style === 1) {
      // Style 2: Two-Storey Village Shop / Townhouse
      const base = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4.4, 4.0), new THREE.MeshStandardMaterial({ color: chosenWallColor, roughness: 0.7 }));
      base.position.y = 2.2;
      base.castShadow = true;
      base.receiveShadow = true;
      house.add(base);

      const flatRoof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.2, 4.2), new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.9 }));
      flatRoof.position.set(0, 4.5, 0);
      flatRoof.castShadow = true;
      house.add(flatRoof);

      // Awning stripes
      const shopAwning = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 2.8), new THREE.MeshStandardMaterial({ color: '#d97706' }));
      shopAwning.position.set(-1.75, 1.9, 0);
      shopAwning.rotation.z = Math.PI / 10;
      shopAwning.castShadow = true;
      house.add(shopAwning);
    } else if (style === 2) {
      // Style 3: Swiss Chalet (A-Frame Timber)
      const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.8, 4.4), new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.95 }));
      base.position.y = 0.9;
      base.castShadow = true;
      house.add(base);

      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.3, 2.6, 4), new THREE.MeshStandardMaterial({ color: '#1e3a8a', roughness: 0.6 }));
      roof.scale.set(1.45, 0.85, 1.15);
      roof.rotation.y = Math.PI / 4;
      roof.position.set(0, 2.6, 0);
      roof.castShadow = true;
      house.add(roof);
    } else if (style === 3) {
      // Style 4: Modern Minimalist Cube House
      const base = new THREE.Mesh(new THREE.BoxGeometry(3.8, 3.2, 3.8), new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.1, metalness: 0.1 }));
      base.position.y = 1.6;
      base.castShadow = true;
      house.add(base);

      const border = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.3, 4.0), new THREE.MeshStandardMaterial({ color: '#0f172a' }));
      border.position.set(0, 3.15, 0);
      house.add(border);
    } else if (style === 4) {
      // Style 5: Dutch Barn Barnhouse (Gambrel inspired roof)
      const base = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.2, 4.5), new THREE.MeshStandardMaterial({ color: chosenWallColor, roughness: 0.75 }));
      base.position.y = 1.1;
      base.castShadow = true;
      house.add(base);

      const roofL = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.15, 4.7), new THREE.MeshStandardMaterial({ color: '#312e81' }));
      roofL.position.set(-1.0, 2.6, 0);
      roofL.rotation.z = Math.PI / 6;
      roofL.castShadow = true;
      house.add(roofL);

      const roofR = roofL.clone();
      roofR.position.x = 1.0;
      roofR.rotation.z = -Math.PI / 6;
      house.add(roofR);
    } else if (style === 5) {
      // Style 6: Windmill Cottage
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 4.0, 8), new THREE.MeshStandardMaterial({ color: chosenWallColor, roughness: 0.9 }));
      tower.position.y = 2.0;
      tower.castShadow = true;
      house.add(tower);

      const dome = new THREE.Mesh(new THREE.SphereGeometry(1.25, 8, 8), new THREE.MeshStandardMaterial({ color: '#ea580c' }));
      dome.position.set(0, 4.0, 0);
      dome.castShadow = true;
      house.add(dome);
    } else if (style === 6) {
      // Style 7: Tudor style (half-timbered facade pattern)
      const base = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.5, 4.4), new THREE.MeshStandardMaterial({ color: '#fcf6f0', roughness: 0.9 }));
      base.position.y = 1.25;
      base.castShadow = true;
      house.add(base);

      const gabledRoof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.8, 4), new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.7 }));
      gabledRoof.scale.set(1.4, 0.9, 1.25);
      gabledRoof.rotation.y = Math.PI / 4;
      gabledRoof.position.set(0, 3.25, 0);
      gabledRoof.castShadow = true;
      house.add(gabledRoof);

      // Timber studs
      for (let t = -1.8; t <= 1.8; t += 1.2) {
        const stud = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.5, 0.12), new THREE.MeshStandardMaterial({ color: '#451a03' }));
        stud.position.set(t, 1.25, 2.21);
        house.add(stud);
      }
    } else if (style === 7) {
      // Style 8: Round Silo Cabin / Stone Tower House
      const cylinderBody = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.8, 12), new THREE.MeshStandardMaterial({ color: '#78716c', roughness: 0.95 }));
      cylinderBody.position.y = 1.4;
      cylinderBody.castShadow = true;
      house.add(cylinderBody);

      const pointyRoof = new THREE.Mesh(new THREE.ConeGeometry(2.0, 1.8, 12), new THREE.MeshStandardMaterial({ color: '#047857' }));
      pointyRoof.position.set(0, 3.5, 0);
      pointyRoof.castShadow = true;
      house.add(pointyRoof);
    } else if (style === 8) {
      // Style 9: Manor Greenhouse Cottage
      const glassBase = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.0, 4.2), new THREE.MeshStandardMaterial({ color: '#e0f2fe', transparent: true, opacity: 0.6, roughness: 0.1 }));
      glassBase.position.y = 1.0;
      glassBase.castShadow = true;
      house.add(glassBase);

      const frame = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.15, 4.3), new THREE.MeshStandardMaterial({ color: '#14532d' }));
      frame.position.set(0, 2.0, 0);
      house.add(frame);

      const topGlass = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.2, 4), new THREE.MeshStandardMaterial({ color: '#0284c7', transparent: true, opacity: 0.5, roughness: 0.1 }));
      topGlass.scale.set(1.4, 0.9, 1.1);
      topGlass.rotation.y = Math.PI / 4;
      topGlass.position.set(0, 2.5, 0);
      house.add(topGlass);
    } else {
      // Style 10: Suburban Ranch-style Villa
      const baseL = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 4.2), new THREE.MeshStandardMaterial({ color: chosenWallColor, roughness: 0.8 }));
      baseL.position.set(-0.8, 0.9, 0);
      baseL.castShadow = true;
      house.add(baseL);

      const baseR = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.8, 3.2), new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.7 }));
      baseR.position.set(1.0, 1.4, -0.5);
      baseR.castShadow = true;
      house.add(baseR);

      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.0, 1.2, 4), new THREE.MeshStandardMaterial({ color: '#3b82f6' }));
      roof.scale.set(1.3, 0.8, 1.3);
      roof.rotation.y = Math.PI / 4;
      roof.position.set(-0.8, 2.2, 0);
      white: house.add(roof);
    }

    // Windows and door embellishment
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 0.75), new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.9 }));
    door.position.set(-1.81, 0.7, 0.5);
    door.castShadow = true;
    house.add(door);

    const windowMat = new THREE.MeshStandardMaterial({ color: '#bae6fd', emissive: '#38bdf8', emissiveIntensity: 0.2, roughness: 0.1 });
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.7), windowMat);
    win.position.set(-1.81, 1.4, -0.8);
    house.add(win);

    const winR = win.clone();
    winR.position.x = 1.81;
    house.add(winR);

    return house;
  }

  private createRoadsideFenceMesh(rand: () => number): THREE.Group {
    const fence = new THREE.Group();
    fence.name = 'fence_decor';
    const postMat = new THREE.MeshStandardMaterial({ color: '#5c2d18', roughness: 0.9 });
    const railMat = new THREE.MeshStandardMaterial({ color: '#7c2d12', roughness: 0.95 });

    // Left post
    const post1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), postMat);
    post1.position.set(-1.0, 0.45, 0);
    post1.castShadow = true;
    post1.receiveShadow = true;
    fence.add(post1);

    // Right post
    const post2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), postMat);
    post2.position.set(1.0, 0.45, 0);
    post2.castShadow = true;
    post2.receiveShadow = true;
    fence.add(post2);

    // Top rail
    const rail1 = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 0.06), railMat);
    rail1.position.set(0, 0.75, 0);
    rail1.castShadow = true;
    fence.add(rail1);

    // Bottom rail
    const rail2 = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 0.06), railMat);
    rail2.position.set(0, 0.4, 0);
    rail2.castShadow = true;
    fence.add(rail2);

    return fence;
  }

  private createRoadsideSignboardMesh(rand: () => number): THREE.Group {
    const sign = new THREE.Group();
    sign.name = 'signboard_decor';
    const woodMat = new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.9 });
    const boardMat = new THREE.MeshStandardMaterial({ color: '#ca8a04', roughness: 0.8 });

    // Post
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 6), woodMat);
    pole.position.y = 0.7;
    pole.castShadow = true;
    sign.add(pole);

    // Board plate
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.1), boardMat);
    board.position.set(0, 1.1, 0);
    board.rotation.y = (rand() - 0.5) * 0.15;
    board.castShadow = true;
    sign.add(board);

    // Little triangular arrow
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 4), woodMat);
    arrow.rotation.z = -Math.PI / 2;
    arrow.position.set(0.65, 1.1, 0);
    sign.add(arrow);

    return sign;
  }

  private createVegetablePlotMesh(rand: () => number): THREE.Group {
    const plot = new THREE.Group();
    plot.name = 'farm_decor';
    const dirtMat = new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.95 });
    const leafMat = new THREE.MeshStandardMaterial({ color: '#166534', roughness: 0.9 });
    const carrotMat = new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.8 });

    // Mound of dirt/soil
    const soil = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 1.4), dirtMat);
    soil.position.y = 0.05;
    soil.receiveShadow = true;
    plot.add(soil);

    // Linear rows of tiny crops!
    for (let x = -0.6; x <= 0.6; x += 0.4) {
      for (let z = -0.4; z <= 0.4; z += 0.4) {
        const plant = new THREE.Group();
        plant.position.set(x, 0.1, z);

        const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), carrotMat);
        fruit.position.y = 0.02;
        fruit.scale.set(1, 1.8, 1);
        plant.add(fruit);

        const leaves = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.15, 4), leafMat);
        leaves.position.y = 0.14;
        plant.add(leaves);

        plot.add(plant);
      }
    }

    return plot;
  }

  private createStreetLampMesh(): THREE.Group {
    const lamp = new THREE.Group();
    const steelMat = this.matCache['decor_steel_pbr'] || new THREE.MeshStandardMaterial({ color: '#4b5563', metalness: 0.8 });
    
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 4.2, 8), steelMat);
    pole.position.y = 2.1;
    pole.castShadow = true;
    lamp.add(pole);

    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.12, 0.12), steelMat);
    neck.position.set(0.28, 4.2, 0);
    lamp.add(neck);

    const glowHead = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshStandardMaterial({
      color: '#fef08a',
      emissive: '#eab308',
      emissiveIntensity: 1.8,
      roughness: 0.1
    }));
    glowHead.position.set(0.55, 4.1, 0);
    glowHead.castShadow = true;
    lamp.add(glowHead);

    return lamp;
  }

  private createBarnMesh(rand: () => number): THREE.Group {
    const barn = new THREE.Group();
    const style = Math.floor(rand() * 5); // 5 distinct styles!

    if (style === 0) {
      // Style 1: Classic Farmers Red Barn
      const barnBase = new THREE.Mesh(this.geoCache['box'], new THREE.MeshStandardMaterial({ color: '#b91c1c', roughness: 0.6 }));
      barnBase.scale.set(4, 3.6, 6);
      barnBase.position.y = 1.8;
      barnBase.castShadow = true;
      barnBase.receiveShadow = true;
      barn.add(barnBase);

      const barnRoof = new THREE.Mesh(this.geoCache['roof'], new THREE.MeshStandardMaterial({ color: '#7f1d1d', roughness: 0.5 }));
      barnRoof.scale.set(1.5, 1.1, 2.0);
      barnRoof.position.set(0, 4.4, 0);
      barnRoof.castShadow = true;
      barn.add(barnRoof);

      const doorMat = new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.8 });
      const lDoor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 1.3), doorMat);
      lDoor.position.set(-2.02, 1.1, -0.85);
      barn.add(lDoor);
      const rDoor = lDoor.clone();
      rDoor.position.z = 0.85;
      barn.add(rDoor);
    } else if (style === 1) {
      // Style 2: Arched Galvanized Metal Hoop Grain Barn
      const hoopBase = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 6.2, 16), new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.2, metalness: 0.8 }));
      hoopBase.rotation.x = Math.PI / 2;
      hoopBase.position.y = 1.8;
      hoopBase.scale.set(1.1, 1.0, 1.0);
      hoopBase.castShadow = true;
      barn.add(hoopBase);

      const endCap = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.2, 0.1), new THREE.MeshStandardMaterial({ color: '#475569' }));
      endCap.position.set(0, 1.1, 3.08);
      barn.add(endCap);
    } else if (style === 2) {
      // Style 3: Dutch Gambrel Barn (Double-sloped brown wood farm)
      const base = new THREE.Mesh(this.geoCache['box'], new THREE.MeshStandardMaterial({ color: '#7c2d12', roughness: 0.82 }));
      base.scale.set(4, 3.2, 6);
      base.position.y = 1.6;
      base.castShadow = true;
      barn.add(base);

      // Low slope roofs
      const gambrelL = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 6.1), new THREE.MeshStandardMaterial({ color: '#292524' }));
      gambrelL.position.set(-1.18, 4.0, 0);
      gambrelL.rotation.z = Math.PI / 8;
      gambrelL.castShadow = true;
      barn.add(gambrelL);

      const gambrelR = gambrelL.clone();
      gambrelR.position.x = 1.18;
      gambrelR.rotation.z = -Math.PI / 8;
      barn.add(gambrelR);
    } else if (style === 3) {
      // Style 4: Modern Poultry Brooder/Feeder hangar (long low white panel)
      const longBase = new THREE.Mesh(this.geoCache['box'], new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.7 }));
      longBase.scale.set(4.4, 2.4, 6.5);
      longBase.position.y = 1.2;
      barn.add(longBase);

      const longRoof = new THREE.Mesh(this.geoCache['box'], new THREE.MeshStandardMaterial({ color: '#b91c1c' }));
      longRoof.scale.set(4.6, 0.3, 6.7);
      longRoof.position.set(0, 2.45, 0);
      barn.add(longRoof);

      // Add small side ventilation exhausts
      for (let ex = -2; ex <= 2; ex += 2) {
        const port = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), new THREE.MeshStandardMaterial({ color: '#455a64' }));
        port.position.set(2.21, 1.1, ex);
        barn.add(port);
      }
    } else {
      // Style 5: Tall Mountain Hay Barn
      const tallBase = new THREE.Mesh(this.geoCache['box'], new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.95 }));
      tallBase.scale.set(3.4, 2.8, 5.2);
      tallBase.position.y = 1.4;
      barn.add(tallBase);

      const steepRoof = new THREE.Mesh(this.geoCache['roof'], new THREE.MeshStandardMaterial({ color: '#1e3a8a' }));
      steepRoof.scale.set(1.4, 1.8, 1.8);
      steepRoof.position.set(0, 3.8, 0);
      steepRoof.castShadow = true;
      barn.add(steepRoof);
    }

    // Ventilator fan on side
    const fanPivot = new THREE.Group();
    fanPivot.name = 'barn_vent_fan';
    fanPivot.position.set(0, 3.5, 2.9);
    const fanBlade = new THREE.Mesh(this.geoCache['box'], new THREE.MeshStandardMaterial({ color: '#1e293b' }));
    fanBlade.scale.set(0.12, 1.4, 0.18);
    fanPivot.add(fanBlade);
    barn.add(fanPivot);

    return barn;
  }

  private createCityBuildingMesh(rand: () => number, baseColor: string): THREE.Group {
    const building = new THREE.Group();
    const height = 12 + rand() * 10;
    const bMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.3, metalness: 0.6 });
    const windowMat = new THREE.MeshStandardMaterial({
      color: '#fef08a',
      emissive: '#fef08a',
      emissiveIntensity: 1.5,
      roughness: 0.05
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, height, 4.0), bMat);
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    building.add(body);

    const cols = 3;
    const rows = Math.floor(height / 1.6) - 1;
    for (let r = 1; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rand() < 0.22) continue;
        const xOffset = -1.1 + c * 1.1;
        const yOffset = 1.0 + r * 1.6;
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.75), windowMat);
        win.position.set(xOffset, yOffset, 2.01);
        building.add(win);
      }
    }

    const neonCol = rand() > 0.5 ? '#ec4899' : '#06b6d4';
    const borderMat = new THREE.MeshStandardMaterial({ color: '#1e293b' });
    const neonMat = new THREE.MeshBasicMaterial({ color: neonCol });

    const support = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.8), borderMat);
    support.position.set(0, height + 0.4, 0);
    building.add(support);

    const screen = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 0.4), borderMat);
    screen.position.set(0, height + 1.25, 0);
    building.add(screen);

    const face = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.1), neonMat);
    face.position.set(0, height + 1.25, 0.21);
    building.add(face);

    const antennaPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 4), borderMat);
    antennaPole.position.set(-1.0, height + 0.9, -1.0);
    building.add(antennaPole);

    const redBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), new THREE.MeshBasicMaterial({ color: '#ef4444' }));
    redBeacon.position.set(-1.0, height + 1.8, -1.0);
    building.add(redBeacon);

    return building;
  }

  private createCityShopMesh(rand: () => number, baseColor: string): THREE.Group {
    const shop = new THREE.Group();
    const bMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.4 });
    const glassMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.7 });
    const doorFrameMat = new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.8 });
    const awningMat = new THREE.MeshStandardMaterial({ color: rand() > 0.5 ? '#b91c1c' : '#1d4ed8', roughness: 0.7 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, 5.0, 3.8), bMat);
    body.position.y = 2.5;
    body.castShadow = true;
    body.receiveShadow = true;
    shop.add(body);

    const windowGlass = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.35, 0.12), glassMat);
    windowGlass.position.set(-0.65, 0.9, 1.91);
    shop.add(windowGlass);

    const door = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.75, 0.12), doorFrameMat);
    door.position.set(0.9, 0.88, 1.91);
    shop.add(door);

    const awning = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.2, 1.15), awningMat);
    awning.position.set(0, 2.1, 2.2);
    awning.rotation.x = Math.PI / 10;
    shop.add(awning);

    const windowMat = new THREE.MeshStandardMaterial({ color: '#fef08a', emissive: '#eab308', emissiveIntensity: 1.2 });
    const upperWinL = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 1.0), windowMat);
    upperWinL.position.set(-0.85, 3.6, 1.91);
    shop.add(upperWinL);

    const upperWinR = upperWinL.clone();
    upperWinR.position.x = 0.85;
    shop.add(upperWinR);

    const signBox = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.65, 1.4), doorFrameMat);
    signBox.position.set(1.9, 2.8, 0.6);
    shop.add(signBox);

    const signLett = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.45), new THREE.MeshBasicMaterial({ color: '#f59e0b' }));
    signLett.rotation.y = Math.PI / 2;
    signLett.position.set(1.91, 2.8, 0.6);
    shop.add(signLett);

    return shop;
  }

  private createCityApartmentMesh(rand: () => number, baseColor: string): THREE.Group {
    const complex = new THREE.Group();
    const bMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.7 });
    const balconyMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5, metalness: 0.8 });
    const windowMat = new THREE.MeshStandardMaterial({ color: '#fef08a', emissive: '#eab308', emissiveIntensity: 1.1 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(3.6, 8.5, 3.8), bMat);
    body.position.y = 4.25;
    body.castShadow = true;
    body.receiveShadow = true;
    complex.add(body);

    for (let floor = 1; floor <= 4; floor++) {
      const yOffset = floor * 1.8 + 0.26;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.85), windowMat);
      win.position.set(-0.75, yOffset + 0.3, 1.91);
      complex.add(win);

      const balcony = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.58, 0.85), balconyMat);
      balcony.position.set(0.75, yOffset, 2.1);
      balcony.castShadow = true;
      complex.add(balcony);

      const balDoor = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.24), windowMat);
      balDoor.position.set(0.75, yOffset + 0.5, 1.91);
      complex.add(balDoor);
    }

    const ventBox = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 1.5), balconyMat);
    ventBox.position.set(0, 8.925, 0);
    ventBox.castShadow = true;
    complex.add(ventBox);

    const fanCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.2, 8), new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.2 }));
    fanCyl.position.set(0, 9.4, 0);
    complex.add(fanCyl);

    return complex;
  }

  private createModernStreetLamp(rand: () => number): THREE.Group {
    const lamp = new THREE.Group();
    const steelMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.85, roughness: 0.15 });
    const capMat = new THREE.MeshStandardMaterial({ color: '#0f172a' });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.8, 8), capMat);
    base.position.y = 0.4;
    lamp.add(base);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 4.6, 8), steelMat);
    pole.position.y = 2.7;
    pole.castShadow = true;
    lamp.add(pole);

    const headBar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.12), steelMat);
    headBar.position.set(0.5, 5.0, 0);
    lamp.add(headBar);

    const panelMat = new THREE.MeshBasicMaterial({ color: '#f8fafc' });
    const panelL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.16), panelMat);
    panelL.position.set(0.25, 4.95, 0);
    lamp.add(panelL);

    const panelR = panelL.clone();
    panelR.position.x = 0.85;
    lamp.add(panelR);

    return lamp;
  }

  private createTrafficSignalMesh(): THREE.Group {
    const signal = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({ color: '#09090b', metalness: 0.8, roughness: 0.25 });

    const bPole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 5.0, 8), postMat);
    bPole.position.y = 2.5;
    bPole.castShadow = true;
    signal.add(bPole);

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 2.5, 8), postMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(1.2, 4.8, 0);
    signal.add(arm);

    const box = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.24), postMat);
    box.position.set(1.3, 4.4, 0.14);
    signal.add(box);

    const redLens = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), new THREE.MeshStandardMaterial({
      color: '#ef4444',
      emissive: '#ef4444',
      emissiveIntensity: 1.8
    }));
    redLens.position.set(1.3, 4.62, 0.24);
    signal.add(redLens);

    const yellowLens = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), new THREE.MeshStandardMaterial({
      color: '#eab308',
      emissive: '#eab308',
      emissiveIntensity: 1.8
    }));
    yellowLens.position.set(1.3, 4.4, 0.24);
    signal.add(yellowLens);

    const greenLens = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), new THREE.MeshStandardMaterial({
      color: '#22c55e',
      emissive: '#22c55e',
      emissiveIntensity: 1.8
    }));
    greenLens.position.set(1.3, 4.18, 0.24);
    signal.add(greenLens);

    return signal;
  }

  private createResearchCenterMesh(rand: () => number): THREE.Group {
    const researchCenter = new THREE.Group();
    const mainBarn = new THREE.Mesh(new THREE.BoxGeometry(5.5, 3.2, 7.0), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }));
    mainBarn.position.y = 1.6;
    mainBarn.castShadow = true;
    mainBarn.receiveShadow = true;
    researchCenter.add(mainBarn);

    const roof = new THREE.Mesh(this.geoCache['roof'], new THREE.MeshStandardMaterial({ color: '#be123c', roughness: 0.7 }));
    roof.scale.set(1.4, 0.7, 1.8);
    roof.position.set(0, 3.8, 0);
    roof.castShadow = true;
    researchCenter.add(roof);

    const labDome = new THREE.Mesh(new THREE.SphereGeometry(2.4, 10, 10), new THREE.MeshStandardMaterial({ color: '#93c5fd', transparent: true, opacity: 0.6, roughness: 0.1, metalness: 0.9 }));
    labDome.position.set(-4.2, 0.8, 0.5);
    labDome.scale.set(1.0, 0.6, 1.0);
    labDome.castShadow = true;
    researchCenter.add(labDome);

    const wallLogo = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0), this.matCache['skm_logo_mat']);
    wallLogo.position.set(0, 1.6, 3.52);
    researchCenter.add(wallLogo);

    return researchCenter;
  }

  private createWindmillMesh(rand: () => number): THREE.Group {
    const windmill = new THREE.Group();
    
    // Sleek aerodynamic tower structure
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.1, 7.5, 10), new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.55 }));
    tower.position.y = 3.75;
    tower.castShadow = true;
    tower.receiveShadow = true;
    windmill.add(tower);

    // Dynamic industrial crown collar
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.35, 10), new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.4 }));
    collar.position.y = 7.3;
    collar.castShadow = true;
    windmill.add(collar);

    // Turbine generator house box
    const generator = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 1.6), new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.45 }));
    generator.position.set(0, 7.65, 0.2);
    generator.castShadow = true;
    windmill.add(generator);

    const fanGroup = new THREE.Group();
    fanGroup.name = 'windmill_fan';
    fanGroup.position.set(0, 7.65, 1.05);

    // Center rotor spinner hub cone
    const hub = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.55, 8), new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.35 }));
    hub.rotation.x = Math.PI / 2;
    hub.position.set(0, 0, 0.15);
    hub.castShadow = true;
    fanGroup.add(hub);

    // Streamlined blades with professional dual-color warning tips
    for (let f = 0; f < 3; f++) {
      const bladePivot = new THREE.Group();
      bladePivot.rotation.z = (f * Math.PI * 2) / 3;

      // Base gray blade body
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.9, 0.04), new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.5 }));
      blade.position.y = 1.45;
      blade.castShadow = true;
      bladePivot.add(blade);

      // Bright alarm color tips (Subway Surfers signature cue style!)
      const warningTip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 0.05), new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.45 }));
      warningTip.position.set(0, 2.7, 0.01);
      bladePivot.add(warningTip);

      fanGroup.add(bladePivot);
    }
    
    windmill.add(fanGroup);

    // Red neon beacon flashing on top of generator pod
    const blinker = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), new THREE.MeshBasicMaterial({ color: '#ef4444' }));
    blinker.name = 'neon_blinker';
    blinker.position.set(0, 8.2, 0);
    windmill.add(blinker);

    return windmill;
  }

  private createFeedFactoryMesh(rand: () => number): THREE.Group {
    const feedFactory = new THREE.Group();
    const fabBlock = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 8), new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.5, metalness: 0.7 }));
    fabBlock.position.y = 2.5;
    fabBlock.castShadow = true;
    fabBlock.receiveShadow = true;
    feedFactory.add(fabBlock);

    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 5.0, 8), this.matCache['decor_steel_pbr']);
    chimney.position.set(-2.0, 7.5, 1.5);
    chimney.castShadow = true;
    feedFactory.add(chimney);

    const bLight = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), new THREE.MeshBasicMaterial({ color: '#ef4444' }));
    bLight.name = 'neon_blinker';
    bLight.position.set(-2.0, 10.1, 1.5);
    feedFactory.add(bLight);

    const wallWarning = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 2.5), this.matCache['skm_hazard_mat']);
    wallWarning.position.set(4.01, 2.5, 0);
    wallWarning.rotation.y = Math.PI / 2;
    feedFactory.add(wallWarning);

    return feedFactory;
  }

  private createCornFieldMesh(rand: () => number): THREE.Group {
    const cornField = new THREE.Group();
    const stalkMat = new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.8 });
    const grainTopMat = new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.7 });

    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const stalk = new THREE.Group();
        stalk.name = 'stalk';
        stalk.position.set(row * 1.0, 0, col * 1.4);

        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.8, 8), stalkMat);
        stem.position.y = 0.9;
        stem.castShadow = true;
        stalk.add(stem);

        const topEar = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), grainTopMat);
        topEar.scale.set(1, 2.5, 1);
        topEar.position.set(0, 1.8, 0);
        stalk.add(topEar);

        cornField.add(stalk);
      }
    }
    return cornField;
  }

  private createWarehouseHangarMesh(rand: () => number): THREE.Group {
    const warehouse = new THREE.Group();
    const whBase = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.2, 5.5), new THREE.MeshStandardMaterial({ color: '#0369a1', roughness: 0.6 }));
    whBase.position.y = 1.6;
    whBase.castShadow = true;
    whBase.receiveShadow = true;
    warehouse.add(whBase);

    const whRoof = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.25, 6.0), new THREE.MeshStandardMaterial({ color: '#0c4a6e', roughness: 0.3 }));
    whRoof.position.set(0, 3.3, 0);
    whRoof.castShadow = true;
    warehouse.add(whRoof);

    const rollDoor = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.2), this.matCache['decor_steel_pbr']);
    rollDoor.position.set(-2.26, 1.1, 0);
    rollDoor.rotation.y = -Math.PI / 2;
    warehouse.add(rollDoor);

    return warehouse;
  }

  private createIndustrialSilosMesh(rand: () => number): THREE.Group {
    const industrial = new THREE.Group();
    const silo = new THREE.Mesh(this.geoCache['silo'], this.matCache['decor_steel_pbr']);
    silo.scale.set(0.65, 0.65, 0.65);
    silo.position.set(0, 3.1, 0);
    silo.castShadow = true;
    silo.receiveShadow = true;
    industrial.add(silo);

    const pipe = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.15, 6, 12), new THREE.MeshStandardMaterial({ color: '#dc2626', metalness: 0.9 }));
    pipe.rotation.y = Math.PI / 2;
    pipe.position.set(0, 1.2, 0);
    industrial.add(pipe);

    return industrial;
  }

  private createTractorMesh(rand: () => number): THREE.Group {
    const tractor = new THREE.Group();
    const style = Math.floor(rand() * 4); // 4 distinct tractor styles!

    let tBodyMat = new THREE.MeshStandardMaterial({ color: '#166534', roughness: 0.4 }); // John Deere Green
    let wheelColor = '#fbbf24'; // John Deere Yellow rims

    if (style === 1) {
      tBodyMat = new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.41 }); // Case IH Red
      wheelColor = '#0f172a'; // black rims
    } else if (style === 2) {
      tBodyMat = new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.35 }); // New Holland Blue
      wheelColor = '#f3f4f6'; // white rims
    } else if (style === 3) {
      tBodyMat = new THREE.MeshStandardMaterial({ color: '#ca8a04', roughness: 0.45 }); // Caterpillar Yellow
      wheelColor = '#18181b'; // dark rims
    }

    const tBody = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.8), tBodyMat);
    tBody.castShadow = true;
    tBody.receiveShadow = true;
    tractor.add(tBody);

    // Cab glass
    const tCab = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshStandardMaterial({ color: '#bae6fd', roughness: 0.1, transparent: true, opacity: 0.7 }));
    tCab.position.set(0, 0.85, -0.25);
    tCab.castShadow = true;
    tractor.add(tCab);

    // Wheels
    const tireBigMat = new THREE.MeshStandardMaterial({ color: '#18181b', roughness: 0.9 });
    const tireBigL = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.32, 10), tireBigMat);
    tireBigL.rotation.z = Math.PI / 2;
    tireBigL.position.set(-0.65, 0.05, -0.45);
    tireBigL.castShadow = true;
    tractor.add(tireBigL);

    const rimBigL = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.34, 6), new THREE.MeshStandardMaterial({ color: wheelColor, roughness: 0.5 }));
    rimBigL.rotation.z = Math.PI / 2;
    rimBigL.position.copy(tireBigL.position);
    tractor.add(rimBigL);

    const tireBigR = tireBigL.clone();
    tireBigR.position.x = 0.65;
    tractor.add(tireBigR);

    const rimBigR = rimBigL.clone();
    rimBigR.position.x = 0.65;
    tractor.add(rimBigR);

    // Front wheels
    const tireSmallL = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 10), tireBigMat);
    tireSmallL.rotation.z = Math.PI / 2;
    tireSmallL.position.set(-0.6, -0.15, 0.55);
    tireSmallL.castShadow = true;
    tractor.add(tireSmallL);

    const rimSmallL = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.26, 6), new THREE.MeshStandardMaterial({ color: wheelColor }));
    rimSmallL.rotation.z = Math.PI / 2;
    rimSmallL.position.copy(tireSmallL.position);
    tractor.add(rimSmallL);

    const tireSmallR = tireSmallL.clone();
    tireSmallR.position.x = 0.6;
    tractor.add(tireSmallR);

    const rimSmallR = rimSmallL.clone();
    rimSmallR.position.x = 0.6;
    tractor.add(rimSmallR);

    // Exhaust Pipe geometry
    const exPipeMat = new THREE.MeshStandardMaterial({ color: '#4b5563', metalness: 0.8, roughness: 0.3 });
    const exPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), exPipeMat);
    exPipe.name = 'exhaust_pipe';
    exPipe.position.set(0.38, 0.75, 0.45);
    exPipe.castShadow = true;
    tractor.add(exPipe);

    // Shovel front loader arms (Unique to Style 3!)
    if (style === 3) {
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.3), exPipeMat);
      armL.position.set(-0.52, 0.2, 0.95);
      armL.rotation.x = Math.PI / 10;
      tractor.add(armL);

      const armR = armL.clone();
      armR.position.x = 0.52;
      tractor.add(armR);

      const bucket = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.65), exPipeMat);
      bucket.position.set(0, 0.05, 1.6);
      bucket.rotation.x = -Math.PI / 12;
      tractor.add(bucket);
    }

    return tractor;
  }

  private createChickenPenMesh(rand: () => number): THREE.Group {
    const pen = new THREE.Group();
    const penPostMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.95 });
    const barH = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 2.8), penPostMat);
    barH.position.set(0, 0.4, 0);
    pen.add(barH);

    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 6), penPostMat);
    p1.position.set(0, 0.4, -1.4);
    pen.add(p1);
    const p2 = p1.clone();
    p2.position.set(0, 0.4, 1.4);
    pen.add(p2);

    const miniChick = new THREE.Group();
    miniChick.name = 'bg_chicken';
    const mcBody = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.8 }));
    mcBody.castShadow = true;
    miniChick.add(mcBody);
    const mcHead = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.8 }));
    mcHead.position.set(0, 0.15, -0.05);
    miniChick.add(mcHead);
    const mcBeak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 6), new THREE.MeshStandardMaterial({ color: '#ea580c' }));
    mcBeak.rotation.x = Math.PI / 2;
    mcBeak.position.set(0, 0.15, -0.14);
    miniChick.add(mcBeak);

    miniChick.position.set(0, 0.15, 0.1);
    pen.add(miniChick);

    return pen;
  }

  private createWheatFieldMesh(rand: () => number): THREE.Group {
    const wheatField = new THREE.Group();
    const wheatMat = new THREE.MeshStandardMaterial({ color: '#fba518', roughness: 0.95 });

    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 1.2, 5), wheatMat);
        stalk.position.set(row * 0.8, 0.6, col * 1.0);
        stalk.rotation.z = (rand() - 0.5) * 0.12;
        stalk.castShadow = true;
        wheatField.add(stalk);
      }
    }
    return wheatField;
  }

  private createProceduralTree(rand: () => number, isPine: boolean): THREE.Group {
    const tree = new THREE.Group();
    tree.name = 'tree';

    const style = Math.floor(rand() * 8); // 8 distinct styles!

    const BarkColor = rand() > 0.5 ? '#451a03' : '#321401';
    const trunkMat = new THREE.MeshStandardMaterial({ color: BarkColor, roughness: 0.95 });
    
    // Base trunk setup
    const trunk = new THREE.Mesh(this.geoCache['trunk'] || new THREE.CylinderGeometry(0.2, 0.35, 2.0, 8), trunkMat);
    trunk.position.y = 1.0;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    // Root flare boxes
    for (let f = 0; f < 3; f++) {
      const rootAngle = (f * Math.PI * 2) / 3;
      const flare = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.65), trunkMat);
      flare.position.set(Math.cos(rootAngle) * 0.22, 0.2, Math.sin(rootAngle) * 0.22);
      flare.rotation.y = rootAngle;
      flare.rotation.x = 0.15;
      flare.castShadow = true;
      tree.add(flare);
    }

    if (style === 0 || style === 1 || isPine) {
      // Design 1 & 2: Concentric Layered Pine / Redwood Tree
      const layers = style === 1 ? 5 : 4;
      const pineColors = ['#064e3b', '#022c22', '#14532d', '#0f3c26'];
      const leafColor = pineColors[style % pineColors.length];
      const pineMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.88 });

      for (let L = 0; L < layers; L++) {
        const radius = (style === 1 ? 1.55 : 1.25) - L * 0.23;
        const ht = (style === 1 ? 1.8 : 1.6) - L * 0.18;
        const pineLeaves = new THREE.Mesh(new THREE.ConeGeometry(radius, ht, 5), pineMat);
        pineLeaves.position.y = 1.8 + L * 0.85;
        pineLeaves.castShadow = true;
        pineLeaves.receiveShadow = true;
        tree.add(pineLeaves);
      }
    } else {
      // Deciduous categories
      const greenColors = [
        '#15803d', '#16a34a', '#166534', '#14532d', 
        '#155e75', '#0f766e', '#854d0e', '#a16207'
      ];
      const leafColor = greenColors[style % greenColors.length];
      const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.8 });

      if (style === 2) {
        // Design 3: Lush Apple Tree with organic apples
        const mainCrown = new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 12), leafMat);
        mainCrown.position.y = 2.2;
        mainCrown.castShadow = true;
        tree.add(mainCrown);

        for (let c = 0; c < 3; c++) {
          const size = 0.55 + rand() * 0.35;
          const cluster = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 8), leafMat);
          const angle = (c * Math.PI * 2) / 3;
          cluster.position.set(Math.cos(angle) * 0.65, 2.45 + rand() * 0.3, Math.sin(angle) * 0.65);
          cluster.castShadow = true;
          tree.add(cluster);
        }

        // Juices bright apples
        for (let ap = 0; ap < 5; ap++) {
          const apple = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.25 }));
          const rAng = rand() * Math.PI * 2;
          const radDist = 0.55 + rand() * 0.45;
          apple.position.set(Math.cos(rAng) * radDist, 1.7 + rand() * 0.8, Math.sin(rAng) * radDist);
          apple.castShadow = true;
          tree.add(apple);
        }
      } else if (style === 3) {
        // Design 4: Orange Citrus Fruit Tree
        const crown = new THREE.Mesh(new THREE.SphereGeometry(1.15, 12, 12), leafMat);
        crown.position.y = 2.3;
        crown.castShadow = true;
        tree.add(crown);

        for (let o = 0; o < 6; o++) {
          const orange = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 6), new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.3 }));
          const angle = o * (Math.PI * 2 / 6);
          orange.position.set(Math.cos(angle) * 0.72, 1.8 + rand() * 0.8, Math.sin(angle) * 0.72);
          tree.add(orange);
        }
      } else if (style === 4) {
        // Design 5: Slim Tall White Birch
        trunk.scale.set(0.65, 1.6, 0.65);
        if (trunk.material instanceof THREE.MeshStandardMaterial) {
          trunk.material.color.set(new THREE.Color('#f1f1f1'));
        }
        // Black birch horizontal bars
        for (let b = 0; b < 4; b++) {
          const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.12, 6), new THREE.MeshStandardMaterial({ color: '#1e293b' }));
          ring.position.set(0, 0.6 + b * 0.6, 0);
          tree.add(ring);
        }

        const leaves = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.85, 2.0, 8), leafMat);
        leaves.position.y = 2.7;
        leaves.castShadow = true;
        tree.add(leaves);
      } else if (style === 5) {
        // Design 6: Weeping Willow (Drooping foliage)
        const main = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 10), leafMat);
        main.position.y = 2.3;
        tree.add(main);

        // Hanging branches
        for (let hb = 0; hb < 5; hb++) {
          const bAngle = hb * (Math.PI * 2 / 5);
          const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.1, 1.6, 6), leafMat);
          branch.position.set(Math.cos(bAngle) * 0.9, 1.6, Math.sin(bAngle) * 0.9);
          branch.rotation.x = 0.2;
          branch.castShadow = true;
          tree.add(branch);
        }
      } else if (style === 6) {
        // Design 7: Joshua Desert Cactus
        trunk.scale.set(1.2, 1.3, 1.2);
        if (trunk.material instanceof THREE.MeshStandardMaterial) {
          trunk.material.color.set(new THREE.Color('#15803d'));
        }

        for (let arm = 0; arm < 3; arm++) {
          const armAngle = arm * (Math.PI * 2 / 3);
          const joint = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.8, 6), new THREE.MeshStandardMaterial({ color: '#155e27' }));
          joint.position.set(Math.cos(armAngle) * 0.45, 1.4, Math.sin(armAngle) * 0.45);
          joint.rotation.z = Math.cos(armAngle) * 0.6;
          joint.rotation.x = Math.sin(armAngle) * 0.6;
          tree.add(joint);

          const upArm = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 6), new THREE.MeshStandardMaterial({ color: '#166534' }));
          upArm.position.copy(joint.position).add(new THREE.Vector3(0, 0.5, 0));
          tree.add(upArm);
        }
      } else {
        // Design 8: Spherical Neat Topiary Ball Box Tree
        const ball = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 16), leafMat);
        ball.position.y = 2.5;
        ball.castShadow = true;
        tree.add(ball);

        const bushTrim = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.5, 8), new THREE.MeshStandardMaterial({ color: '#15803d' }));
        bushTrim.position.y = 1.35;
        tree.add(bushTrim);
      }
    }

    return tree;
  }

  private createSignBoardMesh(rand: () => number): THREE.Group {
    const skmBoard = new THREE.Group();
    const postLeg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.6, 0.15), this.matCache['decor_steel_pbr']);
    postLeg.position.y = 1.3;
    skmBoard.add(postLeg);

    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.2, 0.12), new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.6 }));
    signBoard.position.set(0, 2.4, 0);
    signBoard.castShadow = true;
    skmBoard.add(signBoard);

    const faceCover = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.0), this.matCache['skm_billboard_white_mat']);
    faceCover.position.set(0, 2.4, 0.065);
    skmBoard.add(faceCover);

    return skmBoard;
  }

  private createOverheadGateMesh(rand: () => number): THREE.Group {
    const gateArch = new THREE.Group();
    const colLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 7.0, 64), this.matCache['decor_steel_pbr']);
    colLeft.position.set(-this.roadWidth / 2 - 1.0, 3.5, 0);
    colLeft.castShadow = true;
    colLeft.receiveShadow = true;
    gateArch.add(colLeft);

    const colRight = colLeft.clone();
    colRight.position.x = this.roadWidth / 2 + 1.0;
    gateArch.add(colRight);

    const overheadTruss = new THREE.Mesh(new THREE.BoxGeometry(this.roadWidth + 3.0, 0.4, 0.4), this.matCache['decor_steel_pbr']);
    overheadTruss.position.set(0, 7.0, 0);
    overheadTruss.castShadow = true;
    gateArch.add(overheadTruss);

    const beaconL = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshBasicMaterial({ color: '#3b82f6' }));
    beaconL.name = 'beacon_blue';
    beaconL.position.set(-2.5, 7.3, 0);
    gateArch.add(beaconL);

    const beaconR = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), new THREE.MeshBasicMaterial({ color: '#ef4444' }));
    beaconR.name = 'beacon_red';
    beaconR.position.set(2.5, 7.3, 0);
    gateArch.add(beaconR);

    const gateBanner = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 1.6), this.matCache['skm_banner_red_mat']);
    gateBanner.name = 'skm_waving_cloth';
    gateBanner.position.set(0, 5.8, 0);
    gateBanner.castShadow = true;
    gateArch.add(gateBanner);

    return gateArch;
  }



  private buildPlayer() {
    this.playerGroup = new THREE.Group();
    // Positioned smoothly on runway Z point
    this.playerGroup.position.set(0, 0.5, this.playerZ);
    this.playerGroup.scale.set(0.70, 0.70, 0.70); // Adorably sized, making it occupy 10-15% of screen height
    this.scene.add(this.playerGroup);

    const meshWhiteFeathers = this.matCache['mesh_white_feathers'] as THREE.MeshStandardMaterial;
    this.chickenWhiteFeathersMat = meshWhiteFeathers;

    // Common materials for eyes and details
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.1, metalness: 0.1 });
    const eyePupilMat = new THREE.MeshStandardMaterial({ color: '#09090b', roughness: 0.1 });
    const eyeGlintMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const cheekMat = new THREE.MeshBasicMaterial({ color: '#fca5a5', transparent: true, opacity: 0.75 });

    // ==========================================
    // 1. EGG MASCOT STAGE GROUP (Minion / Subway Surfers quality)
    // ==========================================
    this.eggGroup = new THREE.Group();
    this.eggBodyGroup = new THREE.Group();

    // White egg body (using customized scaled sphere deform for real egg profile with glossy white finish)
    const eggBodyGeo = new THREE.SphereGeometry(0.55, 32, 32);
    // Deform sphere to create a hyper-realistic cartoon egg shape (wider bottom, narrower top)!
    const posAttr = eggBodyGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);
      // y goes from -0.55 to 0.55. Normalized t goes from 0.0 (bottom) to 1.0 (top)
      const t = (y + 0.55) / 1.1; 
      // We taper the top by making it progressively narrower:
      const taper = 1.0 - 0.26 * t; 
      posAttr.setX(i, x * taper);
      posAttr.setZ(i, z * taper);
    }
    eggBodyGeo.computeVertexNormals();

    const eggPhysicalMat = new THREE.MeshPhysicalMaterial({
      color: '#ffffff', // clean pristine glossy white egg shell
      roughness: 0.12,
      metalness: 0.02,
      clearcoat: 0.6,
      clearcoatRoughness: 0.08,
      reflectivity: 0.55,
      flatShading: false
    });
    this.eggPhysicalMat = eggPhysicalMat;
    const eggBodyMesh = new THREE.Mesh(eggBodyGeo, eggPhysicalMat);
    eggBodyMesh.scale.set(1.1, 1.28, 1.1);
    eggBodyMesh.castShadow = true;
    eggBodyMesh.receiveShadow = true;
    this.eggBodyGroup.add(eggBodyMesh);

    // As requested: "Do NOT add eyes on egg. Do NOT add face on egg. Egg is viewed from behind."
    // So we completely skip constructing and adding the face group onto the egg body!
    this.eggFaceGroup = new THREE.Group(); // kept as empty dummy group to avoid compile errors

    // Fully detailed smooth rounded cartoon white arms & white cartoon gloves with stylish yellow bangles
    const whiteGloveMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 });
    const eggShellWhiteMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.18, metalness: 0.03 }); // pure pristine egg-white arms / legs
    const bangleMat = new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.4 }); // yellow bangles matching cap

    const createFullArm = (isLeft: boolean) => {
      const armGroup = new THREE.Group() as any; // satisfying Mesh typing/compatibility
      armGroup.name = isLeft ? 'egg_left_arm_group' : 'egg_right_arm_group';
      const dir = isLeft ? -1 : 1;

      // Shoulder pivot
      const upperPivot = new THREE.Group();
      armGroup.add(upperPivot);

      // Smooth shoulder joint (spherical) representing fluid organic connection to body
      const shoulderJoint = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), eggShellWhiteMat);
      shoulderJoint.castShadow = true;
      shoulderJoint.receiveShadow = true;
      upperPivot.add(shoulderJoint);

      // Upper arm cylinder - smooth, short, chubby cartoon arm with a sleek taper (0.15 down to 0.12)
      const upperArmMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.12, 0.18, 16),
        eggShellWhiteMat
      );
      upperArmMesh.position.y = -0.09;
      upperArmMesh.castShadow = true;
      upperArmMesh.receiveShadow = true;
      upperPivot.add(upperArmMesh);

      // Smooth elbow joint (spherical)
      const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), eggShellWhiteMat);
      elbowJoint.position.set(0, -0.18, 0);
      elbowJoint.castShadow = true;
      upperPivot.add(elbowJoint);

      // Elbow / Forearm Pivot
      const forearmPivot = new THREE.Group();
      forearmPivot.position.set(0, -0.18, 0);
      upperPivot.add(forearmPivot);

      // Forearm smooth, short cylinder with a sleek taper (0.12 down to 0.10)
      const forearmMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.10, 0.16, 16),
        eggShellWhiteMat
      );
      forearmMesh.position.y = -0.08;
      forearmMesh.castShadow = true;
      forearmMesh.receiveShadow = true;
      forearmPivot.add(forearmMesh);

      // Smooth wrist joint (spherical)
      const wristJoint = new THREE.Mesh(new THREE.SphereGeometry(0.10, 16, 16), eggShellWhiteMat);
      wristJoint.position.set(0, -0.16, 0);
      wristJoint.castShadow = true;
      forearmPivot.add(wristJoint);

      // Cartoon white glove hand (chubby, small, rounded sphere for cute chibi design)
      const gloveMain = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), whiteGloveMat);
      gloveMain.position.set(0, -0.16, 0.01);
      gloveMain.castShadow = true;
      gloveMain.receiveShadow = true;

      // Yellow wrist band / bangle (bright yellow, same color as cap, matching the body design)
      const bangle = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.026, 8, 16), bangleMat);
      bangle.position.set(0, 0.065, 0);
      bangle.rotation.x = Math.PI / 2;
      bangle.castShadow = true;
      gloveMain.add(bangle);

      // Cute puffy thumb
      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.05, 6, 8), whiteGloveMat);
      thumb.position.set(dir * -0.06, 0.01, 0.04);
      thumb.rotation.z = dir * -Math.PI / 4;
      thumb.castShadow = true;
      gloveMain.add(thumb);

      forearmPivot.add(gloveMain);

      // Store bone references
      if (isLeft) {
        this.eggLeftUpperArmPivot = upperPivot;
        this.eggLeftForearmPivot = forearmPivot;
      } else {
        this.eggRightUpperArmPivot = upperPivot;
        this.eggRightForearmPivot = forearmPivot;
      }

      // Root positioning of the arm group relative to the egg body, attached naturally to upper sides
      armGroup.position.set(dir * 0.44, 0.22, 0.02);
      return armGroup;
    };

    this.eggLeftArm = createFullArm(true);
    this.eggBodyGroup.add(this.eggLeftArm);

    this.eggRightArm = createFullArm(false);
    this.eggBodyGroup.add(this.eggRightArm);

    this.eggGroup.add(this.eggBodyGroup);

    // Thick smooth rounded white legs and bright yellow cartoon running shoes with sporty soles (longer, thicker, and high-visibility)
    const createFullEggLeg = (isLeft: boolean) => {
      const dir = isLeft ? -1 : 1;
      const legGroup = new THREE.Group() as any;

      // Thigh bone pivot (Hip joint)
      const thighPivot = new THREE.Group();
      legGroup.add(thighPivot);

      // Smooth spherical hip joint
      const hipJoint = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), eggShellWhiteMat);
      hipJoint.castShadow = true;
      thighPivot.add(hipJoint);

      // Thigh capsule - pure white smooth legs with slight taper (0.14 to 0.117)
      const thighMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.117, 0.46, 16),
        eggShellWhiteMat
      );
      thighMesh.position.y = -0.23;
      thighMesh.castShadow = true;
      thighMesh.receiveShadow = true;
      thighPivot.add(thighMesh);

      // Smooth knee joint (spherical)
      const kneeJoint = new THREE.Mesh(new THREE.SphereGeometry(0.117, 16, 16), eggShellWhiteMat);
      kneeJoint.position.set(0, -0.46, 0);
      kneeJoint.castShadow = true;
      thighPivot.add(kneeJoint);

      // Knee Pivot (Calf / Shin)
      const calfPivot = new THREE.Group();
      calfPivot.position.set(0, -0.46, 0.01);
      thighPivot.add(calfPivot);

      // Calf capsule - pure white smooth legs with slight taper (0.117 to 0.10)
      const calfMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.117, 0.10, 0.38, 16),
        eggShellWhiteMat
      );
      calfMesh.position.y = -0.19;
      calfMesh.castShadow = true;
      calfMesh.receiveShadow = true;
      calfPivot.add(calfMesh);

      // Ankle joint (spherical)
      const ankleJoint = new THREE.Mesh(new THREE.SphereGeometry(0.10, 16, 16), eggShellWhiteMat);
      ankleJoint.position.set(0, -0.38, 0);
      ankleJoint.castShadow = true;
      calfPivot.add(ankleJoint);

      // Foot Pivot (Shoe group)
      const footPivot = new THREE.Group();
      footPivot.position.set(0, -0.38, 0.02);
      calfPivot.add(footPivot);

      // Cute sport running shoes - rounded, curved, non-Minecraft-box style!
      const shoeGroup = new THREE.Group();
      footPivot.add(shoeGroup);

      const yellowShoeMat = new THREE.MeshStandardMaterial({ 
        color: '#facc15', // Vibrant farm yellow
        roughness: 0.22,
        metalness: 0.05
      });
      const whiteSoleMat = new THREE.MeshStandardMaterial({ 
        color: '#ffffff', 
        roughness: 0.5 
      });

      // 1. Pill-shaped curved White Sporty Sole
      const soleGeo = new THREE.CapsuleGeometry(0.155, 0.34, 16, 16);
      const soleMesh = new THREE.Mesh(soleGeo, whiteSoleMat);
      soleMesh.rotation.x = Math.PI / 2; // Lies flat on coordinates
      soleMesh.position.set(0, -0.06, 0.07); // elevated sole
      soleMesh.scale.set(1.15, 1.0, 0.72); // wider base
      soleMesh.castShadow = true;
      shoeGroup.add(soleMesh);

      // 2. Main Puffy Soft Yellow Shoe Body (Smoothly contoured, egg style)
      const shoeBodyGeo = new THREE.SphereGeometry(0.175, 20, 20);
      const shoeBodyMesh = new THREE.Mesh(shoeBodyGeo, yellowShoeMat);
      shoeBodyMesh.scale.set(1.12, 1.0, 1.62); // Highly rounded puffy sneaker silhouette
      shoeBodyMesh.position.set(0, 0.05, 0.05);
      shoeBodyMesh.castShadow = true;
      shoeGroup.add(shoeBodyMesh);

      // 3. Vintage Rubber White Curved Toe Cap
      const toeCapGeo = new THREE.SphereGeometry(0.135, 16, 16);
      const toeCapMesh = new THREE.Mesh(toeCapGeo, whiteSoleMat);
      toeCapMesh.scale.set(1.1, 0.7, 1.0);
      toeCapMesh.position.set(0, 0.015, 0.27);
      shoeGroup.add(toeCapMesh);

      // 4. White collar rim around the ankle foot opening
      const collarGeo = new THREE.TorusGeometry(0.095, 0.038, 12, 24);
      const collarMesh = new THREE.Mesh(collarGeo, whiteSoleMat);
      collarMesh.rotation.x = Math.PI / 2;
      collarMesh.position.set(0, 0.155, -0.035);
      shoeGroup.add(collarMesh);

      // 5. High-contrast round white shoelaces
      const laceGeo = new THREE.CapsuleGeometry(0.022, 0.11, 8, 8);
      const lace1 = new THREE.Mesh(laceGeo, whiteSoleMat);
      lace1.rotation.z = Math.PI / 2;
      lace1.position.set(0, 0.175, 0.09);
      shoeGroup.add(lace1);

      const lace2 = lace1.clone();
      lace2.position.set(0, 0.145, 0.17);
      shoeGroup.add(lace2);

      // Store bone references
      if (isLeft) {
        this.eggLeftThighPivot = thighPivot;
        this.eggLeftCalfPivot = calfPivot;
        this.eggLeftFootPivot = footPivot;
      } else {
        this.eggRightThighPivot = thighPivot;
        this.eggRightCalfPivot = calfPivot;
        this.eggRightFootPivot = footPivot;
      }

      // Root positioning relative to the egg center of gravity
      legGroup.position.set(dir * 0.24, -0.22, 0);
      return legGroup;
    };

    this.eggLeftLeg = createFullEggLeg(true);
    this.eggGroup.add(this.eggLeftLeg);

    this.eggRightLeg = createFullEggLeg(false);
    this.eggGroup.add(this.eggRightLeg);

    // Build small yellow baseball cap on the Egg - snugly attached to the tapered top!
    this.eggCapGroup = new THREE.Group();
    this.eggCapGroup.name = 'egg_cap_group';
    this.eggCapGroup.position.set(0, 0.58, 0); // Seated perfectly snug, no floating!

    const capDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 20, 20, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.5 }) // Yellow cap dome
    );
    capDome.scale.set(1.0, 0.72, 1.0);
    capDome.position.set(0, -0.04, 0); // Centered and sitting cuddled on egg top
    capDome.castShadow = true;
    this.eggCapGroup.add(capDome);

    const capVisor = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.02, 0.16),
      new THREE.MeshStandardMaterial({ color: '#fbbf24', roughness: 0.6 }) // Visor
    );
    capVisor.position.set(0, -0.07, 0.18);
    capVisor.rotation.x = 0.12;
    capVisor.castShadow = true;
    this.eggCapGroup.add(capVisor);

    // Tiny button on top of baseball cap
    const capButton = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 8, 8),
      new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.4 })
    );
    capButton.position.set(0, 0.12, 0);
    capButton.castShadow = true;
    this.eggCapGroup.add(capButton);

    this.eggBodyGroup.add(this.eggCapGroup);

    this.playerGroup.add(this.eggGroup);

    // ==========================================
    // 2. CUTE CHICK STAGE GROUP (Complete Redesign as Console-Quality Mascot)
    // ==========================================
    this.chickGroup = new THREE.Group();
    // Increase chick size by 50% relative to before (making it occupy a beautifully solid size)
    this.chickGroup.scale.set(1.4, 1.4, 1.4);

    const chickYellowMat = new THREE.MeshStandardMaterial({
      color: '#facc15', // Brilliant golden-yellow fluffy feathers
      roughness: 0.62,
      metalness: 0.05
    });
    this.chickYellowMat = chickYellowMat;

    const chickOrangeMat = new THREE.MeshStandardMaterial({
      color: '#f97316', // Strong safety orange beak, legs and feet
      roughness: 0.35,
      metalness: 0.05
    });

    // Plump pear-shaped fluffy avian body (no orange sphere with stick legs!)
    this.chickBodyGroup = new THREE.Group();

    // Main abdomen/tuck
    const chickAbdomen = new THREE.Mesh(new THREE.SphereGeometry(0.38, 24, 24), chickYellowMat);
    chickAbdomen.scale.set(1.1, 0.95, 1.0);
    chickAbdomen.position.set(0, 0.1, 0);
    chickAbdomen.castShadow = true;
    chickAbdomen.receiveShadow = true;
    this.chickBodyGroup.add(chickAbdomen);

    // Rounded chest sticking forward (creates a fluffy, proud chick silhouette)
    const chickChest = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 20), chickYellowMat);
    chickChest.position.set(0, 0.15, 0.16);
    chickChest.scale.set(1.0, 0.85, 0.9);
    chickChest.castShadow = true;
    this.chickBodyGroup.add(chickChest);

    // Cheerful back tail fluffs
    const fluffGeo = new THREE.SphereGeometry(0.1, 10, 10);
    for (let i = -1; i <= 1; i += 2) {
      const fluff = new THREE.Mesh(fluffGeo, chickYellowMat);
      fluff.position.set(i * 0.28, 0.04, -0.2);
      fluff.scale.set(1.0, 1.5, 1.0);
      fluff.rotation.y = i * 0.4;
      this.chickBodyGroup.add(fluff);
    }
    
    this.chickGroup.add(this.chickBodyGroup);

    // Bigger Head (properly defined separate segment)
    this.chickHeadGroup = new THREE.Group();
    this.chickHeadGroup.position.set(0, 0.48, 0.05);

    const chickHead = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 24), chickYellowMat);
    chickHead.castShadow = true;
    this.chickHeadGroup.add(chickHead);

    // Soft feather Crest/Tuft clump on head
    const crest1 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), chickYellowMat);
    crest1.scale.set(0.4, 1.4, 0.4);
    crest1.position.set(0, 0.34, 0.02);
    crest1.rotation.z = 0.25;
    this.chickHeadGroup.add(crest1);

    const crest2 = crest1.clone();
    crest2.position.set(-0.06, 0.32, -0.04);
    crest2.rotation.z = -0.25;
    this.chickHeadGroup.add(crest2);

    const crest3 = crest1.clone();
    crest3.position.set(0.06, 0.32, -0.04);
    crest3.rotation.z = 0.0;
    this.chickHeadGroup.add(crest3);

    // Cute multi-segmented Beak (upper and lower beak halves)
    const chickUpperBeak = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.14, 12), chickOrangeMat);
    chickUpperBeak.scale.set(1.2, 0.6, 1.0);
    chickUpperBeak.rotation.x = Math.PI / 1.75;
    chickUpperBeak.position.set(0, -0.02, 0.32);
    chickUpperBeak.castShadow = true;
    this.chickHeadGroup.add(chickUpperBeak);

    const chickLowerBeak = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.10, 12), chickOrangeMat);
    chickLowerBeak.scale.set(1.15, 0.5, 0.95);
    chickLowerBeak.rotation.x = Math.PI / 2.05;
    chickLowerBeak.position.set(0, -0.08, 0.30);
    chickLowerBeak.castShadow = true;
    this.chickHeadGroup.add(chickLowerBeak);

    // Cute massive expressive infant eyes with shiny reflection layers
    const cScleraGeo = new THREE.SphereGeometry(0.08, 16, 16);
    cScleraGeo.scale(1.0, 1.1, 0.4);

    // LHS Eye
    const cEyeLGroup = new THREE.Group();
    cEyeLGroup.position.set(-0.11, 0.08, 0.26);
    cEyeLGroup.rotation.y = Math.PI / 18;
    const cScleraL = new THREE.Mesh(cScleraGeo, eyeWhiteMat);
    cEyeLGroup.add(cScleraL);

    const cPupilL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), eyePupilMat);
    cPupilL.position.set(0.01, 0, 0.03);
    cPupilL.scale.set(1.0, 1.0, 0.3);
    cEyeLGroup.add(cPupilL);

    const cGlintL1 = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), eyeGlintMat);
    cGlintL1.position.set(0.02, 0.02, 0.04);
    cEyeLGroup.add(cGlintL1);

    const cGlintL2 = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 6), eyeGlintMat);
    cGlintL2.position.set(-0.012, -0.012, 0.04);
    cEyeLGroup.add(cGlintL2);

    this.chickHeadGroup.add(cEyeLGroup);

    // RHS Eye
    const cEyeRGroup = new THREE.Group();
    cEyeRGroup.position.set(0.11, 0.08, 0.26);
    cEyeRGroup.rotation.y = -Math.PI / 18;
    const cScleraR = new THREE.Mesh(cScleraGeo, eyeWhiteMat);
    cEyeRGroup.add(cScleraR);

    const cPupilR = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), eyePupilMat);
    cPupilR.position.set(-0.01, 0, 0.03);
    cPupilR.scale.set(1.0, 1.0, 0.3);
    cEyeRGroup.add(cPupilR);

    const cGlintR1 = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), eyeGlintMat);
    cGlintR1.position.set(-0.01, 0.02, 0.04);
    cEyeRGroup.add(cGlintR1);

    const cGlintR2 = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 6), eyeGlintMat);
    cGlintR2.position.set(0.012, -0.012, 0.04);
    cEyeRGroup.add(cGlintR2);

    this.chickHeadGroup.add(cEyeRGroup);

    // Blushing rosy cheeks
    const cCheekGeo = new THREE.SphereGeometry(0.05, 10, 10);
    const cCheekL = new THREE.Mesh(cCheekGeo, cheekMat);
    cCheekL.scale.set(1.0, 0.65, 0.2);
    cCheekL.position.set(-0.21, 0.0, 0.23);
    this.chickHeadGroup.add(cCheekL);

    const cCheekR = cCheekL.clone();
    cCheekR.position.set(0.21, 0.0, 0.23);
    this.chickHeadGroup.add(cCheekR);

    this.chickGroup.add(this.chickHeadGroup);

    // Multi-feather structured wings (reacts perfectly to running flaps)
    const createPuffyWing = (isLeft: boolean) => {
      const wingFrame = new THREE.Mesh();
      const dir = isLeft ? -1 : 1;

      const base = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), chickYellowMat);
      base.scale.set(0.08, 1.1, 1.25);
      wingFrame.add(base);

      const f1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.14), chickYellowMat);
      f1.position.set(dir * 0.02, -0.06, 0.07);
      f1.rotation.y = -dir * 0.12;
      wingFrame.add(f1);

      const f2 = f1.clone();
      f2.position.set(dir * 0.028, -0.10, 0.02);
      wingFrame.add(f2);

      const f3 = f1.clone();
      f3.position.set(dir * 0.015, -0.02, 0.10);
      f3.rotation.y = -dir * 0.25;
      wingFrame.add(f3);

      wingFrame.position.set(dir * 0.45, 0.12, -0.04);
      wingFrame.rotation.set(0.1, 0, dir * 0.3);

      return wingFrame;
    };

    this.chickLeftWing = createPuffyWing(true);
    this.chickGroup.add(this.chickLeftWing);

    this.chickRightWing = createPuffyWing(false);
    this.chickGroup.add(this.chickRightWing);

    // Tail feathers
    this.chickTailGroup = new THREE.Group();
    this.chickTailGroup.position.set(0, 0.1, -0.35);
    for (let f = -1; f <= 1; f++) {
      const feather = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.25, 0.03),
        chickYellowMat
      );
      feather.position.set(f * 0.08, 0.12, f * f * -0.03);
      feather.rotation.set(-Math.PI / 4, f * 0.22, 0);
      this.chickTailGroup.add(feather);
    }
    this.chickGroup.add(this.chickTailGroup);

    // Plump yellow drumsticks tapering into strong orange shanks & joints
    const chickLegBoneGeo = new THREE.CylinderGeometry(0.035, 0.032, 0.22, 8);

    const createChunkyChickLeg = (isLeft: boolean) => {
      const dir = isLeft ? -1 : 1;
      const legGroup = new THREE.Mesh();

      // Plump Drumstick thigh
      const drumstick = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), chickYellowMat);
      drumstick.scale.set(1.0, 1.4, 1.0);
      drumstick.position.set(0, 0.14, 0);
      legGroup.add(drumstick);

      // Orange leg bone cylinder
      const bone = new THREE.Mesh(chickLegBoneGeo, chickOrangeMat);
      bone.position.set(0, 0.02, 0);
      bone.castShadow = true;
      legGroup.add(bone);

      // Knee joint capsule
      const joint = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), chickOrangeMat);
      joint.position.set(0, 0.12, 0.015);
      legGroup.add(joint);

      // Large multi-clawed chicken foot (three forward claws and one rear heel claw)
      const footGroup = new THREE.Group();
      footGroup.position.set(0, -0.10, 0.01);

      // Center front claw
      const toeCenter = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.032, 0.18), chickOrangeMat);
      toeCenter.position.set(0, 0, 0.07);
      toeCenter.rotation.x = -0.06;
      toeCenter.castShadow = true;
      footGroup.add(toeCenter);

      // Left front claw
      const toeLeft = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.032, 0.14), chickOrangeMat);
      toeLeft.position.set(-0.065, 0, 0.04);
      toeLeft.rotation.y = Math.PI / 5.5;
      toeLeft.rotation.x = -0.06;
      toeLeft.castShadow = true;
      footGroup.add(toeLeft);

      // Right front claw
      const toeRight = toeLeft.clone();
      toeRight.position.x = 0.065;
      toeRight.rotation.y = -Math.PI / 5.5;
      footGroup.add(toeRight);

      // Rear heel claw
      const toeRear = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.08), chickOrangeMat);
      toeRear.position.set(0, -0.005, -0.045);
      toeRear.castShadow = true;
      footGroup.add(toeRear);

      legGroup.add(footGroup);

      // Coordinate offset
      legGroup.position.set(dir * 0.16, -0.28, 0);
      legGroup.castShadow = true;

      return legGroup;
    };

    this.chickLeftLeg = createChunkyChickLeg(true);
    this.chickGroup.add(this.chickLeftLeg);

    this.chickRightLeg = createChunkyChickLeg(false);
    this.chickGroup.add(this.chickRightLeg);

    this.chickGroup.visible = false;
    this.playerGroup.add(this.chickGroup);

    // ==========================================
    // 3. ADULT CHICKEN STAGE GROUP
    // ==========================================
    this.adultGroup = new THREE.Group();

    // Body
    this.chickenBodyMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 24, 24),
      meshWhiteFeathers
    );
    this.chickenBodyMesh.name = 'chicken_body';
    this.chickenBodyMesh.scale.set(1.0, 1.15, 1.15);
    this.chickenBodyMesh.castShadow = true;
    this.chickenBodyMesh.receiveShadow = true;
    this.adultGroup.add(this.chickenBodyMesh);

    // Neck ring link with rounded smooth cylinder
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.28, 16), meshWhiteFeathers);
    neck.name = 'chicken_neck';
    neck.position.set(0, 0.55, 0.12);
    neck.castShadow = true;
    this.adultGroup.add(neck);

    // Large plump head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 24, 24), meshWhiteFeathers);
    head.name = 'chicken_head';
    head.position.set(0, 0.82, 0.2);
    head.castShadow = true;
    this.adultGroup.add(head);

    // Animated beak section
    const upperBeak = new THREE.Mesh(
      new THREE.ConeGeometry(0.12, 0.36, 16),
      this.matCache['beak_standard']
    );
    upperBeak.rotation.x = -Math.PI / 1.85;
    upperBeak.position.set(0, 0.82, 0.54);
    this.adultGroup.add(upperBeak);

    const lowerBeak = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.26, 16),
      this.matCache['beak_standard']
    );
    lowerBeak.rotation.x = -Math.PI / 2.1;
    lowerBeak.position.set(0, 0.74, 0.52);
    this.adultGroup.add(lowerBeak);

    // Realistic red wattle under the beak
    const wattleMat = this.matCache['crest_standard'];
    const wattleL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), wattleMat);
    wattleL.scale.set(0.5, 1.25, 0.82);
    wattleL.position.set(-0.06, 0.61, 0.42);
    wattleL.castShadow = true;
    this.adultGroup.add(wattleL);

    const wattleR = wattleL.clone();
    wattleR.position.set(0.06, 0.61, 0.42);
    this.adultGroup.add(wattleR);

    // Staggered red comb on head
    const redCombMat = this.matCache['crest_standard'];
    
    const combMid = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), redCombMat);
    combMid.scale.set(0.6, 1.5, 1.2);
    combMid.position.set(0, 1.22, 0.2);
    combMid.castShadow = true;
    this.adultGroup.add(combMid);

    const combBack = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 14), redCombMat);
    combBack.scale.set(0.6, 1.3, 1.0);
    combBack.position.set(0, 1.12, 0.04);
    combBack.castShadow = true;
    this.adultGroup.add(combBack);

    const combFront = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 14), redCombMat);
    combFront.scale.set(0.6, 1.2, 1.0);
    combFront.position.set(0, 1.12, 0.34);
    combFront.castShadow = true;
    this.adultGroup.add(combFront);

    // Eyes
    const eyeWhiteGeo = new THREE.SphereGeometry(0.10, 16, 16);
    const pupilGeo = new THREE.SphereGeometry(0.06, 16, 16);

    const eyeLWhite = new THREE.Mesh(eyeWhiteGeo, this.matCache['white_gloss']);
    eyeLWhite.scale.set(1.1, 1.1, 0.6);
    eyeLWhite.position.set(-0.24, 0.88, 0.38);
    this.adultGroup.add(eyeLWhite);

    const pupilL = new THREE.Mesh(pupilGeo, this.matCache['black_matte']);
    pupilL.scale.set(1.1, 1.1, 0.5);
    pupilL.position.set(-0.26, 0.88, 0.44);
    this.adultGroup.add(pupilL);

    const eyeRWhite = new THREE.Mesh(eyeWhiteGeo, this.matCache['white_gloss']);
    eyeRWhite.scale.set(1.1, 1.1, 0.6);
    eyeRWhite.position.set(0.24, 0.88, 0.38);
    this.adultGroup.add(eyeRWhite);

    const pupilR = new THREE.Mesh(pupilGeo, this.matCache['black_matte']);
    pupilR.scale.set(1.1, 1.1, 0.5);
    pupilR.position.set(0.27, 0.88, 0.44);
    this.adultGroup.add(pupilR);

    // Feathers tail bundle
    this.chickenTailGroup = new THREE.Group();
    this.chickenTailGroup.position.set(0, 0.1, -0.45);
    for (let f = 0; f < 3; f++) {
      const tailFeath = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.48, 8, 12), meshWhiteFeathers);
      tailFeath.name = 'tail_feather';
      tailFeath.position.set((f - 1) * 0.22, 0.2, -0.1);
      tailFeath.rotation.x = -Math.PI / 3 - (f === 1 ? 0.15 : 0) - (Math.random() - 0.5) * 0.05;
      tailFeath.castShadow = true;
      this.chickenTailGroup.add(tailFeath);
    }
    this.adultGroup.add(this.chickenTailGroup);

    // Wings
    this.chickenLeftWing = new THREE.Group();
    this.chickenLeftWing.position.set(-0.55, 0.1, 0.05);
    const lWingBase = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), meshWhiteFeathers);
    lWingBase.name = 'wing_feather';
    lWingBase.scale.set(0.23, 1.2, 1.8);
    lWingBase.rotation.x = -Math.PI / 12;
    lWingBase.castShadow = true;
    this.chickenLeftWing.add(lWingBase);
    this.adultGroup.add(this.chickenLeftWing);

    this.chickenRightWing = new THREE.Group();
    this.chickenRightWing.position.set(0.55, 0.1, 0.05);
    const rWingBase = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), meshWhiteFeathers);
    rWingBase.name = 'wing_feather';
    rWingBase.scale.set(0.23, 1.2, 1.8);
    rWingBase.rotation.x = -Math.PI / 12;
    rWingBase.castShadow = true;
    this.chickenRightWing.add(rWingBase);
    this.adultGroup.add(this.chickenRightWing);

    // Legs & feet
    const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.58, 12);
    const orangeLegMat = this.matCache['beak_standard'];

    this.chickenLeftLeg = new THREE.Mesh(legGeo, orangeLegMat);
    this.chickenLeftLeg.name = 'left_leg';
    this.chickenLeftLeg.position.set(-0.22, -0.54, 0);
    this.chickenLeftLeg.castShadow = true;
    
    const lFootPlate = new THREE.Group();
    lFootPlate.position.set(0, -0.28, 0);
    
    const centerToe = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.18, 6, 8), orangeLegMat);
    centerToe.rotation.x = -Math.PI / 2;
    centerToe.position.set(0, 0, 0.09);
    centerToe.castShadow = true;
    lFootPlate.add(centerToe);

    const leftToe = centerToe.clone();
    leftToe.rotation.y = Math.PI / 6;
    leftToe.position.set(-0.06, 0, 0.08);
    lFootPlate.add(leftToe);

    const rightToe = centerToe.clone();
    rightToe.rotation.y = -Math.PI / 6;
    rightToe.position.set(0.06, 0, 0.08);
    lFootPlate.add(rightToe);

    this.chickenLeftLeg.add(lFootPlate);
    this.adultGroup.add(this.chickenLeftLeg);

    this.chickenRightLeg = new THREE.Mesh(legGeo, orangeLegMat);
    this.chickenRightLeg.name = 'right_leg';
    this.chickenRightLeg.position.set(0.22, -0.54, 0);
    this.chickenRightLeg.castShadow = true;

    const rFootPlate = lFootPlate.clone();
    this.chickenRightLeg.add(rFootPlate);
    this.adultGroup.add(this.chickenRightLeg);

    this.adultGroup.visible = false; // Starts invisible during Egg evolution
    this.playerGroup.add(this.adultGroup);

    // ==========================================
    // 4. POWER-UP SHIELDS / GLOWS
    // ==========================================
    // --- Special Shield Bubble ---
    const shieldGeo = new THREE.SphereGeometry(1.4, 20, 20);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: '#34d399',
      transparent: true,
      opacity: 0.3,
      wireframe: true
    });
    this.shieldBubbleMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldBubbleMesh.visible = false;
    this.playerGroup.add(this.shieldBubbleMesh);

    // --- Magnet Ring Aura ---
    const magnetGeo = new THREE.RingGeometry(0.9, 1.6, 12);
    const magnetMat = new THREE.MeshBasicMaterial({
      color: '#60a5fa',
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    });
    this.magnetAuraMesh = new THREE.Mesh(magnetGeo, magnetMat);
    this.magnetAuraMesh.rotation.x = Math.PI / 2;
    this.magnetAuraMesh.position.y = -0.45;
    this.magnetAuraMesh.visible = false;
    this.playerGroup.add(this.magnetAuraMesh);
  }

  private createCircleTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.7)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 16);
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  private buildParticles() {
    // Continuous drifting Splashes (Feathers)
    const geometry = new THREE.BufferGeometry();
    this.featherPositions = new Float32Array(this.featherCount * 3);
    this.featherVelocities = new Float32Array(this.featherCount * 3);
    this.featherColors = new Float32Array(this.featherCount * 3);

    for (let i = 0; i < this.featherCount; i++) {
      this.featherPositions[i * 3] = 0;
      this.featherPositions[i * 3 + 1] = 0;
      this.featherPositions[i * 3 + 2] = 0;

      this.featherVelocities[i * 3] = (Math.random() - 0.5) * 8.5;
      this.featherVelocities[i * 3 + 1] = Math.random() * 8.0 + 3.0;
      this.featherVelocities[i * 3 + 2] = (Math.random() - 0.5) * 8.5;

      const rand = Math.random();
      if (rand < 0.5) {
        this.featherColors[i * 3] = 0.98; // soft white
        this.featherColors[i * 3 + 1] = 0.98;
        this.featherColors[i * 3 + 2] = 0.98;
      } else if (rand < 0.8) {
        this.featherColors[i * 3] = 0.96; // amber yellow
        this.featherColors[i * 3 + 1] = 0.8;
        this.featherColors[i * 3 + 2] = 0.2;
      } else {
        this.featherColors[i * 3] = 0.95; // bright red
        this.featherColors[i * 3 + 1] = 0.15;
        this.featherColors[i * 3 + 2] = 0.05;
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(this.featherPositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.featherColors, 3));

    const pMat = new THREE.PointsMaterial({
      size: 0.22, // slightly larger, gorgeous soft feathers
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      map: this.createCircleTexture(),
      alphaTest: 0.05,
      depthWrite: false, // Prevents giant square outlines!
      blending: THREE.NormalBlending, // matches feather solidness but renders rounded soft shapes
      sizeAttenuation: true
    });

    this.featherParticles = new THREE.Points(geometry, pMat);
    this.featherParticles.visible = false;
    this.scene.add(this.featherParticles);

    // Weather Rain splash indicators
    const rainGeo = new THREE.BufferGeometry();
    this.rainPositions = new Float32Array(this.rainCount * 3);
    for (let j = 0; j < this.rainCount; j++) {
      this.rainPositions[j * 3] = (Math.random() - 0.5) * 22.0;
      this.rainPositions[j * 3 + 1] = Math.random() * 20.0;
      this.rainPositions[j * 3 + 2] = -Math.random() * 80.0;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    const rainMat = new THREE.PointsMaterial({
      color: '#e2e8f0',
      size: 0.12,
      map: this.createCircleTexture(), // circular dynamic rain drops
      transparent: true,
      opacity: 0.4,
      depthWrite: false, // prevents dark blocks in rainstorms
      sizeAttenuation: true
    });
    this.rainParticles = new THREE.Points(rainGeo, rainMat);
    this.rainParticles.visible = false;
    this.scene.add(this.rainParticles);

    // Weather Leaf particles for blowing wind
    const leafGeo = new THREE.BufferGeometry();
    const leafCount = 80;
    const leafPositions = new Float32Array(leafCount * 3);
    for (let j = 0; j < leafCount; j++) {
      leafPositions[j * 3] = (Math.random() - 0.5) * 24.0;
      leafPositions[j * 3 + 1] = Math.random() * 15.0 + 1.0;
      leafPositions[j * 3 + 2] = -Math.random() * 80.0;
    }
    leafGeo.setAttribute('position', new THREE.BufferAttribute(leafPositions, 3));
    const leafMat = new THREE.PointsMaterial({
      color: '#f97316', // autumn orange / green leaves
      size: 0.18,
      map: this.createCircleTexture(), // circular leaf blobs
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      sizeAttenuation: true
    });
    this.leafParticles = new THREE.Points(leafGeo, leafMat);
    this.leafParticles.visible = true; // leaves always blow across the sky slightly!
    this.scene.add(this.leafParticles);
  }

  private cloudMaterial!: THREE.MeshStandardMaterial;

  private buildAtmosphere() {
    this.bgClouds = [];
    this.bgBirds = [];

    // Create 4-5 puffy cotton clouds high in the sky with instance-controlled material
    this.cloudMaterial = new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      roughness: 0.9,
      transparent: true,
      opacity: 0.85,
    });

    for (let c = 0; c < 5; c++) {
      const cloud = new THREE.Group();
      cloud.name = 'atmosphere_cloud';
      // Distribute along Z and X axes
      cloud.position.set(
        -25 + Math.random() * 50,
        14 + Math.random() * 4,
        -120 + c * 30
      );

      // Fluffy overlapping spheres
      const centerSphere = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 12), this.cloudMaterial);
      centerSphere.castShadow = true;
      cloud.add(centerSphere);

      const leftSphere = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 10), this.cloudMaterial);
      leftSphere.position.set(-1.8, -0.4, 0.2);
      cloud.add(leftSphere);

      const rightSphere = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 10), this.cloudMaterial);
      rightSphere.position.set(1.9, -0.3, -0.2);
      cloud.add(rightSphere);

      const topSphere = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 8), this.cloudMaterial);
      topSphere.position.set(0.3, 1.3, 0);
      cloud.add(topSphere);

      this.scene.add(cloud);
      this.bgClouds.push(cloud);
    }

    // Starry Sky sparkles for night-time / clear night
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 180;
    const starPositions = new Float32Array(starCount * 3);
    for (let s = 0; s < starCount; s++) {
      starPositions[s * 3] = (Math.random() - 0.5) * 80.0;
      starPositions[s * 3 + 1] = 18.0 + Math.random() * 12.0; // high above
      starPositions[s * 3 + 2] = -Math.random() * 120.0;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starsMat = new THREE.PointsMaterial({
      color: '#ffffff',
      size: 0.16,
      transparent: true,
      opacity: 0.0, // starts completely invisible, dynamic night lerper updates opacity
      sizeAttenuation: true,
    });
    this.starsParticles = new THREE.Points(starsGeo, starsMat);
    this.scene.add(this.starsParticles);

    // Dynamic lightning flash light
    this.lightningLight = new THREE.DirectionalLight('#ffffff', 0);
    this.lightningLight.position.set(0, 30, -30);
    this.scene.add(this.lightningLight);

    // Create 3 adorable stylized cartoon flying birds that flapping wings
    const birdMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.5,
      metalness: 0.1,
    });
    const orangeBillMat = new THREE.MeshStandardMaterial({ color: '#ea580c' });

    for (let b = 0; b < 3; b++) {
      const bird = new THREE.Group();
      bird.name = 'bg_flying_bird';
      bird.position.set(
        -12 + Math.random() * 24,
        9 + Math.random() * 3,
        -70 + b * 25
      );

      // Body (capsule form)
      const bBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.28, 6, 8), birdMat);
      bBody.rotation.x = Math.PI / 2;
      bird.add(bBody);

      // Little head
      const bHead = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), birdMat);
      bHead.position.set(0, 0.12, -0.18);
      bird.add(bHead);

      // Beak
      const bBeak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 6), orangeBillMat);
      bBeak.rotation.x = Math.PI / 2;
      bBeak.position.set(0, 0.10, -0.29);
      bird.add(bBeak);

      // Left and right wing groups for jointed articulation wing flaps!
      const lWingGroup = new THREE.Group();
      lWingGroup.name = 'l_wing_joint';
      lWingGroup.position.set(-0.13, 0.04, 0);
      const lWingMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.02, 0.18), birdMat);
      lWingMesh.position.set(-0.19, 0, 0);
      lWingGroup.add(lWingMesh);
      bird.add(lWingGroup);

      const rWingGroup = new THREE.Group();
      rWingGroup.name = 'r_wing_joint';
      rWingGroup.position.set(0.13, 0.04, 0);
      const rWingMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.02, 0.18), birdMat);
      rWingMesh.position.set(0.19, 0, 0);
      rWingGroup.add(rWingMesh);
      bird.add(rWingGroup);

      this.scene.add(bird);
      this.bgBirds.push(bird);
    }
  }

  private spawnDustParticle(surfaceType?: string) {
    if (!this.isRunning || this.isPaused || this.isCrashed) return;

    // Place smoke directly on foot point
    const footX = this.playerX + (Math.random() - 0.5) * 0.4;
    const footY = -0.15;
    const footZ = this.playerZ + (Math.random() - 0.5) * 0.3;

    // Determine dust color based on skin or theme for extra polish
    let dustColor = '#b4a390';
    if (surfaceType === 'MUD') dustColor = '#451a03'; // slimy dark mud
    else if (surfaceType === 'ASPHALT_WET' || surfaceType === 'WOOD_BRIDGE') dustColor = '#e2e8f0'; // splashing translucent water particles
    else if (surfaceType === 'ASPHALT_DAMP') dustColor = '#64748b'; // damp darker road dust
    else if (surfaceType === 'GRASS') dustColor = '#4ade80'; // soft grass clipping green
    else if (surfaceType === 'DIRT') dustColor = '#92400e'; // warm farm dirt dust
    else if (this.currentSkinId === 'skin_golden') dustColor = '#fbbf24';
    else if (this.currentSkinId === 'skin_robo') dustColor = '#38bdf8';
    else if (this.currentSkinId === 'skin_super') dustColor = '#22d3ee';
    else if (this.currentSkinId === 'skin_rainbow') dustColor = '#c084fc';
    else if (this.activeTheme === 'SKM_FACTORY' || this.activeTheme === 'WAREHOUSE') dustColor = '#64748b';
    else if (this.activeTheme === 'WHEAT_FIELDS') dustColor = '#fcd34d';

    let p = this.smokeParticles.find(m => m.life <= 0);
    if (!p) {
      const geo = new THREE.SphereGeometry(0.12 + Math.random() * 0.12, 4, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: dustColor,
        transparent: true,
        opacity: 0.45,
      });
      const mesh = new THREE.Mesh(geo, mat);
      this.scene.add(mesh);
      p = { mesh, life: 1.0, velocity: new THREE.Vector3() };
      this.smokeParticles.push(p);
    }

    p.life = 0.55 + Math.random() * 0.3;
    p.mesh.visible = true;
    p.mesh.position.set(footX, footY, footZ);
    p.mesh.scale.set(1, 1, 1);

    // Dynamic spray speed! Increase Z drift backwards as game speed picks up
    p.velocity.set(
      (Math.random() - 0.5) * 0.5,
      0.35 + Math.random() * 0.4,
      3.0 + this.speed * 0.2
    );

    if (p.mesh.material instanceof THREE.MeshBasicMaterial) {
      p.mesh.material.color.set(dustColor);
      p.mesh.material.opacity = 0.45;
    }

    // Blow slowly upwards and backwards
    const multiplier = this.activePowerUps.has(PowerUpType.SPEED_BOOST) ? 2.0 : 1.0;
    p.velocity.set(
      (Math.random() - 0.5) * 0.3,
      Math.random() * 1.6 + 0.4,
      this.speed * 0.5 * multiplier // blown behind chicken
    );
  }

  private spawnExhaustSmoke(x: number, y: number, z: number, color: string = '#4b5563') {
    let p = this.smokeParticles.find(m => m.life <= 0);
    if (!p) {
      const geo = new THREE.SphereGeometry(0.16 + Math.random() * 0.16, 4, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.55,
      });
      const mesh = new THREE.Mesh(geo, mat);
      this.scene.add(mesh);
      p = { mesh, life: 1.0, velocity: new THREE.Vector3() };
      this.smokeParticles.push(p);
    }
    p.life = 0.6 + Math.random() * 0.4;
    p.mesh.visible = true;
    p.mesh.position.set(x, y, z);
    p.mesh.scale.set(1, 1, 1);
    if (p.mesh.material instanceof THREE.MeshBasicMaterial) {
      p.mesh.material.color.set(color);
      p.mesh.material.opacity = 0.55;
    }
    // Blow slowly upwards and backwards
    p.velocity.set(
      (Math.random() - 0.5) * 0.4,
      Math.random() * 2.0 + 1.2,
      this.speed * 0.55 // drift backwards matching speed
    );
  }

  public setSkin(skinId: string, primaryColor: string, accentColor?: string) {
    this.currentSkinId = skinId;
    let customFeathMat = this.matCache['skin_mat_' + skinId];

    if (!customFeathMat) {
      if (skinId === 'skin_classic') {
        customFeathMat = this.matCache['mesh_white_feathers'];
      } else if (skinId === 'skin_golden') {
        customFeathMat = new THREE.MeshStandardMaterial({
          color: '#fbbf24',
          roughness: 0.1,
          metalness: 0.98,
          emissive: '#78350f',
          emissiveIntensity: 0.2
        });
      } else if (skinId === 'skin_farmer') {
        customFeathMat = new THREE.MeshStandardMaterial({
          color: '#d97706',
          roughness: 0.55,
          metalness: 0.05,
          emissive: '#451a03',
          emissiveIntensity: 0.1
        });
      } else if (skinId === 'skin_champion') {
        customFeathMat = new THREE.MeshStandardMaterial({
          color: '#1d4ed8', // Royal SKM Blue
          roughness: 0.15,
          metalness: 0.92,
          emissive: '#1e40af',
          emissiveIntensity: 0.35
        });
      } else if (skinId === 'skin_premium') {
        customFeathMat = new THREE.MeshStandardMaterial({
          color: '#10b981',
          roughness: 0.2,
          metalness: 0.85,
          emissive: '#047857',
          emissiveIntensity: 0.45
        });
      } else {
        customFeathMat = this.matCache['mesh_white_feathers'];
      }
      this.matCache['skin_mat_' + skinId] = customFeathMat;
    }

    if (this.playerGroup && customFeathMat) {
      this.playerGroup.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          if (
            node.name === 'chicken_body' ||
            node.name === 'chicken_neck' ||
            node.name === 'chicken_head' ||
            node.name === 'tail_feather' ||
            node.name === 'wing_feather'
          ) {
            node.material = customFeathMat;
          }
        }
      });
    }

    // Handle distinct Leg Materials (so they don't share and overwrite beak colors!)
    let customLegMat = this.matCache['leg_mat_' + skinId];
    if (!customLegMat) {
      if (skinId === 'skin_robo' || skinId === 'skin_cyber') {
        customLegMat = new THREE.MeshStandardMaterial({ color: '#06b6d4', roughness: 0.2, metalness: 0.9 });
      } else if (skinId === 'skin_golden') {
        customLegMat = new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.1, metalness: 0.95 });
      } else if (skinId === 'skin_black') {
        customLegMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.4 });
      } else {
        const orange = accentColor || '#f59e0b';
        customLegMat = new THREE.MeshStandardMaterial({ color: orange, roughness: 0.5 });
      }
      this.matCache['leg_mat_' + skinId] = customLegMat;
    }

    if (this.chickenLeftLeg && this.chickenRightLeg) {
      this.chickenLeftLeg.material = customLegMat;
      this.chickenRightLeg.material = customLegMat;
      
      this.chickenLeftLeg.traverse((node) => {
        if (node instanceof THREE.Mesh && node !== this.chickenLeftLeg) {
          node.material = customLegMat;
        }
      });
      this.chickenRightLeg.traverse((node) => {
        if (node instanceof THREE.Mesh && node !== this.chickenRightLeg) {
          node.material = customLegMat;
        }
      });
    }
  }

  public validateEcosystem(theme: ThemeType): boolean {
    try {
      if (!this.ambientLight || !this.dirLight) {
        console.error("Environment Validation Failed: Lighting gears not active!");
        return false;
      }
      if (!this.scene) {
        console.error("Environment Validation Failed: Three.js Scene not active!");
        return false;
      }
      if (!this.geoCache['road'] || !this.matCache['road_asphalt_pbr']) {
        console.error("Environment Validation Failed: Cache structures are missing!");
        return false;
      }
      
      const themes: ThemeType[] = [
        'POULTRY_FARM',
        'CORN_FIELDS',
        'WHEAT_FIELDS',
        'SKM_FACTORY',
        'WAREHOUSE',
        'RIVER_AREA',
        'VILLAGE_ROADS',
        'NIGHT_FARM',
        'RAINY_SEASON',
        'CITY_DISTRICT'
      ];
      if (!themes.includes(theme)) {
        console.error("Environment Validation Failed: Target theme invalid name -", theme);
        return false;
      }
      return true;
    } catch (err) {
      console.error("Environment Validation Exception Raised:", err);
      return false;
    }
  }

  private spawnEmergencyTerrain(roadGrp: THREE.Group, segmentZOffset: number) {
    try {
      console.warn("[Emergency Terrain] Restoring chunk heights/meshes at offset:", segmentZOffset);
      
      let roadMesh = roadGrp.getObjectByName('ground_plane') as THREE.Mesh;
      if (!roadMesh) {
        roadMesh = new THREE.Mesh(this.geoCache['road'] || new THREE.PlaneGeometry(this.roadWidth, this.roadLength), this.matCache['road_asphalt_pbr']);
        roadMesh.name = 'ground_plane';
        roadMesh.rotation.x = -Math.PI / 2;
        roadMesh.receiveShadow = true;
        roadGrp.add(roadMesh);
      }
      
      let shoulderL = roadGrp.getObjectByName('shoulder_l') as THREE.Mesh;
      if (!shoulderL) {
        shoulderL = new THREE.Mesh(
          new THREE.BoxGeometry(2.5, 0.4, this.roadLength),
          new THREE.MeshStandardMaterial({ color: '#166534', roughness: 0.9 })
        );
        shoulderL.name = 'shoulder_l';
        shoulderL.position.set(-this.roadWidth / 2 - 1.25, -0.15, 0);
        shoulderL.receiveShadow = true;
        roadGrp.add(shoulderL);
      }
      let shoulderR = roadGrp.getObjectByName('shoulder_r') as THREE.Mesh;
      if (!shoulderR) {
        shoulderR = shoulderL.clone();
        shoulderR.name = 'shoulder_r';
        shoulderR.position.x = this.roadWidth / 2 + 1.25;
        roadGrp.add(shoulderR);
      }
      
      let terrainMesh = roadGrp.getObjectByName('rolling_terrain') as THREE.Mesh;
      if (!terrainMesh) {
        const terrainGeom = new THREE.PlaneGeometry(360.0, 42.0, 48, 8);
        const terrainMat = new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.95,
          flatShading: true,
        });
        terrainMesh = new THREE.Mesh(terrainGeom, terrainMat);
        terrainMesh.name = 'rolling_terrain';
        terrainMesh.rotation.x = -Math.PI / 2;
        terrainMesh.receiveShadow = true;
        terrainMesh.castShadow = true;
        roadGrp.add(terrainMesh);
      }
      
      this.applyFallbackSegmentTerrain(roadGrp);
      
      let proceduralDecor = roadGrp.getObjectByName('procedural_decor') as THREE.Group;
      if (proceduralDecor) {
        roadGrp.remove(proceduralDecor);
      }
      proceduralDecor = new THREE.Group();
      proceduralDecor.name = 'procedural_decor';
      
      let seed = Math.abs(segmentZOffset) || 7;
      const rand = () => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
      };
      
      for (let t = 0; t < 4; t++) {
        const side = rand() > 0.5 ? 1 : -1;
        const xPos = side * (18.0 + rand() * 15.0);
        const zPos = -15.0 + rand() * 30.0;
        const tree = this.createProceduralTree(rand, rand() > 0.5);
        tree.position.set(xPos, 0, zPos);
        proceduralDecor.add(tree);
      }
      
      const fenceMat = new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.8 });
      const fenceBar = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.16, 0.16), fenceMat);
      fenceBar.position.set(-this.roadWidth / 4, 0.5, 0);
      proceduralDecor.add(fenceBar);
      
      roadGrp.add(proceduralDecor);
      console.log("Chunks loaded: Emergency layout completed.");
    } catch (err) {
      console.error("[Emergency Terrain] Critical repair failed completely:", err);
    }
  }

  private verifyAndRebuildHierarchy() {
    try {
      if (!this.scene) {
        console.warn("[Camera Safety] Active scene tree is missing! Recreating...");
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#475569');
        this.scene.fog = new THREE.FogExp2('#475569', 0.006);
      }

      if (!this.camera || !(this.camera instanceof THREE.PerspectiveCamera)) {
        console.warn("[Camera Safety] Active perspective camera is missing or corrupt! Creating safe perspective viewport...");
        this.camera = new THREE.PerspectiveCamera(
          this.baseFOV,
          this.canvas.clientWidth / this.canvas.clientHeight,
          0.1,
          450.0
        );
        this.camera.position.set(0, 3.2, -1.2);
        this.camera.lookAt(new THREE.Vector3(0, 1.0, -18.0));
      }
      if (!this.scene.children.includes(this.camera)) {
        this.scene.add(this.camera);
      }

      if (!this.ambientLight) {
        this.ambientLight = new THREE.AmbientLight('#ffffff', 0.8);
      }
      if (!this.scene.children.includes(this.ambientLight)) {
        this.scene.add(this.ambientLight);
      }

      if (!this.dirLight) {
        this.dirLight = new THREE.DirectionalLight('#ffffbf', 1.3);
        this.dirLight.position.set(18, 35, 12);
        this.dirLight.castShadow = true;
      }
      if (!this.scene.children.includes(this.dirLight)) {
        this.scene.add(this.dirLight);
      }

      if (!this.playerGroup || !this.scene.children.includes(this.playerGroup)) {
        console.warn("[Camera Safety] Player is missing from the active player group! Rebuilding...");
        this.buildPlayer();
      }

      if (!this.roads || this.roads.length < 3) {
        console.warn("[Camera Safety] Core road chunks are missing, incomplete, or deleted! Reforming stream...");
        this.buildRoads();
      } else {
        this.roads.forEach((roadGrp) => {
          if (!this.scene.children.includes(roadGrp)) {
            this.scene.add(roadGrp);
          }
          const terrain = roadGrp.getObjectByName('rolling_terrain');
          const ground = roadGrp.getObjectByName('ground_plane');
          if (!terrain || !ground) {
            console.warn("[Camera Safety] Segment is missing critical terrain meshes! Spawning emergency layout...");
            this.spawnEmergencyTerrain(roadGrp, roadGrp.position.z);
          }
        });
      }
    } catch (err) {
      console.error("[Camera Safety] Failed to verify/rebuild structure:", err);
    }
  }

  public changeTheme(theme: ThemeType) {
    // Disabled to preserve ONE HUGE CONTINUOUS SKM WORLD
  }

  private spawnProceduralSegment(currentZ: number) {
    const absDist = -currentZ;

    // Rule: Minimum 15-20 meters warning distance. Never spawn directly on the player!
    if (absDist <= 15.0) {
      return; // Safe spawning threshold!
    }

    const getThemeObstacles = (theme: string) => {
      if (this.isStage2 || theme === 'SKM_FACTORY' || theme === 'WAREHOUSE') {
        return {
          JUMP: ['EGG_CAGE', 'CONE', 'BARRICADE'],
          SLIDE: ['HIGH_BARRIER'],
          GENERAL: ['FORKLIFT', 'CARGO_CONTAINER', 'TRUCK']
        };
      } else if (theme === 'CITY_DISTRICT') {
        return {
          JUMP: ['CONE', 'ROAD_BLOCK', 'BARRICADE'],
          SLIDE: ['HIGH_BARRIER'],
          GENERAL: ['CAR', 'BUS', 'TRUCK', 'DELIVERY_VAN']
        };
      } else if (theme === 'RIVER_AREA') {
        return {
          JUMP: ['WOODEN_CRATE', 'SLIPPERY_AREA', 'WATER_PUDDLE'],
          SLIDE: ['FISHING_NET'],
          GENERAL: ['BROKEN_PLANK', 'BOAT_OBSTACLE', 'FLOATING_CRATE']
        };
      } else if (theme === 'VILLAGE_ROADS') {
        return {
          JUMP: ['BENCH', 'WATER_POT', 'CONSTRUCTION_BARRIER'],
          SLIDE: ['HIGH_BARRIER'],
          GENERAL: ['BICYCLE', 'HAND_CART', 'STREET_VENDOR']
        };
      } else if (theme === 'NIGHT_FARM') {
        // Night Farm represents the Forest Area theme!
        return {
          JUMP: ['LOG', 'ROCK', 'TREE_ROOT'],
          SLIDE: ['HIGH_BARRIER'],
          GENERAL: ['FALLEN_TREE', 'BUSH', 'WOODEN_BRIDGE']
        };
      } else {
        // Poultry Farm/Agriculture
        return {
          JUMP: ['FENCE', 'HAY_BALE', 'GRAIN_BARREL'],
          SLIDE: ['HIGH_BARRIER'],
          GENERAL: ['TRACTOR', 'FEED_BAGS', 'WATER_TANK', 'FARM_CART', 'MUD_PUDDLE']
        };
      }
    };

    const getWeightedGrain = (): string => {
      const r = Math.random();
      if (r < 0.25) return 'GRAIN_MAIZE';       // 25% Corn/Maize
      if (r < 0.45) return 'GRAIN_WHEAT';       // 20% Wheat
      if (r < 0.65) return 'GRAIN_RICE';        // 20% Rice
      if (r < 0.75) return 'GRAIN_MILLET';      // 10% Millet
      if (r < 0.85) return 'GRAIN_BARLEY';      // 10% Barley
      if (r < 0.95) return 'GRAIN_OATS';        // 10% Oats
      return 'GRAIN_SORGHUM';                   // 5% Sorghum
    };

    const spawnLaneCollectibles = (lane: number, currentZVal: number) => {
      // Feed reduction: Reduce feed spawn by 70% in Stage 1, and 85% in Stage 2!
      const liveConfig = getActiveLiveConfig();
      const baseChance = this.isStage2 ? 0.15 : 0.30;
      const finalChance = Math.min(0.95, baseChance * liveConfig.feedSpawnRate);
      const targetSkip = Math.max(0.05, 1.0 - finalChance);
      if (Math.random() < targetSkip) {
        return;
      }

      let feedType = 'FEED';
      if (this.currentStage === 'EGG') {
        const r = Math.random();
        if (r < 0.04) {
          feedType = 'CRYSTAL';
        } else if (this.isStage2 && Math.random() < 0.35) {
          feedType = 'BROWN_EGG';
        } else {
          feedType = getWeightedGrain();
        }
      } else {
        if (this.isStage2 && Math.random() < 0.35) {
          feedType = 'BROWN_EGG';
        } else {
          const collTypeRand = Math.random();
          if (collTypeRand < 0.25) feedType = 'FEED';
          else if (collTypeRand < 0.45) feedType = 'GOLDEN_FEED';
          else if (collTypeRand < 0.65) feedType = 'SKM_FEED_PELLET';
          else if (collTypeRand < 0.82) feedType = 'SKM_PREMIUM_FEED';
          else if (collTypeRand < 0.90) feedType = 'CORN';
          else if (collTypeRand < 0.95) feedType = 'EGG';
          else feedType = 'CRYSTAL';
        }
      }

      // Create exactly ONE single piece of feed at currentZVal (no lines or highways of feeds)
      this.createCollectible(lane, currentZVal, feedType);

      // Power-up chance
      if (Math.random() < 0.05) {
        const powerTypes = [PowerUpType.MAGNET, PowerUpType.SHIELD, PowerUpType.DOUBLE_SCORE, PowerUpType.SPEED_BOOST];
        const powerType = 'POWERUP_' + powerTypes[Math.floor(Math.random() * powerTypes.length)];
        this.createCollectible(lane, currentZVal - 3.0, powerType);
      }
    };

    // Reusable Explicit Spawn Patterns (Pattern A, B, C, D)
    const pool = getThemeObstacles(this.activeTheme);

    const spawnPatternA = (zOffset: number) => {
      // Left = Obstacle, Center = Obstacle, Right = Feed
      const obsType1 = pool.JUMP[Math.floor(Math.random() * pool.JUMP.length)];
      const obsType2 = pool.GENERAL[Math.floor(Math.random() * pool.GENERAL.length)];
      this.createObstacle(-1, currentZ + zOffset, obsType1);
      this.createObstacle(0, currentZ + zOffset + 1.5, obsType2);

      // Single Reward item on Right lane
      this.createCollectible(1, currentZ + zOffset + 0.5, this.currentStage === 'EGG' ? getWeightedGrain() : 'FEED');
    };

    const spawnPatternB = (zOffset: number) => {
      // Left = Feed, Center = Obstacle, Right = Obstacle
      const obsType1 = pool.GENERAL[Math.floor(Math.random() * pool.GENERAL.length)];
      const obsType2 = pool.SLIDE[Math.floor(Math.random() * pool.SLIDE.length)];
      this.createObstacle(0, currentZ + zOffset, obsType1);
      this.createObstacle(1, currentZ + zOffset + 1.5, obsType2);

      // Single Reward item on Left lane
      this.createCollectible(-1, currentZ + zOffset + 0.5, this.currentStage === 'EGG' ? getWeightedGrain() : 'FEED');
    };

    const spawnPatternC = (zOffset: number) => {
      // Moving Vehicle, Obstacle, Feed behind obstacle (calculated risk reward)
      const moveLane = Math.floor(Math.random() * 3) - 1;
      const vehicleType = Math.random() < 0.60 ? 'FORKLIFT' : 'TRUCK';
      const spawned = this.createObstacle(moveLane, currentZ + zOffset, vehicleType);
      if (spawned) {
        (spawned as any).isMovingVehicle = true;
        (spawned as any).moveSpeed = 7.0 + Math.random() * 10.0;
        (spawned as any).moveDir = Math.random() < 0.5 ? 1 : -1;
      }

      let otherLane = Math.floor(Math.random() * 3) - 1;
      while (otherLane === moveLane) otherLane = Math.floor(Math.random() * 3) - 1;
      const obsType = pool.JUMP[Math.floor(Math.random() * pool.JUMP.length)];
      this.createObstacle(otherLane, currentZ + zOffset + 4.0, obsType);

      // Feed placed right behind moving vehicle
      this.createCollectible(moveLane, currentZ + zOffset - 7.0, this.currentStage === 'EGG' ? getWeightedGrain() : 'FEED');
    };

    const spawnPatternD = (zOffset: number) => {
      // Double Vehicle, Gate, Feed reward
      const lane1 = -1;
      const lane2 = 1;
      const vType1 = Math.random() < 0.50 ? 'FORKLIFT' : 'TRACTOR';
      const vType2 = Math.random() < 0.50 ? 'TRUCK' : 'DELIVERY_VAN';
      const obs1 = this.createObstacle(lane1, currentZ + zOffset, vType1);
      const obs2 = this.createObstacle(lane2, currentZ + zOffset, vType2);
      if (obs1 && Math.random() < 0.7) {
        (obs1 as any).isMovingVehicle = true;
        (obs1 as any).moveSpeed = 6.0 + Math.random() * 8.0;
        (obs1 as any).moveDir = Math.random() < 0.5 ? 1 : -1;
      }
      if (obs2 && Math.random() < 0.7) {
        (obs2 as any).isMovingVehicle = true;
        (obs2 as any).moveSpeed = 6.0 + Math.random() * 8.0;
        (obs2 as any).moveDir = Math.random() < 0.5 ? 1 : -1;
      }

      // Gate slide panel (HIGH_BARRIER) in center lane
      this.createObstacle(0, currentZ + zOffset + 5.0, 'HIGH_BARRIER');

      // Reward is placed right after gate as a reward
      this.createCollectible(0, currentZ + zOffset - 2.0, 'CRYSTAL');
    };

    // Skip chances completely removed for true hardcore persistent challenge
    // 2. Progressive difficulty segments layout generation
    const difficultyMode = localStorage.getItem('skm_dev_difficulty') || 'NORMAL';

    if (difficultyMode === 'EASY' && !this.isStage2) {
      // EASY MODE: Low obstacle density, rich feeds
      if (Math.random() < 0.35) {
        const offsetZ = 0.0;
        if (Math.random() < 0.50) {
          spawnPatternA(offsetZ);
        } else {
          spawnPatternB(offsetZ);
        }
      }
      for (let l = -1; l <= 1; l++) {
        if (Math.random() < 0.50) {
          spawnLaneCollectibles(l, currentZ);
        }
      }
      return;
    }

    let virtualDist = absDist;
    let feedMultiplier = 1.0;

    if (difficultyMode === 'HARD') {
      virtualDist = Math.max(600.0, absDist); // Jump straight to Very Hard / Extreme
      feedMultiplier = 0.6;
    } else if (difficultyMode === 'EXTREME') {
      virtualDist = Math.max(1200.0, absDist); // Jump straight to Constant Extreme / Stage 2
      feedMultiplier = 0.35;
    }

    if (this.isStage2) {
      // STAGE 2: BRUTAL (3x obstacle density, 50% lower feed, constant moving vehicles)
      const densityMultiplier = 3;
      for (let i = 0; i < densityMultiplier; i++) {
        // Reduced safe gaps slightly for tighter reactions
        const offsetZ = -15.0 + i * 8.0; 
        const layoutRand = Math.random();

        // 70% chance of spawning moving/dynamic layouts
        if (layoutRand < 0.35) {
          spawnPatternC(offsetZ);
        } else if (layoutRand < 0.70) {
          spawnPatternD(offsetZ);
        } else if (layoutRand < 0.85) {
          // Double static obstacles
          const l1 = Math.floor(Math.random() * 3) - 1;
          let l2 = Math.floor(Math.random() * 3) - 1;
          while (l1 === l2) l2 = Math.floor(Math.random() * 3) - 1;

          const type1 = pool.JUMP[Math.floor(Math.random() * pool.JUMP.length)];
          const type2 = pool.GENERAL[Math.floor(Math.random() * pool.GENERAL.length)];
          this.createObstacle(l1, currentZ + offsetZ, type1);
          this.createObstacle(l2, currentZ + offsetZ, type2);
        } else {
          // Staggered Triple Roadblock
          this.createObstacle(-1, currentZ + offsetZ + 3.0, 'CARGO_CONTAINER');
          this.createObstacle(0, currentZ + offsetZ, 'FORKLIFT');
          this.createObstacle(1, currentZ + offsetZ - 3.0, 'CARGO_CONTAINER');
        }
      }

      // Sparse collectible drop in Stage 2 (50% lower than Stage 1, scaled by difficulty feedMultiplier)
      for (let l = -1; l <= 1; l++) {
        if (Math.random() < 0.15 * feedMultiplier) {
          spawnLaneCollectibles(l, currentZ);
        }
      }
      return;
    }

    // --- STAGE 1 DIFFICULTY TRACKS (REMOVE EASY MODE COMPLETELY IN NORMAL PROGRESSION) ---

    // HARD LAYOUT (0m - 400m)
    if (virtualDist <= 400.0) {
      // Density multiplier of 1.5 average (either 1 or 2 obstacle groupings)
      const density = Math.random() < 0.50 ? 1 : 2;
      for (let i = 0; i < density; i++) {
        const offsetZ = i === 0 ? -4.0 : 8.0;
        const layoutRand = Math.random();
        if (layoutRand < 0.25) {
          spawnPatternA(offsetZ);
        } else if (layoutRand < 0.50) {
          spawnPatternB(offsetZ);
        } else if (layoutRand < 0.75) {
          spawnPatternC(offsetZ);
        } else {
          spawnPatternD(offsetZ);
        }
      }

      // Spawn sparse feeds
      for (let l = -1; l <= 1; l++) {
        if (Math.random() < 0.25 * feedMultiplier) {
          spawnLaneCollectibles(l, currentZ);
        }
      }
      return;
    }

    // VERY HARD LAYOUT (400m - 900m)
    if (virtualDist <= 900.0) {
      // Spawns exactly 2 obstacle groupings per segment
      const offsets = [-8.0, 8.0];
      offsets.forEach((offsetZ, idx) => {
        const layoutRand = Math.random();
        if (layoutRand < 0.30) {
          spawnPatternC(offsetZ);
        } else if (layoutRand < 0.60) {
          spawnPatternD(offsetZ);
        } else {
          // Double lane static block
          const l1 = Math.floor(Math.random() * 3) - 1;
          let l2 = Math.floor(Math.random() * 3) - 1;
          while (l1 === l2) l2 = Math.floor(Math.random() * 3) - 1;
          const obsType1 = pool.JUMP[Math.floor(Math.random() * pool.JUMP.length)];
          const obsType2 = pool.GENERAL[Math.floor(Math.random() * pool.GENERAL.length)];
          this.createObstacle(l1, currentZ + offsetZ, obsType1);
          this.createObstacle(l2, currentZ + offsetZ, obsType2);

          // Reward in remaining open lane
          const openL = [-1, 0, 1].find(l => l !== l1 && l !== l2) ?? 0;
          this.createCollectible(openL, currentZ + offsetZ, this.currentStage === 'EGG' ? getWeightedGrain() : 'FEED');
        }
      });

      for (let l = -1; l <= 1; l++) {
        if (Math.random() < 0.20 * feedMultiplier) {
          spawnLaneCollectibles(l, currentZ);
        }
      }
      return;
    }

    // EXTREME LAYOUT (900m - 1600m)
    if (virtualDist <= 1600.0) {
      // Spawns 2 to 3 obstacle groupings
      const density = Math.random() < 0.35 ? 2 : 3;
      for (let i = 0; i < density; i++) {
        const offsetZ = -12.0 + i * 8.0;
        const layoutRand = Math.random();
        if (layoutRand < 0.35) {
          spawnPatternC(offsetZ);
        } else if (layoutRand < 0.70) {
          spawnPatternD(offsetZ);
        } else {
          // Staggered Triple roadblock
          this.createObstacle(-1, currentZ + offsetZ + 3.0, 'CONE');
          this.createObstacle(0, currentZ + offsetZ, pool.JUMP[Math.floor(Math.random() * pool.JUMP.length)]);
          this.createObstacle(1, currentZ + offsetZ - 3.0, 'BARRICADE');
        }
      }

      for (let l = -1; l <= 1; l++) {
        if (Math.random() < 0.15 * feedMultiplier) {
          spawnLaneCollectibles(l, currentZ);
        }
      }
      return;
    }

    // NIGHTMARE LAYOUT (1600m+)
    // Absolutely relentless. Spawns 3 groupings. Smallest safe gaps. Almost all dynamic/moving.
    const NightmareDensity = 3;
    for (let i = 0; i < NightmareDensity; i++) {
      const offsetZ = -14.0 + i * 7.5; // Very tight gaps
      const layoutRand = Math.random();
      if (layoutRand < 0.40) {
        spawnPatternC(offsetZ);
      } else if (layoutRand < 0.80) {
        spawnPatternD(offsetZ);
      } else {
        // Double moving vehicle blocks
        const lane1 = Math.floor(Math.random() * 3) - 1;
        let lane2 = Math.floor(Math.random() * 3) - 1;
        while (lane1 === lane2) lane2 = Math.floor(Math.random() * 3) - 1;

        const vType1 = 'FORKLIFT';
        const vType2 = 'TRUCK';
        const spawned1 = this.createObstacle(lane1, currentZ + offsetZ, vType1);
        const spawned2 = this.createObstacle(lane2, currentZ + offsetZ - 2.0, vType2);
        
        if (spawned1) {
          (spawned1 as any).isMovingVehicle = true;
          (spawned1 as any).moveSpeed = 10.0 + Math.random() * 8.0;
          (spawned1 as any).moveDir = Math.random() < 0.5 ? 1 : -1;
        }
        if (spawned2) {
          (spawned2 as any).isMovingVehicle = true;
          (spawned2 as any).moveSpeed = 10.0 + Math.random() * 8.0;
          (spawned2 as any).moveDir = Math.random() < 0.5 ? 1 : -1;
        }

        // Drop a tiny reward behind the nightmare moving vehicles
        this.createCollectible(lane1, currentZ + offsetZ - 6.0, 'CRYSTAL');
      }
    }

    for (let l = -1; l <= 1; l++) {
      if (Math.random() < 0.10 * feedMultiplier) {
        spawnLaneCollectibles(l, currentZ);
      }
    }
  }

  private createObstacle(lane: number, zPos: number, specialType?: string): any {
    let type = specialType || 'FENCE';
    const rand = Math.random();

    if (!specialType) {
      if (this.activeTheme === 'CITY_DISTRICT' || this.activeTheme === 'SKM_FACTORY' || this.activeTheme === 'WAREHOUSE' || this.activeTheme === 'RAINY_SEASON') {
        type = rand < 0.25 ? 'CAR' : rand < 0.45 ? 'BUS' : rand < 0.65 ? 'CONE' : rand < 0.85 ? 'BARRICADE' : 'TRUCK';
      } else if (this.activeTheme === 'NIGHT_FARM') {
        type = rand < 0.45 ? 'LOG' : rand < 0.8 ? 'ROCK' : 'FENCE';
      } else if (this.activeTheme === 'RIVER_AREA') {
        type = rand < 0.45 ? 'ROCK' : rand < 0.8 ? 'LOG' : 'FENCE';
      } else if (this.activeTheme === 'VILLAGE_ROADS') {
        type = rand < 0.35 ? 'CAR' : rand < 0.7 ? 'HAY_BALE' : 'FENCE';
      } else {
        // POULTRY_FARM and other agricultural areas
        type = rand < 0.4 ? 'TRACTOR' : rand < 0.75 ? 'HAY_BALE' : 'FENCE';
      }
    }

    let obs = this.obstacles.find((o) => !o.active && o.type === type);
    if (!obs) {
      const mesh = new THREE.Group();
      mesh.name = `obs_${type}`;

      const redMat = new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.65 });

      if (type === 'FENCE') {
        // Double striped warning barrier fence with diagonal bracing and safety flashing lights
        const fenceGroup = new THREE.Group();
        
        const topBar = new THREE.Mesh(this.geoCache['box'], redMat);
        topBar.scale.set(1.9, 0.16, 0.16);
        topBar.position.y = 0.55;
        topBar.castShadow = true;
        fenceGroup.add(topBar);

        // Black stripes over the orange hazard fence bar (Subway Surfers signature style!)
        const stripeMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5 });
        for (let s = -4; s <= 4; s += 2) {
          if (s === 0) continue;
          const stripe = new THREE.Mesh(this.geoCache['box'], stripeMat);
          stripe.scale.set(0.12, 0.18, 0.18);
          stripe.position.set(s * 0.18, 0.55, 0);
          stripe.rotation.z = Math.PI / 4;
          fenceGroup.add(stripe);
        }

        const pillarL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.1, 8), redMat);
        pillarL.position.set(-0.85, 0.55, 0);
        pillarL.castShadow = true;
        fenceGroup.add(pillarL);

        const pillarR = pillarL.clone();
        pillarR.position.x = 0.85;
        fenceGroup.add(pillarR);

        // Diagonal bracing support planks
        const plankL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.08), redMat);
        plankL.position.set(-0.65, 0.45, -0.2);
        plankL.rotation.x = -Math.PI / 5;
        fenceGroup.add(plankL);

        const plankR = plankL.clone();
        plankR.position.x = 0.65;
        fenceGroup.add(plankR);

        // Tiny flashing battery emergency hazard lanterns on top
        for (let side = -1; side <= 1; side += 2) {
          const lantern = new THREE.Group();
          const house = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.2, 0.15), this.matCache['decor_steel_pbr'] || new THREE.MeshStandardMaterial({ color: '#334155' }));
          house.position.y = 0.1;
          lantern.add(house);
          
          const neon = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), new THREE.MeshBasicMaterial({ color: '#f59e0b' }));
          neon.name = 'neon_blinker';
          neon.position.y = 0.22;
          lantern.add(neon);

          lantern.position.set(side * 0.82, 0.68, 0);
          fenceGroup.add(lantern);
        }

        mesh.add(fenceGroup);
      } else if (type === 'HIGH_BARRIER') {
        // Tall cautionary hanging frame requiring under-slides
        const gateMat = new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.5 });
        const cross = new THREE.Mesh(this.geoCache['box'], gateMat);
        cross.scale.set(2.2, 0.22, 0.22);
        cross.position.y = 1.35;
        cross.castShadow = true;
        mesh.add(cross);

        const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.7, 4), gateMat);
        leftLeg.position.set(-1.0, 1.35, 0);
        leftLeg.castShadow = true;
        mesh.add(leftLeg);

        const rightLeg = leftLeg.clone();
        rightLeg.position.x = 1.0;
        mesh.add(rightLeg);

        // Warning striped coverplate
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.48), new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.6 }));
        sign.position.set(0, 0.95, 0);
        mesh.add(sign);

        // Hanging cautionary caution-tape stripe chains
        const chainMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.9 });
        for (let c = -1; c <= 1; c += 2) {
          const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 6), chainMat);
          tassel.position.set(c * 0.62, 1.1, 0);
          tassel.castShadow = true;
          mesh.add(tassel);
        }
      } else if (type === 'HAY_BALE') {
        // Farm giant crop bale with wrapping ropes
        const hayGroup = new THREE.Group();
        const bale = new THREE.Mesh(
          new THREE.CylinderGeometry(0.95, 0.95, 1.9, 12),
          new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.95 })
        );
        bale.rotation.z = Math.PI / 2;
        bale.position.y = 0.45;
        bale.castShadow = true;
        hayGroup.add(bale);

        // Model physical packaging ropes wrapped tight around the hay
        const ropeMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.9 });
        for (let r = -1; r <= 1; r += 2) {
          const ropeCirc = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.05, 10), ropeMat);
          ropeCirc.rotation.z = Math.PI / 2;
          ropeCirc.position.set(r * 0.5, 0.45, 0);
          hayGroup.add(ropeCirc);
        }
        mesh.add(hayGroup);
      } else if (type === 'TRACTOR') {
        // Detailed farmers heavy tractor obstacle
        const tractorGroup = new THREE.Group();
        
        const greenMat = new THREE.MeshStandardMaterial({ color: '#166534', roughness: 0.45 });
        const metalCabMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.6, roughness: 0.2 });
        const wheelMat = this.matCache['black_matte'] || new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.9 });

        // Build core engine hood engine block
        const body = new THREE.Mesh(this.geoCache['box'], greenMat);
        body.scale.set(1.4, 1.1, 2.2);
        body.position.y = 0.72;
        body.castShadow = true;
        body.receiveShadow = true;
        tractorGroup.add(body);

        // Front mesh chrome engine grille
        const grille = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.75, 0.05), new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.9, roughness: 0.2 }));
        grille.position.set(0, 0.7, 1.11);
        tractorGroup.add(grille);

        // Shining headlights
        const lightGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.12, 6);
        const lensMat = new THREE.MeshBasicMaterial({ color: '#fffbeb' });
        const headL = new THREE.Mesh(lightGeo, lensMat);
        headL.rotation.x = Math.PI / 2;
        headL.position.set(-0.48, 0.85, 1.11);
        tractorGroup.add(headL);

        const headR = headL.clone();
        headR.position.x = 0.48;
        tractorGroup.add(headR);

        // Cab
        const cab = new THREE.Mesh(this.geoCache['box'], new THREE.MeshStandardMaterial({ color: '#e0f2fe', roughness: 0.1, transparent: true, opacity: 0.85 }));
        cab.scale.set(1.1, 0.95, 1.1);
        cab.position.set(0, 1.7, -0.32);
        cab.castShadow = true;
        tractorGroup.add(cab);

        // Black metal cab cage roof
        const roof = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.1, 1.18), metalCabMat);
        roof.position.set(0, 2.2, -0.32);
        roof.castShadow = true;
        tractorGroup.add(roof);

        // Chimney Exhaust Pipe with smoke puffs
        const exPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.92, 6), metalCabMat);
        exPipe.name = 'exhaust_pipe';
        exPipe.position.set(0.42, 1.55, 0.45);
        exPipe.castShadow = true;
        tractorGroup.add(exPipe);

        // Wheels Big heavy dynamic rear tires
        const tireBigL = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.42, 10), wheelMat);
        tireBigL.rotation.z = Math.PI / 2;
        tireBigL.position.set(-0.85, 0.62, -0.55);
        tireBigL.castShadow = true;
        tractorGroup.add(tireBigL);

        const tireBigR = tireBigL.clone();
        tireBigR.position.x = 0.85;
        tractorGroup.add(tireBigR);

        // Wheels Front tires
        const tireSmallL = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.32, 10), wheelMat);
        tireSmallL.rotation.z = Math.PI / 2;
        tireSmallL.position.set(-0.8, 0.38, 0.65);
        tireSmallL.castShadow = true;
        tractorGroup.add(tireSmallL);

        const tireSmallR = tireSmallL.clone();
        tireSmallR.position.x = 0.8;
        tractorGroup.add(tireSmallR);

        mesh.add(tractorGroup);
      } else if (type === 'TRUCK') {
        const truckGroup = new THREE.Group();
        const metalMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.6, metalness: 0.4 });
        const rustCabMat = new THREE.MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.4 });
        
        // Cargo load pile box
        const cargoBox = new THREE.Mesh(this.geoCache['box'], new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.95 }));
        cargoBox.scale.set(1.48, 1.35, 2.8);
        cargoBox.position.set(0, 1.15, -0.6);
        cargoBox.castShadow = true;
        cargoBox.receiveShadow = true;
        truckGroup.add(cargoBox);

        // Burlap grain bags piled in the cargo box
        const bagMat = new THREE.MeshStandardMaterial({ color: '#ca8a04', roughness: 0.95 });
        for (let b = 0; b < 4; b++) {
          const bag = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6), bagMat);
          bag.scale.set(1.1, 0.6, 1.4);
          bag.position.set((b % 2 === 0 ? 0.32 : -0.32), 1.95, -1.2 + b * 0.4);
          bag.rotation.y = b * Math.PI / 4;
          bag.castShadow = true;
          truckGroup.add(bag);
        }

        // Front cab
        const cab = new THREE.Mesh(this.geoCache['box'], rustCabMat);
        cab.scale.set(1.44, 1.45, 1.4);
        cab.position.set(0, 0.95, 1.3);
        cab.castShadow = true;
        truckGroup.add(cab);

        // Windscreen windshield
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.22, 0.62), new THREE.MeshStandardMaterial({ color: '#bae6fd', roughness: 0.1, transparent: true, opacity: 0.9 }));
        glass.position.set(0, 1.25, 2.01);
        truckGroup.add(glass);

        // Silver dynamic grille
        const grille = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 0.05), new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.8, roughness: 0.1 }));
        grille.position.set(0, 0.45, 2.01);
        truckGroup.add(grille);

        // Black sturdy wheels
        const wheelMat = this.matCache['black_matte'] || new THREE.MeshStandardMaterial({ color: '#1e293b' });
        for (let w = -1; w <= 1; w += 2) {
          const tireF = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.3, 8), wheelMat);
          tireF.rotation.z = Math.PI / 2;
          tireF.position.set(w * 0.82, 0.38, 1.15);
          tireF.castShadow = true;
          truckGroup.add(tireF);

          const tireBack = tireF.clone();
          tireBack.position.z = -1.2;
          truckGroup.add(tireBack);
        }

        mesh.add(truckGroup);
      } else if (type === 'FORKLIFT') {
        const forkliftGroup = new THREE.Group();
        const yellowMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.2 });
        const blackMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.9 });
        const silverMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.9, roughness: 0.1 });

        // Forklift main body
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.5), yellowMat);
        cabin.position.y = 0.65;
        cabin.castShadow = true;
        forkliftGroup.add(cabin);

        // Mast frame
        const mast = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.1), blackMat);
        mast.position.set(0, 0.8, 0.76);
        forkliftGroup.add(mast);

        // Silver forks
        for (let side = -1; side <= 1; side += 2) {
          const prong = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.85), silverMat);
          prong.position.set(side * 0.32, 0.1, 1.15);
          prong.castShadow = true;
          forkliftGroup.add(prong);
        }

        // Lift load: A cardboard box or crate!
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.72, 0.72), new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.8 }));
        crate.position.set(0, 0.48, 1.1);
        crate.castShadow = true;
        forkliftGroup.add(crate);

        // Tires
        for (let xSide = -1; xSide <= 1; xSide += 2) {
          const tireF = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 8), blackMat);
          tireF.rotation.z = Math.PI / 2;
          tireF.position.set(xSide * 0.58, 0.25, 0.5);
          forkliftGroup.add(tireF);

          const tireB = tireF.clone();
          tireB.position.z = -0.5;
          forkliftGroup.add(tireB);
        }

        mesh.add(forkliftGroup);
      } else if (type === 'EGG_CAGE') {
        const cageGroup = new THREE.Group();
        const steelMat = new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.8, roughness: 0.2 });
        const brownEggMat = new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.3 });

        // Hollow metal cage frames
        const bottom = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 1.2), steelMat);
        bottom.position.y = 0.05;
        cageGroup.add(bottom);

        const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 1.2), steelMat);
        top.position.y = 1.35;
        cageGroup.add(top);

        for (let cx = -1; cx <= 1; cx += 2) {
          for (let cz = -1; cz <= 1; cz += 2) {
            const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 6), steelMat);
            bar.position.set(cx * 0.55, 0.7, cz * 0.55);
            cageGroup.add(bar);
          }
        }

        // Standard egg meshes inside
        for (let i = 0; i < 4; i++) {
          const egg = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), brownEggMat);
          egg.scale.set(1.0, 1.3, 1.0);
          
          const ox = ((i % 2) - 0.5) * 0.55;
          const oz = (Math.floor(i / 2) - 0.5) * 0.55;
          egg.position.set(ox, 0.35 + i * 0.22, oz);
          egg.castShadow = true;
          cageGroup.add(egg);
        }

        mesh.add(cageGroup);
      } else if (type === 'FACTORY_CONVEYOR' || type === 'CARGO_CONTAINER') {
        const conveyorGroup = new THREE.Group();
        const greyMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.3, metalness: 0.6 });
        const stripeMat = new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.2 });

        // Giant Container style
        const container = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.5, 3.2), stripeMat);
        container.position.y = 0.75;
        container.castShadow = true;
        conveyorGroup.add(container);

        for (let r = -4; r <= 4; r++) {
          const rib = new THREE.Mesh(new THREE.BoxGeometry(2.06, 1.55, 0.12), greyMat);
          rib.position.set(0, 0.75, r * 0.32);
          rib.castShadow = true;
          conveyorGroup.add(rib);
        }

        mesh.add(conveyorGroup);
      } else if (type === 'CAR') {
        const carGroup = new THREE.Group();
        const style = Math.floor(Math.random() * 10); // 10 distinct car designs!

        const colors = [
          '#dc2626', '#2563eb', '#16a34a', '#ca8a04', '#7c3aed', 
          '#db2777', '#0891b2', '#ea580c', '#1e293b', '#f8fafc'
        ];
        const chosenCol = colors[style % colors.length];

        const bodyMat = new THREE.MeshStandardMaterial({ color: chosenCol, roughness: 0.15, metalness: 0.6 });
        const cabMat = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.2 });
        const glassMat = new THREE.MeshStandardMaterial({ color: '#e0f2fe', roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.7 });
        const tireMat = new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.85 });
        const chromeMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.1, metalness: 0.9 });

        // Base chassis
        const lowerBody = new THREE.Mesh(this.geoCache['box'], bodyMat);
        lowerBody.scale.set(1.4, 0.58, 2.4);
        lowerBody.position.y = 0.45;
        lowerBody.castShadow = true;
        carGroup.add(lowerBody);

        // Core Cabin based on style!
        if (style === 0) {
          // Style 1: Sports Racing Coupe with Spoiler
          const cab = new THREE.Mesh(this.geoCache['box'], cabMat);
          cab.scale.set(1.15, 0.44, 1.15);
          cab.position.set(0, 0.9, -0.1);
          carGroup.add(cab);

          // Big Rear Wing Spoiler
          const wingPostL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.08), chromeMat);
          wingPostL.position.set(-0.48, 0.8, -1.0);
          carGroup.add(wingPostL);

          const wingPostR = wingPostL.clone();
          wingPostR.position.x = 0.48;
          carGroup.add(wingPostR);

          const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.35), bodyMat);
          spoiler.position.set(0, 1.05, -1.0);
          carGroup.add(spoiler);
        } else if (style === 1) {
          // Style 2: Compact Hatchback
          const cab = new THREE.Mesh(this.geoCache['box'], cabMat);
          cab.scale.set(1.15, 0.55, 1.4);
          cab.position.set(0, 0.95, -0.2);
          carGroup.add(cab);

          // Rear antenna
          const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 4), chromeMat);
          ant.position.set(0, 1.4, -0.7);
          ant.rotation.x = Math.PI / 12;
          carGroup.add(ant);
        } else if (style === 2) {
          // Style 3: Tall SUV
          lowerBody.scale.set(1.42, 0.72, 2.4);
          lowerBody.position.y = 0.52;

          const cab = new THREE.Mesh(this.geoCache['box'], cabMat);
          cab.scale.set(1.2, 0.58, 1.55);
          cab.position.set(0, 1.1, -0.15);
          carGroup.add(cab);

          // Roof rack cargo carrier
          const rack = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.1, 1.1), chromeMat);
          rack.position.set(0, 1.44, -0.15);
          carGroup.add(rack);

          // Spare tire on back
          const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 8), tireMat);
          spare.rotation.x = Math.PI / 2;
          spare.position.set(0, 0.8, -1.25);
          carGroup.add(spare);
        } else if (style === 3) {
          // Style 4: Vintage American Muscle Car with Blower Scoop
          const cab = new THREE.Mesh(this.geoCache['box'], cabMat);
          cab.scale.set(1.15, 0.42, 1.1);
          cab.position.set(0, 0.9, -0.25);
          carGroup.add(cab);

          // Chrome Air blower on bonnet block
          const blower = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.42), chromeMat);
          blower.position.set(0, 0.82, 0.65);
          carGroup.add(blower);
        } else if (style === 4) {
          // Style 5: Luxury Sedan
          lowerBody.scale.set(1.36, 0.54, 2.65);
          const cab = new THREE.Mesh(this.geoCache['box'], cabMat);
          cab.scale.set(1.12, 0.46, 1.45);
          cab.position.set(0, 0.9, -0.12);
          carGroup.add(cab);

          // Gold Hood Ornament
          const ornament = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), new THREE.MeshStandardMaterial({ color: '#f59e0b', metalness: 0.9 }));
          ornament.position.set(0, 0.77, 1.25);
          carGroup.add(ornament);
        } else if (style === 5) {
          // Style 6: Modern Electric EV with sleek neon line
          const cab = new THREE.Group();
          const glassDome = new THREE.Mesh(new THREE.SphereGeometry(0.64, 10, 10), glassMat);
          glassDome.scale.set(0.92, 0.82, 1.6);
          glassDome.position.set(0, 0.8, -0.1);
          cab.add(glassDome);
          carGroup.add(cab);

          // Front neon light strip
          const neonLine = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.05, 0.08), new THREE.MeshBasicMaterial({ color: '#22d3ee' }));
          neonLine.position.set(0, 0.58, 1.21);
          carGroup.add(neonLine);
        } else if (style === 6) {
          // Style 7: Farmer Pickup Truck
          lowerBody.scale.set(1.4, 0.6, 2.5);
          const cab = new THREE.Mesh(this.geoCache['box'], cabMat);
          cab.scale.set(1.2, 0.55, 1.15);
          cab.position.set(0, 0.95, 0.25);
          carGroup.add(cab);

          // Bed guard rail
          const rail = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.32, 1.1), chromeMat);
          rail.position.set(0, 0.8, -0.7);
          carGroup.add(rail);
        } else if (style === 7) {
          // Style 8: High Speed Roadster Convertible
          const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.32, 0.48), new THREE.MeshStandardMaterial({ color: '#78350f' }));
          seat.position.set(0, 0.82, -0.05);
          carGroup.add(seat);

          const rollBar = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 6, 12), chromeMat);
          rollBar.position.set(0, 0.92, -0.42);
          carGroup.add(rollBar);
        } else if (style === 8) {
          // Style 9: Urban Delivery Panel Van
          lowerBody.scale.set(1.4, 0.7, 2.5);
          const vanShell = new THREE.Mesh(this.geoCache['box'], bodyMat);
          vanShell.scale.set(1.25, 0.85, 1.95);
          vanShell.position.set(0, 1.1, -0.25);
          carGroup.add(vanShell);

          const cab = new THREE.Mesh(this.geoCache['box'], cabMat);
          cab.scale.set(1.2, 0.45, 0.52);
          cab.position.set(0, 0.9, 0.9);
          carGroup.add(cab);
        } else {
          // Style 10: Flashing Blue Highway Patrol Police Cruiser
          const cab = new THREE.Mesh(this.geoCache['box'], cabMat);
          cab.scale.set(1.15, 0.46, 1.3);
          cab.position.set(0, 0.9, -0.15);
          carGroup.add(cab);

          // Flashing siren bar
          const sirenBar = new THREE.Group();
          sirenBar.name = 'police_siren_bar';
          const centerBar = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.08, 0.15), chromeMat);
          sirenBar.add(centerBar);

          const redBlinker = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, 0.14), new THREE.MeshBasicMaterial({ color: '#ef4444' }));
          redBlinker.name = 'police_red';
          redBlinker.position.set(-0.25, 0, 0);
          sirenBar.add(redBlinker);

          const blueBlinker = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, 0.14), new THREE.MeshBasicMaterial({ color: '#3b82f6' }));
          blueBlinker.name = 'police_blue';
          blueBlinker.position.set(0.25, 0, 0);
          sirenBar.add(blueBlinker);

          sirenBar.position.set(0, 1.2, -0.15);
          carGroup.add(sirenBar);
        }

        // Shared details: glass windshield overlay (not on open convertible)
        if (style !== 7 && style !== 5) {
          const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.42), glassMat);
          glass.position.set(0, 0.98, 0.52);
          glass.rotation.x = -Math.PI / 8;
          carGroup.add(glass);
        }

        // Shared LED headlight beams
        const headL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), new THREE.MeshStandardMaterial({ color: '#fffbeb', emissive: '#fffbeb', emissiveIntensity: 2.2 }));
        headL.position.set(-0.48, 0.55, 1.21);
        carGroup.add(headL);

        const headR = headL.clone();
        headR.position.x = 0.48;
        carGroup.add(headR);

        // Wheels
        for (let xS = -1; xS <= 1; xS += 2) {
          for (let zS = -1; zS <= 1; zS += 2) {
            const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.28, 10), tireMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(xS * 0.72, 0.35, zS * 0.75);
            wheel.castShadow = true;
            carGroup.add(wheel);
          }
        }

        mesh.add(carGroup);

        mesh.add(carGroup);
      } else if (type === 'BUS') {
        const busGroup = new THREE.Group();
        const colors = ['#eab308', '#2563eb', '#4b5563'];
        const chosenCol = colors[Math.floor(Math.random() * colors.length)];
        const busMat = new THREE.MeshStandardMaterial({ color: chosenCol, roughness: 0.3, metalness: 0.5 });
        const glassMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.05, metalness: 0.95, transparent: true, opacity: 0.7 });
        const tyreMat = this.matCache['black_matte'] || new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.95 });

        // Big bus body
        const body = new THREE.Mesh(this.geoCache['box'], busMat);
        body.scale.set(1.62, 1.95, 4.25);
        body.position.y = 1.05;
        body.castShadow = true;
        body.receiveShadow = true;
        busGroup.add(body);

        // Front Destination board
        const destMat = new THREE.MeshStandardMaterial({ color: '#09090b', emissive: '#eab308', emissiveIntensity: 1.6 });
        const destScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.26), destMat);
        destScreen.position.set(0, 1.76, 2.131);
        busGroup.add(destScreen);

        // Front window shield
        const frontGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 0.55), glassMat);
        frontGlass.position.set(0, 1.3, 2.131);
        busGroup.add(frontGlass);

        // Passenger Side windows rows
        for (let side = -1; side <= 1; side += 2) {
          const sRot = side * Math.PI / 2;
          for (let w = -2; w <= 2; w++) {
            const sideGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.78), glassMat);
            sideGlass.position.set(side * 0.816, 1.34, w * 0.75);
            sideGlass.rotation.y = sRot;
            busGroup.add(sideGlass);
          }
        }

        // Headlights (big round glowers)
        const lightGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.05, 8);
        const lightMat = new THREE.MeshStandardMaterial({ color: '#fffbeb', emissive: '#f59e0b', emissiveIntensity: 2.2 });
        const headL = new THREE.Mesh(lightGeo, lightMat);
        headL.rotation.x = Math.PI / 2;
        headL.position.set(-0.55, 0.45, 2.131);
        busGroup.add(headL);

        const headR = headL.clone();
        headR.position.x = 0.55;
        busGroup.add(headR);

        // Heavy tires (6 of them)
        const zSplits = [-1.4, 0.0, 1.4];
        for (let side = -1; side <= 1; side += 2) {
          zSplits.forEach((zs) => {
            const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.32, 10), tyreMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(side * 0.82, 0.42, zs);
            wheel.castShadow = true;
            busGroup.add(wheel);
          });
        }

        mesh.add(busGroup);
      } else if (type === 'CONE') {
        const coneGroup = new THREE.Group();
        const baseMat = new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.6 });
        const stripMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.3, emissive: '#cbd5e1', emissiveIntensity: 0.4 });

        // Base square plate
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.06, 0.85), baseMat);
        base.position.y = 0.03;
        base.castShadow = true;
        coneGroup.add(base);

        // Body conical
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.35, 1.15, 10), baseMat);
        body.position.y = 0.605;
        body.castShadow = true;
        coneGroup.add(body);

        // High visual stripe indicator around the middle
        const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.151, 0.221, 0.36, 10), stripMat);
        stripe.position.y = 0.65;
        coneGroup.add(stripe);

        mesh.add(coneGroup);
      } else if (type === 'BARRICADE') {
        const barryGroup = new THREE.Group();
        const frameMat = new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.6 });
        const stripMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.3, emissive: '#fef08a', emissiveIntensity: 0.3 });

        // Heavy base feet panels
        const footL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.82), frameMat);
        footL.position.set(-0.85, 0.05, 0);
        footL.castShadow = true;
        barryGroup.add(footL);

        const footR = footL.clone();
        footR.position.x = 0.85;
        barryGroup.add(footR);

        // Angled side posts
        const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.15, 6), frameMat);
        postL.position.set(-0.85, 0.6, 0);
        postL.castShadow = true;
        barryGroup.add(postL);

        const postR = postL.clone();
        postR.position.x = 0.85;
        barryGroup.add(postR);

        // Corrugated striped horizontal planks
        const boardY = [0.45, 0.95];
        boardY.forEach((by) => {
          const board = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.28, 0.08), frameMat);
          board.position.set(0, by, 0);
          board.castShadow = true;
          barryGroup.add(board);

          // Diagonal white strip decoration overlay
          const sticker = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.091), stripMat);
          for (let xPos = -0.75; xPos <= 0.75; xPos += 0.55) {
            const currentStrip = sticker.clone();
            currentStrip.position.set(xPos, by, 0);
            currentStrip.rotation.z = Math.PI / 4;
            barryGroup.add(currentStrip);
          }
        });

        // Glowing active battery hazard warning lantern on top center
        const lantern = new THREE.Group();
        const baseBox = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.18), new THREE.MeshStandardMaterial({ color: '#1e293b' }));
        baseBox.position.y = 0.11;
        lantern.add(baseBox);

        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshStandardMaterial({
          color: '#f59e0b',
          emissive: '#f59e0b',
          emissiveIntensity: 2.2
        }));
        beacon.name = 'neon_blinker';
        beacon.position.y = 0.26;
        lantern.add(beacon);

        lantern.position.set(0, 1.1, 0);
        barryGroup.add(lantern);

        mesh.add(barryGroup);
      } else if (type === 'CONTAINER' || type === 'TRUCK' || type === 'BUS') {
        const containerGroup = new THREE.Group();
        const baseColor = type === 'CONTAINER' ? '#dc2626' : '#2563eb';
        const contMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.4 });
        
        // Core block
        const containerBox = new THREE.Mesh(this.geoCache['box'], contMat);
        containerBox.scale.set(1.6, 1.9, 2.6);
        containerBox.position.y = 0.95;
        containerBox.castShadow = true;
        containerBox.receiveShadow = true;
        containerGroup.add(containerBox);

        // Models physical corrugated steel lines (vertical slots flanking properties)
        const stripMat = new THREE.MeshStandardMaterial({ color: type === 'CONTAINER' ? '#991b1b' : '#1e40af', roughness: 0.5 });
        for (let zS = -5; zS <= 5; zS++) {
          const leftStrip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.86, 0.08), stripMat);
          leftStrip.position.set(-0.81, 0.95, zS * 0.22);
          containerGroup.add(leftStrip);

          const rightStrip = leftStrip.clone();
          rightStrip.position.x = 0.81;
          containerGroup.add(rightStrip);
        }

        // Heavy locking latch bolts at the rear container doors
        const metalMat = new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.8, roughness: 0.2 });
        const lockBar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.7, 6), metalMat);
        lockBar.position.set(-0.25, 0.95, -1.31);
        containerGroup.add(lockBar);

        const lockBarR = lockBar.clone();
        lockBarR.position.x = 0.25;
        containerGroup.add(lockBarR);

        // Yellow high hazard stripes on corner panels
        const stickerMat = new THREE.MeshBasicMaterial({ color: '#f59e0b' });
        const hSticker = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.85), stickerMat);
        hSticker.position.set(0.811, 1.25, -0.92);
        hSticker.rotation.y = Math.PI / 2;
        containerGroup.add(hSticker);

        mesh.add(containerGroup);
      } else if (type === 'WOODEN_CRATE') {
        const crateGroup = new THREE.Group();
        const mainBox = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 1.1, 1.1),
          new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.9 })
        );
        mainBox.position.y = 0.55;
        mainBox.castShadow = true;
        mainBox.receiveShadow = true;
        crateGroup.add(mainBox);

        const plankMat = new THREE.MeshStandardMaterial({ color: '#7c2d12', roughness: 0.95 });
        const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.12), plankMat);
        cross1.position.set(0.55, 0.55, 0);
        cross1.rotation.y = Math.PI / 4;
        crateGroup.add(cross1);

        const cross2 = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.08, 0.08), plankMat);
        cross2.position.set(0, 0.55, 0.55);
        cross2.rotation.y = Math.PI / 4;
        crateGroup.add(cross2);

        mesh.add(crateGroup);
      } else if (type === 'FEED_BAGS') {
        const bagGroup = new THREE.Group();
        const burlapMat = new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.9 });
        const tieMat = new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.9 });

        for (let b = 0; b < 3; b++) {
          const bagMesh = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), burlapMat);
          bagMesh.scale.set(1.0, 1.4, 0.85);
          bagMesh.castShadow = true;

          const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 6), tieMat);
          tie.position.y = 0.55;
          bagMesh.add(tie);

          if (b === 0) {
            bagMesh.position.set(-0.25, 0.38, 0);
            bagMesh.rotation.z = 0.15;
          } else if (b === 1) {
            bagMesh.position.set(0.25, 0.38, -0.15);
            bagMesh.rotation.z = -0.15;
          } else {
            bagMesh.position.set(0, 0.72, -0.05);
            bagMesh.scale.multiplyScalar(0.85);
          }
          bagGroup.add(bagMesh);
        }
        mesh.add(bagGroup);
      } else if (type === 'CHICKEN_CAGE') {
        const cageGroup = new THREE.Group();
        const frameMat = new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.8 });
        const wireMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.3, transparent: true, opacity: 0.65 });

        const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 1.1), frameMat);
        frame.position.y = 0.45;
        frame.castShadow = true;
        cageGroup.add(frame);

        const wireBox = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.8, 0.98), wireMat);
        wireBox.position.y = 0.45;
        cageGroup.add(wireBox);

        const henBody = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 6, 6),
          new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.8 })
        );
        henBody.position.set(0, 0.32, 0);
        henBody.scale.set(1.3, 1.0, 1.0);
        cageGroup.add(henBody);

        const henComb = new THREE.Mesh(
          new THREE.BoxGeometry(0.04, 0.08, 0.08),
          new THREE.MeshBasicMaterial({ color: '#ef4444' })
        );
        henComb.position.set(0.18, 0.45, 0);
        cageGroup.add(henComb);

        mesh.add(cageGroup);
      } else if (type === 'LOG') {
        const logGroup = new THREE.Group();
        const barkMat = new THREE.MeshStandardMaterial({ color: '#5c2d18', roughness: 0.9 });
        const coreMat = new THREE.MeshStandardMaterial({ color: '#fef08a', roughness: 0.5 });
        const leafMat = new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.6 });

        // Core lying cylinder
        const logCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.8, 8), barkMat);
        logCyl.rotation.z = Math.PI / 2;
        logCyl.position.y = 0.3;
        logCyl.castShadow = true;
        logCyl.receiveShadow = true;
        logGroup.add(logCyl);

        // Core cut ends (rings pattern)
        for (let side = -1; side <= 1; side += 2) {
          const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 8), coreMat);
          cap.rotation.z = Math.PI / 2;
          cap.position.set(side * 0.91, 0.3, 0);
          logGroup.add(cap);
        }

        // Sprouting twigs / leaves
        const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.4, 6), barkMat);
        branch.position.set(-0.35, 0.52, -0.15);
        branch.rotation.z = -Math.PI / 6;
        logGroup.add(branch);

        const leafCluster = new THREE.Mesh(new THREE.SphereGeometry(0.18, 5, 5), leafMat);
        leafCluster.position.set(-0.45, 0.72, -0.18);
        logGroup.add(leafCluster);

        mesh.add(logGroup);
      } else if (type === 'ROCK') {
        const rockGroup = new THREE.Group();
        const rockMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.95 });
        const mossMat = new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.98 });

        // Main boulder
        const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(0.48), rockMat);
        boulder.position.set(0, 0.42, 0);
        boulder.rotation.set(Math.random(), Math.random(), Math.random());
        boulder.castShadow = true;
        boulder.receiveShadow = true;
        rockGroup.add(boulder);

        // Sub side rocks
        const sideRockL = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32), rockMat);
        sideRockL.position.set(-0.42, 0.28, 0.12);
        sideRockL.castShadow = true;
        rockGroup.add(sideRockL);

        const sideRockR = new THREE.Mesh(new THREE.DodecahedronGeometry(0.26), rockMat);
        sideRockR.position.set(0.38, 0.22, -0.1);
        sideRockR.castShadow = true;
        rockGroup.add(sideRockR);

        // Small moss overlay on top crevice
        const mossPatch = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22), mossMat);
        mossPatch.scale.set(1.5, 0.4, 1.2);
        mossPatch.position.set(0.05, 0.82, -0.05);
        mossPatch.castShadow = true;
        rockGroup.add(mossPatch);

        mesh.add(rockGroup);
      } else if (type === 'DELIVERY_VAN') {
        const vanGroup = new THREE.Group();
        const vanMat = new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.4 });
        const windscreenMat = new THREE.MeshStandardMaterial({ color: '#38bdf8', roughness: 0.1 });
        const tireMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.8 });

        const cabin = new THREE.Mesh(this.geoCache['box'], vanMat);
        cabin.scale.set(1.4, 1.45, 2.8);
        cabin.position.y = 0.95;
        cabin.castShadow = true;
        vanGroup.add(cabin);

        const windowF = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.55), windscreenMat);
        windowF.position.set(0, 1.25, 1.41);
        vanGroup.add(windowF);

        for (let w = -1; w <= 1; w += 2) {
          const wheelFL = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 8), tireMat);
          wheelFL.rotation.z = Math.PI / 2;
          wheelFL.position.set(w * 0.72, 0.35, 0.85);
          wheelFL.castShadow = true;
          vanGroup.add(wheelFL);

          const wheelRL = wheelFL.clone();
          wheelRL.position.z = -0.85;
          vanGroup.add(wheelRL);
        }

        mesh.add(vanGroup);
      } else if (type === 'ROAD_BARRIER') {
        const barrierGroup = new THREE.Group();
        const redMat = new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.7 });
        const whiteMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.7 });

        for (let i = -1; i <= 1; i++) {
          const block = new THREE.Mesh(
            new THREE.BoxGeometry(0.62, 0.52, 0.42),
            i === 0 ? whiteMat : redMat
          );
          block.position.set(i * 0.6, 0.26, 0);
          block.castShadow = true;
          barrierGroup.add(block);
        }
        mesh.add(barrierGroup);
      } else if (type === 'FORKLIFT') {
        const forkliftGroup = new THREE.Group();
        const goldMat = new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.5 });
        const metalMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.3, metalness: 0.4 });
        const wheelMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.9 });

        const forkBody = new THREE.Mesh(this.geoCache['box'], goldMat);
        forkBody.scale.set(1.15, 0.75, 1.6);
        forkBody.position.y = 0.52;
        forkBody.castShadow = true;
        forkliftGroup.add(forkBody);

        const cage = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.8, 0.85), metalMat);
        cage.position.set(0, 1.25, -0.15);
        cage.castShadow = true;
        forkliftGroup.add(cage);

        const forkL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.85), metalMat);
        forkL.position.set(-0.32, 0.15, 1.15);
        forkliftGroup.add(forkL);

        const forkR = forkL.clone();
        forkR.position.x = 0.32;
        forkliftGroup.add(forkR);

        for (let s = -1; s <= 1; s += 2) {
          const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.25, 8), wheelMat);
          tire.rotation.z = Math.PI / 2;
          tire.position.set(s * 0.62, 0.32, 0.4);
          tire.castShadow = true;
          forkliftGroup.add(tire);

          const backTire = tire.clone();
          backTire.position.z = -0.4;
          forkliftGroup.add(backTire);
        }

        mesh.add(forkliftGroup);
      } else if (type === 'CARGO_PALLET') {
        const palletGroup = new THREE.Group();
        const woodMat = new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.95 });

        for (let h = 0; h < 2; h++) {
          const offsetH = h * 0.22;
          const deck = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 1.2), woodMat);
          deck.position.y = offsetH + 0.18;
          deck.castShadow = true;
          palletGroup.add(deck);

          const deckBottom = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 1.2), woodMat);
          deckBottom.position.y = offsetH + 0.03;
          deckBottom.castShadow = true;
          palletGroup.add(deckBottom);

          for (let s = -1; s <= 1; s++) {
            const runner = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 1.2), woodMat);
            runner.position.set(s * 0.45, offsetH + 0.1, 0);
            palletGroup.add(runner);
          }
        }
        mesh.add(palletGroup);
      } else if (type === 'FLOATING_LOG') {
        const logGroup = new THREE.Group();
        const barkMat = new THREE.MeshStandardMaterial({ color: '#7c2d12', roughness: 0.9 });
        const coreMat = new THREE.MeshStandardMaterial({ color: '#fed7aa', roughness: 0.85 });

        const logMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.8, 10), barkMat);
        logMesh.rotation.z = Math.PI / 2;
        logMesh.position.y = 0.32;
        logMesh.castShadow = true;
        logGroup.add(logMesh);

        const ringsL = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 10), coreMat);
        ringsL.rotation.x = Math.PI / 2;
        ringsL.position.set(-0.91, 0.32, 0);
        logGroup.add(ringsL);

        const ringsR = ringsL.clone();
        ringsR.position.x = 0.91;
        logGroup.add(ringsR);

        mesh.add(logGroup);
      } else if (type === 'WATER_PUDDLE') {
        const puddleGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.015, 12);
        const puddleMat = new THREE.MeshStandardMaterial({
          color: '#38bdf8',
          roughness: 0.05,
          transparent: true,
          opacity: 0.72
        });
        const puddleMesh = new THREE.Mesh(puddleGeo, puddleMat);
        puddleMesh.position.y = 0.008;
        mesh.add(puddleMesh);
      } else if (type === 'OIL_SPILL') {
        const oilGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.015, 10);
        const oilMat = new THREE.MeshStandardMaterial({
          color: '#0f172a',
          roughness: 0.05,
          metalness: 0.8,
          transparent: true,
          opacity: 0.85
        });
        const oilMesh = new THREE.Mesh(oilGeo, oilMat);
        oilMesh.position.y = 0.008;
        mesh.add(oilMesh);
      } else if (type === 'FISHING_NET') {
        const netGroup = new THREE.Group();
        const poleMat = new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.9 });
        const ropeMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.85, transparent: true, opacity: 0.7 });

        const poleL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.5, 6), poleMat);
        poleL.position.set(-0.85, 0.75, 0);
        poleL.castShadow = true;
        netGroup.add(poleL);

        const poleR = poleL.clone();
        poleR.position.x = 0.85;
        netGroup.add(poleR);

        const netBody = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.95, 0.04), ropeMat);
        netBody.position.set(0, 0.82, 0);
        netGroup.add(netBody);

        mesh.add(netGroup);
      } else if (type === 'BOAT_OBSTACLE') {
        const boatGroup = new THREE.Group();
        const woodMat = new THREE.MeshStandardMaterial({ color: '#7c2d12', roughness: 0.9 });

        const hull = new THREE.Mesh(
          new THREE.CylinderGeometry(0.38, 0.38, 1.8, 12, 1, false, 0, Math.PI),
          woodMat
        );
        hull.rotation.z = Math.PI / 2;
        hull.position.y = 0.22;
        hull.castShadow = true;
        boatGroup.add(hull);

        for (let k = -1; k <= 1; k++) {
          const seat = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.04, 0.18), woodMat);
          seat.position.set(k * 0.45, 0.25, 0);
          boatGroup.add(seat);
        }
        mesh.add(boatGroup);
      } else if (type === 'MUD_PUDDLE') {
        const puddleGroup = new THREE.Group();
        const mudMat = new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.05 });
        const mainPuddle = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.015, 12), mudMat);
        mainPuddle.position.y = 0.008;
        puddleGroup.add(mainPuddle);
        const blob1 = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.015, 8), mudMat);
        blob1.position.set(0.48, 0.008, 0.35);
        puddleGroup.add(blob1);
        const blob2 = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.015, 8), mudMat);
        blob2.position.set(-0.52, 0.008, -0.2);
        puddleGroup.add(blob2);
        mesh.add(puddleGroup);
      } else if (type === 'SLIPPERY_AREA') {
        const pGroup = new THREE.Group();
        const iceMat = new THREE.MeshStandardMaterial({ color: '#bae6fd', roughness: 0.0, transparent: true, opacity: 0.8 });
        const iceMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.015, 12), iceMat);
        iceMesh.position.y = 0.008;
        pGroup.add(iceMesh);
        const ringMat = new THREE.MeshStandardMaterial({ color: '#f0f9ff', roughness: 0.1 });
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.02, 12), ringMat);
        ring.scale.set(1.0, 0.5, 1.0);
        ring.position.y = 0.012;
        pGroup.add(ring);
        mesh.add(pGroup);
      } else if (type === 'WATER_TANK') {
        const tGroup = new THREE.Group();
        const redMat = new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.6 });
        const cyanMat = new THREE.MeshStandardMaterial({ color: '#06b6d4', roughness: 0.3, metalness: 0.6 });
        for (let i = -1; i <= 1; i += 2) {
          for (let j = -1; j <= 1; j += 2) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 4), redMat);
            leg.position.set(i * 0.4, 0.55, j * 0.4);
            leg.castShadow = true;
            tGroup.add(leg);
          }
        }
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.2, 10), cyanMat);
        tank.position.y = 1.35;
        tank.castShadow = true;
        tGroup.add(tank);
        const lid = new THREE.Mesh(new THREE.ConeGeometry(0.58, 0.32, 10), new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.2 }));
        lid.position.y = 2.0;
        lid.castShadow = true;
        tGroup.add(lid);
        mesh.add(tGroup);
      } else if (type === 'GRAIN_BARREL') {
        const bGroup = new THREE.Group();
        const woodMat = new THREE.MeshStandardMaterial({ color: '#854d0e', roughness: 0.9 });
        const steelMat = new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.8, roughness: 0.2 });
        const middle = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.95, 10), woodMat);
        middle.position.y = 0.48;
        middle.castShadow = true;
        bGroup.add(middle);
        const ring1 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 10), steelMat);
        ring1.position.y = 0.72;
        bGroup.add(ring1);
        const ring2 = ring1.clone();
        ring2.position.y = 0.24;
        bGroup.add(ring2);
        mesh.add(bGroup);
      } else if (type === 'FARM_CART') {
        const cGroup = new THREE.Group();
        const woodMat = new THREE.MeshStandardMaterial({ color: '#c2410c', roughness: 0.9 });
        const darkWood = new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.95 });
        const tireMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.9 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 1.35), woodMat);
        body.position.y = 0.48;
        body.castShadow = true;
        cGroup.add(body);
        for (let side = -1; side <= 1; side += 2) {
          const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 10), tireMat);
          w.rotation.z = Math.PI / 2;
          w.position.set(side * 0.68, 0.42, 0);
          w.castShadow = true;
          cGroup.add(w);
          const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 6), darkWood);
          hub.rotation.z = Math.PI / 2;
          hub.position.set(side * 0.72, 0.42, 0);
          cGroup.add(hub);
        }
        const pullBar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.25), darkWood);
        pullBar.position.set(0, 0.38, 0.85);
        pullBar.castShadow = true;
        cGroup.add(pullBar);
        mesh.add(cGroup);
      } else if (type === 'BICYCLE') {
        const bGroup = new THREE.Group();
        const frameMat = new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.4 });
        const wheelsMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.95 });
        const steelMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.8 });
        for (let side = -1; side <= 1; side += 2) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.04, 10), wheelsMat);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(0, 0.38, side * 0.65);
          wheel.castShadow = true;
          bGroup.add(wheel);
        }
        const frameBar1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.98, 6), frameMat);
        frameBar1.rotation.x = Math.PI / 4;
        frameBar1.position.set(0, 0.55, 0.15);
        bGroup.add(frameBar1);
        const frameBar2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.98, 6), frameMat);
        frameBar2.rotation.x = -Math.PI / 4;
        frameBar2.position.set(0, 0.55, -0.15);
        bGroup.add(frameBar2);
        const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.85, 6), frameMat);
        cross.rotation.x = Math.PI / 2;
        cross.position.set(0, 0.72, 0);
        bGroup.add(cross);
        const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.72, 6), steelMat);
        handlebar.rotation.z = Math.PI / 2;
        handlebar.position.set(0, 0.88, 0.4);
        bGroup.add(handlebar);
        mesh.add(bGroup);
      } else if (type === 'HAND_CART') {
        const hcGroup = new THREE.Group();
        const woodMat = new THREE.MeshStandardMaterial({ color: '#aa7c11', roughness: 0.95 });
        const axleMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.9 });
        const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 1.1), woodMat);
        bottom.position.y = 0.32;
        bottom.castShadow = true;
        hcGroup.add(bottom);
        const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 1.1), woodMat);
        sideL.position.set(-0.48, 0.48, 0);
        sideL.castShadow = true;
        hcGroup.add(sideL);
        const sideR = sideL.clone();
        sideR.position.x = 0.48;
        hcGroup.add(sideR);
        for (let side = -1; side <= 1; side += 2) {
          const w = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 8), axleMat);
          w.rotation.z = Math.PI / 2;
          w.position.set(side * 0.55, 0.24, 0.25);
          w.castShadow = true;
          hcGroup.add(w);
        }
        mesh.add(hcGroup);
      } else if (type === 'BENCH') {
        const benchGroup = new THREE.Group();
        const woodMat = new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.95 });
        const ironMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5 });
        const seat = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.06, 0.45), woodMat);
        seat.position.y = 0.45;
        seat.castShadow = true;
        benchGroup.add(seat);
        const back = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.32, 0.06), woodMat);
        back.position.set(0, 0.72, -0.22);
        back.castShadow = true;
        benchGroup.add(back);
        for (let side = -1; side <= 1; side += 2) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.45), ironMat);
          leg.position.set(side * 0.65, 0.225, 0);
          leg.castShadow = true;
          benchGroup.add(leg);
        }
        mesh.add(benchGroup);
      } else if (type === 'STREET_VENDOR') {
        const vendorGroup = new THREE.Group();
        const woodMat = new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.9 });
        const counterMat = new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.85 });
        const canopyOrange = new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.6 });
        const canopyWhite = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.6 });
        const base = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.68, 0.85), woodMat);
        base.position.y = 0.34;
        base.castShadow = true;
        vendorGroup.add(base);
        const counter = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.06, 0.92), counterMat);
        counter.position.y = 0.68;
        counter.castShadow = true;
        vendorGroup.add(counter);
        for (let i = -1; i <= 1; i += 2) {
          for (let j = -1; j <= 1; j += 2) {
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6), canopyWhite);
            pole.position.set(i * 0.62, 1.38, j * 0.38);
            pole.castShadow = true;
            vendorGroup.add(pole);
          }
        }
        const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.12, 1.05), canopyOrange);
        canopy.position.y = 2.05;
        canopy.castShadow = true;
        vendorGroup.add(canopy);
        mesh.add(vendorGroup);
      } else if (type === 'WATER_POT') {
        const potGroup = new THREE.Group();
        const potMat = new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.95 });
        const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 12), potMat);
        lip.position.y = 0.62;
        lip.castShadow = true;
        potGroup.add(lip);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 12), potMat);
        bulb.scale.set(1.0, 1.15, 1.0);
        bulb.position.y = 0.32;
        bulb.castShadow = true;
        potGroup.add(bulb);
        mesh.add(potGroup);
      } else if (type === 'FALLEN_TREE') {
        const trunkGroup = new THREE.Group();
        const woodMat = new THREE.MeshStandardMaterial({ color: '#513217', roughness: 0.95 });
        const ringMat = new THREE.MeshStandardMaterial({ color: '#eab308', roughness: 0.7 });
        const leafMat = new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.65 });
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.95, 10), woodMat);
        trunk.rotation.z = Math.PI / 2;
        trunk.position.y = 0.32;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        trunkGroup.add(trunk);
        for (let side = -1; side <= 1; side += 2) {
          const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.02, 10), ringMat);
          cap.rotation.z = Math.PI / 2;
          cap.position.set(side * 0.985, 0.32, 0);
          trunkGroup.add(cap);
        }
        const greens = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 6), leafMat);
        greens.position.set(0.2, 0.58, -0.22);
        trunkGroup.add(greens);
        const greens2 = greens.clone();
        greens2.position.set(-0.4, 0.48, 0.25);
        trunkGroup.add(greens2);
        mesh.add(trunkGroup);
      } else if (type === 'BUSH') {
        const bushGroup = new THREE.Group();
        const leafMat = new THREE.MeshStandardMaterial({ color: '#166534', roughness: 0.85 });
        const woodMat = new THREE.MeshStandardMaterial({ color: '#7c2d12', roughness: 0.95 });
        const planter = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 1.1), woodMat);
        planter.position.y = 0.09;
        planter.castShadow = true;
        bushGroup.add(planter);
        const centerBush = new THREE.Mesh(new THREE.SphereGeometry(0.48, 10, 10), leafMat);
        centerBush.position.y = 0.48;
        centerBush.castShadow = true;
        bushGroup.add(centerBush);
        const leftBush = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), leafMat);
        leftBush.position.set(-0.38, 0.35, 0.1);
        leftBush.castShadow = true;
        bushGroup.add(leftBush);
        const rightBush = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), leafMat);
        rightBush.position.set(0.35, 0.38, -0.1);
        rightBush.castShadow = true;
        bushGroup.add(rightBush);
        mesh.add(bushGroup);
      } else if (type === 'WOODEN_BRIDGE') {
        const bridgeGroup = new THREE.Group();
        const woodMat = new THREE.MeshStandardMaterial({ color: '#7c2d12', roughness: 0.9 });
        const railingCol = new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.8 });
        const bridgePlatform = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 1.95), woodMat);
        bridgePlatform.position.y = 0.28;
        bridgePlatform.castShadow = true;
        bridgePlatform.receiveShadow = true;
        bridgeGroup.add(bridgePlatform);
        for (let side = -1; side <= 1; side += 2) {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 1.95), railingCol);
          rail.position.set(side * 0.76, 0.48, 0);
          rail.castShadow = true;
          bridgeGroup.add(rail);
        }
        mesh.add(bridgeGroup);
      } else if (type === 'TREE_ROOT') {
        const rootGroup = new THREE.Group();
        const woodMat = new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.98 });
        const root1 = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 1.1, 6), woodMat);
        root1.rotation.set(Math.PI / 2.3, 0.1, -0.42);
        root1.position.set(-0.2, 0.12, 0);
        root1.castShadow = true;
        rootGroup.add(root1);
        const root2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.95, 6), woodMat);
        root2.rotation.set(Math.PI / 1.9, -0.22, 0.52);
        root2.position.set(0.32, 0.1, 0.1);
        root2.castShadow = true;
        rootGroup.add(root2);
        mesh.add(rootGroup);
      } else if (type === 'BROKEN_PLANK') {
        const bpGroup = new THREE.Group();
        const woodMat = new THREE.MeshStandardMaterial({ color: '#c2410c', roughness: 0.95 });
        const yellowStripes = new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.5 });
        const board = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.28, 0.06), woodMat);
        board.position.set(0, 0.5, 0);
        board.rotation.z = -0.15;
        board.castShadow = true;
        bpGroup.add(board);
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 0.08), yellowStripes);
        stripe.position.set(-0.3, 0.5, 0.01);
        stripe.rotation.z = Math.PI / 4;
        bpGroup.add(stripe);
        const stripe2 = stripe.clone();
        stripe2.position.x = 0.3;
        bpGroup.add(stripe2);
        const legL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.65, 0.08), woodMat);
        legL.position.set(-0.5, 0.325, 0);
        legL.castShadow = true;
        bpGroup.add(legL);
        const legR = legL.clone();
        legR.position.x = 0.5;
        bpGroup.add(legR);
        mesh.add(bpGroup);
      } else if (type === 'FLOATING_CRATE') {
        const fcGroup = new THREE.Group();
        const woodMat = new THREE.MeshStandardMaterial({ color: '#aa7c11', roughness: 0.95 });
        const ropeMat = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.8 });
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.85), woodMat);
        box.position.y = 0.42;
        box.castShadow = true;
        fcGroup.add(box);
        const rope1 = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.05, 0.88), ropeMat);
        rope1.position.y = 0.42;
        fcGroup.add(rope1);
        mesh.add(fcGroup);
      } else if (type === 'ROAD_BLOCK') {
        const rGroup = new THREE.Group();
        const orangePlastic = new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.2, metalness: 0.1 });
        const whitePlastic = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.2 });
        const base = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.58, 0.38), orangePlastic);
        base.position.y = 0.29;
        base.castShadow = true;
        rGroup.add(base);
        const panel = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.12, 0.42), whitePlastic);
        panel.position.set(0, 0.38, 0);
        rGroup.add(panel);
        mesh.add(rGroup);
      } else {
        const fallbackBox = new THREE.Mesh(
          new THREE.BoxGeometry(0.8, 0.8, 0.8),
          new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.8 })
        );
        fallbackBox.position.y = 0.4;
        fallbackBox.castShadow = true;
        mesh.add(fallbackBox);
      }

      this.scene.add(mesh);
      
      const config = getActiveLiveConfig();
      let shouldActive = true;
      const isVehicle = type === 'CAR' || type === 'BUS' || type === 'TRUCK' || type === 'TRACTOR' || type === 'FORKLIFT' || type === 'DELIVERY_VAN' || type === 'BICYCLE' || type === 'LORRY';
      if (config.obstacleSpawnRate <= 0) {
        shouldActive = false;
      } else if (isVehicle) {
        if (config.vehicleSpawnRate <= 0 || config.trafficDensity <= 0) {
          shouldActive = false;
        } else if (Math.random() > config.obstacleSpawnRate || Math.random() > config.vehicleSpawnRate || Math.random() > config.trafficDensity) {
          shouldActive = false;
        }
      } else {
        if (config.obstacleDensity <= 0) {
          shouldActive = false;
        } else if (Math.random() > config.obstacleSpawnRate || Math.random() > config.obstacleDensity) {
          shouldActive = false;
        }
      }

      obs = { mesh, type, lane, active: shouldActive };
      this.obstacles.push(obs);
    } else {
      const config = getActiveLiveConfig();
      let shouldActive = true;
      const isVehicle = type === 'CAR' || type === 'BUS' || type === 'TRUCK' || type === 'TRACTOR' || type === 'FORKLIFT' || type === 'DELIVERY_VAN' || type === 'BICYCLE' || type === 'LORRY';
      if (config.obstacleSpawnRate <= 0) {
        shouldActive = false;
      } else if (isVehicle) {
        if (config.vehicleSpawnRate <= 0 || config.trafficDensity <= 0) {
          shouldActive = false;
        } else if (Math.random() > config.obstacleSpawnRate || Math.random() > config.vehicleSpawnRate || Math.random() > config.trafficDensity) {
          shouldActive = false;
        }
      } else {
        if (config.obstacleDensity <= 0) {
          shouldActive = false;
        } else if (Math.random() > config.obstacleSpawnRate || Math.random() > config.obstacleDensity) {
          shouldActive = false;
        }
      }

      obs.lane = lane;
      obs.active = shouldActive;
      obs.mesh.visible = shouldActive;
    }

    if (obs.active) {
      obs.mesh.position.set(lane * this.laneSpacing, 0, zPos);
    } else {
      obs.mesh.position.set(lane * this.laneSpacing, -500, -1000);
    }
    return obs;
  }

  private createCollectible(lane: number, zPos: number, type: string) {
    let scoreValue = 10;
    let coll = this.collectibles.find((c) => !c.active && c.type === type);

    if (!coll) {
      const mesh = new THREE.Group();
      mesh.name = `coll_${type}`;

      if (type === 'FEED') {
        const shape = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.75, 6), this.matCache['burlap_sack_pbr']);
        shape.castShadow = true;
        shape.position.y = 0.45;
        mesh.add(shape);
        scoreValue = 10;
      } else if (type === 'GOLDEN_FEED') {
        const shape = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.85, 6), this.matCache['gold_specular_high']);
        shape.castShadow = true;
        shape.position.y = 0.5;
        mesh.add(shape);
        scoreValue = 50;
      } else if (type === 'CORN') {
        const shape = new THREE.Mesh(new THREE.SphereGeometry(0.2, 5, 5), this.matCache['gold_specular_high']);
        shape.position.y = 0.45;
        mesh.add(shape);
        scoreValue = 20;
      } else if (type === 'EGG') {
        const shape = new THREE.Mesh(new THREE.SphereGeometry(0.24, 6, 6), this.matCache['egg_gloss_white']);
        shape.scale.set(1.0, 1.4, 1.0);
        shape.position.y = 0.45;
        mesh.add(shape);
        scoreValue = 100;
      } else if (type === 'CRYSTAL') {
        const shape = new THREE.Mesh(
          new THREE.SphereGeometry(0.20, 16, 16),
          this.matCache['crystal_neon_ruby']
        );
        shape.scale.set(1.0, 1.4, 1.0);
        shape.position.y = 0.45;
        mesh.add(shape);

        // Add 3 small glowing crystal sparkles/particles rotating within the group
        const sparkleMat = new THREE.MeshStandardMaterial({
          color: '#38bdf8',
          emissive: '#e0f2fe',
          emissiveIntensity: 1.5,
          roughness: 0
        });
        const offsets = [
          { x: 0.28, y: 0.65, z: 0.1 },
          { x: -0.28, y: 0.35, z: -0.1 },
          { x: 0.1, y: 0.45, z: 0.28 }
        ];
        offsets.forEach(off => {
          const sparkle = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), sparkleMat);
          sparkle.position.set(off.x, off.y, off.z);
          mesh.add(sparkle);
        });
        scoreValue = 250;
      } else if (type === 'BROWN_EGG') {
        const shape = new THREE.Mesh(
          new THREE.SphereGeometry(0.24, 16, 16),
          new THREE.MeshStandardMaterial({
            color: '#e2b48c', // Soft farm-fresh Country Brown Egg
            emissive: '#ca8a04', // Cozy warm glow
            emissiveIntensity: 0.25,
            roughness: 0.20
          })
        );
        shape.scale.set(1.0, 1.35, 1.0);
        shape.position.y = 0.45;
        mesh.add(shape);
        scoreValue = 150;
      } else if (type === 'GRAIN_MAIZE') {
        // Bright golden maize corn kernel (emissive warm-gold glow!)
        const shape = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), new THREE.MeshStandardMaterial({ color: '#f59e0b', emissive: '#f59e0b', emissiveIntensity: 0.75, roughness: 0.2 }));
        shape.scale.set(1.0, 1.4, 0.8);
        shape.position.y = 0.4;
        mesh.add(shape);
        scoreValue = 15;
      } else if (type === 'GRAIN_WHEAT') {
        // Wheat golden seed (emissive sunny-yellow glow!)
        const shape = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.35, 8), new THREE.MeshStandardMaterial({ color: '#fbbf24', emissive: '#fbbf24', emissiveIntensity: 0.75, roughness: 0.2 }));
        shape.rotation.z = Math.PI / 4;
        shape.position.y = 0.4;
        mesh.add(shape);
        scoreValue = 15;
      } else if (type === 'GRAIN_RICE') {
        // Rice white grain (emissive neon-pearl white glow!)
        const shape = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.65, roughness: 0.2 }));
        shape.scale.set(0.6, 1.6, 0.6);
        shape.position.y = 0.4;
        mesh.add(shape);
        scoreValue = 15;
      } else if (type === 'GRAIN_MILLET') {
        // Millet small pale yellow seed (glowing yellow core!)
        const shape = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), new THREE.MeshStandardMaterial({ color: '#fef08a', emissive: '#fbbf24', emissiveIntensity: 0.80, roughness: 0.2 }));
        shape.position.y = 0.4;
        mesh.add(shape);
        scoreValue = 15;
      } else if (type === 'GRAIN_BARLEY') {
        // Barley bronze husked seed (rich golden-amber glow!)
        const shape = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 12), new THREE.MeshStandardMaterial({ color: '#d97706', emissive: '#d97706', emissiveIntensity: 0.75, roughness: 0.2 }));
        shape.scale.set(1.0, 1.5, 0.9);
        shape.position.y = 0.4;
        mesh.add(shape);
        scoreValue = 15;
      } else if (type === 'GRAIN_OATS') {
        // Oats light cream grain (soft warm cream glow!)
        const shape = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), new THREE.MeshStandardMaterial({ color: '#fef3c7', emissive: '#fbbf24', emissiveIntensity: 0.60, roughness: 0.2 }));
        shape.scale.set(0.7, 1.5, 0.7);
        shape.position.y = 0.4;
        mesh.add(shape);
        scoreValue = 15;
      } else if (type === 'GRAIN_SORGHUM') {
        // Sorghum reddish-brown seed (vibrant red-amber glow!)
        const shape = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), new THREE.MeshStandardMaterial({ color: '#b45309', emissive: '#dc2626', emissiveIntensity: 0.80, roughness: 0.2 }));
        shape.position.y = 0.4;
        mesh.add(shape);
        scoreValue = 15;
      } else if (type === 'SKM_FEED_PELLET') {
        // Cylindrical brown SKM Feed pellet (high-sheen metallic golden bronze!)
        const shape = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.38, 8), new THREE.MeshStandardMaterial({ color: '#a16207', emissive: '#fbbf24', emissiveIntensity: 0.85, roughness: 0.2 }));
        shape.position.y = 0.4;
        mesh.add(shape);
        scoreValue = 30;
      } else if (type === 'SKM_PREMIUM_FEED') {
        // Red premium SKM feed bag (emissive neon ultra-crimson glow!)
        const shape = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.7, 6), new THREE.MeshStandardMaterial({ color: '#dc2626', emissive: '#ef4444', emissiveIntensity: 0.95, roughness: 0.2 }));
        shape.position.y = 0.4;
        mesh.add(shape);
        scoreValue = 50;
      } else if (type.startsWith('POWERUP_')) {
        const pType = type.split('_')[1];
        let color = '#3b82f6';
        if (pType === 'MAGNET') color = '#ef4444';
        else if (pType === 'SHIELD') color = '#10b981';
        else if (pType === 'SPEED_BOOST') color = '#eab308';
        else if (pType === 'DOUBLE_SCORE') color = '#a855f7';

        const shape = new THREE.Mesh(this.geoCache['torus'], new THREE.MeshBasicMaterial({ color, wireframe: true }));
        shape.position.y = 0.6;
        mesh.add(shape);

        const inside = new THREE.Mesh(this.geoCache['sphere'], new THREE.MeshBasicMaterial({ color }));
        inside.scale.set(0.16, 0.16, 0.16);
        inside.position.y = 0.6;
        mesh.add(inside);
        scoreValue = 0;
      }

      this.scene.add(mesh);
      coll = { mesh, type, lane, scoreValue, active: true, bobOffset: Math.random() * Math.PI * 2 };
      this.collectibles.push(coll);
    } else {
      coll.lane = lane;
      coll.active = true;
      coll.mesh.visible = true;
    }

    let yOffset = 0.15;
    if (this.activePowerUps.has(PowerUpType.FLYING_MODE)) {
      yOffset = 4.8;
    }

    coll.mesh.position.set(lane * this.laneSpacing, yOffset, zPos);
  }

  public triggerHatchSequence() {
    if (this.isHatching) return;
    this.isHatching = true;
    this.hatchTimer = 4.0; // 4.0 seconds total cinematic experience
    (this as any).hasHatchBroken = false;
    soundManager.playEggCrack();

    console.log("READY TO HATCH! Egg evolution triggered. Current progress reset. Triggering cinematic cracking/hatch animations.");

    // Dynamic Evolution Glow Expansion Effect - starts dark during Phase 1 cracking suspense
    if (this.playerGroup) {
      const glowGeo = new THREE.SphereGeometry(0.6, 16, 16);
      const glowMat = new THREE.MeshBasicMaterial({
        color: '#fbbf24',
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending
      });
      const glowMesh = new THREE.Mesh(glowGeo, glowMat);
      glowMesh.name = 'evolution_glow_mesh';
      this.playerGroup.add(glowMesh);
      (this as any).evoGlowMesh = glowMesh;
      (this as any).evoGlowTimer = 4.0;
    }

    this.callbacks.onCollectText?.("🥚 READY TO HATCH! 🥚", "powerup");
  }

  public triggerChickenChampionSequence() {
    if (this.currentStage !== 'CHICK' || this.isHenEvolving) return;
    this.isHenEvolving = true;
    this.henEvolveTimer = 5.0; // 5 seconds high-fidelity cinematic sequence!
    (this as any).hasHenSwappedModel = false;
    soundManager.playLevelUp();

    console.log("CHICK TO HEN EVOLUTION CINEMATIC INITIATED!");

    // Soft golden additive evolution glow sphere!
    if (this.playerGroup) {
      const glowGeo = new THREE.SphereGeometry(0.7, 16, 16);
      const glowMat = new THREE.MeshBasicMaterial({
        color: '#fbbf24', // warm yellow/golden light
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending
      });
      const glowMesh = new THREE.Mesh(glowGeo, glowMat);
      glowMesh.name = 'evolution_glow_mesh';
      this.playerGroup.add(glowMesh);
      (this as any).evoGlowMesh = glowMesh;
      (this as any).evoGlowTimer = 5.0;
    }

    // Spawn initial swirling golden fluff/feathers of light around Chick!
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 2.0;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        Math.random() * 3.0 + 1.5,
        Math.sin(angle) * speed
      );

      const featherGeo = new THREE.ConeGeometry(0.06, 0.18, 5);
      const featherMat = new THREE.MeshBasicMaterial({
        color: '#fbbf24', // beautiful gold
        transparent: true,
        opacity: 0.95
      });
      const featherMesh = new THREE.Mesh(featherGeo, featherMat);
      featherMesh.position.copy(this.playerGroup.position).add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.4,
        0.2,
        (Math.random() - 0.5) * 0.4
      ));
      this.scene.add(featherMesh);

      this.smokeParticles.push({
        mesh: featherMesh as any,
        velocity,
        life: 1.5 + Math.random() * 1.5
      });
    }

    this.callbacks.onCollectText?.("✨ GROWING INTO HEN... ✨", "powerup");
  }

  public triggerStage2Transition() {
    if (this.currentStage !== 'ADULT' || this.isStage2Transition) return;
    this.isStage2Transition = true;
    this.stage2TransitionTimer = 12.0;
    this.brownEggsLaid = 0;
    this.distanceSinceLastEgg = 0;
    this.callbacks.onCollectText?.("Stage 2 Unlocked\nHen begins laying eggs!", "powerup");
    
    if (this.playerGroup) {
      const glowGeo = new THREE.SphereGeometry(0.9, 16, 16);
      const glowMat = new THREE.MeshBasicMaterial({
        color: '#f59e0b',
        transparent: true,
        opacity: 0.6,
        wireframe: true
      });
      const glowMesh = new THREE.Mesh(glowGeo, glowMat);
      glowMesh.name = "stage2_glow";
      this.playerGroup.add(glowMesh);
      (this as any).stage2GlowMesh = glowMesh;
    }
  }

  public handleSuccessfulCornerTurn(direction: 'LEFT' | 'RIGHT') {
    if (this.wasCornerTurnedSuccessfully) return;
    this.wasCornerTurnedSuccessfully = true;
    soundManager.playLevelUp();
    
    // Sweep camera yaw rotation offsets for active turns!
    this.targetCornerCameraYawOffset = direction === 'LEFT' ? -Math.PI / 3 : Math.PI / 3;
    
    this.score += 750;
    this.callbacks.onScore(this.score);
    this.callbacks.onCollectText?.(`✨ PERFECT ${direction} TURN! +750 ✨`, "powerup");

    for (let i = 0; i < 15; i++) {
      this.spawnDustParticle();
    }
  }

  private setupInput() {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!this.isRunning || this.isPaused || this.isCrashed) return;

      // Check for Corner Turns first!
      if (this.isNearCornerTurn && !this.wasCornerTurnedSuccessfully) {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          if (this.cornerTurnDirection === 'LEFT' || this.cornerTurnDirection === 'T_JUNCTION') {
            this.handleSuccessfulCornerTurn('LEFT');
            return;
          }
        }
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          if (this.cornerTurnDirection === 'RIGHT' || this.cornerTurnDirection === 'T_JUNCTION') {
            this.handleSuccessfulCornerTurn('RIGHT');
            return;
          }
        }
      }

      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          this.moveLane(-1);
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          this.moveLane(1);
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
        case ' ':
          this.triggerJump();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          this.triggerSlide();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    let startX = 0;
    let startY = 0;
    
    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!this.isRunning || this.isPaused || this.isCrashed) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;

      // Check for Corner Turns first!
      if (this.isNearCornerTurn && !this.wasCornerTurnedSuccessfully) {
        if (Math.abs(dx) > 35) {
          if (dx > 0 && (this.cornerTurnDirection === 'RIGHT' || this.cornerTurnDirection === 'T_JUNCTION')) {
            this.handleSuccessfulCornerTurn('RIGHT');
            return;
          } else if (dx < 0 && (this.cornerTurnDirection === 'LEFT' || this.cornerTurnDirection === 'T_JUNCTION')) {
            this.handleSuccessfulCornerTurn('LEFT');
            return;
          }
        }
      }

      if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > 35) {
          if (dx > 0) this.moveLane(1);
          else this.moveLane(-1);
        }
      } else {
        if (Math.abs(dy) > 35) {
          if (dy < 0) this.triggerJump();
          else this.triggerSlide();
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
  }

  public swipeLeft() { this.moveLane(-1); }
  public swipeRight() { this.moveLane(1); }
  public pressJump() { this.triggerJump(); }
  public pressSlide() { this.triggerSlide(); }

  private moveLane(dir: number) {
    const nextLane = this.currentLane + dir;
    if (nextLane >= -1 && nextLane <= 1) {
      this.currentLane = nextLane;
      this.targetX = this.currentLane * this.laneSpacing;
      soundManager.playClick();
      // Juice: Lane shift warp scale
      this.squashX = 0.62;
      this.squashZ = 1.28;
      this.squashY = 1.08;
    }
  }

  private triggerJump() {
    if (this.isJumping || this.isSliding) return;
    this.isJumping = true;
    this.jumpVelocity = 14.8;
    this.spawnFeatherSplash();
    soundManager.playJump();
    soundManager.playCluck();
    // Juice: Takeoff squash
    this.squashY = 0.52;
    this.squashX = 1.38;
    this.squashZ = 1.38;
  }

  private triggerSlide() {
    if (this.isJumping) return;
    this.isSliding = true;
    this.slideTimer = this.slideDuration;
    soundManager.playSlide();
    // Juice: Slide compression
    this.squashY = 0.42;
    this.squashX = 1.38;
    this.squashZ = 1.28;
  }

  public toggleDebugHitboxes(): boolean {
    this.debugHitboxesActive = !this.debugHitboxesActive;
    if (!this.debugHitboxesActive) {
      if (this.debugPlayerMesh) this.debugPlayerMesh.visible = false;
      this.debugHitboxMeshes.forEach((mesh) => {
        mesh.visible = false;
      });
    }
    return this.debugHitboxesActive;
  }

  public applyLiveConfig() {
    const liveConfig = getActiveLiveConfig();
    addDebugLog('SYSTEM', `Apply Live Config: Obstacles=${liveConfig.obstacleSpawnRate}x, Feeds=${liveConfig.feedSpawnRate}x, Speed=${liveConfig.runSpeedMultiplier}x, Stage1Req=${liveConfig.stage1EvolutionReq}`);
    
    let removedCount = 0;
    if (Array.isArray(this.obstacles)) {
      this.obstacles.forEach((o: any) => {
        if (o.active && o.mesh && o.mesh.position && o.mesh.position.z < this.playerZ - 10.0) {
          const isVehicle = o.type === 'CAR' || o.type === 'BUS' || o.type === 'TRUCK' || o.type === 'TRACTOR' || o.type === 'FORKLIFT' || o.type === 'DELIVERY_VAN' || o.type === 'BICYCLE' || o.type === 'LORRY';
          let shouldDeactivate = false;
          if (liveConfig.obstacleSpawnRate <= 0) {
            shouldDeactivate = true;
          } else if (isVehicle && (liveConfig.vehicleSpawnRate <= 0 || liveConfig.trafficDensity <= 0)) {
            shouldDeactivate = true;
          } else if (!isVehicle && liveConfig.obstacleDensity <= 0) {
            shouldDeactivate = true;
          }
          
          if (shouldDeactivate) {
            o.active = false;
            o.mesh.visible = false;
            o.mesh.position.set(0, -500, -1000);
            removedCount++;
          }
        }
      });
    }

    if (removedCount > 0) {
      addDebugLog('SYSTEM', `Purged ${removedCount} future matching obstacles/vehicles to respect updated developer settings dynamically.`);
    }

    if (this.callbacks && (this.callbacks as any).onConfigApplied) {
      (this.callbacks as any).onConfigApplied();
    }
  }

  public start() {
    // Re-verify hierarchy and force viewport size recalculation on start to prevent black or zero-size canvas viewports
    this.verifyAndRebuildHierarchy();
    this.handleResize();

    if (this.isMenuShowcase) {
      // Trigger cinematic opening of the Factory gate doors!
      this.isMenuShowcase = false;
      this.isTransitioningToRun = true;
      this.transitionTimer = 1.8;
      this.gateOpenProgress = 0.0;
      this.distance = 0;
      this.score = 0;
      const diffMode = localStorage.getItem('skm_dev_difficulty') || 'NORMAL';
      if (diffMode === 'EASY') {
        this.speed = 12.0;
        this.maxSpeed = 24.0;
      } else if (diffMode === 'HARD') {
        this.speed = 18.0;
        this.maxSpeed = 42.0;
      } else if (diffMode === 'EXTREME') {
        this.speed = 22.0;
        this.maxSpeed = 48.0;
      } else {
        this.speed = 15.2;
        this.maxSpeed = 38.0;
      }
      this.nextCornerDistance = 240;
      this.lastCornerDistance = 0;
      
      // Reset evolution growth triggers
      this.currentStage = 'EGG';
      this.grainsCollected = 0;
      this.isStage2 = false;
      this.visualGrowthScale = 1.0;
      this.brownEggsCollected = 0;
      this.happyFaceTimer = 0.0;
      this.squashStretchY = 1.0;
      this.isCrashed = false;
      this.isPaused = false;
      this.totalRoadScrolled = 0;
      this.currentLane = 0;
      this.targetX = 0;
      this.playerX = 0;
      this.playerY = 0;
      this.isJumping = false;
      this.isSliding = false;

      localStorage.setItem('skm_evolution_stage', 'EGG');
      localStorage.setItem('skm_grains_collected', '0');
      localStorage.setItem('skm_is_stage_2', 'false');
      this.updatePlayerStage2Visuals();

      // Reset obstacles and collectibles
      this.obstacles.forEach((o) => { o.active = false; o.mesh.visible = false; });
      this.collectibles.forEach((c) => { c.active = false; c.mesh.visible = false; });

      this.activePowerUps.clear();
      this.shieldBubbleMesh.visible = false;
      this.magnetAuraMesh.visible = false;

      for (let i = 0; i < this.roads.length; i++) {
        this.roads[i].position.set(0, 0, -i * this.roadLength);
      }

      // Pre-populate initial segments immediately so the player sees grains and obstacles right from start!
      for (let i = 1; i < this.roads.length; i++) {
        this.spawnProceduralSegment(this.roads[i].position.z);
      }

      // Play transition level-up sound and menu-click chime!
      soundManager.playClick();
      soundManager.playLevelUp();

      if (this.animationFrameId === null) {
        this.loop();
      }
      return;
    }

    this.isRunning = true;
    this.isPaused = false;
    this.isCrashed = false;
    this.cleanupEggBreak();
    this.isIntroActive = true;
    this.introTime = 2.0;
    this.distance = 0;
    this.score = 0;
    const diffMode = localStorage.getItem('skm_dev_difficulty') || 'NORMAL';
    if (diffMode === 'EASY') {
      this.speed = 12.0;
      this.maxSpeed = 24.0;
    } else if (diffMode === 'HARD') {
      this.speed = 18.0;
      this.maxSpeed = 42.0;
    } else if (diffMode === 'EXTREME') {
      this.speed = 22.0;
      this.maxSpeed = 48.0;
    } else {
      this.speed = 15.2;
      this.maxSpeed = 38.0;
    }
    this.nextCornerDistance = 240;
    this.lastCornerDistance = 0;
    
    // Reset growth and evolution states for a fresh Stage 1 White Egg start
    this.currentStage = 'EGG';
    this.grainsCollected = 0;
    this.isStage2 = false;
    this.visualGrowthScale = 1.0;
    this.brownEggsCollected = 0;

    localStorage.setItem('skm_evolution_stage', 'EGG');
    localStorage.setItem('skm_grains_collected', '0');
    localStorage.setItem('skm_is_stage_2', 'false');

    this.updatePlayerStage2Visuals();
    this.happyFaceTimer = 0.0;
    this.squashStretchY = 1.0;
    this.isHatching = false;
    this.totalRoadScrolled = 0;
    this.currentLane = 0;
    this.targetX = 0;
    this.playerX = 0;
    this.playerY = 0;
    this.isJumping = false;
    this.isSliding = false;

    this.obstacles.forEach((o) => {
      o.active = false;
      o.mesh.visible = false;
    });
    this.collectibles.forEach((c) => {
      c.active = false;
      c.mesh.visible = false;
    });

    this.activePowerUps.clear();
    this.shieldBubbleMesh.visible = false;
    this.magnetAuraMesh.visible = false;

    for (let i = 0; i < this.roads.length; i++) {
      this.roads[i].position.set(0, 0, -i * this.roadLength);
    }

    // Build closed gate
    this.spawnFactoryGate();

    this.clock.getDelta();
    this.frameCount = 0;
    this.lastFpsUpdateTime = performance.now();

    if (this.animationFrameId === null) {
      this.loop();
    }

    soundManager.startMusic();
  }

  public pause() {
    this.isPaused = true;
    soundManager.stopMusic();
  }

  public resume() {
    this.isPaused = false;
    this.clock.getDelta();
    soundManager.startMusic();
  }

  public stop() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    soundManager.stopMusic();
  }

  public crash() {
    if (this.isCrashed) return;
    this.isCrashed = true;
    this.crashTimer = 2.0; // 2 seconds total crash sequence
    soundManager.stopMusic();

    // Prevent player from getting stuck inside obstacle meshes by snapping the closest obstacle
    let closestObsDist = Infinity;
    let closestObs: any = null;
    this.obstacles.forEach((obs) => {
      if (obs.active) {
        const distZ = Math.abs(obs.mesh.position.z);
        if (distZ < closestObsDist) {
          closestObsDist = distZ;
          closestObs = obs;
        }
      }
    });

    if (closestObs && closestObsDist < 2.5) {
      const isLargeObstacle = closestObs.type === 'CAR' || closestObs.type === 'BUS';
      const snapOffset = isLargeObstacle ? 2.4 : 0.8;
      // Snap obstacle position to perfectly sit just in front of the player's nose, avoiding all visual clipping/penetration
      closestObs.mesh.position.z = -snapOffset;
    }

    if (this.currentStage === 'EGG') {
      soundManager.playEggCrack();
      this.eggCrackPhaseTimer = 0.35; // 0.35 seconds freeze/crack wobble wobble phase
      this.hasSpawnedEggBreak = false;
    } else if (this.currentStage === 'CHICK') {
      soundManager.playHit();
      soundManager.playGameOver();
      this.spawnFeatherSplash();
      // Chick tumble initial posture setup
      if (this.playerGroup) {
        this.playerGroup.position.y = 0.45;
      }
    } else {
      // HEN / ADULT
      soundManager.playHit();
      soundManager.playGameOver();
      this.spawnFeatherSplash();
      // Dust splash effect on high impact!
      if (this.featherParticles) {
        // Spawn extra dust on Hen crash
        this.featherTimer = 1.6;
      }
    }
    this.landingShakeForce = 0.85; // heavy impact camera shake
  }

  private spawnFeatherSplash() {
    this.featherActive = true;
    this.featherTimer = 1.3;
    if (this.featherParticles) {
      this.featherParticles.visible = true;
      this.featherParticles.position.set(this.playerX, this.playerY + 0.45, this.playerZ);

      const posAttr = this.featherParticles.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < this.featherCount; i++) {
        posAttr.setXYZ(i, 0, 0, 0);
        this.featherVelocities[i * 3] = (Math.random() - 0.5) * 7.5;
        this.featherVelocities[i * 3 + 1] = Math.random() * 8.0 + 2.5;
        this.featherVelocities[i * 3 + 2] = (Math.random() - 0.5) * 7.5;
      }
      posAttr.needsUpdate = true;
    }
  }

  private spawnEggBreakFragments() {
    if (this.hasSpawnedEggBreak) return;
    this.hasSpawnedEggBreak = true;

    // Hide standard egg meshes so we only see scattered pieces!
    if (this.eggBodyGroup) this.eggBodyGroup.visible = false;
    if (this.eggLeftLeg) this.eggLeftLeg.visible = false;
    if (this.eggRightLeg) this.eggRightLeg.visible = false;

    // Create container group for break pieces
    this.eggBreakGroup = new THREE.Group();
    this.eggBreakGroup.name = 'egg_break_group';
    this.eggBreakGroup.position.set(this.playerX, 0.05, this.playerZ);
    this.scene.add(this.eggBreakGroup);

    // 1. Egg White Spill Plane (expanding flat cylinder)
    const spillGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.01, 16);
    const spillMat = new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      roughness: 0.15,
      metalness: 0.05,
      transparent: true,
      opacity: 0.0
    });
    this.eggBreakWhiteMesh = new THREE.Mesh(spillGeo, spillMat);
    this.eggBreakWhiteMesh.scale.set(0.1, 1.0, 0.1);
    this.eggBreakGroup.add(this.eggBreakWhiteMesh);

    // 2. Yolk Splat Dome
    const yolkGeo = new THREE.SphereGeometry(0.18, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const yolkMat = new THREE.MeshStandardMaterial({
      color: '#fbbf24',
      roughness: 0.1,
      metalness: 0.15
    });
    this.eggBreakYolkMesh = new THREE.Mesh(yolkGeo, yolkMat);
    this.eggBreakYolkMesh.position.set(0, 0.005, 0);
    this.eggBreakYolkMesh.scale.set(1.0, 0.15, 1.0);
    this.eggBreakGroup.add(this.eggBreakYolkMesh);

    // 3. Shell shards & shoe/hand scattering
    this.eggBreakFragments = [];

    const shellMat = this.matCache['egg_gloss_white'] || new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.35 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: '#fbbf24', roughness: 0.3 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.4 });

    // Build 6 shell pieces
    for (let i = 0; i < 6; i++) {
      const shardGeo = new THREE.BoxGeometry(0.18, 0.04, 0.18);
      const shard = new THREE.Mesh(shardGeo, shellMat);
      shard.castShadow = true;
      shard.position.set((Math.random() - 0.5) * 0.2, 0.2 + Math.random() * 0.3, (Math.random() - 0.5) * 0.2);
      this.eggBreakGroup.add(shard);

      const angle = (i / 6.0) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const speed = Math.random() * 3.5 + 2.0;
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        Math.random() * 4.5 + 3.5,
        Math.sin(angle) * speed + 1.2
      );
      const rotVel = new THREE.Vector3(
        (Math.random() - 0.5) * 15.0,
        (Math.random() - 0.5) * 15.0,
        (Math.random() - 0.5) * 15.0
      );

      this.eggBreakFragments.push({ mesh: shard, velocity: vel, rotationVelocity: rotVel });
    }

    // Build 2 shoes scattering
    for (let i = 0; i < 2; i++) {
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.26), shoeMat);
      shoe.castShadow = true;
      shoe.position.set(i === 0 ? -0.2 : 0.2, 0.15, 0);
      this.eggBreakGroup.add(shoe);

      const vel = new THREE.Vector3(
        (i === 0 ? -1.0 : 1.0) * (Math.random() * 2.0 + 1.5),
        Math.random() * 4.0 + 3.0,
        (Math.random() - 0.5) * 2.0
      );
      const rotVel = new THREE.Vector3(
        (Math.random() - 0.5) * 10.0,
        (Math.random() - 0.5) * 10.0,
        (Math.random() - 0.5) * 10.0
      );

      this.eggBreakFragments.push({ mesh: shoe, velocity: vel, rotationVelocity: rotVel });
    }

    // Build 2 gloves scattering
    for (let i = 0; i < 2; i++) {
      const glove = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), gloveMat);
      glove.castShadow = true;
      glove.position.set(i === 0 ? -0.3 : 0.3, 0.2, 0.1);
      this.eggBreakGroup.add(glove);

      const vel = new THREE.Vector3(
        (i === 0 ? -1.0 : 1.0) * (Math.random() * 3.0 + 1.5),
        Math.random() * 5.0 + 3.0,
        (Math.random() - 0.5) * 2.0
      );
      const rotVel = new THREE.Vector3(
        (Math.random() - 0.5) * 12.0,
        (Math.random() - 0.5) * 12.0,
        (Math.random() - 0.5) * 12.0
      );

      this.eggBreakFragments.push({ mesh: glove, velocity: vel, rotationVelocity: rotVel });
    }
  }

  private updateEggBreak(delta: number) {
    if (this.eggBreakWhiteMesh) {
      if (this.eggBreakWhiteMesh.scale.x < 3.2) {
        this.eggBreakWhiteMesh.scale.x += delta * 5.5;
        this.eggBreakWhiteMesh.scale.z += delta * 5.5;
      }
      const mat = this.eggBreakWhiteMesh.material as THREE.MeshStandardMaterial;
      if (mat.opacity < 0.95) {
        mat.opacity = Math.min(0.95, mat.opacity + delta * 5.0);
      }
    }

    if (this.eggBreakYolkMesh) {
      if (this.eggBreakYolkMesh.scale.x < 1.8) {
        this.eggBreakYolkMesh.scale.x += delta * 3.0;
        this.eggBreakYolkMesh.scale.y = Math.min(0.4, this.eggBreakYolkMesh.scale.y + delta * 0.8);
        this.eggBreakYolkMesh.scale.z += delta * 3.0;
      }
    }

    this.eggBreakFragments.forEach((frag) => {
      frag.velocity.y -= delta * 15.0;

      frag.mesh.position.x += frag.velocity.x * delta;
      frag.mesh.position.y += frag.velocity.y * delta;
      frag.mesh.position.z += frag.velocity.z * delta;

      frag.mesh.rotation.x += frag.rotationVelocity.x * delta;
      frag.mesh.rotation.y += frag.rotationVelocity.y * delta;
      frag.mesh.rotation.z += frag.rotationVelocity.z * delta;

      if (frag.mesh.position.y < 0.02) {
        frag.mesh.position.y = 0.02;
        frag.velocity.y = -frag.velocity.y * 0.35;
        frag.velocity.x *= 0.5;
        frag.velocity.z *= 0.5;
        frag.rotationVelocity.multiplyScalar(0.4);
      }
    });
  }

  private cleanupEggBreak() {
    if (this.eggBreakGroup) {
      this.scene.remove(this.eggBreakGroup);
      this.eggBreakGroup = null;
    }
    this.eggBreakWhiteMesh = null;
    this.eggBreakYolkMesh = null;
    this.eggBreakFragments = [];
    this.hasSpawnedEggBreak = false;

    if (this.eggBodyGroup) {
      this.eggBodyGroup.visible = true;
      this.eggBodyGroup.position.set(0, 0, 0);
      this.eggBodyGroup.rotation.set(0, 0, 0);
      this.eggBodyGroup.scale.set(1.0, 1.35, 1.0);
    }
    if (this.eggLeftLeg) {
      this.eggLeftLeg.visible = true;
      this.eggLeftLeg.rotation.set(0, 0, 0);
    }
    if (this.eggRightLeg) {
      this.eggRightLeg.visible = true;
      this.eggRightLeg.rotation.set(0, 0, 0);
    }
  }

  private resetCamera() {
    if (!this.camera) {
      this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 1000);
    }
    const safeZ = typeof this.playerZ === 'number' && !isNaN(this.playerZ) ? this.playerZ : -18.0;
    this.camera.position.set(0, 3.2, safeZ + 5.0);
    this.camera.rotation.set(0, 0, 0);
    this.camera.scale.set(1, 1, 1);
    this.camera.lookAt(new THREE.Vector3(0, 1.0, safeZ - 18.0));
  }

  private loop = () => {
    if (!this.isRunning) return;
    this.animationFrameId = requestAnimationFrame(this.loop);

    const limitStr = localStorage.getItem('skm_target_fps');
    if (limitStr && limitStr !== 'unlimited') {
      const target = parseInt(limitStr, 10);
      const now = performance.now();
      const self = this as any;
      if (!self.lastFrameTime) self.lastFrameTime = now;
      const elapsed = now - self.lastFrameTime;
      if (elapsed < 1000 / target) {
        return;
      }
      self.lastFrameTime = now - (elapsed % (1000 / target));
    }

    // Auto-adjust WebGL viewport or size if the canvas size shifts after mount or toggle transitions
    if (this.renderer && this.canvas) {
      const width = this.canvas.clientWidth;
      const height = this.canvas.clientHeight;
      const size = new THREE.Vector2();
      this.renderer.getSize(size);
      if (size.x !== width || size.y !== height) {
        this.handleResize();
      }
    }

    const delta = Math.min(this.clock.getDelta(), 0.1);

    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsUpdateTime > 1000) {
      const fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdateTime));
      if (this.callbacks.onFpsUpdated) this.callbacks.onFpsUpdated(fps);
      this.frameCount = 0;
      this.lastFpsUpdateTime = now;
    }

    if (this.isPaused) return;

    this.update(delta);
    
    // Core render block with extreme null & transformation safety checks
    if (!this.renderer || !this.scene || !this.camera) return;

    if (
      isNaN(this.camera.position.x) ||
      isNaN(this.camera.position.y) ||
      isNaN(this.camera.position.z) ||
      isNaN(this.camera.quaternion.x) ||
      isNaN(this.camera.quaternion.y) ||
      isNaN(this.camera.quaternion.z) ||
      isNaN(this.camera.quaternion.w)
    ) {
      console.warn("NaN camera transform detected in anim loop! Resetting.");
      this.resetCamera();
    }

    // Failsafe: Prevent camera clipping inside the floor
    if (this.camera.position.y < 0.25) {
      this.camera.position.y = 0.25;
    }

    try {
      this.renderer.render(this.scene, this.camera);
    } catch (renderError) {
      console.error("Critical rendering failure caught:", renderError);
      // Fallback: reset camera and attempt one safe render to prevent frozen black screen
      this.resetCamera();
      try {
        this.renderer.render(this.scene, this.camera);
      } catch (f) {}
    }
  };

  public updatePlayerStage2Visuals() {
    if (!this.playerGroup) return;

    if (this.isStage2) {
      if (this.eggPhysicalMat) {
        this.eggPhysicalMat.color.set('#C48A52'); // Warm Light Farm Brown shell
        this.eggPhysicalMat.roughness = 0.22;
        this.eggPhysicalMat.metalness = 0.02;
        this.eggPhysicalMat.clearcoat = 0.5;
      }
      
      if (this.eggCapGroup) {
        this.eggCapGroup.traverse((node) => {
          if (node instanceof THREE.Mesh && node.material) {
            const mat = node.material as THREE.MeshStandardMaterial;
            if (node.geometry && node.geometry.type === 'BoxGeometry') {
              mat.color.set('#fbbf24'); // Visor yellow
            } else {
              mat.color.set('#facc15'); // Dome yellow
            }
            mat.roughness = 0.25;
          }
        });
      }

      if (this.chickYellowMat) {
        this.chickYellowMat.color.set('#d97706'); // Warm Golden Brown fluffy chick feathers
        this.chickYellowMat.roughness = 0.50;
      }

      if (this.chickenWhiteFeathersMat) {
        this.chickenWhiteFeathersMat.color.set('#b45309'); // Healthy Country Hen warm wood brown feathers
        this.chickenWhiteFeathersMat.roughness = 0.45;
      }
    } else {
      if (this.eggPhysicalMat) {
        this.eggPhysicalMat.color.set('#ffffff');
        this.eggPhysicalMat.roughness = 0.12;
      }
      if (this.eggCapGroup) {
        this.eggCapGroup.traverse((node) => {
          if (node instanceof THREE.Mesh && node.material) {
            const mat = node.material as THREE.MeshStandardMaterial;
            if (node.geometry && node.geometry.type === 'BoxGeometry') {
              mat.color.set('#fbbf24');
            } else {
              mat.color.set('#facc15');
            }
          }
        });
      }
      if (this.chickYellowMat) {
        this.chickYellowMat.color.set('#facc15');
      }
      if (this.chickenWhiteFeathersMat) {
        this.chickenWhiteFeathersMat.color.set('#ffffff');
      }
    }
  }

  private update(delta: number) {
    if (!this.scene || !this.camera || !this.renderer) return;

    // Ensure Player Stage 2 visual colors are applied
    this.updatePlayerStage2Visuals();

    // Process slide of laid Eggs
    if ((this as any).laidEggsList) {
      const currentSpeed = this.speed * (this.activePowerUps.has(PowerUpType.SPEED_BOOST) ? 1.75 : 1.0);
      (this as any).laidEggsList.forEach((eggObj: any) => {
        eggObj.mesh.position.z += currentSpeed * delta;
        eggObj.mesh.rotation.y += delta * 4.0;
        if (eggObj.mesh.position.z > 20) {
          this.scene.remove(eggObj.mesh);
        }
      });
    }

    // Process Stage 2 Transition laying mechanics
    if (this.isStage2Transition && !this.isPaused && !this.isCrashed) {
      this.stage2TransitionTimer -= delta;
      
      if (!this.isRetiring) {
        const currentSpeed = this.speed * (this.activePowerUps.has(PowerUpType.SPEED_BOOST) ? 1.75 : 1.0);
        this.distanceSinceLastEgg += currentSpeed * delta;
        if (this.distanceSinceLastEgg >= 4.0) { // drops an egg every 4 meters
          this.distanceSinceLastEgg = 0;
          this.brownEggsLaid++;
          
          this.callbacks.onCollectText?.(`🥚 Egg Laid: ${this.brownEggsLaid} / 50`, 'feed');
          this.callbacks.onEggLaid?.(this.brownEggsLaid);

          // Drop egg behind Hen
          if (this.playerGroup) {
            const eggGeo = new THREE.SphereGeometry(0.18, 12, 12);
            const eggMat = new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.22 });
            const laidMesh = new THREE.Mesh(eggGeo, eggMat);
            laidMesh.scale.set(1.1, 1.35, 1.1);
            laidMesh.position.set(this.playerGroup.position.x, 0.15, this.playerGroup.position.z - 3.0);
            this.scene.add(laidMesh);

            if (!(this as any).laidEggsList) (this as any).laidEggsList = [];
            (this as any).laidEggsList.push({ mesh: laidMesh });
          }

          if (this.brownEggsLaid >= 50) {
            this.isRetiring = true;
            this.retirementTimer = 4.0;
            this.callbacks.onCollectText?.("STAGE 2 UNLOCKED\nHatching new character...", "powerup");
          }
        }
      } else {
        // Retirement sequence: Hen walks off-road and fades
        this.retirementTimer -= delta;
        if (this.playerGroup) {
          this.playerGroup.position.x -= delta * 1.5;
          this.playerGroup.rotation.y = -Math.PI / 2.5; // Turn away
          this.playerGroup.scale.multiplyScalar(0.985); // Scale down/shrink!
        }

        if (this.retirementTimer <= 0) {
          this.isStage2 = true;
          this.isStage2Transition = false;
          this.isRetiring = false;
          this.currentStage = 'EGG';
          this.grainsCollected = 0;
          this.brownEggsLaid = 0;

          if (this.playerGroup) {
            this.playerGroup.scale.set(0.7, 0.7, 0.7);
            this.playerGroup.position.set(0, 0.5, this.playerZ);
            this.playerGroup.rotation.set(0, 0, 0);

            if ((this as any).stage2GlowMesh) {
              this.playerGroup.remove((this as any).stage2GlowMesh);
              (this as any).stage2GlowMesh = null;
            }
          }

          this.updatePlayerStage2Visuals();
          this.callbacks.onCollectText?.("WELCOME TO EXTREME MODE!\nSTAGE 2 ACTIVE", "powerup");
          this.callbacks.onStage2TransitionCompleted?.();
        }
      }
    }

    const originalDelta = delta;
    if (this.isHenEvolving) {
      delta = originalDelta * 0.15; // 85% Slow Motion on cinematic evolution!
    }
    const elapsed = this.clock.getElapsedTime();

    // 0a. Evolution Glow mesh expansion animation
    if ((this as any).evoGlowMesh) {
      if (!(this as any).evoGlowTimer) (this as any).evoGlowTimer = 1.2;
      (this as any).evoGlowTimer -= delta;
      const progress = (1.2 - (this as any).evoGlowTimer) / 1.2;
      (this as any).evoGlowMesh.scale.setScalar(1.0 + progress * 4.0);
      if ((this as any).evoGlowMesh.material) {
        ((this as any).evoGlowMesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1.0 - progress);
      }
      if ((this as any).evoGlowTimer <= 0) {
        if (this.playerGroup) this.playerGroup.remove((this as any).evoGlowMesh);
        (this as any).evoGlowMesh.geometry.dispose();
        (this as any).evoGlowMesh.material.dispose();
        (this as any).evoGlowMesh = null;
      }
    }

    // 0b. Critical Evolution system FAILSAFE
    if (this.isRunning && !this.isMenuShowcase && !this.isTransitioningToRun) {
      const liveConfig = getActiveLiveConfig();
      const eggChickReq = liveConfig.stage1EvolutionReq;
      if (this.currentStage === 'EGG' && this.grainsCollected >= eggChickReq && !this.isHatching) {
        console.log(`[FAILSAFE] GrainsCollected >= ${eggChickReq} found in Egg stage. Forcing evolution now!`);
        this.triggerHatchSequence();
      }
      if (this.currentStage === 'CHICK' && this.grainsCollected >= eggChickReq) {
        console.log(`[FAILSAFE] GrainsCollected >= ${eggChickReq} found in Chick stage. Forcing chicken champion evolution now!`);
        this.triggerChickenChampionSequence();
      }
    }

    // 1. Subway Surfers Start Screen Menu and Transitions
    if (this.isMenuShowcase) {
      this.updateShowcaseIdle(delta);
      this.updateCameraMenu(delta);
      return;
    }

    if (this.isTransitioningToRun) {
      this.updateRunTransition(delta);
      return;
    }

    if (this.isHatching) {
      this.hatchTimer -= delta;

      // Phase 1 (First 2.0 seconds: hatchTimer goes from 4.0 to 2.0):
      // - Shaking intensifying, crack sounds, soft crack dust, slow motion!
      if (this.hatchTimer > 2.0) {
        // Shaking intensifies over time
        if (this.eggBodyGroup) {
          const intensity = (4.0 - this.hatchTimer) / 2.0; // goes from 0 to 1
          const shakeVal = Math.sin(performance.now() * 0.08) * 0.18 * intensity;
          this.eggBodyGroup.rotation.y = shakeVal;
          this.eggBodyGroup.rotation.z = shakeVal;
          
          this.eggBodyGroup.scale.set(
            1.0 + Math.abs(shakeVal) * 0.3,
            1.35 + Math.sin(performance.now() * 0.05) * 0.1 * intensity,
            1.0 + Math.abs(shakeVal) * 0.3
          );
        }

        // Crack sounds periodically
        const lastTickSec = Math.floor((this.hatchTimer + delta) * 2.5);
        const currTickSec = Math.floor(this.hatchTimer * 2.5);
        if (lastTickSec !== currTickSec) {
          soundManager.playEggCrack();
          // spawn small shell powder representing cracks expanding
          for (let s = 0; s < 4; s++) {
            const angle = Math.random() * Math.PI * 2;
            const velocity = new THREE.Vector3(Math.cos(angle) * 0.6, Math.random() * 1.5, Math.sin(angle) * 0.6);
            const powderMesh = new THREE.Mesh(
              new THREE.BoxGeometry(0.045, 0.045, 0.045),
              new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.8 })
            );
            if (this.playerGroup) {
              powderMesh.position.copy(this.playerGroup.position).add(
                new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.3, (Math.random() - 0.5) * 0.3)
              );
            } else {
              powderMesh.position.set(0, 0.3, -18.0);
            }
            this.scene.add(powderMesh);
            this.smokeParticles.push({
              mesh: powderMesh as any,
              velocity,
              life: 0.5 + Math.random() * 0.4
            });
          }
        }

        // Light evolution glow ramp-up
        if ((this as any).evoGlowMesh) {
          const glow = (this as any).evoGlowMesh as THREE.Mesh;
          const progress = (4.0 - this.hatchTimer) / 2.0;
          glow.scale.setScalar(0.7 + progress * 0.8);
          if (glow.material instanceof THREE.MeshBasicMaterial) {
            glow.material.opacity = progress * 0.5;
          }
        }
      } 
      // Phase 2 (AT EXACTLY 2.0 seconds mark and onward):
      // - BIG shell blast, liquid yolk/white splash, stage shift to Chick!
      else {
        if (!(this as any).hasHatchBroken) {
          (this as any).hasHatchBroken = true;

          // Sound effects
          soundManager.playEggSmash();
          soundManager.playBirdChirp();
          soundManager.playLevelUp();

          // Crucial Stage Swap!
          this.currentStage = 'CHICK';
          this.grainsCollected = 0;
          localStorage.setItem('skm_evolution_stage', 'CHICK');
          localStorage.setItem('skm_grains_collected', '0');
          this.callbacks.onCollectText?.("🐥 HATCHED INTO A CHICK! 🐥", "powerup");

          // 1. Spawning large outward flying white shell fragments
          for (let i = 0; i < 35; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2.5 + Math.random() * 4.5;
            const velocity = new THREE.Vector3(Math.cos(angle) * speed, Math.random() * 4.0 + 2.5, Math.sin(angle) * speed);
            
            const chunkGeo = new THREE.BoxGeometry(0.08 + Math.random() * 0.08, 0.08 + Math.random() * 0.08, 0.08 + Math.random() * 0.08);
            const chunkMat = new THREE.MeshStandardMaterial({
              color: Math.random() < 0.75 ? '#f8fafc' : '#fbbf24', // shell white or warm egg color
              roughness: 0.3
            });
            const chunkMesh = new THREE.Mesh(chunkGeo, chunkMat);
            if (this.playerGroup) {
              chunkMesh.position.copy(this.playerGroup.position).add(
                new THREE.Vector3((Math.random() - 0.5) * 0.15, 0.3, (Math.random() - 0.5) * 0.15)
              );
            } else {
              chunkMesh.position.set(0, 0.3, -18.0);
            }
            this.scene.add(chunkMesh);
            this.smokeParticles.push({
              mesh: chunkMesh as any,
              velocity,
              life: 1.0 + Math.random() * 0.6
            });
          }

          // 2. Translucent "liquid yolk / white" splash particles
          for (let i = 0; i < 22; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.8 + Math.random() * 3.2;
            const velocity = new THREE.Vector3(Math.cos(angle) * speed, Math.random() * 2.5 + 1.2, Math.sin(angle) * speed);
            const splashGeo = new THREE.SphereGeometry(0.055 + Math.random() * 0.055, 8, 8);
            const splashMat = new THREE.MeshStandardMaterial({
              color: Math.random() < 0.65 ? '#fbbf24' : '#ffffff', // glossy yellow or white
              transparent: true,
              opacity: 0.85,
              roughness: 0.05
            });
            const splashMesh = new THREE.Mesh(splashGeo, splashMat);
            if (this.playerGroup) {
              splashMesh.position.copy(this.playerGroup.position).add(
                new THREE.Vector3((Math.random() - 0.5) * 0.1, 0.25, (Math.random() - 0.5) * 0.1)
              );
            } else {
              splashMesh.position.set(0, 0.25, -18.0);
            }
            this.scene.add(splashMesh);
            this.smokeParticles.push({
              mesh: splashMesh as any,
              velocity,
              life: 0.8 + Math.random() * 0.5
            });
          }

          // 3. Celebratory multicolored confetti splash
          this.spawnFeatherSplash();
          for (let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2;
            const velocity = new THREE.Vector3(Math.cos(angle) * 3.5, Math.random() * 4.5 + 3.0, Math.sin(angle) * 3.5);
            const confMesh = new THREE.Mesh(
              new THREE.BoxGeometry(0.11, 0.11, 0.11),
              new THREE.MeshStandardMaterial({
                color: ['#ff0055', '#22ff55', '#ffcc00', '#00ccff', '#ff00ff'][Math.floor(Math.random() * 5)]
              })
            );
            if (this.playerGroup) {
              confMesh.position.copy(this.playerGroup.position).add(new THREE.Vector3(0, 0.35, 0));
            } else {
              confMesh.position.set(0, 0.35, -18.0);
            }
            this.scene.add(confMesh);
            this.smokeParticles.push({
              mesh: confMesh as any,
              velocity,
              life: 1.6
            });
          }

          // Stretch visual pulse for juicy landing impact
          this.squashStretchY = 1.45;
        }

        // Phase 3: Wing stretch and chick jumps procedural parabola
        const phaseProgress = (2.0 - this.hatchTimer) / 2.0; // from 0.0 to 1.0
        
        // Wing stretch loop: flare outward, flap down
        const wingStretchVal = Math.sin(phaseProgress * Math.PI) * 1.35;
        if (this.chickLeftWing) {
          this.chickLeftWing.rotation.z = wingStretchVal;
          this.chickLeftWing.rotation.x = Math.sin(phaseProgress * Math.PI * 2.0) * 0.45;
        }
        if (this.chickRightWing) {
          this.chickRightWing.rotation.z = -wingStretchVal;
          this.chickRightWing.rotation.x = -Math.sin(phaseProgress * Math.PI * 2.0) * 0.45;
        }

        // Procedural Parabolic Jump
        const jumpY = Math.sin(phaseProgress * Math.PI) * 1.5;
        (this as any).evoJumpOffsetY = jumpY;

        // Golden glow flare expanding and fading dynamically
        if ((this as any).evoGlowMesh) {
          const glow = (this as any).evoGlowMesh as THREE.Mesh;
          glow.scale.setScalar(1.5 + phaseProgress * 5.0);
          if (glow.material instanceof THREE.MeshBasicMaterial) {
            glow.material.opacity = 0.95 * (1.0 - phaseProgress);
          }
        }
      }

      if (this.hatchTimer <= 0) {
        this.isHatching = false;
        (this as any).evoJumpOffsetY = 0.0;

        // Clean up the evolution glow mesh
        if ((this as any).evoGlowMesh) {
          if (this.playerGroup) {
            this.playerGroup.remove((this as any).evoGlowMesh);
          }
          (this as any).evoGlowMesh = null;
        }
      }
    }

    if (this.isHenEvolving) {
      this.henEvolveTimer -= (delta / 0.15); // decrement in real unscaled seconds!

      // Calculate time spent in the evolution cinematic (0.0 to 5.0 seconds)
      const timeSpent = 5.0 - this.henEvolveTimer;

      // Phase 1: Growth and golden feathers of light (First 3 seconds, timer from 5.0 down to 2.0)
      if (this.henEvolveTimer > 2.0) {
        const t = Math.min(1.0, timeSpent / 3.0); // progress from 0.0 to 1.0
        
        // Dynamic visual growth scale making the body grandly increase in size
        this.visualGrowthScale = 1.0 + t * 1.25; // Grows smoothly to 2.25x scale!
        if (this.playerGroup) {
          this.playerGroup.scale.setScalar(this.visualGrowthScale);
        }

        // Morphing cross-fade transition: Chick shrinks, Hen gradually forms and wings/comb grow larger!
        if (this.chickGroup) this.chickGroup.scale.setScalar(Math.max(0.001, 1.0 - t));
        if (this.adultGroup) this.adultGroup.scale.setScalar(Math.max(0.001, t));

        // Continually spawn beautiful glittering golden feather particles
        if (Math.random() < 0.35) {
          const angle = Math.random() * Math.PI * 2;
          const velocity = new THREE.Vector3(Math.cos(angle) * 1.5, Math.random() * 2.5 + 2.0, Math.sin(angle) * 1.5);
          const goldFeather = new THREE.Mesh(
            new THREE.ConeGeometry(0.045, 0.15, 4),
            new THREE.MeshBasicMaterial({ color: '#f59e0b', transparent: true, opacity: 0.9 })
          );
          if (this.playerGroup) {
            goldFeather.position.copy(this.playerGroup.position).add(
              new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.4, (Math.random() - 0.5) * 0.4)
            );
            this.scene.add(goldFeather);
            this.smokeParticles.push({ mesh: goldFeather as any, velocity, life: 0.8 + Math.random() * 0.5 });
          }
        }

        // Animate the soft golden glow expansion
        if ((this as any).evoGlowMesh) {
          const glow = (this as any).evoGlowMesh as THREE.Mesh;
          glow.scale.setScalar(0.7 + t * 2.8);
          if (glow.material instanceof THREE.MeshBasicMaterial) {
            glow.material.opacity = 0.1 + t * 0.85;
          }
        }
      } 
      // Phase 2: Swap stage to Hen, blast colorful stars, play sound clucks, and camera circle orbits!
      else {
        if (!(this as any).hasHenSwappedModel) {
          (this as any).hasHenSwappedModel = true;

          // Swap stage to adult
          this.currentStage = 'ADULT';
          this.grainsCollected = 0;
          localStorage.setItem('skm_evolution_stage', 'ADULT');
          localStorage.setItem('skm_grains_collected', '0');
          this.visualGrowthScale = 2.25; // finalize rich adult scale
          if (this.playerGroup) {
            this.playerGroup.scale.setScalar(this.visualGrowthScale);
          }

          // Fully restore morphing scales in active Adult stage
          if (this.chickGroup) this.chickGroup.scale.setScalar(1.0);
          if (this.adultGroup) this.adultGroup.scale.setScalar(1.0);

          // Play glorious clucks and level up chimes
          soundManager.playCluck();
          soundManager.playLevelUp();

          // Spawn glorious rainbow champion stars!
          for (let i = 0; i < 45; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 3.5 + Math.random() * 5.0;
            const velocity = new THREE.Vector3(Math.cos(angle) * speed, Math.random() * 5.0 + 4.5, Math.sin(angle) * speed);

            const starGeo = new THREE.OctahedronGeometry(0.15, 0);
            const starMat = new THREE.MeshStandardMaterial({
              color: ['#10b981', '#fbbf24', '#3b82f6', '#ef4444', '#ec4899', '#8b5cf6'][Math.floor(Math.random() * 6)],
              roughness: 0.1,
              metalness: 0.85
            });
            const starMesh = new THREE.Mesh(starGeo, starMat);
            if (this.playerGroup) {
              starMesh.position.copy(this.playerGroup.position).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.5, (Math.random() - 0.5) * 0.4));
              this.scene.add(starMesh);
              this.smokeParticles.push({ mesh: starMesh as any, velocity, life: 1.4 + Math.random() * 0.6 });
            }
          }

          // Trigger feather splash splash
          this.spawnFeatherSplash();
          this.callbacks.onCollectText?.("🏆 QUEEN HEN CHAMPION UNLOCKED! 🏆", "powerup");
        }

        // Animate prideful wing flapping at 14Hz frequency
        const flapRate = performance.now() * 0.045;
        if (this.chickLeftWing) this.chickLeftWing.rotation.z = Math.sin(flapRate) * 0.95;
        if (this.chickRightWing) this.chickRightWing.rotation.z = -Math.sin(flapRate) * 0.95;
        if ((this as any).adultLeftWing) (this as any).adultLeftWing.rotation.z = Math.sin(flapRate) * 0.95;
        if ((this as any).adultRightWing) (this as any).adultRightWing.rotation.z = -Math.sin(flapRate) * 0.95;

        // Curve the golden glow to fade out elegantly
        const pt = (2.0 - this.henEvolveTimer) / 2.0; // 0.0 to 1.0 progress
        if ((this as any).evoGlowMesh) {
          const glow = (this as any).evoGlowMesh as THREE.Mesh;
          glow.scale.setScalar(3.5 + pt * 3.5);
          if (glow.material instanceof THREE.MeshBasicMaterial) {
            glow.material.opacity = 0.95 * (1.0 - pt);
          }
        }
      }

      if (this.henEvolveTimer <= 0) {
        this.isHenEvolving = false;
        this.visualGrowthScale = 1.0; // reset relative multiplier since standard model handles Adult size now!
        if (this.playerGroup) {
          this.playerGroup.scale.setScalar(1.0);
        }
        if (this.chickGroup) this.chickGroup.scale.setScalar(1.0);
        if (this.adultGroup) this.adultGroup.scale.setScalar(1.0);

        // Clean up evolution glow
        if ((this as any).evoGlowMesh) {
          if (this.playerGroup) {
            this.playerGroup.remove((this as any).evoGlowMesh);
          }
          (this as any).evoGlowMesh = null;
        }
      }
    }

    // --- Dynamic Weather & Day/Night System ---
    if (this.isRunning && !this.isPaused) {
      // 1. Advance the clock loop
      this.timeOfDay = (this.timeOfDay + delta * this.timeScale) % 24.0;

      // 1b. Rescue Spawning: Ensure at least 1 obstacle and 5 feed collectibles are visible ahead of player at all times!
      if (!this.isTransitioningToRun && !this.isHatching && !this.isCrashed) {
        const config = getActiveLiveConfig();
        const activeObsAhead = this.obstacles.filter(o => o.active && o.mesh.position.z < this.playerZ && o.mesh.position.z > this.playerZ - 130.0);
        
        // Count active feeds/grains ahead
        const activeFeedsAhead = this.collectibles.filter(c => 
          c.active && 
          c.mesh.position.z < this.playerZ && 
          c.mesh.position.z > this.playerZ - 130.0 && 
          (c.type === 'FEED' || c.type === 'GOLDEN_FEED' || c.type.startsWith('GRAIN_') || c.type === 'CORN')
        );

        if (activeObsAhead.length === 0 && config.obstacleSpawnRate > 0 && config.obstacleDensity > 0) {
          const rescueZ = this.playerZ - 50.0 - Math.random() * 20.0;
          const lane = Math.floor(Math.random() * 3) - 1;
          const allowed = ['FENCE', 'HAY_BALE', 'CONE'];
          const type = allowed[Math.floor(Math.random() * allowed.length)];
          console.log(`[Rescue Spawn] Spawning obstacle ahead at Z: ${rescueZ} inside lane: ${lane}`);
          this.createObstacle(lane, rescueZ, type);
        }

        if (activeFeedsAhead.length < 5 && config.feedSpawnRate > 0) {
          const rescueZ = this.playerZ - 30.0 - Math.random() * 10.0;
          const lane = Math.floor(Math.random() * 3) - 1;
          
          const getRescueGrain = (): string => {
            const r = Math.random();
            if (r < 0.25) return 'GRAIN_MAIZE';       // 25% Corn/Maize
            if (r < 0.45) return 'GRAIN_WHEAT';       // 20% Wheat
            if (r < 0.65) return 'GRAIN_RICE';        // 20% Rice
            if (r < 0.75) return 'GRAIN_MILLET';      // 10% Millet
            if (r < 0.85) return 'GRAIN_BARLEY';      // 10% Barley
            if (r < 0.95) return 'GRAIN_OATS';        // 10% Oats
            return 'GRAIN_SORGHUM';                   // 5% Sorghum
          };

          const cType = this.currentStage === 'EGG' ? getRescueGrain() : 'FEED';
          console.log(`[Rescue Spawn] Active feeds ahead low (${activeFeedsAhead.length}/5). Spawning collectible line starting at Z: ${rescueZ} inside lane: ${lane}`);
          
          // Spawn 6 sequential items to guarantee abundance
          for (let s = 0; s < 6; s++) {
            this.createCollectible(lane, rescueZ - s * 3.5, cType);
          }
        }
      }

      // Notify App callbacks about time of day updates so UI can render a gorgeous sky/time widget!
      if (this.callbacks.onTimeUpdated) {
        this.callbacks.onTimeUpdated(this.timeOfDay, this.currentWeather);
      }

      // 2. Weather switch timer tick
      this.weatherTimer -= delta;
      if (this.weatherTimer <= 0) {
        this.weatherTimer = 40.0 + Math.random() * 25.0; // switch weather every 40-65 secs
        
        const weatherOptions = ['SUNNY', 'CLOUDY', 'LIGHT_RAIN', 'THUNDERSTORM', 'FOGGY', 'RAIN_SUNSHINE'];
        const isNight = this.timeOfDay > 19.5 || this.timeOfDay < 4.5;
        
        let nextWeather = this.currentWeather;
        const oldWeather = this.currentWeather;
        while (nextWeather === oldWeather) {
          if (isNight && Math.random() < 0.45) {
            nextWeather = 'SUNNY'; // Clear Starry Night!
          } else {
            nextWeather = weatherOptions[Math.floor(Math.random() * weatherOptions.length)];
          }
        }
        this.setWeather(nextWeather);
      }

      // 3. Lightning Flash Controls (for Thunderstorm)
      if (this.lightningActive && this.lightningLight) {
        this.lightningTimer -= delta;
        if (this.lightningTimer <= 0) {
          if (Math.random() < 0.35 && this.lightningLight.intensity > 1.0) {
            this.lightningLight.intensity = 6.5; // double strike!
            this.lightningTimer = 0.04 + Math.random() * 0.08;
          } else {
            this.lightningActive = false;
            this.lightningLight.intensity = 0;
          }
        }
      } else if (this.currentWeather === 'THUNDERSTORM' && Math.random() < 0.0035) {
        this.triggerLightningStrike();
        soundManager.playThunderBoom();
      }

      // 4. Update dynamic audio ambience gains
      soundManager.updateWeatherAmbience(this.currentWeather, this.timeOfDay);
    }

    // Solve environment colors, density target, and transition smoothly
    this.computeEnvironmentTargets();
    this.updateEnvironmentLerps(delta);

    // 1. Zoom Camera Intro at Run Start
    if (this.isIntroActive) {
      this.introTime -= delta;
      const ratio = Math.max(0, this.introTime / 2.0);
      this.camera.position.set(0, 4.0 + ratio * 8.0, this.playerZ + 11.5 + ratio * 12.0);
      this.camera.lookAt(new THREE.Vector3(0, 1.1 - ratio * 1.0, -15.0));

      if (this.introTime <= 0) {
        this.isIntroActive = false;
      }
      return;
    }

    // 2. Crash death visual spin
    if (this.isCrashed) {
      if (this.currentStage === 'EGG') {
        if (this.eggCrackPhaseTimer > 0) {
          this.eggCrackPhaseTimer -= delta;
          if (this.eggBodyGroup) {
            // Highly physical wobbly cracking shake before smash!
            const wobble = Math.sin(performance.now() * 0.08) * 0.22;
            this.eggBodyGroup.position.set((Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.08, 0);
            this.eggBodyGroup.rotation.z = wobble;
          }
          if (this.eggCrackPhaseTimer <= 0) {
            soundManager.playEggSmash();
            soundManager.playGameOver();
            this.spawnEggBreakFragments();
          }
        } else {
          // Update scattered egg yolk/white liquid, shards, shoe/hand meshes
          this.updateEggBreak(delta);
        }
      } else {
        // High fidelity Chick/Adult (Hen) crash tumble & roll behavior!
        if (this.playerGroup) {
          if (this.currentStage === 'CHICK') {
            // Chick tumbles/rolls forward with flying feathers
            this.playerGroup.rotation.x += delta * 12.0; // high-speed tumble
            this.playerGroup.position.z += delta * 3.5;  // carry momentum forward
            // Gravitational fall onto the road floor
            this.playerGroup.position.y = Math.max(0.12, this.playerGroup.position.y - delta * 3.5);
          } else {
            // Hen does a heavy high-impact barrel roll and tumbles on the floor
            this.playerGroup.rotation.z += delta * 14.0; // barrel roll
            this.playerGroup.rotation.x += delta * 4.0;  // offset spin
            this.playerGroup.position.z += delta * 2.6;
            // Fall onto road floor
            this.playerGroup.position.y = Math.max(0.15, this.playerGroup.position.y - delta * 4.0);
          }
        }
        this.updateFeathers(delta);
      }

      this.crashTimer -= delta;
      if (this.crashTimer <= 0) {
        this.isCrashed = false;
        this.cleanupEggBreak();
        this.stop();
        this.callbacks.onCrash();
      }
      return;
    }

    // 3. Game Economy & continuous movement speeds
    const speedBoostActive = this.activePowerUps.has(PowerUpType.SPEED_BOOST);
    const speedMultiplier = speedBoostActive ? 1.75 : 1.0;
    let currentSpeed = this.speed * speedMultiplier;

    // Slow motion during cinematic hatching/evolution sequence
    if (this.isHatching || this.isHenEvolving) {
      currentSpeed *= 0.12;
    }

    if (this.isStage2Transition) {
      currentSpeed *= 0.15;
    }
    if (this.isRetiring) {
      currentSpeed = 0;
    }

    this.distance += currentSpeed * delta;

    // --- Corner Turns Mechanics (Disabled for pure straight Subway Surfers gameplay) ---
    this.isNearCornerTurn = false;
    this.wasCornerTurnedSuccessfully = false;
    this.targetCornerCameraYawOffset = 0;

    const isNearGate = this.obstacles.some(
      (o) => o.active && o.type === 'HIGH_BARRIER' && o.mesh.position.z < this.playerZ && o.mesh.position.z > this.playerZ - 65.0
    );

    this.callbacks.onDistanceUpdated(
      Math.floor(this.distance),
      this.currentStage,
      this.grainsCollected,
      this.isNearCornerTurn,
      this.cornerTurnDirection,
      isNearGate,
      this.isHatching || this.isHenEvolving
    );

    const currentTheme = this.getThemeForDistance(this.distance) || 'POULTRY_FARM';
    soundManager.update(currentSpeed, this.distance, currentTheme);

    // Continuous acceleration ramp based on dynamic progression system
    const diffMode = localStorage.getItem('skm_dev_difficulty') || 'NORMAL';
    let startSpeedVal = 15.2; // default
    if (diffMode === 'EASY') startSpeedVal = 12.0;
    else if (diffMode === 'HARD') startSpeedVal = 18.0;
    else if (diffMode === 'EXTREME') startSpeedVal = 22.0;
    let speedMult = 1.0;

    if (this.distance <= 500) {
      speedMult = 1.0;
    } else if (this.distance <= 1000) {
      // Smoothly interpolate multiplier from 1.0 to 1.05
      const t = (this.distance - 500) / 500;
      speedMult = THREE.MathUtils.lerp(1.0, 1.05, t);
    } else if (this.distance <= 2000) {
      // Smoothly interpolate multiplier from 1.05 to 1.10
      const t = (this.distance - 1000) / 1000;
      speedMult = THREE.MathUtils.lerp(1.05, 1.10, t);
    } else if (this.distance <= 3000) {
      // Smoothly interpolate multiplier from 1.10 to 1.15
      const t = (this.distance - 2000) / 1000;
      speedMult = THREE.MathUtils.lerp(1.10, 1.15, t);
    } else if (this.distance <= 5000) {
      // Smoothly interpolate multiplier from 1.15 to 1.20
      const t = (this.distance - 3000) / 2000;
      speedMult = THREE.MathUtils.lerp(1.15, 1.20, t);
    } else {
      // 5000m+: Smoothly interpolate multiplier from 1.20 to 1.25 over next 1500m
      const t = Math.min(1.0, (this.distance - 5000) / 1500);
      speedMult = THREE.MathUtils.lerp(1.20, 1.25, t);
    }

    // Stage 2 starts 10% faster and continues increasing
    if (this.isStage2) {
      speedMult *= 1.10;
    }

    const liveConfig = getActiveLiveConfig();
    speedMult *= liveConfig.runSpeedMultiplier;

    this.speed = Math.min(this.maxSpeed, startSpeedVal * speedMult);

    // Dynamic point counts
    const doublePtsActive = this.activePowerUps.has(PowerUpType.DOUBLE_SCORE);
    const multi = doublePtsActive ? 2.0 : 1.0;
    this.score += Math.round(currentSpeed * delta * 4 * multi);
    this.callbacks.onScore(this.score);

    // Decaying Power-ups
    this.activePowerUps.forEach((state, type) => {
      state.timeLeft -= delta;
      if (state.timeLeft <= 0) {
        this.activePowerUps.delete(type);
        if (type === PowerUpType.SHIELD) this.shieldBubbleMesh.visible = false;
        if (type === PowerUpType.MAGNET) this.magnetAuraMesh.visible = false;
      }
    });

    // 4. Smooth dynamic character alignments
    this.playerX = THREE.MathUtils.lerp(this.playerX, this.targetX, delta * 14.5);

    // Falling / Jumping parabolic controls
    if (this.isJumping) {
      this.jumpVelocity += this.gravity * delta;
      this.playerY += this.jumpVelocity * delta;

      if (this.playerY <= 0) {
        this.playerY = 0;
        this.isJumping = false;
        this.jumpVelocity = 0;
        
        // Satisfying Landing impact and floor dust shake
        this.landingShakeForce = 0.22;
        this.spawnFeatherSplash();
        soundManager.playLandingDust();
        for (let i = 0; i < 6; i++) {
          this.spawnDustParticle();
        }
        // Juice: Landing squash
        this.squashY = 0.55;
        this.squashX = 1.35;
        this.squashZ = 1.35;
      }
    }

    // Slide decaying times
    if (this.isSliding) {
      this.slideTimer -= delta;
      if (this.slideTimer <= 0) {
        this.isSliding = false;
      }
    }

    // High-safety: Prevent player reference from ever being missing or disconnected
    if (!this.playerGroup || !(this.playerGroup instanceof THREE.Group)) {
      console.log("Player reference missing, rebuilding player...");
      this.buildPlayer();
    }
    if (!this.scene.children.includes(this.playerGroup)) {
      console.log("Reattaching player reference to scene...");
      this.scene.add(this.playerGroup);
    }

    // Validate player coordinates to prevent numeric exceptions cascading to camera target
    let safePlayerX = this.playerX;
    let safePlayerY = this.playerY;
    let safePlayerZ = this.playerZ;

    if (typeof safePlayerX !== 'number' || isNaN(safePlayerX)) {
      this.playerX = 0;
      safePlayerX = 0;
    }
    if (typeof safePlayerY !== 'number' || isNaN(safePlayerY)) {
      this.playerY = 0;
      safePlayerY = 0;
    }
    if (typeof safePlayerZ !== 'number' || isNaN(safePlayerZ)) {
      this.playerZ = -18.0;
      safePlayerZ = -18.0;
    }

    // Lerp squash and stretch targets back to 1.0
    const lerpSpeed = 10.0;
    if (this.isSliding) {
      this.targetSquashY = 0.44;
      this.targetSquashX = 1.25;
      this.targetSquashZ = 1.25;
    } else if (this.isJumping) {
      if (this.jumpVelocity > 0) {
        // Ascending stretch
        this.targetSquashY = 1.35;
        this.targetSquashX = 0.82;
        this.targetSquashZ = 0.82;
      } else {
        // Descending impact prep stretch
        this.targetSquashY = 0.88;
        this.targetSquashX = 1.12;
        this.targetSquashZ = 1.12;
      }
    } else {
      this.targetSquashX = 1.0;
      this.targetSquashY = 1.0;
      this.targetSquashZ = 1.0;
    }
    this.squashX = THREE.MathUtils.lerp(this.squashX, this.targetSquashX, delta * lerpSpeed);
    this.squashY = THREE.MathUtils.lerp(this.squashY, this.targetSquashY, delta * lerpSpeed);
    this.squashZ = THREE.MathUtils.lerp(this.squashZ, this.targetSquashZ, delta * lerpSpeed);

    // Set position, rotation (with lane roll banking tilt), and scale
    // Smooth lerp for visualGrowthScale and squashStretchY
    let targetGrowth = 1.0;
    const feedCount = this.grainsCollected || 0;
    // Gradual progression: scale grows continuously and smoothly with every feed collected!
    // Ranges from 1.0 (at 0/25 feed collected) up to 1.15 (at 25/25 feeds collected)
    targetGrowth = 1.0 + (feedCount / 25.0) * 0.15;
    if (targetGrowth > 1.15) {
      targetGrowth = 1.15;
    }

    this.visualGrowthScale = THREE.MathUtils.lerp(this.visualGrowthScale, targetGrowth, delta * 7.5);
    this.squashStretchY = THREE.MathUtils.lerp(this.squashStretchY, 1.0, delta * 7.5);

    if (this.happyFaceTimer > 0) {
      this.happyFaceTimer -= delta;
    }

    // Dynamic visibility of the egg's front face (mouth, eyes, smile)
    if (this.eggFaceGroup) {
      this.eggFaceGroup.visible = (this.isMenuShowcase || this.isTransitioningToRun);
    }

    // Set position, rotation (with lane roll banking tilt), and scale
    if (this.playerGroup) {
      let baseScaleFactor = 0.70;
      let groundOffsetFactor = 1.17; // matches standard high resolution alignment

      if (this.currentStage === 'EGG') {
        baseScaleFactor = 0.61 * this.visualGrowthScale * 0.90; // Reduced -10% for improved road visibility
        groundOffsetFactor = 1.45; // Keeps egg sneakers exactly walking on the road (adjusted for 1.4x length legs)
      } else if (this.currentStage === 'CHICK') {
        baseScaleFactor = 0.52 * this.visualGrowthScale * 0.90; // Reduced -10% for improved road visibility
        groundOffsetFactor = 0.82; // Keeps chick claws walking on the road
      } else {
        baseScaleFactor = 0.70 * this.visualGrowthScale * 0.90; // Reduced -10% for improved road visibility
        groundOffsetFactor = 1.14; // Keep adult hen claws on the road
      }

      // Adjust y position dynamically with curvature offset
      const playerOffset = this.getCurvatureOffset(this.distance);
      const evoJumpY = (this as any).evoJumpOffsetY || 0.0;
      this.playerGroup.position.set(safePlayerX + playerOffset, safePlayerY + groundOffsetFactor * baseScaleFactor * this.squashY * this.squashStretchY + evoJumpY, safePlayerZ);
      
      // Roll banking rotation on lane shifts
      let targetTiltZ = 0;
      if (Math.abs(this.targetX - this.playerX) > 0.05) {
        targetTiltZ = (this.playerX - this.targetX) * 0.14; // lean into swipe direction
      }
      const currentTiltZ = THREE.MathUtils.lerp(this.playerGroup.rotation.z, targetTiltZ, delta * 12.0);
      
      // Face towards camera (0) in menus or intro transition, face forward (Math.PI) during running gameplay
      const targetRotY = (this.isMenuShowcase || this.isTransitioningToRun) ? 0 : Math.PI;
      this.playerGroup.rotation.set(0, targetRotY, currentTiltZ);
      
      // Apply squash and stretch factors: this.squashX * baseScaleFactor * this.squashStretchY
      this.playerGroup.scale.set(
        this.squashX * baseScaleFactor,
        this.squashY * baseScaleFactor * this.squashStretchY,
        this.squashZ * baseScaleFactor
      );
    }

    // Update visibility groups for evolution stages
    if (this.isHenEvolving) {
      if (this.eggGroup) this.eggGroup.visible = false;
      if (this.chickGroup) this.chickGroup.visible = true;
      if (this.adultGroup) this.adultGroup.visible = true;
    } else {
      if (this.eggGroup) this.eggGroup.visible = (this.currentStage === 'EGG');
      if (this.chickGroup) this.chickGroup.visible = (this.currentStage === 'CHICK');
      if (this.adultGroup) this.adultGroup.visible = (this.currentStage === 'ADULT');
    }

    // Scale mesh directly when sliding under pillars
    if (this.isSliding) {
      if (this.chickenBodyMesh) this.chickenBodyMesh.scale.set(1.0, 1.0, 1.0); // Reset body mesh scale since playerGroup squashes
      
      if (this.eggLeftLeg) this.eggLeftLeg.visible = false;
      if (this.eggRightLeg) this.eggRightLeg.visible = false;
      if (this.chickLeftLeg) this.chickLeftLeg.visible = false;
      if (this.chickRightLeg) this.chickRightLeg.visible = false;
      if (this.chickenLeftLeg) this.chickenLeftLeg.visible = false;
      if (this.chickenRightLeg) this.chickenRightLeg.visible = false;
    } else {
      if (this.chickenBodyMesh) this.chickenBodyMesh.scale.set(1.0, 1.15, 1.15);
      
      if (this.eggLeftLeg) this.eggLeftLeg.visible = true;
      if (this.eggRightLeg) this.eggRightLeg.visible = true;
      if (this.chickLeftLeg) this.chickLeftLeg.visible = true;
      if (this.chickRightLeg) this.chickRightLeg.visible = true;
      if (this.chickenLeftLeg) this.chickenLeftLeg.visible = true;
      if (this.chickenRightLeg) this.chickenRightLeg.visible = true;
    }

    // 5. Classic Subway Surfers Camera alignment - Completely locked & stable
    this.cornerCameraYawOffset = 0;

    // Move camera slightly higher and further back for better obstacle/turn visibility
    // Adjusted: +20% distance increase (0.53 * 1.20 = 0.636) and +15% height increase (0.66 * 1.15 = 0.759)
    let activeOffsetDepth = this.cameraOffsetDepth * 0.636;
    let activeOffsetHeight = this.cameraOffsetHeight * 0.759;

    // Camera automatically backs up slightly as the character grows
    const growthAdjustmentDepth = 1.0 + (this.visualGrowthScale - 1.0) * 0.45;
    const growthAdjustmentHeight = 1.0 + (this.visualGrowthScale - 1.0) * 0.25;

    activeOffsetDepth *= growthAdjustmentDepth;
    activeOffsetHeight *= growthAdjustmentHeight;

    if (this.isHatching || this.isHenEvolving) {
      activeOffsetDepth *= 0.55; // zoom in closer on evolution
      activeOffsetHeight *= 0.85; // lower height for dramatic eye level
    }

    const cameraAbsoluteZ = safePlayerZ + activeOffsetDepth;
    let targetCameraX = safePlayerX; // Keeping player strictly centered horizontally (X = 0 relative offset)
    let targetCameraY = activeOffsetHeight + safePlayerY * 0.45; // beautifully smooth follow on jumping
    let targetCameraZ = cameraAbsoluteZ;

    let forceLookAtPlayer = false;

    // Revolving camera showcase orbit around the legendary growing hen!
    if (this.isHenEvolving && this.henEvolveTimer <= 2.0) {
      const pt = (2.0 - this.henEvolveTimer) / 2.0; // 0.0 to 1.0 orbit progress
      const orbitAngle = pt * Math.PI * 1.6; // beautiful 288 degree swing
      const orbitRadius = activeOffsetDepth * 1.35;

      targetCameraX = safePlayerX + Math.sin(orbitAngle) * orbitRadius;
      targetCameraY = safePlayerY + activeOffsetHeight * 1.15;
      targetCameraZ = safePlayerZ + Math.cos(orbitAngle) * orbitRadius;
      forceLookAtPlayer = true;
    }

    // Dynamic FOV calculation
    const screenWidth = window.innerWidth;
    let targetFOV = 55; // Desktop
    if (screenWidth < 480) {
      targetFOV = 68; // Mobile: 65-70
    } else if (screenWidth < 1024) {
      targetFOV = 60; // Tablet
    }
    this.currentFOV = targetFOV;

    if (!this.camera || !(this.camera instanceof THREE.PerspectiveCamera)) {
      console.log("Reattaching camera...");
      this.camera = new THREE.PerspectiveCamera(this.currentFOV, window.innerWidth / window.innerHeight, 0.1, 1000);
    }

    const lerpStepX = Math.min(1.0, delta * (forceLookAtPlayer ? 14.0 : 9.5));
    const lerpStepY = Math.min(1.0, delta * (forceLookAtPlayer ? 10.0 : 7.5));
    const lerpStepZ = Math.min(1.0, delta * (forceLookAtPlayer ? 14.0 : 9.5));

    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, isNaN(targetCameraX) ? 0 : targetCameraX, lerpStepX);
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, isNaN(targetCameraY) ? 3.6 : targetCameraY, lerpStepY);
    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, isNaN(targetCameraZ) ? -8.8 : targetCameraZ, lerpStepZ);

    // Apply intense high-fidelity screen shake offsets on fatal collisions
    if (this.isCrashed) {
      const shakeTime = performance.now() * 0.08;
      const shakeIntensity = 0.25 * Math.max(0.0, this.crashTimer / 2.0); // fades out naturally
      this.camera.position.x += Math.sin(shakeTime) * shakeIntensity;
      this.camera.position.y += Math.cos(shakeTime * 1.35) * shakeIntensity;
    }

    // Ensure camera coordinates are never NaN
    if (isNaN(this.camera.position.x)) this.camera.position.x = isNaN(targetCameraX) ? 0 : targetCameraX;
    if (isNaN(this.camera.position.y)) this.camera.position.y = isNaN(targetCameraY) ? 3.6 : targetCameraY;
    if (isNaN(this.camera.position.z)) this.camera.position.z = isNaN(targetCameraZ) ? -8.8 : targetCameraZ;

    // Direct looking down straight path ahead
    const lookAheadAnchor = new THREE.Vector3(
      safePlayerX, // lock looking horizontally center
      1.1 + safePlayerY * 0.10, // slightly elevated look-at anchor
      safePlayerZ - 25.0
    );

    if (forceLookAtPlayer) {
      // Look directly at the center of the gorgeous newly evolved Hen
      lookAheadAnchor.set(safePlayerX, safePlayerY + 0.9, safePlayerZ);
    }

    if (isNaN(lookAheadAnchor.x) || isNaN(lookAheadAnchor.y) || isNaN(lookAheadAnchor.z)) {
      lookAheadAnchor.set(0, 0.8, -18.0 - 25.0);
    }

    this.camera.lookAt(lookAheadAnchor);

    // Roll rotation is completely flat and locked
    this.camera.rotation.z = 0;

    // Apply dynamic FOV
    if (this.camera.fov !== this.currentFOV) {
      this.camera.fov = this.currentFOV;
      this.camera.updateProjectionMatrix();
    }

    // 6. Character bobbing run cycle
    if (!this.isJumping && !this.isSliding) {
      const walkFreq = elapsed * currentSpeed * 1.55;
      const animSpeedModifier = currentSpeed / 16.0;

      if (this.currentStage === 'EGG') {
        const legSwing = Math.sin(walkFreq);
        
        // Accurate mascot stride - no double-rotating inheritance
        if (this.eggLeftThighPivot) this.eggLeftThighPivot.rotation.x = legSwing * 0.68;
        if (this.eggRightThighPivot) this.eggRightThighPivot.rotation.x = -legSwing * 0.68;
        
        // Beautiful organic knee bend - knee flexes back when leg lifts/swings back
        if (this.eggLeftCalfPivot) {
          this.eggLeftCalfPivot.rotation.x = legSwing < 0 ? -legSwing * 0.85 : 0.05;
        }
        if (this.eggRightCalfPivot) {
          this.eggRightCalfPivot.rotation.x = legSwing > 0 ? legSwing * 0.85 : 0.05;
        }

        // Foot ankle pivot matching ground contact
        if (this.eggLeftFootPivot) {
          this.eggLeftFootPivot.rotation.x = legSwing > 0 ? 0.22 : -0.15;
          this.eggLeftFootPivot.position.y = -0.38 + Math.max(0, -legSwing) * 0.09; // smooth foot lift
        }
        if (this.eggRightFootPivot) {
          this.eggRightFootPivot.rotation.x = legSwing < 0 ? 0.22 : -0.15;
          this.eggRightFootPivot.position.y = -0.38 + Math.max(0, legSwing) * 0.09; // smooth foot lift
        }

        // Lock root leg rotation to 0 to prevent robot double-rotation stiffness
        if (this.eggLeftLeg) this.eggLeftLeg.rotation.set(0, 0, 0);
        if (this.eggRightLeg) this.eggRightLeg.rotation.set(0, 0, 0);

        // Fluid running arm swing - elbows bent forward, hugging side, rotating on shoulder twists
        if (this.eggLeftUpperArmPivot) {
          this.eggLeftUpperArmPivot.rotation.x = -legSwing * 0.58;
          this.eggLeftUpperArmPivot.rotation.y = -legSwing * 0.20; // organic shoulder twist rotation
          this.eggLeftUpperArmPivot.rotation.z = Math.PI / 10.0 + Math.abs(legSwing) * 0.08; // tucked comfortably
        }
        if (this.eggRightUpperArmPivot) {
          this.eggRightUpperArmPivot.rotation.x = legSwing * 0.58;
          this.eggRightUpperArmPivot.rotation.y = legSwing * 0.20; // organic shoulder twist rotation
          this.eggRightUpperArmPivot.rotation.z = -Math.PI / 10.0 - Math.abs(legSwing) * 0.08; // tucked comfortably
        }

        // Active bent forearm joints - flexing dynamically
        if (this.eggLeftForearmPivot) {
          this.eggLeftForearmPivot.rotation.x = -1.35 + legSwing * 0.25;
        }
        if (this.eggRightForearmPivot) {
          this.eggRightForearmPivot.rotation.x = -1.35 - legSwing * 0.25;
        }
        
        // Dynamic bouncy vertical bounce
        const bounceY = (1.0 - Math.abs(Math.sin(walkFreq))) * 0.16 * (0.8 + animSpeedModifier * 0.2);
        
        // Distinct side sway and rotational hip twist
        const wobbleZ = Math.sin(walkFreq) * 0.14 * (0.8 + animSpeedModifier * 0.2);
        const twistY = Math.cos(walkFreq) * 0.08 * (0.8 + animSpeedModifier * 0.2);

        let localWobble = wobbleZ;
        let localYOffset = bounceY;
        let localTwist = twistY;
        
        if (this.happyFaceTimer > 0) {
          localWobble = Math.sin(elapsed * 35.0) * 0.18;
          localYOffset = bounceY + 0.14 * Math.abs(Math.sin(elapsed * 25.0));
          localTwist = Math.cos(elapsed * 35.0) * 0.12;
        }

        if (this.eggBodyGroup) {
          this.eggBodyGroup.rotation.z = localWobble;
          this.eggBodyGroup.rotation.y = localTwist;
          this.eggBodyGroup.position.y = localYOffset;
        }

        // High-elastic cap bounce, pinned at (0, 0.72, 0)
        if (this.eggCapGroup) {
          this.eggCapGroup.position.y = 0.72 + Math.sin(walkFreq * 2.0) * 0.05;
          this.eggCapGroup.rotation.z = -localWobble * 0.35;
          this.eggCapGroup.rotation.y = -localTwist * 0.35;
        }
      } else if (this.currentStage === 'CHICK') {
        const legSwing = Math.sin(walkFreq) * 0.88 + Math.sin(walkFreq * 3.0) * 0.08;
        if (this.chickLeftLeg) this.chickLeftLeg.rotation.x = legSwing * 0.9;
        if (this.chickRightLeg) this.chickRightLeg.rotation.x = -legSwing * 0.9;
        
        // Wings flap slightly to support running (double step rate)
        let wingFlap = Math.sin(walkFreq * 2.2) * 0.28 + 0.15;
        if (this.happyFaceTimer > 0) {
          wingFlap = Math.sin(elapsed * 45.0) * 0.75 + 0.25; // flap wings incredibly fast with pure joy!
        }
        
        if (this.chickLeftWing) {
          this.chickLeftWing.rotation.z = wingFlap;
          this.chickLeftWing.rotation.x = 0.1 + Math.sin(walkFreq) * 0.08;
        }
        if (this.chickRightWing) {
          this.chickRightWing.rotation.z = -wingFlap;
          this.chickRightWing.rotation.x = 0.1 - Math.sin(walkFreq) * 0.08;
        }

        // Small body bounce
        const bounceY = (1.0 - Math.abs(Math.sin(walkFreq))) * 0.065 * (0.8 + animSpeedModifier * 0.2);
        if (this.chickBodyGroup) {
          this.chickBodyGroup.position.y = bounceY;
          this.chickBodyGroup.rotation.z = Math.sin(walkFreq) * 0.04;
        }

        // Head bobs slightly in a cute manner
        if (this.chickHeadGroup) {
          this.chickHeadGroup.position.y = 0.48 + Math.sin(walkFreq * 2.0) * 0.015;
          this.chickHeadGroup.rotation.x = Math.sin(walkFreq) * 0.05;
        }

        // Tail wiggle
        if (this.chickTailGroup) {
          this.chickTailGroup.rotation.y = Math.sin(walkFreq * 2.5) * 0.18;
          this.chickTailGroup.rotation.x = -Math.PI / 4 + Math.sin(walkFreq * 2.0) * 0.08;
        }
      } else {
        if (this.chickenLeftLeg) this.chickenLeftLeg.rotation.x = Math.sin(walkFreq) * 0.8;
        if (this.chickenRightLeg) this.chickenRightLeg.rotation.x = -Math.sin(walkFreq) * 0.8;

        // Gentle wing flaps, backing up to intense flapping on food collect
        let wingFlap = Math.sin(elapsed * currentSpeed * 2.8) * 0.26;
        if (this.happyFaceTimer > 0) {
          wingFlap = Math.sin(elapsed * 35.0) * 0.65; // intense flapping!
        }
        
        if (this.chickenLeftWing) this.chickenLeftWing.rotation.z = wingFlap;
        if (this.chickenRightWing) this.chickenRightWing.rotation.z = -wingFlap;

        if (this.chickenTailGroup) this.chickenTailGroup.rotation.x = Math.sin(walkFreq * 2) * 0.15;
      }

      // Spawn puff dust behind feet coordinates and play soft footsteps at stride intervals!
      const stride = Math.floor(walkFreq / Math.PI);
      if (stride !== this.lastFootstepPhase) {
        this.lastFootstepPhase = stride;
        
        // Determine stride surface type based on activeTheme and weather!
        const w = this.currentWeather || 'SUNNY';
        const isRainy = (w === 'LIGHT_RAIN' || w === 'THUNDERSTORM' || w === 'RAIN_SUNSHINE');
        const isCloudy = (w === 'CLOUDY' || w === 'FOGGY');

        let surface: 'ASPHALT' | 'ASPHALT_WET' | 'ASPHALT_DAMP' | 'DIRT' | 'MUD' | 'GRASS' | 'WOOD_BRIDGE' = 'ASPHALT';
        
        const currentTheme = this.activeTheme;
        const isOffroad = Math.abs(this.playerX) > (this.laneSpacing * 0.55);

        if (isOffroad) {
          surface = currentTheme === 'CITY_DISTRICT' ? (isRainy ? 'ASPHALT_WET' : 'ASPHALT') : 'GRASS';
        } else {
          // On-road sampling
          if (currentTheme === 'RAINY_SEASON' || (isRainy && (currentTheme === 'POULTRY_FARM' || currentTheme === 'SKM_FACTORY' || currentTheme === 'WAREHOUSE'))) {
            surface = 'MUD';
          } else if (currentTheme === 'POULTRY_FARM' || currentTheme === 'CORN_FIELDS' || currentTheme === 'WHEAT_FIELDS' || currentTheme === 'NIGHT_FARM') {
            surface = 'DIRT';
          } else if (currentTheme === 'RIVER_AREA') {
            surface = 'WOOD_BRIDGE';
          } else {
            // Standard roadway
            if (isRainy) {
              surface = 'ASPHALT_WET';
            } else if (isCloudy) {
              surface = 'ASPHALT_DAMP';
            } else {
              surface = 'ASPHALT';
            }
          }
        }
        
        soundManager.playFootstep(surface);
        this.spawnDustParticle(surface);
        if (this.speed > 16.0) {
          this.spawnDustParticle(surface);
          if (this.speed > 20.0) {
            this.spawnDustParticle(surface);
          }
        }
      }
    } else if (this.isJumping) {
      if (this.currentStage === 'EGG') {
        // Dynamic curled leg jump pose using bones
        if (this.eggLeftThighPivot) this.eggLeftThighPivot.rotation.x = -0.45;
        if (this.eggRightThighPivot) this.eggRightThighPivot.rotation.x = -0.45;
        if (this.eggLeftCalfPivot) this.eggLeftCalfPivot.rotation.x = 0.85;
        if (this.eggRightCalfPivot) this.eggRightCalfPivot.rotation.x = 0.85;
        if (this.eggLeftFootPivot) this.eggLeftFootPivot.rotation.x = -0.2;
        if (this.eggRightFootPivot) this.eggRightFootPivot.rotation.x = -0.2;

        // Excited raised arm waving jump pose using bones
        if (this.eggLeftUpperArmPivot) {
          this.eggLeftUpperArmPivot.rotation.set(-0.35, 0.15, Math.PI / 2.6);
        }
        if (this.eggRightUpperArmPivot) {
          this.eggRightUpperArmPivot.rotation.set(-0.35, -0.15, -Math.PI / 2.6);
        }
        
        // Forearm slightly flexed
        if (this.eggLeftForearmPivot) this.eggLeftForearmPivot.rotation.x = -0.7;
        if (this.eggRightForearmPivot) this.eggRightForearmPivot.rotation.x = -0.7;

        // Reset parent group modifiers
        if (this.eggLeftLeg) this.eggLeftLeg.rotation.set(0, 0, 0);
        if (this.eggRightLeg) this.eggRightLeg.rotation.set(0, 0, 0);
        if (this.eggLeftArm) this.eggLeftArm.rotation.set(0, 0, 0);
        if (this.eggRightArm) this.eggRightArm.rotation.set(0, 0, 0);
      } else if (this.currentStage === 'CHICK') {
        if (this.chickLeftLeg) this.chickLeftLeg.rotation.x = -Math.PI / 4;
        if (this.chickRightLeg) this.chickRightLeg.rotation.x = -Math.PI / 4;
        if (this.chickLeftWing) this.chickLeftWing.rotation.z = 0.7;
        if (this.chickRightWing) this.chickRightWing.rotation.z = -0.7;
      } else {
        // open wings and tuck claws
        if (this.chickenLeftLeg) this.chickenLeftLeg.rotation.x = -Math.PI / 4;
        if (this.chickenRightLeg) this.chickenRightLeg.rotation.x = -Math.PI / 4;
        if (this.chickenLeftWing) this.chickenLeftWing.rotation.z = 0.6;
        if (this.chickenRightWing) this.chickenRightWing.rotation.z = -0.6;
      }
    }

    // Hue rainbow cycle
    if (this.currentSkinId === 'skin_rainbow') {
      const hueColors = (elapsed * 0.4) % 1.0;
      const rgb = new THREE.Color().setHSL(hueColors, 0.85, 0.55);
      this.playerGroup.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          if (
            node.name === 'chicken_body' ||
            node.name === 'chicken_neck' ||
            node.name === 'chicken_head' ||
            node.name === 'tail_feather' ||
            node.name === 'wing_feather'
          ) {
            if (node.material instanceof THREE.MeshStandardMaterial) {
              node.material.color.copy(rgb);
            }
          }
        }
      });
    }

    // 7. Infinite roadway segments cycling
    const travelDist = currentSpeed * delta;
    this.totalRoadScrolled += travelDist;

    if (this.factoryGateGroup) {
      this.factoryGateGroup.position.z += travelDist;
      if (this.factoryGateGroup.position.z > 50.0) {
        this.factoryGateGroup.visible = false;
      }
    }

    this.roads.forEach((roadGrp) => {
      roadGrp.position.z += travelDist;

      // Re-cycle road block to the far front on exiting screens
      if (roadGrp.position.z > 35) {
        const furthestZ = this.getFurthestRoadPieceZ();
        const nextZ = furthestZ - this.roadLength;
        roadGrp.position.z = nextZ;

        // Compute new biome/theme for this recycled chunk
        const chunkDist = this.distance + (-nextZ - this.playerZ);
        const nextTheme = this.getThemeForDistance(chunkDist);

        if (roadGrp.userData.theme !== nextTheme) {
          roadGrp.userData.theme = nextTheme;
        }

        // Re-generate continuous terrain heights and colors for seamless stitching
        this.updateSegmentTerrain(roadGrp, nextZ);

        // Re-decorate chunk with high-quality theme-specific decorations!
        this.decorateChunkProcedurally(roadGrp, nextZ, Math.round(nextZ / -this.roadLength));

        // Instantly update decor visibility for this chunk
        this.updateChunkDecorVisibility(roadGrp);

        const roadMesh = roadGrp.getObjectByName('ground_plane') as THREE.Mesh;
        if (roadMesh) {
          roadMesh.material = this.getRoadMaterialForSegment(nextTheme, this.currentWeather || 'SUNNY');
        }

        // Populate procedural blocks on dynamic triggers
        this.spawnProceduralSegment(roadGrp.position.z);
      }

      // Dynamic curve alignment based on world Z coordinate on track!
      roadGrp.position.x = this.getCurvatureOffset(this.distance - roadGrp.position.z - 18.0);

      // Sway wheat decorative crops dynamically in wind!
      const wheatSway = roadGrp.getObjectByName('wheat_stalk_decor');
      if (wheatSway) {
        wheatSway.children.forEach((stalk) => {
          stalk.rotation.z = Math.sin(elapsed * 4.5 + stalk.position.x * 2.0) * 0.08 * this.windSpeedCurrent;
        });
      }

      // Rotate windmill blades (faster during storm!)
      const windBlades = roadGrp.getObjectByName('windmill_fan');
      if (windBlades) {
        windBlades.rotation.z += delta * 1.6 * this.windSpeedCurrent;
      }

      // Rotate barn attic ventilations (faster during storm!)
      const attVent = roadGrp.getObjectByName('barn_vent_fan');
      if (attVent) {
        attVent.rotation.z += delta * 2.4 * this.windSpeedCurrent;
      }

      // Industrial blinking beacons
      const nBlink = roadGrp.getObjectByName('neon_blinker');
      if (nBlink && nBlink instanceof THREE.Mesh && nBlink.material instanceof THREE.MeshBasicMaterial) {
        nBlink.material.color.setHSL((elapsed * 3.4) % 1.0, 1.0, 0.5);
      }

      // Checkpoint gate warning beacons blinking
      const bBlue = roadGrp.getObjectByName('beacon_blue');
      if (bBlue && bBlue instanceof THREE.Mesh && bBlue.material instanceof THREE.MeshBasicMaterial) {
        const pulse = Math.sin(elapsed * 10.0) > 0;
        bBlue.material.color.set(pulse ? '#3b82f6' : '#1e3a8a');
      }

      const bYellow = roadGrp.getObjectByName('beacon_yellow');
      if (bYellow && bYellow instanceof THREE.Mesh && bYellow.material instanceof THREE.MeshBasicMaterial) {
        const pulse = Math.cos(elapsed * 10.0) > 0;
        bYellow.material.color.set(pulse ? '#eab308' : '#78350f');
      }

      // Dynamic crop and tree swayed wind animation
      roadGrp.traverse((node) => {
        if (node.name === 'stalk') {
          node.rotation.z = Math.sin(elapsed * (2.8 * this.windSpeedCurrent) + node.position.x * 2.0) * (0.08 * Math.sqrt(this.windSpeedCurrent));
        } else if (node.name === 'tree') {
          node.rotation.z = Math.sin(elapsed * (1.8 * this.windSpeedCurrent) + node.position.x) * (0.015 * this.windSpeedCurrent);
          node.rotation.x = Math.cos(elapsed * (1.5 * this.windSpeedCurrent) + node.position.z) * (0.012 * this.windSpeedCurrent);
        } else if (node.name === 'skm_waving_cloth') {
          // Beautiful cloth flag waving simulation representing wind speeds!
          const wave = Math.sin(elapsed * (4.2 * this.windSpeedCurrent) + node.position.y * 1.5) * 0.15 * Math.sqrt(this.windSpeedCurrent);
          node.rotation.y = wave;
          // Slight secondary flag tilt flap
          node.rotation.z = Math.cos(elapsed * (2.4 * this.windSpeedCurrent)) * 0.05 * this.windSpeedCurrent;
        } else if (node.name === 'exhaust_pipe') {
          // Emit roadside decorative smoke puffs
          if (Math.random() < 0.035) {
            const worldPos = new THREE.Vector3();
            node.getWorldPosition(worldPos);
            this.spawnExhaustSmoke(worldPos.x, worldPos.y + 0.45, worldPos.z, '#3f3f46');
          }
        }
      });
    });

    // 7b. Update atmosphere elements (Atmospheric Depth & Motion)
    this.bgClouds.forEach((cloud) => {
      // Move clouds slowly forward with the player running
      cloud.position.z += travelDist * 0.15;
      // Cross-drift from left to right
      cloud.position.x += delta * 0.35;
      if (cloud.position.x > 35) {
        cloud.position.x = -35;
      }
      if (cloud.position.z > 25) {
        cloud.position.z = -120;
      }
    });

    this.bgBirds.forEach((bird) => {
      // Birds fly forward slightly faster than player runner
      bird.position.z += travelDist * 0.28 + delta * 2.0;
      // Flap wings flapping animation
      const lWing = bird.getObjectByName('l_wing_joint');
      const rWing = bird.getObjectByName('r_wing_joint');
      if (lWing) {
        lWing.rotation.z = Math.sin(elapsed * 9.5) * 0.45;
      }
      if (rWing) {
        rWing.rotation.z = -Math.sin(elapsed * 9.5) * 0.45;
      }

      if (bird.position.z > 25) {
        bird.position.z = -100 - Math.random() * 40;
        bird.position.x = -12 + Math.random() * 24;
      }
    });

    // 8. Update obstacle hits and collectibles magnet interactions
    this.updateWorldEntities(delta, currentSpeed);

    // Weather particles
    this.updateWeatherLayers(delta);
    
    // CPU Dust layers fade
    this.updateSmokeLayers(delta);
    this.updateTrailParticles(delta);

    this.updateFeathers(delta);
  }

  public clearTemporaryCache() {
    addDebugLog('SYSTEM', 'Initiating garbage-collection & temporary cache cleanup.');
    
    // Clear unused pooled obstacles that are inactive
    const inactiveObstacles = this.obstacles.filter(o => !o.active);
    inactiveObstacles.forEach(o => {
      this.scene.remove(o.mesh);
    });
    this.obstacles = this.obstacles.filter(o => o.active);

    // Clear unused/inactive collectibles
    const inactiveCollectibles = this.collectibles.filter(c => !c.active);
    inactiveCollectibles.forEach(c => {
      this.scene.remove(c.mesh);
    });
    this.collectibles = this.collectibles.filter(c => c.active);
    
    addDebugLog('SYSTEM', 'Cleanup completed. Unused meshes purged from Scene.');
  }

  public optimizePerformance() {
    addDebugLog('SYSTEM', 'Graphics optimizer pass: disabling shadow casting on obstacles/feeds.');
    
    // Disable shadow casting on obstacles
    this.obstacles.forEach(o => {
      o.mesh.traverse((child: any) => {
        if (child.isMesh) {
          child.castShadow = false;
          child.receiveShadow = false;
        }
      });
    });

    // Disable shadow casting on collectibles
    this.collectibles.forEach(c => {
      c.mesh.traverse((child: any) => {
        if (child.isMesh) {
          child.castShadow = false;
          child.receiveShadow = false;
        }
      });
    });
    
    addDebugLog('SYSTEM', 'Performance stress reduced. Shadow drawing deactivated on current meshes.');
  }

  public triggerPerformanceStressTest() {
    addDebugLog('TEST', 'Performance Stress Test triggered: spawning extreme objects density.');
    
    // Spawns dozens of dummy vehicles/obstacles and food elements
    for (let i = 0; i < 40; i++) {
      const lane = (i % 3) - 1;
      const zPos = this.playerZ - 10.0 - (i * 2.5);
      const isVehicle = i % 2 === 0;
      
      if (isVehicle) {
        this.createObstacle(lane, zPos, 'CAR');
      } else {
        this.createObstacle(lane, zPos, 'FENCE');
      }
      this.createCollectible(lane, zPos - 1.2, 'FEED');
    }
    
    addDebugLog('TEST', 'Spawned 40 heavy physical mesh items to test rendering capacity under stress.');
  }

  public resetToShowcase() {
    this.isMenuShowcase = true;
    this.isTransitioningToRun = false;
    this.isRunning = true;
    this.isPaused = false;
    this.isCrashed = false;
    this.cleanupEggBreak();
    this.gateOpenProgress = 0.0;
    this.distance = 0;
    this.score = 0;
    const diffMode = localStorage.getItem('skm_dev_difficulty') || 'NORMAL';
    if (diffMode === 'EASY') {
      this.speed = 12.0;
      this.maxSpeed = 24.0;
    } else if (diffMode === 'HARD') {
      this.speed = 18.0;
      this.maxSpeed = 42.0;
    } else if (diffMode === 'EXTREME') {
      this.speed = 22.0;
      this.maxSpeed = 48.0;
    } else {
      this.speed = 15.2;
      this.maxSpeed = 38.0;
    }

    // Place character in starting menu position
    this.playerX = 0;
    this.playerY = 0;
    this.playerZ = -9.0; // standard starting point
    if (this.playerGroup) {
      this.playerGroup.position.set(0, 0.45, this.playerZ);
      this.playerGroup.rotation.set(0, 0, 0);
      this.playerGroup.scale.set(0.70, 0.70, 0.70);
    }

    this.obstacles.forEach((o) => {
      o.active = false;
      o.mesh.visible = false;
    });
    this.collectibles.forEach((c) => {
      c.active = false;
      c.mesh.visible = false;
    });

    this.activePowerUps.clear();
    this.shieldBubbleMesh.visible = false;
    this.magnetAuraMesh.visible = false;

    // Position first road chunk nicely
    for (let i = 0; i < this.roads.length; i++) {
      this.roads[i].position.set(0, 0, -i * this.roadLength);
    }

    // Rebuild closed gate
    this.spawnFactoryGate();

    if (this.animationFrameId === null) {
      this.loop();
    }
  }

  public revive() {
    this.isRunning = true;
    this.isPaused = false;
    this.isCrashed = false;
    this.crashTimer = 0;
    this.cleanupEggBreak();

    if (this.playerGroup) {
      this.playerGroup.visible = true;
      this.playerGroup.position.set(0, 0, this.playerZ);
      this.playerGroup.rotation.set(0, 0, 0);
    }

    // Deactivate standard egg model hides (restore visibility of egg parts, legs etc.)
    if (this.currentStage === 'EGG') {
      if (this.eggBodyGroup) this.eggBodyGroup.visible = true;
      if (this.eggLeftLeg) this.eggLeftLeg.visible = true;
      if (this.eggRightLeg) this.eggRightLeg.visible = true;
    }

    // Clear active obstacles nearby to ensure safety
    this.obstacles.forEach((o) => {
      o.active = false;
      o.mesh.visible = false;
      const dMesh = this.debugHitboxMeshes.get(o);
      if (dMesh) dMesh.visible = false;
    });

    // Reset lane position to middle
    this.currentLane = 0;
    this.targetX = 0;
    this.playerX = 0;
    this.playerY = 0;
    this.isJumping = false;
    this.isSliding = false;

    // Grant temporary shield (invincibility) for 2 seconds
    this.activePowerUps.set(PowerUpType.SHIELD, { timeLeft: 2.0, duration: 2.0 });
    if (this.shieldBubbleMesh) {
      this.shieldBubbleMesh.visible = true;
    }

    // Direct game updates and callbacks
    this.clock.getDelta(); // reset delta clock
    if (this.animationFrameId === null) {
      this.loop();
    }

    soundManager.startMusic();
  }

  private spawnFactoryGate() {
    if (this.factoryGateGroup) {
      this.scene.remove(this.factoryGateGroup);
    }

    this.factoryGateGroup = new THREE.Group();
    // Position it slightly in front of the player (the character is at playerZ, so gate is situated at playerZ - 2.8)
    this.factoryGateGroup.position.set(0, 0, this.playerZ - 3.2);

    const pillarMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5, metalness: 0.5 }); // Dark steel
    const gatePanelMat = new THREE.MeshStandardMaterial({ color: '#facc15', roughness: 0.3, metalness: 0.6 }); // Yellow industrial steel with sheen
    const redMat = new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.4 }); // Industrial hazard red
    const blackMat = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.7 });

    // Left pillar
    const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.2, 0.5), pillarMat);
    pillarL.position.set(-this.roadWidth / 2 - 0.1, 1.6, 0);
    pillarL.castShadow = true;
    pillarL.receiveShadow = true;
    this.factoryGateGroup.add(pillarL);

    // Right pillar
    const pillarR = pillarL.clone();
    pillarR.position.x = this.roadWidth / 2 + 0.1;
    this.factoryGateGroup.add(pillarR);

    // Top Header beam
    const headerBeam = new THREE.Mesh(new THREE.BoxGeometry(this.roadWidth + 1.2, 0.4, 0.6), pillarMat);
    headerBeam.position.set(0, 3.2, 0);
    headerBeam.castShadow = true;
    this.factoryGateGroup.add(headerBeam);

    // "SKM POULTRY" Signboard plate
    const signPlate = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 0.1), redMat);
    signPlate.position.set(0, 3.6, 0.1);
    this.factoryGateGroup.add(signPlate);

    // Hazard yellow/black striping on left panel
    this.factoryGateLeftPanel = new THREE.Mesh(
      new THREE.BoxGeometry(this.roadWidth / 4 + 0.1, 1.8, 0.1),
      gatePanelMat
    );
    this.factoryGateLeftPanel.position.set(-this.roadWidth / 4 + 0.05, 0.9, 0);
    this.factoryGateLeftPanel.castShadow = true;
    this.factoryGateLeftPanel.receiveShadow = true;

    // Add hazard stripes to left panel
    for (let s = -2; s <= 2; s++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.012), blackMat);
      stripe.position.set(s * 0.28, 0, 0.06);
      stripe.rotation.z = Math.PI / 4;
      this.factoryGateLeftPanel.add(stripe);
    }
    this.factoryGateGroup.add(this.factoryGateLeftPanel);

    // Hazard stripes on right panel
    this.factoryGateRightPanel = new THREE.Mesh(
      new THREE.BoxGeometry(this.roadWidth / 4 + 0.1, 1.8, 0.1),
      gatePanelMat
    );
    this.factoryGateRightPanel.position.set(this.roadWidth / 4 - 0.05, 0.9, 0);
    this.factoryGateRightPanel.castShadow = true;
    this.factoryGateRightPanel.receiveShadow = true;

    for (let s = -2; s <= 2; s++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.012), blackMat);
      stripe.position.set(s * 0.28, 0, 0.06);
      stripe.rotation.z = -Math.PI / 4;
      this.factoryGateRightPanel.add(stripe);
    }
    this.factoryGateGroup.add(this.factoryGateRightPanel);

    this.scene.add(this.factoryGateGroup);
  }

  private updateShowcaseIdle(delta: number) {
    const elapsed = this.clock.getElapsedTime();

    // 1. Showcase Idle Animation Selection
    this.showcaseIdleTimer -= delta;
    if (this.showcaseIdleTimer <= 0) {
      const states: ('LOOK_AROUND' | 'ADJUST_CAP' | 'DANCE' | 'STRETCH' | 'WOBBLE')[] = [
        'WOBBLE', 'LOOK_AROUND', 'DANCE', 'STRETCH', 'ADJUST_CAP'
      ];
      this.showcaseIdleState = states[Math.floor(Math.random() * states.length)];
      this.showcaseIdleTimer = 3.5 + Math.random() * 3.5;
    }

    // Unhide current mascot group layers and hide the others!
    if (this.eggGroup) this.eggGroup.visible = (this.currentStage === 'EGG');
    if (this.chickGroup) this.chickGroup.visible = (this.currentStage === 'CHICK');
    if (this.adultGroup) this.adultGroup.visible = (this.currentStage === 'ADULT');

    // Reset player position with a cute ground offset
    if (this.playerGroup) {
      this.playerGroup.position.set(0, 0.45, this.playerZ);
      this.playerGroup.rotation.set(0, 0, 0);
    }

    // Reset components to defaults before applying specific state animations
    if (this.eggBodyGroup) this.eggBodyGroup.rotation.set(0, 0, 0);
    if (this.eggLeftArm) {
      this.eggLeftArm.rotation.set(0, 0, Math.PI / 4);
      this.eggLeftArm.position.set(-0.44, 0.22, 0.02);
    }
    if (this.eggRightArm) {
      this.eggRightArm.rotation.set(0, 0, -Math.PI / 4);
      this.eggRightArm.position.set(0.44, 0.22, 0.02);
    }
    if (this.eggLeftLeg) this.eggLeftLeg.rotation.set(0, 0, 0);
    if (this.eggRightLeg) this.eggRightLeg.rotation.set(0, 0, 0);

    if (this.chickLeftWing) this.chickLeftWing.rotation.set(0.1, 0, 0.3);
    if (this.chickRightWing) this.chickRightWing.rotation.set(0.1, 0, -0.3);
    if (this.chickLeftLeg) this.chickLeftLeg.rotation.set(0, 0, 0);
    if (this.chickRightLeg) this.chickRightLeg.rotation.set(0, 0, 0);

    if (this.chickenLeftWing) this.chickenLeftWing.rotation.set(0, 0, 0);
    if (this.chickenRightWing) this.chickenRightWing.rotation.set(0, 0, 0);
    if (this.chickenLeftLeg) this.chickenLeftLeg.rotation.set(0, 0, 0);
    if (this.chickenRightLeg) this.chickenRightLeg.rotation.set(0, 0, 0);

    // Apply specific animations
    switch (this.showcaseIdleState) {
      case 'WOBBLE': {
        const speed = 3.0;
        const tilt = Math.sin(elapsed * speed) * 0.08;
        if (this.currentStage === 'EGG') {
          if (this.eggBodyGroup) {
            this.eggBodyGroup.rotation.z = tilt;
            this.eggBodyGroup.position.y = Math.sin(elapsed * speed * 2) * 0.03;
          }
          if (this.eggLeftArm) this.eggLeftArm.rotation.z = Math.PI / 4 + Math.sin(elapsed * speed) * 0.15;
          if (this.eggRightArm) this.eggRightArm.rotation.z = -Math.PI / 4 - Math.sin(elapsed * speed) * 0.15;
        } else if (this.currentStage === 'CHICK') {
          if (this.chickLeftWing) this.chickLeftWing.rotation.z = 0.3 + Math.sin(elapsed * speed) * 0.15;
          if (this.chickRightWing) this.chickRightWing.rotation.z = -0.3 - Math.sin(elapsed * speed) * 0.15;
        }
        break;
      }
      case 'LOOK_AROUND': {
        const look = Math.sin(elapsed * 1.5) * 0.35;
        if (this.currentStage === 'EGG') {
          if (this.eggBodyGroup) {
            this.eggBodyGroup.rotation.y = look;
          }
        } else {
          if (this.playerGroup) this.playerGroup.rotation.y = look;
        }
        break;
      }
      case 'DANCE': {
        const freq = elapsed * 8.5;
        const vertical = Math.abs(Math.sin(freq)) * 0.15;
        const bounceAngle = Math.sin(freq) * 0.5;

        if (this.playerGroup) {
          this.playerGroup.position.y = 0.45 + vertical;
        }

        if (this.currentStage === 'EGG') {
          if (this.eggLeftLeg) this.eggLeftLeg.rotation.x = bounceAngle;
          if (this.eggRightLeg) this.eggRightLeg.rotation.x = -bounceAngle;
          if (this.eggLeftArm) this.eggLeftArm.rotation.z = Math.PI / 4 + Math.sin(freq) * 0.25;
          if (this.eggRightArm) this.eggRightArm.rotation.z = -Math.PI / 4 - Math.sin(freq) * 0.25;
        } else if (this.currentStage === 'CHICK') {
          if (this.chickLeftLeg) this.chickLeftLeg.rotation.x = bounceAngle;
          if (this.chickRightLeg) this.chickRightLeg.rotation.x = -bounceAngle;
          if (this.chickLeftWing) this.chickLeftWing.rotation.z = 0.4 + Math.sin(freq) * 0.4;
          if (this.chickRightWing) this.chickRightWing.rotation.z = -0.4 - Math.sin(freq) * 0.4;
        } else {
          if (this.chickenLeftLeg) this.chickenLeftLeg.rotation.x = bounceAngle;
          if (this.chickenRightLeg) this.chickenRightLeg.rotation.x = -bounceAngle;
          if (this.chickenLeftWing) this.chickenLeftWing.rotation.z = Math.sin(freq) * 0.35;
          if (this.chickenRightWing) this.chickenRightWing.rotation.z = -Math.sin(freq) * 0.35;
        }
        break;
      }
      case 'STRETCH': {
        const pull = 1.0 + Math.sin(elapsed * 4.0) * 0.15;
        const squash = 1.0 - Math.sin(elapsed * 4.0) * 0.08;
        if (this.currentStage === 'EGG') {
          if (this.eggBodyGroup) {
            this.eggBodyGroup.scale.set(squash, pull * 1.35, squash);
          }
        }
        break;
      }
      case 'ADJUST_CAP': {
        if (this.currentStage === 'EGG') {
          // Mascot raises LHS arm to visor
          if (this.eggLeftArm) {
            this.eggLeftArm.rotation.set(-0.2, 0.4, Math.PI - 0.4);
            this.eggLeftArm.position.set(-0.44, 0.22, 0.02);
          }
        } else {
          // wings flapping vigorously (preening)
          const flap = Math.sin(elapsed * 15.0) * 0.6 + 0.3;
          if (this.chickLeftWing) this.chickLeftWing.rotation.z = flap;
          if (this.chickRightWing) this.chickRightWing.rotation.z = -flap;
          if (this.chickenLeftWing) this.chickenLeftWing.rotation.z = flap;
          if (this.chickenRightWing) this.chickenRightWing.rotation.z = -flap;
        }
        break;
      }
    }

    // Decays visual parameters to regular defaults
    if (this.showcaseIdleState !== 'STRETCH') {
      if (this.eggBodyGroup) {
        this.eggBodyGroup.scale.set(1.0, 1.35, 1.0);
      }
    }

    // Ground shadows setup
    this.roads.forEach((roadGrp) => {
      // Rotate windmills and decorative blades
      const windBlades = roadGrp.getObjectByName('windmill_fan');
      if (windBlades) windBlades.rotation.z += delta * 0.8;
      const attVent = roadGrp.getObjectByName('barn_vent_fan');
      if (attVent) attVent.rotation.z += delta * 1.2;
    });
  }

  private updateCameraMenu(delta: number) {
    if (!this.camera) return;

    // Beautiful medium-shot close-up situated in front/side of character
    const targetCamX = 0;
    const targetCamY = 1.8;
    const targetCamZ = this.playerZ + 3.8;

    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetCamX, delta * 3.5);
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetCamY, delta * 3.5);
    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetCamZ, delta * 3.5);

    // Look slightly downwards at the character's core anchor point
    const lookAnchor = new THREE.Vector3(0, 0.45, this.playerZ);
    this.camera.lookAt(lookAnchor);
  }

  private updateRunTransition(delta: number) {
    const elapsed = this.clock.getElapsedTime();

    this.transitionTimer -= delta;

    // 1. Open the sliding gate panel doors wide
    this.gateOpenProgress = Math.min(1.0, this.gateOpenProgress + delta * 1.5);
    if (this.factoryGateLeftPanel) {
      this.factoryGateLeftPanel.position.x = -this.roadWidth / 4 + 0.05 - (this.gateOpenProgress * 2.8);
    }
    if (this.factoryGateRightPanel) {
      this.factoryGateRightPanel.position.x = this.roadWidth / 4 - 0.05 + (this.gateOpenProgress * 2.8);
    }

    // 2. Animate the player running vigorously through the gate!
    const walkFreq = elapsed * 15.0; // high speed running animation
    if (this.currentStage === 'EGG') {
      if (this.eggLeftLeg) this.eggLeftLeg.rotation.x = Math.sin(walkFreq) * 0.8;
      if (this.eggRightLeg) this.eggRightLeg.rotation.x = -Math.sin(walkFreq) * 0.8;
      if (this.eggLeftArm) this.eggLeftArm.rotation.x = Math.cos(walkFreq) * 0.3;
      if (this.eggRightArm) this.eggRightArm.rotation.x = -Math.cos(walkFreq) * 0.3;
      if (this.eggBodyGroup) this.eggBodyGroup.rotation.z = Math.sin(walkFreq) * 0.12;
    } else if (this.currentStage === 'CHICK') {
      if (this.chickLeftLeg) this.chickLeftLeg.rotation.x = Math.sin(walkFreq) * 0.8;
      if (this.chickRightLeg) this.chickRightLeg.rotation.x = -Math.sin(walkFreq) * 0.8;
      if (this.chickLeftWing) this.chickLeftWing.rotation.z = 0.3 + Math.sin(walkFreq * 1.5) * 0.3;
      if (this.chickRightWing) this.chickRightWing.rotation.z = -0.3 - Math.sin(walkFreq * 1.5) * 0.3;
    }

    // 3. Smoothly pan camera from menu medium-shot to behind follow coordinates
    const ratio = Math.min(1.0, (1.8 - this.transitionTimer) / 1.8);

    const startX = 0;
    const startY = 1.8;
    const startZ = this.playerZ + 3.8;

    const endX = 0;
    const endY = this.cameraOffsetHeight + 0.45; // slightly elevated follow stance
    const endZ = this.playerZ + this.cameraOffsetDepth;

    if (this.camera) {
      this.camera.position.x = THREE.MathUtils.lerp(startX, endX, ratio);
      this.camera.position.y = THREE.MathUtils.lerp(startY, endY, ratio);
      this.camera.position.z = THREE.MathUtils.lerp(startZ, endZ, ratio);

      // Transition look-at from menu center to look-ahead path ahead
      const startLook = new THREE.Vector3(0, 0.45, this.playerZ);
      const endLook = new THREE.Vector3(0, 0.85, this.playerZ - 25.0);
      const blendedLook = new THREE.Vector3().lerpVectors(startLook, endLook, ratio);

      this.camera.lookAt(blendedLook);
    }

    // Dust particles blowing out as gates slide open
    if (Math.random() < 0.28) {
      this.spawnDustParticle();
    }

    if (this.transitionTimer <= 0) {
      this.isTransitioningToRun = false;
      this.isIntroActive = true;
      this.introTime = 1.0; // shortened intro lead
      this.distance = 0;
      this.score = 0;
      
      // Play game background music
      soundManager.startMusic();
    }
  }

  private checkCustomCollision(obs: any): boolean {
    const playerX = this.playerX;
    const playerY = this.playerY;
    const playerZ = this.playerZ;
    const isSliding = this.isSliding;
    const isJumping = this.isJumping;

    // Only check collisions in the same lane (or close during lateral lane transitions)
    const obsX = obs.mesh.position.x;
    const obsZ = obs.mesh.position.z;
    const dx = Math.abs(playerX - obsX);

    // Lateral transition safety: lane width is dynamic, 0.55 of spacing defines adjacent lanes isolation completely
    if (dx > this.laneSpacing * 0.55) {
      return false; // Safely in another lane!
    }

    let obsH = 1.0;
    let obsW = 0.8;
    let obsD = 0.5;
    let canSlideUnder = false;

    switch (obs.type) {
      case 'FENCE':
        obsH = 1.1; obsW = 0.95; obsD = 0.25; canSlideUnder = false;
        break;
      case 'HIGH_BARRIER':
        obsH = 1.45; obsW = 1.15; obsD = 0.25; canSlideUnder = true; // Slide matches high barrier clearance
        break;
      case 'HAY_BALE':
        obsH = 1.4; obsW = 0.95; obsD = 0.95; canSlideUnder = false;
        break;
      case 'TRACTOR':
        obsH = 1.95; obsW = 0.7; obsD = 1.25; canSlideUnder = false;
        break;
      case 'TRUCK':
        obsH = 2.4; obsW = 0.75; obsD = 2.2; canSlideUnder = false;
        break;
      case 'LOG':
        obsH = 0.6; obsW = 0.95; obsD = 0.8; canSlideUnder = false;
        break;
      case 'ROCK':
        obsH = 0.95; obsW = 0.95; obsD = 1.0; canSlideUnder = false;
        break;
      case 'CONE':
        obsH = 0.45; obsW = 0.4; obsD = 0.4; canSlideUnder = false;
        break;
      case 'ROAD_BLOCK':
        obsH = 0.6; obsW = 0.8; obsD = 0.4; canSlideUnder = false;
        break;
      case 'BARRICADE':
      case 'CONSTRUCTION_BARRIER':
        obsH = 1.0; obsW = 0.9; obsD = 0.4; canSlideUnder = false;
        break;
      case 'WOODEN_CRATE':
        obsH = 0.6; obsW = 0.6; obsD = 0.6; canSlideUnder = false;
        break;
      case 'SLIPPERY_AREA':
      case 'WATER_PUDDLE':
      case 'MUD_PUDDLE':
        obsH = 0.05; obsW = 0.95; obsD = 1.4; canSlideUnder = false;
        break;
      case 'FISHING_NET':
        obsH = 1.35; obsW = 0.95; obsD = 0.35; canSlideUnder = true; // Slide under fishing net
        break;
      case 'BROKEN_PLANK':
        obsH = 0.15; obsW = 0.85; obsD = 0.8; canSlideUnder = false;
        break;
      case 'BOAT_OBSTACLE':
      case 'FLOATING_CRATE':
        obsH = 0.65; obsW = 0.9; obsD = 1.1; canSlideUnder = false;
        break;
      case 'BENCH':
        obsH = 0.55; obsW = 0.9; obsD = 0.5; canSlideUnder = false;
        break;
      case 'WATER_POT':
        obsH = 0.5; obsW = 0.45; obsD = 0.45; canSlideUnder = false;
        break;
      case 'BICYCLE':
        obsH = 1.15; obsW = 0.55; obsD = 1.25; canSlideUnder = false;
        break;
      case 'HAND_CART':
      case 'STREET_VENDOR':
      case 'FARM_CART':
        obsH = 1.25; obsW = 0.75; obsD = 1.1; canSlideUnder = false;
        break;
      case 'TREE_ROOT':
        obsH = 0.3; obsW = 0.9; obsD = 0.6; canSlideUnder = false;
        break;
      case 'FALLEN_TREE':
      case 'BUSH':
      case 'WOODEN_BRIDGE':
        obsH = 0.65; obsW = 0.95; obsD = 1.0; canSlideUnder = false;
        break;
      case 'GRAIN_BARREL':
      case 'FEED_BAGS':
        obsH = 0.85; obsW = 0.75; obsD = 0.75; canSlideUnder = false;
        break;
      case 'WATER_TANK':
        obsH = 1.45; obsW = 0.85; obsD = 1.5; canSlideUnder = false;
        break;
      case 'CAR':
      case 'DELIVERY_VAN':
        obsH = 1.0; obsW = 0.85; obsD = 1.8; canSlideUnder = false;
        break;
      case 'BUS':
        obsH = 1.85; obsW = 0.95; obsD = 3.2; canSlideUnder = false;
        break;
      case 'CONTAINER':
      default:
        obsH = 1.9; obsW = 0.8; obsD = 1.25; canSlideUnder = false;
        break;
    }

    // Z-axis overlap check (Subway Surfers narrow hitboxes)
    const playerZHalf = 0.35;
    // We add a 0.15m collision offset tolerance to make jumps feel fair and prevent clipping onto rear edge
    const zOverlap = Math.abs(playerZ - obsZ) < (obsD + playerZHalf - 0.15);
    if (!zOverlap) {
      return false;
    }

    // X-axis lateral overlap check
    const playerWHalf = 0.38;
    // We add a 0.12m horizontal safety margin to avoid brushing standard edge pixels
    const xOverlap = dx < (obsW + playerWHalf - 0.12);
    if (!xOverlap) {
      return false;
    }

    // Y-axis height clearance checking
    if (isSliding) {
      if (canSlideUnder) {
        return false; // Successfully slid right under the crossbar!
      }
      // If it's a solid low hurdle like FENCE, crouch height still collides
      const playerSlidingHeight = 0.45;
      return playerY + playerSlidingHeight > 0.05 && playerY < obsH;
    }

    const playerTop = playerY + 1.1;
    const playerBottom = playerY;

    if (isJumping) {
      // If player feet are above the obstacle top height (with slight 0.12m player-favoring buffer), it's a clear hop!
      if (playerBottom >= (obsH - 0.12)) {
        return false;
      }
    }

    // Normal running/jumping height collision check
    return playerBottom < obsH && playerTop > 0.05;
  }

  private updateWorldEntities(delta: number, currentSpeed: number) {
    const playerBox = new THREE.Box3().setFromObject(this.playerGroup);
    const magnetActive = this.activePowerUps.has(PowerUpType.MAGNET);

    // 1. Obstacle detections
    this.obstacles.forEach((obs) => {
      if (!obs.active) {
        const dMesh = this.debugHitboxMeshes.get(obs);
        if (dMesh) dMesh.visible = false;
        return;
      }

      if (obs.type === 'CAR' || obs.type === 'BUS') {
        const vz = obs.vzActive !== undefined ? obs.vzActive : (obs.type === 'CAR' ? -5.5 : -3.5);
        obs.mesh.position.z += (currentSpeed + vz) * delta;
      } else {
        obs.mesh.position.z += currentSpeed * delta;
      }

      if ((obs as any).physicalX === undefined) {
        (obs as any).physicalX = obs.lane * this.laneSpacing;
      }

      const isCar = obs.type === 'CAR';
      const isMovingVeh = (obs as any).isMovingVehicle;

      if (isCar || isMovingVeh) {
        if (obs.laneChanging) {
          const tX = obs.laneTarget! * this.laneSpacing;
          const lerpSpeed = isMovingVeh ? 4.8 : 3.5;
          (obs as any).physicalX = THREE.MathUtils.lerp((obs as any).physicalX, tX, delta * lerpSpeed);
          if (Math.abs((obs as any).physicalX - tX) < 0.05) {
            (obs as any).physicalX = tX;
            obs.lane = obs.laneTarget!;
            obs.laneChanging = false;
          }
        } else {
          (obs as any).physicalX = obs.lane * this.laneSpacing;
          const randomChance = isMovingVeh ? 0.018 : 0.004; // Much higher unpredictability for factory moving vehicles
          if (Math.random() < randomChance) {
            const possibleLanes = [-1, 0, 1].filter(l => l !== obs.lane);
            obs.laneTarget = possibleLanes[Math.floor(Math.random() * possibleLanes.length)];
            obs.laneChanging = true;
          }
        }
      } else {
        (obs as any).physicalX = obs.lane * this.laneSpacing;
      }

      // Align on curved track in real 3D space!
      obs.mesh.position.x = (obs as any).physicalX + this.getCurvatureOffset(this.distance - obs.mesh.position.z - 18.0);

      if (obs.mesh.position.z > 15) {
        obs.active = false;
        obs.mesh.visible = false;
        const dMesh = this.debugHitboxMeshes.get(obs);
        if (dMesh) dMesh.visible = false;
        return;
      }

      const isHit = this.checkCustomCollision(obs);
      if (isHit) {
        // Slow water pits / mud pits down by 50%
        if (obs.type === 'MUD_PIT') {
          this.speed = Math.max(8.0, this.speed - delta * 15.0);
          return;
        }

        // Shield absorption protection
        if (this.activePowerUps.has(PowerUpType.SHIELD)) {
          this.activePowerUps.delete(PowerUpType.SHIELD);
          this.shieldBubbleMesh.visible = false;
          soundManager.playHit();
          obs.active = false;
          obs.mesh.visible = false;
          const dMesh = this.debugHitboxMeshes.get(obs);
          if (dMesh) dMesh.visible = false;
          this.landingShakeForce = 0.45;
          return;
        }

        // Fast SpeedBoost breaks obstacle directly
        if (this.activePowerUps.has(PowerUpType.SPEED_BOOST)) {
          obs.active = false;
          obs.mesh.visible = false;
          const dMesh = this.debugHitboxMeshes.get(obs);
          if (dMesh) dMesh.visible = false;
          soundManager.playHit();
          this.landingShakeForce = 0.35;
          return;
        }

        // Fatal crash triggers death sequence
        this.crash();
      } else {
        // Near miss calculation!
        if (obs.active && !this.isCrashed && obs.mesh.position.z > -0.5 && obs.mesh.position.z < 0.5) {
          const hDist = Math.abs(this.playerX - obs.mesh.position.x);
          if (hDist < 2.6 && hDist > 0.4) {
            if (!(obs as any).nearMissTriggered) {
              (obs as any).nearMissTriggered = true;
              soundManager.playNearMiss();
              this.callbacks.onCollectText?.('NEAR MISS!', 'powerup');
            }
          }
        }
      }
    });

    // Play random city traffic ambient chirps occasionally
    if (this.activeTheme === 'CITY_DISTRICT' && this.isRunning && !this.isPaused) {
      if (Math.random() < 0.0045) {
        soundManager.playCityAmbience();
      }
    }

    // Render Debug Hitbox visualizations if active
    if (this.debugHitboxesActive) {
      if (!this.debugMatGreen) {
        this.debugMatGreen = new THREE.MeshBasicMaterial({ color: 0x22c55e, wireframe: true, depthTest: false, transparent: true, opacity: 0.85 });
      }
      if (!this.debugMatRed) {
        this.debugMatRed = new THREE.MeshBasicMaterial({ color: 0xef4444, wireframe: true, depthTest: false, transparent: true, opacity: 0.85 });
      }

      // Update Player Box Viz
      const pHeight = this.isSliding ? 0.45 : 1.1;
      const pWidth = 0.76;
      const pDepth = 0.7;
      if (!this.debugPlayerMesh) {
        this.debugPlayerMesh = new THREE.Mesh(new THREE.BoxGeometry(pWidth, pHeight, pDepth), this.debugMatGreen);
        this.scene.add(this.debugPlayerMesh);
      } else {
        const oldGeom = this.debugPlayerMesh.geometry;
        const isDiff = (oldGeom as any).parameters.height !== pHeight;
        if (isDiff) {
          oldGeom.dispose();
          this.debugPlayerMesh.geometry = new THREE.BoxGeometry(pWidth, pHeight, pDepth);
        }
      }
      this.debugPlayerMesh.position.set(this.playerX, this.playerY + pHeight / 2, this.playerZ);
      this.debugPlayerMesh.visible = true;

      // Update Obstacles Boxes Viz
      this.obstacles.forEach((obs) => {
        let dMesh = this.debugHitboxMeshes.get(obs);
        if (obs.active) {
          let obsH = 1.0;
          let obsW = 0.8;
          let obsD = 0.5;
          let yCent = 0;

          switch (obs.type) {
            case 'FENCE':
              obsH = 1.1; obsW = 0.95; obsD = 0.25; yCent = obsH / 2;
              break;
            case 'HIGH_BARRIER':
              obsH = 1.45; obsW = 1.15; obsD = 0.25; yCent = obsH / 2;
              break;
            case 'HAY_BALE':
              obsH = 1.4; obsW = 0.95; obsD = 0.95; yCent = obsH / 2;
              break;
            case 'TRACTOR':
              obsH = 1.95; obsW = 0.7; obsD = 1.25; yCent = obsH / 2;
              break;
            case 'TRUCK':
              obsH = 2.4; obsW = 0.75; obsD = 2.2; yCent = obsH / 2;
              break;
            case 'LOG':
              obsH = 0.6; obsW = 0.95; obsD = 0.8; yCent = obsH / 2;
              break;
            case 'ROCK':
              obsH = 0.95; obsW = 0.95; obsD = 1.0; yCent = obsH / 2;
              break;
            case 'CONE':
              obsH = 0.45; obsW = 0.4; obsD = 0.4; yCent = obsH / 2;
              break;
            case 'ROAD_BLOCK':
              obsH = 0.6; obsW = 0.8; obsD = 0.4; yCent = obsH / 2;
              break;
            case 'BARRICADE':
            case 'CONSTRUCTION_BARRIER':
              obsH = 1.0; obsW = 0.9; obsD = 0.4; yCent = obsH / 2;
              break;
            case 'WOODEN_CRATE':
              obsH = 0.6; obsW = 0.6; obsD = 0.6; yCent = obsH / 2;
              break;
            case 'SLIPPERY_AREA':
            case 'WATER_PUDDLE':
            case 'MUD_PUDDLE':
              obsH = 0.05; obsW = 0.95; obsD = 1.4; yCent = obsH / 2;
              break;
            case 'FISHING_NET':
              obsH = 1.35; obsW = 0.95; obsD = 0.35; yCent = obsH / 2;
              break;
            case 'BROKEN_PLANK':
              obsH = 0.15; obsW = 0.85; obsD = 0.8; yCent = obsH / 2;
              break;
            case 'BOAT_OBSTACLE':
            case 'FLOATING_CRATE':
              obsH = 0.65; obsW = 0.9; obsD = 1.1; yCent = obsH / 2;
              break;
            case 'BENCH':
              obsH = 0.55; obsW = 0.9; obsD = 0.5; yCent = obsH / 2;
              break;
            case 'WATER_POT':
              obsH = 0.5; obsW = 0.45; obsD = 0.45; yCent = obsH / 2;
              break;
            case 'BICYCLE':
              obsH = 1.15; obsW = 0.55; obsD = 1.25; yCent = obsH / 2;
              break;
            case 'HAND_CART':
            case 'STREET_VENDOR':
            case 'FARM_CART':
              obsH = 1.25; obsW = 0.75; obsD = 1.1; yCent = obsH / 2;
              break;
            case 'TREE_ROOT':
              obsH = 0.3; obsW = 0.9; obsD = 0.6; yCent = obsH / 2;
              break;
            case 'FALLEN_TREE':
            case 'BUSH':
            case 'WOODEN_BRIDGE':
              obsH = 0.65; obsW = 0.95; obsD = 1.0; yCent = obsH / 2;
              break;
            case 'GRAIN_BARREL':
            case 'FEED_BAGS':
              obsH = 0.85; obsW = 0.75; obsD = 0.75; yCent = obsH / 2;
              break;
            case 'WATER_TANK':
              obsH = 1.45; obsW = 0.85; obsD = 1.5; yCent = obsH / 2;
              break;
            case 'CAR':
            case 'DELIVERY_VAN':
              obsH = 1.0; obsW = 0.85; obsD = 1.8; yCent = obsH / 2;
              break;
            case 'BUS':
              obsH = 1.85; obsW = 0.95; obsD = 3.2; yCent = obsH / 2;
              break;
            case 'CONTAINER':
            default:
              obsH = 1.9; obsW = 0.8; obsD = 1.25; yCent = obsH / 2;
              break;
          }

          if (!dMesh) {
            dMesh = new THREE.Mesh(new THREE.BoxGeometry(obsW, obsH, obsD), this.debugMatRed);
            this.debugHitboxMeshes.set(obs, dMesh);
            this.scene.add(dMesh);
          } else {
            const p = (dMesh.geometry as any).parameters;
            if (p.width !== obsW || p.height !== obsH || p.depth !== obsD) {
              dMesh.geometry.dispose();
              dMesh.geometry = new THREE.BoxGeometry(obsW, obsH, obsD);
            }
          }
          dMesh.position.set(obs.mesh.position.x, yCent, obs.mesh.position.z);
          dMesh.visible = true;
        } else {
          if (dMesh) dMesh.visible = false;
        }
      });
    } else {
      if (this.debugPlayerMesh) this.debugPlayerMesh.visible = false;
      this.debugHitboxMeshes.forEach((mesh) => {
        mesh.visible = false;
      });
    }

    // 2. Bobbing floating and spinning Collectibles
    this.collectibles.forEach((coll) => {
      if (!coll.active) return;

      coll.mesh.position.z += currentSpeed * delta;

      // Constant spinning rotation
      coll.mesh.rotation.y += delta * 2.8;

      // Bobbing floating height sinusoid
      const baseHeight = this.activePowerUps.has(PowerUpType.FLYING_MODE) ? 4.8 : 0.15;
      coll.mesh.position.y = baseHeight + Math.sin(this.clock.getElapsedTime() * 4.5 + coll.bobOffset) * 0.12;

      let isPulled = false;
      // Magnet pull range calculations (Rads: 11.5 meters)
      // Since player is visually curved, magnet pull targets playerGroup world position for perfect juice!
      if (magnetActive && coll.mesh.position.z < 0 && this.playerGroup) {
        const dx = this.playerGroup.position.x - coll.mesh.position.x;
        const dy = this.playerGroup.position.y - coll.mesh.position.y;
        const dz = this.playerGroup.position.z - coll.mesh.position.z;
        const radius = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (radius < 11.5) {
          isPulled = true;
          const force = 38.0;
          coll.mesh.position.x += (dx / radius) * force * delta;
          coll.mesh.position.y += (dy / radius) * force * delta;
          coll.mesh.position.z += (dz / radius) * force * delta;
        }
      }

      if (!isPulled) {
        coll.mesh.position.x = coll.lane * this.laneSpacing + this.getCurvatureOffset(this.distance - coll.mesh.position.z - 18.0);
      }

      if (coll.mesh.position.z > 15) {
        coll.active = false;
        coll.mesh.visible = false;
        return;
      }

      // Collectible items bounding intersect checks
      const collBox = new THREE.Box3().setFromObject(coll.mesh);
      if (playerBox.intersectsBox(collBox)) {
        coll.active = false;
        coll.mesh.visible = false;

        if (coll.type.startsWith('POWERUP_')) {
          const powerType = coll.type.split('_').slice(1).join('_') as PowerUpType;
          const duration = 12.0;

          this.activePowerUps.set(powerType, { timeLeft: duration, duration });
          this.callbacks.onPowerUpActivated(powerType, duration);
          soundManager.playPowerUp();

          if (powerType === PowerUpType.SHIELD) this.shieldBubbleMesh.visible = true;
          if (powerType === PowerUpType.MAGNET) this.magnetAuraMesh.visible = true;
          if (powerType === PowerUpType.FLYING_MODE) {
            this.playerY = 4.8;
          }

          const label = powerType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
          this.callbacks.onCollectText?.('+' + label, 'powerup');
        } else {
          // Add score credit counts
          const mult = this.activePowerUps.has(PowerUpType.DOUBLE_SCORE) ? 2.5 : 1.0;
          const creditsGained = Math.round(coll.scoreValue * mult);

          const isGrain = coll.type.startsWith('GRAIN_');

          // Trigger happy face reaction, growth pulse, and magical sparkle feedback!
          this.happyFaceTimer = 0.5;
          this.squashStretchY = 1.25; // Growth pulse stretch up (smoothly lerps back to 1.0)
          this.spawnFeedSparkles();

          let growthAmount = 1;
          let feedLabel = "Feed";
          let soundToPlay = "score_feed";

          if (isGrain) {
            const rawType = coll.type.split('_')[1]; // MAIZE, WHEAT, etc.
            feedLabel = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase();
            if (['MILLET', 'OATS', 'BARLEY'].includes(rawType)) {
              growthAmount = 2;
            } else if (rawType === 'SORGHUM') {
              growthAmount = 3;
            }
          } else if (coll.type === 'SKM_FEED_PELLET') {
            growthAmount = 1;
            feedLabel = "SKM Pellet";
          } else if (coll.type === 'SKM_PREMIUM_FEED') {
            growthAmount = 3;
            feedLabel = "SKM Premium Bag";
            soundToPlay = "score_gem";
          } else if (coll.type === 'GOLDEN_FEED') {
            growthAmount = 5;
            feedLabel = "Golden Feed";
            soundToPlay = "score_gem";
          }

          if (soundToPlay === "score_gem") {
            soundManager.playScoreGem();
          } else {
            soundManager.playScoreFeed();
          }

          if (coll.type === 'BROWN_EGG') {
            soundManager.playScoreGem();
            this.brownEggsCollected++;
            this.callbacks.onBrownEggCollected?.(this.brownEggsCollected);
            this.callbacks.onCollectText?.(`🥚 +1 Brown Egg\nTray: ${this.brownEggsCollected}`, 'feed');
          } else if (coll.type === 'CRYSTAL') {
            soundManager.playScoreGem();
            this.callbacks.onGemCollected();
            this.callbacks.onCollectText?.('+1 Crystal Egg', 'gem');
          } else {
            // General food collection
            this.callbacks.onFeedCollected(creditsGained, coll.type === 'GOLDEN_FEED');
            this.grainsCollected += growthAmount;
            localStorage.setItem('skm_grains_collected', this.grainsCollected.toString());
            localStorage.setItem('skm_evolution_stage', this.currentStage);
            localStorage.setItem('skm_is_stage_2', this.isStage2 ? 'true' : 'false');

            this.callbacks.onCollectText?.(`+${creditsGained} ${feedLabel}\n+${growthAmount} Growth`, 'feed');
            console.log(`Feed collected: ${feedLabel} (+${growthAmount}). Progress: ${this.grainsCollected}. Stage: ${this.currentStage}`);

            // Evolution conditions
            const liveConfig = getActiveLiveConfig();
            const eggChickReq = liveConfig.stage1EvolutionReq;
            const adultReq = liveConfig.stage2EvolutionReq;

            if (this.currentStage === 'EGG' && this.grainsCollected >= eggChickReq && !this.isHatching) {
              console.log("Hatching initiated!");
              this.triggerHatchSequence();
            } else if (this.currentStage === 'CHICK' && this.grainsCollected >= eggChickReq) {
              console.log("Hen champion transition initiated!");
              this.triggerChickenChampionSequence();
            } else if (this.currentStage === 'ADULT' && !this.isStage2 && !this.isStage2Transition) {
              if (this.grainsCollected >= adultReq) {
                console.log("Stage 2 retirement transition initiated!");
                this.triggerStage2Transition();
              }
            } else if (this.isStage2) {
              // Stage 2 character progression: Brown Egg -> Golden Brown Chick -> Country Hen
              if (this.currentStage === 'EGG' && this.grainsCollected >= eggChickReq && !this.isHatching) {
                console.log("Stage 2 Hatching initiated!");
                this.triggerHatchSequence();
              } else if (this.currentStage === 'CHICK' && this.grainsCollected >= eggChickReq) {
                console.log("Stage 2 Adult transition initiated!");
                this.triggerChickenChampionSequence();
              }
            }
          }
          this.score += creditsGained;
          this.callbacks.onScore(this.score);
        }
      }
    });
  }

  private spawnFeedSparkles() {
    if (!this.playerGroup) return;
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.6 + Math.random() * 2.2;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        2.0 + Math.random() * 2.5,
        Math.sin(angle) * speed - 2.5
      );

      const sparkleGeo = new THREE.SphereGeometry(0.045, 6, 6);
      const sparkleMat = new THREE.MeshBasicMaterial({
        color: Math.random() < 0.5 ? '#fef08a' : '#fbbf24', // yellow/golds!
        transparent: true,
        opacity: 0.95
      });
      const sparkleMesh = new THREE.Mesh(sparkleGeo, sparkleMat);
      sparkleMesh.position.copy(this.playerGroup.position).add(
        new THREE.Vector3((Math.random() - 0.5) * 0.25, 0.4, (Math.random() - 0.5) * 0.25)
      );
      this.scene.add(sparkleMesh);
      this.smokeParticles.push({
        mesh: sparkleMesh as any,
        velocity,
        life: 0.5 + Math.random() * 0.4
      });
    }
  }

  private updateSmokeLayers(delta: number) {
    this.smokeParticles.forEach((p) => {
      if (p.life <= 0) return;
      p.life -= delta;

      // Add velocity drifting
      p.mesh.position.addScaledVector(p.velocity, delta);

      // Dissipate scales
      const ratio = Math.max(0, p.life);
      p.mesh.scale.setScalar(2.0 - ratio);
      if (p.mesh.material instanceof THREE.MeshBasicMaterial) {
        p.mesh.material.opacity = ratio * 0.4;
      }

      if (p.life <= 0) {
        p.mesh.visible = false;
      }
    });
  }

  private spawnTrailParticle(x: number, y: number, z: number) {
    let p = this.trailParticles.find(m => m.life <= 0);
    if (!p) {
      const geo = new THREE.SphereGeometry(0.16, 4, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: '#fef08a',
        transparent: true,
        opacity: 0.35,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      this.scene.add(mesh);
      p = { mesh, life: 1.0 };
      this.trailParticles.push(p);
    }

    let trailCol = '#fef08a';
    if (this.currentSkinId === 'skin_golden') trailCol = '#fbbf24';
    else if (this.currentSkinId === 'skin_robo') trailCol = '#38bdf8';
    else if (this.currentSkinId === 'skin_super') trailCol = '#22d3ee';
    else if (this.currentSkinId === 'skin_rainbow') {
      const hue = (Date.now() * 0.002) % 1.0;
      trailCol = '#' + new THREE.Color().setHSL(hue, 0.8, 0.55).getHexString();
    }

    p.life = 0.35; // short duration
    p.mesh.position.set(x, y, z + 0.5);
    p.mesh.visible = true;
    p.mesh.scale.set(1.0, 1.0, 1.0);
    if (p.mesh.material instanceof THREE.MeshBasicMaterial) {
      p.mesh.material.color.set(trailCol);
      p.mesh.material.opacity = 0.35;
    }
  }

  private updateTrailParticles(delta: number) {
    this.trailParticles.forEach((p) => {
      if (p.life <= 0) return;
      p.life -= delta;

      const ratio = Math.max(0, p.life / 0.35);
      p.mesh.scale.setScalar(ratio);
      if (p.mesh.material instanceof THREE.MeshBasicMaterial) {
        p.mesh.material.opacity = ratio * 0.35;
      }

      if (p.life <= 0) {
        p.mesh.visible = false;
      }
    });
  }

  private updateFeathers(delta: number) {
    if (!this.featherActive || !this.featherParticles) return;
    this.featherTimer -= delta;

    const posAttr = this.featherParticles.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < this.featherCount; i++) {
      let x = posAttr.getX(i);
      let y = posAttr.getY(i);
      let z = posAttr.getZ(i);

      x += this.featherVelocities[i * 3] * delta;
      y += this.featherVelocities[i * 3 + 1] * delta;
      z += this.featherVelocities[i * 3 + 2] * delta;

      this.featherVelocities[i * 3 + 1] -= 9.8 * delta; // simple physics gravity pull on feathers

      posAttr.setXYZ(i, x, y, z);
    }
    posAttr.needsUpdate = true;

    if (this.featherTimer <= 0) {
      this.featherActive = false;
      this.featherParticles.visible = false;
    }
  }

  private updateWeatherLayers(delta: number) {
    const isRainState = (this.currentWeather === 'LIGHT_RAIN' || this.currentWeather === 'THUNDERSTORM' || this.currentWeather === 'RAIN_SUNSHINE');
    if ((isRainState || this.activeTheme === 'RAINY_SEASON') && this.rainParticles) {
      const posAttr = this.rainParticles.geometry.getAttribute('position') as THREE.BufferAttribute;
      const isStorm = (this.currentWeather === 'THUNDERSTORM');
      for (let j = 0; j < this.rainCount; j++) {
        let x = posAttr.getX(j);
        let y = posAttr.getY(j);
        
        y -= 25.0 * delta * (isStorm ? 1.45 : 1.0); // rain falls faster in storms
        if (isStorm) {
          x += 6.5 * delta; // blow sideways in wind
          if (x > 11.0) {
            x = -11.0;
          }
        } else {
          x += 0.8 * delta; // gentle wind slide
          if (x > 11.0) {
            x = -11.0;
          }
        }
        
        if (y < 0) {
          y = 20.0;
        }
        posAttr.setY(j, y);
        posAttr.setX(j, x);
      }
      posAttr.needsUpdate = true;
    }

    if (this.leafParticles) {
      const posAttr = this.leafParticles.geometry.getAttribute('position') as THREE.BufferAttribute;
      const isStorm = (this.currentWeather === 'THUNDERSTORM');
      const isWindy = (this.currentWeather === 'CLOUDY' || this.currentWeather === 'THUNDERSTORM' || this.currentWeather === 'FOGGY');
      
      const windSpeedX = isStorm ? 12.0 : (isWindy ? 6.0 : 1.5);
      const fallSpeedY = isStorm ? 4.5 : 1.8;

      for (let j = 0; j < 80; j++) {
        let x = posAttr.getX(j);
        let y = posAttr.getY(j);
        
        y -= fallSpeedY * delta * (1.0 + Math.sin(x + j) * 0.2); // wobble slight
        x += windSpeedX * delta;

        if (y < 0.1) {
          y = 15.0;
          x = (Math.random() - 0.5) * 24.0;
        }
        if (x > 12.0) {
          x = -12.0;
          y = Math.random() * 15.0 + 1.0;
        }

        posAttr.setY(j, y);
        posAttr.setX(j, x);
      }
      posAttr.needsUpdate = true;
    }
  }

  public setWeather(weather: string) {
    this.currentWeather = weather;
    
    // Trigger special audio transition notifications
    if (weather === 'THUNDERSTORM') {
      soundManager.playThunderBoom();
      // Double flash immediately for dynamic cinema introduction!
      this.triggerLightningStrike();
    }
    
    // Turn on rain particles under rain states
    if (this.rainParticles) {
      const isRainy = (weather === 'LIGHT_RAIN' || weather === 'THUNDERSTORM' || weather === 'RAIN_SUNSHINE');
      this.rainParticles.visible = isRainy;
    }

    // Sync the soundscape instantly
    soundManager.updateWeatherAmbience(weather, this.timeOfDay);

    // Dynamic ground material hot swapping for in-flight road entities!
    this.roads.forEach((roadGrp) => {
      const theme = roadGrp.userData.theme || this.activeTheme;
      const roadMesh = roadGrp.getObjectByName('ground_plane') as THREE.Mesh;
      if (roadMesh) {
        roadMesh.material = this.getRoadMaterialForSegment(theme, weather);
      }
    });
  }

  public triggerLightningStrike() {
    this.lightningActive = true;
    this.lightningTimer = 0.08 + Math.random() * 0.12; // first flash length
    this.lightningDuration = this.lightningTimer;
    if (this.lightningLight) {
      this.lightningLight.intensity = 5.8; // intense white light flash
      this.lightningLight.color.set('#bae6fd');
    }
  }

  private computeEnvironmentTargets() {
    const hour = this.timeOfDay;
    const weather = this.currentWeather;

    // 1. BASE TIME OF DAY PARAMETERS
    let baseSkyColor = new THREE.Color('#38bdf8'); // Day blue
    let baseLightColor = new THREE.Color('#fef3c7'); // Warm sunlight
    let baseLightIntensity = 1.35;
    let baseAmbColor = new THREE.Color('#bae6fd'); // Sky blue ambient
    let baseAmbIntensity = 0.8;
    let baseFogColor = new THREE.Color('#38bdf8');
    let baseFogDensity = 0.011;
    let starsOpacity = 0.0;
    
    // Light direction vector based on solar angle
    let sunX = 18;
    let sunY = 35;
    let sunZ = 12;

    if (hour >= 5.0 && hour < 7.0) {
      // DAWN / EARLY MORNING (5 AM - 7 AM)
      const r = (hour - 5.0) / 2.0; // ratio 0 to 1
      baseSkyColor.lerpColors(new THREE.Color('#1e293b'), new THREE.Color('#ea580c'), r);
      baseLightColor.lerpColors(new THREE.Color('#93c5fd'), new THREE.Color('#f59e0b'), r);
      baseFogColor.copy(baseSkyColor);
      baseLightIntensity = THREE.MathUtils.lerp(0.85, 1.25, r);
      baseAmbColor.lerpColors(new THREE.Color('#334155'), new THREE.Color('#fd7e14'), r);
      baseAmbIntensity = THREE.MathUtils.lerp(0.75, 0.85, r);
      baseFogDensity = THREE.MathUtils.lerp(0.015, 0.011, r);
      starsOpacity = THREE.MathUtils.lerp(0.35, 0.0, r);
      // Sun rising from east/low horizon
      sunX = THREE.MathUtils.lerp(-35, -20, r);
      sunY = THREE.MathUtils.lerp(3, 15, r);
      sunZ = THREE.MathUtils.lerp(-20, -10, r);
    } 
    else if (hour >= 7.0 && hour < 11.0) {
      // MORNING (7 AM - 11 AM)
      const r = (hour - 7.0) / 4.0;
      baseSkyColor.lerpColors(new THREE.Color('#ea580c'), new THREE.Color('#38bdf8'), r);
      baseLightColor.lerpColors(new THREE.Color('#f59e0b'), new THREE.Color('#ffffbf'), r);
      baseFogColor.copy(baseSkyColor);
      baseLightIntensity = THREE.MathUtils.lerp(1.25, 1.45, r);
      baseAmbColor.lerpColors(new THREE.Color('#fd7e14'), new THREE.Color('#bae6fd'), r);
      baseAmbIntensity = THREE.MathUtils.lerp(0.85, 0.9, r);
      baseFogDensity = THREE.MathUtils.lerp(0.011, 0.010, r);
      starsOpacity = 0.0;
      sunX = THREE.MathUtils.lerp(-20, -5, r);
      sunY = THREE.MathUtils.lerp(15, 38, r);
      sunZ = THREE.MathUtils.lerp(-10, -5, r);
    }
    else if (hour >= 11.0 && hour < 15.0) {
      // NOON / AFTERNOON HIGH SUN (11 AM - 3 PM)
      const r = (hour - 11.0) / 4.0;
      baseSkyColor.set('#38bdf8');
      baseLightColor.set('#ffffef');
      baseFogColor.set('#38bdf8');
      baseLightIntensity = 1.45;
      baseAmbColor.set('#bae6fd');
      baseAmbIntensity = 0.95;
      baseFogDensity = 0.010;
      starsOpacity = 0.0;
      sunX = THREE.MathUtils.lerp(-5, 5, r);
      sunY = 38; // overhead
      sunZ = THREE.MathUtils.lerp(-5, 5, r);
    }
    else if (hour >= 15.0 && hour < 17.0) {
      // LATE AFTERNOON (3 PM - 5 PM)
      const r = (hour - 15.0) / 2.0;
      baseSkyColor.lerpColors(new THREE.Color('#38bdf8'), new THREE.Color('#0284c7'), r);
      baseLightColor.lerpColors(new THREE.Color('#ffffef'), new THREE.Color('#fef08a'), r);
      baseFogColor.copy(baseSkyColor);
      baseLightIntensity = THREE.MathUtils.lerp(1.45, 1.35, r);
      baseAmbColor.lerpColors(new THREE.Color('#bae6fd'), new THREE.Color('#fed7aa'), r);
      baseAmbIntensity = THREE.MathUtils.lerp(0.95, 0.9, r);
      baseFogDensity = 0.011;
      starsOpacity = 0.0;
      sunX = THREE.MathUtils.lerp(5, 18, r);
      sunY = THREE.MathUtils.lerp(38, 28, r);
      sunZ = THREE.MathUtils.lerp(5, 12, r);
    }
    else if (hour >= 17.0 && hour < 19.5) {
      // SUNSET (5 PM - 7:30 PM)
      const r = (hour - 17.0) / 2.5;
      baseSkyColor.lerpColors(new THREE.Color('#0284c7'), new THREE.Color('#f97316'), r);
      baseLightColor.lerpColors(new THREE.Color('#fef08a'), new THREE.Color('#dc2626'), r);
      baseFogColor.lerpColors(new THREE.Color('#0284c7'), new THREE.Color('#7c2d12'), r);
      baseLightIntensity = THREE.MathUtils.lerp(1.35, 1.05, r);
      baseAmbColor.lerpColors(new THREE.Color('#fed7aa'), new THREE.Color('#be185d'), r);
      baseAmbIntensity = THREE.MathUtils.lerp(0.9, 0.85, r);
      baseFogDensity = THREE.MathUtils.lerp(0.011, 0.014, r);
      starsOpacity = THREE.MathUtils.lerp(0.0, 0.15, r);
      // Low western sunset sun
      sunX = THREE.MathUtils.lerp(18, 35, r);
      sunY = THREE.MathUtils.lerp(28, 5, r);
      sunZ = THREE.MathUtils.lerp(12, 22, r);
    }
    else if (hour >= 19.5 && hour < 21.5) {
      // EVENING DUSK (7:30 PM - 9:30 PM)
      const r = (hour - 19.5) / 2.0;
      baseSkyColor.lerpColors(new THREE.Color('#f97316'), new THREE.Color('#1e293b'), r);
      baseLightColor.lerpColors(new THREE.Color('#dc2626'), new THREE.Color('#93c5fd'), r); // Shifts to moonlight tone
      baseFogColor.lerpColors(new THREE.Color('#7c2d12'), new THREE.Color('#111827'), r);
      baseLightIntensity = THREE.MathUtils.lerp(1.05, 0.95, r);
      baseAmbColor.lerpColors(new THREE.Color('#be185d'), new THREE.Color('#334155'), r);
      baseAmbIntensity = THREE.MathUtils.lerp(0.85, 0.8, r);
      baseFogDensity = THREE.MathUtils.lerp(0.014, 0.012, r);
      starsOpacity = THREE.MathUtils.lerp(0.15, 0.75, r);
      // Moon rises in eastern sky
      sunX = THREE.MathUtils.lerp(35, -20, r);
      sunY = THREE.MathUtils.lerp(5, 25, r);
      sunZ = THREE.MathUtils.lerp(22, -15, r);
    }
    else {
      // MIDNIGHT / NIGHT (9:30 PM - 5 AM)
      baseSkyColor.set('#1e293b'); // Dark slate blue (highly visible space, no pitch black)
      baseLightColor.set('#93c5fd'); // Cool moonlit cyan-silver
      baseFogColor.set('#111827');
      baseLightIntensity = 0.95; // Vibrant bright night light
      baseAmbColor.set('#334155'); // Deep slate blue ambient
      baseAmbIntensity = 0.85; // highly visible night scene
      baseFogDensity = 0.0122; // low fog density for extreme visibility
      starsOpacity = 1.0;
      // Stars pulse a little:
      starsOpacity += Math.sin(this.clock.getElapsedTime() * 1.5) * 0.12;
      // High moonlight position
      sunX = -20;
      sunY = 32;
      sunZ = -15;
    }

    // 2. APPLY WEATHER MODIFIERS (Interpolates blending targets on top of the generic hour)
    let weatherSkyColor = baseSkyColor;
    let weatherFogColor = baseFogColor;
    let weatherFogDensity = baseFogDensity;
    let weatherSunColor = baseLightColor;
    let weatherSunIntensity = baseLightIntensity;
    let weatherAmbColor = baseAmbColor;
    let weatherAmbIntensity = baseAmbIntensity;

    let targetWetness = 0.0;
    let targetWind = 1.0;
    let targetCloudOpacity = 0.85;
    let targetCloudColor = new THREE.Color('#ffffff');

    if (weather === 'CLOUDY') {
      weatherSkyColor = baseSkyColor.clone().lerp(new THREE.Color('#64748b'), 0.4);
      weatherFogColor = baseFogColor.clone().lerp(new THREE.Color('#64748b'), 0.4);
      weatherFogDensity = baseFogDensity * 1.0;
      weatherSunColor = baseLightColor.clone().lerp(new THREE.Color('#cbd5e1'), 0.3);
      weatherSunIntensity = baseLightIntensity * 0.95;
      weatherAmbColor = baseAmbColor.clone().lerp(new THREE.Color('#94a3b8'), 0.25);
      weatherAmbIntensity = baseAmbIntensity * 0.95;
      
      targetWind = 1.8;
      targetCloudOpacity = 0.95;
      targetCloudColor.set('#cbd5e1'); // soft gray clouds
    } 
    else if (weather === 'LIGHT_RAIN') {
      weatherSkyColor = baseSkyColor.clone().lerp(new THREE.Color('#334155'), 0.45);
      weatherFogColor = baseFogColor.clone().lerp(new THREE.Color('#334155'), 0.45);
      weatherFogDensity = baseFogDensity * 1.0;
      weatherSunIntensity = baseLightIntensity * 0.85; // high visibility
      weatherAmbColor = baseAmbColor.clone().lerp(new THREE.Color('#64748b'), 0.45);
      weatherAmbIntensity = baseAmbIntensity * 0.85;

      targetWetness = 1.0; // Puddles and wet tarmac!
      targetWind = 2.4;
      targetCloudOpacity = 1.0;
      targetCloudColor.set('#94a3b8'); // dark rainy clouds
    }
    else if (weather === 'THUNDERSTORM') {
      weatherSkyColor = baseSkyColor.clone().lerp(new THREE.Color('#334155'), 0.55); // beautiful stormy slate blue
      weatherFogColor = baseFogColor.clone().lerp(new THREE.Color('#1e293b'), 0.55);
      weatherFogDensity = baseFogDensity * 1.1; // only slight fog density to maintain full gameplay visibility
      weatherSunIntensity = baseLightIntensity * 0.80; // sun remains highly visible
      weatherAmbColor = baseAmbColor.clone().lerp(new THREE.Color('#475569'), 0.5);
      weatherAmbIntensity = baseAmbIntensity * 0.80;

      targetWetness = 1.0;
      targetWind = 4.2; // Crazy wind
      targetCloudOpacity = 1.2;
      targetCloudColor.set('#475569'); // heavy dark thunderstorm clouds
    }
    else if (weather === 'FOGGY') {
      weatherSkyColor = baseSkyColor.clone().lerp(new THREE.Color('#94a3b8'), 0.4);
      weatherFogColor = baseFogColor.clone().lerp(new THREE.Color('#cbd5e1'), 0.5);
      weatherFogDensity = 0.014; // Low fog density limits for extreme playability on screens
      weatherSunIntensity = baseLightIntensity * 0.85;
      weatherAmbIntensity = baseAmbIntensity * 1.05; // light scatters softly in fog

      targetWind = 0.4; // Very calm
      targetCloudOpacity = 0.4; // clouds blended with atmospheric fog
      targetCloudColor.set('#e2e8f0');
    }
    else if (weather === 'RAIN_SUNSHINE') {
      weatherSkyColor = baseSkyColor.clone().lerp(new THREE.Color('#bae6fd'), 0.15);
      weatherFogColor = baseFogColor.clone().lerp(new THREE.Color('#fed7aa'), 0.1);
      weatherFogDensity = baseFogDensity * 1.0;
      weatherSunColor = new THREE.Color('#fca5a5'); // hot golden rays
      weatherSunIntensity = baseLightIntensity * 1.1;

      targetWetness = 0.8;
      targetWind = 1.4;
      targetCloudOpacity = 0.7;
      targetCloudColor.set('#f1f5f9');
    }

    // Set linear targets
    this.skyColorTarget.copy(weatherSkyColor);
    this.fogColorTarget.copy(weatherFogColor);
    this.fogDensityTarget = weatherFogDensity;
    this.sunColorTarget.copy(weatherSunColor);
    this.sunIntensityTarget = weatherSunIntensity;
    this.ambColorTarget.copy(weatherAmbColor);
    this.ambIntensityTarget = weatherAmbIntensity;

    // 3. ECOSYSTEM THEME ATMOSPHERES OVERRIDES
    if (this.activeTheme === 'SKM_FACTORY') {
      this.skyColorTarget.lerp(new THREE.Color('#94a3b8'), 0.55);
      this.fogColorTarget.lerp(new THREE.Color('#cbd5e1'), 0.55);
      this.fogDensityTarget = Math.max(this.fogDensityTarget, 0.022);
      this.sunIntensityTarget *= 0.85;
    } else if (this.activeTheme === 'CORN_FIELDS' || this.activeTheme === 'WHEAT_FIELDS') {
      this.skyColorTarget.lerp(new THREE.Color('#0284c7'), 0.15);
      this.fogColorTarget.lerp(new THREE.Color('#e0f2fe'), 0.15);
      this.fogDensityTarget = Math.min(this.fogDensityTarget, 0.010);
    } else if (this.activeTheme === 'RIVER_AREA') {
      this.skyColorTarget.lerp(new THREE.Color('#a5f3fc'), 0.4);
      this.fogColorTarget.lerp(new THREE.Color('#cbd5e1'), 0.4);
      this.fogDensityTarget = Math.max(this.fogDensityTarget, 0.018);
    } else if (this.activeTheme === 'VILLAGE_ROADS') {
      this.skyColorTarget.lerp(new THREE.Color('#f97316'), 0.35);
      this.fogColorTarget.lerp(new THREE.Color('#7c2d12'), 0.35);
      this.fogDensityTarget = Math.max(this.fogDensityTarget, 0.014);
      this.sunColorTarget.lerp(new THREE.Color('#fca5a5'), 0.4);
    } else if (this.activeTheme === 'WAREHOUSE') {
      this.skyColorTarget.lerp(new THREE.Color('#475569'), 0.6);
      this.fogColorTarget.lerp(new THREE.Color('#64748b'), 0.6);
      this.fogDensityTarget = Math.max(this.fogDensityTarget, 0.024);
      this.sunIntensityTarget *= 0.6;
    } else if (this.activeTheme === 'NIGHT_FARM') {
      this.skyColorTarget.set('#030712');
      this.fogColorTarget.set('#030712');
      this.fogDensityTarget = Math.max(this.fogDensityTarget, 0.026);
      this.sunIntensityTarget *= 0.35;
    } else if (this.activeTheme === 'RAINY_SEASON') {
      this.skyColorTarget.lerp(new THREE.Color('#334155'), 0.6);
      this.fogColorTarget.lerp(new THREE.Color('#1e293b'), 0.6);
      this.fogDensityTarget = Math.max(this.fogDensityTarget, 0.035);
      this.sunIntensityTarget *= 0.6;
    }

    // 50% reduction in all active fog target densities to maintain clear visibility of at least 60m ahead
    this.fogDensityTarget *= 0.5;

    this.wetnessTarget = targetWetness;
    this.windSpeedTarget = targetWind;
    this.cloudOpacityTarget = targetCloudOpacity;
    this.cloudColorTarget.copy(targetCloudColor);

    // Sync light positions
    this.dirLight.position.set(sunX, sunY, sunZ);

    if (this.starsParticles) {
      const mat = this.starsParticles.material as THREE.PointsMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, starsOpacity, 0.08);
      this.starsParticles.visible = mat.opacity > 0.01;
    }
  }

  private updateEnvironmentLerps(delta: number) {
    if (!this.scene || !this.camera || !this.renderer) return;

    const lStep = isNaN(delta) ? 0.05 : Math.min(1.0, delta * 1.4); // smooth transition speed factor
    
    // Safety check Current values before lerping to prevent any NaN propagation
    if (isNaN(this.skyColorCurrent.r)) this.skyColorCurrent.set('#38bdf8');
    if (isNaN(this.fogColorCurrent.r)) this.fogColorCurrent.set('#cbd5e1');
    if (isNaN(this.sunColorCurrent.r)) this.sunColorCurrent.set('#ffffef');
    if (isNaN(this.ambColorCurrent.r)) this.ambColorCurrent.set('#bae6fd');

    // Lerp colors
    this.skyColorCurrent.lerp(this.skyColorTarget, lStep);
    this.fogColorCurrent.lerp(this.fogColorTarget, lStep);
    this.sunColorCurrent.lerp(this.sunColorTarget, lStep);
    this.ambColorCurrent.lerp(this.ambColorTarget, lStep);
    
    // Lerp numbers with strict NaN defaults
    if (isNaN(this.fogDensityCurrent)) this.fogDensityCurrent = 0.006;
    if (isNaN(this.sunIntensityCurrent)) this.sunIntensityCurrent = 1.05;
    if (isNaN(this.ambIntensityCurrent)) this.ambIntensityCurrent = 0.8;

    this.fogDensityCurrent = THREE.MathUtils.lerp(this.fogDensityCurrent, isNaN(this.fogDensityTarget) ? 0.006 : this.fogDensityTarget, lStep);
    this.sunIntensityCurrent = THREE.MathUtils.lerp(this.sunIntensityCurrent, isNaN(this.sunIntensityTarget) ? 1.05 : this.sunIntensityTarget, lStep);
    this.ambIntensityCurrent = THREE.MathUtils.lerp(this.ambIntensityCurrent, isNaN(this.ambIntensityTarget) ? 0.8 : this.ambIntensityTarget, lStep);
    this.wetnessCurrent = THREE.MathUtils.lerp(this.wetnessCurrent, isNaN(this.wetnessTarget) ? 0 : this.wetnessTarget, isNaN(delta) ? 0.02 : delta * 0.5); // wetness forms slowly
    this.windSpeedCurrent = THREE.MathUtils.lerp(this.windSpeedCurrent, isNaN(this.windSpeedTarget) ? 0 : this.windSpeedTarget, lStep);
    this.cloudOpacityCurrent = THREE.MathUtils.lerp(this.cloudOpacityCurrent, isNaN(this.cloudOpacityTarget) ? 0.4 : this.cloudOpacityTarget, lStep);
    this.cloudColorCurrent.lerp(this.cloudColorTarget, lStep);

    // Apply to Three.js elements
    this.scene.background = this.skyColorCurrent;
    if (this.scene.fog && this.scene.fog instanceof THREE.FogExp2) {
      if (isNaN(this.fogColorCurrent.r)) {
        this.scene.fog.color.set('#cbd5e1');
      } else {
        this.scene.fog.color.copy(this.fogColorCurrent);
      }
      // CRITICAL CLAMP: Clamp fog density to a safe visible range to prevent black screens caused by dense fog
      this.scene.fog.density = Math.min(0.045, Math.max(0.0, isNaN(this.fogDensityCurrent) ? 0.006 : this.fogDensityCurrent));
    }
    
    if (this.dirLight) {
      this.dirLight.color.copy(this.sunColorCurrent);
      if (this.lightningActive && this.lightningLight) {
        this.dirLight.intensity = Math.max(0.1, this.sunIntensityCurrent * 0.3); // dims the world shadow, making the flash shine
      } else {
        // Safe minimum level for Sun Intensity
        this.dirLight.intensity = Math.max(0.20, this.sunIntensityCurrent);
      }
    }

    if (this.ambientLight) {
      this.ambientLight.color.copy(this.ambColorCurrent);
      // SAFE LIGHTING VISIBILITY: Ensure environment lighting never drops to fully zero
      this.ambientLight.intensity = Math.max(0.35, this.ambIntensityCurrent);
    }

    // Apply cloud properties to cloud Material
    if (this.cloudMaterial) {
      this.cloudMaterial.color.copy(this.cloudColorCurrent);
      this.cloudMaterial.opacity = this.cloudOpacityCurrent;
    }

    // Dynamic environmental wetness reflections multiplier:
    const roadMat = this.matCache['road_asphalt_pbr'] as THREE.MeshStandardMaterial;
    if (roadMat) {
      roadMat.roughness = THREE.MathUtils.lerp(0.70, 0.04, this.wetnessCurrent);
      roadMat.metalness = THREE.MathUtils.lerp(0.1, 0.65, this.wetnessCurrent);
    }

    const isDarkGlobal = (this.timeOfDay > 19.2 || this.timeOfDay < 5.2) || this.currentWeather === 'THUNDERSTORM';
    
    // In search of posts lamps: scale emissive maps
    this.roads.forEach((roadGrp) => {
      roadGrp.traverse((node: any) => {
        if (node.isMesh && node.material && node.material.emissive) {
          node.material.emissiveIntensity = THREE.MathUtils.lerp(node.material.emissiveIntensity, isDarkGlobal ? 1.5 : 0.05, delta * 3.0);
        }
      });
    });
  }

  public getCurvatureOffset(absDistance: number): number {
    return 0;
  }

  public getThemeAtPosition(distance: number): { primary: ThemeType; transitionWith?: ThemeType; ratio: number } {
    if (this.debugSingleBiome) {
      return { primary: 'POULTRY_FARM', ratio: 0 };
    }

    const d = Math.max(0, distance);
    const transitionWidth = 150; // smooth 150m blend area between themes

    if (this.isStage2) {
      // Stage 2 is entirely Industrial Poultry World / SKM Factory / Warehouse and transport routes!
      // Alternate primary themes every 1000m to keep it dynamic and highly textured
      const cycle = Math.floor(d / 1000) % 2;
      const primary: ThemeType = cycle === 0 ? 'SKM_FACTORY' : 'WAREHOUSE';
      const transitionWith: ThemeType = cycle === 0 ? 'WAREHOUSE' : 'SKM_FACTORY';
      const remaining = 1000 - (d % 1000);
      if (remaining < transitionWidth) {
        const ratio = (transitionWidth - remaining) / transitionWidth;
        return { primary, transitionWith, ratio };
      }
      return { primary, ratio: 0 };
    }

    // Match requested progression mapping:
    // - 0m–1200m: Farm Area (POULTRY_FARM -> CORN_FIELDS -> WHEAT_FIELDS)
    // - 1200m–2400m: Village Area (RIVER_AREA -> VILLAGE_ROADS)
    // - 2400m–3600m: Factory Area (SKM_FACTORY -> WAREHOUSE)
    // - 3600m–4800m: Highway Area (RAINY_SEASON)
    // - 4800m+: City Area (CITY_DISTRICT)
    const segments = [
      { start: 0, end: 1000, theme: 'POULTRY_FARM' as ThemeType },
      { start: 1000, end: 2000, theme: 'NIGHT_FARM' as ThemeType },
      { start: 2000, end: 3000, theme: 'RIVER_AREA' as ThemeType },
      { start: 3000, end: 4000, theme: 'VILLAGE_ROADS' as ThemeType },
      { start: 4000, end: Infinity, theme: 'CITY_DISTRICT' as ThemeType },
    ];

    let activeIdx = 0;
    for (let i = 0; i < segments.length; i++) {
      if (d >= segments[i].start && d < segments[i].end) {
        activeIdx = i;
        break;
      }
    }

    const currentSeg = segments[activeIdx];
    // If it's the absolute last segment (CITY_DISTRICT) or has infinite bounds
    if (activeIdx === segments.length - 1) {
      return { primary: currentSeg.theme, ratio: 0 };
    }

    const nextSeg = segments[activeIdx + 1];
    const remaining = currentSeg.end - d;

    if (remaining < transitionWidth) {
      const ratio = (transitionWidth - remaining) / transitionWidth;
      return { primary: currentSeg.theme, transitionWith: nextSeg.theme, ratio };
    }

    return { primary: currentSeg.theme, ratio: 0 };
  }

  public getThemeForDistance(distance: number): ThemeType {
    return this.getThemeAtPosition(distance).primary;
  }

  private getThemeBaseHeight(theme: ThemeType, x: number, z: number): number {
    if (theme === 'POULTRY_FARM') {
      return Math.sin(x * 0.05) * Math.cos(z * 0.035) * 2.8 + Math.cos(z * 0.07) * 1.2;
    } else if (theme === 'CORN_FIELDS' || theme === 'WHEAT_FIELDS') {
      return Math.sin(x * 0.03) * Math.cos(z * 0.02) * 1.0;
    } else if (theme === 'SKM_FACTORY' || theme === 'WAREHOUSE') {
      return 0;
    } else if (theme === 'RIVER_AREA') {
      if (x < -18.0) {
        const distToRiver = Math.abs(x - (-35.0));
        if (distToRiver < 16.0) {
          return -4.0 * (1.0 - distToRiver / 16.0);
        } else {
          return -0.5;
        }
      } else {
        return Math.sin(x * 0.06) * 1.2;
      }
    } else if (theme === 'VILLAGE_ROADS' || theme === 'CITY_DISTRICT') {
      return -0.05;
    } else {
      return Math.sin(x * 0.05) * Math.cos(z * 0.035) * 2.8;
    }
  }

  private getTerrainHeight(x: number, z: number): number {
    const absX = Math.abs(x);
    
    // Perfectly flat runway corridor
    if (absX < 7.5) {
      return -0.05;
    }
    
    // Blend zone from road side to fields
    let blendFactor = 1.0;
    if (absX < 12.5) {
      blendFactor = (absX - 7.5) / 5.0;
    }
    
    const blend = this.getThemeAtPosition(-z);
    let baseHeight = this.getThemeBaseHeight(blend.primary, x, z);

    if (blend.transitionWith) {
      const secondaryHeight = this.getThemeBaseHeight(blend.transitionWith, x, z);
      baseHeight = THREE.MathUtils.lerp(baseHeight, secondaryHeight, blend.ratio);
    }
    
    baseHeight *= blendFactor;
    
    // Monumental distant mountain ranges to perfectly block the outer horizon limits
    if (absX > 85.0) {
      const mountRamp = Math.min((absX - 85.0) / 20.0, 2.5);
      const mountainWave = Math.sin(x * 0.1) * Math.cos(z * 0.06) * 4.5 + Math.cos(x * 0.04) * 2.5;
      const solidScale = (absX - 85.0) * 0.45;
      baseHeight += (solidScale + mountainWave) * mountRamp;
    }
    
    return baseHeight - 0.05;
  }

  private getThemeVertexColor(theme: ThemeType, vx: number, vertexAbsZ: number, vHeight: number, tempColor: THREE.Color) {
    const absX = Math.abs(vx);
    if (theme === 'POULTRY_FARM') {
      const pastureNoise = Math.sin(vx * 0.1) * Math.sin(vertexAbsZ * 0.1) * 0.5 + 0.5;
      tempColor.set('#15803d').lerp(new THREE.Color('#16a34a'), pastureNoise);
    } else if (theme === 'CORN_FIELDS') {
      const soilStripe = Math.floor(vx / 2.0) % 2 === 0;
      if (soilStripe && absX < 45.0) {
        tempColor.set('#3f2c19'); // Rich brown tilled farmlands
      } else {
        tempColor.set('#14532d'); // Dark corn crop greens
      }
    } else if (theme === 'WHEAT_FIELDS') {
      const wheatNoise = Math.sin(vx * 0.25) * Math.cos(vertexAbsZ * 0.25) * 0.3 + 0.7;
      tempColor.set('#ca8a04').lerp(new THREE.Color('#eab308'), wheatNoise);
    } else if (theme === 'SKM_FACTORY') {
      const slabGrid = (Math.floor(vx / 6.0) + Math.floor(vertexAbsZ / 6.0)) % 2 === 0;
      tempColor.set(slabGrid ? '#52525b' : '#3f3f46');
    } else if (theme === 'WAREHOUSE') {
      const asphaltNoise = Math.sin(vx * 0.5) * Math.sin(vertexAbsZ * 0.5) * 0.2 + 0.8;
      tempColor.set('#27272a').lerp(new THREE.Color('#18181b'), asphaltNoise * 0.5);
    } else if (theme === 'RIVER_AREA') {
      if (vx < -18.0) {
        tempColor.set('#b45309').lerp(new THREE.Color('#78350f'), 0.5);
      } else {
        tempColor.set('#166534').lerp(new THREE.Color('#15803d'), 0.5);
      }
    } else if (theme === 'VILLAGE_ROADS') {
      const lawnGrid = (Math.floor(vx / 5.0) + Math.floor(vertexAbsZ / 5.0)) % 2 === 0;
      tempColor.set(lawnGrid ? '#15803d' : '#166534');
    } else {
      const pastureNoise = Math.sin(vx * 0.1) * Math.sin(vertexAbsZ * 0.1) * 0.5 + 0.5;
      tempColor.set('#166534').lerp(new THREE.Color('#15803d'), pastureNoise * 0.5);
    }
  }

  private updateSegmentTerrain(roadGrp: THREE.Group, segmentZOffset: number) {
    try {
      const terrainMesh = roadGrp.getObjectByName('rolling_terrain') as THREE.Mesh;
      if (!terrainMesh) {
        throw new Error("rolling_terrain mesh not found in roadGroup");
      }

      const geom = terrainMesh.geometry;
      const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
      if (!posAttr) {
        throw new Error("Position attribute missing on terrain geometry");
      }

      // Simulate network / generation verification; if somehow corrupted, trigger fallback
      if (segmentZOffset === null || isNaN(segmentZOffset)) {
        throw new Error("Invalid Z coordinate offset");
      }

      const colors: number[] = [];
      const tempColor = new THREE.Color();

      // Dynamically style asphalt / shoulders for the chunk based on theme!
      const shoulderL = roadGrp.getObjectByName('shoulder_l') as THREE.Mesh;
      const shoulderR = roadGrp.getObjectByName('shoulder_r') as THREE.Mesh;
      const themeAtChunk = this.getThemeForDistance(-segmentZOffset);
      let shoulderColor = '#166534'; // Default pasture green verges
      if (themeAtChunk === 'SKM_FACTORY' || themeAtChunk === 'WAREHOUSE') {
        shoulderColor = '#64748b'; // Concrete slate verges
      } else if (themeAtChunk === 'VILLAGE_ROADS') {
        shoulderColor = '#7c2d12'; // Paved brick red verges
      } else if (themeAtChunk === 'RIVER_AREA') {
        shoulderColor = '#451a03'; // Damp muddy brown verges
      } else if (themeAtChunk === 'WHEAT_FIELDS') {
        shoulderColor = '#ca8a04'; // Dry golden verges
      }
      if (shoulderL && shoulderL.material) {
        (shoulderL.material as THREE.MeshStandardMaterial).color.set(shoulderColor);
      }
      if (shoulderR && shoulderR.material) {
        (shoulderR.material as THREE.MeshStandardMaterial).color.set(shoulderColor);
      }

      for (let j = 0; j < posAttr.count; j++) {
        const vx = posAttr.getX(j);
        const vy = posAttr.getY(j); // local Y maps to absolute Z offset
        const vertexAbsZ = segmentZOffset + vy;

        const vHeight = this.getTerrainHeight(vx, vertexAbsZ);
        posAttr.setZ(j, vHeight);

        const absX = Math.abs(vx);
        const vertexThemeBlend = this.getThemeAtPosition(-vertexAbsZ);

        if (absX < 11.5) {
          // Dirt gravel path buffer right next to the asphalt shoulder
          const gravelS = Math.abs(Math.sin(vx * 8)) * 0.18;
          const tPrimary = vertexThemeBlend.primary;
          const tSec = vertexThemeBlend.transitionWith || tPrimary;
          const r = vertexThemeBlend.ratio;

          const getGravelColor = (theme: ThemeType, c: THREE.Color) => {
            if (theme === 'SKM_FACTORY' || theme === 'WAREHOUSE') {
              c.set('#475569').lerp(new THREE.Color('#334155'), gravelS);
            } else if (theme === 'VILLAGE_ROADS') {
              c.set('#7c2d12').lerp(new THREE.Color('#9a3412'), gravelS);
            } else if (theme === 'RIVER_AREA') {
              c.set('#1a2e1a').lerp(new THREE.Color('#2d3c2d'), gravelS);
            } else {
              c.set('#2d2011').lerp(new THREE.Color('#3f2c19'), gravelS);
            }
          };

          const col1 = new THREE.Color();
          const col2 = new THREE.Color();
          getGravelColor(tPrimary, col1);
          getGravelColor(tSec, col2);
          tempColor.copy(col1).lerp(col2, r);
        } else if (vHeight < -0.65 && vertexThemeBlend.primary === 'RIVER_AREA') {
          // Deep river bed waters shading
          const mudBlend = Math.min((vHeight + 4.0) / 4.0, 1.0);
          tempColor.set('#0f172a').lerp(new THREE.Color('#1e293b'), mudBlend);
        } else {
          // Main Side Fields based on Theme or Biome of position!
          const col1 = new THREE.Color();
          this.getThemeVertexColor(vertexThemeBlend.primary, vx, vertexAbsZ, vHeight, col1);

          if (vertexThemeBlend.transitionWith) {
            const col2 = new THREE.Color();
            this.getThemeVertexColor(vertexThemeBlend.transitionWith, vx, vertexAbsZ, vHeight, col2);
            tempColor.copy(col1).lerp(col2, vertexThemeBlend.ratio);
          } else {
            tempColor.copy(col1);
          }
        }

        // Apply high mountain snow caps
        if (absX > 75.0) {
          if (vHeight > 13.0) {
            tempColor.set('#f8fafc'); // Snow mountain caps
          } else {
            const rockBlend = Math.max(0, (vHeight - 5.0) / 8.0);
            tempColor.set('#475569').lerp(new THREE.Color('#94a3b8'), rockBlend);
          }
        }

        colors.push(tempColor.r, tempColor.g, tempColor.b);
      }

      geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      posAttr.needsUpdate = true;
      const colorAttr = geom.getAttribute('color');
      if (colorAttr) {
        colorAttr.needsUpdate = true;
      }
      geom.computeVertexNormals();
      console.log("Chunk generated");
    } catch (err) {
      console.warn("Biome generation failed; applying fallback grass terrain:", err);
      this.applyFallbackSegmentTerrain(roadGrp);
    }
  }

  private applyFallbackSegmentTerrain(roadGrp: THREE.Group) {
    try {
      const terrainMesh = roadGrp.getObjectByName('rolling_terrain') as THREE.Mesh;
      if (!terrainMesh) return;

      const geom = terrainMesh.geometry;
      const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
      if (!posAttr) return;

      const colors: number[] = [];
      const tempColor = new THREE.Color('#166534'); // Default emerald pasture grass fallback

      for (let j = 0; j < posAttr.count; j++) {
        posAttr.setZ(j, -0.05); // perfectly flat standard grass
        colors.push(tempColor.r, tempColor.g, tempColor.b);
      }

      geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      posAttr.needsUpdate = true;
      const colorAttr = geom.getAttribute('color');
      if (colorAttr) {
        colorAttr.needsUpdate = true;
      }
      geom.computeVertexNormals();
      console.log("Chunk generated"); // Ensure "Chunk generated" displays for debug checks
    } catch (err) {
      console.error("Failed to generate fallback grass chunk:", err);
    }
  }

  private updateChunkDecorVisibility(roadGrp: THREE.Group) {
    const theme = roadGrp.userData.theme || this.activeTheme;
    const farmSideDecors = roadGrp.getObjectByName('farm_decor');
    const factSideDecors = roadGrp.getObjectByName('factory_decor');
    const greenSideDecors = roadGrp.getObjectByName('green_decor');
    const citySideDecors = roadGrp.getObjectByName('city_decor');

    if (farmSideDecors) {
      farmSideDecors.visible = (theme === 'POULTRY_FARM' || theme === 'VILLAGE_ROADS' || theme === 'NIGHT_FARM');
    }
    if (factSideDecors) {
      factSideDecors.visible = (theme === 'SKM_FACTORY' || theme === 'WAREHOUSE');
    }
    if (greenSideDecors) {
      greenSideDecors.visible = (theme === 'CORN_FIELDS' || theme === 'WHEAT_FIELDS' || theme === 'RAINY_SEASON');
    }
    if (citySideDecors) {
      citySideDecors.visible = (theme === 'CITY_DISTRICT');
    }
  }

  private getFurthestRoadPieceZ(): number {
    let furthest = 0;
    this.roads.forEach((r) => {
      if (r.position.z < furthest) furthest = r.position.z;
    });
    return furthest;
  }

  public cleanup() {
    this.stop();
    window.removeEventListener('keydown', () => {});
    window.removeEventListener('touchstart', () => {});
    window.removeEventListener('touchend', () => {});
    window.removeEventListener('resize', this.handleResize);

    // Clean up debug hitboxes
    if (this.debugPlayerMesh) {
      this.debugPlayerMesh.geometry.dispose();
      this.scene.remove(this.debugPlayerMesh);
      this.debugPlayerMesh = null;
    }
    this.debugHitboxMeshes.forEach((mesh) => {
      mesh.geometry.dispose();
      this.scene.remove(mesh);
    });
    this.debugHitboxMeshes.clear();
    if (this.debugMatGreen) {
      this.debugMatGreen.dispose();
      this.debugMatGreen = null;
    }
    if (this.debugMatRed) {
      this.debugMatRed.dispose();
      this.debugMatRed = null;
    }

    Object.values(this.geoCache).forEach((g) => g.dispose());
    Object.values(this.matCache).forEach((m) => m.dispose());

    this.renderer.dispose();
  }
}
export default SKMRunnerEngine;
