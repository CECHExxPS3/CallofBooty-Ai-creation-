import React, { useState, useEffect, useRef } from 'react';
import { GameState, CharacterClass, MatchConfig, MatchStats, KillFeedEntry, KeyBindings, DEFAULT_KEYBINDINGS, TouchBindings, DEFAULT_TOUCHBINDINGS, Weapon, GraphicsQuality } from './types';
import { Lobby } from './components/Lobby';
import { GameCanvas } from './components/GameCanvas';
import { GameHUD } from './components/GameHUD';
import { ScoreboardScreen } from './components/ScoreboardScreen';
import { WelcomeScreen } from './components/WelcomeScreen';
import { db } from './lib/firebase';
import { doc, updateDoc, collection, addDoc, setDoc, getDoc } from 'firebase/firestore';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [gameState, setGameState] = useState<GameState>('WELCOME');
  
  // Custom Keybindings
  const [bindings, setBindings] = useState<KeyBindings>(() => {
    const saved = localStorage.getItem('combat_keybindings');
    if (saved) {
      try {
        return { ...DEFAULT_KEYBINDINGS, ...JSON.parse(saved) };
      } catch (e) {
        // ignore
      }
    }
    return DEFAULT_KEYBINDINGS;
  });

  const handleUpdateBindings = (newBindings: KeyBindings) => {
    setBindings(newBindings);
    localStorage.setItem('combat_keybindings', JSON.stringify(newBindings));
  };

  // Custom Touch Bindings
  const [touchBindings, setTouchBindings] = useState<TouchBindings>(() => {
    const saved = localStorage.getItem('combat_touchbindings');
    if (saved) {
      try {
        return { ...DEFAULT_TOUCHBINDINGS, ...JSON.parse(saved) };
      } catch (e) {
        // ignore
      }
    }
    return DEFAULT_TOUCHBINDINGS;
  });

  const handleUpdateTouchBindings = (newTouchBindings: TouchBindings) => {
    setTouchBindings(newTouchBindings);
    localStorage.setItem('combat_touchbindings', JSON.stringify(newTouchBindings));
  };

  const [useTouchControls, setUseTouchControls] = useState<boolean>(() => {
    const saved = localStorage.getItem('combat_use_touch');
    return saved === 'true';
  });

  const handleToggleTouchControls = (enabled: boolean) => {
    setUseTouchControls(enabled);
    localStorage.setItem('combat_use_touch', enabled ? 'true' : 'false');
  };

  // Dedicated low-latency touch input reference to bypass React render cycle latency
  const touchInputsRef = useRef<Record<string, any>>({
    moveX: 0,
    moveY: 0,
    lookDeltaX: 0,
    lookDeltaY: 0,
    keys: {}
  });

  // Game Configuration & Customization
  const [playerName, setPlayerName] = useState('Recruit_Soldier');
  const [playerClass, setPlayerClass] = useState<CharacterClass | null>(null);
  const [matchConfig, setMatchConfig] = useState<MatchConfig | null>(null);
  
  // Dynamic Real-Time HUD States
  const [playerHealth, setPlayerHealth] = useState(100);
  const [playerMaxHealth, setPlayerMaxHealth] = useState(100);
  const [playerClip, setPlayerClip] = useState(30);
  const [playerReserve, setPlayerReserve] = useState(90);
  const [activeWeapon, setActiveWeapon] = useState<Weapon | null>(null);
  const [matchTimeLeft, setMatchTimeLeft] = useState(300);
  const [abilityCooldownLeft, setAbilityCooldownLeft] = useState(0);

  // Scoreboard list & Rolling Kill feed
  const [stats, setStats] = useState<MatchStats[]>([]);
  const [killFeed, setKillFeed] = useState<KillFeedEntry[]>([]);
  const [xpEvents, setXpEvents] = useState<any[]>([]);
  
  // Settings
  const [isMuted, setIsMuted] = useState(false);
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>({ level: '5', shadows: true, particles: true, antiAliasing: true, resolutionScale: 1.0, postProcessing: false });
  const [hitmarker, setHitmarker] = useState<'body' | 'head' | null>(null);
  const hitmarkerTimerRef = useRef<any>(null);

  const handleHitmarker = (type: 'body' | 'head') => {
    if (hitmarkerTimerRef.current) clearTimeout(hitmarkerTimerRef.current);
    setHitmarker(type);
    hitmarkerTimerRef.current = setTimeout(() => {
      setHitmarker(null);
    }, type === 'head' ? 300 : 180);
  };

  // Handle visual Ability Cooldown tick decrementing in UI
  useEffect(() => {
    if (abilityCooldownLeft <= 0) return;
    
    const interval = setInterval(() => {
      setAbilityCooldownLeft((prev) => {
        if (prev <= 0.1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 0.1;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [abilityCooldownLeft]);

  const handleStartGame = (config: MatchConfig, selectedClass: CharacterClass, name: string) => {
    if (user?.isFrozen) {
      alert("Your account is currently frozen. You cannot participate in matches.");
      return;
    }
    setMatchConfig(config);
    setPlayerClass(selectedClass);
    // Use the logged-in user's name if available
    setPlayerName(user?.username || name);

    // Initial resets
    setPlayerHealth(selectedClass.maxHealth);
    setPlayerMaxHealth(selectedClass.maxHealth);
    setPlayerClip(selectedClass.primaryWeapon.maxAmmo);
    setPlayerReserve(selectedClass.primaryWeapon.maxAmmo * 3);
    setMatchTimeLeft(config.timeLimit);
    setAbilityCooldownLeft(0);
    setKillFeed([]);
    
    // Clear old touch inputs
    touchInputsRef.current = {
      moveX: 0,
      moveY: 0,
      lookDeltaX: 0,
      lookDeltaY: 0,
      keys: {}
    };

    setGameState('PLAYING');
  };

  const handleStatsUpdate = (updatedStats: MatchStats[]) => {
    setStats(updatedStats);
  };

  const handleKillFeedUpdate = (entry: KillFeedEntry) => {
    setKillFeed((prev) => [...prev, entry]);
  };

  const handleXpEvent = (amount: number, reason: string) => {
    const event = { id: Math.random().toString(), amount, reason };
    setXpEvents(prev => [...prev, event]);
    
    // Auto remove after 2.5s
    setTimeout(() => {
      setXpEvents(prev => prev.filter(e => e.id !== event.id));
    }, 2500);
  };

  const handlePlayerHealthUpdate = (health: number, maxHealth: number) => {
    setPlayerHealth(health);
    setPlayerMaxHealth(maxHealth);
  };

  const handlePlayerAmmoUpdate = (clip: number, reserve: number) => {
    setPlayerClip(clip);
    setPlayerReserve(reserve);
  };

  const handleMatchTimerUpdate = (timeLeft: number) => {
    setMatchTimeLeft(timeLeft);
  };

  const handleAbilityCooldownUpdate = (cooldown: number) => {
    setAbilityCooldownLeft(cooldown);
  };

  const handleMatchEnd = async (finalStats: MatchStats[]) => {
    setStats(finalStats);
    setGameState('POST_MATCH');
    
    if (user && !user.isGuest) {
      try {
        const playerStats = finalStats.find(s => s.id === 'player');
        if (!playerStats) return;

        // Collect accumulated XP
        // Calculate new totals
        const currentKills = user.kills || 0;
        const currentDeaths = user.deaths || 0;
        const currentHeadshots = user.headshots || 0;
        const currentPlayTime = user.totalPlayTime || user.timePlayed || 0;
        const currentWins = user.wins || 0;
        const currentLosses = user.losses || 0;
        const currentMatches = user.matchesPlayed || 0;
        const currentXp = user.xp || 0;

        const isWin = finalStats[0].id === 'player'; // if player is 1st
        
        let newXp = currentXp + (playerStats.score || 0);
        // Bonus for winning
        if (isWin) newXp += 500;

        // Level formula: level 1 is 0 XP, level 2 is 1000, level 3 is 3000...
        // simple formula: Math.floor(Math.sqrt(newXp / 500)) + 1
        const newLevel = Math.floor(Math.sqrt(newXp / 500)) + 1;

        const updateData = {
          kills: currentKills + playerStats.kills,
          deaths: currentDeaths + playerStats.deaths,
          headshots: currentHeadshots + ((playerStats as any).headshots || 0),
          totalPlayTime: currentPlayTime + ((playerStats as any).timePlayedSeconds || 0),
          timePlayed: currentPlayTime + ((playerStats as any).timePlayedSeconds || 0),
          wins: currentWins + (isWin ? 1 : 0),
          losses: currentLosses + (!isWin ? 1 : 0),
          matchesPlayed: currentMatches + 1,
          xp: newXp,
          level: newLevel,
          updatedAt: new Date().toISOString()
        };

        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, updateData);
        
        // Save Match History
        try {
          await addDoc(collection(db, 'match_history'), {
            userId: user.uid,
            mapId: matchConfig?.mapId || 'TUTORIAL_01',
            isWin,
            kills: playerStats.kills,
            deaths: playerStats.deaths,
            score: playerStats.score,
            timestamp: new Date().toISOString()
          });
        } catch (historyErr) {
          console.error("Failed to save match history", historyErr);
        }

        // Save Weapon Stats
        if (playerStats.weaponKills && Object.keys(playerStats.weaponKills).length > 0) {
          try {
            const weaponStatsRef = doc(db, 'weapon_stats', user.uid);
            const weaponSnap = await getDoc(weaponStatsRef);
            let currentWeapons: Record<string, any> = {};
            if (weaponSnap.exists()) {
              currentWeapons = weaponSnap.data() || {};
            }
            
            for (const [wepId, wKills] of Object.entries(playerStats.weaponKills)) {
              if (!currentWeapons[wepId]) {
                currentWeapons[wepId] = { kills: 0 };
              }
              currentWeapons[wepId].kills += (wKills as number);
            }
            
            await setDoc(weaponStatsRef, currentWeapons, { merge: true });
          } catch (wepErr) {
            console.error("Failed to update weapon stats", wepErr);
          }
        }
        
        // Update local user state
        setUser({ ...user, ...updateData });
      } catch (err) {
        console.error('Failed to update stats:', err);
      }
    }
  };

  const handleQuitGame = () => {
    setGameState('LOBBY');
  };

  const handleToggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleLoginComplete = (userData: any) => {
    setUser(userData);
    setGameState('LOBBY');
  };

  return (
    <div className="w-screen h-screen bg-slate-950 text-white overflow-hidden relative">
      {gameState === 'WELCOME' && (
        <WelcomeScreen onLoginComplete={handleLoginComplete} />
      )}

      {gameState === 'LOBBY' && (
        <Lobby
          graphicsQuality={graphicsQuality}
          onGraphicsQualityChange={setGraphicsQuality}
          onStartGame={handleStartGame}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          bindings={bindings}
          onBindingsChange={handleUpdateBindings}
          touchBindings={touchBindings}
          onTouchBindingsChange={handleUpdateTouchBindings}
          useTouchControls={useTouchControls}
          onToggleTouchControls={handleToggleTouchControls}
          user={user}
          onLogout={() => {
            setUser(null);
            setGameState('WELCOME');
          }}
        />
      )}

      {gameState === 'PLAYING' && playerClass && matchConfig && (
        <div className="w-full h-full relative">
          <GameCanvas
            graphicsQuality={graphicsQuality}
            config={matchConfig}
            playerClass={playerClass}
            playerName={playerName}
            onStatsUpdate={handleStatsUpdate}
            onKillFeedUpdate={handleKillFeedUpdate}
            onPlayerHealthUpdate={handlePlayerHealthUpdate}
            onPlayerAmmoUpdate={handlePlayerAmmoUpdate}
            onMatchTimerUpdate={handleMatchTimerUpdate}
            onAbilityCooldownUpdate={handleAbilityCooldownUpdate}
            onWeaponChange={setActiveWeapon}
            onMatchEnd={handleMatchEnd}
            onHitmarker={handleHitmarker}
            onXpEvent={handleXpEvent}
            isMuted={isMuted}
            bindings={bindings}
            touchInputsRef={touchInputsRef}
            useTouchControls={useTouchControls}
          />
          {!matchConfig?.spectatorMode && <GameHUD
            graphicsQuality={graphicsQuality}
            onGraphicsChange={setGraphicsQuality}
            stats={stats}
            killFeed={killFeed}
            xpEvents={xpEvents}
            playerHealth={playerHealth}
            playerMaxHealth={playerMaxHealth}
            playerClip={playerClip}
            playerReserve={playerReserve}
            activeWeapon={activeWeapon || playerClass.primaryWeapon}
            playerClass={playerClass}
            matchTimeLeft={matchTimeLeft}
            scoreLimit={matchConfig.scoreLimit}
            abilityCooldownLeft={abilityCooldownLeft}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            onQuit={handleQuitGame}
            bindings={bindings}
            onBindingsChange={handleUpdateBindings}
            touchBindings={touchBindings}
            onTouchBindingsChange={handleUpdateTouchBindings}
            useTouchControls={useTouchControls}
            onToggleTouchControls={handleToggleTouchControls}
            touchInputsRef={touchInputsRef}
          />}
          {matchConfig?.spectatorMode && (
            <div className="absolute top-4 right-4 bg-slate-900/80 border border-red-500/50 p-4 rounded-xl text-white font-mono pointer-events-none z-40">
              <h2 className="text-red-400 font-bold mb-2 uppercase tracking-widest text-sm flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> ADMIN SPECTATOR</h2>
              <div className="text-xs text-slate-300 space-y-1">
                <p><span className="font-bold text-emerald-400">WASD</span> to Fly</p>
                <p><span className="font-bold text-emerald-400">SPACE</span> to Ascend</p>
                <p><span className="font-bold text-emerald-400">SHIFT</span> for Speed</p>
                {localStorage.getItem('cmd_perm_8') === 'true' && <p><span className="font-bold text-red-400">KEY 8</span> for Dev Cheats</p>}
              </div>
              <button onClick={handleQuitGame} className="mt-4 pointer-events-auto text-[10px] bg-red-500/20 hover:bg-red-500/40 text-red-300 px-3 py-1.5 rounded border border-red-500/30 transition w-full">EXIT SPECTATOR</button>
            </div>
          )}
        </div>
      )}

      {gameState === 'POST_MATCH' && (
        <ScoreboardScreen
          stats={stats}
          playerName={playerName}
          onRestart={() => setGameState('LOBBY')}
        />
      )}
    </div>
  );
}
