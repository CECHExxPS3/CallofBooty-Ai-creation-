const fs = require('fs');
let code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf-8');

code = code.replace(
  /<div className="h-full bg-gradient-to-r from-orange-500 to-red-500 origin-left animate-shrink-x" style=\{\{ animationDuration: '3s' \}\} \/>/,
  '<div key={killStreak} className="h-full bg-gradient-to-r from-orange-500 to-red-500 origin-left animate-shrink-x" style={{ animationDuration: "3s" }} />'
);

fs.writeFileSync('src/components/GameCanvas.tsx', code);
