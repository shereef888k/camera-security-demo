# GitHub Pages Frontend Deployment Guide

This guide details how to publish the Camera Security Demonstration frontend on **GitHub Pages**.

---

## 1. Important Architecture Note

> [!IMPORTANT]
> **GitHub Pages is a static file hosting provider.** It serves HTML, CSS, JavaScript, and static media files directly. It **cannot** run Node.js server scripts, run Express, connect to databases, or securely hold backend environment secrets (`TELEGRAM_BOT_TOKEN`, `ADMIN_API_KEY`).
> 
> Therefore:
> 1. Deploy the **Frontend** (`frontend/` directory) to **GitHub Pages**.
> 2. Deploy the **Backend** (`backend/` directory) to a Node.js hosting platform (such as Render, Railway, Fly.io, or VPS) with HTTPS enabled.

---

## 2. Setting Your Public Backend URL

Before deploying, specify your deployed backend URL in `frontend/config.js`:

```javascript
const CONFIG = {
  // Replace with your deployed backend HTTPS URL:
  DEFAULT_API_BASE_URL: 'https://my-security-backend.onrender.com',
  // ...
};
```

> [!NOTE]
> Even after deployment, the administrator can override or update the backend URL dynamically directly inside the **Admin Dashboard** under **Backend & Credentials &rarr; Backend Base URL**.

---

## 3. Automated Deployment via GitHub Actions (Recommended)

This repository includes a preconfigured GitHub Actions workflow at:
`.github/workflows/deploy-frontend.yml`

### Deployment Steps:
1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "Deploy camera security demonstration platform"
   git push origin main
   ```
2. In your GitHub repository, navigate to **Settings** &rarr; **Pages**.
3. Under **Build and deployment** &rarr; **Source**, select **GitHub Actions**.
4. The workflow will automatically trigger, bundle the `frontend/` directory, and deploy it to:
   ```text
   https://<your-username>.github.io/<repository-name>/
   ```
5. Navigate to the URL shown on the GitHub Pages settings tab.

---

## 4. Alternative: Deploying from Branch Folder

If you prefer standard branch publishing without GitHub Actions:

1. Copy the contents of `frontend/` into a `docs/` folder at the repository root (or keep `index.html` at root).
2. Go to repository **Settings** &rarr; **Pages**.
3. Under **Source**, choose **Deploy from a branch**.
4. Select branch **main** and folder **`/ (root)`** or **`/docs`**.
5. Click **Save**.

---

## 5. Subpath Compatibility & Relative Asset Links

When hosted on GitHub Pages under a project subpath (e.g. `https://username.github.io/my-camera-repo/`):
- All stylesheets, scripts, and links in `index.html` and `demo.html` use relative paths (`./style.css`, `./config.js`, `./app.js`, `./demo.js`).
- The link generator inside `frontend/config.js` (`getDemoPageUrl`) dynamically resolves the correct relative path:
  ```javascript
  const basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
  const demoUrl = new URL(`${basePath}demo.html`, window.location.origin);
  ```
- This ensures generated demonstration links resolve accurately regardless of custom domain or GitHub repository subpaths.

---

## 6. HTTPS & Camera Permissions on GitHub Pages

- GitHub Pages provides free SSL/HTTPS certificates automatically for all `*.github.io` subdomains.
- Under modern browser security specifications, `navigator.mediaDevices.getUserMedia` is restricted strictly to **Secure Contexts** (`isSecureContext === true`).
- Ensure the **Enforce HTTPS** checkbox is enabled in your GitHub Pages settings.
