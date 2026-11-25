import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'assets', 'textures', 'signage');
const TEMP_HTML = path.join(ROOT, 'scripts', 'temp', 'signage_html');
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(TEMP_HTML, { recursive: true });

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EMBLEM_DATA = `data:image/png;base64,${fs.readFileSync(path.join(ROOT, 'public', 'brand', 'sultan_emblem.png')).toString('base64')}`;

function renderSign(name, width, height, html) {
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
      '--hide-scrollbars',
      `--window-size=${width},${height}`,
      `--screenshot=${pngPath}`,
      pathToFileURL(htmlPath).href,
    ],
    { stdio: 'pipe' }
  );
  console.log(`Printed ${name}.png (${width}x${height})`);
}

// 1. Main High-Contrast Orange-Crimson SULTAN SPORTS KADAPA Signboard (crisp in bright sunlight)
renderSign(
  'sultan_sign_main',
  2048,
  512,
  `<div style="width:100%;height:100%;background:linear-gradient(135deg,#b91c1c 0%,#d84315 48%,#e65100 100%);border:14px solid #450a0a;display:flex;align-items:center;padding:18px 28px;gap:26px;position:relative;">
    <img src="${EMBLEM_DATA}" style="height:360px;width:360px;object-fit:contain;filter:drop-shadow(0 8px 18px rgba(0,0,0,0.65));flex-shrink:0;" />
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="background:#081f18;color:#fde047;padding:6px 18px;border-radius:8px;font-weight:900;font-size:26px;letter-spacing:1.5px;border:2px solid #fde047;">RETAIL &amp; WHOLESALE SHOWROOM</span>
        <span style="background:#0f172a;color:#fde047;padding:6px 18px;border-radius:8px;font-weight:900;font-size:26px;border:2px solid #fff;">91107 44845 · 63039 74896</span>
      </div>
      <div style="font-size:126px;font-weight:900;line-height:0.95;color:#fde047;letter-spacing:2px;-webkit-text-stroke:6px #2a0404;text-shadow:0 9px 0 #1f0202,0 14px 24px rgba(0,0,0,0.65);">
        SULTAN SPORTS
      </div>
      <div style="display:flex;align-items:center;gap:18px;">
        <span style="background:#0f172a;color:#fde047;border:2px solid #fde047;padding:10px 24px;border-radius:10px;font-size:34px;font-weight:900;letter-spacing:2px;">KADAPA · APSARA CIRCLE</span>
        <span style="font-size:31px;font-weight:900;color:#ffffff;text-shadow:0 3px 8px rgba(0,0,0,0.85);">Complete Sports Showroom · Willow Bats &amp; Custom Kits</span>
      </div>
    </div>
    <div style="width:290px;height:410px;background:#091540;border:6px solid #fde047;border-radius:14px;padding:18px;display:flex;flex-direction:column;justify-content:space-between;color:#fff;text-align:center;flex-shrink:0;">
      <div style="font-size:24px;font-weight:800;color:#fde047;border-bottom:2px solid rgba(255,213,79,0.4);padding-bottom:8px;">SPECIALIST IN</div>
      <div style="font-size:34px;font-weight:900;line-height:1.15;">WILLOW BATS &amp; REPAIRS</div>
      <div style="font-size:22px;font-weight:700;color:#e3f2fd;">Cricket · Badminton<br>Football · Trophies<br>Team Jerseys</div>
      <div style="background:#fde047;color:#081f18;font-weight:900;font-size:24px;padding:8px;border-radius:8px;">6 AM – 10 PM</div>
    </div>
  </div>`
);

// 2. Doorway Overhead Signboard (High-contrast readable fascia)
renderSign(
  'sultan_sign_door',
  1024,
  512,
  `<div style="width:100%;height:100%;background:linear-gradient(180deg,#c2410c 0%,#9a3412 100%);border:12px solid #081f18;display:flex;flex-direction:column;justify-content:space-between;padding:24px 32px;color:#fff;">
    <div style="display:flex;align-items:center;gap:20px;">
      <img src="${EMBLEM_DATA}" style="width:140px;height:140px;object-fit:contain;" />
      <div>
        <div style="font-size:68px;font-weight:900;color:#fde047;-webkit-text-stroke:4px #2a0404;line-height:1;text-shadow:0 5px 0 #1f0202;">SULTAN SPORTS</div>
        <div style="font-size:28px;font-weight:900;color:#fff;margin-top:6px;text-shadow:0 2px 6px rgba(0,0,0,0.7);">WHOLESALE PRICES · KADAPA</div>
      </div>
    </div>
    <div style="background:#081f18;border:3px solid #fde047;border-radius:12px;padding:16px 22px;display:flex;justify-content:space-between;align-items:center;font-size:28px;font-weight:800;color:#fde047;">
      <span>CRICKET · BADMINTON · FOOTBALL</span>
      <span>ENTRANCE ↓</span>
    </div>
    <div style="background:#0f172a;color:#fde047;border:2px solid #fff;border-radius:8px;padding:10px 18px;font-size:26px;font-weight:900;text-align:center;">
      Near Apsara Theatre · Call 91107 44845 / 63039 74896
    </div>
  </div>`
);

