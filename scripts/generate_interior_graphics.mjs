import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'assets', 'textures', 'interior');
const TEMP_HTML = path.join(ROOT, 'scripts', 'temp', 'interior_html');
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(TEMP_HTML, { recursive: true });

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EMBLEM_DATA = `data:image/png;base64,${fs
  .readFileSync(path.join(ROOT, 'public', 'brand', 'sultan_emblem.png'))
  .toString('base64')}`;

// CPU-only headless screenshot (--disable-gpu keeps 0% GPU impact while gaming)
function renderGraphic(name, width, height, html) {
  const htmlPath = path.join(TEMP_HTML, `${name}.html`);
  const pngPath = path.join(OUT_DIR, `${name}.png`);
  fs.writeFileSync(
    htmlPath,
    `<!doctype html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box;margin:0;padding:0;}
      html,body{width:${width}px;height:${height}px;overflow:hidden;font-family:'Segoe UI',Arial,sans-serif;}
    </style></head><body>${html}</body></html>`
  );
  execFileSync(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--disable-software-rasterizer=false',
      '--hide-scrollbars',
      `--window-size=${width},${height}`,
      `--screenshot=${pngPath}`,
      pathToFileURL(htmlPath).href,
    ],
    { stdio: 'pipe' }
  );
  console.log(`Generated ${name}.png (${width}x${height})`);
}

// 1. Back-Wall Hero Banner ("SULTAN SPORTS - WHOLESALE PRICES - Cell: 6303974896, 9110744845")
renderGraphic(
  'sultan_indoor_banner',
  1536,
  768,
  `<div style="width:100%;height:100%;background:radial-gradient(circle at 28% 40%,#2a5cfa 0%,#143296 55%,#0b1d63 100%);border:14px solid #cbd5e1;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden;">
    <div style="display:flex;flex:1;align-items:center;padding:24px 36px;gap:28px;">
      <div style="width:42%;height:100%;background:radial-gradient(circle,#3b82f6 0%,#1d4ed8 62%,rgba(15,23,42,0.7) 100%);border-radius:20px;border:4px solid rgba(255,215,64,0.65);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;position:relative;box-shadow:0 12px 30px rgba(0,0,0,0.45);">
        <img src="${EMBLEM_DATA}" style="width:270px;height:270px;object-fit:contain;filter:drop-shadow(0 10px 18px rgba(0,0,0,0.55));" />
        <div style="margin-top:10px;background:#facc15;color:#0f172a;font-weight:900;font-size:24px;padding:6px 20px;border-radius:999px;letter-spacing:1.5px;">CHAMPIONS CHOICE · KADAPA</div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
        <div style="font-size:158px;font-weight:900;font-style:italic;line-height:0.9;color:#fde047;letter-spacing:4px;-webkit-text-stroke:5px #0f172a;text-shadow:0 10px 0 #091540,0 16px 28px rgba(0,0,0,0.55);">SULTAN</div>
        <div style="font-size:126px;font-weight:900;font-style:italic;line-height:0.95;color:#f8fafc;letter-spacing:6px;-webkit-text-stroke:4px #0f172a;text-shadow:0 8px 0 #091540;margin-top:6px;">SPORTS</div>
        <div style="margin-top:22px;background:linear-gradient(90deg,#facc15 0%,#eab308 100%);color:#0f172a;padding:10px 44px;border-radius:10px;font-size:38px;font-weight:900;letter-spacing:3px;box-shadow:0 6px 16px rgba(0,0,0,0.4);border:3px solid #fff;">
          ★ WHOLESALE PRICES ★
        </div>
      </div>
    </div>
    <div style="height:112px;background:linear-gradient(90deg,#091540 0%,#112266 100%);border-top:5px solid #fde047;display:flex;align-items:center;justify-content:center;gap:22px;padding:0 32px;">
      <span style="width:54px;height:54px;border-radius:50%;background:#22c55e;border:4px solid #fff;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:30px;font-weight:900;">✆</span>
      <span style="font-size:58px;font-weight:900;color:#fde047;letter-spacing:2px;text-shadow:0 4px 10px rgba(0,0,0,0.6);">Cell:- 6303974896, 9110744845</span>
    </div>
  </div>`
);

