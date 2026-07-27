import React, { useState, useEffect } from 'react';
import { KeyBindings, DEFAULT_KEYBINDINGS } from '../types';
import { Keyboard, RotateCcw, ShieldAlert } from 'lucide-react';

interface KeybindingsEditorProps {
  bindings: KeyBindings;
  onBindingsChange: (bindings: KeyBindings) => void;
  className?: string;
}

export const KeybindingsEditor: React.FC<KeybindingsEditorProps> = ({
  bindings,
  onBindingsChange,
  className = ''
}) => {
  const [activeBindingKey, setActiveBindingKey] = useState<keyof KeyBindings | null>(null);

  const labels: Record<keyof KeyBindings, string> = {
    forward: 'Move Forward',
    backward: 'Move Backward',
    left: 'Strafe Left',
    right: 'Strafe Right',
    fire: 'Primary Shoot / Fire',
    aim: 'Aim Down Sights (ADS)',
    jump: 'Jump / Leap',
    reload: 'Reload Weapon',
    ability: 'Class Special Ability',
    swap: 'Swap Weapons',
  };

  useEffect(() => {
    if (!activeBindingKey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Normalize key representation
      let keyToSet = e.key.toLowerCase();
      if (e.key === ' ') {
        keyToSet = ' ';
      }

      // Avoid conflict or invalid key selections like Escape
      if (e.key === 'Escape') {
        setActiveBindingKey(null);
        return;
      }

      const updated = { ...bindings, [activeBindingKey]: keyToSet };
      onBindingsChange(updated);
      setActiveBindingKey(null);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [activeBindingKey, bindings, onBindingsChange]);

  const handleReset = () => {
    onBindingsChange(DEFAULT_KEYBINDINGS);
    setActiveBindingKey(null);
  };

  const getDisplayKeyName = (keyVal: string) => {
    if (keyVal === ' ') return 'Spacebar';
    if (keyVal.startsWith('arrow')) {
      return keyVal.replace('arrow', 'Arrow ').toUpperCase();
    }
    return keyVal.toUpperCase();
  };

  return (
    <div id="keybinds-container" className={`bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 ${className}`}>
      <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800/50">
        <h4 className="text-xs font-mono text-slate-300 uppercase tracking-wider font-extrabold flex items-center gap-2">
          <Keyboard className="w-4 h-4 text-emerald-400" /> Custom Key Bindings
        </h4>
        <button
          onClick={handleReset}
          className="text-[10px] font-mono text-slate-400 hover:text-rose-400 flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800/50 hover:border-rose-500/20 transition-all"
        >
          <RotateCcw className="w-3 h-3" /> Reset Defaults
        </button>
      </div>

      <p className="text-xs text-slate-400 mb-4 leading-relaxed">
        Click any action to rebind. Standard mouse buttons (Left Click to Fire, Right Click to Aim) are always active.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
        {(Object.keys(labels) as Array<keyof KeyBindings>).map((keyName) => {
          const isListening = activeBindingKey === keyName;
          const value = bindings[keyName];

          return (
            <div
              key={keyName}
              id={`binding-row-${keyName}`}
              className="flex justify-between items-center p-2.5 rounded-xl bg-slate-950/65 border border-slate-800/40 hover:border-slate-800 transition"
            >
              <span className="text-xs text-slate-300 font-medium">{labels[keyName]}</span>
              <button
                onClick={() => setActiveBindingKey(keyName)}
                className={`min-w-[90px] px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wide transition-all border ${
                  isListening
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/40 animate-pulse'
                    : 'bg-slate-900 text-emerald-400 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                }`}
              >
                {isListening ? 'PRESS KEY...' : getDisplayKeyName(value)}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-start gap-2 bg-slate-950/40 p-3 rounded-xl border border-slate-800/30">
        <ShieldAlert className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
        <span className="text-[10px] text-slate-500 leading-relaxed font-mono">
          BARRIER ACTIVE: Camera auto-stabilizes the horizon using 'YXZ' quaternions. Left & Right Arrow keys rotate yaw, and Up & Down Arrow keys rotate pitch.
        </span>
      </div>
    </div>
  );
};
