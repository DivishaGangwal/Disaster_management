# 🚀 Deployment Guide — Disaster SOS Mesh (Render & Vercel)

This document provides step-by-step instructions to deploy the **Disaster SOS Mesh** National Operations Console (Website) and Backend API on **Render** (render.com) or **Vercel**.

---

## 🟢 Option 1: Deploying on Render (render.com) — *Recommended for Full Backend*

Render natively supports Node.js 22 servers, Web Services, and static website hosting out of the box with zero runtime limitations.

### 🔑 Render Environment Variables

Add these under **Render Web Service → Environment Variables**:

| Variable | Value | Description |
|---|---|---|
| `NODE_VERSION` | `22.5.0` | **Required.** Specifies Node.js 22 runtime for Render. |
| `DSM_OPERATIONS_KEY` | `mumbai-operations-local` | Security key used to log in to the Web Operations Console. |
| `DSM_DEMO_MODE` | `true` | Pre-seeds Mumbai disaster response data and mock responders. |
| `DSM_DATABASE_PATH` | `./data/mumbai-operations.sqlite` | SQLite database file location. |
| `EXPO_PUBLIC_DSM_BACKEND_URL` | `https://<your-app-name>.onrender.com` | Public URL for mobile app (Expo) gateway sync. |

---

### 📋 Step-by-Step Render Deployment

#### **Method A: Deploy using Render Blueprint (`render.yaml`) — 1 Click**

1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "Add Render deployment config"
   git push origin main
   ```
2. Go to **[dashboard.render.com/blueprints](https://dashboard.render.com/blueprints)**.
3. Click **New Blueprint Instance**.
4. Connect your GitHub repository `Disaster_management`.
5. Render will automatically read [`render.yaml`](file:///d:/sih/Disaster_management/render.yaml) and configure the build & start commands!
6. Click **Approve** to launch your deployment!

---

#### **Method B: Manual Web Service Setup on Render**

1. Go to **[dashboard.render.com](https://dashboard.render.com)**.
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository `Disaster_management`.
4. Configure Web Service details:
   - **Name:** `disaster-sos-mesh`
   - **Environment:** `Node`
   - **Region:** Choose closest to your users (e.g. Singapore / Frankfurt / US East)
   - **Branch:** `main`
   - **Build Command:**
     ```bash
     npm install && npm run build && npm run web:build
     ```
   - **Start Command:**
     ```bash
     node apps/backend/dist/main.js
     ```
5. Add Environment Variables:
   - `NODE_VERSION` = `22.5.0`
   - `DSM_OPERATIONS_KEY` = `mumbai-operations-local`
   - `DSM_DEMO_MODE` = `true`
   - `DSM_DATABASE_PATH` = `./data/mumbai-operations.sqlite`
6. Click **Create Web Service**.

Once deployed:
- **Web Operations Console:** `https://<your-app-name>.onrender.com`
- **Backend API Health Check:** `https://<your-app-name>.onrender.com/health`

---

## ⚡ Option 2: Deploying on Vercel (vercel.com)

If you prefer Vercel:

### 🔑 Vercel Environment Variables

| Variable | Value | Description |
|---|---|---|
| `NPM_CONFIG_PRODUCTION` | `false` | **Required.** Ensures build tools install during build. |
| `DSM_OPERATIONS_KEY` | `mumbai-operations-local` | Security key used to log in to the Web Operations Console. |
| `DSM_DEMO_MODE` | `true` | Pre-seeds Mumbai disaster response data and mock responders. |
| `DSM_DATABASE_PATH` | `/tmp/mumbai-operations.sqlite` | SQLite database path in `/tmp`. |

### Vercel Project Build Settings
- **Framework Preset:** `Other` (or `Vite`)
- **Build Command:** `npm run build && npm run web:build`
- **Output Directory:** `apps/web-authority/dist`

---

## 📱 Connecting the Mobile App (Expo) to Live Backend

To point your React Native / Expo mobile app to your live Render backend:

In your local `.env` or in `apps/mobile/.env`:
```env
EXPO_PUBLIC_DSM_BACKEND_URL=https://<your-app-name>.onrender.com
```

Then start Expo:
```bash
npm start
```
The mobile app will automatically probe `https://<your-app-name>.onrender.com/health` and synchronize disaster SOS packets with your online Render backend.