// Helper for realistic willow cricket bat blade face texture
function willowBase(innerHtml, toeColor = '#dc2626') {
  const grains = Array.from({ length: 9 })
    .map(
      (_, i) =>
        `<div style="position:absolute;top:0;bottom:0;left:${9 + i * 10.2}%;width:2px;background:rgba(138,94,48,0.18);"></div>`
    )
    .join('');
  return `<div style="width:100%;height:100%;background:linear-gradient(90deg,#e7cda5 0%,#f3dfc1 22%,#f6e7ce 50%,#eed7b3 78%,#dfbe91 100%);position:relative;display:flex;flex-direction:column;align-items:center;">
    ${grains}
    <div style="position:relative;z-index:2;width:100%;flex:1;display:flex;flex-direction:column;align-items:center;">
      ${innerHtml}
    </div>
    <div style="position:relative;z-index:2;width:100%;height:44px;background:${toeColor};border-top:5px solid #1e293b;"></div>
  </div>`;
}

// 2. Six Cricket Bat Face Stickers (M4 Beast Edition, MRF, TON, SG, CEAT, Kookaburra)
renderGraphic(
  'bat_m4',
  256,
  1024,
  willowBase(`
    <div style="margin-top:110px;width:208px;background:#fff;border:6px solid #1e3a8a;border-radius:16px 16px 90px 90px;padding:16px 12px 28px;text-align:center;box-shadow:0 6px 14px rgba(0,0,0,0.18);">
      <div style="font-size:84px;font-weight:900;line-height:0.9;background:linear-gradient(135deg,#1d4ed8 0%,#dc2626 100%);-webkit-background-clip:text;color:transparent;">M4</div>
      <div style="font-size:22px;font-weight:900;color:#0f172a;letter-spacing:2px;margin-top:4px;">SPORTS</div>
      <div style="margin-top:10px;background:#dc2626;color:#fff;font-size:18px;font-weight:900;padding:5px 8px;border-radius:6px;">BEAST EDITION</div>
      <div style="margin-top:10px;font-size:15px;font-weight:800;color:#1e3a8a;">HARD TENNIS · KASHMIR</div>
    </div>
    <div style="margin-top:46px;display:flex;gap:18px;">
      <div style="width:36px;height:36px;border-radius:50%;border:4px solid #78350f;background:#fef3c7;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;color:#78350f;">M4</div>
      <div style="width:36px;height:36px;border-radius:50%;border:4px solid #1e3a8a;background:#dbeafe;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;color:#1e3a8a;">PRO</div>
    </div>
  `)
);

renderGraphic(
  'bat_mrf',
  256,
  1024,
  willowBase(`
    <div style="margin-top:120px;width:204px;background:#dc2626;border:6px solid #fff;border-radius:12px;padding:24px 10px;text-align:center;box-shadow:0 6px 14px rgba(0,0,0,0.2);">
      <div style="font-size:66px;font-weight:900;color:#fff;letter-spacing:2px;line-height:1;">MRF</div>
      <div style="margin-top:10px;background:#111827;color:#facc15;font-size:20px;font-weight:800;padding:4px 8px;">GENIUS GRAND</div>
    </div>
    <div style="margin-top:260px;width:190px;height:28px;background:#dc2626;"></div>
  `)
);

renderGraphic(
  'bat_ton',
  256,
  1024,
  willowBase(
    `<div style="margin-top:115px;width:196px;border:6px solid #1e293b;background:linear-gradient(180deg,#f8fafc,#cbd5e1);border-radius:14px;padding:20px 8px;text-align:center;">
      <div style="font-size:74px;font-weight:900;color:#0f172a;letter-spacing:3px;writing-mode:horizontal-tb;">TON</div>
      <div style="font-size:19px;font-weight:900;color:#b91c1c;margin-top:6px;">RESERVE EDITION</div>
    </div>`,
    '#1e293b'
  )
);

renderGraphic(
  'bat_sg',
  256,
  1024,
  willowBase(`
    <div style="margin-top:115px;width:198px;background:linear-gradient(180deg,#b91c1c,#7f1d1d);border:5px solid #facc15;border-radius:18px;padding:22px 10px;text-align:center;color:#fff;">
      <div style="font-size:76px;font-weight:900;color:#fde047;line-height:1;">SG</div>
      <div style="font-size:20px;font-weight:800;margin-top:8px;letter-spacing:1.5px;">SUNNY TONNY</div>
    </div>
  `)
);

renderGraphic(
  'bat_ceat',
  256,
  1024,
  willowBase(
    `<div style="margin-top:125px;width:210px;background:#1d4ed8;border-top:12px solid #f97316;border-bottom:12px solid #f97316;padding:26px 8px;text-align:center;transform:skewY(-8deg);">
      <div style="font-size:66px;font-weight:900;color:#fff;letter-spacing:2px;">CEAT</div>
      <div style="font-size:20px;font-weight:900;color:#fde047;margin-top:6px;">HITMAN ROHIT</div>
    </div>`,
    '#1d4ed8'
  )
);

