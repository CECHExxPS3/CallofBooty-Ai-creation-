export type GameState = 'WELCOME' | 'LOBBY' | 'PLAYING' | 'POST_MATCH';
export type GraphicsLevel = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10';
export interface GraphicsQuality {
  level: GraphicsLevel;
  shadows: boolean;
  particles: boolean;
  antiAliasing: boolean;
  resolutionScale: number;
  postProcessing: boolean;
}

export interface KeyBindings {
  forward: string;
  backward: string;
  left: string;
  right: string;
  fire: string;
  aim: string;
  jump: string;
  reload: string;
  ability: string;
  swap: string;
}

export const DEFAULT_KEYBINDINGS: KeyBindings = {
  forward: 'w',
  backward: 's',
  left: 'a',
  right: 'd',
  fire: 'f',
  aim: 'e',
  jump: ' ',
  reload: 'r',
  ability: 'q',
  swap: 'c',
};

export interface Weapon {
  id: string;
  name: string;
  type: 'AR' | 'SNIPER' | 'LMG' | 'SMG' | 'PISTOL' | 'SHOTGUN' | 'KNIFE' | 'LAUNCHER';
  damage: number;
  fireRate: number; // delay in ms between shots
  maxAmmo: number;
  reloadTime: number; // in ms
  range: number;
  accuracy: number; // 0 to 1, higher is better (smaller spread)
  recoil: number;
  zoomFov: number; // FOV when scoping
  color: string;
  burstCount?: number;
  burstDelay?: number;
}

export interface CharacterClass {
  id: string;
  name: string;
  codename: string;
  description: string;
  primaryWeapon: Weapon;
  secondaryWeapon: Weapon;
  maxHealth: number;
  speed: number; // movement speed multiplier
  color: string;
  accentColor: string;
  ability: {
    name: string;
    description: string;
    cooldown: number; // in seconds
  };
}

export interface LobbyPlayer {
  id: string;
  name: string;
  isBot: boolean;
  classId: string;
  isReady: boolean;
  ping: number;
  rank: number;
  avatarSeed: string;
}

export interface MatchStats {
  id: string;
  name: string;
  isBot: boolean;
  classId: string;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  headshots?: number;
  timePlayedSeconds?: number;
  weaponKills?: Record<string, number>;
}

export interface KillFeedEntry {
  id: string;
  killer: { name: string; classId: string; isBot: boolean };
  victim: { name: string; classId: string; isBot: boolean };
  weaponName: string;
  isHeadshot: boolean;
  time: number;
}

export interface XpEvent {
  id: string;
  amount: number;
  reason: string;
}

export interface MatchConfig {
  mapId: 'shipment' | 'rust' | 'dust2' | 'nuketown';
  timeLimit: number; // in seconds
  scoreLimit: number; // kills to win
  botCount: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  isMultiplayer?: boolean;
  roomCode?: string;
  spectatorMode?: boolean;
}

export interface TouchBindings {
  btnFire: keyof KeyBindings;
  btnAim: keyof KeyBindings;
  btnJump: keyof KeyBindings;
  btnReload: keyof KeyBindings;
  btnAbility: keyof KeyBindings;
  btnSwap: keyof KeyBindings;
}

export const DEFAULT_TOUCHBINDINGS: TouchBindings = {
  btnFire: 'fire',
  btnAim: 'aim',
  btnJump: 'jump',
  btnReload: 'reload',
  btnAbility: 'ability',
  btnSwap: 'swap',
};

export interface WeaponAmmo {
  clip: number;
  reserve: number;
}

export interface GameParticle {
  position: [number, number, number];
  velocity: [number, number, number];
  color: string;
  size: number;
  life: number; // 0 to 1
  maxLife: number;
}

