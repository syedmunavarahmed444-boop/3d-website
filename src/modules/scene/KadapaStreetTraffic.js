import * as THREE from 'three';

function makeAsphaltRoadTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  // Rich weathered Indian tarmac base
  ctx.fillStyle = '#2d3135';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle asphalt stone aggregate grain
  for (let i = 0; i < 16000; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const y = (Math.sin(i * 78.233) * 24634.6345) % 1;
    const px = Math.abs(x) * 512;
    const py = Math.abs(y) * 512;
    const shade = i % 3 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)';
    ctx.fillStyle = shade;
    ctx.fillRect(px, py, 2, 2);
  }

  // Subtle darker tire-track wear along both lanes
  ctx.fillStyle = 'rgba(15, 17, 20, 0.22)';
  ctx.fillRect(0, 96, 512, 42);
  ctx.fillRect(0, 172, 512, 42);
  ctx.fillRect(0, 300, 512, 42);
  ctx.fillRect(0, 376, 512, 42);

  // Solid crisp white outer road edge markings
  ctx.fillStyle = 'rgba(242, 240, 232, 0.85)';
  ctx.fillRect(0, 26, 512, 9);
  ctx.fillRect(0, 476, 512, 9);

  // Dashed white center divider line (runs along X)
  ctx.fillStyle = 'rgba(248, 245, 234, 0.92)';
  ctx.fillRect(36, 250, 196, 12);
  ctx.fillRect(292, 250, 196, 12);

  // Faint road dust near the sidewalk curb edge
  const dust = ctx.createLinearGradient(0, 0, 0, 44);
  dust.addColorStop(0, 'rgba(148, 134, 114, 0.34)');
  dust.addColorStop(1, 'rgba(148, 134, 114, 0)');
  ctx.fillStyle = dust;
  ctx.fillRect(0, 0, 512, 44);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(9, 1);
  tex.anisotropy = 4;
  return tex;
}

function makeCurbStripeTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  // Iconic Indian painted Yellow & Black road curb
  ctx.fillStyle = '#e5b324';
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#1d2124';
  ctx.fillRect(128, 0, 128, 64);
  // Subtle weathering grit
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  ctx.fillRect(0, 46, 256, 18);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(28, 1);
  return tex;
}

function makeVehicleShadowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 60);
  g.addColorStop(0, 'rgba(0, 0, 0, 0.62)');
  g.addColorStop(0.65, 'rgba(0, 0, 0, 0.3)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Builds an extended realistic Kadapa street (textured 2-lane asphalt road, painted yellow-black curbs,
 * crosswalk, streetlamps, opposite footpath) + 4 smoothly moving Indian street vehicles
 * (Auto-Rickshaw, White Sedan, Commuter Scooter with rider, and Metallic SUV).
 */
export class KadapaStreetTraffic {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.name = 'KadapaStreetTraffic';
    this.vehicles = [];
    this.roadY = -0.114;

    this._initSharedMaterials();
    this._buildExtendedRoadAndCurbs();
    this._buildStreetLamps();
    this._spawnVehicles();

