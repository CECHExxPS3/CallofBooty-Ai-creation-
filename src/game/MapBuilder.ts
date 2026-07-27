import * as THREE from 'three';

export interface CollidableBox {
  box: THREE.Box3;
  mesh: THREE.Mesh;
  type: 'wall' | 'crate' | 'ramp' | 'floor';
}

export interface MapData {
  spawnPoints: THREE.Vector3[];
  colliders: CollidableBox[];
  ambientColor: string;
  directionalColor: string;
  fogColor: string;
  fogDensity: number;
}

export function buildMap(scene: THREE.Scene, mapId: 'shipment' | 'rust' | 'dust2' | 'nuketown'): MapData {
  const colliders: CollidableBox[] = [];
  const spawnPoints: THREE.Vector3[] = [];

  // Helper to create a solid collidable crate/wall box
  const createCrate = (
    pos: [number, number, number],
    size: [number, number, number],
    color: number,
    rotY = 0,
    type: 'wall' | 'crate' | 'ramp' = 'crate'
  ) => {
    const geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.8,
      metalness: 0.2,
      flatShading: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...pos);
    mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const box = new THREE.Box3().setFromObject(mesh);
    colliders.push({ box, mesh, type });
    return mesh;
  };

  // Helper to create a walk-through hollow container (open on front/back ends)
  const createOpenContainer = (
    pos: [number, number, number],
    size: [number, number, number], // [width, height, length] along Z
    color: number,
    rotY = 0
  ) => {
    const [w, h, l] = size;
    const wallThick = 0.3;
    const group = new THREE.Group();
    group.position.set(...pos);
    group.rotation.y = rotY;

    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.7,
      metalness: 0.3,
      flatShading: true,
      side: THREE.DoubleSide
    });

    // Left Wall
    const leftMesh = new THREE.Mesh(new THREE.BoxGeometry(wallThick, h, l), mat);
    leftMesh.position.set(-w / 2 + wallThick / 2, 0, 0);
    leftMesh.castShadow = true;
    leftMesh.receiveShadow = true;
    group.add(leftMesh);

    // Right Wall
    const rightMesh = new THREE.Mesh(new THREE.BoxGeometry(wallThick, h, l), mat);
    rightMesh.position.set(w / 2 - wallThick / 2, 0, 0);
    rightMesh.castShadow = true;
    rightMesh.receiveShadow = true;
    group.add(rightMesh);

    // Roof
    const roofMesh = new THREE.Mesh(new THREE.BoxGeometry(w, wallThick, l), mat);
    roofMesh.position.set(0, h / 2 - wallThick / 2, 0);
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    group.add(roofMesh);

    scene.add(group);

    // Add colliders for left wall, right wall, and roof
    colliders.push(
      { box: new THREE.Box3().setFromObject(leftMesh), mesh: leftMesh, type: 'crate' },
      { box: new THREE.Box3().setFromObject(rightMesh), mesh: rightMesh, type: 'crate' },
      { box: new THREE.Box3().setFromObject(roofMesh), mesh: roofMesh, type: 'crate' }
    );

    return group;
  };

  // Setup sky & map-specific lighting/fog defaults
  let ambientColor = '#ffffff';
  let directionalColor = '#ffffff';
  let fogColor = '#1e1b4b';
  let fogDensity = 0.012;

  if (mapId === 'nuketown') {
    ambientColor = '#fef08a'; // Bright suburban sunshine
    directionalColor = '#ffffff';
    fogColor = '#fde047'; // Warm nuclear test haze
    fogDensity = 0.006;

    const floorWidth = 140;
    const floorDepth = 120;
    
    // Main asphalt road floor
    const roadGeo = new THREE.PlaneGeometry(floorWidth, floorDepth);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.receiveShadow = true;
    scene.add(road);

    // Green grass yards on West and East sides
    const yardGeo = new THREE.PlaneGeometry(45, 100);
    const yardMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.9 });
    const yardW = new THREE.Mesh(yardGeo, yardMat);
    yardW.position.set(-42, 0.05, 0);
    yardW.rotation.x = -Math.PI / 2;
    yardW.receiveShadow = true;
    scene.add(yardW);

    const yardE = new THREE.Mesh(yardGeo, yardMat);
    yardE.position.set(42, 0.05, 0);
    yardE.rotation.x = -Math.PI / 2;
    yardE.receiveShadow = true;
    scene.add(yardE);

    // Perimeter Suburban Fence/Walls
    const wallHeight = 10;
    const wallColor = 0xe2e8f0;
    createCrate([0, wallHeight / 2, -55], [140, wallHeight, 2], wallColor, 0, 'wall'); // N
    createCrate([0, wallHeight / 2, 55], [140, wallHeight, 2], wallColor, 0, 'wall');  // S
    createCrate([-68, wallHeight / 2, 0], [2, wallHeight, 110], wallColor, 0, 'wall'); // W
    createCrate([68, wallHeight / 2, 0], [2, wallHeight, 110], wallColor, 0, 'wall');  // E

    // Helper for hollow Nuketown houses
    const buildNuketownHouse = (x: number, color1: number, color2: number, sign: number) => {
      const w = 22, h = 8, d = 28, t = 1.5;
      
      // Ground floor walls
      createCrate([x + sign * (w/2), h/2, 0], [t, h, d], color1);
      createCrate([x - sign * (w/2), h/2, 9], [t, h, 10], color1);
      createCrate([x - sign * (w/2), h/2, -10], [t, h, 8], color1);
      createCrate([x - sign * (w/2), h - 1.5, 0], [t, 3, d], color1);
      
      // Side walls
      createCrate([x, h/2, d/2], [w, h, t], color1);
      createCrate([x, h/2, -d/2], [w, h, t], color1);
      
      // 2nd floor floor
      createCrate([x, h + 0.5, 9], [w, 1, 10], color2);
      createCrate([x, h + 0.5, -9], [w, 1, 10], color2);
      createCrate([x + sign * 7.5, h + 0.5, 0], [5, 1, 8], color2);
      createCrate([x - sign * 7.5, h + 0.5, 0], [5, 1, 8], color2);

      // 2nd floor walls
      createCrate([x + sign * (w/2 - 1), h + 4, 0], [t, 6, d - 2], color2);
      createCrate([x - sign * (w/2 - 1), h + 4, 8], [t, 6, 10], color2);
      createCrate([x - sign * (w/2 - 1), h + 4, -8], [t, 6, 10], color2);
      createCrate([x - sign * (w/2 - 1), h + 6.5, 0], [t, 1, d], color2);
      
      createCrate([x, h + 4, d/2 - 1], [w, 6, t], color2);
      createCrate([x, h + 4, -d/2 + 1], [w, 6, t], color2);
      
      // Roof
      createCrate([x, h + 7.5, 0], [w + 2, 1, d + 2], 0x334155);

      // Stairs
      const numSteps = 16;
      const stepWidth = 8;
      const stepHeight = (h + 1) / numSteps;
      const stepDepth = 10 / numSteps;
      for (let i = 0; i < numSteps; i++) {
        const stepX = (x + sign * 5) - (sign * (i * stepDepth));
        const stepY = i * stepHeight + (stepHeight / 2);
        createCrate([stepX, stepY, 0], [stepDepth, stepHeight, stepWidth], 0x475569);
      }

      // Balcony
      createCrate([x - sign * 13, h - 0.5, 0], [6, 1, 14], 0x854d0e);
      createCrate([x - sign * 16, h + 0.5, 0], [0.5, 1.5, 14], 0x451a03);
      createCrate([x - sign * 13.25, h + 0.5, 7], [6, 1.5, 0.5], 0x451a03);
      createCrate([x - sign * 13.25, h + 0.5, -7], [6, 1.5, 0.5], 0x451a03);

      // Garage
      createCrate([x, 3, -20], [18, 6, 12], color1);
    };

    // West House (Green) & East House (Yellow)
    buildNuketownHouse(-40, 0x166534, 0x15803d, -1);
    buildNuketownHouse(40, 0xca8a04, 0xeab308, 1);

    // School Bus & Delivery Truck
    createCrate([-6, 3.5, -8], [7, 6, 22], 0xef4444, 0.15);
    createCrate([8, 4, 12], [8, 7, 24], 0xf8fafc, -0.1);
    createCrate([8, 3, 26], [7, 5, 6], 0x0284c7, -0.1);

    // Welcome Billboard
    createCrate([0, 12, -42], [24, 8, 1.5], 0xf59e0b);
    createCrate([-10, 4, -42], [1.5, 8, 1.5], 0x334155);
    createCrate([10, 4, -42], [1.5, 8, 1.5], 0x334155);

    // Cars & Sandbags
    createCrate([-22, 1.5, 25], [5, 3, 10], 0x2563eb, 0.2);
    createCrate([22, 1.5, -25], [5, 3, 10], 0xdc2626, -0.2);
    createCrate([0, 1.5, 0], [6, 3, 2], 0xb45309);
    createCrate([-16, 1.5, -30], [8, 3, 2], 0x475569);
    createCrate([16, 1.5, 30], [8, 3, 2], 0x475569);

    // 16+ Nuketown Spawns
    spawnPoints.push(
      new THREE.Vector3(-27, 8, 0),    // Green Balcony
      new THREE.Vector3(27, 8, 0),     // Yellow Balcony
      new THREE.Vector3(-45, 1.5, 35),  // Green Backyard
      new THREE.Vector3(45, 1.5, 35),   // Yellow Backyard
      new THREE.Vector3(-40, 1.5, -22), // Green Garage
      new THREE.Vector3(40, 1.5, -22),  // Yellow Garage
      new THREE.Vector3(-15, 1.5, -35), // Billboard West
      new THREE.Vector3(15, 1.5, -35),  // Billboard East
      new THREE.Vector3(-5, 1.5, 25),   // Cul-de-sac South W
      new THREE.Vector3(5, 1.5, 25),    // Cul-de-sac South E
      new THREE.Vector3(-40, 1.5, 10),  // Green Living Room
      new THREE.Vector3(40, 1.5, 10),   // Yellow Living Room
      new THREE.Vector3(-18, 1.5, -8),  // Bus Flank West
      new THREE.Vector3(18, 1.5, 8),    // Truck Flank East
      new THREE.Vector3(-30, 1.5, -35), // Green Alley North
      new THREE.Vector3(30, 1.5, -35)   // Yellow Alley North
    );

  } else if (mapId === 'shipment') {
    ambientColor = '#94a3b8'; // Dockyard twilight
    directionalColor = '#cbd5e1';
    fogColor = '#0f172a';
    fogDensity = 0.010;

    // Shipment Map Floor (80x80)
    const floorGeo = new THREE.PlaneGeometry(80, 80);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Perimeter Dockyard Concrete Walls
    const wallHeight = 12;
    const wallColor = 0x1e293b;
    createCrate([0, wallHeight / 2, -40], [80, wallHeight, 2], wallColor, 0, 'wall'); // North
    createCrate([0, wallHeight / 2, 40], [80, wallHeight, 2], wallColor, 0, 'wall');  // South
    createCrate([-40, wallHeight / 2, 0], [2, wallHeight, 80], wallColor, 0, 'wall'); // West
    createCrate([40, wallHeight / 2, 0], [2, wallHeight, 80], wallColor, 0, 'wall');  // East

    // --- CENTER CLUSTER (WALK-THROUGH OPEN CONTAINERS) ---
    // North-South Center Tunnel (Blue)
    createOpenContainer([0, 3, 0], [6, 6, 18], 0x2563eb, 0);
    
    // West-East Center Tunnel (Orange)
    createOpenContainer([0, 3, 0], [6, 6, 18], 0xd97706, Math.PI / 2);

    // Stacked Container on top of Center Cross (Red)
    createCrate([0, 9, 0], [6, 6, 16], 0xdc2626, 0.1);

    // --- CORNER & SECTOR CONTAINERS ---
    // North-West Cluster
    createOpenContainer([-20, 3, -20], [6, 6, 16], 0x16a34a, Math.PI / 4); // Green open container
    createCrate([-22, 9, -20], [6, 6, 14], 0x4f46e5, Math.PI / 4 + 0.1);  // Stacked purple container
    createCrate([-32, 3, -32], [10, 6, 10], 0x475569);                   // NW Storage vault

    // North-East Cluster
    createOpenContainer([20, 3, -20], [6, 6, 16], 0x2563eb, -Math.PI / 4); // Blue open container
    createCrate([22, 9, -20], [6, 6, 14], 0xd97706, -Math.PI / 4 - 0.1);  // Stacked orange container
    createCrate([32, 3, -32], [10, 6, 10], 0x475569);                    // NE Storage vault

    // South-West Cluster
    createOpenContainer([-20, 3, 20], [6, 6, 16], 0xd97706, -Math.PI / 4); // Orange open container
    createCrate([-22, 9, 20], [6, 6, 14], 0x16a34a, -Math.PI / 4 + 0.1);   // Stacked green container
    createCrate([-32, 3, 32], [10, 6, 10], 0x475569);                    // SW Storage vault

    // South-East Cluster
    createOpenContainer([20, 3, 20], [6, 6, 16], 0xdc2626, Math.PI / 4);  // Red open container
    createCrate([22, 9, 20], [6, 6, 14], 0x2563eb, Math.PI / 4 - 0.1);    // Stacked blue container
    createCrate([32, 3, 32], [10, 6, 10], 0x475569);                     // SE Storage vault

    // --- COVER & OBSTACLES (Forklifts, Wooden Crates, Sandbag Bunkers, Barrels) ---
    // Wooden Crate stacks
    createCrate([-12, 1.5, 12], [3, 3, 3], 0x78350f);
    createCrate([-12, 4.5, 12], [2.5, 2.5, 2.5], 0xb45309);
    createCrate([12, 1.5, -12], [3, 3, 3], 0x78350f);
    createCrate([12, 4.5, -12], [2.5, 2.5, 2.5], 0xb45309);

    // Sandbag barricades
    createCrate([0, 1.2, -26], [10, 2.4, 2], 0xb45309);
    createCrate([0, 1.2, 26], [10, 2.4, 2], 0xb45309);
    createCrate([-26, 1.2, 0], [2, 2.4, 10], 0xb45309);
    createCrate([26, 1.2, 0], [2, 2.4, 10], 0xb45309);

    // Forklift mock obstacles
    createCrate([-14, 2, -5], [4, 4, 6], 0xf59e0b, 0.2);
    createCrate([14, 2, 5], [4, 4, 6], 0xf59e0b, -0.2);

    // 18 Safe Spawn Points across Shipment
    spawnPoints.push(
      new THREE.Vector3(-28, 1.5, -28), // NW Corner
      new THREE.Vector3(28, 1.5, -28),  // NE Corner
      new THREE.Vector3(-28, 1.5, 28),   // SW Corner
      new THREE.Vector3(28, 1.5, 28),    // SE Corner
      new THREE.Vector3(0, 1.5, -32),    // North Alley
      new THREE.Vector3(0, 1.5, 32),     // South Alley
      new THREE.Vector3(-32, 1.5, 0),    // West Alley
      new THREE.Vector3(32, 1.5, 0),     // East Alley
      new THREE.Vector3(0, 1.5, -8),     // Inside North Container
      new THREE.Vector3(0, 1.5, 8),      // Inside South Container
      new THREE.Vector3(-8, 1.5, 0),     // Inside West Container
      new THREE.Vector3(8, 1.5, 0),      // Inside East Container
      new THREE.Vector3(-18, 1.5, -10),  // NW Flank
      new THREE.Vector3(18, 1.5, -10),   // NE Flank
      new THREE.Vector3(-18, 1.5, 10),   // SW Flank
      new THREE.Vector3(18, 1.5, 10),    // SE Flank
      new THREE.Vector3(-10, 1.5, -28),  // North West Corner Flank
      new THREE.Vector3(10, 1.5, 28)     // South East Corner Flank
    );

  } else if (mapId === 'rust') {
    ambientColor = '#fbbf24'; // Sandy Desert sun
    directionalColor = '#fff7ed';
    fogColor = '#854d0e'; // Dusty desert haze
    fogDensity = 0.012;

    // Rust Desert Floor (110x110)
    const floorGeo = new THREE.PlaneGeometry(110, 110);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.95 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Perimeter Scrapyard Walls & Dunes
    const limit = 55;
    createCrate([0, 8, -limit], [110, 16, 2], 0x7c2d12, 0, 'wall'); // N
    createCrate([0, 8, limit], [110, 16, 2], 0x7c2d12, 0, 'wall');  // S
    createCrate([-limit, 8, 0], [2, 16, 110], 0x7c2d12, 0, 'wall');  // W
    createCrate([limit, 8, 0], [2, 16, 110], 0x7c2d12, 0, 'wall');   // E

    // --- CENTRAL RUST MULTI-TIER TOWER ---
    // Tier 1 Base Frame
    createCrate([0, 4, 0], [18, 8, 18], 0x451a03);
    // Tier 2 Mid Cabin (Sniper platform level)
    createCrate([0, 12, 0], [12, 8, 12], 0x78350f);
    // Tier 3 Lookout Perch / Crane Top
    createCrate([0, 18, 0], [6, 4, 6], 0x1e293b);

    // Tower Access Ramps (4 angled climbable ramps)
    const rampMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.9, flatShading: true });
    
    // South Ramp to Tier 1
    const rampGeo1 = new THREE.BoxGeometry(5, 1, 16);
    const ramp1 = new THREE.Mesh(rampGeo1, rampMat);
    ramp1.position.set(0, 3.2, 13);
    ramp1.rotation.x = -0.28;
    ramp1.receiveShadow = true;
    ramp1.castShadow = true;
    scene.add(ramp1);
    colliders.push({ box: new THREE.Box3().setFromObject(ramp1), mesh: ramp1, type: 'ramp' });

    // West Ramp to Tier 1
    const rampGeo2 = new THREE.BoxGeometry(16, 1, 5);
    const ramp2 = new THREE.Mesh(rampGeo2, rampMat);
    ramp2.position.set(-13, 3.2, 0);
    ramp2.rotation.z = 0.28;
    ramp2.receiveShadow = true;
    ramp2.castShadow = true;
    scene.add(ramp2);
    colliders.push({ box: new THREE.Box3().setFromObject(ramp2), mesh: ramp2, type: 'ramp' });

    // North Ramp to Tier 2 (Upper catwalk)
    const rampGeo3 = new THREE.BoxGeometry(5, 1, 14);
    const ramp3 = new THREE.Mesh(rampGeo3, rampMat);
    ramp3.position.set(0, 10.2, -10);
    ramp3.rotation.x = 0.32;
    ramp3.receiveShadow = true;
    ramp3.castShadow = true;
    scene.add(ramp3);
    colliders.push({ box: new THREE.Box3().setFromObject(ramp3), mesh: ramp3, type: 'ramp' });

    // --- INDUSTRIAL SURROUNDINGS (Fuel Tanks, Pipelines, Sandbag Trenches, Generator Blocks) ---
    // NW Fuel Silo
    const siloGeo = new THREE.CylinderGeometry(5, 5, 16, 12);
    const siloMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.6, roughness: 0.4 });
    const silo = new THREE.Mesh(siloGeo, siloMat);
    silo.position.set(-28, 8, -28);
    silo.castShadow = true;
    silo.receiveShadow = true;
    scene.add(silo);
    silo.updateMatrixWorld(true);
    colliders.push({ box: new THREE.Box3().setFromObject(silo), mesh: silo as any, type: 'crate' });

    // NE Oil Tank
    const tankGeo = new THREE.CylinderGeometry(6, 6, 12, 12);
    const tank = new THREE.Mesh(tankGeo, siloMat);
    tank.position.set(28, 6, -28);
    tank.castShadow = true;
    tank.receiveShadow = true;
    scene.add(tank);
    tank.updateMatrixWorld(true);
    colliders.push({ box: new THREE.Box3().setFromObject(tank), mesh: tank as any, type: 'crate' });

    // Horizontal Oil Pipelines
    const pipeGeo = new THREE.CylinderGeometry(2, 2, 18, 8);
    const pipe1 = new THREE.Mesh(pipeGeo, siloMat);
    pipe1.position.set(25, 2, 0);
    pipe1.rotation.z = Math.PI / 2;
    pipe1.castShadow = true;
    scene.add(pipe1);
    pipe1.updateMatrixWorld(true);
    colliders.push({ box: new THREE.Box3().setFromObject(pipe1), mesh: pipe1 as any, type: 'crate' });

    const pipe2 = new THREE.Mesh(pipeGeo, siloMat);
    pipe2.position.set(-25, 2, 18);
    pipe2.rotation.x = Math.PI / 2;
    pipe2.castShadow = true;
    scene.add(pipe2);
    pipe2.updateMatrixWorld(true);
    colliders.push({ box: new THREE.Box3().setFromObject(pipe2), mesh: pipe2 as any, type: 'crate' });

    // Sandbag Trench Bunkers
    createCrate([-20, 1.5, -15], [10, 3, 2], 0xb45309);
    createCrate([20, 1.5, 15], [10, 3, 2], 0xb45309);
    createCrate([15, 1.5, -20], [2, 3, 10], 0xb45309);
    createCrate([-15, 1.5, 20], [2, 3, 10], 0xb45309);

    // Industrial Cargo Container Cover
    createCrate([-32, 3, 28], [14, 6, 6], 0x78350f, Math.PI / 6);
    createCrate([32, 3, -28], [14, 6, 6], 0xb45309, -Math.PI / 6);

    // 18 Safe Spawn Points across Rust
    spawnPoints.push(
      new THREE.Vector3(-40, 1.5, -40), // NW Outer Spawn
      new THREE.Vector3(40, 1.5, -40),  // NE Outer Spawn
      new THREE.Vector3(-40, 1.5, 40),   // SW Outer Spawn
      new THREE.Vector3(40, 1.5, 40),    // SE Outer Spawn
      new THREE.Vector3(0, 1.5, -42),    // North Trench Spawn
      new THREE.Vector3(0, 1.5, 42),     // South Trench Spawn
      new THREE.Vector3(-42, 1.5, 0),    // West Pipe Spawn
      new THREE.Vector3(42, 1.5, 0),     // East Pipe Spawn
      new THREE.Vector3(-22, 1.5, -22),  // NW Silo Flank
      new THREE.Vector3(22, 1.5, -22),   // NE Tank Flank
      new THREE.Vector3(-22, 1.5, 22),   // SW Container Flank
      new THREE.Vector3(22, 1.5, 22),    // SE Container Flank
      new THREE.Vector3(0, 8.5, 6),      // Central Tower Tier 1 South
      new THREE.Vector3(-6, 8.5, 0),     // Central Tower Tier 1 West
      new THREE.Vector3(0, 16.5, 0),     // Tower Tier 2 Lookout
      new THREE.Vector3(-12, 1.5, -12),  // Mid NW Cover
      new THREE.Vector3(12, 1.5, 12),    // Mid SE Cover
      new THREE.Vector3(-30, 1.5, 0)     // West Dune Spawn
    );

  } else {
    // DUST2 (Desert Compound)
    ambientColor = '#fed7aa'; // Bright desert sunlight
    directionalColor = '#fffbeb';
    fogColor = '#ea580c';
    fogDensity = 0.007;

    // Dust2 Floor (130x130)
    const floorGeo = new THREE.PlaneGeometry(130, 130);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.9 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Perimeter Compound Walls
    const limit = 65;
    const wallColor = 0xa16207;
    createCrate([0, 10, -limit], [130, 20, 2], wallColor, 0, 'wall'); // North Wall
    createCrate([0, 10, limit], [130, 20, 2], wallColor, 0, 'wall');  // South Wall
    createCrate([-limit, 10, 0], [2, 20, 130], wallColor, 0, 'wall'); // West Wall
    createCrate([limit, 10, 0], [2, 20, 130], wallColor, 0, 'wall');  // East Wall

    // --- A SITE (North-East Zone) ---
    // A Site Bomb Platform
    createCrate([35, 2, -35], [20, 4, 20], 0x854d0e);
    // Triple Stack Wooden Crates on A Platform
    createCrate([32, 5, -38], [4, 4, 4], 0xb45309);
    createCrate([36, 5, -38], [4, 4, 4], 0xb45309);
    createCrate([34, 8, -38], [3.5, 3.5, 3.5], 0x78350f);
    // Goose Corner Wall
    createCrate([48, 5, -48], [8, 10, 8], 0x713f12);
    // Long A Ramp Wall
    createCrate([48, 4, -15], [4, 8, 30], 0x713f12);

    // --- B SITE (North-West Zone) ---
    // B Site Platform
    createCrate([-35, 2, -35], [20, 4, 20], 0x854d0e);
    // B Bomb Site Crates
    createCrate([-35, 5, -35], [5, 4, 5], 0xb45309);
    createCrate([-38, 5, -32], [4, 4, 4], 0x78350f);
    // B Doors Wall
    createCrate([-25, 5, -20], [4, 10, 16], 0x713f12);
    // B Window Platform Wall
    createCrate([-48, 6, -20], [8, 12, 10], 0x713f12);

    // --- MID & CATWALK / SHORT A ---
    // Mid Doors Split Wall
    createCrate([0, 5, -15], [16, 10, 4], 0x713f12);
    // Xbox Crate at Mid
    createCrate([-4, 2, 5], [5, 4, 5], 0xb45309);
    // Catwalk / Short A Ledge
    createCrate([18, 3, -15], [16, 6, 6], 0x854d0e);

    // --- TUNNELS (South-West Upper & Lower Tunnels) ---
    // Upper Tunnel Enclosure Walls
    createCrate([-38, 5, 20], [16, 10, 30], 0x713f12);
    // Lower Tunnel Exit Wall
    createCrate([-20, 4, 15], [12, 8, 4], 0x713f12);

    // --- T SPAWN & CT SPAWN ---
    // T Spawn Back Wall & Ramp (South)
    createCrate([0, 4, 48], [40, 8, 12], 0x854d0e);
    // CT Spawn Ramp & Barrier (North)
    createCrate([0, 3, -48], [36, 6, 10], 0x854d0e);

    // --- DECORATIVE COVER & MARKET STALLS ---
    // Market Stall Canopies
    createCrate([20, 1.5, 20], [8, 3, 8], 0xd97706);
    createCrate([-18, 1.5, -5], [6, 3, 6], 0x2563eb);
    // Sandbag positions
    createCrate([10, 1.2, 35], [8, 2.4, 2], 0xb45309);
    createCrate([-10, 1.2, -35], [8, 2.4, 2], 0xb45309);

    // 20 Safe Spawn Points across Dust2
    spawnPoints.push(
      new THREE.Vector3(0, 1.5, 40),     // T Spawn Center
      new THREE.Vector3(-15, 1.5, 40),   // T Spawn West
      new THREE.Vector3(15, 1.5, 40),    // T Spawn East
      new THREE.Vector3(0, 1.5, -40),    // CT Spawn Center
      new THREE.Vector3(-15, 1.5, -40),  // CT Spawn B-side
      new THREE.Vector3(15, 1.5, -40),   // CT Spawn A-side
      new THREE.Vector3(35, 4.5, -30),   // A Site Platform
      new THREE.Vector3(45, 1.5, -25),   // Long A Corner
      new THREE.Vector3(45, 1.5, 10),    // Long A Doors
      new THREE.Vector3(20, 3.5, -25),   // Short A / Catwalk
      new THREE.Vector3(-35, 4.5, -30),  // B Site Platform
      new THREE.Vector3(-45, 1.5, -10),  // B Window
      new THREE.Vector3(-35, 1.5, 10),   // Upper Tunnels
      new THREE.Vector3(-18, 1.5, 5),    // Lower Tunnels
      new THREE.Vector3(0, 1.5, 0),      // Mid Doors Crossroads
      new THREE.Vector3(-10, 1.5, 20),   // Mid Suicide Alley
      new THREE.Vector3(20, 1.5, 20),    // Market Plaza East
      new THREE.Vector3(-25, 1.5, -35),  // B Doors Flank
      new THREE.Vector3(30, 1.5, -45),   // A Long Ramp
      new THREE.Vector3(-40, 1.5, 35)    // Tunnels Entrance South
    );
  }

  // CRITICAL: Force world matrix update on all scene objects before calculating bounding boxes!
  scene.updateMatrixWorld(true);
  colliders.forEach(c => {
    c.box.setFromObject(c.mesh);
  });

  return {
    spawnPoints,
    colliders,
    ambientColor,
    directionalColor,
    fogColor,
    fogDensity
  };
}
