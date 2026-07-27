import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  CLASSES,
  WEAPONS,
  MatchConfig,
  MatchStats,
  KillFeedEntry,
  BOT_NAMES,
  CharacterClass,
  Weapon,
  WeaponAmmo,
  KeyBindings,
  GraphicsQuality
} from '../types';
import { buildMap, CollidableBox } from '../game/MapBuilder';
import { sounds } from '../lib/sounds';
import { buildHighQualityFirstPersonWeapon, buildThirdPersonWeapon } from '../game/WeaponBuilder';

interface GameCanvasProps {
  graphicsQuality: GraphicsQuality;
  config: MatchConfig;
  playerClass: CharacterClass;
  playerName: string;
  onStatsUpdate: (stats: MatchStats[]) => void;
  onKillFeedUpdate: (entry: KillFeedEntry) => void;
  onPlayerHealthUpdate: (health: number, maxHealth: number) => void;
  onPlayerAmmoUpdate: (clip: number, reserve: number) => void;
  onMatchTimerUpdate: (timeLeft: number) => void;
  onAbilityCooldownUpdate: (cooldownLeft: number) => void;
  onWeaponChange: (weapon: Weapon) => void;
  onMatchEnd: (stats: MatchStats[]) => void;
  onHitmarker?: (type: 'body' | 'head') => void;
  onXpEvent?: (amount: number, reason: string) => void;
  isMuted: boolean;
  bindings: KeyBindings;
  touchInputsRef: React.MutableRefObject<Record<string, any>>;
  useTouchControls: boolean;
}

// Helper to pick a spawn point strictly clear of obstacle colliders
const getSafeSpawnPoint = (spawnPoints: THREE.Vector3[], colliders: CollidableBox[], occupiedPositions: THREE.Vector3[] = []): THREE.Vector3 => {
  let safeSpawns = spawnPoints.filter(sp => {
    const box = new THREE.Box3(
      new THREE.Vector3(sp.x - 0.7, sp.y, sp.z - 0.7),
      new THREE.Vector3(sp.x + 0.7, sp.y + 1.8, sp.z + 0.7)
    );
    return !colliders.some(c => c.type !== 'floor' && c.box.intersectsBox(box));
  });

  if (safeSpawns.length > 0) {
    if (occupiedPositions.length > 0) {
      safeSpawns.sort((a, b) => {
        let minDistA = Infinity;
        let minDistB = Infinity;
        for (const pos of occupiedPositions) {
          const dA = a.distanceToSquared(pos);
          if (dA < minDistA) minDistA = dA;
          const dB = b.distanceToSquared(pos);
          if (dB < minDistB) minDistB = dB;
        }
        return minDistB - minDistA;
      });
      const topCount = Math.min(3, safeSpawns.length);
      const chosen = safeSpawns[Math.floor(Math.random() * topCount)].clone();
      chosen.x += (Math.random() - 0.5) * 0.2;
      chosen.z += (Math.random() - 0.5) * 0.2;
      return chosen;
    }
    const chosen = safeSpawns[Math.floor(Math.random() * safeSpawns.length)].clone();
    chosen.x += (Math.random() - 0.5) * 0.2;
    chosen.z += (Math.random() - 0.5) * 0.2;
    return chosen;
  }
  const chosen = spawnPoints[Math.floor(Math.random() * spawnPoints.length)].clone();
  chosen.x += (Math.random() - 0.5) * 0.2;
  chosen.z += (Math.random() - 0.5) * 0.2;
  return chosen;
};

// Helper to push player/bots out if clipped inside an obstacle collider
const resolveObstacleClipping = (
  position: THREE.Vector3,
  radius: number,
  height: number,
  colliders: CollidableBox[],
  spawnPoints: THREE.Vector3[]
) => {
  const entityBox = new THREE.Box3(
    new THREE.Vector3(position.x - radius, position.y + 0.1, position.z - radius),
    new THREE.Vector3(position.x + radius, position.y + height - 0.1, position.z + radius)
  );

  for (const c of colliders) {
    if (c.type === 'floor') continue;
    if (c.box.intersectsBox(entityBox)) {
      const box = c.box;
      const distLeft = Math.abs((position.x + radius) - box.min.x);
      const distRight = Math.abs((position.x - radius) - box.max.x);
      const distBack = Math.abs((position.z + radius) - box.min.z);
      const distFront = Math.abs((position.z - radius) - box.max.z);

      const minDist = Math.min(distLeft, distRight, distBack, distFront);

      if (minDist === distLeft) {
        position.x = box.min.x - radius - 0.15;
      } else if (minDist === distRight) {
        position.x = box.max.x + radius + 0.15;
      } else if (minDist === distBack) {
        position.z = box.min.z - radius - 0.15;
      } else {
        position.z = box.max.z + radius + 0.15;
      }

      // If pushed out of bounds, relocate to a clean spawn point
      if (Math.abs(position.x) > 120 || Math.abs(position.z) > 120) {
        const safeSp = getSafeSpawnPoint(spawnPoints, colliders);
        position.copy(safeSp);
      }
      return true;
    }
  }
  return false;
};

export interface BotEntity {
  id: string;
  name: string;
  classConfig: CharacterClass;
  activeWeapon: Weapon;
  isPrimary: boolean;
  health: number;
  maxHealth: number;
  kills: number;
  deaths: number;
  score: number;
  isDead: boolean;
  respawnTimer: number;

  // 3D Visual Group
  meshGroup: THREE.Group;
  headMesh: THREE.Mesh;
  torsoMesh: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  botGunMesh?: THREE.Group | THREE.Mesh;
  walkAnimPhase: number;
  flinchTimer: number;
  espBox?: THREE.LineSegments;
  tracerLine?: THREE.Line;
  healthBarGroup?: THREE.Group;
  healthBarFillMesh?: THREE.Mesh;
  healthBarSprite?: THREE.Sprite;
  healthBarCanvas?: HTMLCanvasElement;
  healthBarTex?: THREE.CanvasTexture;
  lastHpText?: string;

  // AI navigation & behavior
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotationY: number;
  targetEntityId: string | null;
  targetSelectionTimer: number;
  shootCooldownRemaining: number;
  botClip: number;
  botIsReloading: boolean;
  botReloadTimeRemaining: number;
  patrolWaypoint: THREE.Vector3;
  jumpTimer: number;

  // Smart Navigation & Threat Valuation
  damageDealtMap?: Map<string, number>;
  damageReceivedMap?: Map<string, number>;
  stuckTimer?: number;
  lastPos?: THREE.Vector3;
  lastPosTimer?: number;
  strafeDir?: number;
  strafeTimer?: number;
}

export const createBot = (
  index: number,
  bots: BotEntity[],
  spawnPoints: THREE.Vector3[],
  colliders: CollidableBox[],
  playerPos: THREE.Vector3,
  scene: THREE.Scene
): BotEntity => {
  const botName = BOT_NAMES[index % BOT_NAMES.length];
  const botClass = CLASSES[Math.floor(Math.random() * CLASSES.length)];
  const occupiedPositions = [playerPos, ...bots.map(b => b.position)];
  const botSpawn = getSafeSpawnPoint(spawnPoints, colliders, occupiedPositions);

  const meshGroup = new THREE.Group();

  const legGeo = new THREE.BoxGeometry(0.28, 0.6, 0.3);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
  
  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.24, 0.3, 0);
  leftLeg.castShadow = true;
  meshGroup.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, legMat);
  rightLeg.position.set(0.24, 0.3, 0);
  rightLeg.castShadow = true;
  meshGroup.add(rightLeg);

  const torsoGeo = new THREE.BoxGeometry(0.85, 0.75, 0.5);
  const torsoMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(botClass.color),
    roughness: 0.8,
    flatShading: true
  });
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torso.position.y = 0.95;
  torso.castShadow = true;
  torso.receiveShadow = true;
  meshGroup.add(torso);

  const pouchGeo = new THREE.BoxGeometry(0.25, 0.22, 0.12);
  const pouchMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
  const pouch = new THREE.Mesh(pouchGeo, pouchMat);
  pouch.position.set(0, 0.95, 0.28);
  meshGroup.add(pouch);

  const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 1.6;
  head.castShadow = true;
  meshGroup.add(head);

  if (botClass.id === 'assault') {
    const maskGeo = new THREE.BoxGeometry(0.44, 0.35, 0.08);
    const maskMat = new THREE.MeshBasicMaterial({ color: 0xf1f5f9 });
    const mask = new THREE.Mesh(maskGeo, maskMat);
    mask.position.set(0, 1.6, 0.26);
    meshGroup.add(mask);
  } else if (botClass.id === 'recon') {
    const ghillieGeo = new THREE.BoxGeometry(0.58, 0.58, 0.58);
    const ghillieMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 1.0 });
    const ghillie = new THREE.Mesh(ghillieGeo, ghillieMat);
    ghillie.position.copy(head.position);
    meshGroup.add(ghillie);
  } else if (botClass.id === 'heavy') {
    const visorGeo = new THREE.BoxGeometry(0.44, 0.14, 0.08);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.62, 0.26);
    meshGroup.add(visor);
  } else if (botClass.id === 'skirmisher') {
    const eyeGeo = new THREE.SphereGeometry(0.06, 4, 4);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xec4899 });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.12, 1.6, 0.26);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.12;
    meshGroup.add(eyeL);
    meshGroup.add(eyeR);
  }

  const armGeo = new THREE.BoxGeometry(0.22, 0.65, 0.22);
  const armMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(botClass.color), roughness: 0.8 });
  
  const leftArm = new THREE.Mesh(armGeo, armMat);
  leftArm.position.set(-0.52, 1.15, 0);
  leftArm.castShadow = true;
  meshGroup.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, armMat);
  rightArm.position.set(0.52, 1.15, 0);
  rightArm.castShadow = true;
  meshGroup.add(rightArm);

  const botGun = buildThirdPersonWeapon(botClass.primaryWeapon.id);
  botGun.position.set(0.38, 1.05, 0.35);
  meshGroup.add(botGun);

  meshGroup.position.copy(botSpawn);
  scene.add(meshGroup);

  const botHeadBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.55, 0.55),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, wireframe: true })
  );
  botHeadBox.position.copy(head.position);
  meshGroup.add(botHeadBox);

  return {
    id: `bot_${index}`,
    name: botName,
    classConfig: botClass,
    activeWeapon: botClass.primaryWeapon,
    isPrimary: true,
    health: botClass.maxHealth,
    maxHealth: botClass.maxHealth,
    kills: 0,
    deaths: 0,
    score: 0,
    isDead: false,
    respawnTimer: 0,
    meshGroup,
    headMesh: botHeadBox,
    torsoMesh: torso,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    botGunMesh: botGun,
    walkAnimPhase: 0,
    flinchTimer: 0,
    position: botSpawn.clone(),
    velocity: new THREE.Vector3(),
    rotationY: Math.random() * Math.PI * 2,
    targetEntityId: null,
    targetSelectionTimer: 0,
    shootCooldownRemaining: 0,
    botClip: botClass.primaryWeapon.maxAmmo,
    botIsReloading: false,
    botReloadTimeRemaining: 0,
    patrolWaypoint: botSpawn.clone(),
    jumpTimer: 0,
    damageDealtMap: new Map(),
    damageReceivedMap: new Map(),
    stuckTimer: 0,
    lastPos: botSpawn.clone(),
    lastPosTimer: 0,
    strafeDir: Math.random() < 0.5 ? 1 : -1,
    strafeTimer: 0
  };
};

