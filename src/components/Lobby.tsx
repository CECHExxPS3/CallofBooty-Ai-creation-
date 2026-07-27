import React, { useState, useEffect } from 'react';
import { CLASSES, MAPS, BOT_NAMES, WEAPONS, CharacterClass, MatchConfig, LobbyPlayer, KeyBindings, TouchBindings, GraphicsQuality } from '../types';
import { Shield, Target, Users, Settings, Flame, Play, Volume2, VolumeX, Swords, Award, Smartphone, Globe } from 'lucide-react';
import { sounds } from '../lib/sounds';
import { KeybindingsEditor } from './KeybindingsEditor';
import { ProfileModal } from './ProfileModal';
import { AdminPanelModal } from './AdminPanelModal';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface LobbyProps {
  onStartGame: (config: MatchConfig, selectedClass: CharacterClass, name: string) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  bindings: KeyBindings;
  onBindingsChange: (bindings: KeyBindings) => void;
  touchBindings: TouchBindings;
  onTouchBindingsChange: (bindings: TouchBindings) => void;
  useTouchControls: boolean;
  onToggleTouchControls: (enabled: boolean) => void;
  graphicsQuality: GraphicsQuality;
  onGraphicsQualityChange: (quality: GraphicsQuality) => void;
  user?: any;
  onLogout?: () => void;
}

