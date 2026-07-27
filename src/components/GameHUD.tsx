import React, { useState, useRef, useEffect } from 'react';
import { MatchStats, KillFeedEntry, CharacterClass, Weapon, KeyBindings, TouchBindings, GraphicsQuality } from '../types';
import { Target, Shield, Heart, Flame, Volume2, VolumeX, Eye, Zap, Crosshair, Keyboard, X, Smartphone, Settings } from 'lucide-react';
import { KeybindingsEditor } from './KeybindingsEditor';

interface GameHUDProps {
  graphicsQuality: GraphicsQuality;
  onGraphicsChange: (q: GraphicsQuality) => void;
  stats: MatchStats[];
  killFeed: KillFeedEntry[];
  xpEvents?: any[];
  playerHealth: number;
  playerMaxHealth: number;
  playerClip: number;
  playerReserve: number;
  activeWeapon: Weapon;
  playerClass: CharacterClass;
  matchTimeLeft: number;
  scoreLimit: number;
  abilityCooldownLeft: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onQuit: () => void;
  bindings: KeyBindings;
  onBindingsChange: (bindings: KeyBindings) => void;
  touchBindings: TouchBindings;
  onTouchBindingsChange: (bindings: TouchBindings) => void;
  useTouchControls: boolean;
  onToggleTouchControls: (enabled: boolean) => void;
  touchInputsRef: React.MutableRefObject<Record<string, any>>;
  hitmarker?: 'body' | 'head' | null;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  stats,
  killFeed,
  xpEvents = [],
  playerHealth,
  playerMaxHealth,
  playerClip,
  playerReserve,
  activeWeapon,
  playerClass,
  matchTimeLeft,
  scoreLimit,
  graphicsQuality,
  onGraphicsChange,
  abilityCooldownLeft,
  isMuted,
  onToggleMute,
  onQuit,
  bindings,
  onBindingsChange,
  touchBindings,
  onTouchBindingsChange,
  useTouchControls,
  onToggleTouchControls,
  touchInputsRef,
  hitmarker
}) => {
  const [showControls, setShowControls] = useState(false);
  const [bindTab, setBindTab] = useState<'keyboard' | 'touch'>('keyboard');

  // Joystick visual state
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const joystickStartRef = useRef({ x: 0, y: 0 });

  // Look trackpad state
  const lastTouchRef = useRef<{ id: number; x: number; y: number } | null>(null);

  // Joystick handlers
  const handleJoystickStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    const touch = e.targetTouches[0];
    joystickStartRef.current = { x: touch.clientX, y: touch.clientY };
    setJoystickActive(true);
  };

  const handleJoystickMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!joystickActive) return;
    e.preventDefault();
    const touch = e.targetTouches[0];
    const dx = touch.clientX - joystickStartRef.current.x;
    const dy = touch.clientY - joystickStartRef.current.y;
    
    const maxDist = 50; // max displacement in pixels
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    let moveX = dx;
    let moveY = dy;
    
    if (dist > maxDist) {
      moveX = (dx / dist) * maxDist;
      moveY = (dy / dist) * maxDist;
    }
    
    setJoystickPos({ x: moveX, y: moveY });
    
    // Set low-latency inputs (moveY multiplied by -1 because pushing forward is w which moves player Z negatively)
    touchInputsRef.current.moveX = moveX / maxDist;
    touchInputsRef.current.moveY = -(moveY / maxDist);
  };

  const handleJoystickEnd = () => {
    setJoystickActive(false);
    setJoystickPos({ x: 0, y: 0 });
    touchInputsRef.current.moveX = 0;
    touchInputsRef.current.moveY = 0;
  };

  // Touchpad look handlers (covers right side window tracking)
  const handleLookStart = (e: React.TouchEvent<HTMLDivElement>) => {
    // Look on the right side of the screen
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.clientX > window.innerWidth / 2) {
        lastTouchRef.current = {
          id: touch.identifier,
          x: touch.clientX,
          y: touch.clientY
        };
        break;
      }
    }
  };

  const handleLookMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!lastTouchRef.current) return;
    
    // Find our tracking touch
    for (let i = 0; i < e.targetTouches.length; i++) {
      const touch = e.targetTouches[i];
      if (touch.identifier === lastTouchRef.current.id) {
        const dx = touch.clientX - lastTouchRef.current.x;
        const dy = touch.clientY - lastTouchRef.current.y;
        
        // sensitivity multiplier
        const sensitivity = 0.45;
        touchInputsRef.current.lookDeltaX = dx * sensitivity;
        touchInputsRef.current.lookDeltaY = dy * sensitivity;
        
        lastTouchRef.current.x = touch.clientX;
        lastTouchRef.current.y = touch.clientY;
        break;
      }
    }
  };

  const handleLookEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!lastTouchRef.current) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === lastTouchRef.current.id) {
        lastTouchRef.current = null;
        touchInputsRef.current.lookDeltaX = 0;
        touchInputsRef.current.lookDeltaY = 0;
        break;
      }
    }
  };

  // Helper button press mapping callback
  const handleButtonPress = (btnKey: keyof TouchBindings, isPressed: boolean) => {
    const action = touchBindings[btnKey];
    if (action) {
      const keyChar = bindings[action];
      if (keyChar) {
        touchInputsRef.current.keys[keyChar] = isPressed;
      }
    }
  };

  const handleButtonEvent = (e: React.PointerEvent | React.TouchEvent | React.MouseEvent, btnKey: keyof TouchBindings, isPressed: boolean) => {
    if (e.cancelable) e.preventDefault();
    handleButtonPress(btnKey, isPressed);
  };

  // Format seconds to MM:SS
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Find player stats rank
  const playerStatsIndex = stats.findIndex(s => s.id === 'player');
  const playerRank = playerStatsIndex !== -1 ? playerStatsIndex + 1 : 1;
  const topStats = stats.slice(0, 4);

  // Health and shield visual parameters
  const healthPercent = (playerHealth / playerMaxHealth) * 100;
  const isLowHealth = healthPercent < 35;

  return (
    <div id="combat-hud-root" className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 select-none z-10 font-sans text-white">
      
      {/* XP Popups Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-32">
        <div className="space-y-1 text-center">
          {xpEvents.map((event) => (
            <div 
              key={event.id}
              className="animate-slide-up-fade text-amber-400 font-black italic tracking-wider text-xl drop-shadow-[0_0_8px_rgba(251,191,36,0.8)] flex items-center justify-center gap-2"
            >
              <span>{event.reason}</span>
              <span className="text-white">+{event.amount} XP</span>
            </div>
          ))}
        </div>
      </div>

      {/* ================= HEADER OVERLAY (Score, timer, leaderboard) ================= */}
      <div id="hud-header" className="flex justify-between items-start w-full">
        
        {/* Match Timer & Mode */}
        <div id="match-meta" className="bg-slate-900/85 backdrop-blur-md border border-slate-700/30 px-5 py-3 rounded-xl flex items-center gap-2 shadow-2xl pointer-events-auto">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
              FREE-FOR-ALL
            </span>
            <span className="text-xl font-mono tracking-tight text-white font-extrabold">
              {formatTime(matchTimeLeft)}
            </span>
          </div>
          <div className="h-8 w-[1px] bg-slate-700/50" />
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              TARGET
            </span>
            <span className="text-sm font-mono font-bold text-amber-400">
              {scoreLimit} Kills
            </span>
          </div>
        </div>

        {/* Real-time mini Leaderboard */}
        <div id="leaderboard-card" className="bg-slate-900/85 backdrop-blur-md border border-slate-700/30 w-64 rounded-xl shadow-2xl p-2 space-y-2 pointer-events-auto">
          <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold flex items-center gap-1">
              <Target className="w-3.5 h-3.5 text-amber-500" /> Leaderboard
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              Rank: <strong className="text-emerald-400">#{playerRank}</strong>
            </span>
          </div>

          <div id="leaderboard-list" className="space-y-1">
            {topStats.map((item, index) => {
              const isLocalPlayer = item.id === 'player';
              return (
                <div
                  key={item.id}
                  className={`flex justify-between items-center px-2 py-1 rounded text-xs transition-all ${
                    isLocalPlayer
                      ? 'bg-emerald-500/15 border-l-2 border-emerald-400 text-emerald-200'
                      : 'text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-mono text-[10px] text-slate-500">#{index + 1}</span>
                    <span className="font-bold truncate max-w-[100px]">{item.name}</span>
                    {isLocalPlayer && (
                      <span className="bg-emerald-500/20 text-emerald-400 text-[8px] font-mono px-1 rounded">
                        YOU
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 text-right font-mono text-[11px]">
                    <span>K:<strong className="text-white">{item.kills}</strong></span>
                    <span>D:<strong>{item.deaths}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ================= MIDDLE OVERLAY (Crosshair and action alerts) ================= */}
      <div id="hud-center" className="absolute inset-0 flex flex-col justify-center items-center pointer-events-none z-20">
        
        {/* Dynamic central crosshair and reactive hitmarkers */}
        <div id="central-crosshair-element" className="relative flex justify-center items-center">
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_8px_#34d399]" />
          <div className="absolute w-6 h-[2px] bg-emerald-400/80 -left-4" />
          <div className="absolute w-6 h-[2px] bg-emerald-400/80 -right-4" />
          <div className="absolute w-[2px] h-6 bg-emerald-400/80 -top-2" />
          <div className="absolute w-[2px] h-6 bg-emerald-400/80 -bottom-4" />

          {/* Body Shot Hitmarker (White/Cyan sharp X) */}
          {hitmarker === 'body' && (
            <div className="absolute w-6 h-6 pointer-events-none flex items-center justify-center animate-ping-once">
              <div className="absolute w-3.5 h-[2px] bg-white shadow-[0_0_8px_#fff] rotate-45 -translate-x-2 -translate-y-2" />
              <div className="absolute w-3.5 h-[2px] bg-white shadow-[0_0_8px_#fff] -rotate-45 translate-x-2 -translate-y-2" />
              <div className="absolute w-3.5 h-[2px] bg-white shadow-[0_0_8px_#fff] -rotate-45 -translate-x-2 translate-y-2" />
              <div className="absolute w-3.5 h-[2px] bg-white shadow-[0_0_8px_#fff] rotate-45 translate-x-2 translate-y-2" />
            </div>
          )}

          {/* Heavy Headshot Hitmarker (Crimson/Gold heavy X + Critical alert) */}
          {hitmarker === 'head' && (
            <div className="absolute w-12 h-12 pointer-events-none flex items-center justify-center animate-bounce-once">
              <div className="absolute w-5 h-[3px] bg-rose-500 shadow-[0_0_12px_#f43f5e] rotate-45 -translate-x-3 -translate-y-3 rounded-full" />
              <div className="absolute w-5 h-[3px] bg-rose-500 shadow-[0_0_12px_#f43f5e] -rotate-45 translate-x-3 -translate-y-3 rounded-full" />
              <div className="absolute w-5 h-[3px] bg-rose-500 shadow-[0_0_12px_#f43f5e] -rotate-45 -translate-x-3 translate-y-3 rounded-full" />
              <div className="absolute w-5 h-[3px] bg-rose-500 shadow-[0_0_12px_#f43f5e] rotate-45 translate-x-3 translate-y-3 rounded-full" />
              <div className="absolute text-[9px] font-mono font-black text-amber-300 bg-rose-950/90 border border-rose-500/80 px-1.5 py-0.5 rounded -top-9 animate-pulse shadow-xl tracking-widest whitespace-nowrap">
                CRITICAL HEADSHOT!
              </div>
            </div>
          )}
        </div>

        {/* Tactical UI indicators */}
        {isLowHealth && (
          <div id="low-hp-warning" className="mt-20 px-3 py-1 bg-red-600/25 border border-red-500/40 backdrop-blur-sm rounded-full text-rose-300 text-xs font-bold tracking-wider uppercase animate-pulse">
            HEALTH CRITICAL — INJECT ADRENALINE OR FIND COVER
          </div>
        )}
      </div>

      {/* ================= BOTTOM OVERLAY (Vitals, controls, abilities, ammo) ================= */}
      <div id="hud-bottom" className="flex justify-between items-end w-full">
        
        {/* Left Side: Health & Audio controls */}
        <div className="flex flex-col gap-2">
          
          {/* Action buttons (Mute/Quit) */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              id="hud-mute-button"
              onClick={onToggleMute}
              className="p-2.5 rounded-xl bg-slate-900/85 hover:bg-slate-800 border border-slate-700/30 transition shadow-2xl"
              title="Toggle Game Audio"
            >
              {isMuted ? <VolumeX className="w-4.5 h-4.5 text-rose-400" /> : <Volume2 className="w-4.5 h-4.5 text-emerald-400" />}
            </button>
            <button
              id="hud-controls-button"
              onClick={() => setShowControls(true)}
              className="px-3 py-2 rounded-xl bg-slate-900/85 hover:bg-slate-800 border border-slate-700/30 hover:border-emerald-500/30 text-emerald-400 hover:text-emerald-300 transition shadow-2xl flex items-center gap-1.5 text-xs font-mono font-bold"
              title="Configure Keyboard Controls"
            >
              <Keyboard className="w-4.5 h-4.5" /> CONTROLS
            </button>
            <button
              id="hud-quit-button"
              onClick={onQuit}
              className="px-4 py-2 text-xs font-mono font-bold tracking-wider bg-slate-900/85 hover:bg-rose-950/40 border border-slate-700/30 hover:border-rose-500/30 text-rose-300 rounded-xl transition shadow-2xl"
            >
              RETREAT LOBBY
            </button>
          </div>

          {/* Health Bar widget */}
          <div id="health-bar-widget" className="bg-slate-900/85 backdrop-blur-md border border-slate-700/30 w-72 p-2 rounded-xl shadow-2xl flex items-center gap-2">
            <div className={`p-2.5 rounded-xl ${isLowHealth ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              <Heart className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">
                  HP INTEGRITY
                </span>
                <span className={`text-sm font-mono font-extrabold ${isLowHealth ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {playerHealth} / {playerMaxHealth}
                </span>
              </div>
              <div className="w-full h-3 bg-slate-850 rounded-full overflow-hidden border border-slate-800">
                <div
                  id="health-bar-progress"
                  style={{ width: `${healthPercent}%` }}
                  className={`h-full rounded-full transition-all duration-150 ${
                    isLowHealth
                      ? 'bg-gradient-to-r from-red-500 to-rose-600'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Center: Live Kill Feed (Rolls left-to-right) */}
        <div id="killfeed-container" className="flex flex-col gap-1.5 max-h-36 overflow-hidden w-64 text-left self-center pointer-events-none mb-2">
          {killFeed.slice(-4).map((feed) => (
            <div
              key={feed.id}
              className="flex items-center gap-1.5 bg-slate-950/70 border border-slate-800/20 px-3 py-1 rounded-lg text-xs tracking-tight animate-slide-in font-mono shadow-md text-slate-300"
            >
              <span className={`font-bold ${feed.killer.isBot ? 'text-amber-400' : 'text-emerald-400'}`}>
                {feed.killer.name}
              </span>
              <span className="text-slate-500 text-[10px] lowercase italic">
                eliminated
              </span>
              <span className={`font-bold ${feed.victim.isBot ? 'text-amber-400' : 'text-emerald-400'}`}>
                {feed.victim.name}
              </span>
              <span className="text-slate-500 ml-auto text-[10px]">
                via {feed.weaponName}
              </span>
              {feed.isHeadshot && (
                <span className="bg-rose-500/20 text-rose-400 text-[8px] px-1 font-bold rounded">
                  HEADSHOT
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Right Side: Active Ability, Weapon details, Ammo count */}
        <div className="flex items-end gap-2">
          
          {/* Active Ability Cooldown Trigger */}
          <div id="ability-icon-widget" className="bg-slate-900/85 backdrop-blur-md border border-slate-700/30 p-2 rounded-2xl shadow-2xl flex flex-col items-center justify-center gap-1 w-16 h-16">
            <span className="text-[8px] font-mono text-slate-400 uppercase tracking-wider">
              {playerClass.ability.name.split(' ')[0]}
            </span>
            <div className="relative flex items-center justify-center">
              <Zap className={`w-4 h-4 ${abilityCooldownLeft > 0 ? 'text-slate-500 animate-none' : 'text-amber-400 animate-pulse'}`} />
              
              {abilityCooldownLeft > 0 && (
                <div className="absolute inset-0 bg-slate-900/90 rounded-full flex items-center justify-center text-xs font-mono font-extrabold text-amber-500">
                  {Math.ceil(abilityCooldownLeft)}s
                </div>
              )}
            </div>
            <span className="text-[9px] font-mono font-bold bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 mt-1">
              KEY {bindings.ability === ' ' ? 'SPACE' : bindings.ability.toUpperCase()}
            </span>
          </div>

          {/* Ammo & Weapon HUD widget */}
          <div id="ammo-hud-widget" className="bg-slate-900/85 backdrop-blur-md border border-slate-700/30 p-2 rounded-xl shadow-2xl w-40 flex items-center justify-between gap-2">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">
                WEAPON
              </span>
              <span className="text-sm font-sans font-bold text-white tracking-tight truncate max-w-[100px]">
                {activeWeapon.name}
              </span>
              <span className="text-[9px] font-mono text-emerald-400 font-semibold">
                Class: {playerClass.codename}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xl font-mono font-extrabold tracking-tighter text-white">
                {playerClip}
              </span>
              <span className="text-[10px] font-mono text-slate-400 font-bold">
                / {playerReserve}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ================= TOUCHSCREEN VIRTUAL OVERLAY ================= */}
      {useTouchControls && (
        <div id="virtual-touch-controls-overlay" className="absolute inset-0 z-0 pointer-events-none">
          {/* Left Area: Virtual Joystick */}
          <div
            id="touch-joystick-bound-zone"
            className="absolute bottom-12 left-12 w-32 h-32 rounded-full border border-slate-700/50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center pointer-events-auto select-none"
            onTouchStart={handleJoystickStart}
            onTouchMove={handleJoystickMove}
            onTouchEnd={handleJoystickEnd}
          >
            <div
              id="touch-joystick-knob"
              className="w-12 h-12 rounded-full bg-emerald-500/80 border border-emerald-400/80 shadow-[0_0_12px_rgba(16,185,129,0.5)] transition-transform duration-75"
              style={{
                transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`
              }}
            />
          </div>

          {/* Right Area: Large Trackpad Zone for looking around */}
          <div
            id="touch-look-trackpad-zone"
            className="absolute top-1/4 bottom-1/4 left-1/3 right-0 pointer-events-auto bg-transparent border-none select-none"
            onTouchStart={handleLookStart}
            onTouchMove={handleLookMove}
            onTouchEnd={handleLookEnd}
          />

          {/* Action Buttons Cluster (Arc Layout) */}
          <div id="touch-actions-cluster" className="absolute bottom-12 right-12 flex flex-col items-end gap-2.5 pointer-events-auto select-none touch-none">
            <div className="flex gap-2">
              {/* Special Ability Button */}
              <button
                onPointerDown={(e) => handleButtonEvent(e, 'btnAbility', true)}
                onPointerUp={(e) => handleButtonEvent(e, 'btnAbility', false)}
                onPointerLeave={(e) => handleButtonEvent(e, 'btnAbility', false)}
                onPointerCancel={(e) => handleButtonEvent(e, 'btnAbility', false)}
                className="w-14 h-14 rounded-full bg-indigo-600/60 border border-indigo-400/50 flex flex-col items-center justify-center text-[10px] font-bold shadow-lg cursor-pointer transform active:scale-95 transition-all"
              >
                <Zap className="w-5 h-5 text-indigo-300 fill-indigo-400" />
                <span className="text-[7px] text-indigo-200">ABILITY</span>
              </button>

              {/* Weapon Swap Button */}
              <button
                onPointerDown={(e) => handleButtonEvent(e, 'btnSwap', true)}
                onPointerUp={(e) => handleButtonEvent(e, 'btnSwap', false)}
                onPointerLeave={(e) => handleButtonEvent(e, 'btnSwap', false)}
                onPointerCancel={(e) => handleButtonEvent(e, 'btnSwap', false)}
                className="w-14 h-14 rounded-full bg-slate-700/60 border border-slate-500/50 flex flex-col items-center justify-center text-[10px] font-bold shadow-lg cursor-pointer transform active:scale-95 transition-all"
              >
                <Smartphone className="w-5 h-5 text-slate-300" />
                <span className="text-[7px] text-slate-200">SWAP</span>
              </button>
            </div>

            <div className="flex gap-2 items-center">
              {/* Reload Button */}
              <button
                onPointerDown={(e) => handleButtonEvent(e, 'btnReload', true)}
                onPointerUp={(e) => handleButtonEvent(e, 'btnReload', false)}
                onPointerLeave={(e) => handleButtonEvent(e, 'btnReload', false)}
                onPointerCancel={(e) => handleButtonEvent(e, 'btnReload', false)}
                className="w-16 h-16 rounded-full bg-teal-600/60 border border-teal-400/50 flex flex-col items-center justify-center text-[10px] font-bold shadow-lg cursor-pointer transform active:scale-95 transition-all"
              >
                <Flame className="w-4 h-4 text-teal-300" />
                <span className="text-[8px] text-teal-200">RELOAD</span>
              </button>

              {/* Jump Button */}
              <button
                onPointerDown={(e) => handleButtonEvent(e, 'btnJump', true)}
                onPointerUp={(e) => handleButtonEvent(e, 'btnJump', false)}
                onPointerLeave={(e) => handleButtonEvent(e, 'btnJump', false)}
                onPointerCancel={(e) => handleButtonEvent(e, 'btnJump', false)}
                className="w-16 h-16 rounded-full bg-amber-500/60 border border-amber-300/50 flex flex-col items-center justify-center text-[10px] font-bold shadow-lg cursor-pointer transform active:scale-95 transition-all"
              >
                <Eye className="w-4 h-4 text-amber-300" />
                <span className="text-[8px] text-amber-200">JUMP</span>
              </button>

              {/* Aim ADS Button */}
              <button
                onPointerDown={(e) => handleButtonEvent(e, 'btnAim', true)}
                onPointerUp={(e) => handleButtonEvent(e, 'btnAim', false)}
                onPointerLeave={(e) => handleButtonEvent(e, 'btnAim', false)}
                onPointerCancel={(e) => handleButtonEvent(e, 'btnAim', false)}
                className="w-18 h-18 rounded-full bg-blue-600/60 border border-blue-400/50 flex flex-col items-center justify-center text-[11px] font-bold shadow-lg cursor-pointer transform active:scale-95 transition-all"
              >
                <Crosshair className="w-7 h-7 text-blue-300" />
                <span className="text-[9px] text-blue-200">SCOPE</span>
              </button>

              {/* Main Shoot / Fire Button */}
              <button
                onPointerDown={(e) => handleButtonEvent(e, 'btnFire', true)}
                onPointerUp={(e) => handleButtonEvent(e, 'btnFire', false)}
                onPointerLeave={(e) => handleButtonEvent(e, 'btnFire', false)}
                onPointerCancel={(e) => handleButtonEvent(e, 'btnFire', false)}
                className="w-22 h-22 rounded-full bg-rose-600/75 border-2 border-rose-400/80 shadow-[0_0_20px_rgba(244,63,94,0.4)] flex flex-col items-center justify-center text-xs font-black tracking-wider cursor-pointer transform active:scale-95 transition-all"
              >
                <Target className="w-9 h-9 text-rose-100 fill-rose-300" />
                <span className="text-[10px] text-rose-100 font-extrabold">SHOOT</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= IN-GAME CONTROLS REBINDING MODAL ================= */}
      {showControls && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-50 pointer-events-auto p-2 animate-fade-in">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => setShowControls(false)}
              className="absolute top-2 right-4 p-2 rounded-full bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition"
              title="Close Panel"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="flex items-center gap-2.5 mb-4">
              <Keyboard className="w-4 h-4 text-emerald-400" />
              <div>
                <h3 className="text-lg font-bold">Combat Control Config</h3>
                <p className="text-xs text-slate-400">Rebind your keys or virtual touch controls.</p>
              </div>
            </div>

            {/* Tab Toggles */}
            <div className="flex gap-2 mb-4 bg-slate-950 p-1 rounded-xl border border-slate-850">
              <button
                onClick={() => setBindTab('keyboard')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold font-sans transition-all flex items-center justify-center gap-1.5 ${
                  bindTab === 'keyboard'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Keyboard className="w-4 h-4" /> Keyboard & Mouse
              </button>
              <button
                onClick={() => setBindTab('touch')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold font-sans transition-all flex items-center justify-center gap-1.5 ${
                  bindTab === 'touch'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-4 h-4" /> Touchscreen Controls
              </button>
            </div>

            {bindTab === 'keyboard' ? (
              <KeybindingsEditor
                bindings={bindings}
                onBindingsChange={onBindingsChange}
              />
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-xs font-mono font-bold text-slate-300">Enable Mobile Touch Overlay</span>
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
                
                {useTouchControls && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
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
                          className="flex justify-between items-center p-2.5 rounded-xl bg-slate-950/65 border border-slate-800/40"
                        >
                          <span className="text-xs text-slate-300 font-medium">{label}</span>
                          <select
                            value={currentValue}
                            onChange={(e) => {
                              const updated = { ...touchBindings, [key]: e.target.value as any };
                              onTouchBindingsChange(updated);
                            }}
                            className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-emerald-400 font-mono focus:outline-none"
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
            )}

            <button
              onClick={() => setShowControls(false)}
              className="mt-6 w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold tracking-wide rounded-xl shadow-lg transition-all"
            >
              RESUME COMBAT MATCH
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
