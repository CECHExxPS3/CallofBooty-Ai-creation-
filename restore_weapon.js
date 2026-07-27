import fs from 'fs';
const code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf8');

const startStr = "const buildFirstPersonWeapon = () => {";
const endStr = "    buildFirstPersonWeapon();";

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
  const newBody = `const buildFirstPersonWeapon = () => {
      // Clear old meshes
      while (weaponGroup.children.length > 0) {
        weaponGroup.remove(weaponGroup.children[0]);
      }
      game.slideMesh = null;
      game.slashMesh = null;

      const wep = game.activeWeapon;
      const isSniper = wep.type === 'SNIPER';
      const isLMG = wep.type === 'LMG';
      const isShotgun = wep.type === 'SHOTGUN';
      const isPistol = wep.type === 'PISTOL';
      const isKnife = wep.type === 'KNIFE';
      const isLauncher = wep.type === 'LAUNCHER';
      const isSMG = wep.type === 'SMG';

      // Base Materials
      const gunMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(wep.color),
        roughness: 0.3,
        metalness: 0.8,
        flatShading: true
      });
      const darkMat = new THREE.MeshStandardMaterial({
        color: 0x111827,
        roughness: 0.8,
        metalness: 0.2,
        flatShading: true
      });
      const metalMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.4,
        metalness: 0.9,
        flatShading: true
      });

      // 1. Primary Gun Body
      const bodyWidth = isLauncher ? 0.12 : isPistol ? 0.04 : isSMG ? 0.05 : isLMG ? 0.11 : isKnife ? 0.03 : 0.06;
      const bodyHeight = isLauncher ? 0.12 : isPistol ? 0.07 : isSMG ? 0.08 : isLMG ? 0.14 : isKnife ? 0.12 : 0.09;
      const bodyLength = isLauncher ? 0.60 : isPistol ? 0.18 : isSMG ? 0.32 : isSniper ? 0.65 : isKnife ? 0.35 : 0.45;

      const gunBodyGeo = new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyLength);
      const gunBody = new THREE.Mesh(gunBodyGeo, gunMat);
      
      // Position to lock onto camera bottom right
      gunBody.position.set(0.18, -0.22, -0.45);
      gunBody.castShadow = true;
      weaponGroup.add(gunBody);
      game.weaponMesh = gunBody;

      if (isKnife) {
        // Knife Model
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.15, 8), darkMat);
        handle.rotation.x = Math.PI / 2;
        handle.position.set(0, -0.02, 0.1);
        gunBody.add(handle);

        // Blade
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.03, 0.25), metalMat);
        blade.position.set(0, -0.01, -0.1);
        gunBody.add(blade);

        // Slash effect
        const slashGeo = new THREE.PlaneGeometry(0.8, 0.8);
        const slashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
        const slashMesh = new THREE.Mesh(slashGeo, slashMat);
        slashMesh.position.set(0, 0, -0.6);
        slashMesh.rotation.x = Math.PI / 2;
        gunBody.add(slashMesh);
        game.slashMesh = slashMesh;
      } else {
        // --- FIREARMS COMMON PARTS ---
        
        // Grip
        const gripGeo = new THREE.BoxGeometry(0.03, 0.12, 0.04);
        const grip = new THREE.Mesh(gripGeo, darkMat);
        grip.position.set(0, -0.08, 0.12);
        grip.rotation.x = 0.15;
        gunBody.add(grip);

        // Barrel
        const barrelLength = isSniper ? 0.5 : isPistol ? 0.1 : isSMG ? 0.15 : isShotgun ? 0.4 : 0.3;
        const barrelGeo = new THREE.CylinderGeometry(0.01, 0.01, barrelLength, 8);
        const barrel = new THREE.Mesh(barrelGeo, metalMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.01, -(bodyLength / 2) - (barrelLength / 2) + 0.02);
        gunBody.add(barrel);

        // Magazine / Clip
        if (!isPistol && !isShotgun) {
          const magGeo = new THREE.BoxGeometry(0.035, 0.14, isSMG ? 0.04 : 0.08);
          const mag = new THREE.Mesh(magGeo, darkMat);
          mag.position.set(0, -0.08, -0.02);
          if (!isSMG) mag.rotation.x = -0.1;
          gunBody.add(mag);
        } else if (isShotgun) {
          // Shotgun pump
          const pump = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.15), darkMat);
          pump.position.set(0, -0.03, -0.15);
          gunBody.add(pump);
        }

        // Sight / Scope
        if (isSniper) {
          const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 12), darkMat);
          scope.rotation.x = Math.PI / 2;
          scope.position.set(0, 0.06, 0);
          gunBody.add(scope);
        } else {
          // Iron sights
          const sightRear = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), darkMat);
          sightRear.position.set(0, bodyHeight / 2 + 0.01, 0.1);
          gunBody.add(sightRear);

          const sightFront = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.02, 0.01), darkMat);
          sightFront.position.set(0, bodyHeight / 2 + 0.01, -bodyLength / 2 + 0.02);
          gunBody.add(sightFront);
        }
        
        // Slide / Bolt (animated during shooting)
        const slideGeo = new THREE.BoxGeometry(bodyWidth + 0.002, bodyHeight / 2, bodyLength * 0.4);
        const slide = new THREE.Mesh(slideGeo, darkMat);
        slide.position.set(0, bodyHeight / 4, 0);
        gunBody.add(slide);
        game.slideMesh = slide;
      }

      // Add simple arms/hands holding the weapon
      const gloveMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
      const sleeveMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(playerClass.color).multiplyScalar(0.7), roughness: 0.9 });

      const leftHand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.07), gloveMat);
      leftHand.position.set(-0.06, -0.02, -0.15);
      leftHand.rotation.set(0.1, 0.2, -0.3);
      gunBody.add(leftHand);

      const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.25), sleeveMat);
      leftArm.position.set(-0.11, -0.09, 0.02);
      leftArm.rotation.set(0.4, 0.3, -0.2);
      gunBody.add(leftArm);

      const rightHand = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.07), gloveMat);
      rightHand.position.set(0, -0.08, 0.05);
      gunBody.add(rightHand);

      const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.3), sleeveMat);
      rightArm.position.set(0.05, -0.15, 0.2);
      rightArm.rotation.set(0.3, -0.2, 0.1);
      gunBody.add(rightArm);
    };
`;
  const newCode = code.slice(0, startIndex) + newBody + code.slice(endIndex);
  fs.writeFileSync('src/components/GameCanvas.tsx', newCode);
  console.log("Restored minimal blocky weapons");
}
