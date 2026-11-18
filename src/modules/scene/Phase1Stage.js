import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { CHAPTERS } from '../brand/storeData.js';

function lerpAngle(current, target, t) {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * t;
}

/**
 * Fixed 3D WebGL stage for Phase 1:
 * - Spatial blockout of Sultan Sports Kadapa (street, shutter, green turf, racks, counter)
 * - Rigged mascot.glb with smooth walk-to-target locomotion (never teleports)
 * - Camera + shutter driven by ScrollStoryEngine
 */
export class Phase1Stage {
  constructor(canvas, { onProgress, onReady, onError } = {}) {
    this.canvas = canvas;
    this.onProgress = onProgress;
    this.onReady = onReady;
    this.onError = onError;

    this.clock = new THREE.Clock();
    this.mascot = null;
    this.morphMesh = null;
    this.elapsed = 0;
    this.mixer = null;
    this.actions = new Map();
    this.currentAnim = null;

    this.desiredCamPos = new THREE.Vector3(...CHAPTERS[0].camera.pos);
    this.desiredCamTarget = new THREE.Vector3(...CHAPTERS[0].camera.target);
    this.currentCamTarget = new THREE.Vector3(...CHAPTERS[0].camera.target);

    this.mascotTargetPos = new THREE.Vector3(...CHAPTERS[0].mascot.pos);
    this.mascotTargetRotY = CHAPTERS[0].mascot.rotY;
    this.mascotDesiredAnim = CHAPTERS[0].mascot.anim;
    this.shutterOpen = 0;

    this._rafId = null;
    this._initScene();
    this._buildPhase1Blockout();
    this._bindResize();
    this._loadShopEmblem();
    this._loadMascot();
    this._animate();
  }