    this.scene.add(this.root);
  }

  _initSharedMaterials() {
    this.mTire = new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.88 });
    this.mRim = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.3, metalness: 0.78 });
    this.mGlass = new THREE.MeshStandardMaterial({
      color: 0x15222e,
      roughness: 0.12,
      metalness: 0.85,
    });
    this.mChrome = new THREE.MeshStandardMaterial({ color: 0xd8dee6, roughness: 0.25, metalness: 0.85 });
    this.mHeadlight = new THREE.MeshStandardMaterial({
      color: 0xfff8dc,
      emissive: 0xffe9a3,
      emissiveIntensity: 1.5,
      roughness: 0.2,
    });
    this.mTaillight = new THREE.MeshStandardMaterial({
      color: 0xe11d48,
      emissive: 0xff2233,
      emissiveIntensity: 1.35,
      roughness: 0.2,
    });
    this.mPlate = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
    this.mShadow = new THREE.MeshBasicMaterial({
      map: makeVehicleShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
    });
  }

  _buildExtendedRoadAndCurbs() {
    const roadTex = makeAsphaltRoadTexture();
    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      roughness: 0.9,
      metalness: 0.04,
    });

    // Main 2-lane Kadapa asphalt street (z = 3.12 .. 13.52, width = 62m)
    const road = new THREE.Mesh(new THREE.PlaneGeometry(62, 10.4), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, this.roadY, 8.32);
    road.receiveShadow = true;
    this.root.add(road);

    // Subtle zebra crosswalk stripes to the left (near Apsara Circle)
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xebe7da, roughness: 0.85 });
    for (let i = 0; i < 7; i++) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.45), stripeMat);
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(-7.2, this.roadY + 0.004, 4.35 + i * 1.25);
      strip.receiveShadow = true;
      this.root.add(strip);
    }

    // Yellow-and-black painted concrete curbs on BOTH sides of the road
    const curbMat = new THREE.MeshStandardMaterial({
      map: makeCurbStripeTexture(),
      roughness: 0.78,
    });
    const nearCurb = new THREE.Mesh(new THREE.BoxGeometry(62, 0.14, 0.22), curbMat);
    nearCurb.position.set(0, this.roadY + 0.055, 3.04);
    nearCurb.receiveShadow = true;
    this.root.add(nearCurb);

    const farCurb = new THREE.Mesh(new THREE.BoxGeometry(62, 0.16, 0.24), curbMat);
    farCurb.position.set(0, this.roadY + 0.065, 13.6);
    farCurb.receiveShadow = true;
    this.root.add(farCurb);

    // Far-side paved footpath + extended ground apron so camera never sees an empty edge!
    const footpathMat = new THREE.MeshStandardMaterial({ color: 0x9b968d, roughness: 0.92 });
    const farFootpath = new THREE.Mesh(new THREE.BoxGeometry(66, 0.14, 6.5), footpathMat);
    farFootpath.position.set(0, this.roadY + 0.05, 16.95);
    farFootpath.receiveShadow = true;
    this.root.add(farFootpath);

    // Side concrete footpath extension beyond exterior.glb on far left/right
    const nearFootpathExt = new THREE.Mesh(new THREE.BoxGeometry(66, 0.12, 4.2), footpathMat);
    nearFootpathExt.position.set(0, this.roadY - 0.03, 1.0);
    this.root.add(nearFootpathExt);
  }

  _buildStreetLamps() {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x525b64, roughness: 0.42, metalness: 0.72 });
    const lampGlow = new THREE.MeshStandardMaterial({
      color: 0xfff5d6,
      emissive: 0xffdf8e,
      emissiveIntensity: 1.6,
    });

    for (const lx of [-8.8, 7.6]) {
      const lamp = new THREE.Group();
      lamp.position.set(lx, this.roadY + 0.12, 3.16);

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.085, 5.2, 10), poleMat);
      pole.position.y = 2.6;
      pole.castShadow = true;
      lamp.add(pole);

      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.35, 8), poleMat);
      arm.rotation.x = Math.PI / 2.2;
      arm.position.set(0, 5.15, 0.62);
      lamp.add(arm);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.48), poleMat);
      head.position.set(0, 5.28, 1.28);
      lamp.add(head);

      const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.36), lampGlow);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(0, 5.23, 1.28);
      lamp.add(lens);

      this.root.add(lamp);
    }
  }

  _makeWheel(radius = 0.28, width = 0.16) {
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 18), this.mTire);
    tire.rotation.x = Math.PI / 2;
    tire.castShadow = true;
    wheel.add(tire);

    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, width + 0.014, 12),
      this.mRim
    );
    rim.rotation.x = Math.PI / 2;
    wheel.add(rim);

    // Subtle spoke bar so wheel rotation is visibly real!
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.95, 0.04, width + 0.02), this.mChrome);
    wheel.add(spoke);
    return wheel;
  }

  /**
   * Classic Kadapa / South Indian Yellow-and-Green 3-Wheeler Auto-Rickshaw (faces +X)
   */
  _createAutoRickshaw() {
    const g = new THREE.Group();
    const wheels = [];

    const mYellow = new THREE.MeshStandardMaterial({ color: 0xf4b41a, roughness: 0.34, metalness: 0.12 });
    const mGreen = new THREE.MeshStandardMaterial({ color: 0x0f6a3b, roughness: 0.38, metalness: 0.12 });
    const mCanopy = new THREE.MeshStandardMaterial({ color: 0x1e2226, roughness: 0.85 });
    const mSeat = new THREE.MeshStandardMaterial({ color: 0x4b2e20, roughness: 0.8 });

    // Lower yellow chassis & side panels
    const lower = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.56, 1.18), mYellow);
    lower.position.set(-0.08, 0.54, 0);
    lower.castShadow = true;
    g.add(lower);

    // Green nose cowling + sloped hood
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 1.08), mGreen);
    nose.position.set(0.95, 0.58, 0);
    nose.castShadow = true;
    g.add(nose);

    const mudguard = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.34), mYellow);
    mudguard.position.set(1.12, 0.36, 0);
    g.add(mudguard);

    // Angled windshield frame & glass
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.58, 1.0), this.mGlass);
    windshield.position.set(0.86, 1.12, 0);
    windshield.rotation.z = 0.24;
    g.add(windshield);

    // Curved black soft-top canopy roof & rear back panel
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.22, 1.18), mCanopy);
    canopy.position.set(-0.18, 1.54, 0);
    canopy.castShadow = true;
    g.add(canopy);

    const rearWall = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.82, 1.14), mGreen);
    rearWall.position.set(-1.08, 1.12, 0);
    g.add(rearWall);

    // Side pillars + passenger bench inside
    for (const sz of [-0.54, 0.54]) {
      const pFront = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.72, 8), this.mChrome);
      pFront.position.set(0.68, 1.16, sz);
      g.add(pFront);
      const pMid = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.72, 8), mCanopy);
      pMid.position.set(-0.12, 1.16, sz);
      g.add(pMid);
    }

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 1.02), mSeat);
    seat.position.set(-0.72, 0.78, 0);
    g.add(seat);

    // Iconic round front headlight & red taillights
    const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 14), this.mHeadlight);
    hl.rotation.z = Math.PI / 2;
    hl.position.set(1.27, 0.66, 0);
    g.add(hl);

    for (const sz of [-0.42, 0.42]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.16), this.mTaillight);
      tl.position.set(-1.17, 0.62, sz);
      g.add(tl);
    }

    // 3 spinning wheels (1 front, 2 rear)
    const wFront = this._makeWheel(0.22, 0.14);
    wFront.position.set(0.98, 0.22, 0);
    g.add(wFront);
    wheels.push(wFront);

    for (const sz of [-0.56, 0.56]) {
      const wr = this._makeWheel(0.23, 0.15);
      wr.position.set(-0.76, 0.23, sz);
      g.add(wr);
      wheels.push(wr);
    }

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.75, 1.65), this.mShadow);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(-0.02, 0.012, 0);
    g.add(shadow);

    return { group: g, wheels, wheelRadius: 0.23 };
  }

  /**
   * Sleek Indian Hatchback / Sedan / SUV Car (faces +X)
   */
  _createCar({ color = 0xf2f4f7, isSuv = false } = {}) {
    const g = new THREE.Group();
    const wheels = [];

    const mBody = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.24,
      metalness: 0.35,
    });
    const mBumper = new THREE.MeshStandardMaterial({ color: 0x1f2429, roughness: 0.72 });

    const bodyLen = isSuv ? 4.15 : 3.85;
    const bodyH = isSuv ? 0.68 : 0.56;
    const cabinH = isSuv ? 0.58 : 0.48;
    const wheelR = isSuv ? 0.33 : 0.29;
    const bodyY = wheelR + bodyH * 0.5 - 0.04;

    // Sculpted lower body
    const body = new THREE.Mesh(new THREE.BoxGeometry(bodyLen, bodyH, 1.66), mBody);
    body.position.set(0, bodyY, 0);
    body.castShadow = true;
    g.add(body);

    // Front & rear lower bumper skirts
    const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 1.68), mBumper);
    frontBumper.position.set(bodyLen * 0.48, wheelR + 0.06, 0);
    g.add(frontBumper);

    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 1.68), mBumper);
    rearBumper.position.set(-bodyLen * 0.48, wheelR + 0.06, 0);
    g.add(rearBumper);

    // Cabin greenhouse + tinted glass band
    const cabinLen = isSuv ? 2.45 : 1.98;
    const cabinX = isSuv ? -0.28 : -0.18;
    const cabinY = bodyY + bodyH * 0.5 + cabinH * 0.46;

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(cabinLen, cabinH, 1.46), mBody);
    cabin.position.set(cabinX, cabinY, 0);
    cabin.castShadow = true;
    g.add(cabin);

    const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(cabinLen - 0.16, cabinH * 0.72, 1.49), this.mGlass);
    sideGlass.position.set(cabinX, cabinY + 0.01, 0);
    g.add(sideGlass);

    const frontRearGlass = new THREE.Mesh(
      new THREE.BoxGeometry(cabinLen + 0.04, cabinH * 0.72, 1.32),
      this.mGlass
    );
    frontRearGlass.position.set(cabinX, cabinY + 0.01, 0);
    g.add(frontRearGlass);

    // Roof rails for SUV
    if (isSuv) {
      for (const sz of [-0.58, 0.58]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.045, 0.045), this.mChrome);
        rail.position.set(cabinX, cabinY + cabinH * 0.54, sz);
        g.add(rail);
      }
    }

    // Front grille + twin LED headlights + red taillights + license plates
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.78), mBumper);
    grille.position.set(bodyLen * 0.5 + 0.01, bodyY - 0.02, 0);
    g.add(grille);

    for (const sz of [-0.58, 0.58]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.3), this.mHeadlight);
      hl.position.set(bodyLen * 0.5 + 0.01, bodyY + 0.08, sz);
      g.add(hl);

      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.15, 0.32), this.mTaillight);
      tl.position.set(-bodyLen * 0.5 - 0.01, bodyY + 0.08, sz);
      g.add(tl);

      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.16), mBody);
      mirror.position.set(cabinX + cabinLen * 0.36, bodyY + bodyH * 0.56, sz > 0 ? 0.88 : -0.88);
      g.add(mirror);
    }

    const fPlate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.38), this.mPlate);
    fPlate.position.set(bodyLen * 0.52, wheelR + 0.09, 0);
    g.add(fPlate);

    // 4 spinning wheels
    const axleX = bodyLen * 0.31;
    for (const wx of [axleX, -axleX]) {
      for (const wz of [-0.82, 0.82]) {
        const w = this._makeWheel(wheelR, 0.2);
        w.position.set(wx, wheelR, wz);
        g.add(w);
        wheels.push(w);
      }
    }

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(bodyLen + 0.8, 2.25), this.mShadow);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, 0.012, 0);
    g.add(shadow);

    return { group: g, wheels, wheelRadius: wheelR };
  }

  /**
   * Indian Commuter Scooter with Helmeted Rider (faces +X)
   */
  _createScooter() {
    const g = new THREE.Group();
    const wheels = [];
    const mScooter = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.3, metalness: 0.3 });
    const mDark = new THREE.MeshStandardMaterial({ color: 0x1e242b, roughness: 0.78 });
    const mShirt = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.85 });
    const mHelmet = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.25, metalness: 0.2 });

    // Scooter floorboard & rear body
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.12, 0.38), mDark);
    deck.position.set(0, 0.26, 0);
    g.add(deck);

    const rearBody = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.34, 0.42), mScooter);
    rearBody.position.set(-0.34, 0.5, 0);
    rearBody.castShadow = true;
    g.add(rearBody);

    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.68, 0.38), mScooter);
    apron.position.set(0.46, 0.64, 0);
    apron.rotation.z = 0.16;
    apron.castShadow = true;
    g.add(apron);

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.58, 8), mDark);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0.42, 0.98, 0);
    g.add(handle);

    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.16), this.mHeadlight);
    hl.position.set(0.56, 0.96, 0);
    g.add(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.14), this.mTaillight);
    tl.position.set(-0.74, 0.56, 0);
    g.add(tl);

    // Clean stylized helmeted rider silhouette
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.52, 0.36), mShirt);
    torso.position.set(-0.18, 1.02, 0);
    torso.rotation.z = -0.14;
    torso.castShadow = true;
    g.add(torso);

    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.3), mDark);
    legs.position.set(0.04, 0.58, 0);
    g.add(legs);

    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.145, 14, 10), mHelmet);
    helmet.position.set(-0.1, 1.42, 0);
    helmet.castShadow = true;
    g.add(helmet);

    for (const wx of [0.56, -0.56]) {
      const w = this._makeWheel(0.2, 0.1);
      w.position.set(wx, 0.2, 0);
      g.add(w);
      wheels.push(w);
    }

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 0.85), this.mShadow);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, 0.012, 0);
    g.add(shadow);

    return { group: g, wheels, wheelRadius: 0.2 };
  }

  _spawnVehicles() {
    // Lane 1 (Near lane, z ~ 5.2..5.8): drives Right -> Left (dir = -1, faces -X -> rotY = Math.PI)
    // Lane 2 (Far lane, z ~ 9.8..10.2): drives Left -> Right (dir = +1, faces +X -> rotY = 0)
    const fleet = [
      { ...this._createAutoRickshaw(), x: 4.8, z: 5.75, dir: -1, speed: 3.4 },
      { ...this._createScooter(), x: 18.5, z: 4.95, dir: -1, speed: 4.6 },
      { ...this._createCar({ color: 0xf4f6f9, isSuv: false }), x: -6.2, z: 9.85, dir: 1, speed: 5.2 },
      { ...this._createCar({ color: 0x991b1b, isSuv: true }), x: -24.0, z: 10.15, dir: 1, speed: 4.8 },
    ];

    for (const v of fleet) {
      v.group.position.set(v.x, this.roadY, v.z);
      v.group.rotation.y = v.dir === 1 ? 0 : Math.PI;
      this.root.add(v.group);
      this.vehicles.push(v);
    }
  }

  update(dt) {
    const limit = 28;
    for (const v of this.vehicles) {
      const dx = v.dir * v.speed * dt;
      v.group.position.x += dx;
      if (v.dir === 1 && v.group.position.x > limit) {
        v.group.position.x = -limit;
      } else if (v.dir === -1 && v.group.position.x < -limit) {
        v.group.position.x = limit;
      }

      // Spin all wheels accurately for road speed
      const spin = -(v.speed * dt) / Math.max(0.1, v.wheelRadius);
      for (const w of v.wheels) {
        w.rotation.z += spin;
      }
    }
  }
}