renderGraphic(
  'bat_kooka',
  256,
  1024,
  willowBase(
    `<div style="margin-top:120px;width:206px;background:linear-gradient(160deg,#16a34a 0%,#65a30d 65%,#0f172a 100%);border:5px solid #ecfccb;border-radius:16px;padding:24px 10px;text-align:center;color:#fff;">
      <div style="font-size:28px;font-weight:900;letter-spacing:1px;color:#bef264;">KOOKABURRA</div>
      <div style="font-size:44px;font-weight:900;margin-top:8px;">KAHUNA</div>
    </div>`,
    '#16a34a'
  )
);

// 3. Branded Shelf Boxes (FLASH, R-LON, SSS, Carrom Box)
renderGraphic(
  'box_flash',
  512,
  256,
  `<div style="width:100%;height:100%;background:linear-gradient(125deg,#18181b 0%,#18181b 56%,#facc15 56.5%,#eab308 100%);border:6px solid #27272a;padding:22px 28px;display:flex;align-items:center;justify-content:space-between;color:#fff;">
    <div>
      <div style="font-size:64px;font-weight:900;font-style:italic;color:#facc15;letter-spacing:2px;">FLASH</div>
      <div style="font-size:22px;font-weight:700;color:#e4e4e7;margin-top:6px;">CRICKET HELMET · PRO GRILL</div>
    </div>
    <div style="font-size:32px;font-weight:900;color:#18181b;text-align:right;">SIZE<br>M / L</div>
  </div>`
);

renderGraphic(
  'box_rlon',
  512,
  256,
  `<div style="width:100%;height:100%;background:linear-gradient(180deg,#a3e635 0%,#65a30d 100%);border:6px solid #3f6212;padding:20px 26px;display:flex;align-items:center;justify-content:space-between;">
    <div style="background:#dc2626;color:#fff;padding:10px 22px;border-radius:10px;border:3px solid #fff;font-size:46px;font-weight:900;letter-spacing:2px;">R-LON</div>
    <div style="text-align:right;color:#1a2e05;">
      <div style="font-size:28px;font-weight:900;">TOURNAMENT GEAR</div>
      <div style="font-size:20px;font-weight:800;margin-top:4px;">12 PCS WHOLESALE PACK</div>
    </div>
  </div>`
);

renderGraphic(
  'box_sss',
  512,
  256,
  `<div style="width:100%;height:100%;background:linear-gradient(135deg,#451a1a 0%,#7f1d1d 100%);border:6px solid #fca5a5;padding:20px 28px;display:flex;align-items:center;justify-content:space-between;color:#fff;">
    <div style="border:4px solid #fff;padding:6px 20px;font-size:54px;font-weight:900;letter-spacing:4px;">SSS</div>
    <div style="text-align:right;">
      <div style="font-size:26px;font-weight:800;color:#fde047;">ATHLETIC FOOTWEAR</div>
      <div style="font-size:19px;font-weight:600;color:#fecaca;margin-top:4px;">TURF &amp; COURT STUDS</div>
    </div>
  </div>`
);

renderGraphic(
  'box_carrom',
  512,
  384,
  `<div style="width:100%;height:100%;background:linear-gradient(180deg,#fdf2f8 0%,#fce7f3 100%);border:8px solid #be185d;padding:22px;display:flex;flex-direction:column;justify-content:space-between;">
    <div style="background:#be185d;color:#fff;padding:10px 18px;border-radius:8px;font-size:34px;font-weight:900;text-align:center;">CHAMPION CARROM</div>
    <div style="text-align:center;color:#831843;font-size:26px;font-weight:800;">Acrylic Coins · Powder · Strikers</div>
    <div style="background:#1e3a8a;color:#fde047;padding:8px;border-radius:6px;text-align:center;font-size:22px;font-weight:800;">TOURNAMENT MATCH GRADE</div>
  </div>`
);

