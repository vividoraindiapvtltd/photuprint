# PixelCraft – How to Call from admin-cms and Run the Program

This doc explains how the PixelCraft folder is used by admin-cms and how to open it when the app is running.

---

## 1. How PixelCraft is Wired in admin-cms

### Routes (App.js)

PixelCraft is mounted under the dashboard:

| Path | Component | What you see |
|------|-----------|--------------|
| `/dashboard/pixelcraft` | PixelCraft (layout) → **PixelCraftTemplates** (index) | Templates tab + canvas editor (PixelCraftManager) |
| `/dashboard/pixelcraft/elements` | PixelCraft → ElementManager | Element Manager |
| `/dashboard/pixelcraft/element-images` | PixelCraft → ElementImageManager | Element Images |
| `/dashboard/pixelcraft/dimensions` | PixelCraft → TemplateDimensionManager | Dimensions |

- **PixelCraft** = layout with tabs (Templates, Element Manager, Element Images, Dimensions).
- **PixelCraftTemplates** = first tab; it renders **PixelCraftManager** (the Fabric.js canvas editor for template generation).

### Dashboard link

In `src/data/dashboardLinks.json` there is already a card for PixelCraft:

- **Title:** PixelCraft  
- **Link:** `/dashboard/pixelcraft`  
- **Description:** Template platform blueprint & reference code  

So from the dashboard home you can click that card to open PixelCraft.

---

## 2. How to “Call” PixelCraft When the Program is Running

“Call” here means **opening the PixelCraft UI** in the browser.

### Option A: From the dashboard (recommended)

1. Start admin-cms (see “How to run the program” below).
2. Log in and go to the **Dashboard** (e.g. `/dashboard`).
3. Click the **PixelCraft** card.  
   You are taken to `/dashboard/pixelcraft` and see the **Templates** tab with the canvas editor (PixelCraftManager).

### Option B: Direct URL

- **Templates (canvas editor):**  
  `http://localhost:3000/dashboard/pixelcraft`
- **Element Manager:**  
  `http://localhost:3000/dashboard/pixelcraft/elements`
- **Element Images:**  
  `http://localhost:3000/dashboard/pixelcraft/element-images`
- **Dimensions:**  
  `http://localhost:3000/dashboard/pixelcraft/dimensions`

Replace `localhost:3000` with your actual host/port if different (e.g. from `HOST=0.0.0.0 PORT=3000` in `package.json`).

---

## 3. How to Run the Program

From the **admin-cms** directory:

```bash
cd admin-cms
npm install
npm start
```

- Default URL: **http://localhost:3000** (or the host/port from your `start` script).
- Log in, then go to Dashboard → PixelCraft (or open `/dashboard/pixelcraft` directly).

If you use a root script or a monorepo script that starts admin-cms, run that instead; the URLs above still apply once the app is running.

---

## 4. What Lives Where

| Where | What |
|-------|------|
| **admin-cms/src/components/** | **PixelCraft.js** (layout + tabs), **PixelCraftTemplates.js** (wraps manager), **PixelCraftManager.js** (Fabric.js canvas editor). These are what the routes render. |
| **admin-cms/src/PixelCraft/** | Docs (`.md`), **editor/** (serialize/deserialize, Fabric helpers), **render/** (canvas render, PDF, variable merge), **production/**, **user-editor/**, **reference-nextjs-app/**. Used for design and for future/optional integration (e.g. server-side template generation). |

The **running template generation UI** is the canvas in PixelCraftManager, opened via `/dashboard/pixelcraft` as above. The **PixelCraft folder** is the blueprint + optional shared logic (e.g. for server-side rendering or a future Next.js app).

---

## 5. Optional: Using PixelCraft TS Modules (editor / render) from admin-cms

The PixelCraft **editor** and **render** modules are TypeScript. admin-cms is Create React App (JavaScript). To call them from admin-cms you would:

- **Option A:** Compile PixelCraft TS to JS (e.g. `tsc` or a build step) and import the built JS from `src/components` or `src/api`.  
- **Option B:** Add TypeScript to admin-cms and import from `src/PixelCraft/editor` or `src/PixelCraft/render` (with proper `tsconfig` paths).  
- **Option C:** Expose template generation via a **backend API** that uses the PixelCraft render/editor logic; admin-cms then only calls that API (e.g. “generate PNG/PDF for this template”).

Right now, template creation/editing is done **in the browser** by PixelCraftManager (Fabric.js). The PixelCraft folder’s `editor/` and `render/` code is ready for when you add server-side or shared template generation.

---

## Quick reference

| Goal | Action |
|------|--------|
| Open template editor in running app | Go to Dashboard → click PixelCraft, or open `/dashboard/pixelcraft` |
| Run admin-cms | `cd admin-cms && npm install && npm start` |
| Open other PixelCraft tabs | Use tabs on the PixelCraft page, or URLs in section 2. |
