import { MascotTestViewer } from './MascotTestViewer.js';

const LABELS = {
  idle: 'Idle (Counter)',
  walk: 'Walk',
  greet: 'Greet (Wave)',
  point: 'Point (Show Gear)',
  clap: 'Clap (Celebrate)',
  thumbs_up: 'Thumbs Up',
  shake_hands: 'Shake Hands',
  bow: 'Bow (Welcome)',
  lift: 'Lift (Shutter)',
  inspect: 'Inspect (Workshop)',
};

const stage = document.getElementById('stage');
const controlsWrap = document.getElementById('anim-buttons');
const statusEl = document.getElementById('status');

const viewer = new MascotTestViewer(stage, {
  onProgress(pct) {
    statusEl.textContent = `Loading 3D mascot... ${pct}%`;
  },
  onLoaded({ animations }) {
    statusEl.textContent = `Ready · ${animations.length} moves loaded (drag to rotate, scroll to zoom)`;
    controlsWrap.innerHTML = '';

    animations.forEach((name) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'anim-btn' + (name === 'idle' ? ' active' : '');
      btn.textContent = LABELS[name] || name;
      btn.dataset.anim = name;

      btn.addEventListener('click', () => {
        viewer.play(name);
        controlsWrap.querySelectorAll('.anim-btn').forEach((b) => {
          b.classList.toggle('active', b === btn);
        });
      });

      controlsWrap.appendChild(btn);
    });

    const talkBtn = document.createElement('button');
    talkBtn.type = 'button';
    talkBtn.className = 'anim-btn active';
    talkBtn.style.marginTop = '10px';
    talkBtn.textContent = 'Lip Movement: ON';
    let talking = true;
    talkBtn.addEventListener('click', () => {
      talking = !talking;
      viewer.setTalking(talking);
      talkBtn.classList.toggle('active', talking);
      talkBtn.textContent = talking ? 'Lip Movement: ON' : 'Lip Movement: OFF';
    });
    controlsWrap.appendChild(talkBtn);
  },
  onError() {
    statusEl.textContent = 'Error loading public/models/mascot.glb — check console.';
  },
});

viewer.load('/models/mascot.glb');
