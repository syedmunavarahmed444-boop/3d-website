import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CHAPTERS } from '../brand/storeData.js';

function lerpAngle(current, target, t) {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * t;
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

function makeHeldM4BatTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#dbb078';
  ctx.fillRect(0, 0, 128, 512);
  ctx.fillStyle = 'rgba(115, 68, 22, 0.22)';
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(10 + i * 15, 0, 2, 485);
  }
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 4;
  ctx.fillRect(16, 64, 96, 150);
  ctx.strokeRect(16, 64, 96, 150);
  ctx.fillStyle = '#dc2626';
  ctx.font = '900 44px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('M4', 64, 118);
  ctx.fillStyle = '#1e3a8a';
  ctx.font = '800 13px Arial';
  ctx.fillText('BEAST PRO', 64, 145);
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(22, 162, 84, 24);
  ctx.fillStyle = '#fde047';
  ctx.font = '900 12px Arial';
  ctx.fillText('SULTAN', 64, 179);
  ctx.fillStyle = '#b91c1c';
  ctx.fillRect(0, 484, 128, 28);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Full 3D WebGL Showroom Stage:
 * - Unified single _loadModel() helper backed by THREE.LoadingManager
 * - Adaptive mobile quality (1.5x pixelRatio cap, 1024 shadow map) + <40fps auto quality governor
 * - Automatic render-loop pause when browser tab is hidden or Classic View is open
 * - Bone-locked held M4 bat, grounded contact shadows & aspect-aware portrait framing
 */
export class ShowroomStage {
  constructor(canvas, { onProgress, onReady, onError } = {}) {
    this.canvas = canvas;
    this.onProgress = onProgress;
    this.onReady = onReady;
    this.onError = onError;

    this.clock = new THREE.Clock();
    this.mascot = null;
    this.mascotShadow = null;
    this.heldBat = null;
    this.morphMesh = null;
    this.ceilingFan = null;
    this.elapsed = 0;
    this.mixer = null;
    this.actions = new Map();
    this.currentAnim = null;
    this.isMobile = window.innerWidth <= 860;

    // Render pause & adaptive FPS governor state
    this.externalPaused = false;
    this._isLoopRunning = false;
    this._fpsFrames = 0;
    this._fpsAccum = 0;
    this._lowPowerApplied = false;

    this.desiredCamPos = new THREE.Vector3(...CHAPTERS[0].camera.pos);
    this.desiredCamTarget = new THREE.Vector3(...CHAPTERS[0].camera.target);
    this.currentCamTarget = new THREE.Vector3(...CHAPTERS[0].camera.target);
    this.pointerOffset = new THREE.Vector2(0, 0);
    this.smoothPointer = new THREE.Vector2(0, 0);

    this.mascotTargetPos = new THREE.Vector3(...CHAPTERS[0].mascot.pos);
    this.mascotTargetRotY = CHAPTERS[0].mascot.rotY;
    this.mascotDesiredAnim = CHAPTERS[0].mascot.anim;
    this.shutterOpen = 0;

    this._initLoadingManager();
    this._rafId = null;
    this._initScene();
    this._buildShutter();
    this._buildAmbientFloorAO();
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

    this.camera = new THREE.PerspectiveCamera(w > 900 ? 48 : 62, w / h, 0.1, 60);
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
    this.renderer.toneMappingExposure = 0.94;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.58;
    pmrem.dispose();

    this.hemiLight = new THREE.HemisphereLight(0xfff8ed, 0x324238, 0.88);
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
      this.hemiLight.intensity = 1.05;
    }

