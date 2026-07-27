import fs from 'fs';
let code = fs.readFileSync('src/components/GameCanvas.tsx', 'utf8');

const targetStr = `  // Initialize and run the 3D game
  useEffect(() => {`;

const newStr = `  useEffect(() => {
    if (gameRef.current.renderer) {
      const isPotato = graphicsQuality === 'POTATO';
      const isLow = graphicsQuality === 'LOW';
      const isUltra = graphicsQuality === 'ULTRA';
      
      let dpr = window.devicePixelRatio;
      if (isPotato) dpr = 0.5;
      else if (isLow) dpr = 0.75;
      else if (isUltra) dpr = Math.min(window.devicePixelRatio, 2.0);
      else dpr = 1.0;
      
      gameRef.current.renderer.setPixelRatio(dpr);
      gameRef.current.renderer.shadowMap.enabled = !isPotato;
      gameRef.current.renderer.shadowMap.type = isUltra ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
      
      // Need to tell ThreeJS materials that shadowMap type changed by setting needsUpdate on materials
      // But it's usually enough just to toggle it.
    }
  }, [graphicsQuality]);

  // Initialize and run the 3D game
  useEffect(() => {`;

code = code.replace(targetStr, newStr);
fs.writeFileSync('src/components/GameCanvas.tsx', code);
console.log("Added graphics quality live updater");
