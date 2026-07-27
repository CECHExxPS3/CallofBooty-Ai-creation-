const fs = require('fs');
const file = fs.readFileSync('src/components/GameCanvas.tsx', 'utf8');
const newFile = file.replace(
`                  <div className="space-y-2">
                    {[
                      { key: 'godMode', label: 'GOD MODE (INVINCIBLE)' },
                      { key: 'flyHack', label: 'FLY HACK (GRAVITY OFF)' },
                      { key: 'speedHack', label: 'SPEED HACK (2.5X SPEED)' },
                      { key: 'insaneSpeed', label: 'INSANE SPEED (10X SPEED)' },
                      { key: 'superJump', label: 'SUPER JUMP' },
                    ].map(hack => {`,
`                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {[
                      { key: 'godMode', label: 'GOD MODE (INVINCIBLE)' },
                      { key: 'autoHeal', label: 'AUTO HEAL (WOLVERINE)' },
                      { key: 'flyHack', label: 'FLY HACK (GRAVITY OFF)' },
                      { key: 'speedHack', label: 'SPEED HACK (2.5X SPEED)' },
                      { key: 'insaneSpeed', label: 'INSANE SPEED (10X SPEED)' },
                      { key: 'superJump', label: 'SUPER JUMP' },
                      { key: 'rapidFire', label: 'RAPID FIRE' },
                      { key: 'fullAuto', label: 'FULL AUTO' },
                      { key: 'oneShot', label: 'ONE SHOT KILL' },
                      { key: 'unlimitedAmmo', label: 'INFINITE AMMO' },
                      { key: 'noRecoil', label: 'NO RECOIL' },
                      { key: 'wallhack', label: 'FIRE THROUGH WALLS' },
                      { key: 'tracerLines', label: 'ESP TRACER LINES' },
                    ].map(hack => {`
);
fs.writeFileSync('src/components/GameCanvas.tsx', newFile);
