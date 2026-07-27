const fs = require('fs');
let code = fs.readFileSync('src/components/GameHUD.tsx', 'utf-8');

code = code.replace(/w-80/, 'w-64');

fs.writeFileSync('src/components/GameHUD.tsx', code);