// Pre-defined Weapons
export const WEAPONS: Record<string, Weapon> = {
  // Primaries - AR
  m4_assault: {
    id: 'm4_assault',
    name: 'M4-Tactical',
    type: 'AR',
    damage: 24, // 5-shot body, 4-shot chest
    fireRate: 130,
    maxAmmo: 30,
    reloadTime: 1800,
    range: 120,
    accuracy: 0.92,
    recoil: 0.04,
    zoomFov: 50,
    color: '#34d399',
  },
  m16_burst: {
    id: 'm16_burst',
    name: 'M16 Classic',
    type: 'AR',
    damage: 28,
    fireRate: 400,
    maxAmmo: 30,
    reloadTime: 1900,
    range: 140,
    accuracy: 0.95,
    recoil: 0.05,
    zoomFov: 48,
    color: '#64748b',
    burstCount: 3,
    burstDelay: 60,
  },
  ak47_heavy: {
    id: 'ak47_heavy',
    name: 'AK-47 Dominator',
    type: 'AR',
    damage: 27, // 4-shot body, 3-shot head
    fireRate: 170,
    maxAmmo: 30,
    reloadTime: 2100,
    range: 135,
    accuracy: 0.88,
    recoil: 0.08,
    zoomFov: 52,
    color: '#f97316',
  },
  scar_heavy: {
    id: 'scar_heavy',
    name: 'SCAR-H Heavy',
    type: 'AR',
    damage: 29, // 4-shot body
    fireRate: 200,
    maxAmmo: 20,
    reloadTime: 2200,
    range: 145,
    accuracy: 0.90,
    recoil: 0.09,
    zoomFov: 48,
    color: '#d97706',
  },
  grau_556: {
    id: 'grau_556',
    name: 'Grau 5.56 Precision',
    type: 'AR',
    damage: 23,
    fireRate: 120,
    maxAmmo: 30,
    reloadTime: 1750,
    range: 125,
    accuracy: 0.95,
    recoil: 0.03,
    zoomFov: 50,
    color: '#10b981',
  },
  kilo_141: {
    id: 'kilo_141',
    name: 'Kilo 141',
    type: 'AR',
    damage: 26,
    fireRate: 155,
    maxAmmo: 30,
    reloadTime: 1850,
    range: 135,
    accuracy: 0.92,
    recoil: 0.05,
    zoomFov: 50,
    color: '#64748b',
  },
  ak117: {
    id: 'ak117',
    name: 'AK117',
    type: 'AR',
    damage: 22,
    fireRate: 110,
    maxAmmo: 30,
    reloadTime: 1750,
    range: 115,
    accuracy: 0.86,
    recoil: 0.06,
    zoomFov: 54,
    color: '#8b5cf6',
  },
  type25: {
    id: 'type25',
    name: 'Type 25',
    type: 'AR',
    damage: 24,
    fireRate: 100,
    maxAmmo: 30,
    reloadTime: 1600,
    range: 90,
    accuracy: 0.80,
    recoil: 0.08,
    zoomFov: 56,
    color: '#ef4444',
  },
  as_val: {
    id: 'as_val',
    name: 'AS VAL Suppressed',
    type: 'AR',
    damage: 28,
    fireRate: 95,
    maxAmmo: 25,
    reloadTime: 1550,
    range: 110,
    accuracy: 0.89,
    recoil: 0.07,
    zoomFov: 52,
    color: '#3f3f46',
  },

  // Snipers
  dlq_sniper: {
    id: 'dlq_sniper',
    name: 'DL-Q33 Apex',
    type: 'SNIPER',
    damage: 85, // 1-shot headshot / high torso
    fireRate: 1400,
    maxAmmo: 5,
    reloadTime: 2500,
    range: 300,
    accuracy: 0.99,
    recoil: 0.25,
    zoomFov: 20,
    color: '#60a5fa',
  },
  locus_sniper: {
    id: 'locus_sniper',
    name: 'Locus Carbon-50',
    type: 'SNIPER',
    damage: 82,
    fireRate: 1150,
    maxAmmo: 6,
    reloadTime: 2200,
    range: 320,
    accuracy: 0.98,
    recoil: 0.22,
    zoomFov: 18,
    color: '#38bdf8',
  },
  kar98k_bolt: {
    id: 'kar98k_bolt',
    name: 'Kar98k Marksman',
    type: 'SNIPER',
    damage: 75,
    fireRate: 850,
    maxAmmo: 5,
    reloadTime: 2000,
    range: 260,
    accuracy: 0.97,
    recoil: 0.18,
    zoomFov: 25,
    color: '#a16207',
  },
  hunting_rifle: {
    id: 'hunting_rifle',
    name: 'Scout Hunting Rifle (No Scope)',
    type: 'SNIPER',
    damage: 70,
    fireRate: 750,
    maxAmmo: 5,
    reloadTime: 1750,
    range: 220,
    accuracy: 0.95,
    recoil: 0.14,
    zoomFov: 55, // Iron sights / no scope
    color: '#78350f',
  },
  arctic_50: {
    id: 'arctic_50',
    name: 'Arctic .50',
    type: 'SNIPER',
    damage: 82,
    fireRate: 900,
    maxAmmo: 7,
    reloadTime: 2300,
    range: 280,
    accuracy: 0.94,
    recoil: 0.30,
    zoomFov: 22,
    color: '#0ea5e9',
  },
  hdr_sniper: {
    id: 'hdr_sniper',
    name: 'HDR Heavy Sniper',
    type: 'SNIPER',
    damage: 95,
    fireRate: 1500,
    maxAmmo: 5,
    reloadTime: 2800,
    range: 350,
    accuracy: 0.99,
    recoil: 0.40,
    zoomFov: 16,
    color: '#52525b',
  },

  // LMGs
  chopper_lmg: {
    id: 'chopper_lmg',
    name: 'LMG Chopper',
    type: 'LMG',
    damage: 21,
    fireRate: 90,
    maxAmmo: 75,
    reloadTime: 3500,
    range: 100,
    accuracy: 0.85,
    recoil: 0.06,
    zoomFov: 55,
    color: '#fbbf24',
  },
  rpd_heavy: {
    id: 'rpd_heavy',
    name: 'RPD Drum Titan',
    type: 'LMG',
    damage: 24,
    fireRate: 110,
    maxAmmo: 100,
    reloadTime: 4000,
    range: 130,
    accuracy: 0.88,
    recoil: 0.07,
    zoomFov: 52,
    color: '#eab308',
  },
  holger_26: {
    id: 'holger_26',
    name: 'Holger 26',
    type: 'LMG',
    damage: 25,
    fireRate: 125,
    maxAmmo: 100,
    reloadTime: 3200,
    range: 120,
    accuracy: 0.86,
    recoil: 0.08,
    zoomFov: 50,
    color: '#f97316',
  },
  pkm_lmg: {
    id: 'pkm_lmg',
    name: 'PKM Heavy LMG',
    type: 'LMG',
    damage: 32,
    fireRate: 150,
    maxAmmo: 120,
    reloadTime: 5000,
    range: 150,
    accuracy: 0.90,
    recoil: 0.12,
    zoomFov: 48,
    color: '#84cc16',
  },

  // SMGs
  fennec_smg: {
    id: 'fennec_smg',
    name: 'Fennec SMG',
    type: 'SMG',
    damage: 17,
    fireRate: 60,
    maxAmmo: 40,
    reloadTime: 1500,
    range: 60,
    accuracy: 0.82,
    recoil: 0.05,
    zoomFov: 60,
    color: '#f87171',
  },
  mp5_tactical: {
    id: 'mp5_tactical',
    name: 'MP5 Submachine',
    type: 'SMG',
    damage: 21,
    fireRate: 100,
    maxAmmo: 32,
    reloadTime: 1400,
    range: 75,
    accuracy: 0.89,
    recoil: 0.04,
    zoomFov: 58,
    color: '#a855f7',
  },
  vector_burst: {
    id: 'vector_burst',
    name: 'Vector Hyper-Drive',
    type: 'SMG',
    damage: 18,
    fireRate: 350,
    maxAmmo: 45,
    reloadTime: 1300,
    range: 65,
    accuracy: 0.84,
    recoil: 0.06,
    zoomFov: 62,
    color: '#ec4899',
    burstCount: 4,
    burstDelay: 40,
  },
  p90_pdw: {
    id: 'p90_pdw',
    name: 'P90 PDW-50',
    type: 'SMG',
    damage: 19,
    fireRate: 80,
    maxAmmo: 50,
    reloadTime: 1650,
    range: 70,
    accuracy: 0.88,
    recoil: 0.04,
    zoomFov: 60,
    color: '#06b6d4',
  },
  mac10_micro: {
    id: 'mac10_micro',
    name: 'MAC-10 Shredder',
    type: 'SMG',
    damage: 16,
    fireRate: 45,
    maxAmmo: 32,
    reloadTime: 1250,
    range: 55,
    accuracy: 0.78,
    recoil: 0.07,
    zoomFov: 62,
    color: '#f43f5e',
  },
  cbr4_smg: {
    id: 'cbr4_smg',
    name: 'CBR4',
    type: 'SMG',
    damage: 22,
    fireRate: 85,
    maxAmmo: 50,
    reloadTime: 1600,
    range: 75,
    accuracy: 0.85,
    recoil: 0.05,
    zoomFov: 58,
    color: '#14b8a6',
  },
  bizon_smg: {
    id: 'bizon_smg',
    name: 'PP19 Bizon',
    type: 'SMG',
    damage: 26,
    fireRate: 110,
    maxAmmo: 64,
    reloadTime: 2000,
    range: 85,
    accuracy: 0.88,
    recoil: 0.03,
    zoomFov: 55,
    color: '#a3e635',
  },

  // Secondaries & Pistols
  mw11_pistol: {
    id: 'mw11_pistol',
    name: 'MW11 Pistol',
    type: 'PISTOL',
    damage: 22,
    fireRate: 220,
    maxAmmo: 12,
    reloadTime: 1200,
    range: 50,
    accuracy: 0.90,
    recoil: 0.08,
    zoomFov: 65,
    color: '#9ca3af',
  },
  deagle_heavy: {
    id: 'deagle_heavy',
    name: 'Desert Eagle .50',
    type: 'PISTOL',
    damage: 48,
    fireRate: 380,
    maxAmmo: 7,
    reloadTime: 1600,
    range: 85,
    accuracy: 0.94,
    recoil: 0.18,
    zoomFov: 55,
    color: '#cbd5e1',
  },
  j358_revolver: {
    id: 'j358_revolver',
    name: 'J358 Revolver',
    type: 'PISTOL',
    damage: 60,
    fireRate: 350,
    maxAmmo: 6,
    reloadTime: 1800,
    range: 70,
    accuracy: 0.92,
    recoil: 0.25,
    zoomFov: 50,
    color: '#d4d4d8',
  },
  renetti_burst: {
    id: 'renetti_burst',
    name: 'Renetti 3-Burst',
    type: 'PISTOL',
    damage: 28,
    fireRate: 400,
    maxAmmo: 15,
    reloadTime: 1400,
    range: 55,
    accuracy: 0.88,
    recoil: 0.10,
    zoomFov: 60,
    color: '#38bdf8',
    burstCount: 3,
    burstDelay: 60,
  },
  gs50_pistol: {
    id: 'gs50_pistol',
    name: '.50 GS Handcannon',
    type: 'PISTOL',
    damage: 70,
    fireRate: 450,
    maxAmmo: 7,
    reloadTime: 2000,
    range: 80,
    accuracy: 0.95,
    recoil: 0.35,
    zoomFov: 45,
    color: '#fbbf24',
  },

  // Shotguns
  striker_shotgun: {
    id: 'striker_shotgun',
    name: 'Striker 12G',
    type: 'SHOTGUN',
    damage: 14, // 14 x 8 pellets = 112 close range
    fireRate: 450,
    maxAmmo: 8,
    reloadTime: 1800,
    range: 35,
    accuracy: 0.55,
    recoil: 0.18,
    zoomFov: 65,
    color: '#c084fc',
  },
  krm_shotgun: {
    id: 'krm_shotgun',
    name: 'KRM-262 Heavy Pump',
    type: 'SHOTGUN',
    damage: 18, // 18 x 8 = 144 close range
    fireRate: 800,
    maxAmmo: 6,
    reloadTime: 2100,
    range: 32,
    accuracy: 0.60,
    recoil: 0.28,
    zoomFov: 65,
    color: '#e879f9',
  },
  by15_shotgun: {
    id: 'by15_shotgun',
    name: 'BY15 Tactical Pump',
    type: 'SHOTGUN',
    damage: 20, // 20 x 8 = 160 close range
    fireRate: 720,
    maxAmmo: 7,
    reloadTime: 1950,
    range: 38,
    accuracy: 0.65,
    recoil: 0.25,
    zoomFov: 64,
    color: '#10b981',
  },
  origin12_auto: {
    id: 'origin12_auto',
    name: 'Origin-12 Auto',
    type: 'SHOTGUN',
    damage: 13,
    fireRate: 280,
    maxAmmo: 12,
    reloadTime: 2400,
    range: 30,
    accuracy: 0.50,
    recoil: 0.20,
    zoomFov: 65,
    color: '#f59e0b',
  },
  hs0405_shotgun: {
    id: 'hs0405_shotgun',
    name: 'HS0405 Lever-Action',
    type: 'SHOTGUN',
    damage: 26,
    fireRate: 900,
    maxAmmo: 7,
    reloadTime: 2500,
    range: 35,
    accuracy: 0.65,
    recoil: 0.35,
    zoomFov: 60,
    color: '#fb7185',
  },
  echo_shotgun: {
    id: 'echo_shotgun',
    name: 'Echo Auto-Shotgun',
    type: 'SHOTGUN',
    damage: 15,
    fireRate: 250,
    maxAmmo: 14,
    reloadTime: 2200,
    range: 25,
    accuracy: 0.55,
    recoil: 0.15,
    zoomFov: 65,
    color: '#f472b6',
  },

  // Marksman & Specials
  m21_dmr: {
    id: 'm21_dmr',
    name: 'M21 EBR Marksman',
    type: 'AR',
    damage: 45,
    fireRate: 220,
    maxAmmo: 15,
    reloadTime: 1900,
    range: 220,
    accuracy: 0.96,
    recoil: 0.10,
    zoomFov: 35,
    color: '#38bdf8',
  },
  crossbow_explosive: {
    id: 'crossbow_explosive',
    name: 'Aero Crossbow Bolt',
    type: 'SNIPER',
    damage: 110,
    fireRate: 1100,
    maxAmmo: 1,
    reloadTime: 1500,
    range: 150,
    accuracy: 0.97,
    recoil: 0.12,
    zoomFov: 40,
    color: '#facc15',
  },
  rpg7_rocket: {
    id: 'rpg7_rocket',
    name: 'RPG-7 Rocket Launcher',
    type: 'LAUNCHER',
    damage: 95,
    fireRate: 2200,
    maxAmmo: 1,
    reloadTime: 2800,
    range: 200,
    accuracy: 0.90,
    recoil: 0.35,
    zoomFov: 50,
    color: '#ef4444',
  },
  tactical_knife: {
    id: 'tactical_knife',
    name: 'Tactical Blade',
    type: 'KNIFE',
    damage: 150,
    fireRate: 400,
    maxAmmo: 1,
    reloadTime: 10,
    range: 4,
    accuracy: 1.0,
    recoil: 0,
    zoomFov: 70,
    color: '#f43f5e',
  },
  katana_melee: {
    id: 'katana_melee',
    name: 'Cyber Katana',
    type: 'KNIFE',
    damage: 150,
    fireRate: 320,
    maxAmmo: 1,
    reloadTime: 10,
    range: 5,
    accuracy: 1.0,
    recoil: 0,
    zoomFov: 70,
    color: '#38bdf8',
  },
  karambit: {
    id: 'karambit',
    name: 'Karambit',
    type: 'KNIFE',
    damage: 150,
    fireRate: 250,
    maxAmmo: 1,
    reloadTime: 10,
    range: 3.5,
    accuracy: 1.0,
    recoil: 0,
    zoomFov: 70,
    color: '#f87171',
  },
  baseball_bat: {
    id: 'baseball_bat',
    name: 'Baseball Bat',
    type: 'KNIFE',
    damage: 150,
    fireRate: 500,
    maxAmmo: 1,
    reloadTime: 10,
    range: 5.5,
    accuracy: 1.0,
    recoil: 0,
    zoomFov: 70,
    color: '#fb923c',
  },
  axe_melee: {
    id: 'axe_melee',
    name: 'Combat Axe',
    type: 'KNIFE',
    damage: 150,
    fireRate: 600,
    maxAmmo: 1,
    reloadTime: 10,
    range: 6.0,
    accuracy: 1.0,
    recoil: 0,
    zoomFov: 70,
    color: '#a3a3a3',
  }
};

