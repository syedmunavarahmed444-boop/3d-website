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

/**
 * Full 3D WebGL Showroom Stage:
 * - Distortion-free natural human-eye camera + gentle pointer parallax
 * - Real RoomEnvironment HDRI reflections so brass/gold trophies, glass counter & willow bats gleam
 * - Animated ceiling fan, rolling entrance shutter, and walk-to-target mascot locomotion
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
    this.ceilingFan = null;
    this.elapsed = 0;
    this.mixer = null;
    this.actions = new Map();
    this.currentAnim = null;

    this.desiredCamPos = new THREE.Vector3(...CHAPTERS[0].camera.pos);
    this.desiredCamTarget = new THREE.Vector3(...CHAPTERS[0].camera.target);
    this.currentCamTarget = new THREE.Vector3(...CHAPTERS[0].camera.target);
    this.pointerOffset = new THREE.Vector2(0, 0);
    this.smoothPointer = new THREE.Vector2(0, 0);

    this.mascotTargetPos = new THREE.Vector3(...CHAPTERS[0].mascot.pos);
    this.mascotTargetRotY = CHAPTERS[0].mascot.rotY;
    this.mascotDesiredAnim = CHAPTERS[0].mascot.anim;
    this.shutterOpen = 0;

    this._rafId = null;
    this._initScene();
    this._buildShutter();
    this._loadExterior();
    this._loadInterior();
    this._bindEvents();
    this._loadShopEmblem();
    this._loadMascot();
    this._animate();
  }

  _initScene() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fbbe0);
    this.scene.fog = new THREE.Fog(0x9ac3e3, 18, 44);

    // Distortion-free centered human-eye lens (no frustum shear!)
    this.camera = new THREE.PerspectiveCamera(w > 900 ? 48 : 58, w / h, 0.1, 60);
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
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Baked PBR showroom environment reflections (makes metallic gold trophies & glossy bats gleam)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.62;
    pmrem.dispose();

    const hemi = new THREE.HemisphereLight(0xfff9ee, 0x3b4d40, 1.25);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffe7bd, 2.35);
    sun.position.set(5.5, 8.5, 7.5);
    sun.castShadow = true;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 30;
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -6;
    this.scene.add(sun);

    const shopFrontLED = new THREE.PointLight(0xfffaf0, 3.4, 9.5, 1.2);
    shopFrontLED.position.set(0.05, 2.92, -0.45);
    this.scene.add(shopFrontLED);

    const shopBackLED = new THREE.PointLight(0xfff6e5, 4.0, 10.5, 1.2);
    shopBackLED.position.set(0.1, 2.92, -3.25);
    this.scene.add(shopBackLED);

    const interiorFrontFill = new THREE.DirectionalLight(0xfff7eb, 0.95);
    interiorFrontFill.position.set(0.8, 2.1, 4.0);
    this.scene.add(interiorFrontFill);
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

  _loadExterior() {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    loader.load(
      '/models/exterior.glb',
      (gltf) => {
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
      },
      undefined,
      (err) => {
        console.warn('Could not load exterior.glb:', err);
      }
    );
  }

  _loadInterior() {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    loader.load(
      '/models/interior.glb',
      (gltf) => {
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
      },
      undefined,
      (err) => {
        console.warn('Could not load interior.glb:', err);
      }
    );
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

        // Mounted flush on the 36°-angled Front-Left Corner Showcase Counter facing the entrance
        const counterEmblem = frontEmblem;
        counterEmblem.rotation.y = (-36 * Math.PI) / 180;
        counterEmblem.scale.setScalar(0.5);
        counterEmblem.position.set(-0.922, 0.41, 0.138);
        this.scene.add(counterEmblem);
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
            child.receiveShadow = false;
            if (child.material) {
              child.material.roughness = Math.max(child.material.roughness ?? 0.75, 0.78);
              child.material.metalness = Math.min(child.material.metalness ?? 0, 0.05);
              child.material.envMapIntensity = 0.35;
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

  _bindEvents() {
    this._onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.fov = w > 900 ? 48 : 58;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    this._onPointerMove = (e) => {
      const nx = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      const ny = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
      this.pointerOffset.set(nx * 0.14, -ny * 0.07);
    };
    window.addEventListener('resize', this._onResize);
    window.addEventListener('pointermove', this._onPointerMove, { passive: true });
  }

  _animate() {
    this._rafId = requestAnimationFrame(() => this._animate());
    const dt = Math.min(this.clock.getDelta(), 0.08);
    this.elapsed += dt;

    this.smoothPointer.lerp(this.pointerOffset, Math.min(1, dt * 4));

    // Smooth steadycam follow + subtle natural look-around parallax
    this.camera.position.lerp(this.desiredCamPos, Math.min(1, dt * 6));
    this.currentCamTarget.lerp(this.desiredCamTarget, Math.min(1, dt * 6));
    this.camera.lookAt(
      this.currentCamTarget.x + this.smoothPointer.x,
      this.currentCamTarget.y + this.smoothPointer.y,
      this.currentCamTarget.z
    );

    if (this.shutterGroup) {
      const targetScaleY = Math.max(0.06, 1 - this.shutterOpen * 0.94);
      this.shutterGroup.scale.y += (targetScaleY - this.shutterGroup.scale.y) * Math.min(1, dt * 12);
    }

    if (this.ceilingFan) {
      this.ceilingFan.rotation.y += dt * 4.2;
    }

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
    this.envRT?.dispose();
    this.renderer.dispose();
  }
}