// 4. Carrom Board Playing Surface
renderGraphic(
  'carrom_board_face',
  1024,
  1024,
  `<div style="width:100%;height:100%;background:radial-gradient(circle,#f7e5c2 0%,#ebd09e 85%,#dfc088 100%);position:relative;display:flex;align-items:center;justify-content:center;">
    <div style="position:absolute;inset:86px;border:5px solid #1e293b;"></div>
    <div style="position:absolute;inset:108px;border:3px solid #1e293b;"></div>
    ${[
      'top:26px;left:26px;',
      'top:26px;right:26px;',
      'bottom:26px;left:26px;',
      'bottom:26px;right:26px;',
    ]
      .map(
        (pos) =>
          `<div style="position:absolute;${pos}width:68px;height:68px;border-radius:50%;background:#111827;border:5px solid #b91c1c;"></div>`
      )
      .join('')}
    ${[
      'top:82px;left:130px;',
      'top:82px;right:130px;',
      'bottom:82px;left:130px;',
      'bottom:82px;right:130px;',
    ]
      .map(
        (pos) =>
          `<div style="position:absolute;${pos}width:34px;height:34px;border-radius:50%;background:#dc2626;border:3px solid #111827;"></div>`
      )
      .join('')}
    <div style="width:220px;height:220px;border-radius:50%;border:6px solid #b91c1c;display:flex;align-items:center;justify-content:center;position:relative;">
      <div style="width:154px;height:154px;border-radius:50%;border:4px solid #1e293b;display:flex;align-items:center;justify-content:center;background:rgba(220,38,38,0.12);">
        <div style="width:52px;height:52px;border-radius:50%;background:#dc2626;border:4px solid #111827;"></div>
      </div>
    </div>
  </div>`
);

// 5. Golden Award Memento Plaque Face
renderGraphic(
  'plaque_face',
  512,
  512,
  `<div style="width:100%;height:100%;background:linear-gradient(135deg,#fde047 0%,#eab308 50%,#ca8a04 100%);border:16px solid #7f1d1d;border-radius:28px;padding:28px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center;color:#451a03;">
    <div style="font-size:24px;font-weight:900;letter-spacing:3px;">★ SULTAN SPORTS ★</div>
    <img src="${EMBLEM_DATA}" style="width:180px;height:180px;object-fit:contain;" />
    <div style="font-size:30px;font-weight:900;">CHAMPIONS TROPHY</div>
    <div style="font-size:18px;font-weight:800;background:#7f1d1d;color:#fde047;padding:6px 18px;border-radius:999px;">KADAPA TOURNAMENT SERIES</div>
  </div>`
);

// 6. Front-Left Counter Tabletop Stand (Demo QR + Order Desk Sign)
renderGraphic(
  'counter_qr_stand',
  512,
  640,
  `<div style="width:100%;height:100%;background:#0a261d;border:12px solid #e8b448;border-radius:24px;padding:26px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;color:#f5f1e6;text-align:center;">
    <div style="font-size:32px;font-weight:900;color:#e8b448;letter-spacing:2px;">SULTAN SPORTS</div>
    <div style="font-size:20px;font-weight:700;color:#b8cac1;">BILLING &amp; WHOLESALE DESK</div>
    <div style="width:280px;height:280px;background:#fff;border-radius:16px;padding:20px;position:relative;display:grid;grid-template-columns:repeat(5,1fr);gap:8px;">
      ${Array.from({ length: 25 })
        .map(
          (_, i) =>
            `<div style="background:${[0, 1, 4, 5, 6, 8, 12, 14, 16, 18, 20, 21, 24].includes(i) ? '#0f172a' : '#e2e8f0'};border-radius:4px;"></div>`
        )
        .join('')}
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
        <span style="background:rgba(220,38,38,0.92);color:#fff;font-size:34px;font-weight:900;padding:6px 18px;border-radius:8px;transform:rotate(-15deg);border:3px solid #fff;">DEMO QR</span>
      </div>
    </div>
    <div style="font-size:22px;font-weight:800;color:#fde047;">91107 44845 · KADAPA</div>
  </div>`
);

// Transparent PNG helper for woven badminton strings
function renderTransparentGraphic(name, width, height, html) {
  const htmlPath = path.join(TEMP_HTML, `${name}.html`);
  const pngPath = path.join(OUT_DIR, `${name}.png`);
  fs.writeFileSync(
    htmlPath,
    `<!doctype html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box;margin:0;padding:0;}
      html,body{width:${width}px;height:${height}px;overflow:hidden;background:transparent;font-family:'Segoe UI',Arial,sans-serif;}
    </style></head><body>${html}</body></html>`
  );
  execFileSync(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--default-background-color=00000000',
      '--hide-scrollbars',
      `--window-size=${width},${height}`,
      `--screenshot=${pngPath}`,
      pathToFileURL(htmlPath).href,
    ],
    { stdio: 'pipe' }
  );
  console.log(`Generated transparent ${name}.png (${width}x${height})`);
}

