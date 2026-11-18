import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/**
 * Interactive 3D Mascot animation tester for verifying rigged GLB moves.
 */
export class MascotTestViewer {
  constructor(container, { onLoaded, onProgress, onError } = {}) {
    this.container = container;
    this.onLoaded = onLoaded;
    this.onProgress = onProgress;
    this.onError = onError;

    this.clock = new THREE.Clock();
    this.mixer = null;
    this.actions = new Map();
    this.currentAction = null;
    this.currentName = null;
    this.morphMesh = null;
    this.talkEnabled = true;
    this.elapsed = 0;
    this._rafId = null;

    this._initScene();
    this._bindResize();
    this._animate();
  }

  _initScene() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b201a);

    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    this.camera.position.set(0.7, 1.35, 3.35);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.28;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0.92, 0);
    this.controls.minDistance = 1.1;
    this.controls.maxDistance = 6;
    this.controls.update();

    const hemi = new THREE.HemisphereLight(0xfff7e6, 0x23453a, 1.75);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff3dd, 2.4);
    key.position.set(2.5, 4.2, 3.0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 12;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xd9f2e8, 0.9);
    fill.position.set(-2.0, 1.8, 2.6);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0x9ee0c9, 1.0);
    rim.position.set(-2.5, 2.8, -2.5);
    this.scene.add(rim);

    const floorGeo = new THREE.CircleGeometry(2.2, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x102c24,
      roughness: 0.85,
      metalness: 0.05,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const grid = new THREE.PolarGridHelper(2.2, 8, 4, 48, 0x265949, 0x193d32);
    grid.position.y = 0.002;
    this.scene.add(grid);
  }

  load(url) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;

        // Normalize height to ~1.72m and place feet at y = 0
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        if (size.y > 0) {
          const targetHeight = 1.72;
          const scale = targetHeight / size.y;
          model.scale.multiplyScalar(scale);
        }

        model.updateMatrixWorld(true);
        const scaledBox = new THREE.Box3().setFromObject(model);
        const center = scaledBox.getCenter(new THREE.Vector3());
        model.position.x -= center.x;
        model.position.z -= center.z;
        model.position.y -= scaledBox.min.y;

        model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
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

        this.scene.add(model);

        this.mixer = new THREE.AnimationMixer(model);
        const names = [];
        for (const clip of gltf.animations) {
          const action = this.mixer.clipAction(clip);
          this.actions.set(clip.name, action);
          names.push(clip.name);
        }

        if (names.length > 0) {
          this.play(names.includes('idle') ? 'idle' : names[0], 0);
          this.mixer.update(0);
          model.updateMatrixWorld(true);

          // Ground animated feet cleanly onto y = 0 using toe/foot bones
          let minBoneY = Infinity;
          model.traverse((obj) => {
            if (obj.isBone && /Foot|Toe/i.test(obj.name)) {
              const pos = new THREE.Vector3();
              obj.getWorldPosition(pos);
              if (pos.y < minBoneY) minBoneY = pos.y;
            }
          });
          if (Number.isFinite(minBoneY)) {
            model.position.y -= minBoneY - 0.035;
          }
        }

        this.onLoaded?.({ animations: names });
      },
      (xhr) => {
        if (xhr.total > 0) {
          this.onProgress?.(Math.round((xhr.loaded / xhr.total) * 100));
        }
      },
      (err) => {
        console.error('Failed to load mascot GLB:', err);
        this.onError?.(err);
      }
    );
  }

  play(name, fadeDuration = 0.28) {
    const next = this.actions.get(name);
    if (!next) return;
    if (this.currentAction === next) {
      next.reset().play();
      return;
    }

    next.reset();
    next.setEffectiveTimeScale(1);
    next.setEffectiveWeight(1);
    next.play();

    if (this.currentAction) {
      this.currentAction.crossFadeTo(next, fadeDuration, true);
    }

    this.currentAction = next;
    this.currentName = name;
  }

  _bindResize() {
    this._onResize = () => {
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', this._onResize);
  }

  setTalking(enabled) {
    this.talkEnabled = Boolean(enabled);
  }

  _animate() {
    this._rafId = requestAnimationFrame(() => this._animate());
    const delta = Math.min(this.clock.getDelta(), 0.1);
    this.elapsed += delta;
    this.mixer?.update(delta);

    // Subtle natural lip cadence + warm smile via morph targets
    if (this.morphMesh?.morphTargetDictionary && this.morphMesh.morphTargetInfluences) {
      const dict = this.morphMesh.morphTargetDictionary;
      const inf = this.morphMesh.morphTargetInfluences;
      if (dict.talk !== undefined) {
        const t = this.elapsed;
        const speech =
          this.talkEnabled
            ? Math.max(0, 0.42 + 0.32 * Math.sin(t * 9.5) + 0.22 * Math.sin(t * 15.3) + 0.14 * Math.cos(t * 5.2))
            : 0;
        inf[dict.talk] += (Math.min(1, speech) - inf[dict.talk]) * Math.min(1, delta * 14);
      }
      if (dict.smile !== undefined) {
        const targetSmile = this.talkEnabled ? 0.35 : 0.18;
        inf[dict.smile] += (targetSmile - inf[dict.smile]) * Math.min(1, delta * 8);
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this._rafId);
    window.removeEventListener('resize', this._onResize);
    this.controls.dispose();
    this.renderer.dispose();
  }
}
