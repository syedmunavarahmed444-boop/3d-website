import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const BRAND_PUBLIC = path.join(ROOT, 'public', 'brand');
const BRAND_ASSETS = path.join(ROOT, 'assets', 'brand');
const TEMP_HTML = path.join(ROOT, 'scripts', 'temp', 'brand_html');
fs.mkdirSync(BRAND_PUBLIC, { recursive: true });
fs.mkdirSync(BRAND_ASSETS, { recursive: true });
fs.mkdirSync(TEMP_HTML, { recursive: true });

const masterEmblem = path.join(BRAND_ASSETS, 'sultan_emblem_master.png');
const publicEmblem = path.join(BRAND_PUBLIC, 'sultan_emblem.png');
if (!fs.existsSync(masterEmblem)) {
  fs.copyFileSync(publicEmblem, masterEmblem);
}

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EMBLEM_DATA = `data:image/png;base64,${fs.readFileSync(masterEmblem).toString('base64')}`;

// 1. Render 1200x630 OpenGraph / WhatsApp Link Share Banner (og-share.png)
const ogHtml = path.join(TEMP_HTML, 'og_share.html');
const ogPng = path.join(BRAND_PUBLIC, 'og-share.png');
fs.writeFileSync(
  ogHtml,
  `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:1200px;height:630px;overflow:hidden;font-family:'Segoe UI',Arial,sans-serif;}
  </style></head><body>
    <div style="width:100%;height:100%;background:radial-gradient(circle at 22% 50%,#134e3a 0%,#081f18 68%);border:14px solid #e8b448;display:flex;align-items:center;padding:48px 58px;gap:48px;color:#f5f1e6;">
      <img src="${EMBLEM_DATA}" style="width:340px;height:340px;object-fit:contain;filter:drop-shadow(0 18px 34px rgba(0,0,0,0.55));flex-shrink:0;" />
      <div style="flex:1;display:flex;flex-direction:column;gap:16px;">
        <div style="display:inline-flex;align-self:flex-start;background:rgba(232,180,72,0.18);border:2px solid #e8b448;color:#fde047;padding:8px 20px;border-radius:999px;font-size:22px;font-weight:800;letter-spacing:1.5px;">4.9 ★ GOOGLE RATING · APSARA CIRCLE, KADAPA</div>
        <div style="font-size:74px;font-weight:900;line-height:1.02;color:#ffffff;">SULTAN SPORTS<br><span style="color:#e8b448;">KADAPA 3D SHOWROOM</span></div>
        <div style="font-size:27px;color:#b8cac1;line-height:1.4;font-weight:600;">Walk inside our 3D store — Willow &amp; M4 Scoop Bats, Cricket Kits, Badminton, Footballs, Team Jerseys &amp; Championship Trophies.</div>
        <div style="margin-top:8px;display:flex;gap:16px;align-items:center;">
          <span style="background:#22c55e;color:#052e16;padding:12px 26px;border-radius:12px;font-size:24px;font-weight:900;">Retail &amp; Wholesale WhatsApp Orders</span>
          <span style="font-size:24px;font-weight:800;color:#fde047;">+91 91107 44845</span>
        </div>
      </div>
    </div>
  </body></html>`
);

execFileSync(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=1200,630',
    `--screenshot=${ogPng}`,
    pathToFileURL(ogHtml).href,
  ],
  { stdio: 'pipe' }
);

// 2. Render compact 192x192 transparent sultan_emblem.png (~35 KB instead of 470 KB!)
const iconHtml = path.join(TEMP_HTML, 'emblem_192.html');
fs.writeFileSync(
  iconHtml,
  `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0;padding:0;}
    html,body{width:192px;height:192px;overflow:hidden;background:transparent;}
  </style></head><body>
    <img src="${EMBLEM_DATA}" style="width:192px;height:192px;object-fit:contain;display:block;" />
  </body></html>`
);

execFileSync(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--default-background-color=00000000',
    '--hide-scrollbars',
    '--window-size=192,192',
    `--screenshot=${publicEmblem}`,
    pathToFileURL(iconHtml).href,
  ],
  { stdio: 'pipe' }
);

console.log('Generated og-share.png and resized sultan_emblem.png');
