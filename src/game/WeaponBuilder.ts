import * as THREE from 'three';
import { Weapon, CharacterClass } from '../types';

const createMesh = (geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh => {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

export const buildHighQualityFirstPersonWeapon = (
  game: any,
  weaponGroup: THREE.Group,
  playerClass: CharacterClass
) => {
  // Clear old meshes
  while (weaponGroup.children.length > 0) {
    weaponGroup.remove(weaponGroup.children[0]);
  }
  game.slideMesh = null;
  game.slashMesh = null;

  const wep = game.activeWeapon as Weapon;
  const wName = wep.name.toUpperCase();
  
  const baseMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(wep.color).multiplyScalar(0.7), roughness: 0.6, metalness: 0.5 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6, metalness: 0.8 });
  const lightMetal = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.2, metalness: 0.9 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a2f1d, roughness: 0.8, metalness: 0.1 });
  const polyMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7, metalness: 0.3 });
  const tanMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.8, metalness: 0.1 }); // Desert tan for SCAR
  
  const mainBody = new THREE.Group();
  mainBody.position.set(0.2, -0.25, -0.45); // default center-right
  weaponGroup.add(mainBody);
  game.weaponMesh = mainBody;

  // Generic helpers
  const makeReceiver = (w, h, d, mat) => {
    const r = createMesh(new THREE.BoxGeometry(w, h, d), mat);
    mainBody.add(r);
    return r;
  };
  const makeBarrel = (r, l, z, mat) => {
    const b = createMesh(new THREE.CylinderGeometry(r, r, l, 12), mat);
    b.rotation.x = Math.PI / 2;
    b.position.set(0, 0, z);
    mainBody.add(b);
    return b;
  };
  const makeGrip = (w, h, d, y, z, rotX, mat) => {
    const g = createMesh(new THREE.BoxGeometry(w, h, d), mat);
    g.position.set(0, y, z);
    g.rotation.x = rotX;
    mainBody.add(g);
    return g;
  };
  const makeStock = (w, h, d, y, z, mat) => {
    const s = createMesh(new THREE.BoxGeometry(w, h, d), mat);
    s.position.set(0, y, z);
    mainBody.add(s);
    return s;
  };
  const makeMag = (w, h, d, y, z, rotX, mat) => {
    const m = createMesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(0, y, z);
    m.rotation.x = rotX;
    mainBody.add(m);
    return m;
  };
  const makeSight = (y, z) => {
    const sight = createMesh(new THREE.BoxGeometry(0.025, 0.04, 0.05), darkMetal);
    sight.position.set(0, y, z);
    mainBody.add(sight);
    const dot = createMesh(new THREE.CircleGeometry(0.003, 8), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    dot.position.set(0, y+0.01, z-0.026);
    dot.rotation.y = Math.PI;
    mainBody.add(dot);
  };


  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.name = 'muzzlePoint';
  mainBody.add(muzzlePoint);
  
  // generic helper for muzzle
  const setMuzzle = (z) => muzzlePoint.position.set(0, 0.02, z);
  setMuzzle(-0.35); // fallback

  // --- UNIQUE MODELS & COMPLETE WEAPON SET ---
  if (wName.includes('SCAR')) {
    // SCAR-H
    makeReceiver(0.045, 0.08, 0.35, tanMat);
    makeBarrel(0.012, 0.4, -0.35, darkMetal);
    makeGrip(0.025, 0.1, 0.04, -0.08, 0.12, 0.15, polyMat);
    makeStock(0.04, 0.1, 0.2, -0.02, 0.27, tanMat);
    makeMag(0.03, 0.15, 0.07, -0.1, -0.05, 0.05, darkMetal);
    makeSight(0.06, 0);
    const slide = createMesh(new THREE.BoxGeometry(0.01, 0.01, 0.04), lightMetal);
    slide.position.set(0.03, 0.01, 0.05); mainBody.add(slide); game.slideMesh = slide;
    setMuzzle(-0.55);

  } else if (wName.includes('M4') || wName.includes('M16')) {
    // M4 / M16 Tactical AR
    makeReceiver(0.038, 0.08, 0.32, darkMetal);
    makeBarrel(0.011, 0.45, -0.38, darkMetal);
    const handguard = createMesh(new THREE.CylinderGeometry(0.022, 0.022, 0.25, 12), polyMat);
    handguard.rotation.x = Math.PI / 2; handguard.position.set(0, 0, -0.22); mainBody.add(handguard);
    makeGrip(0.025, 0.1, 0.04, -0.08, 0.12, 0.15, polyMat);
    makeStock(0.035, 0.09, 0.25, -0.02, 0.28, polyMat);
    makeMag(0.028, 0.16, 0.06, -0.11, -0.05, 0.1, darkMetal);
    if (wName.includes('M16')) {
      const handle = createMesh(new THREE.BoxGeometry(0.02, 0.04, 0.18), darkMetal);
      handle.position.set(0, 0.06, 0.02); mainBody.add(handle);
    } else {
      makeSight(0.055, -0.02);
    }
    const slide = createMesh(new THREE.BoxGeometry(0.01, 0.01, 0.03), lightMetal);
    slide.position.set(0.025, 0.01, 0.05); mainBody.add(slide); game.slideMesh = slide;
    setMuzzle(-0.6);

  } else if (wName.includes('AK')) {
    // AK-47 / AK117 / AK Dominator
    makeReceiver(0.038, 0.075, 0.3, darkMetal);
    makeBarrel(0.011, 0.42, -0.38, darkMetal);
    const hg = createMesh(new THREE.BoxGeometry(0.032, 0.05, 0.22), woodMat);
    hg.position.set(0, -0.005, -0.22); mainBody.add(hg);
    makeGrip(0.026, 0.1, 0.04, -0.08, 0.12, 0.18, woodMat);
    makeStock(0.036, 0.09, 0.28, -0.02, 0.28, woodMat);
    const mag = createMesh(new THREE.BoxGeometry(0.028, 0.18, 0.07), darkMetal);
    mag.position.set(0, -0.12, -0.04); mag.rotation.x = -0.25; mainBody.add(mag);
    makeSight(0.055, -0.05);
    const slide = createMesh(new THREE.BoxGeometry(0.012, 0.012, 0.04), lightMetal);
    slide.position.set(0.028, 0.015, 0.02); mainBody.add(slide); game.slideMesh = slide;
    setMuzzle(-0.58);

  } else if (wName.includes('GRAU')) {
    makeReceiver(0.035, 0.07, 0.3, polyMat);
    makeBarrel(0.01, 0.3, -0.3, darkMetal);
    const hg = createMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 12), polyMat);
    hg.rotation.x = Math.PI/2; hg.position.set(0, 0, -0.2); mainBody.add(hg);
    makeGrip(0.025, 0.1, 0.04, -0.08, 0.1, 0.15, polyMat);
    makeStock(0.02, 0.1, 0.25, -0.02, 0.25, polyMat);
    makeMag(0.025, 0.15, 0.06, -0.1, -0.05, 0.15, polyMat);
    makeSight(0.055, -0.05);
    setMuzzle(-0.45);

  } else if (wName.includes('KILO')) {
    makeReceiver(0.04, 0.07, 0.3, darkMetal);
    makeBarrel(0.01, 0.35, -0.32, lightMetal);
    const hg = createMesh(new THREE.BoxGeometry(0.03, 0.05, 0.25), darkMetal);
    hg.position.set(0, 0, -0.25); mainBody.add(hg);
    makeGrip(0.025, 0.1, 0.04, -0.08, 0.12, 0.15, polyMat);
    makeStock(0.035, 0.08, 0.2, -0.02, 0.25, polyMat);
    makeMag(0.03, 0.15, 0.06, -0.1, -0.05, 0.05, darkMetal);
    makeSight(0.055, -0.02);
    const slide = createMesh(new THREE.BoxGeometry(0.01, 0.01, 0.03), lightMetal);
    slide.position.set(0.025, 0.01, 0.05); mainBody.add(slide); game.slideMesh = slide;
    setMuzzle(-0.5);

  } else if (wName.includes('TYPE 25')) {
    makeReceiver(0.04, 0.12, 0.35, polyMat);
    makeBarrel(0.01, 0.3, -0.32, darkMetal);
    const hg = createMesh(new THREE.BoxGeometry(0.03, 0.06, 0.2), polyMat);
    hg.position.set(0, -0.03, -0.15); mainBody.add(hg);
    makeGrip(0.025, 0.1, 0.04, -0.1, -0.05, 0.15, polyMat);
    makeMag(0.03, 0.15, 0.06, -0.1, 0.1, 0.1, darkMetal);
    const handle = createMesh(new THREE.BoxGeometry(0.02, 0.04, 0.2), polyMat);
    handle.position.set(0, 0.08, 0); mainBody.add(handle);
    makeSight(0.1, -0.05);
    setMuzzle(-0.48);

  } else if (wName.includes('AS VAL')) {
    makeReceiver(0.035, 0.07, 0.25, darkMetal);
    makeBarrel(0.025, 0.4, -0.3, darkMetal);
    makeGrip(0.025, 0.1, 0.04, -0.08, 0.1, 0.15, polyMat);
    const stock = createMesh(new THREE.CylinderGeometry(0.005, 0.005, 0.25, 8), lightMetal);
    stock.rotation.x = Math.PI/2; stock.position.set(0, 0, 0.25); mainBody.add(stock);
    makeMag(0.03, 0.12, 0.06, -0.1, -0.02, 0.1, polyMat);
    makeSight(0.055, 0);
    setMuzzle(-0.5);

  } else if (wName.includes('M21') || wName.includes('EBR')) {
    makeReceiver(0.04, 0.08, 0.38, darkMetal);
    makeBarrel(0.012, 0.6, -0.48, lightMetal);
    makeGrip(0.028, 0.1, 0.04, -0.08, 0.12, 0.15, polyMat);
    makeStock(0.038, 0.1, 0.28, -0.02, 0.32, polyMat);
    makeMag(0.03, 0.16, 0.06, -0.11, -0.05, 0, darkMetal);
    const scopeGroup = new THREE.Group();
    const tube = createMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 12), darkMetal); tube.rotation.x = Math.PI/2;
    scopeGroup.add(tube); scopeGroup.position.set(0, 0.07, -0.02); mainBody.add(scopeGroup);
    setMuzzle(-0.78);

  // --- SMGs ---
  } else if (wName.includes('VECTOR') || wName.includes('FENNEC')) {
    makeReceiver(0.04, 0.12, 0.25, darkMetal);
    makeBarrel(0.01, 0.2, -0.22, darkMetal);
    makeGrip(0.028, 0.11, 0.04, -0.09, 0.08, 0.15, polyMat);
    makeMag(0.025, 0.16, 0.05, -0.12, 0.02, 0.05, polyMat);
    const foregrip = createMesh(new THREE.BoxGeometry(0.025, 0.08, 0.03), polyMat);
    foregrip.position.set(0, -0.08, -0.12); mainBody.add(foregrip);
    makeSight(0.08, -0.02);
    setMuzzle(-0.32);

  } else if (wName.includes('MP5')) {
    makeReceiver(0.034, 0.065, 0.26, darkMetal);
    makeBarrel(0.01, 0.22, -0.24, darkMetal);
    const hg = createMesh(new THREE.CylinderGeometry(0.022, 0.022, 0.18, 12), polyMat);
    hg.rotation.x = Math.PI/2; hg.position.set(0, -0.005, -0.18); mainBody.add(hg);
    makeGrip(0.026, 0.1, 0.04, -0.08, 0.08, 0.15, polyMat);
    makeStock(0.025, 0.08, 0.22, -0.02, 0.24, polyMat);
    const mag = createMesh(new THREE.BoxGeometry(0.024, 0.16, 0.05), darkMetal);
    mag.position.set(0, -0.11, -0.02); mag.rotation.x = -0.15; mainBody.add(mag);
    makeSight(0.05, -0.05);
    setMuzzle(-0.35);

  } else if (wName.includes('P90') || wName.includes('PDW')) {
    makeReceiver(0.045, 0.11, 0.32, polyMat);
    makeBarrel(0.01, 0.18, -0.25, darkMetal);
    makeGrip(0.028, 0.1, 0.04, -0.08, -0.02, 0.15, polyMat);
    const topMag = createMesh(new THREE.BoxGeometry(0.03, 0.02, 0.22), lightMetal);
    topMag.position.set(0, 0.06, -0.02); mainBody.add(topMag);
    makeSight(0.08, -0.02);
    setMuzzle(-0.34);

  } else if (wName.includes('BIZON')) {
    makeReceiver(0.035, 0.07, 0.25, darkMetal);
    makeBarrel(0.01, 0.25, -0.25, darkMetal);
    const helical = createMesh(new THREE.CylinderGeometry(0.022, 0.022, 0.25, 12), polyMat);
    helical.rotation.x = Math.PI/2; helical.position.set(0, -0.03, -0.15); mainBody.add(helical);
    makeGrip(0.025, 0.1, 0.04, -0.08, 0.1, 0.15, polyMat);
    makeSight(0.055, 0);
    setMuzzle(-0.38);

  } else if (wName.includes('CBR4')) {
    makeReceiver(0.042, 0.12, 0.35, polyMat);
    makeBarrel(0.01, 0.2, -0.25, darkMetal);
    makeGrip(0.025, 0.1, 0.04, -0.08, -0.05, 0.15, polyMat);
    makeSight(0.08, -0.05);
    setMuzzle(-0.35);

  } else if (wName.includes('MAC') || wName.includes('MAC10')) {
    makeReceiver(0.035, 0.1, 0.16, darkMetal);
    makeBarrel(0.01, 0.12, -0.14, lightMetal);
    makeGrip(0.03, 0.1, 0.04, -0.08, 0.02, 0.1, polyMat);
    const strap = createMesh(new THREE.BoxGeometry(0.01, 0.08, 0.02), polyMat);
    strap.position.set(0, -0.08, -0.1); mainBody.add(strap);
    makeSight(0.06, 0);
    setMuzzle(-0.2);

  // --- SNIPERS ---
  } else if (wName.includes('DL-Q33') || wName.includes('DLQ')) {
    const carbonMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.7 });
    const blueLensMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    makeReceiver(0.045, 0.08, 0.4, carbonMat);
    makeBarrel(0.014, 0.85, -0.6, darkMetal);
    const brake = createMesh(new THREE.BoxGeometry(0.035, 0.035, 0.1), darkMetal);
    brake.position.set(0, 0, -1.0); mainBody.add(brake);
    makeStock(0.04, 0.14, 0.3, -0.02, 0.35, carbonMat);
    makeGrip(0.03, 0.12, 0.04, -0.1, 0.1, 0.15, polyMat);
    makeMag(0.035, 0.18, 0.08, -0.12, -0.05, 0.05, carbonMat);
    const scopeGroup = new THREE.Group();
    const tube = createMesh(new THREE.CylinderGeometry(0.022, 0.022, 0.38, 16), darkMetal); tube.rotation.x = Math.PI/2;
    const frontRing = createMesh(new THREE.TorusGeometry(0.03, 0.005, 8, 16), blueLensMat); frontRing.position.set(0, 0, -0.2);
    scopeGroup.add(tube, frontRing); scopeGroup.position.set(0, 0.08, -0.05); mainBody.add(scopeGroup);
    setMuzzle(-1.05);

  } else if (wName.includes('LOCUS')) {
    const carbonMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.8 });
    makeReceiver(0.05, 0.1, 0.45, carbonMat);
    makeBarrel(0.016, 0.8, -0.55, lightMetal);
    makeStock(0.045, 0.12, 0.25, -0.02, 0.35, carbonMat);
    makeMag(0.04, 0.2, 0.09, -0.14, -0.05, 0, darkMetal);
    makeGrip(0.03, 0.12, 0.04, -0.1, 0.12, 0.15, polyMat);
    const scope = createMesh(new THREE.BoxGeometry(0.05, 0.05, 0.35), darkMetal);
    scope.position.set(0, 0.08, -0.05); mainBody.add(scope);
    setMuzzle(-0.95);

  } else if (wName.includes('KAR98K') || wName.includes('KAR98')) {
    makeReceiver(0.038, 0.06, 0.35, darkMetal);
    makeBarrel(0.01, 0.65, -0.45, darkMetal);
    makeStock(0.038, 0.08, 0.5, -0.03, 0.15, woodMat);
    const boltHandle = createMesh(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 8), lightMetal);
    boltHandle.rotation.z = Math.PI/2; boltHandle.position.set(0.035, 0.02, 0.1); mainBody.add(boltHandle);
    game.slideMesh = boltHandle;
    makeSight(0.045, -0.3);
    setMuzzle(-0.8);

  } else if (wName.includes('CROSSBOW') || wName.includes('AERO')) {
    makeReceiver(0.04, 0.08, 0.45, woodMat);
    const bowArm = createMesh(new THREE.BoxGeometry(0.5, 0.025, 0.04), darkMetal);
    bowArm.position.set(0, 0.02, -0.32); mainBody.add(bowArm);
    makeGrip(0.028, 0.1, 0.04, -0.08, 0.1, 0.15, polyMat);
    makeStock(0.038, 0.09, 0.25, -0.02, 0.3, woodMat);
    makeSight(0.06, -0.05);
    const arrow = createMesh(new THREE.CylinderGeometry(0.005, 0.005, 0.35, 8), lightMetal);
    arrow.rotation.x = Math.PI/2; arrow.position.set(0, 0.025, -0.22); mainBody.add(arrow);
    setMuzzle(-0.4);

  } else if (wName.includes('ARCTIC') || wName.includes('HDR')) {
    const arcticMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.7 });
    makeReceiver(0.055, 0.11, 0.5, arcticMat);
    makeBarrel(0.018, 0.9, -0.65, darkMetal);
    const brake = createMesh(new THREE.BoxGeometry(0.05, 0.05, 0.12), darkMetal);
    brake.position.set(0, 0, -1.1); mainBody.add(brake);
    const bipodL = createMesh(new THREE.CylinderGeometry(0.005, 0.005, 0.25, 8), lightMetal);
    bipodL.rotation.x = Math.PI/2; bipodL.position.set(-0.03, -0.04, -0.5); mainBody.add(bipodL);
    const bipodR = createMesh(new THREE.CylinderGeometry(0.005, 0.005, 0.25, 8), lightMetal);
    bipodR.rotation.x = Math.PI/2; bipodR.position.set(0.03, -0.04, -0.5); mainBody.add(bipodR);
    makeStock(0.05, 0.14, 0.3, -0.02, 0.4, arcticMat);
    makeMag(0.04, 0.22, 0.1, -0.15, -0.05, 0, darkMetal);
    const thermal = createMesh(new THREE.BoxGeometry(0.06, 0.06, 0.4), darkMetal);
    thermal.position.set(0, 0.09, -0.05); mainBody.add(thermal);
    setMuzzle(-1.15);

  // --- SHOTGUNS ---
  } else if (wName.includes('STRIKER')) {
    makeReceiver(0.04, 0.08, 0.25, darkMetal);
    makeBarrel(0.016, 0.35, -0.25, darkMetal);
    const drum = createMesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 16), darkMetal);
    drum.position.set(0, -0.07, -0.1); mainBody.add(drum);
    makeGrip(0.03, 0.1, 0.04, -0.08, 0.1, 0.15, polyMat);
    setMuzzle(-0.45);

  } else if (wName.includes('KRM') || wName.includes('BY15')) {
    makeReceiver(0.038, 0.08, 0.28, darkMetal);
    makeBarrel(0.016, 0.5, -0.38, lightMetal);
    const shield = createMesh(new THREE.CylinderGeometry(0.022, 0.022, 0.25, 12, 1, false, 0, Math.PI), darkMetal);
    shield.rotation.z = Math.PI/2; shield.position.set(0, 0.02, -0.3); mainBody.add(shield);
    const tube = createMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 12), darkMetal);
    tube.rotation.x = Math.PI/2; tube.position.set(0, -0.018, -0.35); mainBody.add(tube);
    const pump = createMesh(new THREE.CylinderGeometry(0.024, 0.024, 0.16, 12), polyMat);
    pump.rotation.x = Math.PI/2; pump.position.set(0, -0.018, -0.3); mainBody.add(pump);
    game.slideMesh = pump;
    const saddle = createMesh(new THREE.BoxGeometry(0.01, 0.03, 0.12), polyMat); saddle.position.set(-0.022, 0, 0.02); mainBody.add(saddle);
    const redShell = createMesh(new THREE.CylinderGeometry(0.007, 0.007, 0.04, 8), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
    redShell.rotation.x = Math.PI/2; redShell.position.set(-0.026, 0.01, 0.02); mainBody.add(redShell);
    makeGrip(0.03, 0.1, 0.04, -0.08, 0.1, 0.15, polyMat);
    makeStock(0.035, 0.09, 0.22, -0.03, 0.24, polyMat);
    setMuzzle(-0.65);

  } else if (wName.includes('ORIGIN') || wName.includes('ECHO')) {
    makeReceiver(0.05, 0.11, 0.35, darkMetal);
    makeBarrel(0.018, 0.4, -0.35, darkMetal);
    const hg = createMesh(new THREE.BoxGeometry(0.045, 0.06, 0.22), polyMat);
    hg.position.set(0, 0, -0.22); mainBody.add(hg);
    makeGrip(0.03, 0.1, 0.04, -0.09, 0.12, 0.15, polyMat);
    makeStock(0.04, 0.1, 0.2, -0.02, 0.28, polyMat);
    const mag = createMesh(new THREE.BoxGeometry(0.035, 0.2, 0.08), darkMetal);
    mag.position.set(0, -0.15, -0.05); mag.rotation.x = 0.15; mainBody.add(mag);
    makeSight(0.07, -0.05);
    setMuzzle(-0.58);

  } else if (wName.includes('HS0405') || wName.includes('LEVER')) {
    makeReceiver(0.035, 0.07, 0.25, lightMetal);
    makeBarrel(0.014, 0.55, -0.4, lightMetal);
    makeStock(0.035, 0.08, 0.3, -0.03, 0.25, woodMat);
    const lever = createMesh(new THREE.TorusGeometry(0.025, 0.005, 8, 12), lightMetal);
    lever.position.set(0, -0.09, 0.08); mainBody.add(lever);
    setMuzzle(-0.7);

  // --- SECONDARIES & PISTOLS ---
  } else if (wName.includes('DESERT') || wName.includes('EAGLE') || wName.includes('GS50')) {
    makeReceiver(0.038, 0.06, 0.2, lightMetal);
    const slide = createMesh(new THREE.BoxGeometry(0.042, 0.05, 0.24), lightMetal);
    slide.position.set(0, 0.05, -0.02); mainBody.add(slide); game.slideMesh = slide;
    makeGrip(0.038, 0.12, 0.06, -0.08, 0.06, 0.15, polyMat);
    makeBarrel(0.014, 0.25, -0.03, lightMetal);
    mainBody.position.set(0.18, -0.22, -0.48);
    setMuzzle(-0.18);

  } else if (wName.includes('REVOLVER') || wName.includes('J358')) {
    makeReceiver(0.032, 0.05, 0.15, darkMetal);
    const cylinder = createMesh(new THREE.CylinderGeometry(0.025, 0.025, 0.06, 12), lightMetal);
    cylinder.rotation.x = Math.PI/2; cylinder.position.set(0, 0.02, 0.01); mainBody.add(cylinder);
    const barrel = createMesh(new THREE.BoxGeometry(0.022, 0.03, 0.18), darkMetal);
    barrel.position.set(0, 0.03, -0.11); mainBody.add(barrel);
    const hammer = createMesh(new THREE.BoxGeometry(0.01, 0.02, 0.015), lightMetal);
    hammer.position.set(0, 0.05, 0.07); mainBody.add(hammer);
    makeGrip(0.032, 0.12, 0.05, -0.08, 0.07, 0.2, woodMat);
    mainBody.position.set(0.18, -0.22, -0.45);
    setMuzzle(-0.2);

  } else if (wName.includes('RENETTI')) {
    makeReceiver(0.032, 0.05, 0.18, darkMetal);
    const slide = createMesh(new THREE.BoxGeometry(0.035, 0.045, 0.2), darkMetal);
    slide.position.set(0, 0.045, -0.01); mainBody.add(slide); game.slideMesh = slide;
    const comp = createMesh(new THREE.BoxGeometry(0.036, 0.046, 0.05), lightMetal);
    comp.position.set(0, 0.045, -0.13); mainBody.add(comp);
    makeGrip(0.034, 0.14, 0.05, -0.09, 0.06, 0.15, polyMat);
    const sight = createMesh(new THREE.BoxGeometry(0.02, 0.025, 0.03), darkMetal);
    sight.position.set(0, 0.08, 0.02); mainBody.add(sight);
    mainBody.position.set(0.18, -0.22, -0.48);
    setMuzzle(-0.16);

  } else if (wName.includes('MW11')) {
    makeReceiver(0.03, 0.05, 0.18, darkMetal);
    const slide = createMesh(new THREE.BoxGeometry(0.034, 0.04, 0.21), lightMetal);
    slide.position.set(0, 0.045, -0.02); mainBody.add(slide); game.slideMesh = slide;
    makeGrip(0.032, 0.11, 0.05, -0.07, 0.06, 0.15, polyMat);
    makeBarrel(0.01, 0.22, -0.02, darkMetal);
    mainBody.position.set(0.18, -0.22, -0.48);
    setMuzzle(-0.15);

  } else if (wName.includes('RPD') || wName.includes('CHOPPER') || wName.includes('PKM') || wName.includes('HOLGER')) {
    makeReceiver(0.05, 0.1, 0.38, darkMetal);
    makeBarrel(0.015, 0.55, -0.42, darkMetal);
    const hg = createMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), darkMetal);
    hg.rotation.x = Math.PI / 2; hg.position.set(0, 0.02, -0.3); mainBody.add(hg);
    const drum = createMesh(new THREE.BoxGeometry(0.12, 0.12, 0.1), darkMetal);
    drum.position.set(0, -0.1, 0); mainBody.add(drum);
    makeStock(0.04, 0.12, 0.25, -0.02, 0.3, polyMat);
    makeGrip(0.03, 0.1, 0.04, -0.1, 0.15, 0.1, polyMat);
    makeSight(0.06, 0);
    setMuzzle(-0.7);

  // --- TYPE FALLBACKS ---
  } else if ((wep.type as string) === 'SHOTGUN') {
    makeReceiver(0.035, 0.08, 0.25, darkMetal);
    makeBarrel(0.015, 0.5, -0.35, darkMetal);
    const tube = createMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 16), darkMetal);
    tube.rotation.x = Math.PI / 2; tube.position.set(0, -0.015, -0.32); mainBody.add(tube);
    const pump = createMesh(new THREE.CylinderGeometry(0.022, 0.022, 0.15, 16), polyMat);
    pump.rotation.x = Math.PI / 2; pump.position.set(0, -0.015, -0.3); mainBody.add(pump);
    game.slideMesh = pump;
    makeGrip(0.03, 0.1, 0.04, -0.08, 0.1, 0.2, polyMat);
    makeStock(0.035, 0.08, 0.2, -0.04, 0.22, polyMat);
    setMuzzle(-0.6);

  } else if ((wep.type as string) === 'LMG') {
    makeReceiver(0.05, 0.1, 0.35, darkMetal);
    makeBarrel(0.015, 0.5, -0.4, darkMetal);
    const hg = createMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), darkMetal);
    hg.rotation.x = Math.PI / 2; hg.position.set(0, 0.02, -0.3); mainBody.add(hg);
    const drum = createMesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 24), darkMetal);
    drum.rotation.z = Math.PI / 2; drum.position.set(0, -0.1, 0); mainBody.add(drum);
    makeStock(0.04, 0.12, 0.25, -0.02, 0.3, polyMat);
    makeGrip(0.03, 0.1, 0.04, -0.1, 0.15, 0.1, polyMat);
    makeSight(0.06, 0);
    setMuzzle(-0.65);

  } else if ((wep.type as string) === 'PISTOL') {
    makeReceiver(0.03, 0.05, 0.18, darkMetal);
    const slide = createMesh(new THREE.BoxGeometry(0.035, 0.04, 0.22), lightMetal);
    slide.position.set(0, 0.045, -0.02); mainBody.add(slide); game.slideMesh = slide;
    makeGrip(0.035, 0.11, 0.05, -0.07, 0.06, 0.15, polyMat);
    makeBarrel(0.01, 0.23, -0.02, darkMetal);
    mainBody.position.set(0.18, -0.22, -0.5);
    setMuzzle(-0.15);

  } else if ((wep.type as string) === 'SNIPER') {
    makeReceiver(0.042, 0.08, 0.38, darkMetal);
    makeBarrel(0.012, 0.7, -0.5, lightMetal);
    makeGrip(0.028, 0.1, 0.04, -0.08, 0.12, 0.15, polyMat);
    makeStock(0.038, 0.1, 0.28, -0.02, 0.32, polyMat);
    makeMag(0.03, 0.16, 0.06, -0.11, -0.05, 0, darkMetal);
    const scopeGroup = new THREE.Group();
    const tube = createMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 12), darkMetal); tube.rotation.x = Math.PI/2;
    scopeGroup.add(tube); scopeGroup.position.set(0, 0.07, -0.02); mainBody.add(scopeGroup);
    setMuzzle(-0.85);

  } else if ((wep.type as string) === 'SMG') {
    makeReceiver(0.035, 0.07, 0.26, darkMetal);
    makeBarrel(0.01, 0.22, -0.24, darkMetal);
    makeGrip(0.026, 0.1, 0.04, -0.08, 0.08, 0.15, polyMat);
    makeStock(0.025, 0.08, 0.22, -0.02, 0.24, polyMat);
    makeMag(0.025, 0.15, 0.05, -0.11, -0.02, 0.05, darkMetal);
    makeSight(0.055, -0.02);
    setMuzzle(-0.35);

  } else if (wep.type === 'KNIFE') {
    const handle = createMesh(new THREE.CylinderGeometry(0.015, 0.018, 0.15, 12), darkMetal);
    handle.rotation.x = Math.PI / 2; handle.position.set(0, -0.02, 0.1); mainBody.add(handle);
    const guard = createMesh(new THREE.BoxGeometry(0.04, 0.01, 0.01), lightMetal);
    guard.position.set(0, -0.015, 0.02); mainBody.add(guard);
    const blade = createMesh(new THREE.BoxGeometry(0.005, 0.03, 0.25), lightMetal);
    blade.position.set(0, -0.01, -0.11); mainBody.add(blade);
    const slashGeo = new THREE.PlaneGeometry(1.2, 1.2);
    const slashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const slashMesh = new THREE.Mesh(slashGeo, slashMat);
    slashMesh.position.set(0, 0, -0.8); slashMesh.rotation.x = Math.PI / 2; mainBody.add(slashMesh);
    game.slashMesh = slashMesh;

  } else if (wep.type === 'LAUNCHER') {
    const oliveMat = new THREE.MeshStandardMaterial({ color: 0x3f4e30, roughness: 0.6, metalness: 0.4 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5, metalness: 0.3 });
    const tube = createMesh(new THREE.CylinderGeometry(0.045, 0.05, 1.0, 16), oliveMat);
    tube.rotation.x = Math.PI / 2; mainBody.add(tube);
    const warheadCone = createMesh(new THREE.ConeGeometry(0.08, 0.3, 16), redMat);
    warheadCone.rotation.x = -Math.PI / 2; warheadCone.position.set(0, 0, -0.6); mainBody.add(warheadCone);
    for (let i = 0; i < 4; i++) {
      const fin = createMesh(new THREE.BoxGeometry(0.01, 0.08, 0.12), oliveMat);
      fin.rotation.y = (Math.PI / 2) * i; fin.position.set(0, 0, -0.5); mainBody.add(fin);
    }
    const scope = createMesh(new THREE.BoxGeometry(0.03, 0.06, 0.15), darkMetal);
    scope.position.set(0.04, 0.06, 0.1); mainBody.add(scope);
    makeGrip(0.03, 0.12, 0.04, -0.08, 0.1, 0.2, polyMat);
    makeGrip(0.03, 0.1, 0.04, -0.07, -0.2, -0.2, polyMat);

  } else {
    // Ultimate fallback for any unhandled weapon
    makeReceiver(0.038, 0.08, 0.32, darkMetal);
    makeBarrel(0.011, 0.45, -0.38, darkMetal);
    makeGrip(0.025, 0.1, 0.04, -0.08, 0.12, 0.15, polyMat);
    makeStock(0.035, 0.09, 0.25, -0.02, 0.28, polyMat);
    makeMag(0.028, 0.16, 0.06, -0.11, -0.05, 0.1, darkMetal);
    makeSight(0.055, -0.02);
    setMuzzle(-0.6);
  }

  // --- ARMS & HANDS (Common for all) ---
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9, bumpScale: 0.02 });
  const sleeveMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(playerClass.color).multiplyScalar(0.5), roughness: 0.9 });

  const leftHandGroup = new THREE.Group();
  const leftPalm = createMesh(new THREE.BoxGeometry(0.04, 0.04, 0.05), gloveMat);
  leftHandGroup.add(leftPalm);
  
  const fingersL = createMesh(new THREE.BoxGeometry(0.045, 0.02, 0.04), gloveMat);
  fingersL.position.set(0.01, -0.02, 0);
  fingersL.rotation.z = 0.5;
  leftHandGroup.add(fingersL);

  if (wep.type === 'PISTOL') {
    leftHandGroup.position.set(-0.02, -0.05, 0.1);
    leftHandGroup.rotation.set(0, 0.5, -0.2);
  } else if (wep.type === 'SHOTGUN') {
    // Pump is rotated by PI/2 on X, so local Y is world -Z, local Z is world Y
    leftHandGroup.position.set(-0.04, 0, 0.04);
    leftHandGroup.rotation.set(-1.0, 0, 0);
    if (game.slideMesh) game.slideMesh.add(leftHandGroup);
  } else if (wep.type === 'LAUNCHER') {
    leftHandGroup.position.set(-0.04, -0.05, -0.15);
    leftHandGroup.rotation.set(0.2, 0.2, -0.4);
  } else if (wName.includes('VECTOR') || wName.includes('TYPE 25') || wName.includes('P90')) {
    leftHandGroup.position.set(-0.04, -0.1, -0.05);
    leftHandGroup.rotation.set(0.2, 0.4, -0.8);
  } else {
    leftHandGroup.position.set(-0.04, -0.02, -0.2);
    leftHandGroup.rotation.set(0.2, 0.4, -0.8);
  }
  
  if (wep.type !== 'SHOTGUN') mainBody.add(leftHandGroup);

  const leftArm = createMesh(new THREE.CylinderGeometry(0.03, 0.035, 0.25, 8), sleeveMat);
  leftArm.position.set(-0.11, -0.12, -0.05);
  leftArm.rotation.set(1.2, 0, -0.5);
  mainBody.add(leftArm);

  const rightHandGroup = new THREE.Group();
  const rightPalm = createMesh(new THREE.BoxGeometry(0.04, 0.05, 0.04), gloveMat);
  rightHandGroup.add(rightPalm);
  
  const rightFinger = createMesh(new THREE.BoxGeometry(0.01, 0.01, 0.04), gloveMat);
  rightFinger.position.set(0, 0.02, -0.03);
  rightHandGroup.add(rightFinger);

  if (wep.type === 'LAUNCHER') {
    rightHandGroup.position.set(0.02, -0.08, 0.1);
  } else {
    rightHandGroup.position.set(0.02, -0.08, 0.15);
  }
  rightHandGroup.rotation.set(0.2, -0.2, 0.1);
  mainBody.add(rightHandGroup);

  const rightArm = createMesh(new THREE.CylinderGeometry(0.03, 0.035, 0.3, 8), sleeveMat);
  rightArm.position.set(0.08, -0.18, 0.25);
  rightArm.rotation.set(1.0, 0, 0.3);
  mainBody.add(rightArm);
};

