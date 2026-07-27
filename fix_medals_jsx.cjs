const fs = require('fs');
let code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf-8');

const medalsJSX = `
      {/* MEDALS OVERLAY */}
      <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 pointer-events-none z-30">
        {medals.map(m => (
          <div key={m.id} className="animate-slide-in">
            <div className={\`px-6 py-2 rounded-xl text-xl font-black italic uppercase shadow-2xl border-2 transform -skew-x-12 \${
              m.type === 'headshot' ? 'bg-gradient-to-r from-red-600 to-orange-500 border-yellow-400 text-white shadow-red-500/50' :
              m.type === 'noscope' ? 'bg-gradient-to-r from-purple-600 to-indigo-500 border-pink-400 text-white shadow-purple-500/50' :
              'bg-gradient-to-r from-emerald-600 to-cyan-500 border-teal-400 text-white shadow-emerald-500/50'
            }\`}>
              {m.text}
            </div>
          </div>
        ))}
      </div>
`;

code = code.replace(
  /\{\/\* FOV CIRCLE FOR AIMBOT \*\/\}/,
  medalsJSX + '\n      {/* FOV CIRCLE FOR AIMBOT */}'
);

fs.writeFileSync('src/components/GameCanvas.tsx', code);
