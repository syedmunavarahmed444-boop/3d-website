# Sultan Sports Kadapa — 3D Walk-In Showroom Guide

Welcome to your **Sultan Sports Kadapa** interactive 3D Sports Showroom! Customers can walk from Apsara Circle right inside your shop, browse all 7 Retail & Wholesale sports racks, build their **Kit Bag**, and send their itemized order straight to your WhatsApp in one click.

---

## 1. How to Start & Test the Showroom (1 Click)

1. Open your project folder: `C:\Users\liter\Downloads\3D website`
2. **Double-click `run.bat`**.
3. Your web browser will automatically open **http://localhost:5173/** and load the 3D showroom.
   * *To stop the app later:* Simply close the black Command Prompt window opened by `run.bat`.

---

## 2. How Visitors Use the 3D Showroom

* **Scroll or Tap Chapters:** Scroll smoothly down the page (with a mouse wheel or finger swipe on mobile) to walk from the street (`Opening`), roll up the shop shutter (`Shutter`), tour the shelves (`Racks`), inspect bats (`Inspect`), view trophies (`Trust`), check bulk stock (`Wholesale`), review your order (`Bill`), and get directions (`Visit`).
* **Jump Instantly:** Click any chapter button along the bottom bar (`Opening` → `Visit`), or click the **Kit Bag** button in the top-right corner to jump straight to the billing counter.
* **Add Retail & Wholesale Packs:**
  * Inside **Chapter 03 (`Racks`)**, tap `01` through `07` to switch between *Willow Bats, Scoop Bats, Pads/Helmets, Badminton, Footballs, Shoes/Jerseys,* and *Trophies/Carrom*.
  * Tap **`+`** or **`−`** on any single-piece (Retail) or bulk/carton (Club & Wholesale) pack.
* **Send Order to WhatsApp:**
  * Inside **Chapter 07 (`Bill`)**, review the itemized total and click **Send Order on WhatsApp**—it opens WhatsApp pre-filled with the exact product list, pack quantities, and estimated rupee total addressed to Mansoor (`+91 91107 44845`).

---

## 3. How to Update Prices, Phone Numbers, or Your Live UPI ID

All business info, prices, and store details live in **one easy file**:
* Open `src/modules/brand/storeData.js` in Notepad or VS Code.
* **Change Prices or Pack Sizes:** Edit the `price` or `label` numbers inside the `PRODUCTS` list.
* **Activate Your Real UPI QR Label:** Currently `upiId: ''` is left blank so the QR code safely displays a red **`DEMO`** badge. When you are ready to go live, put your store UPI ID inside the quotes (for example, `upiId: 'sultansports@ybl'`) and save the file.

---

## 4. How to Publish Live on the Internet

When you are ready to put the website online for customers:
1. Open a terminal in this folder and run:
   ```bash
   npm run build
   ```
2. This creates a ready-to-upload **`dist`** folder containing your optimized website and compressed 3D models (`exterior.glb`, `interior.glb`, `mascot.glb`, `emblem.glb`).
3. You can drag-and-drop or connect the project to **Vercel**, **Netlify**, or **Cloudflare Pages** for free HTTPS hosting.
