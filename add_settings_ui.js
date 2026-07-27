import fs from 'fs';
let code = fs.readFileSync('src/components/GameHUD.tsx', 'utf8');

code = code.replace(
  'X, Smartphone } from \'lucide-react\';',
  'X, Smartphone, Settings } from \'lucide-react\';'
);

const actionButtonsStr = `          {/* Action buttons (Mute/Quit) */}
          <div className="flex items-center gap-2 pointer-events-auto">`;

const newActionButtonsStr = `          {/* Action buttons (Mute/Quit) */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="relative group">
              <button
                className="p-2.5 rounded-xl bg-slate-900/85 hover:bg-slate-800 border border-slate-700/30 transition shadow-2xl text-slate-400 hover:text-slate-200"
                title="Graphics Settings"
              >
                <Settings className="w-4.5 h-4.5" />
              </button>
              <div className="absolute right-0 top-full mt-2 w-32 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex flex-col">
                {['POTATO', 'LOW', 'MEDIUM', 'HIGH', 'ULTRA'].map((q) => (
                  <button
                    key={q}
                    onClick={() => onGraphicsChange(q as any)}
                    className={\`px-4 py-2 text-xs font-mono font-bold text-left hover:bg-slate-800 transition \${graphicsQuality === q ? 'text-emerald-400 bg-slate-800/50' : 'text-slate-400'}\`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>`;
            
code = code.replace(actionButtonsStr, newActionButtonsStr);

const propsDestructureStr = `  abilityCooldownLeft,
  isMuted,
  onToggleMute,`;

const newPropsDestructureStr = `  graphicsQuality,
  onGraphicsChange,
  abilityCooldownLeft,
  isMuted,
  onToggleMute,`;

code = code.replace(propsDestructureStr, newPropsDestructureStr);

fs.writeFileSync('src/components/GameHUD.tsx', code);
console.log("Added graphics quality menu");
