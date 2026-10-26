/**
 * Visitor Camera Demonstration Logic — Consent, MediaDevices, Capture & Telegram Submission
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

  // DOM Screens
  const screenConsent = document.getElementById('screen-consent');
  const screenCamera = document.getElementById('screen-camera');
  const screenSuccess = document.getElementById('screen-success');
  const screenCancelled = document.getElementById('screen-cancelled');
  const screenInvalid = document.getElementById('screen-invalid');

  // Badges & Labels
  const sessionStatusBadge = document.getElementById('session-status-badge');
  const displaySessionId = document.getElementById('display-session-id');
  const viewfinderSessionRef = document.getElementById('viewfinder-session-ref');
  const receiptSessionId = document.getElementById('receipt-session-id');
  const receiptTimestamp = document.getElementById('receipt-timestamp');
  const invalidTitle = document.getElementById('invalid-title');
  const invalidMessage = document.getElementById('invalid-message');

  // Camera Elements
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
  const btnConsentCancel = document.getElementById('btn-consent-cancel');
  const btnCapture = document.getElementById('btn-capture');
  const btnCancelDemo = document.getElementById('btn-cancel-demo');
  const btnSubmitPhoto = document.getElementById('btn-submit-photo');
  const btnRetakePhoto = document.getElementById('btn-retake-photo');
  const btnCancelReview = document.getElementById('btn-cancel-review');
  const btnFinishExit = document.getElementById('btn-finish-exit');
  const btnRestartDemo = document.getElementById('btn-restart-demo');

  // Initialize
  async function init() {
    bindEvents();
    parseSessionFromUrl();

    if (!sessionId) {
      showInvalidScreen('Missing Session ID', 'No demonstration session reference was provided in the URL. Please use the complete link provided by your administrator.');
      return;
    }

    displaySessionId.textContent = sessionId.substring(0, 12) + '...';
    viewfinderSessionRef.textContent = 'ID: ' + sessionId.substring(0, 8);

    await validateSession();
  }

  // Parse session query parameter
  function parseSessionFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    sessionId = urlParams.get('session');
    if (sessionId) {
      sessionId = sessionId.trim();
    }
  }

  // Validate session against backend API
  async function validateSession() {
    const apiUrl = window.APP_CONFIG.getApiBaseUrl();

    try {
      const response = await fetch(`${apiUrl}/api/sessions/${sessionId}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (response.status === 404) {
        showInvalidScreen('Session Not Found', 'This demonstration session does not exist or has been permanently removed.');
        return;
      }

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      sessionData = await response.json();

      // Check session status
      const now = new Date();
      const expiresAt = new Date(sessionData.expiresAt);

      if (sessionData.status === 'revoked') {
        showInvalidScreen('Session Revoked', 'This demonstration session was explicitly revoked by the administrator.');
        return;
      }

      if (sessionData.status === 'submitted') {
        showInvalidScreen('Session Already Completed', 'A demonstration photo was already submitted for this session. Single-use sessions cannot be reused.');
        return;
      }

      if (expiresAt < now) {
        showInvalidScreen('Session Expired', `This demonstration link expired on ${expiresAt.toLocaleTimeString()} (${expiresAt.toLocaleDateString()}). Please request a new link.`);
        return;
      }

      // Mark session as opened on backend
      recordSessionOpened();

      // Update badge
      sessionStatusBadge.textContent = 'Session Active';
      sessionStatusBadge.className = 'badge badge-opened';

    } catch (err) {
      console.error('[Demo] Validation error:', err);
      // If offline or network issue, display friendly warning
      showInvalidScreen('Connection Failed', `Could not connect to the demonstration backend (${err.message}). Please ensure the server is online and accessible.`);
    }
  }

  // Record that link was opened
  async function recordSessionOpened() {
    const apiUrl = window.APP_CONFIG.getApiBaseUrl();
    try {
      await fetch(`${apiUrl}/api/sessions/${sessionId}/opened`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      // Non-blocking log
      console.warn('[Demo] Could not record opened status:', e);
    }
  }

  // Display invalidation screen
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

  // Bind UI Events
  function bindEvents() {
    // Consent Step
    btnAgreeStart.addEventListener('click', handleConsentAccepted);
    btnConsentCancel.addEventListener('click', handleCancel);

    // Live Preview Controls
    btnCapture.addEventListener('click', handleCapturePhoto);
    btnCancelDemo.addEventListener('click', handleCancel);
    btnSwitchCamera.addEventListener('click', handleSwitchCamera);

    // Review Controls
    btnSubmitPhoto.addEventListener('click', handleSubmitPhoto);
    btnRetakePhoto.addEventListener('click', handleRetakePhoto);
    btnCancelReview.addEventListener('click', handleCancel);

    // Terminal Screens
    btnFinishExit.addEventListener('click', () => {
      window.close();
      // If browser prevents closing tab:
      document.body.innerHTML = `
        <div class="container" style="text-align: center; padding-top: 4rem;">
          <h1 style="color: #ffffff; margin-bottom: 1rem;">Session Closed</h1>
          <p style="color: var(--text-muted);">You may now close this browser tab safely.</p>
        </div>
      `;
    });

    btnRestartDemo.addEventListener('click', () => {
      screenCancelled.style.display = 'none';
      screenConsent.style.display = 'block';
    });

    // Cleanup on page exit/visibility change
    window.addEventListener('beforeunload', stopCameraTracks);
    window.addEventListener('pagehide', stopCameraTracks);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && activeStream) {
        // Stop tracks when user switches away to protect privacy
        console.log('[Demo] Tab hidden, pausing camera tracks for privacy');
        stopCameraTracks();
        if (screenCamera.style.display === 'block' && controlsPreview.style.display !== 'none') {
          showCameraError('Camera was paused because you navigated away from this tab. Click "Resume Camera" below to restart preview.', true);
        }
      }
    });
  }

  // Handle Consent Acceptance
  async function handleConsentAccepted() {
    btnAgreeStart.disabled = true;
    btnAgreeStart.innerHTML = '<span class="spinner"></span> Requesting Camera Access...';

    // Verify browser compatibility
    if (!checkBrowserCompatibility()) {
      btnAgreeStart.disabled = false;
      btnAgreeStart.innerHTML = '<span>📷 I Understand — Start Camera Demonstration</span>';
      return;
    }

    screenConsent.style.display = 'none';
    screenCamera.style.display = 'block';

    await startCameraStream();
    btnAgreeStart.disabled = false;
    btnAgreeStart.innerHTML = '<span>📷 I Understand — Start Camera Demonstration</span>';
  }

  // Compatibility & Security Context Checks
  function checkBrowserCompatibility() {
    // 1. Insecure Context Check (getUserMedia requires HTTPS or localhost)
    if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      showCameraError(
        'HTTPS Required: Modern mobile and desktop browsers strictly require a secure HTTPS connection to access camera hardware. ' +
        'Please access this application via HTTPS or localhost.'
      );
      return false;
    }

    // 2. MediaDevices API Support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showCameraError(
        'Unsupported Browser: Your browser does not support the standard Web MediaDevices API (getUserMedia). ' +
        'Please test using modern Chrome, Safari, Firefox, or Edge.'
      );
      return false;
    }

    return true;
  }

  // Check for front and rear cameras
  async function detectMultipleCameras() {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        if (videoDevices.length > 1) {
          hasMultipleCameras = true;
          btnSwitchCamera.style.display = 'inline-flex';
        }
      }
    } catch (e) {
      console.warn('[Demo] Could not enumerate devices:', e);
    }
  }

  // Start Camera Stream
  async function startCameraStream() {
    hideCameraError();
    stopCameraTracks();

    // Reset viewfinder UI
    cameraVideo.style.display = 'block';
    cameraCanvas.style.display = 'none';
    viewfinderReticle.style.display = 'flex';
    viewfinderLiveBadge.style.display = 'flex';
    viewfinderReviewBadge.style.display = 'none';
    controlsPreview.style.display = 'flex';
    controlsReview.style.display = 'none';

    // Set mirror effect for front camera only
    if (currentFacingMode === 'user') {
      cameraVideo.classList.add('mirrored');
    } else {
      cameraVideo.classList.remove('mirrored');
    }

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

      // Wait for video metadata to load
      await new Promise((resolve) => {
        cameraVideo.onloadedmetadata = () => {
          cameraVideo.play();
          resolve();
        };
      });

      // Detect multiple cameras once permission is granted
      if (!hasMultipleCameras) {
        detectMultipleCameras();
      }

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
      errorMsg = '<strong>Camera Permission Denied:</strong> Your browser or operating system blocked camera access. ' +
                 '<br><br>To proceed with the demonstration: ' +
                 '<ul style="margin: 0.5rem 0 0.5rem 1.25rem; font-size: 0.825rem;">' +
                 '<li><strong>iPhone / iPad Safari:</strong> Tap the &quot;aA&quot; or website settings icon in the address bar &rarr; Website Settings &rarr; Camera &rarr; Allow.</li>' +
                 '<li><strong>Android Chrome / Firefox:</strong> Tap the lock or tune icon beside the URL &rarr; Permissions &rarr; Camera &rarr; Allow.</li>' +
                 '<li><strong>Desktop Browsers:</strong> Click the camera icon on the right side of the address bar and select &quot;Always allow&quot;.</li>' +
                 '</ul>';
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      errorMsg = '<strong>No Camera Found:</strong> No video input hardware was detected on this device.';
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      errorMsg = '<strong>Camera Busy:</strong> The camera is already in use by another application, browser tab, or background process.';
    } else if (err.name === 'OverconstrainedError') {
      errorMsg = '<strong>Camera Configuration Unsupported:</strong> The requested camera mode is not supported by your hardware.';
    }

    showCameraError(errorMsg, true);
  }

  // Show Camera Error Notice
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
        retryBtn.addEventListener('click', startCameraStream);
      }
    }
  }

  function hideCameraError() {
    cameraErrorContainer.style.display = 'none';
    cameraErrorContainer.innerHTML = '';
  }

  // Switch between front and rear cameras
  function handleSwitchCamera() {
    currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
    btnSwitchCamera.innerHTML = currentFacingMode === 'user' ? '<span>🔄 Use Back Camera</span>' : '<span>🔄 Use Front Camera</span>';
    startCameraStream();
  }

  // Capture Photo Frame
  function handleCapturePhoto() {
    if (!cameraVideo || !cameraVideo.videoWidth) {
      showCameraError('Camera stream is not ready for snapshot. Please wait a moment and try again.', true);
      return;
    }

    const videoWidth = cameraVideo.videoWidth;
    const videoHeight = cameraVideo.videoHeight;

    // Scale to max dimension 1280px to optimize upload speed & bandwidth
    const maxDim = 1280;
    let targetWidth = videoWidth;
    let targetHeight = videoHeight;

    if (targetWidth > maxDim || targetHeight > maxDim) {
      if (targetWidth > targetHeight) {
        targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
        targetWidth = maxDim;
      } else {
        targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
        targetHeight = maxDim;
      }
    }

    cameraCanvas.width = targetWidth;
    cameraCanvas.height = targetHeight;
    const ctx = cameraCanvas.getContext('2d');

    // If front camera, mirror image onto canvas so it matches what the user saw in preview
    if (currentFacingMode === 'user') {
      ctx.translate(targetWidth, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(cameraVideo, 0, 0, targetWidth, targetHeight);

    // Stop active camera tracks immediately upon capture for hardware privacy
    stopCameraTracks();

    // Switch view to review mode
    cameraVideo.style.display = 'none';
    cameraCanvas.style.display = 'block';
    viewfinderReticle.style.display = 'none';
    viewfinderLiveBadge.style.display = 'none';
    viewfinderReviewBadge.style.display = 'block';

    controlsPreview.style.display = 'none';
    controlsReview.style.display = 'flex';

    // Compress to JPEG Blob (quality 0.85)
    cameraCanvas.toBlob((blob) => {
      capturedBlob = blob;
    }, 'image/jpeg', 0.85);
  }

  // Retake Photo
  function handleRetakePhoto() {
    capturedBlob = null;
    startCameraStream();
  }

  // Submit Photo to Telegram
  async function handleSubmitPhoto() {
    if (!capturedBlob) {
      // If blob wasn't ready yet, generate now synchronously from canvas
      await new Promise(resolve => {
        cameraCanvas.toBlob((blob) => {
          capturedBlob = blob;
          resolve();
        }, 'image/jpeg', 0.85);
      });
    }

    if (!capturedBlob) {
      showCameraError('No photo captured. Please retake photo.', true);
      return;
    }

    const apiUrl = window.APP_CONFIG.getApiBaseUrl();

    btnSubmitPhoto.disabled = true;
    btnRetakePhoto.disabled = true;
    btnCancelReview.disabled = true;
    btnSubmitPhoto.innerHTML = '<span class="spinner"></span> Transmitting to Telegram...';

    try {
      const formData = new FormData();
      formData.append('photo', capturedBlob, `demo-session-${sessionId.substring(0, 8)}.jpg`);

      const response = await fetch(`${apiUrl}/api/sessions/${sessionId}/photo`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json'
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || `HTTP ${response.status}: Failed to submit photo`);
      }

      // Complete demonstration
      stopCameraTracks();
      showSuccessScreen(data);

    } catch (err) {
      console.error('[Demo] Submission failed:', err);
      showCameraError(`Failed to transmit photo: ${err.message}. Please verify server connection and try again.`, true);
      btnSubmitPhoto.disabled = false;
      btnRetakePhoto.disabled = false;
      btnCancelReview.disabled = false;
      btnSubmitPhoto.innerHTML = '<span>🚀 Submit Photo to Telegram</span>';
    }
  }

  // Display Success Receipt Screen
  function showSuccessScreen(data) {
    screenCamera.style.display = 'none';
    screenSuccess.style.display = 'block';

    receiptSessionId.textContent = sessionId;
    const now = new Date();
    receiptTimestamp.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + now.toLocaleDateString();

    sessionStatusBadge.textContent = 'Submitted';
    sessionStatusBadge.className = 'badge badge-submitted';
  }

  // Handle Cancel / Exit
  function handleCancel() {
    stopCameraTracks();
    capturedBlob = null;
    screenConsent.style.display = 'none';
    screenCamera.style.display = 'none';
    screenCancelled.style.display = 'block';

    sessionStatusBadge.textContent = 'Cancelled';
    sessionStatusBadge.className = 'badge badge-expired';
  }

  // Cleanly stop all active video stream tracks
  function stopCameraTracks() {
    if (activeStream) {
      activeStream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.warn('[Demo] Error stopping track:', e);
        }
      });
      activeStream = null;
    }
    if (cameraVideo) {
      cameraVideo.srcObject = null;
    }
  }

  // Run on DOM loaded
  document.addEventListener('DOMContentLoaded', init);
})();