// 7. Sublimated Team Jersey Textures (Lime TYKA, Royal Blue, Sunrisers Orange)
renderGraphic(
  'jersey_lime',
  512,
  512,
  `<div style="width:100%;height:100%;background:linear-gradient(180deg,#bef264 0%,#a3e635 55%,#84cc16 100%);display:flex;flex-direction:column;align-items:center;padding-top:56px;position:relative;">
    <div style="width:100%;height:74px;background:repeating-linear-gradient(0deg,#4d7c0f 0px,#4d7c0f 6px,transparent 6px,transparent 14px);opacity:0.45;margin-top:60px;"></div>
    <div style="position:absolute;top:92px;right:96px;font-size:28px;font-weight:900;color:#1a2e05;letter-spacing:2px;">TYKA</div>
    <img src="${EMBLEM_DATA}" style="position:absolute;top:82px;left:92px;width:58px;height:58px;object-fit:contain;" />
    <div style="margin-top:34px;background:#1a2e05;color:#fde047;padding:8px 28px;border-radius:8px;font-size:30px;font-weight:900;letter-spacing:2px;">SULTAN XI</div>
  </div>`
);

renderGraphic(
  'jersey_blue',
  512,
  512,
  `<div style="width:100%;height:100%;background:linear-gradient(165deg,#1d4ed8 0%,#1e3a8a 60%,#0f172a 100%);display:flex;flex-direction:column;align-items:center;padding-top:64px;position:relative;color:#fff;">
    <div style="position:absolute;top:0;left:0;right:0;height:28px;background:#f97316;"></div>
    <img src="${EMBLEM_DATA}" style="position:absolute;top:84px;left:92px;width:58px;height:58px;object-fit:contain;" />
    <div style="position:absolute;top:94px;right:92px;font-size:24px;font-weight:900;color:#fde047;">PRO KIT</div>
    <div style="margin-top:110px;font-size:44px;font-weight:900;letter-spacing:3px;color:#fde047;text-shadow:0 4px 10px rgba(0,0,0,0.5);">KADAPA</div>
    <div style="font-size:28px;font-weight:800;letter-spacing:4px;color:#93c5fd;">ROYALS</div>
  </div>`
);

renderGraphic(
  'jersey_orange',
  512,
  512,
  `<div style="width:100%;height:100%;background:linear-gradient(165deg,#f97316 0%,#ea580c 55%,#1e1b4b 92%);display:flex;flex-direction:column;align-items:center;padding-top:64px;position:relative;color:#fff;">
    <img src="${EMBLEM_DATA}" style="position:absolute;top:84px;left:92px;width:58px;height:58px;object-fit:contain;" />
    <div style="margin-top:112px;background:#0f172a;border:3px solid #fde047;padding:8px 26px;border-radius:8px;font-size:34px;font-weight:900;color:#fde047;letter-spacing:2px;">STRIKERS</div>
  </div>`
);

// 8. 18-Panel Tournament Volleyball Wrap
renderGraphic(
  'volleyball_tex',
  512,
  256,
  `<div style="width:100%;height:100%;display:grid;grid-template-columns:repeat(6,1fr);">
    ${['#facc15', '#1d4ed8', '#f8fafc', '#facc15', '#1d4ed8', '#f8fafc']
      .map(
        (c) =>
          `<div style="background:${c};border-left:4px solid #1e293b;border-right:4px solid #1e293b;display:flex;flex-direction:column;justify-content:space-evenly;">
            <div style="height:3px;background:rgba(15,23,42,0.35);"></div>
            <div style="height:3px;background:rgba(15,23,42,0.35);"></div>
          </div>`
      )
      .join('')}
  </div>`
);

// 9. Woven Transparent Badminton Strings with Red 'S' Stencil
const vLines = Array.from({ length: 18 })
  .map((_, i) => `<div style="position:absolute;top:0;bottom:0;left:${5 + i * 5.3}%;width:2px;background:rgba(248,250,252,0.88);"></div>`)
  .join('');
const hLines = Array.from({ length: 22 })
  .map((_, i) => `<div style="position:absolute;left:0;right:0;top:${4 + i * 4.4}%;height:2px;background:rgba(241,245,249,0.88);"></div>`)
  .join('');
renderTransparentGraphic(
  'racket_strings',
  256,
  256,
  `<div style="width:100%;height:100%;position:relative;display:flex;align-items:center;justify-content:center;">
    ${vLines}${hLines}
    <div style="position:relative;z-index:2;font-size:128px;font-weight:900;color:rgba(220,38,38,0.85);font-family:Arial,sans-serif;">S</div>
  </div>`
);
