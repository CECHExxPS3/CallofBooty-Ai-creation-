import fs from 'fs';
let code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf8');

const flashEffectStr = `      // Flash Effect & Dynamic Muzzle Point Light
      if (game.muzzleFlash && game.muzzleFlashLight) {
        (game.muzzleFlash.material as THREE.MeshBasicMaterial).opacity = 1.0;
        game.muzzleFlashLight.intensity = 3.5;
        game.muzzleFlashTimer = 60; // 60ms flash duration
      }`;
      
const newFlashEffectStr = `      // Flash Effect & Dynamic Muzzle Point Light
      if (game.muzzleFlash && game.muzzleFlashLight) {
        (game.muzzleFlash.material as THREE.MeshBasicMaterial).opacity = 1.0;
        game.muzzleFlashLight.intensity = 3.5;
        game.muzzleFlashTimer = 60; // 60ms flash duration
        
        // Smoke puff
        const muzzlePos = new THREE.Vector3(0.2, -0.15, -1.2).applyQuaternion(camera.quaternion).add(camera.position);
        spawnParticles(muzzlePos, '#94a3b8', 4);
        spawnParticles(muzzlePos, '#fde047', 2); // Sparks
      }`;

code = code.replace(flashEffectStr, newFlashEffectStr);

fs.writeFileSync('src/components/GameCanvas.tsx', code);
console.log("Added muzzle smoke and sparks");