    const interiorFrontFill = new THREE.DirectionalLight(0xfff6eb, 0.52);
    interiorFrontFill.position.set(0.6, 2.0, 3.6);
    this.scene.add(interiorFrontFill);
  }

  _applyLowPowerFallback() {
    if (this._lowPowerApplied) return;
    this._lowPowerApplied = true;
    this.renderer.setPixelRatio(1.0);
    if (this.indoorSpot) {
      this.indoorSpot.castShadow = false;
    }
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

  _buildHeldBatProp() {
    const group = new THREE.Group();
    const batTex = makeHeldM4BatTexture();
    const willowMat = new THREE.MeshStandardMaterial({ color: 0xd4a46a, roughness: 0.45 });
    const faceMat = new THREE.MeshStandardMaterial({ map: batTex, roughness: 0.38 });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.62 });
    const scoopMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.7 });

    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.106, 0.52, 0.034),
      [willowMat, willowMat, willowMat, willowMat, faceMat, willowMat]
    );
    blade.position.set(0, -0.32, 0);
    blade.castShadow = true;
    group.add(blade);

    for (const sy of [-0.4, -0.22]) {
      const scoop = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.13, 14), scoopMat);
      scoop.scale.set(1, 1, 0.25);
      scoop.position.set(0, sy, -0.017);
      group.add(scoop);
    }

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.27, 14), gripMat);
    handle.position.set(0, 0.075, 0);
    handle.castShadow = true;
    group.add(handle);

    group.visible = false;
    this.scene.add(group);
    return group;
  }

  _loadAllShowroomModels() {
    // 1. Exterior Street & Storefront
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

    // 2. Interior Showroom & 7 Stocked Racks
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

    // 3. 3D Gold Sultan Sports Counter Crest
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

    // 4. Rigged Store Host (Mansoor)
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
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m) => {
            if (!m) return;
            m.roughness = Math.max(m.roughness ?? 0.78, 0.82);
            m.metalness = 0.0;
            m.envMapIntensity = 0.25;
            m.color.setRGB(0.84, 0.88, 0.92);
            if (m.normalScale) {
              m.normalScale.set(0.14, 0.14);
            }
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

      this.heldBat = this._buildHeldBatProp();

      this.mixer = new THREE.AnimationMixer(this.mascot);
      for (const clip of gltf.animations) {
        this.actions.set(clip.name, this.mixer.clipAction(clip));
      }

      this._playAnim(this.mascotDesiredAnim, 0);
      this.mixer.update(0);
      this.mascot.updateMatrixWorld(true);

      let minBoneY = Infinity;
      this.leftHandBone = null;
      this.rightHandBone = null;
      this._lhWorld = new THREE.Vector3();
      this._rhWorld = new THREE.Vector3();
      this.mascot.traverse((obj) => {
        if (obj.isBone) {
          if (/Foot|Toe/i.test(obj.name)) {
            const wp = new THREE.Vector3();
            obj.getWorldPosition(wp);
            if (wp.y < minBoneY) minBoneY = wp.y;
          }
          if (/LeftHand$/i.test(obj.name)) this.leftHandBone = obj;
          if (/RightHand$/i.test(obj.name)) this.rightHandBone = obj;
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
      this.clock.getDelta(); // Flush stale elapsed delta
      this._animate();
    }
  }

  applyStoryState(state) {
    this._lastState = state;
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    if (aspect < 0.86) {
      // Lift 3D subjects into the upper open half of mobile portrait screens above the story card
      const pull = THREE.MathUtils.clamp((0.96 - aspect) * 2.8, 0.5, 1.6);
      const cp = new THREE.Vector3(...state.camPos);
      const ct = new THREE.Vector3(...state.camTarget);
      const ray = cp.clone().sub(ct).normalize();
      cp.addScaledVector(ray, pull);
      if (state.camPos[2] < 1.0) {
        cp.z = Math.min(0.92, cp.z);
        cp.x = THREE.MathUtils.clamp(cp.x, -1.2, 1.28);
      }
      ct.y -= 0.36 * pull;
      this.desiredCamPos.copy(cp);
      this.desiredCamTarget.copy(ct);
    } else {
      this.desiredCamPos.set(...state.camPos);
      this.desiredCamTarget.set(...state.camTarget);
    }
    this.shutterOpen = state.shutterOpen;

    const mState = state.mascot || state.chapter.mascot;
    this.mascotTargetPos.set(...mState.pos);
    this.mascotTargetRotY = mState.rotY;
    this.mascotDesiredAnim = mState.anim;
  }

  _bindEvents() {
    this._onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.isMobile = w <= 860;
      this.camera.fov = w > 900 ? 48 : 62;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this._maxPixelRatio()));
      if (this._lastState) this.applyStoryState(this._lastState);
    };
    this._onPointerMove = (e) => {
      const nx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      const ny = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
      this.pointerOffset.set(nx * 0.12, -ny * 0.06);
    };
    this._onVisibility = () => this._syncLoopState();

    window.addEventListener('resize', this._onResize);
    window.addEventListener('pointermove', this._onPointerMove, { passive: true });
    document.addEventListener('visibilitychange', this._onVisibility);
  }

  _animate() {
    if (!this._isLoopRunning) return;
    this._rafId = requestAnimationFrame(() => this._animate());

    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.08);
    this.elapsed += dt;

    // Adaptive <40fps quality governor after initial warm-up
    if (!this._lowPowerApplied && this.elapsed > 2.5 && rawDt > 0 && rawDt < 0.25) {
      this._fpsFrames += 1;
      this._fpsAccum += rawDt;
      if (this._fpsFrames >= 90) {
        const avgFps = this._fpsFrames / this._fpsAccum;
        if (avgFps < 40) {
          this._applyLowPowerFallback();
        }
        this._fpsFrames = 0;
        this._fpsAccum = 0;
      }
    }

    this.smoothPointer.lerp(this.pointerOffset, Math.min(1, dt * 4));

    this.camera.position.lerp(this.desiredCamPos, Math.min(1, dt * 6));
    this.currentCamTarget.lerp(this.desiredCamTarget, Math.min(1, dt * 6));
    this.camera.lookAt(
      this.currentCamTarget.x + this.smoothPointer.x,
      this.currentCamTarget.y + this.smoothPointer.y,
      this.currentCamTarget.z
    );

    const indoorFactor = THREE.MathUtils.clamp((2.2 - this.camera.position.z) / 2.2, 0, 1);
    if (this.sunLight) {
      this.sunLight.intensity = THREE.MathUtils.lerp(1.95, 0.85, indoorFactor);
    }
    if (this.scene.fog) {
      this.scene.fog.near = THREE.MathUtils.lerp(16, 26, indoorFactor);
    }

    if (this.shutterGroup) {
      const targetScaleY = Math.max(0.05, 1 - this.shutterOpen * 0.95);
      this.shutterGroup.scale.y += (targetScaleY - this.shutterGroup.scale.y) * Math.min(1, dt * 12);
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

      if (this.heldBat) {
        const showBat = dist <= 0.2 && this.mascotDesiredAnim === 'inspect';
        this.heldBat.visible = showBat;
        if (showBat) {
          this.mascot.updateMatrixWorld(true);
          const yaw = this.mascot.rotation.y;
          if (this.leftHandBone && this.rightHandBone) {
            this.leftHandBone.getWorldPosition(this._lhWorld);
            this.rightHandBone.getWorldPosition(this._rhWorld);
            this.heldBat.position.lerpVectors(this._lhWorld, this._rhWorld, 0.5);
            this.heldBat.position.y -= 0.02;
          } else {
            this.heldBat.position.set(
              this.mascot.position.x + Math.sin(yaw) * 0.32,
              1.12,
              this.mascot.position.z + Math.cos(yaw) * 0.32
            );
          }
          this.heldBat.rotation.set(-0.62, yaw + 0.32, 0.52);
        }
      }

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
    window.removeEventListener('pointermove', this._onPointerMove);
    document.removeEventListener('visibilitychange', this._onVisibility);
    this.envRT?.dispose();
    this.renderer.dispose();
  }
}

export { ShowroomStage as Phase1Stage };
