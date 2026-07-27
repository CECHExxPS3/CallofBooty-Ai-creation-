const fs = require('fs');
let code = fs.readFileSync('src/components/GameHUD.tsx', 'utf-8');

// The outer container size could just be made slightly smaller with CSS scale
// but since this is React/Tailwind, let's shrink the padding and text.

code = code.replace(/text-4xl/g, 'text-3xl');
code = code.replace(/text-3xl/g, 'text-2xl');
code = code.replace(/text-2xl/g, 'text-xl');

code = code.replace(/w-6 h-6/g, 'w-5 h-5');
code = code.replace(/w-8 h-8/g, 'w-6 h-6');

code = code.replace(/p-4/g, 'p-3');
code = code.replace(/p-3/g, 'p-2');

fs.writeFileSync('src/components/GameHUD.tsx', code);