export const buildThirdPersonWeapon = (weaponIdOrName: string): THREE.Group => {
  const group = new THREE.Group();
  const w = (weaponIdOrName || '').toUpperCase();

  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
  const lightMetal = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
  const tanMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.7 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 });

  if (w.includes('SNIPER') || w.includes('DLQ') || w.includes('BARRETT')) {
    // Sniper Rifle: Long barrel, large scope (unless hunting rifle), cheek stock, box mag
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.7), darkMetal);
    group.add(body);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 8), lightMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.7);
    group.add(barrel);

    if (!w.includes('HUNTING')) {
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.35, 12), darkMetal);
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0, 0.14, 0.1);
      group.add(scope);
    }

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.12), darkMetal);
    mag.position.set(0, -0.15, 0.1);
    group.add(mag);
  } else if (w.includes('KNIFE')) {
    // Combat Knife
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 8), darkMetal);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0, 0, 0.05);
    group.add(handle);

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.05, 0.3), lightMetal);
    blade.position.set(0, 0, 0.25);
    group.add(blade);
  } else if (w.includes('CROSSBOW')) {
    // Crossbow
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.7), woodMat);
    group.add(stock);

    const bowArm = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.08), darkMetal);
    bowArm.position.set(0, 0, 0.3);
    group.add(bowArm);
  } else if (w.includes('LMG')) {
    // Heavy LMG
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.75), darkMetal);
    group.add(body);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 8), lightMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.6);
    group.add(barrel);

    const boxMag = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.18), darkMetal);
    boxMag.position.set(0, -0.18, 0.1);
    group.add(boxMag);
  } else if (w.includes('UZI') || w.includes('MP5') || w.includes('SMG')) {
    // Compact SMG
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.45), darkMetal);
    group.add(body);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), lightMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.01, 0.32);
    group.add(barrel);

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.06), darkMetal);
    mag.position.set(0, -0.14, 0.1);
    group.add(mag);
  } else if (w.includes('SHOTGUN') || w.includes('BY15')) {
    // Shotgun
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.14, 0.75), darkMetal);
    group.add(body);

    const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8), woodMat);
    pump.rotation.x = Math.PI / 2;
    pump.position.set(0, -0.02, 0.35);
    group.add(pump);
  } else if (w.includes('DESERT') || w.includes('EAGLE') || w.includes('PISTOL')) {
    // Pistol / Desert Eagle
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.3), lightMetal);
    group.add(body);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.08), darkMetal);
    grip.position.set(0, -0.12, -0.05);
    grip.rotation.x = 0.2;
    group.add(grip);
  } else {
    // Standard Assault Rifle (M4 / SCAR / AK47)
    const receiverMat = w.includes('SCAR') ? tanMat : (w.includes('AK') ? woodMat : darkMetal);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.65), receiverMat);
    group.add(body);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 8), lightMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.5);
    group.add(barrel);

    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.1), darkMetal);
    mag.position.set(0, -0.14, 0.1);
    mag.rotation.x = 0.2;
    group.add(mag);
  }

  group.traverse(child => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return group;
};