export const GameCanvas: React.FC<GameCanvasProps> = ({
  graphicsQuality,
  config,
  playerClass,
  playerName,
  onStatsUpdate,
  onKillFeedUpdate,
  onPlayerHealthUpdate,
  onPlayerAmmoUpdate,
  onMatchTimerUpdate,
  onAbilityCooldownUpdate,
  onWeaponChange,
  onMatchEnd,
  onHitmarker,
  onXpEvent,
  isMuted,
  bindings,
  touchInputsRef,
  useTouchControls
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<WebSocket | null>(null);

  // States
  const [isLocked, setIsLocked] = useState(false);
  const [isOverlayDismissed, setIsOverlayDismissed] = useState(false);
  const [abilityReady, setAbilityReady] = useState(true);
  const [showHackMenu, setShowHackMenu] = useState(false);
  const [showAdminCheatMenu, setShowAdminCheatMenu] = useState(false);
  const [adminCheatTargetIndex, setAdminCheatTargetIndex] = useState(0);
  const [adminTargetCheats, setAdminTargetCheats] = useState<Record<string, any>>({});
  
  const [medals, setMedals] = useState<{id: string, text: string, type: 'headshot' | 'noscope' | 'kill' | 'streak' | 'noscope_headshot', time: number}[]>([]);
  const [killStreak, setKillStreak] = useState(0);
  const [deathMessage, setDeathMessage] = useState<string | null>(null);
  
  useEffect(() => {
    if (killStreak > 0) {
      const timer = setTimeout(() => {
        setKillStreak(0);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [killStreak]);
  const [screenFlash, setScreenFlash] = useState<'none' | 'headshot' | 'noscope' | 'noscope_headshot' | 'streak'>('none');
  const triggerMedal = (text: string, type: 'headshot' | 'noscope' | 'kill' | 'streak' | 'noscope_headshot' | 'assist') => {
    setMedals(prev => [...prev, { id: Math.random().toString(36), text, type: type as any, time: Date.now() }]);
    
    // Map medals to XP
    let xpAmount = 100;
    if (type === 'headshot') xpAmount = 150;
    if (type === 'noscope') xpAmount = 120;
    if (type === 'noscope_headshot') xpAmount = 200;
    if (type === 'streak') xpAmount = 50;
    if (type === 'assist') xpAmount = 25;
    
    onXpEvent?.(xpAmount, text);

    if (type === 'noscope_headshot') {
       setScreenFlash('noscope_headshot');
       setTimeout(() => setScreenFlash('none'), 300);
    } else if (type === 'streak') {
       setScreenFlash('streak');
       setTimeout(() => setScreenFlash('none'), 300);
    } else if (type === 'noscope') {
       setScreenFlash('noscope');
       setTimeout(() => setScreenFlash('none'), 200);
    } else if (type === 'headshot') {
       setScreenFlash('headshot');
       setTimeout(() => setScreenFlash('none'), 200);
    }
  };

  useEffect(() => {
    if (medals.length > 0) {
      const timer = setInterval(() => {
        setMedals(prev => prev.filter(m => Date.now() - m.time < 3000));
      }, 500);
      return () => clearInterval(timer);
    }
  }, [medals]);

  const [hacks, setHacks] = useState({
    espMode: 'OFF' as 'OFF' | 'FULL_BODY' | 'BOXES',
    healthBarESP: false,
    wallhack: false,
    aimbotMode: 'OFF' as 'OFF' | 'ALWAYS' | 'ADS_ONLY' | 'FOV_CIRCLE',
    aimbotTarget: 'HEAD' as 'HEAD' | 'BODY',
    tracerLines: false,
    fovVisibility: 'OBVIOUS' as 'OBVIOUS' | 'SUBTLE' | 'HIDDEN',
    oneShot: false,
    godMode: false,
    speedHack: false,
    flyHack: false,
    unlimitedAmmo: false,
    autoHeal: false,
    rapidFire: false,
    superJump: false,
    fullAuto: false,
    noRecoil: false,
    insaneSpeed: false,
    magicBullet: false, // bullets always hit closest enemy
  });
  const hacksRef = useRef(hacks);
  useEffect(() => { hacksRef.current = hacks; }, [hacks]);
  const adminTargetCheatsRef = useRef(adminTargetCheats);
  useEffect(() => { adminTargetCheatsRef.current = adminTargetCheats; }, [adminTargetCheats]);

  const clientId = (socketRef.current as any)?.clientId || 'local';
  const getHacksFor = (id: string) => {
    if (id === 'local' || id === clientId) {
      return hacksRef.current;
    }
    return adminTargetCheatsRef.current[id] || {
      espMode: 'OFF', healthBarESP: false, wallhack: false, tracerLines: false, oneShot: false, rapidFire: false, fullAuto: false,
      noRecoil: false, unlimitedAmmo: false, godMode: false, autoHeal: false, speedHack: false, insaneSpeed: false,
      superJump: false, flyHack: false, aimbotMode: 'OFF', aimbotTarget: 'HEAD', fovVisibility: 'OBVIOUS'
    };
  };

  // Core game reference storage to bypass react re-render bottlenecks
  const gameRef = useRef<{
    scene: THREE.Scene | null;
    camera: THREE.PerspectiveCamera | null;
    renderer: THREE.WebGLRenderer | null;
    colliders: CollidableBox[];
    spawnPoints: THREE.Vector3[];

    // Player states
    playerPos: THREE.Vector3;
    playerVel: THREE.Vector3;
    playerHealth: number;
    playerMaxHealth: number;
    playerKills: number;
    playerDeaths: number;
    playerScore: number;
    playerWeaponKills: Record<string, number>;
    playerIsDead: boolean;
    playerRespawnTimer: number;

    // Movement keys
    keys: Record<string, boolean>;
    pitch: number;
    yaw: number;

    // Weapon & Shooting
    activeWeapon: Weapon;
    isPrimary: boolean;
    playerClip: number;
    playerReserve: number;
    primaryAmmo: WeaponAmmo;
    secondaryAmmo: WeaponAmmo;
    killPopups: { sprite: THREE.Sprite, life: number, vy: number }[];
    deadBodies: { mesh: THREE.Group, life: number, vr: number }[];
    isReloading: boolean;
    reloadTimeRemaining: number;
    lastShotTime: number;
    isADS: boolean;
    isProne: boolean;
    currentCameraHeight: number;
    isFiring: boolean;
    semiAutoFired: boolean;
    burstPending: number;
    burstTimer: number;

    // Recoil, Blowback & Melee Animations
    recoilOffset: THREE.Vector3;
    recoilRot: THREE.Vector3;
    slideMesh: THREE.Mesh | null;
    slideKickback: number;
    meleeSwingProgress: number;
    meleeHasHit: boolean;
    slashMesh: THREE.Mesh | null;
    shellCasings: { mesh: THREE.Mesh; vel: THREE.Vector3; rotVel: THREE.Vector3; life: number }[];

    // Ability
    abilityCooldown: number;
    abilityActive: boolean;
    abilityActiveTimeRemaining: number;

    // Entity lists
    bots: BotEntity[];
    otherPlayers: Map<string, {
      id: string;
      name: string;
      classId: string;
      isSpectator?: boolean;
      meshGroup: THREE.Group;
      position: THREE.Vector3;
      yaw: number;
      pitch: number;
      health: number;
    }>;
    tracers: { line: THREE.Line; age: number; maxAge: number }[];
    muzzleFlash: THREE.Mesh | null;
    muzzleFlashLight: THREE.PointLight | null;
    muzzleFlashTimer: number;
    particles: THREE.Points | null;
    particleData: { pos: THREE.Vector3; vel: THREE.Vector3; color: THREE.Color; life: number; maxLife: number }[];

    // Weapon visual meshes rigged to camera
    weaponGroup: THREE.Group | null;
    weaponMesh: THREE.Mesh | null;
    
    wantsToFire: boolean;

    // Match Timer
    matchTimeLeft: number;
    scoreLimit: number;

    // Frame request
    frameId: number | null;
  }>({
    scene: null,
    camera: null,
    renderer: null,
    colliders: [],
    spawnPoints: [],
    playerPos: new THREE.Vector3(0, 1.5, 0),
    playerVel: new THREE.Vector3(0, 0, 0),
    playerHealth: playerClass.maxHealth,
    playerMaxHealth: playerClass.maxHealth,
    playerKills: 0,
    playerDeaths: 0,
    playerScore: 0,
    playerWeaponKills: {},
    playerIsDead: false,
    playerRespawnTimer: 0,
    keys: {},
    pitch: 0,
    yaw: 0,
    activeWeapon: playerClass.primaryWeapon,
    isPrimary: true,
    playerClip: playerClass.primaryWeapon.maxAmmo,
    playerReserve: playerClass.primaryWeapon.maxAmmo * 3,
    primaryAmmo: { clip: playerClass.primaryWeapon.maxAmmo, reserve: playerClass.primaryWeapon.maxAmmo * 3 },
    secondaryAmmo: { clip: playerClass.secondaryWeapon.maxAmmo, reserve: playerClass.secondaryWeapon.maxAmmo * 3 },
    killPopups: [],
    deadBodies: [],
    isReloading: false,
    reloadTimeRemaining: 0,
    lastShotTime: -9999,
    isADS: false,
    isFiring: false,
    semiAutoFired: false,
    burstPending: 0,
    burstTimer: 0,
    recoilOffset: new THREE.Vector3(0, 0, 0),
    recoilRot: new THREE.Vector3(0, 0, 0),
    slideMesh: null,
    slideKickback: 0,
    meleeSwingProgress: 0,
    meleeHasHit: false,
    slashMesh: null,
    shellCasings: [],
    abilityCooldown: 0,
    abilityActive: false,
    abilityActiveTimeRemaining: 0,
    bots: [],
    otherPlayers: new Map<string, {
      id: string;
      name: string;
      classId: string;
      meshGroup: THREE.Group;
      position: THREE.Vector3;
      yaw: number;
      pitch: number;
      health: number;
    }>(),
    tracers: [],
    muzzleFlash: null,
    muzzleFlashLight: null,
    muzzleFlashTimer: 0,
    particles: null,
    particleData: [],
    weaponGroup: null,
    weaponMesh: null,
    wantsToFire: false,
    matchTimeLeft: config.timeLimit,
    scoreLimit: config.scoreLimit,
    frameId: null
  });

  // Handle pointer lock requests
  const requestPointerLock = () => {
    if (canvasRef.current && !gameRef.current.playerIsDead) {
      canvasRef.current.requestPointerLock();
      canvasRef.current.focus();
    }
  };

  const bindingsRef = useRef(bindings);
  useEffect(() => {
    bindingsRef.current = bindings;
  }, [bindings]);

  useEffect(() => {
    sounds.toggle(!isMuted);
  }, [isMuted]);

  useEffect(() => {
    const handleLockChange = () => {
      const locked = document.pointerLockElement === canvasRef.current;
      setIsLocked(locked);
      if (locked) {
        setIsOverlayDismissed(false);
      }
    };

    const handleLockError = () => {
      console.warn("Pointer lock failed. Falling back to Click-and-Drag iframe-safe mode.");
      setIsOverlayDismissed(true);
    };

    document.addEventListener('pointerlockchange', handleLockChange);
    document.addEventListener('pointerlockerror', handleLockError);
    return () => {
      document.removeEventListener('pointerlockchange', handleLockChange);
      document.removeEventListener('pointerlockerror', handleLockError);
    };
  }, []);

  useEffect(() => {
    if (gameRef.current.renderer) {
      const gLevel = parseInt(graphicsQuality.level) || 5;
      
      let dpr = 1.0;
      if (gLevel === 1) dpr = 0.1;
      else if (gLevel === 2) dpr = 0.2;
      else if (gLevel === 3) dpr = 0.4;
      else if (gLevel === 4) dpr = 0.6;
      else if (gLevel === 5) dpr = 1.0;
      else if (gLevel === 6) dpr = 1.0;
      else if (gLevel === 7) dpr = 1.2;
      else if (gLevel === 8) dpr = 1.5;
      else if (gLevel === 9) dpr = 2.0;
      else if (gLevel === 10) dpr = 3.0;
      
      gameRef.current.renderer.setPixelRatio(dpr);
      gameRef.current.renderer.shadowMap.enabled = gLevel >= 4;
      gameRef.current.renderer.shadowMap.type = gLevel >= 7 ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
      
      // Need to tell ThreeJS materials that shadowMap type changed by setting needsUpdate on materials
      // But it's usually enough just to toggle it.
    }
  }, [graphicsQuality]);

  // Initialize and run the 3D game
  useEffect(() => {
    const game = gameRef.current;

    // Build high-detail low-poly tactical soldier mesh visual representation of other real players
    const buildOtherPlayerMesh = (classId: string, name: string, activeWeaponId?: string) => {
      const meshGroup = new THREE.Group();
      const charClass = CLASSES.find(c => c.id === classId) || CLASSES[0];
      
      // 1. Combat Boots (Feet at y = 0.1)
      const bootGeo = new THREE.BoxGeometry(0.28, 0.25, 0.45);
      const bootMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
      const bootL = new THREE.Mesh(bootGeo, bootMat);
      bootL.position.set(-0.2, 0.125, 0);
      const bootR = bootL.clone();
      bootR.position.x = 0.2;
      meshGroup.add(bootL);
      meshGroup.add(bootR);

      // 2. Armored Legs & Kneepads
      const legGeo = new THREE.BoxGeometry(0.26, 0.65, 0.3);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
      const legL = new THREE.Mesh(legGeo, legMat);
      legL.position.set(-0.2, 0.5, 0);
      const legR = legL.clone();
      legR.position.x = 0.2;
      meshGroup.add(legL);
      meshGroup.add(legR);

      // Upper Body Group (pivot at Y = 1.15 for pitch tilting)
      const upperBodyGroup = new THREE.Group();
      upperBodyGroup.position.set(0, 1.15, 0);
      meshGroup.add(upperBodyGroup);

      // 3. Tactical Body Armor / Kevlar Vest
      const torsoGeo = new THREE.BoxGeometry(0.85, 0.85, 0.55);
      const torsoMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(charClass.color),
        roughness: 0.7,
        flatShading: true
      });
      const torso = new THREE.Mesh(torsoGeo, torsoMat);
      torso.position.set(0, 0, 0);
      torso.castShadow = true;
      torso.receiveShadow = true;
      upperBodyGroup.add(torso);

      // Chest ammo pouches
      const pouchGeo = new THREE.BoxGeometry(0.22, 0.25, 0.15);
      const pouchMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
      const pouch1 = new THREE.Mesh(pouchGeo, pouchMat);
      pouch1.position.set(-0.22, 0, 0.3);
      const pouch2 = pouch1.clone();
      pouch2.position.x = 0.22;
      upperBodyGroup.add(pouch1);
      upperBodyGroup.add(pouch2);

      // Arms
      const armGeo = new THREE.BoxGeometry(0.22, 0.65, 0.22);
      const armMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(charClass.color), roughness: 0.8 });
      const leftArm = new THREE.Mesh(armGeo, armMat);
      leftArm.position.set(-0.52, 0, 0);
      leftArm.castShadow = true;
      upperBodyGroup.add(leftArm);

      const rightArm = new THREE.Mesh(armGeo, armMat);
      rightArm.position.set(0.52, 0, 0);
      rightArm.castShadow = true;
      upperBodyGroup.add(rightArm);

      // 4. Tactical Helmet with Glowing Visor
      const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const headMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(0, 0.55, 0);
      head.castShadow = true;
      upperBodyGroup.add(head);

      // Glowing visor strip across helmet face
      const visorGeo = new THREE.BoxGeometry(0.44, 0.12, 0.08);
      const visorMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(charClass.accentColor || '#38bdf8') });
      const visor = new THREE.Mesh(visorGeo, visorMat);
      visor.position.set(0, 0.57, 0.26);
      upperBodyGroup.add(visor);

      // Invisible head hitbox for precise headshots
      const headHitbox = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.55, 0.55),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, wireframe: true })
      );
      headHitbox.position.set(0, 0.55, 0);
      upperBodyGroup.add(headHitbox);

      // 5. 3D Weapon Model in hand
      const initialWepId = activeWeaponId || charClass.primaryWeapon?.id || 'm4_assault';
      const weaponMesh = buildThirdPersonWeapon(initialWepId);
      weaponMesh.position.set(0.38, -0.1, 0.35);
      upperBodyGroup.add(weaponMesh);

      // Floating billboarded CanvasTexture nametag overlay with health bar
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(0, 0, 256, 64);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, 256, 64);
        ctx.font = 'bold 22px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(name, 128, 38);
      }
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(0, 2.3, 0);
      sprite.scale.set(1.4, 0.35, 1);
      meshGroup.add(sprite);

      return { meshGroup, upperBodyGroup, headMesh: headHitbox, torsoMesh: torso, weaponMesh, activeWeaponId: initialWepId };
    };

    // WebSocket Multiplayer Connection setup
    let socket: WebSocket | null = null;
    let clientId: string | null = null;

    if (config.isMultiplayer) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      console.log(`[MULTIPLAYER] Attempting real-time WebSocket handshake at: ${wsUrl}`);

      try {
        socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onerror = (err) => {
          console.warn('[MULTIPLAYER] WebSocket connection note:', err);
        };

      socket.onopen = () => {
        console.log('[MULTIPLAYER] WebSocket connection success.');
        socket?.send(JSON.stringify({
          type: 'join',
          payload: {
            roomCode: (config.roomCode || 'MAIN').toUpperCase(),
            mapId: config.mapId,
            scoreLimit: config.scoreLimit,
            timeLimit: config.timeLimit,
            name: playerName,
            classId: playerClass.id,
            isSpectator: config.spectatorMode || false,
            x: game.playerPos.x,
            y: game.playerPos.y,
            z: game.playerPos.z,
            yaw: game.yaw,
            pitch: game.pitch,
            health: playerClass.maxHealth,
            maxHealth: playerClass.maxHealth,
            activeWeaponId: playerClass.primaryWeapon.id
          }
        }));
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'init') {
            const newClientId = msg.payload.clientId;
            clientId = newClientId;
            if (socketRef.current) {
              (socketRef.current as any).clientId = newClientId;
            }
            console.log(`[MULTIPLAYER] Match Joined. Client ID assigned: ${newClientId}`);

            if (typeof msg.payload.matchTimeLeft === 'number') {
              game.matchTimeLeft = msg.payload.matchTimeLeft;
              onMatchTimerUpdate(game.matchTimeLeft);
            }
            if (typeof msg.payload.botCount === 'number' && msg.payload.botCount !== config.botCount) {
              config.botCount = msg.payload.botCount;
              while (bots.length < config.botCount) {
                bots.push(createBot(bots.length, bots, game.spawnPoints, game.colliders, game.playerPos, scene));
              }
              while (bots.length > config.botCount) {
                const removed = bots.pop();
                if (removed) {
                  scene.remove(removed.meshGroup);
                  removed.meshGroup.traverse(child => {
                    if (child instanceof THREE.Mesh) child.geometry.dispose();
                  });
                }
              }
            }
            if (typeof msg.payload.scoreLimit === 'number') {
              game.scoreLimit = msg.payload.scoreLimit;
              config.scoreLimit = msg.payload.scoreLimit;
            }
            if (msg.payload.difficulty) {
              config.difficulty = msg.payload.difficulty;
            }

            // Initialize existing connected players
            const initialPlayers = msg.payload.players || [];
            initialPlayers.forEach((pData: any) => {
              if (pData.id === clientId) {
                game.playerKills = pData.kills || 0;
                game.playerDeaths = pData.deaths || 0;
                game.playerScore = pData.score || 0;
                if (pData.hacks) {
                   setHacks(pData.hacks);
                   hacksRef.current = pData.hacks;
                }
                return;
              }
              if (pData.hacks) {
                 setAdminTargetCheats(prev => ({ ...prev, [pData.id]: pData.hacks }));
              }
              let pObj = game.otherPlayers.get(pData.id);
              if (!pObj) {
                const { meshGroup, upperBodyGroup, headMesh, torsoMesh, weaponMesh, activeWeaponId } = buildOtherPlayerMesh(pData.classId, pData.name, pData.activeWeaponId);
                meshGroup.position.set(pData.x, Math.max(0, pData.y - 1.5), pData.z);
                meshGroup.rotation.y = (pData.yaw || 0) + Math.PI;
                if (upperBodyGroup) upperBodyGroup.rotation.x = Math.max(-1.2, Math.min(1.2, -(pData.pitch || 0)));
                scene.add(meshGroup);
                pObj = {
                  id: pData.id,
                  name: pData.name,
                  classId: pData.classId,
                  activeWeaponId,
                  meshGroup,
                  upperBodyGroup,
                  weaponMesh,
                  headMesh,
                  torsoMesh,
                  position: new THREE.Vector3(pData.x, pData.y, pData.z),
                  yaw: pData.yaw || 0,
                  pitch: pData.pitch || 0,
                  health: pData.health || 100,
                  kills: pData.kills || 0,
                  deaths: pData.deaths || 0,
                  score: pData.score || 0,
                  isSpectator: pData.isSpectator
                };
                if (pData.isSpectator) meshGroup.visible = false;
                game.otherPlayers.set(pData.id, pObj);
              } else {
                pObj.kills = pData.kills || 0;
                pObj.deaths = pData.deaths || 0;
                pObj.score = pData.score || 0;
              }
            });
            updateScoreboard();
          }
          else if (msg.type === 'room_settings_updated') {
            const { botCount: newBotCount, scoreLimit: newScore, difficulty: newDiff } = msg.payload || {};
            if (newBotCount !== undefined && newBotCount !== config.botCount) {
              console.log(`[MULTIPLAYER] Room bot count updated to: ${newBotCount}`);
              config.botCount = newBotCount;
              while (bots.length < config.botCount) {
                bots.push(createBot(bots.length, bots, game.spawnPoints, game.colliders, game.playerPos, scene));
              }
              while (bots.length > config.botCount) {
                const removed = bots.pop();
                if (removed) {
                  scene.remove(removed.meshGroup);
                  removed.meshGroup.traverse(child => {
                    if (child instanceof THREE.Mesh) child.geometry.dispose();
                  });
                }
              }
            }
            if (newScore !== undefined) {
              game.scoreLimit = newScore;
              config.scoreLimit = newScore;
            }
            if (newDiff) {
              config.difficulty = newDiff;
            }
          }
          else if (msg.type === 'player_joined') {
            const pData = msg.payload;
            if (pData.id === clientId) return;

            if (pData.hacks) {
               setAdminTargetCheats(prev => ({ ...prev, [pData.id]: pData.hacks }));
            }

            let pObj = game.otherPlayers.get(pData.id);
            if (!pObj) {
              const { meshGroup, upperBodyGroup, headMesh, torsoMesh, weaponMesh, activeWeaponId } = buildOtherPlayerMesh(pData.classId, pData.name, pData.activeWeaponId);
              meshGroup.position.set(pData.x, Math.max(0, pData.y - 1.5), pData.z);
              meshGroup.rotation.y = (pData.yaw || 0) + Math.PI;
              if (upperBodyGroup) upperBodyGroup.rotation.x = Math.max(-1.2, Math.min(1.2, -(pData.pitch || 0)));
              scene.add(meshGroup);
              pObj = {
                id: pData.id,
                name: pData.name,
                classId: pData.classId,
                activeWeaponId,
                meshGroup,
                upperBodyGroup,
                weaponMesh,
                headMesh,
                torsoMesh,
                position: new THREE.Vector3(pData.x, pData.y, pData.z),
                yaw: pData.yaw || 0,
                pitch: pData.pitch || 0,
                health: pData.health || 100,
                kills: pData.kills || 0,
                deaths: pData.deaths || 0,
                score: pData.score || 0,
                isSpectator: pData.isSpectator
              };
              if (pData.isSpectator) meshGroup.visible = false;
              game.otherPlayers.set(pData.id, pObj);

              onKillFeedUpdate({
                id: `feed_join_${Date.now()}_${pData.id}`,
                killer: { name: 'SERVER', classId: 'recon', isBot: true },
                victim: { name: `${pData.name} joined`, classId: pData.classId, isBot: false },
                weaponName: 'ONLINE',
                isHeadshot: false,
                time: Date.now()
              });
            }
            updateScoreboard();
          }
          else if (msg.type === 'player_updated') {
            const pData = msg.payload;
            if (pData.id === clientId) return;

            let pObj = game.otherPlayers.get(pData.id);
            if (pObj) {
              pObj.position.set(pData.x, pData.y, pData.z);
              pObj.yaw = pData.yaw || 0;
              pObj.pitch = pData.pitch || 0;
              pObj.health = pData.health ?? pObj.health;
              pObj.kills = pData.kills ?? pObj.kills;
              pObj.deaths = pData.deaths ?? pObj.deaths;
              pObj.score = pData.score ?? pObj.score;

              pObj.meshGroup.position.set(pObj.position.x, Math.max(0, pObj.position.y - 1.5), pObj.position.z);
              // Rotation correction: + Math.PI ensures player model faces exact camera look direction
              pObj.meshGroup.rotation.y = pObj.yaw + Math.PI;
              if (pObj.upperBodyGroup) {
                pObj.upperBodyGroup.rotation.x = Math.max(-1.2, Math.min(1.2, -pObj.pitch));
              }

              // Update equipped weapon model if changed
              if (pData.activeWeaponId && pData.activeWeaponId !== pObj.activeWeaponId) {
                if (pObj.weaponMesh && pObj.upperBodyGroup) {
                  pObj.upperBodyGroup.remove(pObj.weaponMesh);
                }
                const newWep = buildThirdPersonWeapon(pData.activeWeaponId);
                newWep.position.set(0.38, -0.1, 0.35);
                if (pObj.upperBodyGroup) {
                  pObj.upperBodyGroup.add(newWep);
                }
                pObj.weaponMesh = newWep;
                pObj.activeWeaponId = pData.activeWeaponId;
              }

              pObj.meshGroup.visible = pObj.health > 0 && !pObj.isSpectator;
            } else {
              // If we received an update for an un-tracked player, create them
              const { meshGroup, upperBodyGroup, headMesh, torsoMesh, weaponMesh, activeWeaponId } = buildOtherPlayerMesh(pData.classId || 'assault', pData.name || 'Soldier', pData.activeWeaponId);
              meshGroup.position.set(pData.x, Math.max(0, (pData.y || 1.5) - 1.5), pData.z);
              meshGroup.rotation.y = (pData.yaw || 0) + Math.PI;
              if (upperBodyGroup) upperBodyGroup.rotation.x = Math.max(-1.2, Math.min(1.2, -(pData.pitch || 0)));
              scene.add(meshGroup);
              pObj = {
                id: pData.id,
                name: pData.name || 'Soldier',
                classId: pData.classId || 'assault',
                activeWeaponId,
                meshGroup,
                upperBodyGroup,
                weaponMesh,
                headMesh,
                torsoMesh,
                position: new THREE.Vector3(pData.x, pData.y, pData.z),
                yaw: pData.yaw || 0,
                pitch: pData.pitch || 0,
                health: pData.health || 100,
                kills: pData.kills || 0,
                deaths: pData.deaths || 0,
                score: pData.score || 0
              };
              meshGroup.visible = pObj.health > 0 && !pObj.isSpectator;
              game.otherPlayers.set(pData.id, pObj);
            }
            updateScoreboard();
          }
          else if (msg.type === 'player_shot') {
            const { playerId, target, weaponType } = msg.payload;
            if (playerId === clientId) return;

            const source = game.otherPlayers.get(playerId);
            if (source && target) {
              const start = source.position.clone().add(new THREE.Vector3(0, 1.2, 0));
              const end = new THREE.Vector3(target.x, target.y, target.z);

              const points = [start, end];
              const traceGeo = new THREE.BufferGeometry().setFromPoints(points);
              const traceMat = new THREE.LineBasicMaterial({
                color: 0x3b82f6,
                transparent: true,
                opacity: 0.85
              });
              const line = new THREE.Line(traceGeo, traceMat);
              scene.add(line);
              game.tracers.push({ line, age: 0, maxAge: 120 });

              sounds.playShoot(weaponType || 'AR');
            }
          }
          else if (msg.type === 'player_damaged') {
            const { targetId, health } = msg.payload;
            if (targetId === clientId) {
              game.playerHealth = health;
              onPlayerHealthUpdate(game.playerHealth, playerClass.maxHealth);
              sounds.playHurt();
              if (game.playerHealth <= 0 && !game.playerIsDead) {
                game.playerIsDead = true;
                game.playerDeaths++;
                sounds.playDeath();
                updateScoreboard();
                setTimeout(() => {
                  const occupiedPositions = bots.filter(b => !b.isDead).map(b => b.position);
                  game.otherPlayers.forEach(p => {
                    if (p.health && p.health > 0) occupiedPositions.push(p.position);
                  });
                  const spawn = getSafeSpawnPoint(game.spawnPoints, game.colliders, occupiedPositions);
                  game.playerPos.copy(spawn);
                  game.playerHealth = playerClass.maxHealth;
                  game.playerIsDead = false;
                  onPlayerHealthUpdate(game.playerHealth, playerClass.maxHealth);

                  if (socket && socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({
                      type: 'respawn',
                      payload: {
                        x: spawn.x,
                        y: spawn.y,
                        z: spawn.z
                      }
                    }));
                  }
                }, 3000);
              }
            } else {
              const pObj = game.otherPlayers.get(targetId);
              if (pObj) {
                pObj.health = health;
                if (health <= 0) {
                  pObj.meshGroup.visible = false;
                }
              }
            }
          }
          else if (msg.type === 'player_respawned') {
            const { id, health, x, y, z } = msg.payload || {};
            if (id && id !== clientId) {
              const pObj = game.otherPlayers.get(id);
              if (pObj) {
                pObj.health = health ?? 100;
                pObj.position.set(x || 0, y || 1.5, z || 0);
                pObj.meshGroup.position.set(pObj.position.x, Math.max(0, pObj.position.y - 1.6), pObj.position.z);
                pObj.meshGroup.visible = !pObj.isSpectator;
              }
            }
          }
          else if (msg.type === 'player_killed') {
            const { killer, victim, weaponName, isHeadshot, isNoscope } = msg.payload;
            
            // Prevent double-counting AI kills (already processed locally in damageBot)
            if (killer && killer.id === clientId && victim && victim.isBot) {
              return;
            }
            
            onKillFeedUpdate({
              id: `feed_${performance.now()}`,
              killer: killer || { name: 'Unknown', classId: 'assault', isBot: false },
              victim: victim || { name: 'Soldier', classId: 'assault', isBot: false },
              weaponName: weaponName || 'Gun',
              isHeadshot: !!isHeadshot,
              time: Date.now()
            });

            if (victim && victim.id === clientId) {
              if (isNoscope && isHeadshot) {
                setDeathMessage("YOU GOT NOSCOPE HEADSHOTTED!");
              } else if (isNoscope) {
                setDeathMessage("YOU GOT NOSCOPED!");
              }
            }
            
            if (killer && killer.id === clientId) {
              game.playerKills++;
              game.playerWeaponKills[game.activeWeapon.id] = (game.playerWeaponKills[game.activeWeapon.id] || 0) + 1;
              game.playerScore += isHeadshot ? 150 : 100;
              awardKillAmmo();
              sounds.playKill();
              const isSniper = game.activeWeapon.type === 'sniper';
              const isNoscope = isSniper && !game.isADS;
              if (isNoscope && isHeadshot) triggerMedal("NOSCOPE HEADSHOT!", 'noscope_headshot');
              else if (isNoscope) triggerMedal("NOSCOPE", 'noscope');
              else if (isHeadshot) triggerMedal("HEADSHOT", 'headshot');
              else triggerMedal("KILL", 'kill');
              
              setKillStreak(prev => {
                const next = prev + 1;
                if (next > 1) {
                  triggerMedal(`STREAK x${next}!`, 'streak');
                }
                return next;
              });

              
              spawnKillPopup(
                new THREE.Vector3(game.playerPos.x, game.playerPos.y + 1, game.playerPos.z),
                isHeadshot ? "HEADSHOT!" : "KILL"
              );
            } else if (killer && killer.id) {
              const kObj = game.otherPlayers.get(killer.id);
              if (kObj) {
                kObj.kills++;
                kObj.score += isHeadshot ? 150 : 100;
              }
            }

            if (victim && victim.id) {
              if (victim.id !== clientId) {
                const vObj = game.otherPlayers.get(victim.id);
                if (vObj) {
                  vObj.deaths++;
                  vObj.health = 0;
                  vObj.meshGroup.visible = false;
                }
              }
            }

            updateScoreboard();
            checkWinCondition();
          }
          else if (msg.type === 'player_left') {
            const leftId = msg.payload?.clientId;
            if (leftId) {
              const pObj = game.otherPlayers.get(leftId);
              if (pObj) {
                scene.remove(pObj.meshGroup);
                pObj.meshGroup.traverse(child => {
                  if (child instanceof THREE.Mesh) child.geometry.dispose();
                });
                game.otherPlayers.delete(leftId);

                onKillFeedUpdate({
                  id: `feed_leave_${Date.now()}_${leftId}`,
                  killer: { name: 'SERVER', classId: 'recon', isBot: true },
                  victim: { name: `${pObj.name} left`, classId: pObj.classId, isBot: false },
                  weaponName: 'ONLINE',
                  isHeadshot: false,
                  time: Date.now()
                });
              }
            }
            updateScoreboard();
          }
          else if (msg.type === 'time_sync') {
            if (msg.payload && typeof msg.payload.matchTimeLeft === 'number') {
              game.matchTimeLeft = msg.payload.matchTimeLeft;
              onMatchTimerUpdate(game.matchTimeLeft);
            }
            if (msg.payload && Array.isArray(msg.payload.players)) {
              msg.payload.players.forEach((pData: any) => {
                if (pData.id === clientId) {
                  game.playerKills = pData.kills ?? game.playerKills;
                  game.playerDeaths = pData.deaths ?? game.playerDeaths;
                  game.playerScore = pData.score ?? game.playerScore;
                } else {
                  const pObj = game.otherPlayers.get(pData.id);
                  if (pObj) {
                    pObj.kills = pData.kills ?? pObj.kills;
                    pObj.deaths = pData.deaths ?? pObj.deaths;
                    pObj.score = pData.score ?? pObj.score;
                  }
                }
              });
              updateScoreboard();
            }
          }
          else if (msg.type === "admin_cheat") {
            if (msg.payload.targetId === clientId) {
              setHacks(msg.payload.hacks);
              hacksRef.current = msg.payload.hacks;
            } else {
              // Also sync for bots and other players
              setAdminTargetCheats(prev => ({ ...prev, [msg.payload.targetId]: msg.payload.hacks }));
            }
          }
          else if (msg.type === 'match_ended') {
            const { players } = msg.payload || {};
            if (Array.isArray(players)) {
              players.forEach((pData: any) => {
                if (pData.id === clientId) {
                  game.playerKills = pData.kills ?? game.playerKills;
                  game.playerDeaths = pData.deaths ?? game.playerDeaths;
                  game.playerScore = pData.score ?? game.playerScore;
                } else {
                  const pObj = game.otherPlayers.get(pData.id);
                  if (pObj) {
                    pObj.kills = pData.kills ?? pObj.kills;
                    pObj.deaths = pData.deaths ?? pObj.deaths;
                    pObj.score = pData.score ?? pObj.score;
                  }
                }
              });
            }
            endMatch();
          }
        } catch (err) {
          console.error('[MULTIPLAYER] WebSocket parsing error:', err);
        }
      };

      socket.onerror = (err) => {
        console.warn('[MULTIPLAYER] Real-time connection note (running in singleplayer or connecting):', err);
      };

      socket.onclose = () => {
        console.log('[MULTIPLAYER] WebSocket session closed.');
      };
      } catch (wsErr) {
        console.warn('[MULTIPLAYER] Could not establish WebSocket connection:', wsErr);
      }
    }

    // 1. Setup Scene, Camera & WebGL Renderer
    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;

    const scene = new THREE.Scene();
    game.scene = scene;

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    game.camera = camera;

    const gLevel = parseInt(graphicsQuality.level) || 5;
    
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current!, antialias: graphicsQuality.antiAliasing, alpha: false });
    renderer.setSize(width, height);
    
    // Pixel ratio scaling based on graphics
    let dpr = 1.0;
    if (gLevel === 1) dpr = 0.1;
    else if (gLevel === 2) dpr = 0.2;
    else if (gLevel === 3) dpr = 0.4;
    else if (gLevel === 4) dpr = 0.6;
    else if (gLevel === 5) dpr = 1.0;
    else if (gLevel === 6) dpr = 1.0;
    else if (gLevel === 7) dpr = 1.2;
    else if (gLevel === 8) dpr = 1.5;
    else if (gLevel === 9) dpr = 2.0;
    else if (gLevel === 10) dpr = 3.0;
    
    renderer.setPixelRatio(dpr * graphicsQuality.resolutionScale);
    
    renderer.shadowMap.enabled = graphicsQuality.shadows;
    renderer.shadowMap.type = gLevel >= 7 ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
    game.renderer = renderer;

    // 2. Build the selected Low-Poly Map
    const mapData = buildMap(scene, config.mapId);
    game.colliders = mapData.colliders;
    game.spawnPoints = mapData.spawnPoints;

    // Setup map visual fog and lights
    scene.background = new THREE.Color(mapData.fogColor);
    scene.fog = new THREE.FogExp2(mapData.fogColor, mapData.fogDensity);

    const ambientLight = new THREE.AmbientLight(mapData.ambientColor, 0.5);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(mapData.directionalColor, 1.0);
    sunLight.position.set(30, 40, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 150;
    const d = 50;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    scene.add(sunLight);

    // Initial player placement
    const initialSpawn = getSafeSpawnPoint(game.spawnPoints, game.colliders);
    game.playerPos.copy(initialSpawn);
    camera.position.copy(game.playerPos);

    // Reset stats
    game.playerHealth = playerClass.maxHealth;
    game.playerMaxHealth = playerClass.maxHealth;
    game.playerKills = 0;
    game.playerDeaths = 0;
    game.playerScore = 0;
    game.playerHeadshots = 0;
    game.playerTimePlayedSeconds = 0;
    game.playerWeaponKills = {};
    game.playerIsDead = false;
    game.activeWeapon = playerClass.primaryWeapon;
    game.playerClip = game.activeWeapon.maxAmmo;
    game.playerReserve = game.activeWeapon.maxAmmo * 3;
    
    // Initialize ammo state for both weapons
    game.primaryAmmo = { clip: playerClass.primaryWeapon.maxAmmo, reserve: playerClass.primaryWeapon.maxAmmo * 3 };
    game.secondaryAmmo = { clip: playerClass.secondaryWeapon.maxAmmo, reserve: playerClass.secondaryWeapon.maxAmmo * 3 };

    game.isPrimary = true;
    game.isReloading = false;
    game.lastShotTime = -9999;
    game.isADS = false;
    game.isProne = false;
    game.currentCameraHeight = 1.5;
    game.abilityCooldown = 0;
    game.abilityActive = false;
    game.matchTimeLeft = config.timeLimit;

    onPlayerHealthUpdate(game.playerHealth, game.playerMaxHealth);
    onPlayerAmmoUpdate(game.playerClip, game.playerReserve);

    // 3. Rig Weapon Group to Camera (First Person Gun model)
    const weaponGroup = new THREE.Group();
    scene.add(weaponGroup);
    game.weaponGroup = weaponGroup;
    
    if (config.spectatorMode) {
      weaponGroup.visible = false;
    }

    /**
     * ============================================================================
     * ARCHITECTURAL DESIGN PASS 2 & PASS 3: HIGH-FIDELITY VIEWMODELS & MELEE VFX
     * - Crafts custom low-poly models for each weapon category (AR, Sniper, SMG, LMG, Shotgun, Pistol, Launcher, Melee).
     * - Rigged with a dynamic moving slide/bolt mesh (slideMesh) that kicks back on firing.
     * - Includes custom Melee models (Katana with glowing energy edge, Karambit, Dagger, Bat, Axe) and a Slash Arc Mesh.
     * - Adds articulated tactical gloves and sleeves.
     * ============================================================================
     */
    const buildFirstPersonWeapon = () => {
      buildHighQualityFirstPersonWeapon(game, weaponGroup, playerClass);
    };
    buildFirstPersonWeapon();

    // Setup muzzle flash visuals
    const flashGeo = new THREE.SphereGeometry(0.08, 4, 4);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffea00, transparent: true, opacity: 0 });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    scene.add(flash);
    game.muzzleFlash = flash;

    const flashLight = new THREE.PointLight(0xffcc00, 2.5, 6);
    scene.add(flashLight);
    game.muzzleFlashLight = flashLight;

    // 4. Spawn Bot Entities in Scene
    const bots: BotEntity[] = [];

    const spawnBot = (index: number): BotEntity => {
      const botName = BOT_NAMES[index % BOT_NAMES.length];
      const botClass = CLASSES[Math.floor(Math.random() * CLASSES.length)];
      const occupiedPositions = [game.playerPos, ...bots.map(b => b.position)];
      const botSpawn = getSafeSpawnPoint(game.spawnPoints, game.colliders, occupiedPositions);

      const meshGroup = new THREE.Group();

      // Assemble articulated CoD low-poly tactical soldier
      // 1. Legs (Pivotable around hip height y = 0.6)
      const legGeo = new THREE.BoxGeometry(0.28, 0.6, 0.3);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
      
      const leftLeg = new THREE.Mesh(legGeo, legMat);
      leftLeg.position.set(-0.24, 0.3, 0);
      leftLeg.castShadow = true;
      meshGroup.add(leftLeg);

      const rightLeg = new THREE.Mesh(legGeo, legMat);
      rightLeg.position.set(0.24, 0.3, 0);
      rightLeg.castShadow = true;
      meshGroup.add(rightLeg);

      // 2. Torso (Center y = 0.95)
      const torsoGeo = new THREE.BoxGeometry(0.85, 0.75, 0.5);
      const torsoMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(botClass.color),
        roughness: 0.8,
        flatShading: true
      });
      const torso = new THREE.Mesh(torsoGeo, torsoMat);
      torso.position.y = 0.95;
      torso.castShadow = true;
      torso.receiveShadow = true;
      meshGroup.add(torso);

      // Tactical chest pouch
      const pouchGeo = new THREE.BoxGeometry(0.25, 0.22, 0.12);
      const pouchMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
      const pouch = new THREE.Mesh(pouchGeo, pouchMat);
      pouch.position.set(0, 0.95, 0.28);
      meshGroup.add(pouch);

      // 3. Head & Helmet (y = 1.6)
      const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const headMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 1.6;
      head.castShadow = true;
      meshGroup.add(head);

      // Custom helmet features based on class
      if (botClass.id === 'assault') {
        const maskGeo = new THREE.BoxGeometry(0.44, 0.35, 0.08);
        const maskMat = new THREE.MeshBasicMaterial({ color: 0xf1f5f9 }); // White skull mask
        const mask = new THREE.Mesh(maskGeo, maskMat);
        mask.position.set(0, 1.6, 0.26);
        meshGroup.add(mask);
      } else if (botClass.id === 'recon') {
        const ghillieGeo = new THREE.BoxGeometry(0.58, 0.58, 0.58);
        const ghillieMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 1.0 });
        const ghillie = new THREE.Mesh(ghillieGeo, ghillieMat);
        ghillie.position.copy(head.position);
        meshGroup.add(ghillie);
      } else if (botClass.id === 'heavy') {
        const visorGeo = new THREE.BoxGeometry(0.44, 0.14, 0.08);
        const visorMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b }); // Gold visor
        const visor = new THREE.Mesh(visorGeo, visorMat);
        visor.position.set(0, 1.62, 0.26);
        meshGroup.add(visor);
      } else if (botClass.id === 'skirmisher') {
        const eyeGeo = new THREE.SphereGeometry(0.06, 4, 4);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xec4899 });
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.12, 1.6, 0.26);
        const eyeR = eyeL.clone();
        eyeR.position.x = 0.12;
        meshGroup.add(eyeL);
        meshGroup.add(eyeR);
      }

      // 4. Arms (Pivotable around shoulder height y = 1.15)
      const armGeo = new THREE.BoxGeometry(0.22, 0.65, 0.22);
      const armMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(botClass.color), roughness: 0.8 });
      
      const leftArm = new THREE.Mesh(armGeo, armMat);
      leftArm.position.set(-0.52, 1.15, 0);
      leftArm.castShadow = true;
      meshGroup.add(leftArm);

      const rightArm = new THREE.Mesh(armGeo, armMat);
      rightArm.position.set(0.52, 1.15, 0);
      rightArm.castShadow = true;
      meshGroup.add(rightArm);

      // 5. Bot 3D Weapon
      const botGun = buildThirdPersonWeapon(botClass.primaryWeapon.id);
      botGun.position.set(0.38, 1.05, 0.35);
      meshGroup.add(botGun);

      // Positioning the overall bot mesh group
      meshGroup.position.copy(botSpawn);
      scene.add(meshGroup);

      // Hitbox helper for headshots
      const botHeadBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.55, 0.55),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, wireframe: true })
      );
      botHeadBox.position.copy(head.position);
      meshGroup.add(botHeadBox);

      return {
        id: `bot_${index}`,
        name: botName,
        classConfig: botClass,
        activeWeapon: botClass.primaryWeapon,
        isPrimary: true,
        health: botClass.maxHealth,
        maxHealth: botClass.maxHealth,
        kills: 0,
        deaths: 0,
        score: 0,
        isDead: false,
        respawnTimer: 0,
        meshGroup,
        headMesh: botHeadBox,
        torsoMesh: torso,
        leftLeg,
        rightLeg,
        leftArm,
        rightArm,
        botGunMesh: botGun,
        walkAnimPhase: 0,
        flinchTimer: 0,
        position: botSpawn.clone(),
        velocity: new THREE.Vector3(),
        rotationY: Math.random() * Math.PI * 2,
        targetEntityId: null,
        targetSelectionTimer: 0,
        shootCooldownRemaining: 0,
        botClip: botClass.primaryWeapon.maxAmmo,
        botIsReloading: false,
        botReloadTimeRemaining: 0,
        patrolWaypoint: botSpawn.clone(),
        jumpTimer: 0
      };
    };

    // Choose bot classes randomly and model styles
    for (let i = 0; i < config.botCount; i++) {
      bots.push(spawnBot(i));
    }
    game.bots = bots;

    // Send initial scoreboard stats
    const updateScoreboard = () => {
      const otherPlayersStats: MatchStats[] = Array.from(game.otherPlayers.values()).filter((p: any) => !p.isSpectator).map((p: any) => ({
        id: p.id,
        name: p.name,
        isBot: false,
        classId: p.classId,
        kills: p.kills,
        deaths: p.deaths,
        assists: 0,
        score: p.score
      }));

      const statsList: MatchStats[] = [
        ...(config.spectatorMode ? [] : [{
          id: 'player',
          name: playerName,
          isBot: false,
          classId: playerClass.id,
          kills: game.playerKills,
          deaths: game.playerDeaths,
          assists: 0,
          score: game.playerScore,
          weaponKills: game.playerWeaponKills
        }]),
        ...otherPlayersStats,
        ...bots.map(b => ({
          id: b.id,
          name: b.name,
          isBot: true,
          classId: b.classConfig.id,
          kills: b.kills,
          deaths: b.deaths,
          assists: 0,
          score: b.score
        }))
      ];
      // Sort descending by score
      statsList.sort((a, b) => b.score - a.score);
      onStatsUpdate(statsList);
    };

    updateScoreboard();

    // 5. Particles Engine Instantiation (Low-poly flat cubes)
    const particleCount = 150;
    const pGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); // Use instanceColor
    const pInstanced = new THREE.InstancedMesh(pGeo, pMat, particleCount);
    pInstanced.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(particleCount * 3), 3);
    pInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(pInstanced);

    const particleData: { pos: THREE.Vector3; vel: THREE.Vector3; color: THREE.Color; life: number; maxLife: number }[] = [];
    for (let i = 0; i < particleCount; i++) {
      particleData.push({
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        color: new THREE.Color(),
        life: 0,
        maxLife: 0
      });
      // Set initial state below map
      const dummy = new THREE.Object3D();
      dummy.position.set(0, -999, 0);
      dummy.updateMatrix();
      pInstanced.setMatrixAt(i, dummy.matrix);
    }
    game.particles = pInstanced as any;
    game.particleData = particleData;

    const spawnParticles = (pos: THREE.Vector3, colorVal: string, count = 10) => {
      if (!graphicsQuality.particles) return;
      
      let spawned = 0;
      for (let i = 0; i < particleCount; i++) {
        if (spawned >= count) break;
        const p = particleData[i];
        if (p.life <= 0) {
          p.pos.copy(pos);
          p.vel.set(
            (Math.random() - 0.5) * 6,
            Math.random() * 5 + 1,
            (Math.random() - 0.5) * 6
          );
          p.color.set(colorVal);
          pInstanced.setColorAt(i, p.color);
          pInstanced.instanceColor!.needsUpdate = true;
          
          p.life = 1.0;
          p.maxLife = 0.5 + Math.random() * 0.5; // lifespan in seconds
          spawned++;
        }
      }
    };

    const spawnKillPopup = (pos: THREE.Vector3, text: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, 256, 128);
        ctx.font = 'bold 50px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 6;
        ctx.strokeText(text, 128, 64);
        
        ctx.fillStyle = '#facc15'; // Yellow
        ctx.fillText(text, 128, 64);
      }
      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
      const sprite = new THREE.Sprite(mat);
      sprite.position.copy(pos);
      sprite.scale.set(1.5, 0.75, 1);
      scene.add(sprite);
      game.killPopups.push({ sprite, life: 1.5, vy: 1.2 });
    };

    // 6. Handle Unified Mouse Look Controls (Pointer Lock & Drag-to-Look)
    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    const handleCanvasMouseDown = (e: MouseEvent) => {
      if (document.pointerLockElement === canvasRef.current) return;
      isDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    };

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (game.playerIsDead) return;

      const sens = parseFloat(localStorage.getItem('codm_camera_sens') || '1.0');
      const adsMult = parseFloat(localStorage.getItem('codm_ads_sens') || '0.5');
      const currentSensMult = (game.isADS ? adsMult : 1.0) * sens;

      if (document.pointerLockElement === canvasRef.current) {
        // Pointer Locked Movement
        const sensitivity = 0.0016 * currentSensMult;
        // Filter out massive spikes which cause the camera to snap randomly
        if (Math.abs(e.movementX) < 200) game.yaw -= e.movementX * sensitivity;
        if (Math.abs(e.movementY) < 200) game.pitch -= e.movementY * sensitivity;
      } else if (isDragging) {
        // Click-and-Drag Fallback Movement
        const deltaX = e.clientX - lastMouseX;
        const deltaY = e.clientY - lastMouseY;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;

        const dragSensitivity = 0.0025 * currentSensMult;
        game.yaw -= deltaX * dragSensitivity;
        game.pitch -= deltaY * dragSensitivity;
      }

      // Restrict pitch (look up/down limits)
      game.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, game.pitch));
    };

    const handleWindowMouseUp = (e: MouseEvent) => {
      isDragging = false;
      if (e.button === 0) { // Left click release
        game.isFiring = false;
        game.semiAutoFired = false;
      }
      if (e.button === 2) { // Right Click release (ADS zoom)
        game.isADS = false;
      }
    };

    // Keyboard Key listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      game.keys[key] = true;

      // Prevent default page scroll on space or arrow keys when focused
      if (key === ' ' || key === 'arrowup' || key === 'arrowdown' || key === 'arrowleft' || key === 'arrowright') {
        e.preventDefault();
      }

      const activeBinds = bindingsRef.current || {};
      const keyReload = activeBinds.reload || 'r';
      const keySwap = activeBinds.swap || 'c';
      const keyAbility = activeBinds.ability || 'q';
      const keyFire = activeBinds.fire || 'f';
      const keyAim = activeBinds.aim || 'e';

      // Hack Menu toggle key (7)
      if ((key === '7' || e.code === 'Digit7') && localStorage.getItem('cmd_perm_7') === 'true') {
        setShowHackMenu(prev => !prev);
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }
      }

      // Admin Cheat Menu toggle key (8)
      if ((key === '8' || e.code === 'Digit8') && (config.spectatorMode || localStorage.getItem('cmd_perm_8') === 'true')) {
        setShowAdminCheatMenu(prev => !prev);
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }
      }

      // Handle Reload weapon key
      if (key === keyReload && !game.isReloading && game.playerClip < game.activeWeapon.maxAmmo && !game.playerIsDead) {
        startReload();
      }

      // Weapon swap keys
      if (key === keySwap && !game.isReloading && !game.playerIsDead) {
        swapWeapon(!game.isPrimary);
      }
      if (key === '1' && !game.isReloading && !game.isPrimary && !game.playerIsDead) {
        swapWeapon(true);
      }
      if (key === '2' && !game.isReloading && game.isPrimary && !game.playerIsDead) {
        swapWeapon(false);
      }

      // Ability activation
      if (key === keyAbility && abilityReady && !game.playerIsDead) {
        activateAbility();
      }

      // Custom Fire key trigger
      if (key === keyFire && !game.playerIsDead) {
        game.wantsToFire = true;
        game.isFiring = true;
      }

      // Custom Aim In ADS toggle
      if (key === keyAim && !game.playerIsDead) {
        game.isADS = !game.isADS;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      game.keys[key] = false;

      const activeBinds = bindingsRef.current || {};
      const keyFire = activeBinds.fire || 'f';

      // Custom Fire key release
      if (key === keyFire) {
        game.isFiring = false;
        game.semiAutoFired = false;
      }
    };

    // Weapon swap handler with Pass 1 Ammo Preservation
    const swapWeapon = (primary: boolean) => {
      if (primary === game.isPrimary) return;

      // 1. Save currently active weapon's ammo state
      if (game.isPrimary) {
        game.primaryAmmo = { clip: game.playerClip, reserve: game.playerReserve };
      } else {
        game.secondaryAmmo = { clip: game.playerClip, reserve: game.playerReserve };
      }

      // 2. Switch slot
      game.isPrimary = primary;
      game.activeWeapon = primary ? playerClass.primaryWeapon : playerClass.secondaryWeapon;

      // 3. Restore remembered ammo state for newly active weapon slot
      const savedAmmo = primary ? game.primaryAmmo : game.secondaryAmmo;
      game.playerClip = savedAmmo.clip;
      game.playerReserve = savedAmmo.reserve;

      onWeaponChange(game.activeWeapon);
      onPlayerAmmoUpdate(game.playerClip, game.playerReserve);

      sounds.playReload();
      buildFirstPersonWeapon();
    };

    // Reload weapon handler
    const startReload = () => {
      if (game.playerReserve <= 0) return;
      game.isReloading = true;
      game.reloadTimeRemaining = game.activeWeapon.reloadTime;
      sounds.playReload();
    };

    // Ability triggers
    const activateAbility = () => {
      if (!abilityReady || game.abilityCooldown > 0 || game.playerIsDead) return;
      game.abilityActive = true;
      game.abilityActiveTimeRemaining = playerClass.ability.cooldown > 0 ? 5000 : 0; // 5s active time
      game.abilityCooldown = playerClass.ability.cooldown * 1000; // in ms
      setAbilityReady(false);
      sounds.playAbility();

      // Class specific immediate actions
      if (playerClass.id === 'assault') {
        // Heal
        game.playerHealth = Math.min(game.playerMaxHealth, game.playerHealth + 40);
        onPlayerHealthUpdate(game.playerHealth, game.playerMaxHealth);
      }

      onAbilityCooldownUpdate(playerClass.ability.cooldown);
    };

    // Shooting Mechanics
    const handleMouseDown = (e: MouseEvent) => {
      // If the overlay is active, don't allow shooting
      if (!document.pointerLockElement && document.getElementById('pointer-lock-overlay')) return;

      if (e.button === 0 && !game.playerIsDead) { // Left Click - Fire
        game.wantsToFire = true;
        game.isFiring = true;
      } else if (e.button === 2 && !game.playerIsDead) { // Right Click - ADS zoom
        game.isADS = true;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) { // Left Click release
        game.isFiring = false;
        game.semiAutoFired = false;
      } else if (e.button === 2) { // Right Click release
        game.isADS = false;
      }
    };

    const handleContextmenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Shoot weapon
    const fireWeapon = () => {
      const now = performance.now();
      const fireRate = hacksRef.current.rapidFire ? 15 : game.activeWeapon.fireRate;
      if (now - game.lastShotTime < fireRate) return;
      if (game.isReloading) return;

      const wep = game.activeWeapon;
      if (wep.burstCount && wep.burstDelay) {
        game.burstPending = hacksRef.current.rapidFire ? 0 : wep.burstCount - 1;
        game.burstTimer = wep.burstDelay;
      }
      executeShot(now);
    };

    const executeShot = (now: number) => {
      game.semiAutoFired = true;
      const isKnife = game.activeWeapon.type === 'KNIFE';

      // Pass 3: Melee attack animation trigger
      if (isKnife) {
        game.lastShotTime = now;
        game.meleeSwingProgress = 0.001;
        game.meleeHasHit = false;
        sounds.playShoot('KNIFE');
        return; // Melee hit trajectory evaluated during animation frame loop
      }

      if (game.playerClip <= 0) {
        sounds.playReload(); // Dry fire sound
        game.burstPending = 0;
        return;
      }

      game.lastShotTime = now;
      if (!hacksRef.current.unlimitedAmmo) {
        game.playerClip--;
      } else {
        game.playerClip = game.activeWeapon.maxAmmo;
      }
      
      // Save updated clip to active weapon slot
      if (game.isPrimary) {
        game.primaryAmmo.clip = game.playerClip;
      } else {
        game.secondaryAmmo.clip = game.playerClip;
      }
      onPlayerAmmoUpdate(game.playerClip, game.playerReserve);

      const isLauncher = game.activeWeapon.type === 'LAUNCHER';

      sounds.playShoot(game.activeWeapon.type);

      // Flash Effect & Dynamic Muzzle Point Light
      if (game.muzzleFlash && game.muzzleFlashLight) {
        (game.muzzleFlash.material as THREE.MeshBasicMaterial).opacity = 1.0;
        game.muzzleFlashLight.intensity = 3.5;
        game.muzzleFlashTimer = 60; // 60ms flash duration
        
        // Smoke puff
        const muzzlePos = new THREE.Vector3(0.2, -0.15, -1.2).applyQuaternion(camera.quaternion).add(camera.position);
        spawnParticles(muzzlePos, '#94a3b8', 4);
        spawnParticles(muzzlePos, '#fde047', 2); // Sparks
      }

      // Pass 2: Mechanical Slide Kickback
      game.slideKickback = 0.08;

      // Pass 2: Brass Shell Casing Ejection
      if (scene) {
        const casingGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.03, 6);
        const casingMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.9, roughness: 0.2 });
        const casingMesh = new THREE.Mesh(casingGeo, casingMat);
        casingMesh.rotation.z = Math.PI / 2;

        const portPos = new THREE.Vector3(0.22, -0.18, -0.4).applyQuaternion(camera.quaternion).add(camera.position);
        casingMesh.position.copy(portPos);
        scene.add(casingMesh);

        const rightDir = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        const upDir = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
        const fwdDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);

        const vel = rightDir.clone().multiplyScalar(2.0 + Math.random() * 0.8)
          .add(upDir.clone().multiplyScalar(1.2 + Math.random() * 0.5))
          .add(fwdDir.clone().multiplyScalar(-0.4));

        game.shellCasings.push({
          mesh: casingMesh,
          vel,
          rotVel: new THREE.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10),
          life: 0
        });
      }

      // Hitscan Raycasting
      const raycaster = new THREE.Raycaster();
      // Center of screen raycast
      const centerCoords = new THREE.Vector2(0, 0);
      
      // Ensure camera is perfectly aimed at the user's latest mouse position before raycasting
      camera.position.copy(game.playerPos);
      camera.rotation.set(game.pitch, game.yaw, 0, 'YXZ');
      camera.updateMatrixWorld(true);
      
      raycaster.setFromCamera(centerCoords, camera);

      // Pass 5: Camera & Viewmodel Recoil Impulse (Applied AFTER raycast so first shot is accurate)
      if (!hacksRef.current.noRecoil) {
        game.recoilOffset.z = 0.06 * game.activeWeapon.recoil;
        game.recoilRot.x = (Math.random() * 0.06 + 0.06) * game.activeWeapon.recoil;
        game.recoilRot.y = (Math.random() - 0.5) * 0.03 * game.activeWeapon.recoil;
        game.pitch += (Math.random() * 0.05 + 0.05) * game.activeWeapon.recoil;
      }

      // Perform shot checks (Headshot vs standard body vs wall collision)
      const targets: { bot: BotEntity; part: 'head' | 'body'; mesh: THREE.Mesh }[] = [];
      const onlineTargets: { playerObj: any; part: 'head' | 'body'; mesh: THREE.Mesh }[] = [];
      const targetMeshes: THREE.Object3D[] = [];

      // Collect bot hit meshes
      bots.forEach(b => {
        if (b.isDead) return;
        b.meshGroup.traverse(child => {
          if (child instanceof THREE.Mesh) {
            targetMeshes.push(child);
            if (child === b.headMesh) {
              targets.push({ bot: b, part: 'head', mesh: child });
            } else if (child.parent === b.meshGroup && child !== b.headMesh) {
              targets.push({ bot: b, part: 'body', mesh: child });
            }
          }
        });
      });

      // Collect online player hit meshes
      game.otherPlayers.forEach(p => {
        if (p.health <= 0 || !p.meshGroup.visible) return; // Do not hit dead online players
        if (p.headMesh) {
          targetMeshes.push(p.headMesh);
          onlineTargets.push({ playerObj: p, part: 'head', mesh: p.headMesh });
        }
        if (p.torsoMesh) {
          targetMeshes.push(p.torsoMesh);
          onlineTargets.push({ playerObj: p, part: 'body', mesh: p.torsoMesh });
        }
      });

      // Add map colliders
      const colliderMeshes = game.colliders.map(c => c.mesh);
      const allObjects = [...targetMeshes, ...colliderMeshes];

      const intersects = raycaster.intersectObjects(allObjects);

      let hitPoint = camera.position.clone().add(raycaster.ray.direction.clone().multiplyScalar(game.activeWeapon.range));

      if (intersects.length > 0 && intersects[0].distance <= game.activeWeapon.range) {
        let hit = intersects[0];

        // Wallhack Hack (Fire Through Walls): bypass wall/crate colliders to penetrate targets
        if (hacksRef.current.wallhack && !isKnife && !isLauncher) {
          const targetHit = intersects.find(i =>
            targets.some(t => t.mesh === i.object) || onlineTargets.some(t => t.mesh === i.object)
          );
          if (targetHit && targetHit.distance <= game.activeWeapon.range) {
            hit = targetHit;
          }
        }

        hitPoint.copy(hit.point);

        const hitDist = camera.position.distanceTo(hitPoint);
        let distanceMultiplier = 1.0;
        const wType = game.activeWeapon.type;
        const maxRange = game.activeWeapon.range || 100;

        if (wType === 'SNIPER') {
          distanceMultiplier = 1.0; // Snipers maintain damage perfectly at all distances
        } else if (wType === 'SHOTGUN') {
          // Shotguns do WAY less damage at further distance
          const ratio = Math.min(1.0, hitDist / Math.max(8, maxRange * 0.4));
          distanceMultiplier = Math.max(0.1, 1.0 - ratio * 0.9);
        } else if (wType === 'SMG') {
          // SMGs lose damage from further away, faster fire rate gets harsher drop-off
          const fireRatePenalty = game.activeWeapon.fireRate < 90 ? 0.7 : 0.85;
          const ratio = Math.min(1.0, hitDist / Math.max(12, maxRange * 0.55));
          distanceMultiplier = Math.max(0.2, (1.0 - ratio * 0.8) * fireRatePenalty);
        } else if (wType === 'AR' || wType === 'LMG') {
          // ARs lose some damage from further away
          const fireRatePenalty = game.activeWeapon.fireRate < 120 ? 0.85 : 1.0;
          const ratio = Math.min(1.0, hitDist / Math.max(25, maxRange * 0.75));
          distanceMultiplier = Math.max(0.35, (1.0 - ratio * 0.65) * fireRatePenalty);
        } else {
          const ratio = Math.min(1.0, hitDist / maxRange);
          distanceMultiplier = Math.max(0.3, 1.0 - ratio * 0.7);
        }

        const effectiveDamage = game.activeWeapon.damage * distanceMultiplier;

        if (isLauncher) {
          // Area of Effect explosion logic
          const explosionRadius = 6;
          spawnParticles(hitPoint, '#ef4444', 30); // Big explosion flash
          spawnParticles(hitPoint, '#f97316', 20);

          bots.forEach(b => {
            if (b.isDead) return;
            const dist = b.position.distanceTo(hit.point);
            if (dist < explosionRadius) {
              let dmg = (effectiveDamage * (1 - dist / explosionRadius));
              if (hacksRef.current.oneShot) dmg = 9999;
              damageBot(b, dmg, false);
            }
          });
        } else {
          // Check if we hit a bot
          const botHit = targets.find(t => t.mesh === hit.object);
          const onlineHit = onlineTargets.find(t => t.mesh === hit.object);

          if (botHit) {
            const isHead = botHit.part === 'head' && !isKnife;
            let finalDamage = isHead ? effectiveDamage * 2 : effectiveDamage;
            if (hacksRef.current.oneShot) finalDamage = 9999;
            damageBot(botHit.bot, finalDamage, isHead);
          } else if (onlineHit) {
            const isHead = onlineHit.part === 'head' && !isKnife;
            let finalDamage = isHead ? effectiveDamage * 2 : effectiveDamage;
            if (hacksRef.current.oneShot) finalDamage = 9999;

            if (socket && socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({
                type: 'hit',
                payload: {
                  targetId: onlineHit.playerObj.id,
                  damage: finalDamage,
                  isHeadshot: isHead,
                  weaponName: game.activeWeapon.name,
              isNoscope: game.activeWeapon.type === "sniper" && !game.isADS
                }
              }));
            }
            if (isHead) {
              sounds.playHeadshot();
              onHitmarker?.('head');
            } else {
              sounds.playHit();
              onHitmarker?.('body');
            }
            spawnParticles(hitPoint, '#f43f5e', 10);
          } else if (!isKnife) {
            // Hit a wall/crate - spawn yellow sparks
            spawnParticles(hitPoint, '#facc15', 6);
          }
        }
      }

      if (!isKnife) {
        // Spawn tracer line (muzzle tip to hit point)
        createTracerLine(hitPoint);

        // WebSocket Multiplayer Shoot Sync
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: 'shoot',
            payload: {
              target: { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z },
              weaponType: game.activeWeapon.type
            }
          }));
        }
      }
    };

    const awardKillAmmo = () => {
      const isLauncher = game.activeWeapon.type === 'LAUNCHER';
      const ammoAward = isLauncher ? 1 : 5;
      
      if (playerClass.primaryWeapon) {
        const primaryMaxReserve = playerClass.primaryWeapon.maxAmmo * 3;
        game.primaryAmmo.reserve = Math.min(game.primaryAmmo.reserve + ammoAward, primaryMaxReserve);
      }
      
      if (playerClass.secondaryWeapon) {
        const secondaryMaxReserve = playerClass.secondaryWeapon.maxAmmo * 3;
        game.secondaryAmmo.reserve = Math.min(game.secondaryAmmo.reserve + ammoAward, secondaryMaxReserve);
      }
      
      if (game.isPrimary) {
        game.playerReserve = game.primaryAmmo.reserve;
      } else {
        game.playerReserve = game.secondaryAmmo.reserve;
      }
      onPlayerAmmoUpdate(game.playerClip, game.playerReserve);
    };

    const damageBot = (bot: BotEntity, damage: number, isHeadshot: boolean) => {
      if (bot.isDead) return;

      // Shield protection check for Bulwark
      let actualDamage = damage;
      // If Bulwark is active or generic protection
      if (bot.classConfig.id === 'heavy' && Math.random() < 0.25) {
        actualDamage *= 0.5; // shield block
      }
      const cheats = getHacksFor(bot.id);
      if (cheats.godMode) return;
      bot.health -= actualDamage;

      // Track damage received by bot from human player
      if (!bot.damageReceivedMap) bot.damageReceivedMap = new Map();
      bot.damageReceivedMap.set('player', (bot.damageReceivedMap.get('player') || 0) + actualDamage);

      if (isHeadshot) {
        sounds.playHeadshot();
        onHitmarker?.('head');
      } else {
        sounds.playHit();
        onHitmarker?.('body');
      }
      spawnParticles(bot.meshGroup.position.clone().setY(isHeadshot ? 1.8 : 1.0), '#f43f5e', 10); // red blood particles

      if (bot.health <= 0) {
        bot.isDead = true;
        bot.deaths++;
        bot.respawnTimer = 3500; // 3.5s respawn

        game.playerKills++;
        if (isHeadshot) game.playerHeadshots = (game.playerHeadshots || 0) + 1;
        game.playerWeaponKills[game.activeWeapon.id] = (game.playerWeaponKills[game.activeWeapon.id] || 0) + 1;
        awardKillAmmo();
        game.playerScore += isHeadshot ? 150 : 100;
        sounds.playKill();
        const isSniper = game.activeWeapon.type === 'sniper';
              const isNoscope = isSniper && !game.isADS;
              if (isNoscope && isHeadshot) triggerMedal("NOSCOPE HEADSHOT!", 'noscope_headshot');
              else if (isNoscope) triggerMedal("NOSCOPE", 'noscope');
              else if (isHeadshot) triggerMedal("HEADSHOT", 'headshot');
              else triggerMedal("KILL", 'kill');
              
              setKillStreak(prev => {
                const next = prev + 1;
                if (next > 1) {
                  triggerMedal(`STREAK x${next}!`, 'streak');
                }
                return next;
              });


        spawnKillPopup(bot.position.clone().setY(2.0), isHeadshot ? "HEADSHOT!" : "KILL");

        // Push killfeed
        onKillFeedUpdate({
          id: `feed_${performance.now()}`,
          killer: { name: playerName, classId: playerClass.id, isBot: false },
          victim: { name: bot.name, classId: bot.classConfig.id, isBot: true },
          weaponName: game.activeWeapon.name,
          isHeadshot,
          time: Date.now()
        });

        // WebSocket Multiplayer Sync
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: 'bot_death_sync',
            payload: {
              killerId: clientId,
              killerName: playerName,
              killerIsBot: false,
              victimName: bot.name,
              victimClassId: bot.classConfig.id,
              weaponName: game.activeWeapon.name,
              isHeadshot,
              isNoscope: game.activeWeapon.type === "sniper" && !game.isADS
            }
          }));
        }

        updateScoreboard();

        // Animate bot death (fall flat)
        bot.meshGroup.rotation.x = Math.PI / 2;
        bot.meshGroup.position.y = 0.2;
      }
    };

    const createTracerLine = (targetPos: THREE.Vector3) => {
      // Find approximate muzzle barrel world position dynamically from the weaponMesh's matrix
      let mPos = new THREE.Vector3(0, 0.01, -0.30);
      if (game.weaponMesh) {
        if (game.weaponGroup) {
          game.weaponGroup.position.copy(camera.position);
          game.weaponGroup.quaternion.copy(camera.quaternion);
          game.weaponGroup.updateMatrixWorld(true);
        }
        const muzzleObj = game.weaponMesh.getObjectByName('muzzlePoint');
        if (muzzleObj) {
          mPos.copy(muzzleObj.position);
        }
        game.weaponMesh.updateMatrixWorld(true);
        mPos.applyMatrix4(game.weaponMesh.matrixWorld);
      } else if (camera) {
        mPos.applyMatrix4(camera.matrixWorld);
      }

      const points = [mPos, targetPos];
      const traceGeo = new THREE.BufferGeometry().setFromPoints(points);
      const traceMat = new THREE.LineBasicMaterial({
        color: 0xffea00,
        transparent: true,
        opacity: 0.8
      });
      const line = new THREE.Line(traceGeo, traceMat);
      scene.add(line);

      game.tracers.push({ line, age: 0, maxAge: 120 }); // lasts 120ms
    };

    // Player takes damage from bots
    const damagePlayer = (bot: BotEntity, damage: number) => {
      if (game.playerIsDead) return;
      if (hacksRef.current.godMode) return; // Invincible!

      // Nano Barrier ability check (reduces damage by 50%)
      let finalDamage = damage;
      if (game.abilityActive && playerClass.id === 'heavy') {
        finalDamage *= 0.5;
      }

      game.playerHealth -= finalDamage;
      
      // Track damage dealt by bot to human player
      if (!bot.damageDealtMap) bot.damageDealtMap = new Map();
      bot.damageDealtMap.set('player', (bot.damageDealtMap.get('player') || 0) + finalDamage);

      sounds.playHurt();
      onPlayerHealthUpdate(game.playerHealth, game.playerMaxHealth);

      if (game.playerHealth <= 0) {
        game.playerIsDead = true;
        game.playerDeaths++;
        game.playerHealth = 0;
        game.playerRespawnTimer = 4000; // 4 seconds CoD style camera spectating

        const isHeadshot = Math.random() < 0.2;

        // Push killfeed
        onKillFeedUpdate({
          id: `feed_${performance.now()}`,
          killer: { name: bot.name, classId: bot.classConfig.id, isBot: true },
          victim: { name: playerName, classId: playerClass.id, isBot: false },
          weaponName: bot.activeWeapon.name,
          isHeadshot,
          time: Date.now()
        });

        // WebSocket Multiplayer Sync
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: 'elimination',
            killer: { name: bot.name, classId: bot.classConfig.id },
            victim: { name: playerName, classId: playerClass.id },
            weaponName: bot.activeWeapon.name,
            isHeadshot,
            isNoscope: false // Bots don't noscope
          }));
        }

        // Let loose pointer lock on death
        document.exitPointerLock();

        updateScoreboard();
      }
    };

    // Register UI & Document Mouse listeners
    if (canvasRef.current) {
      canvasRef.current.addEventListener('mousedown', handleCanvasMouseDown);
      canvasRef.current.addEventListener('mousedown', handleMouseDown);
      canvasRef.current.addEventListener('contextmenu', handleContextmenu);
    }
    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // 7. Core Match Timer Countdown Clock
    const timerInterval = setInterval(() => {
      if (config.isMultiplayer) return; // In multiplayer, match time is server-authoritative via time_sync

      game.matchTimeLeft--;
      onMatchTimerUpdate(game.matchTimeLeft);

      if (game.matchTimeLeft <= 0) {
        // Time over! End match.
        endMatch();
      }
    }, 1000);

    const endMatch = () => {
      clearInterval(timerInterval);
      if (game.frameId) cancelAnimationFrame(game.frameId);

      const otherPlayersStats: MatchStats[] = Array.from(game.otherPlayers.values()).filter((p: any) => !p.isSpectator).map((p: any) => ({
        id: p.id,
        name: p.name,
        isBot: false,
        classId: p.classId,
        kills: p.kills,
        deaths: p.deaths,
        assists: 0,
        score: p.score
      }));

      const statsList: MatchStats[] = [
        ...(config.spectatorMode ? [] : [{
          id: 'player',
          name: playerName,
          isBot: false,
          classId: playerClass.id,
          kills: game.playerKills,
          deaths: game.playerDeaths,
          assists: 0,
          score: game.playerScore,
          headshots: game.playerHeadshots || 0,
          timePlayedSeconds: Math.floor(game.playerTimePlayedSeconds || 0),
          weaponKills: game.playerWeaponKills
        }]),
        ...otherPlayersStats,
        ...bots.map(b => ({
          id: b.id,
          name: b.name,
          isBot: true,
          classId: b.classConfig.id,
          kills: b.kills,
          deaths: b.deaths,
          assists: 0,
          score: b.score
        }))
      ];
      statsList.sort((a, b) => b.score - a.score);

      const isVictory = statsList[0].id === 'player';
      sounds.playMatchEnd(isVictory);

      onMatchEnd(statsList);
    };

    // Check if score limit reached
    const checkWinCondition = () => {
      if (config.isMultiplayer) return false; // In multiplayer, match_ended is sent by the server

      if (game.playerKills >= game.scoreLimit) {
        endMatch();
        return true;
      }
      for (const p of game.otherPlayers.values()) {
        if (p.kills >= game.scoreLimit) {
          endMatch();
          return true;
        }
      }
      for (const b of bots) {
        if (b.kills >= game.scoreLimit) {
          endMatch();
          return true;
        }
      }
      return false;
    };

    // 8. Dynamic Frame Loop (Engine Physics & Animations)
    let lastFrameTime = performance.now();

    const animate = () => {
      const time = performance.now();
      // Cap delta time to prevent physics/visual explosions on lag spikes (e.g. initial click/pointer lock)
      const delta = Math.min((time - lastFrameTime) / 1000, 0.05);
      lastFrameTime = time;

      // Handle Reload Timers
      if (game.isReloading) {
        game.reloadTimeRemaining -= delta * 1000;
        if (game.reloadTimeRemaining <= 0) {
          game.isReloading = false;
          // Replenish clip
          const needed = game.activeWeapon.maxAmmo - game.playerClip;
          const transferred = Math.min(needed, game.playerReserve);
          game.playerClip += transferred;
          game.playerReserve -= transferred;
          onPlayerAmmoUpdate(game.playerClip, game.playerReserve);
        }
      }

      // Hack: Auto Heal
      if (hacksRef.current.autoHeal && !game.playerIsDead && game.playerHealth < 100) {
        game.playerHealth = Math.min(100, game.playerHealth + delta * 250); // Heal full in ~0.4s
      }

      // Sync touch firing
      if (useTouchControls && touchInputsRef && touchInputsRef.current) {
        const keyFire = (bindingsRef.current || {}).fire || 'f';
        if (touchInputsRef.current.keys[keyFire] && !game.isFiring) {
          game.wantsToFire = true;
          game.isFiring = true;
        } else if (touchInputsRef.current.keys[keyFire]) {
          game.isFiring = true;
        } else if (touchInputsRef.current.keys[keyFire] === false && game.isFiring) {
          game.isFiring = false;
          game.semiAutoFired = false;
        }
      }

      // Burst fire handling
      if (game.burstPending > 0 && !game.playerIsDead) {
        game.burstTimer -= delta * 1000;
        if (game.burstTimer <= 0) {
          game.burstPending--;
          game.burstTimer = game.activeWeapon.burstDelay || 50;
          executeShot(performance.now());
        }
      } else if ((game.isFiring || game.wantsToFire) && !game.playerIsDead) {
        const isAuto = game.activeWeapon.type === 'AR' || game.activeWeapon.type === 'LMG' || game.activeWeapon.type === 'SMG' || game.activeWeapon.name.includes('Auto') || hacksRef.current.fullAuto;
        if (isAuto || !game.semiAutoFired || game.wantsToFire) {
          fireWeapon();
          game.wantsToFire = false;
        }
      }

      // Handle Ability Cooldowns
      if (!abilityReady && game.abilityCooldown > 0) {
        game.abilityCooldown -= delta * 1000;
        if (game.abilityCooldown <= 0) {
          setAbilityReady(true);
          game.abilityCooldown = 0;
        }
      }

      if (game.abilityActive) {
        game.abilityActiveTimeRemaining -= delta * 1000;
        if (game.abilityActiveTimeRemaining <= 0) {
          game.abilityActive = false;
        }
      }

      // Player Respawn
      if (game.playerIsDead) {
        game.playerRespawnTimer -= delta * 1000;
        if (game.playerRespawnTimer <= 0) {
          // Respawn at safe point away from bots
          const occupiedPositions = bots.filter(b => !b.isDead).map(b => b.position);
          const spawn = getSafeSpawnPoint(game.spawnPoints, game.colliders, occupiedPositions);
          game.playerPos.copy(spawn);
          camera.position.copy(game.playerPos);
          game.playerHealth = game.playerMaxHealth;
          game.playerIsDead = false;
          game.playerClip = game.activeWeapon.maxAmmo;
          onPlayerHealthUpdate(game.playerHealth, game.playerMaxHealth);
          onPlayerAmmoUpdate(game.playerClip, game.playerReserve);
          sounds.playReload();
        }
      }

      // 1. Rig First Person Weapons (Position lock, Recoil return & Bobbing/Swaying)
      if (game.weaponGroup && !game.playerIsDead) {
        // Set position relative to camera
        game.weaponGroup.position.copy(camera.position);
        
        // Weapon look sway/lag (tight camera follow)
        const targetQuat = camera.quaternion.clone();
        game.weaponGroup.quaternion.slerp(targetQuat, 45 * delta);

        // Recoil is applied at the end now

        // Calculate dynamic walking bobbing & swaying vectors
        const speed2D = Math.sqrt(game.playerVel.x * game.playerVel.x + game.playerVel.z * game.playerVel.z);
        const bobY = (speed2D > 0.1 && !game.isADS) ? Math.sin(time * 0.01) * 0.012 : 0;
        const bobX = (speed2D > 0.1 && !game.isADS) ? Math.cos(time * 0.005) * 0.008 : 0;

        // ADS Lerping (When scoped, lerp gun to center)
        const targetX = game.isADS ? 0 : (0.18 + bobX);
        const targetY = game.isADS ? -0.11 : (-0.22 + bobY);
        const targetZ = game.isADS ? -0.32 : (-0.45 - game.recoilOffset.z);

        if (game.weaponMesh && game.meleeSwingProgress === 0) {
          game.weaponMesh.position.x += (targetX - game.weaponMesh.position.x) * 0.18;
          game.weaponMesh.position.y += (targetY - game.weaponMesh.position.y) * 0.18;
          game.weaponMesh.position.z += (targetZ - game.weaponMesh.position.z) * 0.18;
        }

        // Camera FOV Lerp (ADS zoom)
        const targetFov = game.isADS ? game.activeWeapon.zoomFov : 75;
        if (camera.fov !== targetFov) {
          camera.fov += (targetFov - camera.fov) * 0.15;
          camera.updateProjectionMatrix();
        }
      }

      // Pass 2 & 5: Slide Kickback Return & Viewmodel Recoil Interpolation
      if (game.slideMesh) {
        if (game.slideKickback > 0) {
          game.slideKickback = Math.max(0, game.slideKickback - delta * 0.8);
          game.slideMesh.position.z = -game.slideKickback;
        } else {
          game.slideMesh.position.z = 0;
        }
      }

      // Exponential decay on recoil offsets
      game.recoilOffset.lerp(new THREE.Vector3(), 15 * delta);
      game.recoilRot.lerp(new THREE.Vector3(), 15 * delta);

      // Pass 3: Melee Attack Swing Motion & Arc Evaluation
      if (game.meleeSwingProgress > 0) {
        game.meleeSwingProgress += delta / 0.28; // 280ms duration
        const p = game.meleeSwingProgress;

        if (game.weaponMesh) {
          // Trajectory: 0 -> 0.3 windup back right, 0.3 -> 0.7 slash left, 0.7 -> 1.0 recover
          if (p < 0.3) {
            const t = p / 0.3;
            game.weaponMesh.position.x = 0.18 + t * 0.12;
            game.weaponMesh.rotation.y = -t * 0.5;
            game.weaponMesh.rotation.z = t * 0.3;
          } else if (p < 0.7) {
            const t = (p - 0.3) / 0.4;
            game.weaponMesh.position.x = 0.30 - t * 0.45;
            game.weaponMesh.position.y = -0.15 - Math.sin(t * Math.PI) * 0.1;
            game.weaponMesh.position.z = -0.35 + Math.sin(t * Math.PI) * 0.15;
            game.weaponMesh.rotation.y = -0.5 + t * 1.2;
            game.weaponMesh.rotation.z = 0.3 - t * 0.8;
            game.weaponMesh.rotation.x = -Math.sin(t * Math.PI) * 0.6;
          } else {
            const t = (p - 0.7) / 0.3;
            game.weaponMesh.position.x = -0.15 + t * 0.33;
            game.weaponMesh.position.y = -0.25 + (1 - t) * 0.03;
            game.weaponMesh.position.z = -0.35 - (1 - t) * 0.1;
            game.weaponMesh.rotation.set(0, 0, 0);
          }
        }

        // Show crescent slash arc
        if (game.slashMesh) {
          const slashMat = game.slashMesh.material as THREE.MeshBasicMaterial;
          if (p >= 0.25 && p <= 0.75) {
            slashMat.opacity = Math.sin(((p - 0.25) / 0.5) * Math.PI) * 0.85;
            game.slashMesh.rotation.z = (p - 0.25) * 2.5;
          } else {
            slashMat.opacity = 0;
          }
        }

        // Melee hit check at apex (p >= 0.45)
        if (p >= 0.45 && !game.meleeHasHit && !game.playerIsDead) {
          game.meleeHasHit = true;
          const range = game.activeWeapon.range || 3.5;
          const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);

          bots.forEach(b => {
            if (b.isDead) return;
            const toBot = b.position.clone().add(new THREE.Vector3(0, 1.0, 0)).sub(camera.position);
            const dist = toBot.length();
            if (dist <= range && forward.angleTo(toBot) < 0.8) {
              damageBot(b, game.activeWeapon.damage, false);
              b.flinchTimer = 0.15;
              spawnParticles(b.position.clone().add(new THREE.Vector3(0, 1.2, 0)), '#f43f5e', 15);
              sounds.playHeadshot();

              if (b.health <= 0) {
                b.isDead = true;
                b.respawnTimer = 3500;
                b.deaths++;
                game.playerKills++;
                game.playerWeaponKills[game.activeWeapon.id] = (game.playerWeaponKills[game.activeWeapon.id] || 0) + 1;
                awardKillAmmo();
                game.playerScore += 100;
                onKillFeedUpdate({
                  id: `feed_${performance.now()}`,
                  killer: { name: playerName, classId: playerClass.id, isBot: false },
                  victim: { name: b.name, classId: b.classConfig.id, isBot: true },
                  weaponName: game.activeWeapon.name,
                  isHeadshot: true,
                  time: Date.now()
                });
                sounds.playKill();
                triggerMedal("MELEE", 'kill');
  
              setKillStreak(prev => {
                const next = prev + 1;
                if (next > 1) {
                  triggerMedal(`STREAK x${next}!`, 'streak');
                }
                return next;
              });

                spawnKillPopup(b.position.clone().setY(2.0), "MELEE KILL");
                updateScoreboard();
                checkWinCondition();
              }
            }
          });
        }

        if (p >= 1.0) {
          game.meleeSwingProgress = 0;
          if (game.slashMesh) {
            (game.slashMesh.material as THREE.MeshBasicMaterial).opacity = 0;
          }
        }
      }

      // Shell Casings Physics Simulation
      for (let i = game.shellCasings.length - 1; i >= 0; i--) {
        const c = game.shellCasings[i];
        c.life += delta;
        if (c.life > 1.8) {
          scene.remove(c.mesh);
          c.mesh.geometry.dispose();
          game.shellCasings.splice(i, 1);
        } else {
          c.vel.y -= 9.8 * delta; // Gravity
          c.mesh.position.addScaledVector(c.vel, delta);
          c.mesh.rotation.x += c.rotVel.x * delta;
          c.mesh.rotation.y += c.rotVel.y * delta;

          // Ground bounce
          if (c.mesh.position.y < 0.02) {
            c.mesh.position.y = 0.02;
            c.vel.y = -c.vel.y * 0.4;
            c.vel.x *= 0.6;
            c.vel.z *= 0.6;
          }
        }
      }

      // AIMBOT HACK (ALWAYS, ADS ONLY, or FOV CIRCLE)
      const isAimbotActive = hacksRef.current.aimbotMode === 'ALWAYS' ||
                            (hacksRef.current.aimbotMode === 'ADS_ONLY' && game.isADS) ||
                            (hacksRef.current.aimbotMode === 'FOV_CIRCLE' && game.isADS);

      if (isAimbotActive && !game.playerIsDead) {
        let closestDist = 9999;
        let smallestAngle = 0.25; // FOV radius ~14 degrees
        let targetHeadPos: THREE.Vector3 | null = null;
        
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);

        const checkAimbotTarget = (entity: any) => {
          // Both bots and otherPlayers use .meshGroup.position which reliably represents ground level.
          const basePos = entity.meshGroup.position;
          const targetHeight = hacksRef.current.aimbotTarget === 'BODY' ? 0.8 : 1.3;
          const targetPos = basePos.clone().add(new THREE.Vector3(0, targetHeight, 0));
          const dist = game.playerPos.distanceTo(targetPos);
          
          if (hacksRef.current.aimbotMode === 'FOV_CIRCLE') {
            const toTarget = targetPos.clone().sub(camera.position).normalize();
            const angle = camDir.angleTo(toTarget);
            if (angle < smallestAngle) {
              smallestAngle = angle;
              targetHeadPos = targetPos;
            }
          } else {
            if (dist < closestDist) {
              closestDist = dist;
              targetHeadPos = targetPos;
            }
          }
        };

        bots.forEach(b => {
          if (b.isDead) return;
          checkAimbotTarget(b);
        });

        game.otherPlayers.forEach(p => {
          if (p.health && p.health <= 0) return;
          if (p.isSpectator) return;
          checkAimbotTarget(p);
        });

        if (targetHeadPos) {
          // Calculate the direction from the camera (eye level) to the target head
          const dir = targetHeadPos.clone().sub(camera.position);
          const targetYaw = Math.atan2(-dir.x, -dir.z);
          const xzDist = Math.sqrt(dir.x * dir.x + dir.z * dir.z);
          const targetPitch = Math.atan2(dir.y, xzDist);

          let yawDiff = targetYaw - game.yaw;
          while (yawDiff > Math.PI) yawDiff -= 2 * Math.PI;
          while (yawDiff < -Math.PI) yawDiff += 2 * Math.PI;

          game.yaw += yawDiff;
          game.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, targetPitch));
        }
      } else if (!game.playerIsDead) {
        // TACTICAL AIM ASSIST SYSTEM (LIGHT or HEAVY)
        const aimAssistMode = localStorage.getItem('codm_aim_assist') || 'OFF';
        if (aimAssistMode !== 'OFF') {
          const camDir = new THREE.Vector3();
          camera.getWorldDirection(camDir);

          let bestTarget: THREE.Vector3 | null = null;
          let smallestAngle = aimAssistMode === 'HEAVY' ? 0.15 : 0.08; // radians

          const checkEntity = (entity: any, health: number, maxHealth: number) => {
            if (health < maxHealth) return; // Stop aim assist once target takes damage

            const basePos = entity.meshGroup.position;
            const targetPos = basePos.clone().add(new THREE.Vector3(0, 1.2, 0)); // Center chest
            const toTarget = targetPos.clone().sub(camera.position).normalize();
            const angle = camDir.angleTo(toTarget);

            if (angle < smallestAngle) {
              // Line-of-sight check
              const ray = new THREE.Raycaster(camera.position, toTarget);
              const obstacleHits = ray.intersectObjects(game.colliders.map(c => c.mesh));
              const distToEntity = camera.position.distanceTo(targetPos);

              if (obstacleHits.length === 0 || obstacleHits[0].distance >= distToEntity - 0.5) {
                smallestAngle = angle;
                bestTarget = targetPos;
              }
            }
          };

          bots.forEach(b => { if (!b.isDead) checkEntity(b, b.health, b.maxHealth); });
          game.otherPlayers.forEach(p => checkEntity(p, p.health || 100, 100)); // multiplayer placeholder

          if (bestTarget) {
            const dir = (bestTarget as THREE.Vector3).clone().sub(camera.position);
            const targetYaw = Math.atan2(-dir.x, -dir.z);
            const xzDist = Math.sqrt(dir.x * dir.x + dir.z * dir.z);
            const targetPitch = Math.atan2(dir.y, xzDist);

            let yawDiff = targetYaw - game.yaw;
            while (yawDiff > Math.PI) yawDiff -= 2 * Math.PI;
            while (yawDiff < -Math.PI) yawDiff += 2 * Math.PI;

            const pullSpeed = (aimAssistMode === 'HEAVY' ? 1.5 : 0.6) * delta;
            game.yaw += yawDiff * pullSpeed;
            game.pitch += (targetPitch - game.pitch) * pullSpeed;
            game.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, game.pitch));
          }
        }
      }

      // ESP: Enable depth-test bypass on entity meshes for visual wall vision
      
      // Helper function to get effective hacks for any entity (player or bot)
      const getHacksFor = (entityId: string) => {
        if (entityId === clientId || entityId === 'player') return hacksRef.current;
        return adminTargetCheatsRef.current[entityId] || {};
      };

      const isEspFull = hacksRef.current.espMode === 'FULL_BODY';
      
      const updateEspBox = (entityObj: any, isDead: boolean) => {
        const entityHacks = entityObj.id ? getHacksFor(entityObj.id) : hacksRef.current;
        const espMode = entityHacks.espMode || hacksRef.current.espMode;
        const tracerLines = entityHacks.tracerLines || hacksRef.current.tracerLines;
        const entityIsEspFull = espMode === 'FULL_BODY';

        if (!isDead && espMode === 'BOXES') {
          if (!entityObj.espBox) {
             const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.0, 2.0, 1.0));
             const mat = new THREE.LineBasicMaterial({ color: 0x00ff00, depthTest: false, transparent: true, opacity: 0.8 });
             entityObj.espBox = new THREE.LineSegments(geo, mat);
             scene.add(entityObj.espBox);
          }
          const basePos = entityObj.meshGroup.position;
          entityObj.espBox.position.copy(basePos).setY(basePos.y + 1.0);
          
          const dist = game.playerPos.distanceTo(entityObj.position);
          let color = 0x10b981; // green
          if (dist < 12) color = 0xef4444; // red
          else if (dist < 25) color = 0xeab308; // yellow
          (entityObj.espBox.material as THREE.LineBasicMaterial).color.setHex(color);
        } else if (entityObj.espBox) {
           scene.remove(entityObj.espBox);
           entityObj.espBox.geometry.dispose();
           (entityObj.espBox.material as THREE.Material).dispose();
           entityObj.espBox = undefined;
        }

        // ESP TRACER LINES
        if (!isDead && tracerLines) {
          if (!entityObj.tracerLine) {
            const geo = new THREE.BufferGeometry();
            // Just initialize with dummy points
            geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
            const mat = new THREE.LineBasicMaterial({ color: 0x3b82f6, depthTest: false, transparent: true, opacity: 0.6 });
            entityObj.tracerLine = new THREE.Line(geo, mat);
            scene.add(entityObj.tracerLine);
          }
          // The line connects from the bottom center of the camera screen down to the player's feet
          const basePos = entityObj.meshGroup.position;
          
          // Get the position slightly below and in front of the camera (simulating the player's weapon position or chest)
          const camDir = new THREE.Vector3();
          camera.getWorldDirection(camDir);
          const startPos = camera.position.clone().add(camDir.multiplyScalar(0.5)).setY(camera.position.y - 0.5);

          const positions = entityObj.tracerLine.geometry.attributes.position.array as Float32Array;
          positions[0] = startPos.x;
          positions[1] = startPos.y;
          positions[2] = startPos.z;
          positions[3] = basePos.x;
          positions[4] = basePos.y + 0.1; // slightly above ground
          positions[5] = basePos.z;
          
          entityObj.tracerLine.geometry.attributes.position.needsUpdate = true;
          
          // Color coding based on distance
          const dist = game.playerPos.distanceTo(entityObj.position);
          let color = 0x3b82f6; // blue
          if (dist < 15) color = 0xef4444; // red
          else if (dist < 30) color = 0xeab308; // yellow
          (entityObj.tracerLine.material as THREE.LineBasicMaterial).color.setHex(color);

        } else if (entityObj.tracerLine) {
          scene.remove(entityObj.tracerLine);
          entityObj.tracerLine.geometry.dispose();
          (entityObj.tracerLine.material as THREE.Material).dispose();
          entityObj.tracerLine = undefined;
        }

        // 3D FLOATING HEALTH BAR ESP CHEAT
        const showHealthBar = entityHacks.healthBarESP || hacksRef.current.healthBarESP;
        const currentHp = entityObj.health !== undefined ? entityObj.health : 100;
        const maxHp = entityObj.maxHealth !== undefined ? entityObj.maxHealth : 100;

        if (!isDead && showHealthBar) {
          if (!entityObj.healthBarGroup) {
            const group = new THREE.Group();

            // Background frame
            const bgGeo = new THREE.BoxGeometry(1.2, 0.18, 0.04);
            const bgMat = new THREE.MeshBasicMaterial({ color: 0x0f172a, depthTest: false, transparent: true, opacity: 0.85 });
            const bgMesh = new THREE.Mesh(bgGeo, bgMat);
            group.add(bgMesh);

            // Health fill
            const fillGeo = new THREE.BoxGeometry(1.14, 0.12, 0.05);
            const fillMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, depthTest: false, transparent: true, opacity: 0.95 });
            const fillMesh = new THREE.Mesh(fillGeo, fillMat);
            fillMesh.position.z = 0.01;
            group.add(fillMesh);
            entityObj.healthBarFillMesh = fillMesh;

            // Text Canvas Sprite
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 64;
            const tex = new THREE.CanvasTexture(canvas);
            const spriteMat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.position.set(0, 0.28, 0);
            sprite.scale.set(1.5, 0.38, 1);
            group.add(sprite);

            entityObj.healthBarSprite = sprite;
            entityObj.healthBarCanvas = canvas;
            entityObj.healthBarTex = tex;

            scene.add(group);
            entityObj.healthBarGroup = group;
          }

          const basePos = entityObj.meshGroup.position;
          entityObj.healthBarGroup.position.set(basePos.x, basePos.y + 2.25, basePos.z);
          entityObj.healthBarGroup.quaternion.copy(camera.quaternion);

          const ratio = Math.max(0, Math.min(1, currentHp / maxHp));
          if (entityObj.healthBarFillMesh) {
            entityObj.healthBarFillMesh.scale.x = ratio;
            entityObj.healthBarFillMesh.position.x = -0.57 * (1 - ratio);
            const mat = entityObj.healthBarFillMesh.material as THREE.MeshBasicMaterial;
            if (ratio > 0.5) mat.color.setHex(0x22c55e);
            else if (ratio > 0.25) mat.color.setHex(0xeab308);
            else mat.color.setHex(0xef4444);
          }

          const hpStr = `${Math.ceil(currentHp)}/${maxHp}`;
          if (entityObj.lastHpText !== hpStr) {
            entityObj.lastHpText = hpStr;
            const canvas = entityObj.healthBarCanvas;
            const ctx = canvas?.getContext('2d');
            if (ctx && canvas) {
              ctx.clearRect(0, 0, 256, 64);
              ctx.font = 'bold 30px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.strokeStyle = '#000000';
              ctx.lineWidth = 5;
              const displayName = entityObj.name || 'Soldier';
              const txt = `${displayName}: ${Math.ceil(currentHp)} HP`;
              ctx.strokeText(txt, 128, 32);
              ctx.fillStyle = ratio > 0.5 ? '#4ade80' : ratio > 0.25 ? '#facc15' : '#f87171';
              ctx.fillText(txt, 128, 32);
              entityObj.healthBarTex.needsUpdate = true;
            }
          }
        } else if (entityObj.healthBarGroup) {
          scene.remove(entityObj.healthBarGroup);
          entityObj.healthBarGroup.traverse((child: any) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (child.material.map) child.material.map.dispose();
              child.material.dispose();
            }
          });
          entityObj.healthBarGroup = undefined;
          entityObj.healthBarFillMesh = undefined;
          entityObj.healthBarSprite = undefined;
          entityObj.lastHpText = undefined;
        }

        return entityIsEspFull;
      };

      bots.forEach(bot => {
        const entityIsEspFull = updateEspBox(bot, bot.isDead);
        
        bot.meshGroup.traverse(child => {
          if (child instanceof THREE.Mesh) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => { m.depthTest = !entityIsEspFull; }); // Handled per-entity loops below
            } else if (child.material) {
              child.material.depthTest = !entityIsEspFull; // Handled per-entity loops below
            }
          }
        });
      });

      game.otherPlayers.forEach(pObj => {
        const entityIsEspFull = updateEspBox(pObj, (pObj.health && pObj.health <= 0));
        
        pObj.meshGroup.traverse(child => {
          if (child instanceof THREE.Mesh) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => { m.depthTest = !entityIsEspFull; }); // Handled per-entity loops below
            } else if (child.material) {
              child.material.depthTest = !entityIsEspFull; // Handled per-entity loops below
            }
          }
        });
      });

      // Update tracers fade
      for (let i = game.tracers.length - 1; i >= 0; i--) {
        const tracer = game.tracers[i];
        tracer.age += delta * 1000;
        const ratio = 1.0 - (tracer.age / tracer.maxAge);
        if (ratio <= 0) {
          scene.remove(tracer.line);
          tracer.line.geometry.dispose();
          game.tracers.splice(i, 1);
        } else {
          (tracer.line.material as THREE.LineBasicMaterial).opacity = ratio;
        }
      }

      // Update Muzzle flash visual
      if (game.muzzleFlash && game.muzzleFlashLight && game.muzzleFlashTimer > 0) {
        game.muzzleFlashTimer -= delta * 1000;
        if (game.muzzleFlashTimer <= 0) {
          (game.muzzleFlash.material as THREE.MeshBasicMaterial).opacity = 0;
          game.muzzleFlashLight.intensity = 0;
        } else {
          // Position muzzle flash at actual gun muzzle tip using the gun world matrix!
      let mPos = new THREE.Vector3(0, 0.01, -0.30);
      if (game.weaponMesh) {
        const muzzleObj = game.weaponMesh.getObjectByName('muzzlePoint');
        if (muzzleObj) {
          mPos.copy(muzzleObj.position);
        }
        game.weaponMesh.updateMatrixWorld(true);
        mPos.applyMatrix4(game.weaponMesh.matrixWorld);
      } else if (camera) {
        mPos.applyMatrix4(camera.matrixWorld);
      }
          game.muzzleFlash.position.copy(mPos);
          game.muzzleFlashLight.position.copy(mPos);
        }
      }

      // 2. Physics & Movement for Player (Always enabled when playing, even without Pointer Lock)
      if (!game.playerIsDead) {
        // Integrate low-latency virtual touchscreen looking and key maps
        if (useTouchControls && touchInputsRef && touchInputsRef.current) {
          const touchInput = touchInputsRef.current;
          
          // Apply camera look movement (accumulated trackpad delta)
          if (touchInput.lookDeltaX !== 0 || touchInput.lookDeltaY !== 0) {
            const touchSensitivity = 0.0035; // optimal responsive feel
            game.yaw -= touchInput.lookDeltaX * touchSensitivity;
            game.pitch -= touchInput.lookDeltaY * touchSensitivity;
            
            // Consume deltas immediately so they do not keep spinning
            touchInput.lookDeltaX = 0;
            touchInput.lookDeltaY = 0;
          }

          // Merge low-latency button trigger states into main keys record
          if (touchInput.keys) {
            Object.keys(touchInput.keys).forEach((key) => {
              game.keys[key] = touchInput.keys[key];
            });
          }
        }

        // Arrow Key Camera Rotation (Scaled by camera sensitivity & ADS multiplier)
        const arrowSens = parseFloat(localStorage.getItem('codm_camera_sens') || '1.0');
        const arrowAdsMult = parseFloat(localStorage.getItem('codm_ads_sens') || '0.5');
        const arrowLookSpeed = 2.2 * delta * (game.isADS ? arrowAdsMult : 1.0) * arrowSens;

        if (game.keys['arrowleft']) game.yaw += arrowLookSpeed;
        if (game.keys['arrowright']) game.yaw -= arrowLookSpeed;
        if (game.keys['arrowup']) game.pitch += arrowLookSpeed;
        if (game.keys['arrowdown']) game.pitch -= arrowLookSpeed;
        game.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, game.pitch));

        // Calculate movement speed modifier
        let moveSpeed = 10.5;
        if (game.keys['shift']) moveSpeed *= 1.35; // Sprinting
        if (game.isADS) moveSpeed *= 0.55; // ADS slowing
        moveSpeed *= playerClass.speed; // Class bonus speed
        if (hacksRef.current.speedHack) moveSpeed *= 2.5; // Speed Hack
        if (hacksRef.current.insaneSpeed) moveSpeed *= 10.0; // Insane Speed Hack

        // Direction vectors
        const forward = config.spectatorMode ? new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(game.pitch, game.yaw, 0, "YXZ")) : new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), game.yaw);
        const right = config.spectatorMode ? new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(game.pitch, game.yaw, 0, "YXZ")) : new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), game.yaw);

        const activeBinds = bindingsRef.current || {};
        const keyForward = activeBinds.forward || 'w';
        const keyBackward = activeBinds.backward || 's';
        const keyLeft = activeBinds.left || 'a';
        const keyRight = activeBinds.right || 'd';
        const keyJump = activeBinds.jump || ' ';

        const moveDir = new THREE.Vector3();
        
        // Touch Virtual Joystick steering
        let hasTouchMove = false;
        if (useTouchControls && touchInputsRef && touchInputsRef.current) {
          const touchInput = touchInputsRef.current;
          if (Math.abs(touchInput.moveX) > 0.05 || Math.abs(touchInput.moveY) > 0.05) {
            hasTouchMove = true;
            // Map moveY to forward (inverted relative to standard screen-coordinate Y)
            // Map moveX to right
            moveDir.add(forward.clone().multiplyScalar(touchInput.moveY));
            moveDir.add(right.clone().multiplyScalar(touchInput.moveX));
          }
        }

        if (!hasTouchMove) {
          if (game.keys[keyForward]) moveDir.add(forward);
          if (game.keys[keyBackward]) moveDir.add(forward.clone().negate());
          if (game.keys[keyLeft]) moveDir.add(right.clone().negate());
          if (game.keys[keyRight]) moveDir.add(right);
        }

        moveDir.normalize();

        game.playerVel.x += (moveDir.x * moveSpeed - game.playerVel.x) * 9 * delta;
        game.playerVel.z += (moveDir.z * moveSpeed - game.playerVel.z) * 9 * delta;
        if (config.spectatorMode) game.playerVel.y += (moveDir.y * moveSpeed - game.playerVel.y) * 9 * delta;

        // Apply Gravity / Fly Hack
        if (hacksRef.current.flyHack || config.spectatorMode) {
          if (game.keys[keyJump]) {
            game.playerVel.y = 12.0;
          } else if (hacksRef.current.flyHack) {
            game.playerVel.y = 0;
          }
        } else {
          game.playerVel.y -= 25 * delta;
        }

        // Apply movement velocity
        const nextPos = game.playerPos.clone().add(game.playerVel.clone().multiplyScalar(delta));

        // Axis-independent sliding collision resolution (AABB)
        const playerHeight = game.isProne ? 0.5 : 1.6;
        const playerRadius = 0.4;
        const dt = delta;

        // 1. Test X axis movement
        const testX = game.playerPos.x + game.playerVel.x * dt;
        const boxX = new THREE.Box3(
          new THREE.Vector3(testX - playerRadius, game.playerPos.y - 0.2, game.playerPos.z - playerRadius),
          new THREE.Vector3(testX + playerRadius, game.playerPos.y + playerHeight, game.playerPos.z + playerRadius)
        );

        let collideX = false;
        let stepUpY_X = 0;
        for (const wall of game.colliders) {
          if (wall.type === 'floor') continue;
          if (boxX.intersectsBox(wall.box)) {
            // Auto step-up for stairs/small obstacles (up to 0.6 units)
            if (wall.box.max.y > game.playerPos.y - 0.2 && wall.box.max.y <= game.playerPos.y + 0.6) {
              stepUpY_X = Math.max(stepUpY_X, wall.box.max.y - game.playerPos.y);
            } else {
              collideX = true;
              break;
            }
          }
        }

        if (!collideX || config.spectatorMode) {
          game.playerPos.x = testX;
          if (stepUpY_X > 0 && !config.spectatorMode) {
            game.playerPos.y += stepUpY_X;
            game.playerVel.y = 0; // Grounded on step
          }
        } else {
          game.playerVel.x = 0;
        }

        // 2. Test Z axis movement
        const testZ = game.playerPos.z + game.playerVel.z * dt;
        const boxZ = new THREE.Box3(
          new THREE.Vector3(game.playerPos.x - playerRadius, game.playerPos.y - 0.2, testZ - playerRadius),
          new THREE.Vector3(game.playerPos.x + playerRadius, game.playerPos.y + playerHeight, testZ + playerRadius)
        );

        let collideZ = false;
        let stepUpY_Z = 0;
        for (const wall of game.colliders) {
          if (wall.type === 'floor') continue;
          if (boxZ.intersectsBox(wall.box)) {
            if (wall.box.max.y > game.playerPos.y - 0.2 && wall.box.max.y <= game.playerPos.y + 0.6) {
              stepUpY_Z = Math.max(stepUpY_Z, wall.box.max.y - game.playerPos.y);
            } else {
              collideZ = true;
              break;
            }
          }
        }

        if (!collideZ || config.spectatorMode) {
          game.playerPos.z = testZ;
          if (stepUpY_Z > 0 && !config.spectatorMode) {
            game.playerPos.y += stepUpY_Z;
            game.playerVel.y = 0; // Grounded on step
          }
        } else {
          game.playerVel.z = 0;
        }

        // 3. Gravity and Y axis ground bounds
        game.playerPos.y += game.playerVel.y * dt;
        
        let targetCameraHeight = game.isProne ? 0.5 : 1.5;
        game.currentCameraHeight += (targetCameraHeight - game.currentCameraHeight) * 8 * dt;
        let baseCameraHeight = game.currentCameraHeight;
        let groundY = baseCameraHeight;
        if (!config.spectatorMode) {
        for (const wall of game.colliders) {
          if (
            game.playerPos.x > wall.box.min.x - playerRadius && game.playerPos.x < wall.box.max.x + playerRadius &&
            game.playerPos.z > wall.box.min.z - playerRadius && game.playerPos.z < wall.box.max.z + playerRadius
          ) {
            if (wall.box.max.y <= game.playerPos.y - baseCameraHeight + 0.6) { 
              groundY = Math.max(groundY, wall.box.max.y + baseCameraHeight);
            }
          }
        }
        }

        let isOnGround = false;
        if (game.playerPos.y <= groundY && !config.spectatorMode) {
          game.playerPos.y = groundY;
          game.playerVel.y = 0;
          isOnGround = true;
        }

        // Jump trigger
        if (game.keys[keyJump] && isOnGround) {
          game.playerVel.y = hacksRef.current.superJump ? 25.0 : 9.5; // Jump strength
        }

        // Anti-stuck clipping disabled for player to prevent stutter, sweep tests handle walls

        // Apply final position and level-locked 'YXZ' rotation to eliminate sideways rolling
        camera.position.copy(game.playerPos);
        camera.rotation.set(game.pitch + game.recoilRot.x, game.yaw + game.recoilRot.y, 0, 'YXZ');

        // MULTIPLAYER POSITIONAL STATE SYNC UPDATES
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: 'update',
            payload: {
              x: game.playerPos.x,
              y: game.playerPos.y,
              z: game.playerPos.z,
              yaw: game.yaw,
              pitch: game.pitch,
              health: game.playerHealth,
              maxHealth: playerClass.maxHealth,
              isADS: game.isADS,
              isFiring: game.isFiring,
              activeWeaponId: game.activeWeapon?.id || 'm4_assault'
            }
          }));
        }
      } else if (game.playerIsDead) {
        // Dead camera fall to ground
        game.playerPos.y = Math.max(0.2, game.playerPos.y - delta * 4);
        camera.position.copy(game.playerPos);
        const tilt = Math.min(Math.PI / 2, ((4000 - game.playerRespawnTimer) / 1000) * (Math.PI / 2));
        camera.rotation.set(game.pitch, game.yaw, tilt, 'YXZ');
      }

      // 3. Update Custom Particles
      if (game.particles) {
        const dummy = new THREE.Object3D();
        for (let i = 0; i < particleCount; i++) {
          const p = game.particleData[i];
          if (p.life > 0) {
            p.life -= delta;
            p.pos.add(p.vel.clone().multiplyScalar(delta));
            // Apply simple gravity
            p.vel.y -= 9.8 * delta;

            dummy.position.copy(p.pos);
            const size = (p.life / p.maxLife) * 0.12;
            dummy.scale.set(size, size, size);
            dummy.updateMatrix();
            (game.particles as THREE.InstancedMesh).setMatrixAt(i, dummy.matrix);
          } else {
            // Keep hidden below stage
            dummy.position.set(0, -999, 0);
            dummy.updateMatrix();
            (game.particles as THREE.InstancedMesh).setMatrixAt(i, dummy.matrix);
          }
        }
        (game.particles as THREE.InstancedMesh).instanceMatrix.needsUpdate = true;
      }

      // Update Kill Popups
      for (let i = game.killPopups.length - 1; i >= 0; i--) {
        const kp = game.killPopups[i];
        kp.life -= delta;
        if (kp.life <= 0) {
          scene.remove(kp.sprite);
          kp.sprite.material.dispose();
          kp.sprite.material.map?.dispose();
          game.killPopups.splice(i, 1);
        } else {
          kp.sprite.position.y += kp.vy * delta;
          kp.sprite.material.opacity = kp.life * 2.0;
        }
      }

      // 4. Fully Intelligent Bot AI Lifecycle & Simulation
      for (const bot of bots) {
        if (bot.isDead) {
          bot.respawnTimer -= delta * 1000;
          
          // Animate bot death fall
          if (bot.meshGroup.rotation.x < Math.PI / 2) {
            bot.meshGroup.rotation.x += delta * 6;
            bot.meshGroup.position.y = Math.max(0.2, bot.meshGroup.position.y - delta * 3);
          } else {
            bot.meshGroup.rotation.x = Math.PI / 2;
            bot.meshGroup.position.y = 0.2;
          }

          if (bot.respawnTimer <= 0) {
            // Respawn
            const occupiedPositions = [
              game.playerPos,
              ...bots.filter(b => b !== bot && !b.isDead).map(b => b.position)
            ];
            const spawn = getSafeSpawnPoint(game.spawnPoints, game.colliders, occupiedPositions);
            bot.position.copy(spawn);
            bot.meshGroup.position.copy(spawn);
            bot.rotationY = Math.random() * Math.PI * 2;
            bot.meshGroup.rotation.set(0, bot.rotationY, 0); // reset death tilt rotation
            bot.velocity.set(0, 0, 0);
            bot.health = bot.maxHealth;
            bot.isDead = false;
            bot.botClip = bot.activeWeapon.maxAmmo;
            bot.targetEntityId = null;
            bot.shootCooldownRemaining = 500;
            bot.patrolWaypoint.copy(spawn);
            bot.targetSelectionTimer = 0;
            bot.jumpTimer = 0;
          }
          continue;
        }

        // Shooting rate checks
        if (bot.shootCooldownRemaining > 0) {
          bot.shootCooldownRemaining -= delta * 1000;
        }

        // AI Target Selection (Threat & Damage Valuation System)
        bot.targetSelectionTimer -= delta * 1000;
        if (bot.targetSelectionTimer <= 0) {
          bot.targetSelectionTimer = 400 + Math.random() * 400; // Frequent intelligent evaluation

          const evaluateThreat = (candidateId: string, candidatePos: THREE.Vector3, candidateHp: number) => {
            if (candidateHp <= 0) return -9999;
            const dist = bot.position.distanceTo(candidatePos);
            if (dist > bot.activeWeapon.range * 1.3) return -9999;

            // Base score: closer targets are higher threat
            let score = 1000 / (dist + 2.0);

            // Value damage ALREADY dealt to target (finish damaged targets!)
            const dealt = bot.damageDealtMap?.get(candidateId) || 0;
            score += dealt * 3.5;

            // Value damage RECEIVED from target (retaliate against attackers!)
            const received = bot.damageReceivedMap?.get(candidateId) || 0;
            score += received * 4.5;

            // Line of Sight check: penalize if wall is blocking view
            const eyePos = bot.position.clone().add(new THREE.Vector3(0, 1.4, 0));
            const toCand = candidatePos.clone().add(new THREE.Vector3(0, 1.0, 0)).sub(eyePos);
            const ray = new THREE.Raycaster(eyePos, toCand.clone().normalize());
            const hits = ray.intersectObjects(game.colliders.map(c => c.mesh));
            if (hits.length > 0 && hits[0].distance < toCand.length() - 0.5) {
              score -= 600; // Penalize blocked targets so bot prioritizes visible enemies
            }

            return score;
          };

          let bestScore = -9000;
          let bestId: string | null = null;

          // Check human player
          if (!game.playerIsDead && !config.spectatorMode) {
            const s = evaluateThreat('player', game.playerPos, game.playerHealth);
            if (s > bestScore) { bestScore = s; bestId = 'player'; }
          }

          // Check other bots
          for (const other of bots) {
            if (other.id === bot.id || other.isDead) continue;
            const s = evaluateThreat(other.id, other.position, other.health);
            if (s > bestScore) { bestScore = s; bestId = other.id; }
          }

          // Check online players
          game.otherPlayers.forEach((p: any) => {
            if (p.health > 0 && !p.isSpectator) {
              const s = evaluateThreat(p.id, p.position, p.health);
              if (s > bestScore) { bestScore = s; bestId = p.id; }
            }
          });

          bot.targetEntityId = bestScore > 0 ? bestId : null;
        }

        // AI Navigation / Combat Execution
        let moveDir = new THREE.Vector3();
        let targetPos: THREE.Vector3 | null = null;

        if (bot.targetEntityId === 'player' && !game.playerIsDead) {
          targetPos = game.playerPos;
        } else if (bot.targetEntityId && bot.targetEntityId.startsWith('bot_')) {
          const tBot = bots.find(b => b.id === bot.targetEntityId);
          if (tBot && !tBot.isDead) {
            targetPos = tBot.position;
          }
        }

        // Tactical strafe timer
        bot.strafeTimer = (bot.strafeTimer || 0) - delta;
        if (bot.strafeTimer <= 0) {
          bot.strafeTimer = 1.2 + Math.random() * 2.0;
          bot.strafeDir = Math.random() < 0.5 ? 1 : -1;
        }

        if (targetPos) {
          // Combat Mode: Look at enemy & Steer towards them or fire!
          const dirToTarget = targetPos.clone().sub(bot.position);
          const targetRotationY = Math.atan2(dirToTarget.x, dirToTarget.z);
          
          let angleDiff = targetRotationY - bot.rotationY;
          angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
          bot.rotationY += angleDiff * 9.5 * delta;

          bot.meshGroup.rotation.y = bot.rotationY;

          const distance = bot.position.distanceTo(targetPos);

          if (distance > bot.activeWeapon.range * 0.45) {
            moveDir.copy(dirToTarget).normalize();
          } else if (distance < 4.5) {
            moveDir.copy(dirToTarget).negate().normalize();
          }

          // Tactical Strafe / Flanking offset
          const localRight = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), bot.rotationY);
          moveDir.add(localRight.multiplyScalar((bot.strafeDir || 1) * 0.5)).normalize();

          // Fire at target if cooldown elapsed
          if (bot.shootCooldownRemaining <= 0) {
            let delayMod = 3.0; // Normal difficulty
            if (config.difficulty === 'EASY') delayMod = 4.5;
            if (config.difficulty === 'HARD') delayMod = 1.0;
            const cheats = adminTargetCheatsRef.current[bot.id] || { rapidFire: false };
            if (cheats.rapidFire) delayMod = 0.2;
            bot.shootCooldownRemaining = bot.activeWeapon.fireRate * delayMod;

            botFire(bot, targetPos);
          }
        } else {
          // Patrol Mode: Head towards waypoint
          if (bot.position.distanceTo(bot.patrolWaypoint) < 3.0) {
            bot.patrolWaypoint.copy(game.spawnPoints[Math.floor(Math.random() * game.spawnPoints.length)]);
          }

          const dirToWaypoint = bot.patrolWaypoint.clone().sub(bot.position);
          const targetRotationY = Math.atan2(dirToWaypoint.x, dirToWaypoint.z);
          
          let angleDiff = targetRotationY - bot.rotationY;
          angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
          bot.rotationY += angleDiff * 6.0 * delta;

          bot.meshGroup.rotation.y = bot.rotationY;

          moveDir.copy(dirToWaypoint).normalize();
        }

        // Raycast Obstacle Avoidance ahead of movement direction
        if (moveDir.lengthSq() > 0.01) {
          const fwdRay = new THREE.Raycaster(
            bot.position.clone().add(new THREE.Vector3(0, 0.8, 0)),
            moveDir
          );
          const wallHits = fwdRay.intersectObjects(game.colliders.map(c => c.mesh));
          if (wallHits.length > 0 && wallHits[0].distance < 1.2) {
            // Obstacle ahead! Steer laterally to slide around corner
            const perp = new THREE.Vector3(-moveDir.z, 0, moveDir.x).multiplyScalar(bot.strafeDir || 1);
            moveDir.add(perp.multiplyScalar(2.0)).normalize();
          }
        }

        // Anti-Stuck Detection & Auto Re-routing
        bot.lastPosTimer = (bot.lastPosTimer || 0) + delta;
        if (!bot.lastPos) bot.lastPos = bot.position.clone();
        if (bot.lastPosTimer > 0.3) {
          const distMoved = bot.position.distanceTo(bot.lastPos);
          if (distMoved < 0.12 && moveDir.lengthSq() > 0.1) {
            bot.stuckTimer = (bot.stuckTimer || 0) + 0.3;
            if (bot.stuckTimer > 0.5) {
              // Bot is stuck against an obstacle! Force turn and pick new waypoint
              bot.rotationY += Math.PI * (0.6 + Math.random() * 0.6);
              bot.patrolWaypoint.copy(game.spawnPoints[Math.floor(Math.random() * game.spawnPoints.length)]);
              bot.stuckTimer = 0;
              bot.strafeDir = (bot.strafeDir || 1) * -1;
            }
          } else {
            bot.stuckTimer = Math.max(0, (bot.stuckTimer || 0) - 0.2);
          }
          bot.lastPos.copy(bot.position);
          bot.lastPosTimer = 0;
        }

        // Apply simple physics to Bot with smooth velocity build-up
        let botSpeedModifier = 8.0;
        if (config.difficulty === "EASY") botSpeedModifier = 5.5;
        if (config.difficulty === "HARD") botSpeedModifier = 10.5;
        const cheats2 = adminTargetCheatsRef.current[bot.id] || { speedHack: false };
        if (cheats2.speedHack) botSpeedModifier = 35.0;

        const targetBotVelX = moveDir.x * botSpeedModifier * bot.classConfig.speed;
        const targetBotVelZ = moveDir.z * botSpeedModifier * bot.classConfig.speed;
        bot.velocity.x += (targetBotVelX - bot.velocity.x) * 8 * delta;
        bot.velocity.z += (targetBotVelZ - bot.velocity.z) * 8 * delta;

        // Apply simple bot path gravity
        bot.velocity.y -= 15 * delta;

        // Solid AABB sliding wall collision for bots (prevents bots phasing through walls)
        bot.jumpTimer -= delta;
        const botRadius = 0.45;
        const botHeight = 1.8;
        const dt = delta;

        // 1. X-axis test
        const testBotX = bot.position.x + bot.velocity.x * dt;
        const botBoxX = new THREE.Box3(
          new THREE.Vector3(testBotX - botRadius, bot.position.y + 0.1, bot.position.z - botRadius),
          new THREE.Vector3(testBotX + botRadius, bot.position.y + botHeight, bot.position.z + botRadius)
        );

        let botCollideX = false;
        let obstacleHeightX = 0;
        let botStepUpX = 0;
        for (const wall of game.colliders) {
          if (wall.type === 'floor') continue;
          if (botBoxX.intersectsBox(wall.box)) {
            if (wall.box.max.y > bot.position.y && wall.box.max.y <= bot.position.y + 0.6) {
              botStepUpX = Math.max(botStepUpX, wall.box.max.y - bot.position.y);
            } else {
              botCollideX = true;
              obstacleHeightX = Math.max(obstacleHeightX, wall.box.max.y - bot.position.y);
              break;
            }
          }
        }

        if (!botCollideX) {
          bot.position.x = testBotX;
          if (botStepUpX > 0) {
            bot.position.y += botStepUpX;
            bot.velocity.y = 0;
          }
        } else {
          bot.velocity.x = 0;
          // ONLY jump over low barriers/crates <= 1.8m. Never jump into high walls/buildings!
          if (bot.jumpTimer <= 0 && obstacleHeightX > 0.2 && obstacleHeightX <= 1.8) {
            bot.velocity.y = 8.5;
            bot.jumpTimer = 1.5;
          } else if (botCollideX) {
            bot.rotationY += (Math.PI / 2) * (bot.strafeDir || 1);
            bot.strafeDir = (bot.strafeDir || 1) * -1;
          }
        }

        // 2. Z-axis test
        const testBotZ = bot.position.z + bot.velocity.z * dt;
        const botBoxZ = new THREE.Box3(
          new THREE.Vector3(bot.position.x - botRadius, bot.position.y + 0.1, testBotZ - botRadius),
          new THREE.Vector3(bot.position.x + botRadius, bot.position.y + botHeight, testBotZ + botRadius)
        );

        let botCollideZ = false;
        let obstacleHeightZ = 0;
        let botStepUpZ = 0;
        for (const wall of game.colliders) {
          if (wall.type === 'floor') continue;
          if (botBoxZ.intersectsBox(wall.box)) {
            if (wall.box.max.y > bot.position.y && wall.box.max.y <= bot.position.y + 0.6) {
              botStepUpZ = Math.max(botStepUpZ, wall.box.max.y - bot.position.y);
            } else {
              botCollideZ = true;
              obstacleHeightZ = Math.max(obstacleHeightZ, wall.box.max.y - bot.position.y);
              break;
            }
          }
        }

        if (!botCollideZ) {
          bot.position.z = testBotZ;
          if (botStepUpZ > 0) {
            bot.position.y += botStepUpZ;
            bot.velocity.y = 0;
          }
        } else {
          bot.velocity.z = 0;
          // ONLY jump over low barriers/crates <= 1.8m. Never jump into high walls/buildings!
          if (bot.jumpTimer <= 0 && obstacleHeightZ > 0.2 && obstacleHeightZ <= 1.8) {
            bot.velocity.y = 8.5;
            bot.jumpTimer = 1.5;
          } else if (botCollideZ) {
            bot.rotationY += (Math.PI / 2) * (bot.strafeDir || 1);
            bot.strafeDir = (bot.strafeDir || 1) * -1;
          }
        }

        // 3. Y-axis gravity & ground plane
        bot.position.y += bot.velocity.y * dt;
        if (bot.position.y < 0) {
          bot.position.y = 0;
          bot.velocity.y = 0;
        }

        // Anti-Stuck Check: Ensure bot is never clipped inside a wall/crate
        resolveObstacleClipping(bot.position, botRadius, botHeight, game.colliders, game.spawnPoints);

        bot.meshGroup.position.copy(bot.position);

        // Pass 4: Bot Kinematics (Legs/Arms walking animation & Flinch reaction)
        const speedSq = bot.velocity.x * bot.velocity.x + bot.velocity.z * bot.velocity.z;
        const isMoving = speedSq > 0.1;

        if (isMoving) {
          bot.meshGroup.position.y = bot.position.y + Math.abs(Math.sin(time * 0.01)) * 0.08;
          bot.walkAnimPhase += delta * Math.sqrt(speedSq) * 3.5;

          if (bot.leftLeg) bot.leftLeg.rotation.x = Math.sin(bot.walkAnimPhase) * 0.6;
          if (bot.rightLeg) bot.rightLeg.rotation.x = -Math.sin(bot.walkAnimPhase) * 0.6;
          if (bot.leftArm) bot.leftArm.rotation.x = -Math.sin(bot.walkAnimPhase) * 0.5;
          if (bot.rightArm) bot.rightArm.rotation.x = Math.sin(bot.walkAnimPhase) * 0.3 - 0.2;

          // Gentle forward tilt when moving
          bot.meshGroup.rotation.x = 0.08;
          const localRight = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), bot.rotationY);
          const lateralVel = bot.velocity.dot(localRight);
          bot.meshGroup.rotation.z = -lateralVel * 0.03;
        } else {
          bot.meshGroup.position.y = bot.position.y;
          bot.meshGroup.rotation.x = 0;
          bot.meshGroup.rotation.z = 0;

          if (bot.leftLeg) bot.leftLeg.rotation.x *= 0.8;
          if (bot.rightLeg) bot.rightLeg.rotation.x *= 0.8;
          if (bot.leftArm) bot.leftArm.rotation.x *= 0.8;
          if (bot.rightArm) bot.rightArm.rotation.x *= 0.8;
        }

        // Flinch reaction when taking damage
        if (bot.flinchTimer > 0) {
          bot.flinchTimer -= delta;
          if (bot.torsoMesh) bot.torsoMesh.rotation.x = -0.25 * (bot.flinchTimer / 0.15);
        } else if (bot.torsoMesh) {
          bot.torsoMesh.rotation.x = 0;
        }
      }

      // Check win targets
      const someoneWon = checkWinCondition();

      // Render Next Frame
      if (game.renderer && game.scene && game.camera && !someoneWon) {
        game.renderer.render(game.scene, game.camera);
        game.frameId = requestAnimationFrame(animate);
      }
    };

    // Bot bullet firing mechanics
    const botFire = (bot: BotEntity, targetPos: THREE.Vector3) => {
      // Calculate lead prediction based on target velocity
      let targetVel = new THREE.Vector3();
      if (targetPos === game.playerPos) {
        targetVel.copy(game.playerVel);
      } else {
        const tBot = bots.find(b => b.position.distanceTo(targetPos) < 1.0);
        if (tBot) targetVel.copy(tBot.velocity);
      }

      // Muzzle source at bot chest height
      const muzzlePos = bot.position.clone().add(new THREE.Vector3(0, 1.2, 0));
      const dist = muzzlePos.distanceTo(targetPos);
      const leadTime = dist / 110; // bullet velocity factor
      const predictedTargetPos = targetPos.clone().add(targetVel.clone().multiplyScalar(leadTime));

      // Calculate shooting inaccuracy based on difficulty (+10% Easy, +15% Medium, +20% Hard accuracy boost)
      let inaccuracy = 0.08; // Base inaccuracy (Normal / Medium)
      if (config.difficulty === 'EASY') inaccuracy = 0.15;
      if (config.difficulty === 'HARD') inaccuracy = 0.04;

      const spread = new THREE.Vector3(
        (Math.random() - 0.5) * inaccuracy,
        (Math.random() - 0.5) * inaccuracy,
        (Math.random() - 0.5) * inaccuracy
      );

      const shootDir = predictedTargetPos.clone().sub(muzzlePos).normalize().add(spread).normalize();

      const ray = new THREE.Raycaster(muzzlePos, shootDir);
      const targetList: THREE.Object3D[] = [];

      // Add player if alive (accurate hit box)
      const dummyPlayerMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, game.isProne ? 0.6 : 1.6, 0.5));
      dummyPlayerMesh.position.copy(game.playerPos);
      dummyPlayerMesh.position.y -= (game.isProne ? 0.2 : 0.6); // Camera is near top of hitbox
      if (!game.playerIsDead) {
        targetList.push(dummyPlayerMesh);
      }

      // Add other bots
      bots.forEach(other => {
        if (other.id !== bot.id && !other.isDead) {
          targetList.push(other.meshGroup);
        }
      });

      // Add map colliders
      const collidersList = game.colliders.map(c => c.mesh);
      const allObjects = [...targetList, ...collidersList];

      const intersects = ray.intersectObjects(allObjects);
      let hitPoint = muzzlePos.clone().add(shootDir.multiplyScalar(bot.activeWeapon.range));
      let hitObj: any = null;

      if (intersects.length > 0) {
        const hit = intersects[0];
        hitPoint.copy(hit.point);

        if (hit.object === dummyPlayerMesh) {
          hitObj = 'player';
          damagePlayer(bot, ((getHacksFor(bot.id).oneShot) ? 9999 : bot.activeWeapon.damage));
        } else {
          // Check if other bot hit
          const otherBot = bots.find(o => o.meshGroup === hit.object || o.meshGroup.uuid === hit.object.parent?.uuid);
          if (otherBot && !otherBot.isDead) {
            hitObj = otherBot;
            // Bot-on-bot action!
            const botDmg = ((getHacksFor(bot.id).oneShot) ? 9999 : bot.activeWeapon.damage);
            otherBot.health -= botDmg;
            if (!bot.damageDealtMap) bot.damageDealtMap = new Map();
            bot.damageDealtMap.set(otherBot.id, (bot.damageDealtMap.get(otherBot.id) || 0) + botDmg);
            if (!otherBot.damageReceivedMap) otherBot.damageReceivedMap = new Map();
            otherBot.damageReceivedMap.set(bot.id, (otherBot.damageReceivedMap.get(bot.id) || 0) + botDmg);
            spawnParticles(otherBot.meshGroup.position.clone().setY(1.0), '#f43f5e', 8);

            if (otherBot.health <= 0) {
              otherBot.isDead = true;
              otherBot.deaths++;
              otherBot.respawnTimer = 3000;

              bot.kills++;
              bot.score += 100;
              spawnKillPopup(otherBot.position.clone().setY(2.0), "ELIMINATED");

              // Push killfeed
              onKillFeedUpdate({
                id: `feed_${performance.now()}`,
                killer: { name: bot.name, classId: bot.classConfig.id, isBot: true },
                victim: { name: otherBot.name, classId: otherBot.classConfig.id, isBot: true },
                weaponName: bot.activeWeapon.name,
                isHeadshot: Math.random() < 0.15,
                time: Date.now()
              });

              updateScoreboard();
            }
          } else {
            // Hit wall
            spawnParticles(hitPoint, '#facc15', 3);
          }
        }
      }

      // Create a visual tracer line for the bot shot
      const traceGeo = new THREE.BufferGeometry().setFromPoints([muzzlePos, hitPoint]);
      const traceMat = new THREE.LineBasicMaterial({
        color: 0xff4500, // Red tracer for bots
        transparent: true,
        opacity: 0.6
      });
      const line = new THREE.Line(traceGeo, traceMat);
      scene.add(line);
      game.tracers.push({ line, age: 0, maxAge: 100 });
    };

    // Begin looping
    game.frameId = requestAnimationFrame(animate);

    // Cleanups on unmount
    return () => {
      if (game.frameId) cancelAnimationFrame(game.frameId);
      clearInterval(timerInterval);

      // Close the multiplayer WebSocket
      socket?.close();
      game.otherPlayers.forEach((pObj) => {
        scene.remove(pObj.meshGroup);
        pObj.meshGroup.traverse(child => {
          if (child instanceof THREE.Mesh) child.geometry.dispose();
        });
      });
      game.otherPlayers.clear();

      // Clean scene geometries
      scene.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });

      // Remove mouse events
      if (canvasRef.current) {
        canvasRef.current.removeEventListener('mousedown', handleCanvasMouseDown);
        canvasRef.current.removeEventListener('mousedown', handleMouseDown);
        canvasRef.current.removeEventListener('contextmenu', handleContextmenu);
      }
      window.removeEventListener('mouseup', handleWindowMouseUp);
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);

      renderer.dispose();
    };
  }, [config, playerClass, playerName]);

  return (
    <div id="game-stage-container" ref={containerRef} className="relative w-full h-full bg-slate-950 overflow-hidden">
      <canvas id="fps-combat-canvas" ref={canvasRef} className="w-full h-full block cursor-pointer" />

      {/* Mouse Lock & Instruction Screen Overlay */}
      {!isLocked && !isOverlayDismissed && !gameRef.current.playerIsDead && (
        <div
          id="pointer-lock-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              requestPointerLock();
            }
          }}
          className="absolute inset-0 flex flex-col justify-center items-center bg-black/85 backdrop-blur-md cursor-pointer select-none text-center p-4 z-40 transition-opacity duration-300"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full p-6 rounded-2xl bg-slate-900 border-2 border-emerald-500/30 shadow-2xl space-y-5 cursor-default"
          >
            <h1 className="text-3xl font-sans tracking-tight text-white font-extrabold">
              READY FOR COMBAT
            </h1>
            <p className="text-slate-400 font-sans text-xs leading-relaxed">
              Click below to lock your cursor, or use click-and-drag fallback mode if you are playing inside a sandboxed iframe.
            </p>

            <div className="grid grid-cols-2 gap-3 text-left border-t border-slate-800 pt-4 font-mono text-[11px] text-slate-300">
              <div>
                <span className="text-emerald-400 font-bold">W A S D</span> — Move
              </div>
              <div>
                <span className="text-emerald-400 font-bold">MOUSE</span> — Look & Aim
              </div>
              <div>
                <span className="text-emerald-400 font-bold">LEFT CLICK</span> — Shoot
              </div>
              <div>
                <span className="text-emerald-400 font-bold">RIGHT CLICK</span> — Scope (ADS)
              </div>
              <div>
                <span className="text-emerald-400 font-bold">SPACE</span> — Jump
              </div>
              <div>
                <span className="text-emerald-400 font-bold">SHIFT</span> — Sprint
              </div>
              <div>
                <span className="text-emerald-400 font-bold">R</span> — Reload Weapon
              </div>
              <div>
                <span className="text-emerald-400 font-bold">Q</span> — Class Ability
              </div>
              <div className="col-span-2 text-center text-amber-400 font-bold border-t border-slate-800 pt-2 mt-1">
                1 / 2 — Switch Weapons
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                id="click-to-lock-button"
                onClick={() => requestPointerLock()}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-slate-950 font-sans font-bold tracking-wide rounded-xl shadow-lg shadow-emerald-500/10 transform active:scale-[0.98] transition-all text-xs"
              >
                LOCK CURSOR & COMMENCE (RECOMMENDED)
              </button>

              <button
                id="iframe-drag-play-button"
                onClick={() => setIsOverlayDismissed(true)}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-400 hover:text-emerald-300 font-sans font-bold tracking-wide rounded-xl transition-all text-xs"
              >
                PLAY WITH CLICK-AND-DRAG (IFRAME SAFE)
              </button>
            </div>
          </div>
        </div>
      )}

      
      
      {/* SCREEN FLASH EFFECTS */}
      {screenFlash === 'noscope' && (
        <div className="absolute inset-0 bg-purple-500/30 mix-blend-overlay pointer-events-none z-20" />
      )}
      {screenFlash === 'headshot' && (
        <div className="absolute inset-0 bg-red-500/30 mix-blend-overlay pointer-events-none z-20" />
      )}

      {/* MEDALS OVERLAY */}
      <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 pointer-events-none z-30">
        {medals.map(m => (
          <div key={m.id} className="animate-slide-in">
            <div className={`px-6 py-2 rounded-xl text-xl font-black italic uppercase shadow-2xl border-2 transform -skew-x-12 ${
              m.type === 'headshot' ? 'bg-gradient-to-r from-red-600 to-orange-500 border-yellow-400 text-white shadow-red-500/50' :
              m.type === 'noscope' ? 'bg-gradient-to-r from-purple-600 to-indigo-500 border-pink-400 text-white shadow-purple-500/50' :
              'bg-gradient-to-r from-emerald-600 to-cyan-500 border-teal-400 text-white shadow-emerald-500/50'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
      </div>

      
      {/* KILL STREAK OVERLAY */}
      {killStreak > 1 && !gameRef.current.playerIsDead && (
        <div className="absolute top-24 left-8 z-30 animate-slide-in pointer-events-none">
          <div className="text-4xl font-black italic uppercase text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)] transform -skew-x-12">
            🔥 {killStreak} KILL STREAK
          </div>
          <div className="h-2 w-full bg-slate-900 rounded-full mt-2 border border-slate-700 overflow-hidden">
            <div key={killStreak} className="h-full bg-gradient-to-r from-orange-500 to-red-500 origin-left animate-shrink-x" style={{ animationDuration: "3s" }} />
          </div>
        </div>
      )}

      {/* FOV CIRCLE FOR AIMBOT */}
      {hacksRef.current.aimbotMode === 'FOV_CIRCLE' && !gameRef.current.playerIsDead && hacksRef.current.fovVisibility !== 'HIDDEN' && (
        <div 
          id="fov-aimbot-circle"
          className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none z-10 ${
            hacksRef.current.fovVisibility === 'OBVIOUS' 
              ? 'border-[1.5px] border-emerald-400/50' 
              : 'border-[0.5px] border-white/10'
          }`}
          style={{ 
            width: '25vh', 
            height: '25vh', 
            boxShadow: hacksRef.current.fovVisibility === 'OBVIOUS' ? '0 0 15px rgba(52, 211, 153, 0.2) inset' : 'none' 
          }}
        />
      )}

      {/* Dynamic Instruction Badge for Iframe click-and-drag players */}
      {isOverlayDismissed && !isLocked && !gameRef.current.playerIsDead && (
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 bg-slate-900/95 border border-emerald-500/30 px-3.5 py-1.5 rounded-full pointer-events-none text-[10px] font-mono text-emerald-400 font-bold shadow-xl z-30 flex items-center gap-1.5 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-ping" />
          IFRAME SAFE: DRAG TO LOOK | ARROW KEYS TO LOOK | WASD TO MOVE
        </div>
      )}

      {(() => {
        if (!showAdminCheatMenu) return null;
        const allPlayers = [
          { id: clientId || 'local', name: (playerName || 'You') + ' (YOU)', isBot: false },
          ...gameRef.current.bots.map(b => ({ id: b.id, name: b.name, isBot: true })),
          ...Array.from(gameRef.current.otherPlayers.values()).filter((p: any) => !p.isSpectator).map((p: any) => ({ id: p.id, name: p.name, isBot: false }))
        ];
        const targetPlayer = allPlayers[adminCheatTargetIndex] || allPlayers[0];
        
        const activeCheats = adminTargetCheats[targetPlayer?.id] || { 
            espMode: 'OFF', wallhack: false, tracerLines: false, oneShot: false, rapidFire: false, fullAuto: false,
            noRecoil: false, unlimitedAmmo: false, godMode: false, autoHeal: false, speedHack: false, insaneSpeed: false,
            superJump: false, flyHack: false, aimbotMode: 'OFF', aimbotTarget: 'HEAD', fovVisibility: 'OBVIOUS'
          };
          
        const setTargetHack = (key: string, val: any) => {
          if (!targetPlayer) return;
          const newCheats = { ...activeCheats, [key]: val };
          setAdminTargetCheats(prev => ({ ...prev, [targetPlayer.id]: newCheats }));
          
          if (targetPlayer.id === clientId || targetPlayer.id === 'local') {
            setHacks(newCheats);
          }
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
              type: 'admin_cheat',
              payload: { targetId: targetPlayer.id, hacks: newCheats }
            }));
          }
        };

        return (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border-2 border-red-500/80 rounded-2xl p-6 max-w-md w-full shadow-2xl shadow-red-500/20 text-white font-mono space-y-4">
              <div className="flex justify-between items-center border-b border-red-500/30 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400 animate-ping" />
                  <h3 className="text-md font-black text-red-400 tracking-wider">
                    DEVDEVDEV9 // ADMIN CHEATS
                  </h3>
                </div>
                <button
                  onClick={() => setShowAdminCheatMenu(false)}
                  className="text-xs bg-red-500/20 hover:bg-red-500/40 text-red-300 px-3 py-1 rounded-lg border border-red-500/40 font-bold transition"
                >
                  CLOSE (8)
                </button>
              </div>
              
              <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                Select a player to modify their active cheats and game logic attributes in real-time.
              </p>

              {allPlayers.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex flex-col space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 tracking-wider">SELECT TARGET PLAYER</label>
                    <select 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-bold text-red-300 outline-none focus:border-red-500/50"
                      value={adminCheatTargetIndex}
                      onChange={(e) => setAdminCheatTargetIndex(parseInt(e.target.value))}
                    >
                      {allPlayers.map((p, i) => (
                        <option key={p.id} value={i} className="text-white">
                          {p.name || 'Soldier'}#{p.id.replace('player_', '').replace('bot_', '').slice(0,4)} {p.isBot ? '(BOT)' : '(PLAYER)'}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {/* ESP MODE SELECTOR */}
                    <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-xs text-red-400">ESP VISUAL MODE</span>
                        <span className="text-[10px] text-slate-500">{activeCheats.espMode}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['OFF', 'FULL_BODY', 'BOXES'] as const).map(mode => (
                          <button
                            key={mode}
                            onClick={() => setTargetHack('espMode', mode)}
                            className={`py-1.5 text-[10px] font-mono font-bold rounded-lg border transition ${
                              activeCheats.espMode === mode
                                ? 'bg-red-500 text-slate-950 border-red-400'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                            }`}
                          >
                            {mode.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* AIMBOT MODE SELECTOR */}
                    <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-xs text-red-400">AIMBOT LOCK-ON MODE</span>
                        <span className="text-[10px] text-slate-500">{activeCheats.aimbotMode}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(['OFF', 'ADS_ONLY', 'ALWAYS', 'FOV_CIRCLE'] as const).map(mode => (
                          <button
                            key={mode}
                            onClick={() => setTargetHack('aimbotMode', mode)}
                            className={`py-1.5 text-[10px] font-mono font-bold rounded-lg border transition ${
                              activeCheats.aimbotMode === mode
                                ? 'bg-red-500 text-slate-950 border-red-400'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                            }`}
                          >
                            {mode === 'ADS_ONLY' ? 'ADS' : mode === 'FOV_CIRCLE' ? 'FOV' : mode}
                          </button>
                        ))}
                      </div>
                      
                      {/* AIMBOT TARGET SELECTOR */}
                      <div className="pt-2 border-t border-slate-800">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-[10px] text-red-500">TARGET</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(['HEAD', 'BODY'] as const).map(target => (
                            <button
                              key={target}
                              onClick={() => setTargetHack('aimbotTarget', target)}
                              className={`py-1.5 text-[10px] font-mono font-bold rounded-lg border transition ${
                                activeCheats.aimbotTarget === target
                                  ? 'bg-red-500 text-slate-950 border-red-400'
                                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                              }`}
                            >
                              {target}
                            </button>
                          ))}
                        </div>
                      </div>

                      {activeCheats.aimbotMode === 'FOV_CIRCLE' && (
                        <div className="pt-2 border-t border-slate-800">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-[10px] text-red-500">FOV CIRCLE VISIBILITY</span>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {(['OBVIOUS', 'SUBTLE', 'HIDDEN'] as const).map(vis => (
                              <button
                                key={vis}
                                onClick={() => setTargetHack('fovVisibility', vis)}
                                className={`py-1 text-[9px] font-mono font-bold rounded border transition ${
                                  activeCheats.fovVisibility === vis
                                    ? 'bg-red-500 text-slate-950 border-red-400'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                              >
                                {vis}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {[
                      { id: 'healthBarESP', label: 'Health Bar ESP', desc: 'Display floating 3D health bars over player & bot heads' },
                      { id: 'tracerLines', label: 'ESP Tracer Lines', desc: 'Draw lines connecting to all players' },
                      { id: 'wallhack', label: 'Fire Through Walls', desc: 'Bullets penetrate all solid walls and crates' },
                      { id: 'oneShot', label: 'One Shot Kill', desc: 'All weapons deal 9999 instant damage' },
                      { id: 'rapidFire', label: 'Rapid Fire', desc: 'Max out fire rate for all weapons' },
                      { id: 'fullAuto', label: 'Full Auto', desc: 'Make semi-automatic weapons fully automatic' },
                      { id: 'noRecoil', label: 'No Recoil', desc: 'Remove weapon recoil entirely' },
                      { id: 'unlimitedAmmo', label: 'Infinite Ammo', desc: 'Never reload or run out of magazine clip ammo' },
                      { id: 'godMode', label: 'God Mode (Invincible)', desc: 'Ignores all incoming bot & player damage' },
                      { id: 'autoHeal', label: 'Auto Heal (Wolverine)', desc: 'Instantly regenerate health every frame' },
                      { id: 'speedHack', label: 'Super Speed (2.5x)', desc: 'Dramatically boosts soldier movement speed' },
                      { id: 'insaneSpeed', label: 'Insane Speed (10x)', desc: 'Move 10x faster like the Flash' },
                      { id: 'superJump', label: 'Super Jump', desc: 'Jump 3x higher than normal' },
                      { id: 'flyHack', label: 'Fly / Noclip (Hold Space)', desc: 'Hover or fly vertically around the battlefield' },
                    ].map(({ id, label, desc }) => {
                      const active = activeCheats[id];
                      return (
                        <div
                          key={id}
                          onClick={() => setTargetHack(id, !active)}
                          className={`p-3 rounded-xl border cursor-pointer flex justify-between items-center transition-all ${
                            active
                              ? 'bg-red-500/15 border-red-500/80 text-red-300 shadow-md shadow-red-500/10'
                              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <div className="font-bold text-xs flex items-center gap-2">
                              {label}
                            </div>
                            <div className="text-[10px] text-slate-500 font-sans mt-0.5">{desc}</div>
                          </div>
                          <div className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider ${
                            active ? 'bg-red-500 text-slate-950' : 'bg-slate-800 text-slate-500'
                          }`}>
                            {active ? 'ENABLED' : 'DISABLED'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="pt-4 border-t border-red-500/30">
                    <button 
                      onClick={() => {
                        if (!targetPlayer) return;
                        if (targetPlayer.id === clientId || targetPlayer.id === 'local') {
                           setHacks(activeCheats);
                           alert('Cheats applied to self');
                        } else if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                          socketRef.current.send(JSON.stringify({
                            type: 'admin_cheat',
                            payload: { targetId: targetPlayer.id, hacks: activeCheats }
                          }));
                          alert('Cheats synced to ' + (targetPlayer.name || 'Soldier'));
                        } else {
                           alert('Applied locally (Offline)');
                        }
                      }}
                      className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-3 rounded-xl shadow-[0_0_15px_rgba(220,38,38,0.4)] transition tracking-widest flex items-center justify-center gap-2"
                    >
                      APPLY CHEATS TO USER
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-slate-500">No players found to modify.</div>
              )}
            </div>
          </div>
        );
      })()}

      {/* CYBER HACK MENU OVERLAY (Press 7) */}
      {showHackMenu && (
        <div id="hack-menu-modal" className="absolute inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-emerald-500/80 rounded-2xl p-6 max-w-md w-full shadow-2xl shadow-emerald-500/20 text-white font-mono space-y-4">
            <div className="flex justify-between items-center border-b border-emerald-500/30 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                <h3 className="text-md font-black text-emerald-400 tracking-wider">
                  CYBER COMMAND // HACK MENU
                </h3>
              </div>
              <button
                id="close-hack-menu-btn"
                onClick={() => setShowHackMenu(false)}
                className="text-xs bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 px-3 py-1 rounded-lg border border-emerald-500/40 font-bold transition"
              >
                CLOSE (7)
              </button>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
              Click any toggle to enable real-time tactical cheats during combat:
            </p>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {/* ESP MODE SELECTOR */}
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-emerald-400">ESP VISUAL MODE</span>
                  <span className="text-[10px] text-slate-500">{hacks.espMode}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['OFF', 'FULL_BODY', 'BOXES'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setHacks(prev => ({ ...prev, espMode: mode }))}
                      className={`py-1.5 text-[10px] font-mono font-bold rounded-lg border transition ${
                        hacks.espMode === mode
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {mode.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* AIMBOT MODE SELECTOR */}
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-emerald-400">AIMBOT LOCK-ON MODE</span>
                  <span className="text-[10px] text-slate-500">{hacks.aimbotMode}</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['OFF', 'ADS_ONLY', 'ALWAYS', 'FOV_CIRCLE'] as const).map(mode => (
                    <button
                      key={mode}
                      id={`aimbot-mode-btn-${mode}`}
                      onClick={() => setHacks(prev => ({ ...prev, aimbotMode: mode }))}
                      className={`py-1.5 text-[10px] font-mono font-bold rounded-lg border transition ${
                        hacks.aimbotMode === mode
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {mode === 'ADS_ONLY' ? 'ADS' : mode === 'FOV_CIRCLE' ? 'FOV' : mode}
                    </button>
                  ))}
                </div>
                
                {/* AIMBOT TARGET SELECTOR */}
                <div className="pt-2 border-t border-slate-800">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-[10px] text-emerald-500">TARGET</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['HEAD', 'BODY'] as const).map(target => (
                      <button
                        key={target}
                        onClick={() => setHacks(prev => ({ ...prev, aimbotTarget: target }))}
                        className={`py-1.5 text-[10px] font-mono font-bold rounded-lg border transition ${
                          hacks.aimbotTarget === target
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        {target}
                      </button>
                    ))}
                  </div>
                </div>

                {hacks.aimbotMode === 'FOV_CIRCLE' && (
                  <div className="pt-2 border-t border-slate-800">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-[10px] text-emerald-500">FOV CIRCLE VISIBILITY</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['OBVIOUS', 'SUBTLE', 'HIDDEN'] as const).map(vis => (
                        <button
                          key={vis}
                          onClick={() => setHacks(prev => ({ ...prev, fovVisibility: vis }))}
                          className={`py-1 text-[9px] font-mono font-bold rounded border transition ${
                            hacks.fovVisibility === vis
                              ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          {vis}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {[
                { id: 'tracerLines', label: 'ESP Tracer Lines', desc: 'Draw lines connecting to all players' },
                { id: 'wallhack', label: 'Fire Through Walls', desc: 'Bullets penetrate all solid walls and crates' },
                { id: 'oneShot', label: 'One Shot Kill', desc: 'All weapons deal 9999 instant damage' },
                { id: 'rapidFire', label: 'Rapid Fire', desc: 'Max out fire rate for all weapons' },
                { id: 'fullAuto', label: 'Full Auto', desc: 'Make semi-automatic weapons fully automatic' },
                { id: 'noRecoil', label: 'No Recoil', desc: 'Remove weapon recoil entirely' },
                { id: 'unlimitedAmmo', label: 'Infinite Ammo', desc: 'Never reload or run out of magazine clip ammo' },
                { id: 'godMode', label: 'God Mode (Invincible)', desc: 'Ignores all incoming bot & player damage' },
                { id: 'autoHeal', label: 'Auto Heal (Wolverine)', desc: 'Instantly regenerate health every frame' },
                { id: 'speedHack', label: 'Super Speed (2.5x)', desc: 'Dramatically boosts soldier movement speed' },
                { id: 'insaneSpeed', label: 'Insane Speed (10x)', desc: 'Move 10x faster like the Flash' },
                { id: 'superJump', label: 'Super Jump', desc: 'Jump 3x higher than normal' },
                { id: 'flyHack', label: 'Fly / Noclip (Hold Space)', desc: 'Hover or fly vertically around the battlefield' },
              ].map(({ id, label, desc }) => {
                const active = hacks[id as keyof typeof hacks];
                return (
                  <div
                    key={id}
                    id={`hack-toggle-${id}`}
                    onClick={() => setHacks(prev => ({ ...prev, [id]: !prev[id as keyof typeof hacks] }))}
                    className={`p-3 rounded-xl border cursor-pointer flex justify-between items-center transition-all ${
                      active
                        ? 'bg-emerald-500/15 border-emerald-500/80 text-emerald-300 shadow-md shadow-emerald-500/10'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs flex items-center gap-2">
                        {label}
                      </div>
                      <div className="text-[10px] text-slate-500 font-sans mt-0.5">{desc}</div>
                    </div>
                    <div className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider ${
                      active ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'
                    }`}>
                      {active ? 'ENABLED' : 'DISABLED'}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* INSTANT NUKE / KILL ALL BOTS BUTTON */}
            <button
              id="kill-all-bots-btn"
              onClick={() => {
                gameRef.current.bots.forEach(bot => {
                  if (!bot.isDead) {
                    bot.health = 0;
                    bot.isDead = true;
                    bot.deaths++;
                    gameRef.current.playerKills++;
                    gameRef.current.playerScore += 150;
                  }
                });
                sounds.playKill();
                setShowHackMenu(false);
              }}
              className="w-full py-2.5 bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/50 text-rose-400 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
            >
              ☢️ INSTANT NUKE: ELIMINATE ALL BOTS NOW
            </button>

            <button
              id="resume-combat-hack-btn"
              onClick={() => setShowHackMenu(false)}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black tracking-wider text-xs rounded-xl shadow-lg transition"
            >
              RESUME COMBAT
            </button>
          </div>
        </div>
      )}

      {/* Red Blood vignette when taking massive damage */}
      {gameRef.current.playerHealth < 40 && !gameRef.current.playerIsDead && (
        <div
          id="damage-vignette"
          className="absolute inset-0 border-[16px] border-rose-600/30 pointer-events-none animate-pulse z-20 shadow-[inset_0_0_80px_rgba(220,38,38,0.5)]"
        />
      )}

      {/* Death overlay */}
      {gameRef.current.playerIsDead && (
        <div id="death-overlay" className="absolute inset-0 flex flex-col justify-center items-center bg-rose-950/70 backdrop-blur-sm z-30 animate-fade-in">
          <h2 className="text-5xl font-mono text-rose-500 tracking-wider font-extrabold animate-bounce">
            WASTED
          </h2>
          {deathMessage && (
            <div className="mt-4 px-6 py-2 rounded-xl text-2xl font-black italic uppercase shadow-2xl border-2 transform -skew-x-12 bg-gradient-to-r from-red-600 to-orange-500 border-yellow-400 text-white shadow-red-500/50 animate-slide-in">
              {deathMessage}
            </div>
          )}
          <p className="text-slate-300 font-sans mt-3 text-sm">
            Respawning back into action momentarily...
          </p>
        </div>
      )}
    </div>
  );
};