// 3. Vertical Gear Showcase Poster on Side Pillar
renderSign(
  'sultan_poster_vertical',
  512,
  1024,
  `<div style="width:100%;height:100%;background:#f7f8fa;border:10px solid #0d47a1;padding:22px;display:flex;flex-direction:column;gap:18px;">
    <div style="background:#0d47a1;color:#ffd54f;padding:16px;border-radius:12px;display:flex;align-items:center;gap:14px;">
      <img src="${EMBLEM_DATA}" style="width:88px;height:88px;object-fit:contain;" />
      <div>
        <div style="font-size:36px;font-weight:900;line-height:1;">SULTAN</div>
        <div style="font-size:30px;font-weight:800;color:#fff;">SPORTS</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;flex:1;">
      ${[
        ['WILLOW BATS', '#ef6c00', 'English & Kashmir'],
        ['CRICKET KITS', '#0b2c22', 'Pads · Gloves · Helmets'],
        ['BADMINTON', '#1565c0', 'Rackets & Shuttles'],
        ['FOOTBALLS', '#2e7d32', 'Turf & Match Balls'],
        ['SPORTS SHOES', '#4a148c', 'Studs & Trainers'],
        ['TROPHIES', '#b71c1c', 'Cups & Medals'],
        ['CARROM BOARDS', '#00695c', 'Club & Match Size'],
        ['CUSTOM KITS', '#d84315', 'Team Sublimation'],
      ]
        .map(
          ([t, c, s]) =>
            `<div style="background:#fff;border:3px solid ${c};border-radius:12px;padding:14px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;box-shadow:0 4px 10px rgba(0,0,0,0.08);">
              <div style="width:46px;height:46px;border-radius:50%;background:${c};margin-bottom:10px;"></div>
              <div style="font-size:21px;font-weight:900;color:#111;">${t}</div>
              <div style="font-size:15px;font-weight:600;color:#555;margin-top:4px;">${s}</div>
            </div>`
        )
        .join('')}
    </div>
    <div style="background:#ffd54f;color:#0b2c22;padding:14px;border-radius:10px;text-align:center;font-size:24px;font-weight:900;">
      RETAIL &amp; WHOLESALE · KADAPA
    </div>
  </div>`
);

// 4. Neighboring Shop Signboards (clean local Kadapa street atmosphere)
renderSign(
  'neighbor_sportswear',
  1536,
  384,
  `<div style="width:100%;height:100%;background:linear-gradient(135deg,#0d47a1 0%,#1565c0 100%);border:10px solid #90caf9;display:flex;flex-direction:column;justify-content:center;align-items:center;color:#fff;text-align:center;padding:24px;">
    <div style="font-size:88px;font-weight:900;color:#ffeb3b;letter-spacing:3px;text-shadow:0 6px 0 #082b66;">MODERN SPORTSWEAR</div>
    <div style="font-size:34px;font-weight:700;color:#e3f2fd;margin-top:12px;">Track Suits · Team Jerseys · Sublimation &amp; Custom Printing</div>
  </div>`
);

renderSign(
  'neighbor_travels',
  1536,
  384,
  `<div style="width:100%;height:100%;background:linear-gradient(135deg,#004d40 0%,#00695c 100%);border:10px solid #a7ffeb;display:flex;flex-direction:column;justify-content:center;align-items:center;color:#fff;text-align:center;padding:24px;">
    <div style="font-size:84px;font-weight:900;color:#ffffff;letter-spacing:3px;">APSARA TRAVELS</div>
    <div style="font-size:34px;font-weight:700;color:#b2dfdb;margin-top:12px;">Cars &amp; Tempo Travellers · Outstation &amp; Local Tours</div>
  </div>`
);

renderSign(
  'neighbor_dairy',
  1536,
  384,
  `<div style="width:100%;height:100%;background:linear-gradient(135deg,#0277bd 0%,#29b6f6 100%);border:10px solid #e1f5fe;display:flex;flex-direction:column;justify-content:center;align-items:center;color:#fff;text-align:center;padding:24px;">
    <div style="font-size:84px;font-weight:900;color:#ffffff;letter-spacing:3px;">KADAPA FRESH DAIRY</div>
    <div style="font-size:34px;font-weight:700;color:#e1f5fe;margin-top:12px;">Milk · Curd · Ghee · Paneer · Cool Drinks</div>
  </div>`
);
