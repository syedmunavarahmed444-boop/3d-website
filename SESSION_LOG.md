# Sultan Sports Kadapa 3D Showroom — Session Log

## 2026-11-26 — Round 4 Polish, AWS CloudFront Hosting & `neon-new-ux` Redesign

### Why Things Changed & What Was Built
- **Round 4 Performance, Mobile & SEO Polish (`main` — Critique Score `9.2 / 10`)**:
  - Compressed the initial 3D + logo download from **~14 MB → 5.86 MB** so Kadapa mobile data users load the showroom over twice as fast without losing Mansoor's rig, animations, or facial expressions.
  - Replaced the placeholder `DEMO` QR code on both the 3D counter stand and checkout card with a clean gold-framed *Wholesale & Billing* desk sign (with optional real scannable UPI QR activation via `.env`).
  - Added Google `SportingGoodsStore` metadata, a branded WhatsApp preview card (`og-share.png`), and a fast `Classic List` price sheet; untracked 31 MB of raw `archive/` files from Git.
- **Live AWS Hosting (Private S3 + CloudFront HTTPS)**:
  - Deployed to **https://dfrehykajewwr.cloudfront.net** using a private S3 bucket (`sultan-sports-kadapa-796458433659`, `ap-southeast-2`) locked exclusively to CloudFront via Origin Access Control (`EKHAXRSHUR2E1`), plus a reusable one-click re-deploy script at `scripts/deploy-aws.ps1`.
- **New Interactive UX Flow (`neon-new-ux` branch — Now Live on AWS)**:
  - Replaced the clumsy 12,600px scroll-jacking track with a clean 3-stage interactive flow: **Generic Sign Up / Log In / Guest Gate** (`src/modules/onboarding/OnboardingStore.js`) → **Automatic Shutter Lift + Mansoor Welcome + Big "Step Inside the Shop →" Button** → **Inside by the Counter + Transparent Frosted Glassmorphic Floating Menu** (`src/modules/showroom-ux/`).
  - Hovering or tapping any product in the floating menu smoothly glides the 3D showroom camera in the background to showcase that exact shelf, while the see-through frosted glass lets customers see the whole shop behind the list.
  - Added **7 realistic WebP product thumbnails** (`public/products/`) + **21 real category gallery photos** (`public/products/gallery/`) with a **swipeable 3D Photo Stack viewer** that opens whenever a customer taps any product image.
  - Added a **live Search bar** (ready for a large product catalog later, with a 1-tap *"Ask Mansoor on WhatsApp"* fallback for unlisted items) and a **Sports Infrastructure `Services` tab** (box cricket nets, badminton/volleyball courts, school ground setups, and bat/racket workshop services).

### Immediate Next Steps
1. **Replace Generic Onboarding with Your Custom Concept**: Share your custom onboarding/login idea and choose whether to wire up **Firebase Auth** (Google/Phone OTP) or **AWS Cognito** into `src/modules/onboarding/OnboardingStore.js`.
2. **Swap In Your Real Shop Photos & Full Item List**: Drop your real product photos into `public/products/` and `public/products/gallery/`, expand `PRODUCTS` in `src/modules/brand/storeData.js`, and run `scripts/deploy-aws.ps1` to publish live.
