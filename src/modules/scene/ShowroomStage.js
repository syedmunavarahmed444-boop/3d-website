import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CHAPTERS } from '../brand/storeData.js';
import { KadapaStreetTraffic } from './KadapaStreetTraffic.js';

function lerpAngle(current, target, t) {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * t;
}

function shortestYawTarget(currentYaw, desiredYaw) {
  let diff = ((desiredYaw - currentYaw + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return currentYaw + diff;
}

function makeRadialShadowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  g.addColorStop(0, 'rgba(4, 14, 10, 0.58)');
  g.addColorStop(0.55, 'rgba(4, 14, 10, 0.24)');
  g.addColorStop(1, 'rgba(4, 14, 10, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates a crisp, high-contrast 3D architectural showroom section plaque texture
 * mounted directly onto the shop walls above each product zone.
 */
function makeWallSignTexture({ code, title, sub }) {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 176;
  const ctx = c.getContext('2d');

  // Deep emerald-navy signboard background
  const grad = ctx.createLinearGradient(0, 0, 640, 176);
  grad.addColorStop(0, '#09261d');
  grad.addColorStop(1, '#051510');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 640, 176);

  // Brushed gold outer & inner trim border
  ctx.strokeStyle = '#f0be52';
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 624, 160);
  ctx.strokeStyle = 'rgba(240, 190, 82, 0.42)';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, 604, 140);

  // Left gold index badge
  ctx.fillStyle = '#f0be52';
  ctx.beginPath();
  ctx.roundRect(32, 34, 92, 42, 10);
  ctx.fill();

  ctx.fillStyle = '#061912';
  ctx.font = '900 24px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(code, 78, 56);

  // "TAP FOR PRICES" right pill cue
  ctx.fillStyle = 'rgba(240, 190, 82, 0.16)';
  ctx.beginPath();
  ctx.roundRect(434, 36, 174, 38, 19);
  ctx.fill();
  ctx.strokeStyle = 'rgba(240, 190, 82, 0.65)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#f8d277';
  ctx.font = '800 17px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.fillText('TAP 3D RACK ↗', 521, 56);

  // Main section wall title
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fdfaf2';
  ctx.font = '900 35px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.fillText(title, 34, 114);

  // Price / subtitle strip
  ctx.fillStyle = '#f0be52';
  ctx.font = '700 20px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.fillText(sub, 34, 146);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Full 3D WebGL Showroom Stage:
 * - Unified THREE.LoadingManager across all 4 GLB models
 * - 3D Wall Section Signs mounted directly onto showroom walls
 * - 360° touch-swipe & mouse-drag free-look inside the shop with smooth inertia
 * - Raycaster 3D object & wall-sign picking (tapping any 3D rack opens its compact price card)
 * - Adaptive mobile quality + render pause when tab is hidden
 */
export class ShowroomStage {
  constructor(canvas, { onProgress, onReady, onError, onSelectSection, onUserSwipe } = {}) {
    this.canvas = canvas;
    this.onProgress = onProgress;
    this.onReady = onReady;
    this.onError = onError;
    this.onSelectSection = onSelectSection;
    this.onUserSwipe = onUserSwipe;

    this.clock = new THREE.Clock();
    this.mascot = null;
    this.mascotShadow = null;
    this.morphMesh = null;
    this.ceilingFan = null;
    this.elapsed = 0;
    this.mixer = null;
    this.actions = new Map();
    this.currentAnim = null;
    this.isMobile = window.innerWidth <= 860;

    // Render pause & adaptive FPS governor
    this.externalPaused = false;
    this._isLoopRunning = false;
    this._fpsFrames = 0;
    this._fpsAccum = 0;
    this._lowPowerApplied = false;

    // Story / Exterior camera state
    this.desiredCamPos = new THREE.Vector3(...CHAPTERS[0].camera.pos);
    this.desiredCamTarget = new THREE.Vector3(...CHAPTERS[0].camera.target);
    this.currentCamTarget = new THREE.Vector3(...CHAPTERS[0].camera.target);

    // Interactive 360° Free-Swipe Inside Mode & Smooth Walk-In Glide Transition
    this.exploreMode = false;
    this.walkIn = null; // { t, duration, p0, p1, p2, l0, l1, l2 }
    this.standPos = new THREE.Vector3(0.22, 1.48, -0.95);
    this.targetStandPos = new THREE.Vector3(0.22, 1.48, -0.95);
    this.yaw = 0.72;
    this.targetYaw = 0.72;
    this.pitch = -0.04;
    this.targetPitch = -0.04;
    this.velYaw = 0;
    this._isDragging = false;
    this._dragMoved = 0;
    this._downX = 0;
    this._downY = 0;
    this._lastX = 0;
    this._lastY = 0;

    // 3D Raycasting & Wall Signs
    this.raycaster = new THREE.Raycaster();
    this.pickables = [];
    this.wallSigns = new Map();
    this.hoveredSectionId = null;
    this.activeSectionId = null;

    this.mascotTargetPos = new THREE.Vector3(...CHAPTERS[0].mascot.pos);
    this.mascotTargetRotY = CHAPTERS[0].mascot.rotY;
    this.mascotDesiredAnim = CHAPTERS[0].mascot.anim;
    this.shutterOpen = 0;

    this._initLoadingManager();
    this._rafId = null;
    this._initScene();
    this._buildShutter();
    this._buildAmbientFloorAO();
    this._buildWallSignsAndHitboxes();
    this.streetTraffic = new KadapaStreetTraffic(this.scene);
    this._loadAllShowroomModels();
    this._bindEvents();
    this._syncLoopState();
  }

  _initLoadingManager() {
    this.loadingManager = new THREE.LoadingManager();
    this.loadingManager.onProgress = (_url, itemsLoaded, itemsTotal) => {
      if (itemsTotal > 0) {
        this.onProgress?.(Math.min(99, Math.round((itemsLoaded / itemsTotal) * 100)));
      }
    };
    this.loadingManager.onLoad = () => {
      this.onProgress?.(100);
      this.onReady?.();
    };
    this.loadingManager.onError = (url) => {
      console.warn('Asset load warning:', url);
      this.onError?.(url);
    };

    this.gltfLoader = new GLTFLoader(this.loadingManager);
    this.gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  }

  _loadModel(url, onLoaded) {
    this.gltfLoader.load(url, onLoaded, undefined, (err) => {
      console.warn(`Could not load ${url}:`, err);
    });
  }

  _maxPixelRatio() {
    if (this._lowPowerApplied) return 1.0;
    return this.isMobile ? 1.5 : 2.0;
  }

  _initScene() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x88b4da);
    this.scene.fog = new THREE.Fog(0x94bee0, 16, 42);

    this.camera = new THREE.PerspectiveCamera(w > 900 ? 52 : 66, w / h, 0.1, 60);
    this.camera.position.copy(this.desiredCamPos);
    this.camera.lookAt(this.currentCamTarget);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !this.isMobile,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this._maxPixelRatio()));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.58;
    pmrem.dispose();

    this.hemiLight = new THREE.HemisphereLight(0xfff8ed, 0x324238, 0.92);
    this.scene.add(this.hemiLight);

    const shadowRes = this.isMobile ? 1024 : 2048;
    this.sunLight = new THREE.DirectionalLight(0xffe5b8, 1.95);
    this.sunLight.position.set(5.5, 8.5, 7.5);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.02;
    this.sunLight.shadow.mapSize.set(shadowRes, shadowRes);
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 30;
    this.sunLight.shadow.camera.left = -12;
    this.sunLight.shadow.camera.right = 12;
    this.sunLight.shadow.camera.top = 10;
    this.sunLight.shadow.camera.bottom = -6;
    this.scene.add(this.sunLight);

    this.indoorSpot = new THREE.SpotLight(0xfff7e8, 5.2, 12, Math.PI * 0.46, 0.55, 1.1);
    this.indoorSpot.position.set(0.15, 3.12, -1.65);
    this.indoorSpot.target.position.set(0.05, 0, -2.15);
    this.indoorSpot.castShadow = !this.isMobile;
    if (!this.isMobile) {
      this.indoorSpot.shadow.bias = -0.0005;
      this.indoorSpot.shadow.mapSize.set(1024, 1024);
    }
    this.scene.add(this.indoorSpot);
    this.scene.add(this.indoorSpot.target);

    if (!this.isMobile) {
      const shopBackLED = new THREE.PointLight(0xfff3dc, 2.6, 9.5, 1.25);
      shopBackLED.position.set(0.1, 2.88, -3.45);
      this.scene.add(shopBackLED);
    } else {
      this.hemiLight.intensity = 1.08;
    }

    const interiorFrontFill = new THREE.DirectionalLight(0xfff6eb, 0.52);
    interiorFrontFill.position.set(0.6, 2.0, 3.6);
    this.scene.add(interiorFrontFill);
  }

  _applyLowPowerFallback() {
    if (this._lowPowerApplied) return;
    this._lowPowerApplied = true;
    this.renderer.setPixelRatio(1.0);
    if (this.indoorSpot) this.indoorSpot.castShadow = false;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
  }

  _buildAmbientFloorAO() {
    const shadowTex = makeRadialShadowTexture();
    const aoMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    });

    const placements = [
      [-1.18, 0.004, -0.05, 1.15, 1.55, -0.628],
      [-1.45, 0.004, -2.65, 0.95, 3.4, 0],
      [-1.0, 0.004, -2.85, 0.85, 1.65, 0],
      [0.1, 0.004, -4.15, 2.3, 0.85, 0],
      [1.62, 0.004, -1.25, 0.85, 4.2, 0],
    ];
    for (const [x, y, z, sx, sz, ry] of placements) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), aoMat);
      m.rotation.order = 'YXZ';
      m.rotation.x = -Math.PI / 2;
      m.rotation.y = ry;
      m.position.set(x, y, z);
      this.scene.add(m);
    }
  }

  _buildShutter() {
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xe8b448,
      roughness: 0.32,
      metalness: 0.65,
    });

    this.shutterGroup = new THREE.Group();
    this.shutterGroup.position.set(0, 2.7, 1.22);
    const shutterMat = new THREE.MeshStandardMaterial({
      color: 0x164a3a,
      roughness: 0.4,
      metalness: 0.52,
    });
    const shutterSheet = new THREE.Mesh(new THREE.BoxGeometry(3.32, 2.68, 0.06), shutterMat);
    shutterSheet.position.set(0, -1.34, 0);
    shutterSheet.castShadow = true;
    shutterSheet.receiveShadow = true;
    this.shutterGroup.add(shutterSheet);

    const ribMat = new THREE.MeshStandardMaterial({ color: 0x0d2f25, roughness: 0.48, metalness: 0.58 });
    for (let r = 0; r < 12; r++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.035, 0.08), ribMat);
      rib.position.set(0, -0.18 - r * 0.21, 0);
      this.shutterGroup.add(rib);
    }

    const shutterBottomBar = new THREE.Mesh(new THREE.BoxGeometry(3.34, 0.1, 0.1), goldMat);
    shutterBottomBar.position.set(0, -2.66, 0);
    this.shutterGroup.add(shutterBottomBar);
    this.scene.add(this.shutterGroup);
  }

  /**
   * Builds 3D wall-mounted section name boards + invisible 3D rack hitboxes
   * so customers can read section names directly on the shop walls and tap any 3D rack!
   */
  _buildWallSignsAndHitboxes() {
    this.signsGroup = new THREE.Group();
    this.scene.add(this.signsGroup);

    const backingMat = new THREE.MeshStandardMaterial({
      color: 0xd4a13e,
      roughness: 0.32,
      metalness: 0.72,
    });

    const hitMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    const signSpecs = [
      // === WALL 1 (STRAIGHT-AHEAD MAIN WALL): 100% DEDICATED CRICKET ZONE ===
      {
        id: 'willow-bats',
        code: 'WALL 1',
        title: 'CRICKET ZONE',
        sub: 'Willow Bats · Scoop Bats · Stumps · Pads · Gloves · Helmets',
        pos: [0.1, 2.94, -4.64],
        ry: 0,
        w: 1.96,
        h: 0.34,
      },
      {
        id: 'cricket-kit',
        code: '03',
        title: 'CRICKET PROTECTION',
        sub: 'Pads · Helmets · Kits · ₹2,400+',
        pos: [-1.29, 2.4, -4.185],
        ry: 0,
        w: 0.8,
        h: 0.22,
      },
      {
        id: 'willow-bats',
        code: '01',
        title: 'WILLOW BATS',
        sub: 'Kashmir & English · From ₹1,850',
        pos: [-0.34, 2.4, -4.185],
        ry: 0,
        w: 0.86,
        h: 0.22,
      },
      {
        id: 'tennis-bats',
        code: '02',
        title: 'SCOOP & STUMPS',
        sub: 'M4 Scoop · Stumps · Balls · ₹750+',
        pos: [0.58, 2.4, -4.185],
        ry: 0,
        w: 0.86,
        h: 0.22,
      },
      {
        id: 'cricket-kit',
        code: 'BULK',
        title: 'GLOVES & SACKS',
        sub: 'Gloves · Balls · Wholesale Packs',
        pos: [1.47, 2.4, -4.185],
        ry: 0,
        w: 0.78,
        h: 0.22,
      },

      // === WALL 2 (RIGHT WALL): COURT & FIELD SPORTS (3 CLEAN BAYS) ===
      {
        id: 'footballs',
        code: 'WALL 2',
        title: 'COURT & FIELD SPORTS',
        sub: 'Badminton · Football · Volleyball · Basketball',
        pos: [1.89, 2.94, -1.68],
        ry: -Math.PI / 2,
        w: 1.92,
        h: 0.32,
      },
      {
        id: 'badminton',
        code: '04',
        title: 'BADMINTON & RACKETS',
        sub: 'Graphite Frames & Shuttles · ₹1,150+',
        pos: [1.435, 2.4, -0.16],
        ry: -Math.PI / 2,
        w: 1.2,
        h: 0.25,
      },
      {
        id: 'footballs',
        code: '05',
        title: 'FOOTBALL & VOLLEY',
        sub: 'Match Turf & Court Balls · ₹890+',
        pos: [1.435, 2.4, -1.68],
        ry: -Math.PI / 2,
        w: 1.2,
        h: 0.25,
      },
      {
        id: 'basketball-training',
        code: '06',
        title: 'BASKETBALL & GEAR',
        sub: 'Size-7 Match Balls & Cones · ₹950+',
        pos: [1.435, 2.4, -3.2],
        ry: -Math.PI / 2,
        w: 1.2,
        h: 0.25,
      },

      // === WALL 3 (LEFT WALL): BILLING COUNTER, APPAREL/SHOES & TROPHIES/CARROM ===
      {
        id: '__counter',
        code: 'DESK',
        title: 'BILLING & KIT BAG',
        sub: 'WhatsApp Order & Wholesale Counter',
        pos: [-1.73, 1.72, -0.05],
        ry: Math.PI / 2,
        w: 0.92,
        h: 0.25,
      },
      {
        id: 'shoes-jerseys',
        code: 'WALL 3',
        title: 'APPAREL & AWARDS',
        sub: 'Team Jerseys · Shoes · Trophies · Carrom',
        pos: [-1.73, 2.94, -1.65],
        ry: Math.PI / 2,
        w: 1.46,
        h: 0.28,
      },
      {
        id: 'shoes-jerseys',
        code: '07',
        title: 'JERSEYS & SHOES',
        sub: 'Squad Kits & Turf Studs · ₹1,450+',
        pos: [-1.265, 2.4, -1.65],
        ry: Math.PI / 2,
        w: 1.2,
        h: 0.25,
      },
      {
        id: 'trophies-carrom',
        code: '08',
        title: 'TROPHIES & CARROM',
        sub: '22k Gold Cups & Rosewood Boards · ₹1,600+',
        pos: [-1.265, 2.4, -3.19],
        ry: Math.PI / 2,
        w: 1.2,
        h: 0.25,
      },
    ];

    for (const spec of signSpecs) {
      const group = new THREE.Group();
      group.position.set(...spec.pos);
      group.rotation.y = spec.ry;

      const back = new THREE.Mesh(new THREE.BoxGeometry(spec.w + 0.03, spec.h + 0.03, 0.022), backingMat);
      group.add(back);

      const tex = makeWallSignTexture(spec);
      const faceMat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.35,
        metalness: 0.08,
        emissive: new THREE.Color(0xf0be52),
        emissiveIntensity: 0.06,
      });
      const face = new THREE.Mesh(new THREE.PlaneGeometry(spec.w, spec.h), faceMat);
      face.position.z = 0.013;
      face.userData.sectionId = spec.id;
      back.userData.sectionId = spec.id;
      group.add(face);

      this.signsGroup.add(group);
      this.pickables.push(face, back);
      const list = this.wallSigns.get(spec.id) || [];
      list.push({ group, faceMat });
      this.wallSigns.set(spec.id, list);
    }

    // 3D Rack Volume Hitboxes aligned millimeter-for-millimeter with the 3-wall category bays
    const hitboxes = [
      // Wall 1: 100% Dedicated Cricket Wall
      { id: 'willow-bats', center: [0.1, 1.38, -4.38], size: [1.9, 1.4, 0.56] },
      { id: 'tennis-bats', center: [0.1, 0.45, -4.02], size: [1.98, 0.92, 0.68] },
      { id: 'tennis-bats', center: [-0.96, 0.22, -3.56], size: [0.56, 0.44, 0.56] },
      { id: 'cricket-kit', center: [-1.29, 1.25, -4.38], size: [0.86, 2.55, 0.58] },
      { id: 'cricket-kit', center: [1.47, 1.25, -4.35], size: [0.84, 2.55, 0.64] },

      // Wall 2: Right Wall (Badminton R1, Football/Volley R2, Basketball/Training R3)
      { id: 'badminton', center: [1.66, 1.25, -0.16], size: [0.58, 2.55, 1.5] },
      { id: 'footballs', center: [1.66, 1.25, -1.68], size: [0.58, 2.55, 1.5] },
      { id: 'basketball-training', center: [1.66, 1.25, -3.2], size: [0.58, 2.55, 1.5] },

      // Wall 3: Left Wall (Counter, Jerseys & Shoes L2, Trophies & Carrom L3)
      { id: '__counter', center: [-1.05, 0.85, -0.18], size: [1.25, 1.72, 1.55] },
      { id: 'shoes-jerseys', center: [-1.5, 1.25, -1.65], size: [0.58, 2.55, 1.52] },
      { id: 'trophies-carrom', center: [-1.5, 1.48, -3.19], size: [0.58, 3.05, 1.52] },
    ];

    for (const hb of hitboxes) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(...hb.size), hitMat);
      box.position.set(...hb.center);
      box.userData.sectionId = hb.id;
      this.scene.add(box);
      this.pickables.push(box);
    }
  }

  _loadAllShowroomModels() {
    this._loadModel('/models/exterior.glb', (gltf) => {
      const ext = gltf.scene;
      ext.traverse((child) => {
        if (child.isMesh) {
          const matName = child.material?.name || '';
          const isGlass = matName.includes('ShopGlass');
          const isThinWire = child.name.includes('Wire_');
          child.castShadow = !isGlass && !isThinWire;
          child.receiveShadow = !isGlass;
        }
      });
      this.scene.add(ext);
    });

    this._loadModel('/models/interior.glb', (gltf) => {
      const interior = gltf.scene;
      interior.traverse((child) => {
        if (child.name && child.name.includes('ShowroomCeilingFan')) {
          this.ceilingFan = child;
        }
        if (child.isMesh) {
          const matName = child.material?.name || '';
          const isLED = matName.includes('CeilingLED');
          const isGlass = matName.includes('CounterGlass') || matName.includes('RacketStrings');
          child.castShadow = !isLED && !isGlass;
          child.receiveShadow = !isLED;
        }
      });
      this.scene.add(interior);
    });

    this._loadModel('/models/emblem.glb', (gltf) => {
      const counterEmblem = gltf.scene;
      counterEmblem.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = false;
        }
      });
      counterEmblem.rotation.y = (-36 * Math.PI) / 180;
      counterEmblem.scale.setScalar(0.5);
      counterEmblem.position.set(-0.882, 0.41, 0.168);
      this.scene.add(counterEmblem);
    });

    this._loadModel('/models/mascot.glb', (gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      if (size.y > 0) {
        model.scale.multiplyScalar(1.72 / size.y);
      }

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = false;
          child.userData.sectionId = '__counter';
          this.pickables.push(child);
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m) => {
            if (!m) return;
            m.roughness = Math.max(m.roughness ?? 0.78, 0.82);
            m.metalness = 0.0;
            m.envMapIntensity = 0.25;
            m.color.setRGB(0.84, 0.88, 0.92);
            if (m.normalScale) m.normalScale.set(0.14, 0.14);
          });
          if (child.morphTargetDictionary && child.morphTargetInfluences) {
            this.morphMesh = child;
          }
        }
      });

      this.mascot = model;
      this.mascot.position.copy(this.mascotTargetPos);
      this.mascot.rotation.y = this.mascotTargetRotY;
      this.scene.add(this.mascot);

      const shadowMat = new THREE.MeshBasicMaterial({
        map: makeRadialShadowTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0.78,
      });
      this.mascotShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.82), shadowMat);
      this.mascotShadow.rotation.x = -Math.PI / 2;
      this.mascotShadow.position.set(this.mascot.position.x, 0.006, this.mascot.position.z);
      this.scene.add(this.mascotShadow);

      this.mixer = new THREE.AnimationMixer(this.mascot);
      for (const clip of gltf.animations) {
        this.actions.set(clip.name, this.mixer.clipAction(clip));
      }

      this._playAnim(this.mascotDesiredAnim, 0);
      this.mixer.update(0);
      this.mascot.updateMatrixWorld(true);

      let minBoneY = Infinity;
      this.mascot.traverse((obj) => {
        if (obj.isBone && /Foot|Toe/i.test(obj.name)) {
          const wp = new THREE.Vector3();
          obj.getWorldPosition(wp);
          if (wp.y < minBoneY) minBoneY = wp.y;
        }
      });
      this._footOffsetY = Number.isFinite(minBoneY) ? -(minBoneY - 0.032) : 0;
      this.mascot.position.y = this._footOffsetY;
    });
  }

  _playAnim(name, fade = 0.25) {
    const resolved = this.actions.has(name) ? name : 'idle';
    const next = this.actions.get(resolved);
    if (!next || this.currentAnim === next) return;

    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    if (this.currentAnim) {
      this.currentAnim.crossFadeTo(next, fade, true);
    }
    this.currentAnim = next;
  }

  setPaused(paused) {
    this.externalPaused = Boolean(paused);
    this._syncLoopState();
  }

  _syncLoopState() {
    const shouldPause = document.hidden || this.externalPaused;
    if (shouldPause && this._isLoopRunning) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
      this._isLoopRunning = false;
    } else if (!shouldPause && !this._isLoopRunning) {
      this._isLoopRunning = true;
      this.clock.getDelta();
      this._animate();
    }
  }

  /**
   * Used for Exterior Onboarding & Shutter-Welcome states before stepping inside.
   */
  applyStoryState(state) {
    this.exploreMode = false;
    this.walkIn = null;
    this.activeSectionId = null;
    this._lastState = state;

    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    if (aspect < 0.86) {
      const pull = THREE.MathUtils.clamp((0.96 - aspect) * 2.5, 0.45, 1.65);
      const cp = new THREE.Vector3(...state.camPos);
      const ct = new THREE.Vector3(...state.camTarget);
      const ray = cp.clone().sub(ct).normalize();
      cp.addScaledVector(ray, pull);
      ct.y -= 0.18 * pull;
      this.desiredCamPos.copy(cp);
      this.desiredCamTarget.copy(ct);
    } else {
      this.desiredCamPos.set(...state.camPos);
      this.desiredCamTarget.set(...state.camTarget);
    }
    this.shutterOpen = state.shutterOpen;

    const mState = state.mascot || CHAPTERS[0].mascot;
    this.mascotTargetPos.set(...mState.pos);
    this.mascotTargetRotY = mState.rotY;
    this.mascotDesiredAnim = mState.anim;
  }

  /**
   * Smoothly walks the camera across the road, through the open rolling shutter doorway,
   * and into the showroom (2.15s quadratic Bezier glide — ZERO instant teleport!),
   * then seamlessly activates 360° Free-Swipe Explore Mode beside Mansoor at the counter.
   */
  enterExploreMode() {
    this.shutterOpen = 1;
    this.velYaw = 0;

    // Mansoor walks inside ahead of you to welcome you beside the front-left counter
    this.mascotTargetPos.set(-0.56, 0, -0.86);
    this.mascotTargetRotY = 0.62;
    this.mascotDesiredAnim = 'greet';

    const endPos = new THREE.Vector3(0.24, 1.48, 0.12);
    const endLook = new THREE.Vector3(0.08, 1.42, -3.95);

    // Compute matching final yaw/pitch so handoff to 360° swipe has zero jump!
    const fdx = endLook.x - endPos.x;
    const fdy = endLook.y - endPos.y;
    const fdz = endLook.z - endPos.z;
    const endYaw = Math.atan2(-fdx, -fdz);
    const endPitch = THREE.MathUtils.clamp(Math.atan2(fdy, Math.hypot(fdx, fdz)), -0.36, 0.36);

    this.targetStandPos.copy(endPos);
    this.standPos.copy(endPos);
    this.yaw = endYaw;
    this.targetYaw = endYaw;
    this.pitch = endPitch;
    this.targetPitch = endPitch;

    // If camera is currently outside on the road (z > 0.6), play the smooth Walk-In Glide!
    if (this.camera.position.z > 0.6) {
      this.exploreMode = false;
      this.walkIn = {
        t: 0,
        duration: 2.25,
        p0: this.camera.position.clone(),
        p1: new THREE.Vector3(0.32, 1.56, 3.65), // Glides smoothly across road, over turf mat & through shutter!
        p2: endPos.clone(),
        l0: this.currentCamTarget.clone(),
        l1: new THREE.Vector3(0.05, 1.32, -2.05), // Looks straight through doorway into glowing shop
        l2: endLook.clone(),
      };
    } else {
      this.walkIn = null;
      this.exploreMode = true;
    }
  }

  /**
   * Smoothly rotates & steps along the central turf aisle to frame any chosen 3D section!
   */
  focusSection(sectionId) {
    if (this.walkIn) {
      // Finish any in-progress walk-in smoothly into explore mode before focusing
      this.walkIn = null;
      this.standPos.copy(this.camera.position);
      this.exploreMode = true;
    }
    if (!this.exploreMode) this.enterExploreMode();
    if (this.walkIn) {
      this.walkIn = null;
      this.standPos.copy(this.targetStandPos);
      this.exploreMode = true;
    }
    this.activeSectionId = sectionId;

    const spots = {
      __counter: { stand: [0.35, 1.48, -0.55], lookAt: [-0.95, 1.05, -0.22], anim: 'clap' },
      // Wall 1 — 100% Dedicated Cricket Wall (Straight-Ahead)
      'willow-bats': { stand: [0.1, 1.48, -0.95], lookAt: [0.1, 1.44, -4.38], anim: 'point' },
      'tennis-bats': { stand: [0.1, 1.32, -1.65], lookAt: [0.1, 0.72, -4.06], anim: 'point' },
      'cricket-kit': { stand: [0.15, 1.48, -1.25], lookAt: [-0.95, 1.45, -4.4], anim: 'point' },
      // Wall 2 — Right Wall (Court & Field Sports: Badminton, Football/Volley, Basketball/Training)
      badminton: { stand: [-0.42, 1.52, -0.16], lookAt: [1.66, 1.56, -0.16], anim: 'point' },
      footballs: { stand: [-0.42, 1.52, -1.68], lookAt: [1.65, 1.52, -1.68], anim: 'point' },
      'basketball-training': { stand: [-0.42, 1.52, -3.2], lookAt: [1.65, 1.48, -3.2], anim: 'point' },
      // Wall 3 — Left Wall (Apparel/Shoes & Trophies/Carrom)
      'shoes-jerseys': { stand: [0.55, 1.52, -1.65], lookAt: [-1.5, 1.52, -1.65], anim: 'point' },
      'trophies-carrom': { stand: [0.55, 1.52, -3.19], lookAt: [-1.5, 1.58, -3.19], anim: 'clap' },
    };

    const spot = spots[sectionId];
    if (!spot) return;

    this.targetStandPos.set(...spot.stand);
    const dx = spot.lookAt[0] - spot.stand[0];
    const dy = spot.lookAt[1] - spot.stand[1];
    const dz = spot.lookAt[2] - spot.stand[2];
    const horizDist = Math.max(0.001, Math.hypot(dx, dz));
    // Camera looks along (-sin(yaw), pitch, -cos(yaw))
    const desiredYaw = Math.atan2(-dx, -dz);
    const desiredPitch = THREE.MathUtils.clamp(Math.atan2(dy, horizDist), -0.36, 0.36);

    this.targetYaw = shortestYawTarget(this.yaw, desiredYaw);
    this.targetPitch = desiredPitch;
    this.velYaw = 0;

    // Mansoor stays near the counter table and turns warmly toward the customer/rack
    this.mascotTargetPos.set(-0.56, 0, -0.86);
    this.mascotTargetRotY = sectionId === '__counter' ? 0.68 : 0.35;
    this.mascotDesiredAnim = spot.anim || 'greet';
  }

  _pickSectionAt(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const nx = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const ny = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    this.raycaster.setFromCamera({ x: nx, y: ny }, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    for (const h of hits) {
      if (h.object?.userData?.sectionId) {
        return h.object.userData.sectionId;
      }
    }
    return null;
  }

  _bindEvents() {
    this._onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.isMobile = w <= 860;
      this.camera.fov = w > 900 ? 52 : 66;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this._maxPixelRatio()));
      if (!this.exploreMode && this._lastState) {
        this.applyStoryState(this._lastState);
      }
    };

    // Swipe-to-look & Tap-on-3D-Object handlers on the WebGL canvas
    this._onPointerDown = (e) => {
      if (!this.exploreMode) return;
      this._isDragging = true;
      this._dragMoved = 0;
      this._downX = e.clientX;
      this._downY = e.clientY;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
      this.velYaw = 0;
      this.canvas.setPointerCapture?.(e.pointerId);
    };

    this._onPointerMove = (e) => {
      if (!this.exploreMode) return;
      if (this._isDragging) {
        const dx = e.clientX - this._lastX;
        const dy = e.clientY - this._lastY;
        this._lastX = e.clientX;
        this._lastY = e.clientY;
        this._dragMoved += Math.hypot(dx, dy);

        // Natural touch/drag pan: dragging finger left looks right (like turning the shop around you!)
        const sens = this.isMobile ? 0.0052 : 0.0038;
        this.targetYaw += dx * sens;
        this.velYaw = dx * sens * 0.45;
        this.targetPitch = THREE.MathUtils.clamp(this.targetPitch + dy * sens * 0.65, -0.36, 0.38);

        if (this._dragMoved > 10) {
          this.onUserSwipe?.();
        }
        return;
      }

      // Desktop hover highlight on 3D racks & wall signs
      if (!this.isMobile) {
        const hitId = this._pickSectionAt(e.clientX, e.clientY);
        this.hoveredSectionId = hitId;
        this.canvas.style.cursor = hitId ? 'pointer' : 'grab';
      }
    };

    this._onPointerUp = (e) => {
      if (!this.exploreMode || !this._isDragging) return;
      this._isDragging = false;
      this.canvas.releasePointerCapture?.(e.pointerId);

      // Clean tap (< 9px movement) -> check if user tapped a 3D rack, object, or wall sign!
      const totalDist = Math.hypot(e.clientX - this._downX, e.clientY - this._downY);
      if (totalDist < 9 && this._dragMoved < 12) {
        const hitId = this._pickSectionAt(e.clientX, e.clientY);
        if (hitId) {
          this.focusSection(hitId);
          this.onSelectSection?.(hitId);
        }
      }
    };

    // Mouse wheel / trackpad inside shop: walk gently along the central green turf aisle or pan
    this._onWheel = (e) => {
      if (!this.exploreMode) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        this.targetYaw -= e.deltaX * 0.0022;
      } else {
        this.targetStandPos.z = THREE.MathUtils.clamp(
          this.targetStandPos.z + e.deltaY * 0.0018,
          -2.55,
          0.25
        );
      }
      this.onUserSwipe?.();
    };

    this._onVisibility = () => this._syncLoopState();

    window.addEventListener('resize', this._onResize);
    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove, { passive: true });
    window.addEventListener('pointerup', this._onPointerUp);
    this.canvas.addEventListener('wheel', this._onWheel, { passive: true });
    document.addEventListener('visibilitychange', this._onVisibility);
  }

  _animate() {
    if (!this._isLoopRunning) return;
    this._rafId = requestAnimationFrame(() => this._animate());

    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.08);
    this.elapsed += dt;

    if (!this._lowPowerApplied && this.elapsed > 2.5 && rawDt > 0 && rawDt < 0.25) {
      this._fpsFrames += 1;
      this._fpsAccum += rawDt;
      if (this._fpsFrames >= 90) {
        if (this._fpsFrames / this._fpsAccum < 40) this._applyLowPowerFallback();
        this._fpsFrames = 0;
        this._fpsAccum = 0;
      }
    }

    if (this.walkIn) {
      // Smooth 2.15s quadratic Bezier walk-in glide across the road & through the lifted shutter!
      const w = this.walkIn;
      w.t = Math.min(1, w.t + dt / w.duration);
      const s = w.t * w.t * (3 - 2 * w.t); // Smoothstep ease-in-out
      const inv = 1 - s;

      this.camera.position.set(
        inv * inv * w.p0.x + 2 * inv * s * w.p1.x + s * s * w.p2.x,
        inv * inv * w.p0.y + 2 * inv * s * w.p1.y + s * s * w.p2.y,
        inv * inv * w.p0.z + 2 * inv * s * w.p1.z + s * s * w.p2.z
      );
      this.currentCamTarget.set(
        inv * inv * w.l0.x + 2 * inv * s * w.l1.x + s * s * w.l2.x,
        inv * inv * w.l0.y + 2 * inv * s * w.l1.y + s * s * w.l2.y,
        inv * inv * w.l0.z + 2 * inv * s * w.l1.z + s * s * w.l2.z
      );
      this.camera.lookAt(this.currentCamTarget);

      if (w.t >= 1) {
        this.walkIn = null;
        this.standPos.copy(this.camera.position);
        this.targetStandPos.copy(this.camera.position);
        this.exploreMode = true;
      }
    } else if (this.exploreMode) {
      if (!this._isDragging && Math.abs(this.velYaw) > 0.0001) {
        this.targetYaw += this.velYaw;
        this.velYaw *= Math.pow(0.88, dt * 60);
      }

      this.standPos.lerp(this.targetStandPos, Math.min(1, dt * 6));
      this.yaw += (this.targetYaw - this.yaw) * Math.min(1, dt * 8.5);
      this.pitch += (this.targetPitch - this.pitch) * Math.min(1, dt * 8.5);

      this.camera.position.copy(this.standPos);
      const lookDist = 3.0;
      const cosP = Math.cos(this.pitch);
      this.currentCamTarget.set(
        this.standPos.x - Math.sin(this.yaw) * cosP * lookDist,
        this.standPos.y + Math.sin(this.pitch) * lookDist,
        this.standPos.z - Math.cos(this.yaw) * cosP * lookDist
      );
      this.camera.lookAt(this.currentCamTarget);
    } else {
      this.camera.position.lerp(this.desiredCamPos, Math.min(1, dt * 6));
      this.currentCamTarget.lerp(this.desiredCamTarget, Math.min(1, dt * 6));
      this.camera.lookAt(this.currentCamTarget);
    }

    // Live Kadapa road vehicles & spinning wheels (only needs updating while near/outside!)
    if (this.streetTraffic) {
      this.streetTraffic.update(dt);
    }

    // Subtle backlit highlight on hovered or active 3D Wall Signs
    for (const [id, entries] of this.wallSigns.entries()) {
      const isLit = id === this.hoveredSectionId || id === this.activeSectionId;
      const targetEmissive = isLit ? 0.34 : 0.07 + 0.03 * Math.sin(this.elapsed * 2.4);
      for (const entry of entries) {
        entry.faceMat.emissiveIntensity +=
          (targetEmissive - entry.faceMat.emissiveIntensity) * Math.min(1, dt * 10);
      }
    }

    const indoorFactor = THREE.MathUtils.clamp((2.2 - this.camera.position.z) / 2.2, 0, 1);
    if (this.sunLight) {
      this.sunLight.intensity = THREE.MathUtils.lerp(1.95, 0.85, indoorFactor);
    }
    if (this.scene.fog) {
      this.scene.fog.near = THREE.MathUtils.lerp(16, 26, indoorFactor);
    }

    if (this.shutterGroup) {
      const targetScaleY = Math.max(0.05, 1 - this.shutterOpen * 0.95);
      this.shutterGroup.scale.y += (targetScaleY - this.shutterGroup.scale.y) * Math.min(1, dt * 4.5);
    }

    if (this.ceilingFan) {
      this.ceilingFan.rotation.y += dt * 4.2;
    }

    if (this.mascot) {
      let dx = this.mascotTargetPos.x - this.mascot.position.x;
      let dz = this.mascotTargetPos.z - this.mascot.position.z;
      let dist = Math.hypot(dx, dz);

      if (dist > 2.4) {
        this.mascot.position.x = this.mascotTargetPos.x - (dx / dist) * 0.32;
        this.mascot.position.z = this.mascotTargetPos.z - (dz / dist) * 0.32;
        dx = this.mascotTargetPos.x - this.mascot.position.x;
        dz = this.mascotTargetPos.z - this.mascot.position.z;
        dist = Math.hypot(dx, dz);
      }

      if (dist > 0.14) {
        const walkSpeed = Math.min(4.8, 1.45 + dist * 0.75);
        const step = Math.min(dist, walkSpeed * dt);
        this.mascot.position.x += (dx / dist) * step;
        this.mascot.position.z += (dz / dist) * step;
        const moveAngle = Math.atan2(dx, dz);
        this.mascot.rotation.y = lerpAngle(this.mascot.rotation.y, moveAngle, Math.min(1, dt * 8));
        this._playAnim('walk', 0.2);
      } else {
        this.mascot.position.x = this.mascotTargetPos.x;
        this.mascot.position.z = this.mascotTargetPos.z;
        this.mascot.rotation.y = lerpAngle(
          this.mascot.rotation.y,
          this.mascotTargetRotY,
          Math.min(1, dt * 6)
        );
        this._playAnim(this.mascotDesiredAnim, 0.25);
      }

      if (this._footOffsetY !== undefined) {
        this.mascot.position.y = this._footOffsetY;
      }

      if (this.mascotShadow) {
        this.mascotShadow.position.x = this.mascot.position.x;
        this.mascotShadow.position.z = this.mascot.position.z;
      }

      this.mixer?.update(dt);

      if (this.morphMesh?.morphTargetDictionary && this.morphMesh.morphTargetInfluences) {
        const dict = this.morphMesh.morphTargetDictionary;
        const inf = this.morphMesh.morphTargetInfluences;
        const isStanding = dist <= 0.14;
        const isSpeakingPose =
          isStanding && ['greet', 'point', 'thumbs_up', 'clap', 'bow'].includes(this.mascotDesiredAnim);
        if (dict.talk !== undefined) {
          const t = this.elapsed;
          const targetTalk = isSpeakingPose
            ? Math.min(
                0.9,
                Math.max(0, 0.35 + 0.28 * Math.sin(t * 9.5) + 0.2 * Math.sin(t * 15.3) + 0.12 * Math.cos(t * 5.2))
              )
            : 0;
          inf[dict.talk] += (targetTalk - inf[dict.talk]) * Math.min(1, dt * 12);
        }
        if (dict.smile !== undefined) {
          const targetSmile = isStanding ? 0.35 : 0.15;
          inf[dict.smile] += (targetSmile - inf[dict.smile]) * Math.min(1, dt * 8);
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this._rafId);
    window.removeEventListener('resize', this._onResize);
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerup', this._onPointerUp);
    this.canvas.removeEventListener('wheel', this._onWheel);
    document.removeEventListener('visibilitychange', this._onVisibility);
    this.envRT?.dispose();
    this.renderer.dispose();
  }
}

export { ShowroomStage as Phase1Stage };
