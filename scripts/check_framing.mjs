import * as THREE from 'three';
import { CHAPTERS } from '../src/modules/brand/storeData.js';

const VIEWPORTS = [
  { name: 'Desktop 1440x900', w: 1440, h: 900, mobile: false },
  { name: 'Laptop 1280x800', w: 1280, h: 800, mobile: false },
  { name: 'Mobile 390x844', w: 390, h: 844, mobile: true },
];

for (const vp of VIEWPORTS) {
  console.log(`\n=== ${vp.name} ===`);
  const cam = new THREE.PerspectiveCamera(vp.mobile ? 52 : 42, vp.w / vp.h, 0.1, 60);
  if (!vp.mobile) {
    cam.setViewOffset(vp.w, vp.h, -vp.w * 0.17, 0, vp.w, vp.h);
  } else {
    cam.setViewOffset(vp.w, vp.h, 0, vp.h * 0.21, vp.w, vp.h);
  }
  cam.updateProjectionMatrix();

  // Approximate story card bounds
  const cardRight = vp.mobile ? vp.w - 12 : Math.max(18, Math.min(52, vp.w * 0.04)) + Math.min(410, vp.w * 0.38);
  const cardTop = vp.mobile ? vp.h - 330 : 0;

  let minGap = Infinity;
  for (const ch of CHAPTERS) {
    cam.position.set(...ch.camera.pos);
    cam.lookAt(...ch.camera.target);
    cam.updateMatrixWorld(true);

    // Project mascot bounding corners (width ~0.65m around center, height 0..1.72m)
    const [mx, my, mz] = ch.mascot.pos;
    const pts = [
      new THREE.Vector3(mx - 0.32, my, mz),
      new THREE.Vector3(mx + 0.32, my, mz),
      new THREE.Vector3(mx - 0.32, my + 1.72, mz),
      new THREE.Vector3(mx + 0.32, my + 1.72, mz),
    ];

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      p.project(cam);
      const sx = (p.x * 0.5 + 0.5) * vp.w;
      const sy = (-p.y * 0.5 + 0.5) * vp.h;
      minX = Math.min(minX, sx);
      maxX = Math.max(maxX, sx);
      minY = Math.min(minY, sy);
      maxY = Math.max(maxY, sy);
    }

    const gap = vp.mobile ? Math.round(cardTop - maxY) : Math.round(minX - cardRight);
    minGap = Math.min(minGap, gap);
    const inBounds = minX >= 0 && maxX <= vp.w && minY >= 0 && maxY <= vp.h;
    console.log(
      `${ch.label.padEnd(10)} mascotX=[${Math.round(minX)},${Math.round(maxX)}] mascotY=[${Math.round(minY)},${Math.round(maxY)}] gap=${gap}px inFrame=${inBounds}`
    );
  }
  console.log(`Smallest gap: ${minGap}px`);
}
