const fs = require('fs');
let code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf-8');

code = code.replace(
  /<h2 className="text-5xl font-mono text-rose-500 tracking-wider font-extrabold animate-bounce">\s*WASTED\s*<\/h2>/,
  `<h2 className="text-5xl font-mono text-rose-500 tracking-wider font-extrabold animate-bounce">
            WASTED
          </h2>
          {deathMessage && (
            <div className="mt-4 px-6 py-2 rounded-xl text-2xl font-black italic uppercase shadow-2xl border-2 transform -skew-x-12 bg-gradient-to-r from-red-600 to-orange-500 border-yellow-400 text-white shadow-red-500/50 animate-slide-in">
              {deathMessage}
            </div>
          )}`
);

fs.writeFileSync('src/components/GameCanvas.tsx', code);
