import fs from 'fs';
let code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf8');

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
      
      const wep = game.activeWeapon;
      const isM16 = wep.id === 'm16_burst';
      const isCrossbow = wep.id === 'crossbow_explosive';
      const isAK = wep.id === 'ak47_heavy';

      const result = buildHighQualityFirstPersonWeapon(wep, isAK, isM16, isCrossbow);
      
      game.slideMesh = result.slideMesh;
      game.slashMesh = result.slashMesh;
      game.weaponMesh = result.weaponMesh;
      
      weaponGroup.add(result.weaponGroup);

      // Add hands/gloves holding the weapon
      const gloveMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
      const sleeveMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(playerClass.color).multiplyScalar(0.7), roughness: 0.9 });

      const leftHandGeo = new THREE.BoxGeometry(0.05, 0.05, 0.07);
      const leftHand = new THREE.Mesh(leftHandGeo, gloveMat);
      leftHand.position.set(-0.06, -0.02, -0.15);
      leftHand.rotation.set(0.1, 0.2, -0.3);
      result.weaponMesh.add(leftHand);

      const leftArmGeo = new THREE.BoxGeometry(0.06, 0.06, 0.25);
      const leftArm = new THREE.Mesh(leftArmGeo, sleeveMat);
      leftArm.position.set(-0.11, -0.09, 0.02);
      leftArm.rotation.set(0.4, 0.3, -0.2);
      result.weaponMesh.add(leftArm);

      const rightHandGeo = new THREE.BoxGeometry(0.05, 0.05, 0.07);
      const rightHand = new THREE.Mesh(rightHandGeo, gloveMat);
      rightHand.position.set(0, -0.08, 0.05);
      result.weaponMesh.add(rightHand);

      const rightArmGeo = new THREE.BoxGeometry(0.06, 0.06, 0.3);
      const rightArm = new THREE.Mesh(rightArmGeo, sleeveMat);
      rightArm.position.set(0.05, -0.15, 0.2);
      rightArm.rotation.set(0.3, -0.2, 0.1);
      result.weaponMesh.add(rightArm);
    };

`;

  const newCode = code.slice(0, startIndex) + newBody + code.slice(endIndex);
  fs.writeFileSync('src/components/GameCanvas.tsx', newCode);
  console.log("Replaced successfully!");
} else {
  console.log("Could not find start/end bounds.");
}