  _initScene() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b211a);
    this.scene.fog = new THREE.Fog(0x0b211a, 10, 26);

    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 60);
    this._applyFramingOffset(w, h);
    this.camera.position.copy(this.desiredCamPos);
    this.camera.lookAt(this.currentCamTarget);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Warm Kadapa morning daylight + crisp interior showroom lighting
    const hemi = new THREE.HemisphereLight(0xfff5e0, 0x1a382d, 1.45);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffe8c2, 2.3);
    sun.position.set(4.5, 7.5, 6.0);
    sun.castShadow = true;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 25;
    sun.shadow.camera.left = -8;
    sun.shadow.camera.right = 8;
    sun.shadow.camera.top = 8;
    sun.shadow.camera.bottom = -8;
    this.scene.add(sun);

    const shopFill = new THREE.PointLight(0xfff4de, 3.5, 14, 1.2);
    shopFill.position.set(0, 3.0, -3.2);
    this.scene.add(shopFill);

    // Soft interior front-fill so mascot face & black/gold jersey read crisply inside the shop
    const interiorFrontFill = new THREE.DirectionalLight(0xfff7eb, 1.25);
    interiorFrontFill.position.set(-1.5, 2.2, 3.5);
    this.scene.add(interiorFrontFill);
  }

  _buildPhase1Blockout() {
    // Exterior road / footpath (z > 1.2)
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 7),
      new THREE.MeshStandardMaterial({ color: 0x262b2c, roughness: 0.92 })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, -0.02, 4.7);
    road.receiveShadow = true;
    this.scene.add(road);

    // Showroom green artificial turf floor (z: 1.2 down to -7.5)
    const turf = new THREE.Mesh(
      new THREE.PlaneGeometry(6.8, 9.0),
      new THREE.MeshStandardMaterial({ color: 0x165c36, roughness: 0.95 })
    );
    turf.rotation.x = -Math.PI / 2;
    turf.position.set(0, 0, -3.1);
    turf.receiveShadow = true;
    this.scene.add(turf);

    // Storefront frame walls + back wall
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe6e1d5, roughness: 0.85 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x0b2c22, roughness: 0.55 });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xe8b448,
      roughness: 0.35,
      metalness: 0.55,
    });

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.4, 9.0), wallMat);
    leftWall.position.set(-3.4, 1.7, -3.1);
    leftWall.receiveShadow = true;
    this.scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.4, 9.0), wallMat);
    rightWall.position.set(3.4, 1.7, -3.1);
    rightWall.receiveShadow = true;
    this.scene.add(rightWall);

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(7.0, 3.4, 0.25), wallMat);
    backWall.position.set(0, 1.7, -7.5);
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.2, 9.0), trimMat);
    ceiling.position.set(0, 3.45, -3.1);
    this.scene.add(ceiling);

    // Storefront pillars & signboard header
    const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3.4, 0.35), trimMat);
    leftPillar.position.set(-2.7, 1.7, 1.25);
    leftPillar.castShadow = true;
    this.scene.add(leftPillar);

    const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3.4, 0.35), trimMat);
    rightPillar.position.set(2.7, 1.7, 1.25);
    rightPillar.castShadow = true;
    this.scene.add(rightPillar);

    const headerSign = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.85, 0.4), trimMat);
    headerSign.position.set(0, 3.15, 1.3);
    headerSign.castShadow = true;
    this.scene.add(headerSign);

    const signGoldBorder = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.52, 0.44), goldMat);
    signGoldBorder.position.set(0, 3.15, 1.3);
    this.scene.add(signGoldBorder);

    // Rolling Shutter (rises smoothly with scroll)
    this.shutterGroup = new THREE.Group();
    this.shutterGroup.position.set(0, 2.7, 1.22);
    const shutterMat = new THREE.MeshStandardMaterial({
      color: 0x164a3a,
      roughness: 0.45,
      metalness: 0.4,
    });
    const shutterSheet = new THREE.Mesh(new THREE.BoxGeometry(4.0, 2.7, 0.08), shutterMat);
    shutterSheet.position.set(0, -1.35, 0);
    shutterSheet.castShadow = true;
    this.shutterGroup.add(shutterSheet);

    const shutterBottomBar = new THREE.Mesh(new THREE.BoxGeometry(4.02, 0.1, 0.12), goldMat);
    shutterBottomBar.position.set(0, -2.68, 0);
    this.shutterGroup.add(shutterBottomBar);
    this.scene.add(this.shutterGroup);

    // White vertical bat rack placeholders on the right wall (7 stops for Phase 1 camera test)
    const rackMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.5 });
    const batWoodMat = new THREE.MeshStandardMaterial({ color: 0xd4a977, roughness: 0.65 });
    const gripGreenMat = new THREE.MeshStandardMaterial({ color: 0x38d964, roughness: 0.7 });

    for (let i = 0; i < 7; i++) {
      const z = -1.2 - i * 0.55;
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.1, 0.48), rackMat);
      shelf.position.set(3.0, 1.05, z);
      shelf.castShadow = true;
      shelf.receiveShadow = true;
      this.scene.add(shelf);

      // Stand-in cricket bat silhouette in each rack
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.62, 0.045), batWoodMat);
      blade.position.set(2.86, 0.95, z);
      blade.rotation.z = 0.14;
      this.scene.add(blade);

      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.28, 10), gripGreenMat);
      grip.position.set(2.81, 1.38, z);
      grip.rotation.z = 0.14;
      this.scene.add(grip);

      // Golden trophy placeholder on top shelf
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.04, 0.24, 14), goldMat);
      cup.position.set(2.96, 2.24, z);
      this.scene.add(cup);
    }

    // Wholesale / Dispatch Counter near the back
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.95, 0.75), trimMat);
    counter.position.set(0.55, 0.475, -5.8);
    counter.castShadow = true;
    counter.receiveShadow = true;
    this.scene.add(counter);

    const counterTop = new THREE.Mesh(new THREE.BoxGeometry(2.66, 0.06, 0.8), goldMat);
    counterTop.position.set(0.55, 0.97, -5.8);
    this.scene.add(counterTop);
  }

  _loadShopEmblem() {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    loader.load(
      '/models/emblem.glb',
      (gltf) => {
        const frontEmblem = gltf.scene;
        frontEmblem.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = false;
          }
        });

        // Front face is +X in raw GLB -> rotate -PI/2 around Y to face +Z (street)
        frontEmblem.rotation.y = -Math.PI / 2;
        frontEmblem.scale.setScalar(0.72);
        frontEmblem.position.set(0, 3.15, 1.62);
        this.scene.add(frontEmblem);

        // Second emblem mounted on the back legacy wall inside the shop
        const wallEmblem = frontEmblem.clone(true);
        wallEmblem.scale.setScalar(1.1);
        wallEmblem.position.set(0.45, 2.05, -7.28);
        this.scene.add(wallEmblem);
      },
      undefined,
      (err) => {
        console.warn('Could not load shop emblem GLB:', err);
      }
    );
  }

  _loadMascot() {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    loader.load(
      '/models/mascot.glb',
      (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        if (size.y > 0) {
          model.scale.multiplyScalar(1.72 / size.y);
        }

        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            // Avoid self-shadow acne speckles on skinned character mesh
            child.receiveShadow = false;
            if (child.material) {
              child.material.roughness = Math.max(child.material.roughness ?? 0.75, 0.78);
              child.material.metalness = Math.min(child.material.metalness ?? 0, 0.05);
            }
            if (child.morphTargetDictionary && child.morphTargetInfluences) {
              this.morphMesh = child;
            }
          }
        });

        this.mascot = model;
        this.mascot.position.copy(this.mascotTargetPos);
        this.mascot.rotation.y = this.mascotTargetRotY;
        this.scene.add(this.mascot);

        this.mixer = new THREE.AnimationMixer(this.mascot);
        for (const clip of gltf.animations) {
          this.actions.set(clip.name, this.mixer.clipAction(clip));
        }

        this._playAnim(this.mascotDesiredAnim, 0);
        this.mixer.update(0);
        this.mascot.updateMatrixWorld(true);

        // Ground animated shoes accurately on y = 0
        let minBoneY = Infinity;
        this.mascot.traverse((obj) => {
          if (obj.isBone && /Foot|Toe/i.test(obj.name)) {
            const wp = new THREE.Vector3();
            obj.getWorldPosition(wp);
            if (wp.y < minBoneY) minBoneY = wp.y;
          }
        });
        this._footOffsetY = Number.isFinite(minBoneY) ? -(minBoneY - 0.035) : 0;
        this.mascot.position.y = this._footOffsetY;

        this.onReady?.();
      },
      (xhr) => {
        if (xhr.total > 0) {
          this.onProgress?.(Math.round((xhr.loaded / xhr.total) * 100));
        }
      },
      (err) => {
        console.error('Error loading mascot:', err);
        this.onError?.(err);
      }
    );
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

  applyStoryState(state) {
    this.desiredCamPos.set(...state.camPos);
    this.desiredCamTarget.set(...state.camTarget);
    this.shutterOpen = state.shutterOpen;

    const ch = state.chapter;
    this.mascotTargetPos.set(...ch.mascot.pos);
    this.mascotTargetRotY = ch.mascot.rotY;
    this.mascotDesiredAnim = ch.mascot.anim;
  }

  _applyFramingOffset(w, h) {
    if (w > 820) {
      // Shift 3D center ~17% right so it never overlaps the left story card
      this.camera.fov = 42;
      this.camera.setViewOffset(w, h, -w * 0.17, 0, w, h);
    } else {
      // On mobile/portrait, widen FOV slightly and lift 3D center above bottom card
      this.camera.fov = 52;
      this.camera.setViewOffset(w, h, 0, h * 0.21, w, h);
    }
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _bindResize() {
    this._onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this._applyFramingOffset(w, h);
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', this._onResize);
  }

  _animate() {
    this._rafId = requestAnimationFrame(() => this._animate());
    const dt = Math.min(this.clock.getDelta(), 0.08);
    this.elapsed += dt;

    // Smooth camera follow
    this.camera.position.lerp(this.desiredCamPos, Math.min(1, dt * 7));
    this.currentCamTarget.lerp(this.desiredCamTarget, Math.min(1, dt * 7));
    this.camera.lookAt(this.currentCamTarget);

    // Shutter rises smoothly into header box
    if (this.shutterGroup) {
      const targetScaleY = Math.max(0.06, 1 - this.shutterOpen * 0.94);
      this.shutterGroup.scale.y += (targetScaleY - this.shutterGroup.scale.y) * Math.min(1, dt * 12);
    }

    // Mascot human-speed walk-to-target (hurries if far, never teleports)
    if (this.mascot) {
      const dx = this.mascotTargetPos.x - this.mascot.position.x;
      const dz = this.mascotTargetPos.z - this.mascot.position.z;
      const dist = Math.hypot(dx, dz);

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
      this.mixer?.update(dt);

      // Subtle natural lip cadence + warm smile while presenting (paused while walking)
      if (this.morphMesh?.morphTargetDictionary && this.morphMesh.morphTargetInfluences) {
        const dict = this.morphMesh.morphTargetDictionary;
        const inf = this.morphMesh.morphTargetInfluences;
        const isStanding = dist <= 0.14;
        const isSpeakingPose = isStanding && ['greet', 'point', 'thumbs_up', 'clap', 'bow'].includes(this.mascotDesiredAnim);
        if (dict.talk !== undefined) {
          const t = this.elapsed;
          const targetTalk = isSpeakingPose
            ? Math.min(0.9, Math.max(0, 0.35 + 0.28 * Math.sin(t * 9.5) + 0.2 * Math.sin(t * 15.3) + 0.12 * Math.cos(t * 5.2)))
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
    this.renderer.dispose();
  }
}
