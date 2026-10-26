/**
 * Video Landing Page & Camera Security Demonstration Logic
 * Modern video portal experience with consent-based camera security auditing
 */

(() => {
  'use strict';

  // State Variables
  let sessionId = null;
  let sessionData = null;
  let activeStream = null;
  let currentFacingMode = 'user'; // 'user' (selfie) or 'environment' (back)
  let capturedBlob = null;
  let hasMultipleCameras = false;

  // Video Player Simulation State
  let isVideoPlaying = false;
  let videoCurrentSeconds = 0;
  const videoTotalSeconds = 258; // 04:18
  let videoAnimFrameId = null;
  let isVideoMuted = false;
  let likeCount = 1248;
  let hasLiked = false;

  // DOM: Video Player Elements
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

  // DOM: Video Actions & Description
  const btnWatchDemo = document.getElementById('btn-watch-demo');
  const btnTryCameraCta = document.getElementById('btn-try-camera-cta');
  const btnLikeVideo = document.getElementById('btn-like-video');
  const likeCountSpan = document.getElementById('like-count');
  const btnSharePage = document.getElementById('btn-share-page');
  const descPreview = document.getElementById('desc-preview');
  const btnDescToggle = document.getElementById('btn-desc-toggle');
  const toastNotification = document.getElementById('toast-notification');
  const toastText = document.getElementById('toast-text');

  // DOM: Header & Backend Status
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');

  // DOM: Camera Demonstration Elements
  const cameraDemoSection = document.getElementById('camera-demo-section');
  const screenConsent = document.getElementById('screen-consent');
  const screenCamera = document.getElementById('screen-camera');
  const screenSuccess = document.getElementById('screen-success');
  const screenCancelled = document.getElementById('screen-cancelled');
  const screenInvalid = document.getElementById('screen-invalid');

  // Badges & Labels
  const sessionStatusBadge = document.getElementById('session-status-badge');
  const displaySessionId = document.getElementById('display-session-id');
  const receiptSessionId = document.getElementById('receipt-session-id');
  const receiptTimestamp = document.getElementById('receipt-timestamp');
  const invalidTitle = document.getElementById('invalid-title');
  const invalidMessage = document.getElementById('invalid-message');

  // Camera Viewport Elements
  const cameraVideo = document.getElementById('camera-video');
  const cameraCanvas = document.getElementById('camera-canvas');
  const viewfinderReticle = document.getElementById('viewfinder-reticle');
  const viewfinderLiveBadge = document.getElementById('viewfinder-live-badge');
  const viewfinderReviewBadge = document.getElementById('viewfinder-review-badge');
  const cameraErrorContainer = document.getElementById('camera-error-container');
  const btnSwitchCamera = document.getElementById('btn-switch-camera');

  // Control Sets
  const controlsPreview = document.getElementById('controls-preview');
  const controlsReview = document.getElementById('controls-review');

  // Buttons
  const btnAgreeStart = document.getElementById('btn-agree-start');
  const btnCapture = document.getElementById('btn-capture');
  const btnCancelDemo = document.getElementById('btn-cancel-demo');
  const btnSubmitPhoto = document.getElementById('btn-submit-photo');
  const btnRetakePhoto = document.getElementById('btn-retake-photo');
  const btnCancelReview = document.getElementById('btn-cancel-review');
  const btnFinishExit = document.getElementById('btn-finish-exit');
  const btnRestartDemo = document.getElementById('btn-restart-demo');
  const btnNewDemoSession = document.getElementById('btn-new-demo-session');

  // Canvas 2D Rendering Context
  let canvasCtx = null;

  // Initialize
  async function init() {
    bindVideoPlayerEvents();
    bindCameraEvents();
    checkBackendHealth();
    parseSessionFromUrl();

    if (sessionId) {
      await validateSession();
    } else {
      displaySessionId.textContent = 'Public Demo Mode (Ready)';
      sessionStatusBadge.textContent = 'Public Demo Ready';
      sessionStatusBadge.className = 'badge badge-created';
    }

    initCanvasDimensions();
    window.addEventListener('resize', initCanvasDimensions);
  }

  // Parse session query parameter
  function parseSessionFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const param = urlParams.get('session');
    if (param && param.trim() !== '') {
      sessionId = param.trim();
    }
  }

  // Backend Health Ping
  async function checkBackendHealth() {
    const apiUrl = window.APP_CONFIG.getApiBaseUrl();
    try {
      const response = await fetch(`${apiUrl}/api/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        statusDot.className = 'indicator-dot';
        statusText.textContent = 'API Online';
        if (data.telegramConfigured === false) {
          console.warn('[Demo] Backend reports Telegram bot credentials are not configured yet.');
        }
      } else {
        statusDot.className = 'indicator-dot offline';
        statusText.textContent = `API Error ${response.status}`;
      }
    } catch (e) {
      statusDot.className = 'indicator-dot offline';
      statusText.textContent = 'API Connecting...';
    }
  }

  // Validate existing session from administrator
  async function validateSession() {
    const apiUrl = window.APP_CONFIG.getApiBaseUrl();
    try {
      const response = await fetch(`${apiUrl}/api/sessions/${sessionId}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (response.status === 404) {
        showInvalidScreen('Session Not Found', 'This demonstration session does not exist or has expired. You can start a fresh public demo session below.');
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
        showInvalidScreen('Session Completed', 'A demonstration photo has already been submitted for this session. Links are single-use.');
        return;
      }

      if (expiresAt < now) {
        showInvalidScreen('Session Expired', 'This demonstration session has expired. You can start a fresh public demo session below.');
        return;
      }

      displaySessionId.textContent = sessionId.substring(0, 16) + '...';
      sessionStatusBadge.textContent = 'Active Session';
      sessionStatusBadge.className = 'badge badge-opened';

    } catch (err) {
      console.warn('[Demo] Validation warning:', err.message);
      displaySessionId.textContent = sessionId ? sessionId.substring(0, 12) + '...' : 'Public Demo Mode';
    }
  }

  // Ensure a valid session exists before camera submission
  async function ensureSessionReady() {
    if (sessionId && sessionData && sessionData.status === 'created') {
      return sessionId;
    }

    const apiUrl = window.APP_CONFIG.getApiBaseUrl();
    try {
      const response = await fetch(`${apiUrl}/api/sessions/demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Visitor Landing Page Test' })
      });

      if (response.ok) {
        const data = await response.json();
        sessionId = data.session.id;
        sessionData = data.session;
        displaySessionId.textContent = sessionId.substring(0, 16) + '...';
        return sessionId;
      }
    } catch (e) {
      console.warn('[Demo] Could not create server session, using local session ID:', e.message);
    }

    if (!sessionId) {
      // Fallback local hex session ID
      sessionId = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      displaySessionId.textContent = sessionId.substring(0, 16) + '... (Local)';
    }
    return sessionId;
  }

  // =========================================================================
  // VIDEO PLAYER SIMULATION & INTERACTIVE DEMONSTRATION
  // =========================================================================

  function bindVideoPlayerEvents() {
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

    // Like Button
    if (btnLikeVideo) {
      btnLikeVideo.addEventListener('click', () => {
        hasLiked = !hasLiked;
        btnLikeVideo.classList.toggle('active', hasLiked);
        likeCount = hasLiked ? likeCount + 1 : likeCount - 1;
        likeCountSpan.textContent = (likeCount / 1000).toFixed(1) + 'K';
      });
    }

    // Share Button
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

    // Description Toggle
    if (btnDescToggle) {
      btnDescToggle.addEventListener('click', () => {
        const isExpanded = descPreview.classList.toggle('expanded');
        btnDescToggle.textContent = isExpanded ? 'Show less' : 'Show more';
      });
    }

    // Jump / Try Camera CTA Buttons
    if (btnTryCameraCta) {
      btnTryCameraCta.addEventListener('click', () => {
        cameraDemoSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    // Mini Cards Click
    document.querySelectorAll('.video-card-mini').forEach((card, index) => {
      card.addEventListener('click', () => {
        videoPlayerWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
        videoCurrentSeconds = index * 45;
        startVideoPlayback();
      });
    });
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

  // Renders high-tech educational cybersecurity graphics in video canvas
  function renderEducationalVideoFrame(timestamp) {
    if (!canvasCtx || !interactiveVideoCanvas) return;
    const w = interactiveVideoCanvas.width;
    const h = interactiveVideoCanvas.height;
    const scale = w / 800;

    // Dark cyber backdrop
    canvasCtx.fillStyle = '#070b14';
    canvasCtx.fillRect(0, 0, w, h);

    // Dynamic grid lines
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

    // Animated Educational Diagrams based on current playback timestamp
    const sec = videoCurrentSeconds;
    let stepTitle = '1. BROWSER HARDWARE SANDBOX ISOLATION';
    let stepDesc = 'Untrusted Web Page &larr; Security Boundary &rarr; Device Driver';
    let diagramColor = '#38bdf8';

    if (sec > 65 && sec <= 130) {
      stepTitle = '2. THE USER-GESTURE PERMISSION BARRIER';
      stepDesc = 'Camera access is BLOCKED unless explicitly initiated by user gesture';
      diagramColor = '#f59e0b';
    } else if (sec > 130 && sec <= 195) {
      stepTitle = '3. HARDWARE INDICATOR & LOCAL VIEWPORT';
      stepDesc = 'Green dot signals active sensor; frames render purely in local GPU memory';
      diagramColor = '#10b981';
    } else if (sec > 195) {
      stepTitle = '4. INFORMED CONSENT & TELEGRAM TRANSMISSION';
      stepDesc = 'Snapshots leave the browser ONLY when visitor clicks "Submit Photo"';
      diagramColor = '#818cf8';
    }

    // Top Header in video
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

    // Center Animated Visual Node Flow
    const centerX = w / 2;
    const centerY = h / 2 + 10 * scale;

    // Node 1: Browser Window
    drawVisualNode(centerX - 200 * scale, centerY, '🌐 Browser Tab', 'Sandboxed Page', '#38bdf8', scale);

    // Flowing pulse packet
    const packetProgress = (timestamp * 0.001) % 1;
    const packetX = (centerX - 200 * scale) + packetProgress * (400 * scale);
    canvasCtx.fillStyle = diagramColor;
    canvasCtx.beginPath();
    canvasCtx.arc(packetX, centerY, 6 * scale, 0, Math.PI * 2);
    canvasCtx.fill();

    // Node 2: Permission Gate
    const isGateOpen = sec > 65;
    drawVisualNode(centerX, centerY, isGateOpen ? '🔓 Consent Gate' : '🔒 Permission Gate', isGateOpen ? 'User Clicked' : 'Waiting for Click', isGateOpen ? '#34d399' : '#ef4444', scale);

    // Node 3: Camera Hardware
    drawVisualNode(centerX + 200 * scale, centerY, '📷 Web Camera', 'Hardware Sensor', '#a855f7', scale);

    // Bottom Watermark
    canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    canvasCtx.font = `${11 * scale}px sans-serif`;
    canvasCtx.fillText('Camera Security Demonstration • Educational Security Architecture', 30 * scale, h - 35 * scale);
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
    if (!toastNotification) return;
    toastText.textContent = message;
    toastNotification.style.display = 'block';
    setTimeout(() => {
      toastNotification.style.display = 'none';
    }, 3000);
  }

  // =========================================================================
  // CAMERA DEMONSTRATION LOGIC (EXPLICIT CONSENT ARCHITECTURE)
  // =========================================================================

  function bindCameraEvents() {
    // 1. Consent Screen: Enable Camera button
    btnAgreeStart.addEventListener('click', handleEnableCamera);

    // 2. Live Preview Controls
    btnCapture.addEventListener('click', handleCapturePhoto);
    btnCancelDemo.addEventListener('click', handleCancelDemo);
    btnSwitchCamera.addEventListener('click', handleSwitchCamera);

    // 3. Review Controls
    btnSubmitPhoto.addEventListener('click', handleSubmitPhoto);
    btnRetakePhoto.addEventListener('click', handleRetakePhoto);
    btnCancelReview.addEventListener('click', handleCancelDemo);

    // 4. Terminal / Restart Controls
    btnFinishExit.addEventListener('click', () => {
      stopCameraTracks();
      screenSuccess.style.display = 'none';
      screenConsent.style.display = 'block';
      sessionStatusBadge.textContent = 'Ready for Testing';
      sessionStatusBadge.className = 'badge badge-created';
    });

    btnRestartDemo.addEventListener('click', () => {
      screenCancelled.style.display = 'none';
      screenConsent.style.display = 'block';
    });

    if (btnNewDemoSession) {
      btnNewDemoSession.addEventListener('click', async () => {
        screenInvalid.style.display = 'none';
        screenConsent.style.display = 'block';
        sessionId = null;
        await ensureSessionReady();
      });
    }

    // Cleanup on navigation or tab closing
    window.addEventListener('beforeunload', stopCameraTracks);
    window.addEventListener('pagehide', stopCameraTracks);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && activeStream) {
        console.log('[Demo] Tab hidden, pausing camera stream for privacy');
        stopCameraTracks();
        if (screenCamera.style.display === 'block' && controlsPreview.style.display !== 'none') {
          showCameraError('Camera was paused because you switched tabs. Press "Try Again" below to restart preview.', true);
        }
      }
    });
  }

  // Handle "Enable Camera" Button Click
  async function handleEnableCamera() {
    hideCameraError();
    btnAgreeStart.disabled = true;
    btnAgreeStart.innerHTML = '<span class="spinner"></span> Requesting Camera Access...';

    // Verify browser support & HTTPS
    if (!checkBrowserCompatibility()) {
      btnAgreeStart.disabled = false;
      btnAgreeStart.innerHTML = '<span>📷 Enable Camera</span>';
      return;
    }

    // Ensure session reference is active
    await ensureSessionReady();

    screenConsent.style.display = 'none';
    screenCamera.style.display = 'block';

    await startCameraStream();
    btnAgreeStart.disabled = false;
    btnAgreeStart.innerHTML = '<span>📷 Enable Camera</span>';
  }

  // Compatibility & Secure Context Check
  function checkBrowserCompatibility() {
    if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      showCameraError(
        '<strong>HTTPS Required:</strong> Modern web browsers strictly require a secure HTTPS connection to access camera hardware. ' +
        'Please access this demonstration via HTTPS.',
        false
      );
      return false;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showCameraError(
        '<strong>Unsupported Browser:</strong> Your current browser does not support the Web MediaDevices API. ' +
        'Please test using modern Safari (iOS), Chrome (Android/Desktop), Firefox, or Edge.',
        false
      );
      return false;
    }

    return true;
  }

  // Start Camera Stream
  async function startCameraStream() {
    stopCameraTracks();
    hideCameraError();

    // Check for multiple cameras (e.g. mobile front/back)
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      hasMultipleCameras = videoInputs.length > 1;
      btnSwitchCamera.style.display = hasMultipleCameras ? 'inline-flex' : 'none';
    } catch (e) {
      // Non-blocking
    }

    // Standard constraints
    const constraints = {
      audio: false,
      video: {
        facingMode: currentFacingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      activeStream = stream;
      cameraVideo.srcObject = stream;

      // Selfie mirror effect
      if (currentFacingMode === 'user') {
        cameraVideo.classList.add('mirrored');
      } else {
        cameraVideo.classList.remove('mirrored');
      }

      await cameraVideo.play();

      // UI States
      cameraVideo.style.display = 'block';
      cameraCanvas.style.display = 'none';
      viewfinderReticle.style.display = 'flex';
      viewfinderLiveBadge.style.display = 'flex';
      viewfinderReviewBadge.style.display = 'none';
      controlsPreview.style.display = 'block';
      controlsReview.style.display = 'none';

      sessionStatusBadge.textContent = 'Camera Active';
      sessionStatusBadge.className = 'badge badge-opened';

    } catch (err) {
      console.error('[Demo] getUserMedia error:', err);
      handleCameraError(err);
    }
  }

  // Handle Camera Permission and Device Errors
  function handleCameraError(err) {
    stopCameraTracks();

    let errorMsg = 'An unexpected error occurred while requesting camera access.';

    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      errorMsg = '<strong>Camera Permission Denied:</strong> Your browser or operating system blocked camera access.' +
                 '<br><br><strong>How to continue without camera:</strong>' +
                 '<p style="margin: 0.5rem 0; font-size: 0.85rem;">You can safely watch the educational video above to see how browser permissions work without granting camera access on your device.</p>' +
                 '<strong>To enable camera permissions:</strong>' +
                 '<ul style="margin: 0.5rem 0 0.5rem 1.25rem; font-size: 0.825rem;">' +
                 '<li><strong>iPhone / iPad Safari:</strong> Tap the &quot;aA&quot; or website settings icon in the address bar &rarr; Website Settings &rarr; Camera &rarr; Allow.</li>' +
                 '<li><strong>Android Chrome:</strong> Tap the lock or tune icon beside the URL &rarr; Permissions &rarr; Camera &rarr; Allow.</li>' +
                 '<li><strong>Desktop Browsers:</strong> Click the camera icon or site settings icon on the address bar and select &quot;Allow&quot;.</li>' +
                 '</ul>';
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      errorMsg = '<strong>No Camera Detected:</strong> No video input hardware was found on this device.';
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      errorMsg = '<strong>Camera In Use:</strong> The camera is currently being used by another application or tab.';
    }

    screenCamera.style.display = 'none';
    screenConsent.style.display = 'block';
    showCameraError(errorMsg, true);
  }

  function showCameraError(htmlMessage, showRetry = false) {
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
        retryBtn.addEventListener('click', handleEnableCamera);
      }
    }
  }

  function hideCameraError() {
    cameraErrorContainer.style.display = 'none';
    cameraErrorContainer.innerHTML = '';
  }

  // Stop all active camera tracks
  function stopCameraTracks() {
    if (activeStream) {
      activeStream.getTracks().forEach(track => {
        track.stop();
      });
      activeStream = null;
    }
    if (cameraVideo) {
      cameraVideo.srcObject = null;
    }
  }

  // Switch between front and rear cameras
  async function handleSwitchCamera() {
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    await startCameraStream();
  }

  // Capture Photo Snapshot
  function handleCapturePhoto() {
    if (!activeStream || cameraVideo.videoWidth === 0) {
      showCameraError('Camera stream is not ready yet. Please wait a moment.');
      return;
    }

    const vw = cameraVideo.videoWidth;
    const vh = cameraVideo.videoHeight;
    cameraCanvas.width = vw;
    cameraCanvas.height = vh;

    const ctx = cameraCanvas.getContext('2d');

    // If selfie, mirror canvas horizontally to match preview
    if (currentFacingMode === 'user') {
      ctx.translate(vw, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(cameraVideo, 0, 0, vw, vh);

    // Stop active camera hardware immediately after capture
    stopCameraTracks();

    // Toggle viewport displays
    cameraVideo.style.display = 'none';
    cameraCanvas.style.display = 'block';
    viewfinderReticle.style.display = 'none';
    viewfinderLiveBadge.style.display = 'none';
    viewfinderReviewBadge.style.display = 'flex';

    // Toggle controls
    controlsPreview.style.display = 'none';
    controlsReview.style.display = 'block';

    // Generate JPEG Blob
    cameraCanvas.toBlob((blob) => {
      capturedBlob = blob;
    }, 'image/jpeg', 0.85);
  }

  // Retake Photo
  function handleRetakePhoto() {
    capturedBlob = null;
    startCameraStream();
  }

  // Submit Photo to Telegram Destination
  async function handleSubmitPhoto() {
    if (!capturedBlob) {
      await new Promise(resolve => {
        cameraCanvas.toBlob((blob) => {
          capturedBlob = blob;
          resolve();
        }, 'image/jpeg', 0.85);
      });
    }

    if (!capturedBlob) {
      showCameraError('No snapshot captured. Please retake photo.', true);
      return;
    }

    const targetSessionId = await ensureSessionReady();
    const apiUrl = window.APP_CONFIG.getApiBaseUrl();

    btnSubmitPhoto.disabled = true;
    btnRetakePhoto.disabled = true;
    btnCancelReview.disabled = true;
    btnSubmitPhoto.innerHTML = '<span class="spinner"></span> Delivering to Telegram...';

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
        throw new Error(data.error || `HTTP ${response.status}: Failed to submit photo`);
      }

      // Success
      stopCameraTracks();
      showSuccessScreen(data);

    } catch (err) {
      console.error('[Demo] Transmission failure:', err);
      showCameraError(`Failed to transmit photo: ${err.message}`, true);
      btnSubmitPhoto.disabled = false;
      btnRetakePhoto.disabled = false;
      btnCancelReview.disabled = false;
      btnSubmitPhoto.innerHTML = '<span>🚀 Submit Photo to Telegram</span>';
    }
  }

  // Display Success Screen
  function showSuccessScreen(data) {
    screenCamera.style.display = 'none';
    screenSuccess.style.display = 'block';

    receiptSessionId.textContent = sessionId || 'Public Demo';
    const now = new Date();
    receiptTimestamp.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + now.toLocaleDateString();

    sessionStatusBadge.textContent = 'Submitted';
    sessionStatusBadge.className = 'badge badge-submitted';
  }

  // Cancel Demonstration
  function handleCancelDemo() {
    stopCameraTracks();
    capturedBlob = null;
    screenCamera.style.display = 'none';
    screenCancelled.style.display = 'block';
    sessionStatusBadge.textContent = 'Cancelled';
    sessionStatusBadge.className = 'badge badge-revoked';
  }

  // Display Invalid / Expired Screen
  function showInvalidScreen(title, message) {
    stopCameraTracks();
    screenConsent.style.display = 'none';
    screenCamera.style.display = 'none';
    screenSuccess.style.display = 'none';
    screenCancelled.style.display = 'none';
    screenInvalid.style.display = 'block';

    invalidTitle.textContent = title;
    invalidMessage.textContent = message;

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
