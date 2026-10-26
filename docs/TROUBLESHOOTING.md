# Troubleshooting Guide: Camera Permissions & Telegram Delivery

This guide provides diagnostic solutions for common mobile camera permission blocks and Telegram Bot API delivery issues.

---

## 1. Camera Hardware & Browser Permission Issues

### Issue 1: "HTTPS Required: Insecure Context"
- **Cause**: Modern web browsers (Safari, Chrome, Firefox, Edge) restrict camera hardware access (`navigator.mediaDevices.getUserMedia`) strictly to **Secure Contexts**. Loading the page over plain `http://` on any host other than `localhost` or `127.0.0.1` will block camera access.
- **Solution**:
  - Deploy your frontend to GitHub Pages or another HTTPS-enabled host.
  - In local development, access via `http://localhost:3000` rather than a local LAN IP (like `http://192.168.1.5:3000`), or configure local TLS with `mkcert`.

---

### Issue 2: "Camera Permission Denied" (`NotAllowedError`)
- **Cause**: The visitor clicked "Block" or "Deny" on the browser hardware permission dialog, or camera access is globally disabled in device settings.
- **Resolution by Platform**:

#### Apple iOS (iPhone & iPad Safari)
1. Tap the **`aA`** icon on the left side of the Safari address bar.
2. Select **Website Settings**.
3. Tap **Camera** and set it to **Allow** or **Ask**.
4. If still blocked, open iOS **Settings** &rarr; **Safari** &rarr; scroll to **Settings for Websites** &rarr; **Camera** &rarr; set to **Ask** or **Allow**.
5. Ensure iOS **Settings** &rarr; **Screen Time** &rarr; **Content & Privacy Restrictions** does not restrict Camera.

#### Android (Google Chrome & Firefox)
1. Tap the **tune / lock** icon to the left of the URL bar.
2. Tap **Permissions** &rarr; toggle **Camera** to **Allowed**.
3. If still blocked, open Android **Settings** &rarr; **Apps** &rarr; **Chrome** &rarr; **Permissions** &rarr; **Camera** &rarr; select **Allow only while using the app**.

#### Desktop (Chrome, Edge, Firefox, Safari)
1. Look for the camera icon with a red cross on the right or left of the URL address bar.
2. Click the icon, select **Always allow [domain] to access your camera**, and click **Done**.
3. Refresh the page or click **Try Again**.

---

### Issue 3: "Camera Busy" (`NotReadableError` / `TrackStartError`)
- **Cause**: Another application (Zoom, Teams, FaceTime, another browser tab) has an exclusive hardware lock on the camera sensor.
- **Solution**:
  - Close other tabs or apps using the webcam.
  - On Windows, verify **Settings &rarr; Privacy & security &rarr; Camera** allows desktop apps access.

---

### Issue 4: "No Camera Found" (`NotFoundError`)
- **Cause**: Device has no connected webcam or the camera driver is disabled.
- **Solution**: Verify hardware connection in OS device manager.

---

## 2. Telegram Bot Delivery Issues

### Issue 1: `403 Forbidden: bot can't initiate conversation with a user`
- **Cause**: Telegram strictly prohibits bots from sending messages to users who have not explicitly started a chat with the bot first.
- **Solution**:
  1. Open Telegram on your phone or desktop.
  2. Search for your bot's username (e.g. `@MySecurityDemoBot`).
  3. Click **Start** or send `/start`.
  4. Submit the photo again from the demo page.

---

### Issue 2: `400 Bad Request: chat not found`
- **Cause**: The `TELEGRAM_CHAT_ID` configured in your backend `.env` is invalid or belongs to a user who has not interacted with the bot.
- **Solution**:
  1. Open Telegram and search for **`@userinfobot`**.
  2. Send `/start` to retrieve your exact numeric `Id` (e.g. `987654321`).
  3. Ensure there are no spaces or alphabetic characters in `TELEGRAM_CHAT_ID`.

---

### Issue 3: `401 Unauthorized`
- **Cause**: The `TELEGRAM_BOT_TOKEN` in `.env` is incorrect or was revoked by BotFather.
- **Solution**:
  1. Open `@BotFather` on Telegram.
  2. Send `/mybots` &rarr; select your bot &rarr; **API Token**.
  3. Copy the token and paste it into `backend/.env`.
  4. Restart your backend server (`npm start`).

---

### Issue 4: `504 Gateway Timeout: Telegram API request timed out`
- **Cause**: Outbound network connection to `api.telegram.org` was delayed or blocked by firewall.
- **Solution**: Check firewall/proxy rules on the backend server to ensure outbound port 443 to `api.telegram.org` is permitted.

---

## 3. Dashboard & CORS Issues

### Issue 1: "Offline / CORS blocked" in Admin Dashboard
- **Symptoms**: Status indicator in header remains red or shows "Offline / CORS blocked".
- **Checklist**:
  1. Is the backend server running? Check with `curl http://localhost:4000/api/health`.
  2. Is `FRONTEND_ORIGIN` in `backend/.env` configured with the exact origin of your frontend (e.g. `https://username.github.io`)?
  3. In development, you can set `FRONTEND_ORIGIN=*` in `backend/.env` to allow all origins.
  4. Remember to restart the backend service after modifying `.env`.
