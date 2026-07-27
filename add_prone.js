import fs from 'fs';
let code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf8');

code = code.replace(
  'isADS: boolean;',
  'isADS: boolean;\n    isProne: boolean;'
);

code = code.replace(
  'game.isADS = false;',
  'game.isADS = false;\n    game.isProne = false;'
);

// Toggle prone on CTRL
code = code.replace(
  "if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {",
  `if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
        game.isProne = !game.isProne;
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {`
);

// Disable sprint if prone
code = code.replace(
  "let moveSpeed = game.keys[keySprint] && !game.isADS && !game.isFiring && !game.isReloading && game.playerVel.y === 0 ? 12.0 : 6.5;",
  `let moveSpeed = game.keys[keySprint] && !game.isADS && !game.isFiring && !game.isReloading && game.playerVel.y === 0 && !game.isProne ? 12.0 : (game.isProne ? 2.5 : 6.5);`
);

fs.writeFileSync('src/components/GameCanvas.tsx', code);
console.log("Added prone toggle");