export const Lobby: React.FC<LobbyProps> = ({
  onStartGame,
  isMuted,
  onToggleMute,
  bindings,
  onBindingsChange,
  touchBindings,
  onTouchBindingsChange,
  useTouchControls,
  onToggleTouchControls,
  graphicsQuality,
  onGraphicsQualityChange,
  user,
  onLogout
}) => {
  // Config states
  const [playerName, setPlayerName] = useState(user?.username || 'Recruit_Soldier');
  const [selectedClassId, setSelectedClassId] = useState('assault');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedPrimaryId, setSelectedPrimaryId] = useState('m4_assault');
  const [selectedSecondaryId, setSelectedSecondaryId] = useState('mw11_pistol');
  const [selectedMapId, setSelectedMapId] = useState<'shipment' | 'rust' | 'dust2' | 'nuketown'>('nuketown');
  const [botCount, setBotCount] = useState(5);
  const [difficulty, setDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');
  const [scoreLimit, setScoreLimit] = useState(20);
  const [timeLimit, setTimeLimit] = useState(300); // 5 mins
  const [lobbyMode, setLobbyMode] = useState<'CREATE' | 'JOIN'>('CREATE');
  const [showPinKeypad, setShowPinKeypad] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  
  const [roomCode, setRoomCode] = useState(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const room = urlParams.get('room');
      if (room) {
        return room.toUpperCase();
      }
    }
    return 'MAIN';
  });
  
  const [customRoomInput, setCustomRoomInput] = useState(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const room = urlParams.get('room');
      if (room) {
        return room.toUpperCase();
      }
    }
    return '';
  });
  
  const [isMultiplayer, setIsMultiplayer] = useState(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return !!urlParams.get('room');
    }
    return false;
  });

  const [availableRooms, setAvailableRooms] = useState<Array<{ code: string; name: string; mapId: string; playerCount: number; scoreLimit: number; hostId: string; }>>([]);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [customRoomName, setCustomRoomName] = useState('');
  const [settingsTab, setSettingsTab] = useState<'GRAPHICS' | 'TACTICAL'>('GRAPHICS');
  const [copiedNotice, setCopiedNotice] = useState(false);

  // Sensitivity & Aim Assist controls
  const [cameraSens, setCameraSens] = useState(() => {
    return parseFloat(localStorage.getItem('codm_camera_sens') || '1.0');
  });
  const [adsSens, setAdsSens] = useState(() => {
    return parseFloat(localStorage.getItem('codm_ads_sens') || '0.5');
  });
  const [aimAssist, setAimAssist] = useState<'OFF' | 'LIGHT' | 'HEAVY'>(() => {
    return (localStorage.getItem('codm_aim_assist') as any) || 'OFF';
  });

  useEffect(() => {
    localStorage.setItem('codm_camera_sens', cameraSens.toString());
    localStorage.setItem('codm_ads_sens', adsSens.toString());
    localStorage.setItem('codm_aim_assist', aimAssist);
  }, [cameraSens, adsSens, aimAssist]);

  // When class changes, sync default weapons for that class
  const handleSelectClass = (clsId: string) => {
    setSelectedClassId(clsId);
    const cls = CLASSES.find(c => c.id === clsId) || CLASSES[0];
    setSelectedPrimaryId(cls.primaryWeapon.id);
    setSelectedSecondaryId(cls.secondaryWeapon.id);
    sounds.playReload();
  };

  // Fetch active multiplayer rooms currently being played
  useEffect(() => {
    if (lobbyMode !== 'JOIN') return;
    const fetchRooms = async () => {
      try {
        const res = await fetch('/api/rooms');
        if (res.ok) {
          const data = await res.json();
          if (data.rooms) {
            // Strictly exclude any fake or empty lobbies (only show active matches with playerCount > 0)
            const liveRooms = data.rooms.filter((r: any) => r.playerCount > 0);
            setAvailableRooms(liveRooms);
          }
        }
      } catch (err) {
        // Silently handle if offline
      }
    };
    fetchRooms();
    const interval = setInterval(fetchRooms, 3000);
    return () => clearInterval(interval);
  }, [lobbyMode]);

  // Pre-game lobby roster simulation
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);

  const selectedClass = CLASSES.find(c => c.id === selectedClassId) || CLASSES[0];
  const activeMap = MAPS.find(m => m.id === selectedMapId) || MAPS[0];

  // Regulate sound checks
  useEffect(() => {
    sounds.toggle(!isMuted);
  }, [isMuted]);

  // Generate the lobby player list when configs change
  useEffect(() => {
    const list: LobbyPlayer[] = [
      {
        id: 'player',
        name: playerName || 'Recruit_Soldier',
        isBot: false,
        classId: selectedClassId,
        isReady: true,
        ping: 0,
        rank: 55, // Max classic prestige!
        avatarSeed: 'you'
      }
    ];

    // Populate with bots up to botCount
    for (let i = 0; i < botCount; i++) {
      const botName = BOT_NAMES[i % BOT_NAMES.length];
      const botClass = CLASSES[Math.floor((i + 2) % CLASSES.length)];
      list.push({
        id: `bot_${i}`,
        name: botName,
        isBot: true,
        classId: botClass.id,
        isReady: true,
        ping: 15 + Math.floor(Math.random() * 25),
        rank: 10 + Math.floor(Math.random() * 45),
        avatarSeed: `bot-${i}`
      });
    }

    setLobbyPlayers(list);
  }, [playerName, selectedClassId, botCount]);

  const handleConnectPrivateRoom = async (inputCode?: string) => {
    sounds.playKill();
    const target = (inputCode || customRoomInput || roomCode || 'MAIN').trim().toUpperCase() || 'MAIN';
    setRoomCode(target);
    setCustomRoomInput(target);
    setIsMultiplayer(true);

    let targetMapId = selectedMapId;
    let targetScore = scoreLimit;
    let targetTime = timeLimit;
    let targetBots = botCount;
    let targetDifficulty = difficulty;

    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        const found = data.rooms?.find((r: any) => r.code.toUpperCase() === target);
        if (found) {
          targetMapId = (found.mapId as any) || targetMapId;
          targetScore = found.scoreLimit || targetScore;
          targetTime = found.timeLimit || targetTime;
          targetBots = found.botCount !== undefined ? found.botCount : targetBots;
          targetDifficulty = found.difficulty || targetDifficulty;

          setSelectedMapId(targetMapId);
          setScoreLimit(targetScore);
          setTimeLimit(targetTime);
          setBotCount(targetBots);
          setDifficulty(targetDifficulty);
        }
      }
    } catch (e) {
      console.warn('[MULTIPLAYER] Failed to query room details prior to connect:', e);
    }

    const primaryWep = Object.values(WEAPONS).find(w => w.id === selectedPrimaryId) || selectedClass.primaryWeapon;
    const secondaryWep = Object.values(WEAPONS).find(w => w.id === selectedSecondaryId) || selectedClass.secondaryWeapon;

    const customizedClass: CharacterClass = {
      ...selectedClass,
      primaryWeapon: primaryWep,
      secondaryWeapon: secondaryWep
    };

    onStartGame(
      {
        mapId: targetMapId,
        timeLimit: targetTime,
        scoreLimit: targetScore,
        botCount: targetBots,
        difficulty: targetDifficulty,
        isMultiplayer: true,
        roomCode: target,
      },
      customizedClass,
      playerName || 'Recruit_Soldier'
    );
  };

  const syncRoomSettings = async (overrides?: { mapId?: string; scoreLimit?: number; timeLimit?: number; botCount?: number; difficulty?: string }) => {
    const targetCode = (roomCode || customRoomInput || 'MAIN').toUpperCase();
    try {
      await fetch('/api/rooms/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: targetCode,
          mapId: overrides?.mapId !== undefined ? overrides.mapId : selectedMapId,
          scoreLimit: overrides?.scoreLimit !== undefined ? overrides.scoreLimit : scoreLimit,
          timeLimit: overrides?.timeLimit !== undefined ? overrides.timeLimit : timeLimit,
          botCount: overrides?.botCount !== undefined ? overrides.botCount : botCount,
          difficulty: overrides?.difficulty !== undefined ? overrides.difficulty : difficulty,
        })
      });
    } catch (e) {
      console.warn('[LOBBY] Failed to sync room settings:', e);
    }
  };

  const handleStart = async () => {
    sounds.playKill(); // Match start victorious sound chime
    const effectivelyMultiplayer = isMultiplayer || lobbyMode === 'JOIN';
    const targetRoom = effectivelyMultiplayer ? (roomCode || customRoomInput.trim() || 'MAIN').toUpperCase() : 'MAIN';
    
    await syncRoomSettings();

    // Construct active character class with user customized loadout
    const primaryWep = Object.values(WEAPONS).find(w => w.id === selectedPrimaryId) || selectedClass.primaryWeapon;
    const secondaryWep = Object.values(WEAPONS).find(w => w.id === selectedSecondaryId) || selectedClass.secondaryWeapon;

    const customizedClass: CharacterClass = {
      ...selectedClass,
      primaryWeapon: primaryWep,
      secondaryWeapon: secondaryWep
    };

    onStartGame(
      {
        mapId: selectedMapId,
        timeLimit,
        scoreLimit,
        botCount,
        difficulty,
        isMultiplayer: effectivelyMultiplayer,
        roomCode: targetRoom,
      },
      customizedClass,
      playerName || 'Recruit_Soldier'
    );
  };

  return (
    <div id="lobby-root" className="h-screen overflow-y-auto bg-slate-950 text-white flex flex-col font-sans select-none pb-16">
      
      {copiedNotice && (
        <div className="bg-emerald-500 text-slate-950 px-6 py-2.5 text-xs font-mono font-bold text-center tracking-wider uppercase animate-bounce shadow-xl flex items-center justify-center gap-2">
          <Globe className="w-4 h-4" />
          <span>GLOBAL SHARE LINK COPIED! SHARE WITH FRIENDS ANYWHERE WORLDWIDE TO PLAY TOGETHER ONLINE!</span>
        </div>
      )}

      {/* HEADER BAR */}
      <header id="lobby-header" className="w-full max-w-7xl mx-auto px-6 py-5 flex justify-between items-center border-b border-slate-900">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 border-2 border-emerald-500/20 rounded-2xl">
            <Swords className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
              POLY COMBAT <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-mono">3D FPS</span>
            </h1>
            <p className="text-xs text-slate-400">Low-Poly optimized first person bot battle arena</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const url = window.location.origin;
              navigator.clipboard.writeText(url);
              setCopiedNotice(true);
              setTimeout(() => setCopiedNotice(false), 4000);
            }}
            className="hidden sm:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/40 hover:bg-emerald-500/20 text-emerald-400 px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition shadow-lg shadow-emerald-500/10"
            title="Copy Global Online Sharing Link to play with anyone around the world"
          >
            <Globe className="w-4 h-4 text-emerald-400 animate-spin" style={{ animationDuration: '8s' }} />
            <span>GLOBAL ONLINE SHARE LINK</span>
          </button>

          {user && (
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-xl px-4 py-2 transition text-sm font-bold text-slate-300"
            >
              <Award className="w-4 h-4 text-emerald-400" />
              <span>Level {user.level || 1}</span>
            </button>
          )}
          <div className="hidden sm:flex items-center gap-1.5 animate-pulse bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 px-3 py-1.5 rounded-xl text-xs font-mono font-bold tracking-wider shadow-lg shadow-emerald-500/10">
            <span>✨ TACTICAL SETTINGS</span>
          </div>
          <button
            onClick={() => setShowSettingsModal(true)}
            className="relative p-3 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-emerald-500/50 rounded-xl transition group"
            title="Tactical & Graphics Settings"
          >
            <Settings className="text-emerald-400 w-5 h-5 group-hover:rotate-45 transition-transform duration-300" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </button>
          
          {/* Audio toggle button */}
          <button
            id="lobby-audio-toggle"
            onClick={onToggleMute}
            className="p-3 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 rounded-xl transition"
            title="Toggle Lobby Music & SFX"
          >
            {isMuted ? <VolumeX className="text-rose-400 w-5 h-5" /> : <Volume2 className="text-emerald-400 w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <main id="lobby-layout" className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: CLASS LOADOUT SELECTION (8/12) */}
        <section id="lobby-left-panel" className="lg:col-span-8 space-y-8">
          
          {/* Soldier Name Customizer */}
          <div className="bg-slate-900/40 border border-slate-900 p-5 rounded-2xl flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold mb-1.5">
                Soldier Callsign (Name)
              </label>
              <input
                id="soldier-callsign-input"
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 18))}
                className="w-full bg-slate-950 border border-slate-800/80 focus:border-emerald-500/50 px-4 py-2.5 rounded-xl text-sm font-mono text-white focus:outline-none transition"
                placeholder="Recruit_Soldier"
              />
            </div>
            <div className="bg-slate-950 border border-slate-900 px-4 py-3 rounded-xl flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              <div className="flex flex-col">
                <span className="text-[9px] font-mono text-slate-500 font-bold">PRESTIGE Rank</span>
                <span className="text-xs font-mono font-bold text-slate-200">LVL 55 COMMISSAR</span>
              </div>
            </div>
          </div>

          {/* Class Selectors Grid */}
          <div className="space-y-4">
            <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest font-bold">
              1. Choose Character Class
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CLASSES.map((cls) => {
                const isSelected = cls.id === selectedClassId;
                return (
                  <div
                    key={cls.id}
                    onClick={() => handleSelectClass(cls.id)}
                    id={`class-card-${cls.id}`}
                    className={`p-5 rounded-2xl border cursor-pointer flex flex-col justify-between h-48 transition-all ${
                      isSelected
                        ? 'bg-slate-900 border-emerald-500/50 shadow-lg shadow-emerald-500/5'
                        : 'bg-slate-900/30 border-slate-900 hover:border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono font-extrabold uppercase px-2 py-0.5 rounded" style={{ backgroundColor: `${cls.color}30`, color: cls.accentColor }}>
                          {cls.codename}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 font-bold">CLASS SPEC</span>
                      </div>
                      <h4 className="text-md font-sans font-extrabold tracking-tight mt-2 text-white">
                        {cls.name}
                      </h4>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                        {cls.description}
                      </p>
                    </div>

                    <div className="border-t border-slate-800/50 pt-3 flex justify-between items-center text-xs font-mono">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-slate-500 uppercase">Primary</span>
                        <span className="font-bold text-slate-300">{cls.primaryWeapon.name}</span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[9px] text-slate-500 uppercase">Ability</span>
                        <span className="font-bold text-amber-400">{cls.ability.name}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Class Specification Overview */}
          <div id="class-detail-spec" className="bg-slate-900/20 border border-slate-900/80 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="space-y-4">
              <h5 className="text-xs font-mono text-slate-400 uppercase tracking-widest font-bold">
                Class Specifications
              </h5>

              <div className="space-y-3">
                {/* Health parameter */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono text-slate-400">
                    <span>VITALS INTEGRITY</span>
                    <strong className="text-emerald-400">{selectedClass.maxHealth} HP</strong>
                  </div>
                  <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full"
                      style={{ width: `${(selectedClass.maxHealth / 150) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Speed parameter */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono text-slate-400">
                    <span>AGILITY SPEED</span>
                    <strong className="text-amber-400">x{selectedClass.speed}</strong>
                  </div>
                  <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full"
                      style={{ width: `${(selectedClass.speed / 1.3) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-900/50 rounded-xl space-y-2">
              <h6 className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1.5">
                <Flame className="w-4 h-4" /> Tactical Ability: {selectedClass.ability.name}
              </h6>
              <p className="text-xs text-slate-300 leading-relaxed">
                {selectedClass.ability.description}
              </p>
              <div className="text-[10px] font-mono text-slate-500">
                Cooldown cycle: <strong className="text-slate-300">{selectedClass.ability.cooldown}s</strong>
              </div>
            </div>
          </div>

          {/* DYNAMIC GUN LOADOUTS CUSTOMIZER */}
          <div id="gun-loadout-customizer" className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 space-y-5">
            <div className="flex justify-between items-center border-b border-slate-800/60 pb-3">
              <h3 className="text-xs font-mono text-slate-300 uppercase tracking-widest font-extrabold flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-400" /> Armory Loadouts & Weapon Customizer
              </h3>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full font-bold">
                {Object.values(WEAPONS).length} WEAPONS AVAILABLE
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* PRIMARY WEAPON SELECTION */}
              <div className="space-y-3">
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold">
                  PRIMARY WEAPON SLOT
                </label>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {Object.values(WEAPONS).filter(w => ['AR', 'SNIPER', 'LMG', 'SMG', 'SHOTGUN'].includes(w.type)).map((w) => {
                    const isSelected = selectedPrimaryId === w.id;
                    return (
                      <div
                        key={w.id}
                        onClick={() => {
                          setSelectedPrimaryId(w.id);
                          sounds.playReload();
                        }}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-slate-950 border-emerald-500 text-white shadow-md'
                            : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: w.color }} />
                            <span className="text-xs font-mono font-bold text-white">{w.name}</span>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">{w.type}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 font-mono">
                            DMG: <strong className="text-emerald-400">{w.damage}</strong> | AMMO: <strong className="text-amber-400">{w.maxAmmo}</strong> | RANGE: <strong className="text-sky-400">{w.range}m</strong>
                          </p>
                        </div>
                        {isSelected && (
                          <span className="text-[10px] font-mono text-emerald-400 font-extrabold uppercase bg-emerald-500/20 px-2 py-0.5 rounded">EQUIPPED</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECONDARY WEAPON SELECTION */}
              <div className="space-y-3">
                <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold">
                  SECONDARY WEAPON SLOT
                </label>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {Object.values(WEAPONS).filter(w => ['PISTOL', 'KNIFE', 'LAUNCHER'].includes(w.type)).map((w) => {
                    const isSelected = selectedSecondaryId === w.id;
                    return (
                      <div
                        key={w.id}
                        onClick={() => {
                          setSelectedSecondaryId(w.id);
                          sounds.playReload();
                        }}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-slate-950 border-emerald-500 text-white shadow-md'
                            : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: w.color }} />
                            <span className="text-xs font-mono font-bold text-white">{w.name}</span>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">{w.type}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 font-mono">
                            DMG: <strong className="text-emerald-400">{w.damage}</strong> | AMMO: <strong className="text-amber-400">{w.maxAmmo}</strong> | RANGE: <strong className="text-sky-400">{w.range}m</strong>
                          </p>
                        </div>
                        {isSelected && (
                          <span className="text-[10px] font-mono text-emerald-400 font-extrabold uppercase bg-emerald-500/20 px-2 py-0.5 rounded">EQUIPPED</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <KeybindingsEditor
            bindings={bindings}
            onBindingsChange={onBindingsChange}
            className="mt-6"
          />

          {/* TOUCH SCREEN CONTROLS REBINDING PANEL */}
          <div id="touch-controls-config" className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 mt-6">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800/50">
              <h4 className="text-xs font-mono text-slate-300 uppercase tracking-wider font-extrabold flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" /> Touchscreen Rebinding & Controls
              </h4>
              <button
                onClick={() => onToggleTouchControls(!useTouchControls)}
                className={`text-[10px] font-mono px-3 py-1.5 rounded-lg border font-bold transition-all ${
                  useTouchControls
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {useTouchControls ? 'TOUCH OVERLAY: ON' : 'TOUCH OVERLAY: OFF'}
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Enable the touch screen overlay to show virtual joysticks and action buttons. Rebind each virtual button to trigger any keybinding action.
            </p>

            {useTouchControls && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                {[
                  { key: 'btnFire', label: 'Primary Shoot (Right Main Button)' },
                  { key: 'btnAim', label: 'Aim ADS (Right Secondary Button)' },
                  { key: 'btnJump', label: 'Jump/Leap (Lower Right Button)' },
                  { key: 'btnReload', label: 'Reload (Left Bottom Button)' },
                  { key: 'btnAbility', label: 'Special Ability (Top Mid Button)' },
                  { key: 'btnSwap', label: 'Swap Weapons (Upper Right Button)' }
                ].map(({ key, label }) => {
                  const currentValue = touchBindings[key as keyof TouchBindings];
                  return (
                    <div
                      key={key}
                      className="flex justify-between items-center p-2.5 rounded-xl bg-slate-950/65 border border-slate-800/40 hover:border-slate-800 transition"
                    >
                      <span className="text-xs text-slate-300 font-medium">{label}</span>
                      <select
                        value={currentValue}
                        onChange={(e) => {
                          const updated = { ...touchBindings, [key]: e.target.value as any };
                          onTouchBindingsChange(updated);
                        }}
                        className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-emerald-400 font-mono focus:outline-none"
                      >
                        <option value="fire">Fire / Shoot</option>
                        <option value="aim">Aim Down Sights</option>
                        <option value="jump">Jump / Leap</option>
                        <option value="reload">Reload</option>
                        <option value="ability">Class Ability</option>
                        <option value="swap">Swap Weapons</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </section>

        {/* RIGHT COLUMN: MATCH SETUP & BOT LOBBY (4/12) */}
        <section id="lobby-right-panel" className="lg:col-span-4 space-y-8">
          
          {/* Match Setup Parameters Card */}
          <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 space-y-6">
            <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest font-bold flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-emerald-400" /> 2. Set Combat Rules
            </h3>

            {/* LOBBY MODE TOGGLE */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => setLobbyMode('CREATE')}
                className={`py-3 rounded-xl font-bold font-mono text-xs transition ${
                  lobbyMode === 'CREATE'
                    ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                CREATE LOBBY
              </button>
              <button
                onClick={() => {
                  setLobbyMode('JOIN');
                  setIsMultiplayer(true);
                }}
                className={`py-3 rounded-xl font-bold font-mono text-xs transition ${
                  lobbyMode === 'JOIN'
                    ? 'bg-purple-500 text-slate-950 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                JOIN LOBBY
              </button>
            </div>

            {lobbyMode === 'JOIN' ? (
              <div className="space-y-4">
                <h4 className="text-xs font-mono font-bold text-purple-400 uppercase">Available Public Servers</h4>
                {availableRooms.length === 0 ? (
                  <p className="text-xs text-slate-500">No active servers found. Create one to invite friends!</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {availableRooms.map(r => (
                      <div key={r.code} className="flex justify-between items-center p-4 bg-slate-950/80 border border-purple-500/30 rounded-xl text-xs font-mono">
                        <div>
                          <div className="font-bold text-purple-300 text-sm mb-1">{r.name}</div>
                          <div className="text-[10px] text-slate-400">
                            Host: {r.hostId.slice(0, 5)} | Map: {r.mapId.toUpperCase()} | Kills: {r.scoreLimit} | Players: {r.playerCount}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setRoomCode(r.code);
                            setIsMultiplayer(true);
                            setCustomRoomInput(r.code);
                            sounds.playKill();
                            const primaryWep = Object.values(WEAPONS).find(w => w.id === selectedPrimaryId) || selectedClass.primaryWeapon;
                            const secondaryWep = Object.values(WEAPONS).find(w => w.id === selectedSecondaryId) || selectedClass.secondaryWeapon;
                            const customizedClass: CharacterClass = {
                              ...selectedClass,
                              primaryWeapon: primaryWep,
                              secondaryWeapon: secondaryWep
                            };
                            onStartGame(
                              {
                                mapId: (r.mapId as any) || selectedMapId,
                                timeLimit: r.timeLimit || timeLimit,
                                scoreLimit: r.scoreLimit || scoreLimit,
                                botCount,
                                difficulty,
                                isMultiplayer: true,
                                roomCode: r.code,
                              },
                              customizedClass,
                              playerName || 'Recruit_Soldier'
                            );
                          }}
                          className="bg-purple-500 hover:bg-purple-400 text-slate-950 px-4 py-2 rounded-lg font-bold transition shadow-md"
                        >
                          JOIN MATCH NOW
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="pt-4 border-t border-slate-800 space-y-2">
                  <span className="text-[10px] text-slate-500 font-mono">OR JOIN BY PRIVATE CODE:</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customRoomInput}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase().slice(0, 10);
                        setCustomRoomInput(val);
                        setRoomCode(val || 'MAIN');
                      }}
                      placeholder="ENTER ROOM CODE (e.g. ROOM-1234)"
                      className="flex-1 bg-slate-900 border border-slate-800 text-xs font-mono font-bold px-3 py-2 rounded-xl focus:outline-none focus:border-purple-500 uppercase text-purple-400"
                    />
                    <button
                      onClick={() => handleConnectPrivateRoom(customRoomInput)}
                      className="bg-purple-500 hover:bg-purple-400 text-slate-950 font-mono font-bold text-xs px-4 py-2 rounded-xl transition"
                    >
                      CONNECT & PLAY
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-3 p-3.5 bg-slate-950/80 border border-emerald-500/30 rounded-xl">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">
                      Multiplayer Lobby Server
                    </span>
                    <button
                      onClick={() => {
                        const newCode = `ROOM-${Math.floor(1000 + Math.random() * 9000)}`;
                        setCustomRoomInput(newCode);
                        setRoomCode(newCode);
                        setIsMultiplayer(true);
                      }}
                      className="text-[10px] font-mono text-emerald-400 hover:underline font-bold"
                    >
                      + Generate New Code
                    </button>
                  </div>

                  <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-2 rounded-xl mb-2">
                    <span className="text-[10px] font-mono font-bold text-slate-300 flex items-center gap-2">
                      <Globe className="w-3 h-3 text-emerald-400"/>
                      ONLINE MATCHMAKING
                    </span>
                    <button
                      onClick={() => setIsMultiplayer(!isMultiplayer)}
                      className={`w-10 h-5 rounded-full p-0.5 transition-all relative ${
                        isMultiplayer ? 'bg-emerald-500' : 'bg-slate-700'
                      }`}
                    >
                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all ${
                        isMultiplayer ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  {isMultiplayer ? (
                    <>
                      <div className="flex gap-2">
                        <input
                          id="lobby-room-code-input"
                          type="text"
                          value={customRoomInput}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase().slice(0, 10);
                            setCustomRoomInput(val);
                            setRoomCode(val || 'MAIN');
                            setIsMultiplayer(true);
                          }}
                          placeholder="Enter Custom Code (e.g. MAIN)"
                          className="flex-1 bg-slate-900 border border-slate-800 text-xs font-mono font-bold px-3 py-2 rounded-xl focus:outline-none focus:border-emerald-500 uppercase text-emerald-400"
                        />
                        <button
                          id="set-lobby-code-btn"
                          onClick={() => {
                            const target = (customRoomInput.trim() || roomCode || 'MAIN').toUpperCase();
                            setRoomCode(target);
                            setCustomRoomInput(target);
                            setIsMultiplayer(true);
                          }}
                          className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30 font-mono font-bold text-xs px-3 py-2 rounded-xl transition"
                        >
                          Set Code
                        </button>
                      </div>

                      <div className="text-[10px] font-mono text-slate-400 flex justify-between items-center mt-2">
                        <span>Host Code: <strong className="text-emerald-400">{roomCode}</strong></span>
                        <span className="text-emerald-400 font-bold">ONLINE</span>
                      </div>
                      <div className="mt-2 flex flex-col gap-2">
                        <button
                          onClick={() => {
                            if (roomCode === 'DEVDEVDEV9') {
                              setShowPinKeypad(true);
                              setEnteredPin('');
                              return;
                            }
                            const url = `${window.location.origin}?room=${roomCode}`;
                            navigator.clipboard.writeText(url);
                            setCopiedNotice(true);
                            setTimeout(() => setCopiedNotice(false), 3500);
                          }}
                          id="share-link-btn"
                          className="w-full bg-emerald-500/20 border border-emerald-500/50 hover:bg-emerald-500/30 text-xs font-mono font-bold px-3 py-2.5 rounded-xl transition text-emerald-400 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10"
                        >
                          <Globe className="w-4 h-4 text-emerald-400" />
                          COPY MULTIPLAYER SHARE LINK
                        </button>
                        {copiedNotice && (
                          <div className="p-2.5 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-[10px] font-mono text-emerald-300 animate-fade-in flex items-center gap-2">
                            <span>✅ Link copied! Send this link to your friends to play together in Room <strong>{roomCode}</strong>!</span>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-[10px] text-slate-500 text-center font-mono py-2 bg-slate-900/50 rounded-lg">
                      PLAYING OFFLINE VS BOTS
                    </div>
                  )}
                </div>

            {/* Map selection */}
            <div className="space-y-2">
              <label className="block text-[10px] font-mono text-slate-400 uppercase">
                Active Map Zone
              </label>
              <div className="grid grid-cols-3 gap-2">
                {MAPS.map((m) => (
                  <button
                    key={m.id}
                    id={`map-select-btn-${m.id}`}
                    onClick={() => {
                      setSelectedMapId(m.id as any);
                      syncRoomSettings({ mapId: m.id });
                      sounds.playShoot('KNIFE');
                    }}
                    className={`py-2 rounded-xl text-xs font-sans font-bold transition-all ${
                      selectedMapId === m.id
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {m.id.toUpperCase()}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed font-sans pt-1">
                {activeMap.description}
              </p>
            </div>

            {/* Bot Count Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono text-slate-400">
                <span>BOT ENEMIES</span>
                <strong className="text-emerald-400">
                  {botCount === 0 ? '0 (1v1 / Solo)' : `${botCount} Bots`}
                </strong>
              </div>
              <input
                id="bot-count-range"
                type="range"
                min="0"
                max="10"
                value={botCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setBotCount(val);
                  syncRoomSettings({ botCount: val });
                }}
                className="w-full accent-emerald-400 bg-slate-950 h-2 rounded"
              />
              <span className="block text-[9px] text-slate-500 font-mono text-center">
                {botCount === 0
                  ? '1v1 Match Mode / Solo Exploration (No AI Bots)'
                  : `Free-for-all contains (You + ${botCount} Active Bots)`}
              </span>
            </div>

            {/* Difficulty Level */}
            <div className="space-y-2">
              <label className="block text-[10px] font-mono text-slate-400 uppercase">
                Bot Difficulty
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['EASY', 'MEDIUM', 'HARD'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    id={`diff-btn-${lvl}`}
                    onClick={() => {
                      setDifficulty(lvl);
                      syncRoomSettings({ difficulty: lvl });
                      sounds.playShoot('KNIFE');
                    }}
                    className={`py-2 rounded-xl text-xs font-sans font-bold transition-all ${
                      difficulty === lvl
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Score & Time Limit settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[9px] font-mono text-slate-500 uppercase font-bold">
                  Score Limit
                </label>
                <select
                  id="score-limit-select"
                  value={scoreLimit}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setScoreLimit(val);
                    syncRoomSettings({ scoreLimit: val });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
                >
                  <option value={10}>10 Kills</option>
                  <option value={20}>20 Kills</option>
                  <option value={30}>30 Kills</option>
                  <option value={50}>50 Kills</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[9px] font-mono text-slate-500 uppercase font-bold">
                  Time Limit
                </label>
                <select
                  id="time-limit-select"
                  value={timeLimit}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setTimeLimit(val);
                    syncRoomSettings({ timeLimit: val });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
                >
                  <option value={120}>2 Minutes</option>
                  <option value={180}>3 Minutes</option>
                  <option value={300}>5 Minutes</option>
                  <option value={600}>10 Minutes</option>
                </select>
              </div>
            </div>

            {/* Camera Sensitivity & Aim Assist Controls */}
            <div className="space-y-3 p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl">
              <span className="block text-[10px] font-mono text-emerald-400 uppercase font-bold tracking-wider">
                Tactical Camera & Aim Controls
              </span>

              {/* General Sensitivity Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>Camera Sensitivity</span>
                  <strong className="text-emerald-400">{cameraSens.toFixed(1)}x</strong>
                </div>
                <input
                  id="camera-sens-range"
                  type="range"
                  min="0.2"
                  max="3.0"
                  step="0.1"
                  value={cameraSens}
                  onChange={(e) => setCameraSens(parseFloat(e.target.value))}
                  className="w-full accent-emerald-400 bg-slate-900 h-1.5 rounded"
                />
              </div>

              {/* ADS Zoom Sensitivity Multiplier */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>ADS Zoom Speed (Default Slower)</span>
                  <strong className="text-emerald-400">{adsSens.toFixed(1)}x</strong>
                </div>
                <input
                  id="ads-sens-range"
                  type="range"
                  min="0.1"
                  max="1.5"
                  step="0.05"
                  value={adsSens}
                  onChange={(e) => setAdsSens(parseFloat(e.target.value))}
                  className="w-full accent-emerald-400 bg-slate-900 h-1.5 rounded"
                />
              </div>

              {/* Aim Assist Toggle */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-mono text-slate-400 uppercase">
                  Target Aim Assist
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['OFF', 'LIGHT', 'HEAVY'] as const).map((mode) => (
                    <button
                      key={mode}
                      id={`aim-assist-btn-${mode}`}
                      type="button"
                      onClick={() => setAimAssist(mode)}
                      className={`py-1.5 rounded-lg text-[10px] font-mono font-bold transition-all ${
                        aimAssist === mode
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* START COMBAT TRIGGER BUTTON */}
            <button
              id="start-match-button"
              onClick={handleStart}
              className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-sans font-bold tracking-wide rounded-2xl shadow-xl shadow-emerald-500/10 flex items-center justify-center gap-2 transform active:scale-[0.98] transition-all"
            >
              <Play className="w-5 h-5 fill-white" /> START COMBAT MATCH
            </button>
            </div>
            )}
          </div>

          {/* Lobby active player list */}
          <div className="bg-slate-900/30 border border-slate-900 rounded-2xl p-6 space-y-4">
            <h4 className="text-xs font-mono text-slate-400 uppercase tracking-widest font-bold flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-400" /> Lobby Roster ({lobbyPlayers.length})
            </h4>

            <div id="lobby-roster-list" className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {lobbyPlayers.map((p) => (
                <div
                  key={p.id}
                  className={`flex justify-between items-center px-3 py-2 rounded-xl text-xs font-mono ${
                    !p.isBot ? 'bg-emerald-500/10 border border-emerald-500/25' : 'bg-slate-950/50'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-[10px] text-slate-500 font-bold">L.{p.rank}</span>
                    <span className="font-sans font-bold truncate max-w-[130px]">{p.name}</span>
                    {!p.isBot && <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 rounded font-bold">YOU</span>}
                  </div>
                  <div className="flex items-center gap-3 text-slate-400 text-[10px]">
                    <span className="uppercase text-[9px]" style={{ color: CLASSES.find(c => c.id === p.classId)?.accentColor }}>
                      {CLASSES.find(c => c.id === p.classId)?.codename}
                    </span>
                    <span className={p.ping === 0 ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                      {p.ping === 0 ? 'LOCAL' : `${p.ping}ms`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </section>

      </main>

      {/* SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setShowSettingsModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl font-bold"
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Settings className="w-5 h-5 text-emerald-400"/> Settings & Tactical Controls</h2>
            
            {/* Tabs */}
            <div className="grid grid-cols-2 gap-2 mb-6">
              <button
                onClick={() => setSettingsTab('GRAPHICS')}
                className={`py-2.5 rounded-xl text-xs font-mono font-bold transition ${
                  settingsTab === 'GRAPHICS'
                    ? 'bg-emerald-500 text-slate-950 shadow-lg'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Graphics Quality
              </button>
              <button
                onClick={() => setSettingsTab('TACTICAL')}
                className={`py-2.5 rounded-xl text-xs font-mono font-bold transition ${
                  settingsTab === 'TACTICAL'
                    ? 'bg-emerald-500 text-slate-950 shadow-lg'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Tactical & Aim (User)
              </button>
            </div>

            {settingsTab === 'GRAPHICS' ? (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as any[]).map(q => {
                  let label: string = q;
                  if (q === '1') label = 'ROBLOX (1) - 10x WORSE';
                  if (q === '2') label = 'POTATO (2)';
                  if (q === '3') label = 'VERY LOW (3)';
                  if (q === '4') label = 'LOW (4)';
                  if (q === '5') label = 'MEDIUM (5)';
                  if (q === '6') label = 'HIGH (6)';
                  if (q === '7') label = 'VERY HIGH (7)';
                  if (q === '8') label = 'ULTRA (8)';
                  if (q === '9') label = 'EXTREME (9)';
                  if (q === '10') label = 'CINEMATIC (10) - 10x BETTER';
                  
                  return (
                    <button
                      key={q}
                      onClick={() => onGraphicsQualityChange({ ...graphicsQuality, level: q })}
                      className={`w-full p-3 rounded-xl text-left transition font-mono text-xs border ${
                        graphicsQuality.level === q 
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}

                <div className="border-t border-slate-800 pt-3 space-y-3">
                  <h4 className="text-xs font-mono font-bold text-emerald-400">ADVANCED PERFORMANCE TWEAKS</h4>
                  
                  <div className="flex justify-between items-center p-3 bg-slate-950 border border-slate-800 rounded-xl">
                    <span className="text-xs font-mono text-slate-300">Enable Dynamic Shadows</span>
                    <button onClick={() => onGraphicsQualityChange({ ...graphicsQuality, shadows: !graphicsQuality.shadows })} className={`px-3 py-1 rounded text-[10px] font-bold ${graphicsQuality.shadows ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                      {graphicsQuality.shadows ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-slate-950 border border-slate-800 rounded-xl">
                    <span className="text-xs font-mono text-slate-300">Anti-Aliasing (Smooth Edges)</span>
                    <button onClick={() => onGraphicsQualityChange({ ...graphicsQuality, antiAliasing: !graphicsQuality.antiAliasing })} className={`px-3 py-1 rounded text-[10px] font-bold ${graphicsQuality.antiAliasing ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                      {graphicsQuality.antiAliasing ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-slate-950 border border-slate-800 rounded-xl">
                    <span className="text-xs font-mono text-slate-300">Particle Effects (Smoke/Sparks)</span>
                    <button onClick={() => onGraphicsQualityChange({ ...graphicsQuality, particles: !graphicsQuality.particles })} className={`px-3 py-1 rounded text-[10px] font-bold ${graphicsQuality.particles ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                      {graphicsQuality.particles ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex justify-between text-xs font-mono text-slate-300">
                      <span>Resolution Scale</span>
                      <strong className="text-emerald-400">{Math.round(graphicsQuality.resolutionScale * 100)}%</strong>
                    </div>
                    <input
                      type="range"
                      min="0.25"
                      max="1.5"
                      step="0.05"
                      value={graphicsQuality.resolutionScale}
                      onChange={(e) => onGraphicsQualityChange({ ...graphicsQuality, resolutionScale: parseFloat(e.target.value) })}
                      className="w-full accent-emerald-400 bg-slate-900 h-1.5 rounded"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                {/* Camera Sensitivity */}
                <div className="space-y-1 bg-slate-950 p-3.5 border border-slate-800 rounded-xl">
                  <div className="flex justify-between text-xs font-mono text-slate-300">
                    <span>Camera Sensitivity</span>
                    <strong className="text-emerald-400">{cameraSens.toFixed(1)}x</strong>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="3.0"
                    step="0.1"
                    value={cameraSens}
                    onChange={(e) => setCameraSens(parseFloat(e.target.value))}
                    className="w-full accent-emerald-400 bg-slate-900 h-1.5 rounded"
                  />
                </div>

                {/* ADS Speed */}
                <div className="space-y-1 bg-slate-950 p-3.5 border border-slate-800 rounded-xl">
                  <div className="flex justify-between text-xs font-mono text-slate-300">
                    <span>ADS Zoom Speed</span>
                    <strong className="text-emerald-400">{adsSens.toFixed(1)}x</strong>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.5"
                    step="0.05"
                    value={adsSens}
                    onChange={(e) => setAdsSens(parseFloat(e.target.value))}
                    className="w-full accent-emerald-400 bg-slate-900 h-1.5 rounded"
                  />
                </div>

                {/* Aim Assist */}
                <div className="space-y-2 bg-slate-950 p-3.5 border border-slate-800 rounded-xl">
                  <label className="block text-xs font-mono text-slate-300 uppercase">
                    Target Aim Assist
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['OFF', 'LIGHT', 'HEAVY'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setAimAssist(mode)}
                        className={`py-2 rounded-lg text-xs font-mono font-bold transition-all ${
                          aimAssist === mode
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            <p className="mt-6 text-xs text-slate-500 text-center">
              Changes apply immediately and persist across sessions.
            </p>
          </div>
        </div>
      )}
      {showProfileModal && user && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfileModal(false)}
          onLogout={() => window.location.reload()}
        />
      )}
      {showAdminPanel && (
        <AdminPanelModal
          currentUser={user}
          onClose={() => setShowAdminPanel(false)}
          onSpectateMatch={(roomCode) => {
            setShowAdminPanel(false);
            setRoomCode(roomCode);
            setIsMultiplayer(true);
            onStartGame(
              {
                mapId: selectedMapId,
                timeLimit: timeLimit,
                scoreLimit: scoreLimit,
                botCount: botCount,
                difficulty: difficulty,
                isMultiplayer: true,
                roomCode: roomCode,
                spectatorMode: true
              },
              CLASSES[0],
              'ADMIN_SPECTATOR'
            );
          }}
        />
      )}

      {showPinKeypad && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-2xl w-full max-w-sm p-6 shadow-2xl shadow-emerald-500/20 text-center space-y-6">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40 text-emerald-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-mono text-white">SECURITY AUTHORIZATION</h3>
              <p className="text-xs text-slate-400 mt-1 font-mono">Enter 4-digit PIN to access Administrator Terminal</p>
            </div>

            {/* Pin dots */}
            <div className="flex justify-center gap-3 my-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-10 h-12 rounded-xl border flex items-center justify-center text-xl font-mono font-bold transition-all ${
                    i < enteredPin.length
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/20'
                      : 'bg-slate-950 border-slate-800 text-slate-600'
                  }`}
                >
                  {i < enteredPin.length ? '•' : ''}
                </div>
              ))}
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '✓'].map((key) => {
                const processPinAttempt = async (pinToTest: string) => {
                  if (pinToTest === '0419') {
                    let allowed = false;
                    if (user) {
                      if (user.isRootAdmin || user.isSuperAdmin || user.isPinAllowed) {
                        allowed = true;
                      } else {
                        try {
                          const userDocRef = doc(db, 'users', user.uid || user.id);
                          const snap = await getDoc(userDocRef);
                          if (snap.exists()) {
                            const data = snap.data();
                            if (data.isRootAdmin || data.isSuperAdmin || data.isPinAllowed) {
                              allowed = true;
                            }
                          }
                        } catch (err) {
                          console.warn('PIN permission query error:', err);
                        }
                      }
                    }

                    setShowPinKeypad(false);
                    setEnteredPin('');

                    if (allowed) {
                      setShowAdminPanel(true);
                    } else {
                      alert(`ACCESS DENIED: Account '${user?.username || 'Guest'}' has not been granted 0419 PIN authorization by the Root Master Admin.`);
                    }
                  } else {
                    setShowPinKeypad(false);
                    setEnteredPin('');
                    try {
                      await auth.signOut();
                    } catch (e) {}
                    if (onLogout) onLogout();
                    alert('Incorrect Security PIN. Account signed out for security.');
                  }
                };

                return (
                  <button
                    key={key}
                    onClick={async () => {
                      if (key === 'C') {
                        setEnteredPin('');
                      } else if (key === '✓') {
                        await processPinAttempt(enteredPin);
                      } else {
                        if (enteredPin.length < 4) {
                          const nextPin = enteredPin + key;
                          setEnteredPin(nextPin);
                          if (nextPin.length === 4) {
                            setTimeout(async () => {
                              await processPinAttempt(nextPin);
                            }, 300);
                          }
                        }
                      }
                    }}
                    className="h-12 bg-slate-950 border border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-white font-mono font-bold rounded-xl transition flex items-center justify-center text-lg active:scale-95"
                  >
                    {key}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => {
                setShowPinKeypad(false);
                setEnteredPin('');
              }}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono font-bold transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default Lobby;
