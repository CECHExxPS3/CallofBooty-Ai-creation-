const fs = require('fs');
let code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf-8');

const streakJSX = `
      {/* KILL STREAK OVERLAY */}
      {killStreak > 1 && !gameRef.current.playerIsDead && (
        <div className="absolute top-24 left-8 z-30 animate-slide-in pointer-events-none">
          <div className="text-4xl font-black italic uppercase text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)] transform -skew-x-12">
            🔥 {killStreak} KILL STREAK
          </div>
          <div className="h-2 w-full bg-slate-900 rounded-full mt-2 border border-slate-700 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-500 to-red-500 origin-left animate-shrink-x" style={{ animationDuration: '3s' }} />
          </div>
        </div>
      )}
`;

code = code.replace(
  /\{\/\* FOV CIRCLE FOR AIMBOT \*\/\}/,
  streakJSX + '\n      {/* FOV CIRCLE FOR AIMBOT */}'
);

fs.writeFileSync('src/components/GameCanvas.tsx', code);