// Pre-defined Classes
export const CLASSES: CharacterClass[] = [
  {
    id: 'assault',
    name: 'Ghost Stalker',
    codename: 'GHOST',
    description: 'All-around tactical soldier equipped with a versatile assault rifle and pistol. Ideal for frontline combat.',
    primaryWeapon: WEAPONS.m4_assault,
    secondaryWeapon: WEAPONS.gs50_pistol,
    maxHealth: 160,
    speed: 1.0,
    color: '#1e293b', // Slate
    accentColor: '#10b981', // Emerald
    ability: {
      name: 'Adrenaline Shot',
      description: 'Instantly heals 40 HP and boosts movement speed by 30% for 5 seconds.',
      cooldown: 15,
    }
  },
  {
    id: 'breacher',
    name: 'Enforcer Breacher',
    codename: 'BREACH',
    description: 'Close-quarters heavy specialist equipped with a devastating KRM-262 Heavy Shotgun to blow through defenses.',
    primaryWeapon: WEAPONS.krm_shotgun,
    secondaryWeapon: WEAPONS.deagle_heavy,
    maxHealth: 190,
    speed: 1.05,
    color: '#581c87', // Deep Violet
    accentColor: '#c084fc', // Purple
    ability: {
      name: 'Concussion Blast',
      description: 'Emits a shockwave that stuns and disorients nearby enemies for 4 seconds.',
      cooldown: 16,
    }
  },
  {
    id: 'recon',
    name: 'Apex Pathfinder',
    codename: 'RECON',
    description: 'Sniper specialist who excels at long-range reconnaissance with primary sniper and secondary hunting rifle.',
    primaryWeapon: WEAPONS.dlq_sniper,
    secondaryWeapon: WEAPONS.hunting_rifle, // Secondary sniper / hunting rifle
    maxHealth: 130,
    speed: 1.1, // fast
    color: '#14532d', // Forest green
    accentColor: '#3b82f6', // Blue
    ability: {
      name: 'Pulse Sensor',
      description: 'Reveals all enemy positions on the minimap for 6 seconds.',
      cooldown: 20,
    }
  },
  {
    id: 'heavy',
    name: 'Iron Vanguard',
    codename: 'BULWARK',
    description: 'Armored juggernaut utilizing a high-capacity light machine gun and RPG-7 rocket launcher.',
    primaryWeapon: WEAPONS.chopper_lmg,
    secondaryWeapon: WEAPONS.rpg7_rocket,
    maxHealth: 250, // tanky
    speed: 0.8, // slow
    color: '#451a03', // Bulk brown
    accentColor: '#f59e0b', // Amber
    ability: {
      name: 'Nano Barrier',
      description: 'Activates a personal shielding matrix reducing incoming damage by 50% for 6 seconds.',
      cooldown: 18,
    }
  },
  {
    id: 'marksman',
    name: 'DMR Sharpshooter',
    codename: 'MARKSMAN',
    description: 'Precision rifleman equipped with an M21 EBR and Kar98k sniper secondary.',
    primaryWeapon: WEAPONS.m21_dmr,
    secondaryWeapon: WEAPONS.kar98k_bolt, // Secondary sniper
    maxHealth: 150,
    speed: 1.05,
    color: '#0369a1', // Sky
    accentColor: '#38bdf8', // Cyan
    ability: {
      name: 'Overcharge Lens',
      description: 'Increases weapon fire rate by 40% and accuracy to 100% for 6 seconds.',
      cooldown: 18,
    }
  },
  {
    id: 'skirmisher',
    name: 'Shadow Wraith',
    codename: 'SHADOW',
    description: 'High-speed assassin outfitted with an ultra-fire-rate SMG and a lethal blade.',
    primaryWeapon: WEAPONS.fennec_smg,
    secondaryWeapon: WEAPONS.tactical_knife,
    maxHealth: 140,
    speed: 1.25, // extremely fast
    color: '#311042', // Deep purple
    accentColor: '#ec4899', // Pink
    ability: {
      name: 'Cloaking Shroud',
      description: 'Become semi-invisible and move completely silently for 5 seconds.',
      cooldown: 16,
    }
  }
];

