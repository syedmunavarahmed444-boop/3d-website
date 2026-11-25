# Sultan Sports Kadapa — 3D Walk-In Showroom Guide

Welcome to your **Sultan Sports Kadapa** interactive 3D Sports Showroom! Customers can walk from Apsara Circle right inside your shop, browse all 7 Retail & Wholesale sports racks, or switch to the instant **Classic List** view on slower phones—then send their itemized order straight to your WhatsApp in one click.

---

## 1. How to Start & Test the Showroom (1 Click)

1. Open your project folder: `C:\Users\liter\Downloads\3D website`
2. **Double-click `run.bat`**.
3. Your web browser will automatically open **http://localhost:5173/** and load the 3D showroom.
   * *To stop the app later:* Simply close the black Command Prompt window opened by `run.bat`.

---

## 2. Key Features for Customers

* **3D Walk-In Tour + Keyboard / Arrow Navigation:** Scroll with your mouse wheel or swipe on your phone—or use the **`‹` / `›` arrows** (and **Left / Right arrow keys** on a keyboard) to step cleanly from `Opening` → `Visit`.
* **Instant "Classic List" Mode (Great for Slow Phones):** Customers who want a fast, traditional price sheet can tap **`Classic List`** in the top bar anytime. While open, the 3D background pauses automatically to save battery.
* **Quick Mobile Call Button:** Phone visitors get a one-tap **`✆ Call`** button on screen alongside the WhatsApp checkout.
* **Retail & Wholesale Kit Bag:** Tap **`+`** or **`−`** on any Retail, Club, or Wholesale pack in Chapter 03 (`Racks`) or inside `Classic List`, then tap **`Send Order on WhatsApp →`** in Chapter 07 (`Bill`).

---

## 3. How to Change Phone Numbers, Greeting Name, or Enable a Real UPI QR (No Coding Needed!)

You can customize your store settings without touching any code:
1. Make a copy of `.env.example` in this folder and rename the copy to **`.env`**.
2. Edit any line inside `.env` in Notepad:
   * `VITE_PRIMARY_PHONE=9110744845` (WhatsApp & primary call number)
   * `VITE_ALT_PHONE=6303974896` (Wholesale / alternate number)
   * `VITE_OWNER_GREETING=Mansoor bhai` (Name used in the WhatsApp order message)
   * `VITE_UPI_ID=` — Leave blank to keep the QR hidden, or enter your real store UPI ID (for example, `VITE_UPI_ID=sultansports@ybl`) to automatically display a **real, scannable UPI QR code** for the customer's exact order total!
3. To edit product names or rupee prices, open `src/modules/brand/storeData.js` and adjust the numbers inside `PRODUCTS`.

---

## 4. Live Website on AWS & How to Re-Publish Updates

Your showroom is hosted live on **AWS (Private S3 + CloudFront HTTPS)**:
* **Live Website Link:** `https://dfrehykajewwr.cloudfront.net`
* **Private S3 Bucket:** `sultan-sports-kadapa-796458433659` (`ap-southeast-2`)
* **CloudFront Distribution ID:** `E2DFA0FZU3IDXN`

Whenever you change a price, phone number, or add your UPI ID in `.env`, run these two commands in PowerShell to publish your update live:
```powershell
aws login --profile Lite_aws
powershell -ExecutionPolicy Bypass -File scripts/deploy-aws.ps1
```
*(If you buy a custom domain later like `sultansportskadapa.com`, you can attach it to this same CloudFront distribution.)*