export const MAPS = [
  {
    id: 'nuketown',
    name: 'Nuketown 2025',
    description: 'Iconic suburban nuclear test site featuring yellow/green 2-story houses, school bus, delivery truck, cul-de-sac, and backyard fences.',
    color: '#f59e0b',
  },
  {
    id: 'shipment',
    name: 'Sector-4 Shipment',
    description: 'A tight, chaotic dockyard filled with shipping containers. Expect immediate action and non-stop skirmishes.',
    color: '#3f3f46',
  },
  {
    id: 'rust',
    name: 'Dust Rustlands',
    description: 'An abandoned industrial desert outpost with vertical towers and pipe walkways. High tactical elevation.',
    color: '#d97706',
  },
  {
    id: 'dust2',
    name: 'Desert Compound',
    description: 'A classic tactical layout with standard corridors, a central square, and long sniping lanes.',
    color: '#ca8a04',
  }
];

export const BOT_NAMES = [
  'Soap_MacTavish',
  'Captain_Price',
  'Ghost_Riley',
  'Gaz_Garrick',
  'Shepherd_General',
  'Makarov_Val',
  'Yuri_Kozlov',
  'Roach_Sanderson',
  'Kruger_K',
  'Mara_Tactical',
  'Nikto_Shroud',
  'Alex_Echo'
];
