(() => {
  const FRAME_COUNT = 300;
  const canvas = document.getElementById('animation-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: false });

  // Frame storage & status
  const images = new Array(FRAME_COUNT + 1).fill(null);
  const isLoaded = new Array(FRAME_COUNT + 1).fill(false);
  const isLoading = new Array(FRAME_COUNT + 1).fill(false);

  let targetFrame = 1;
  let lastDrawnFrame = -1;
  let smoothedFrame = 1;
  const LERP_FACTOR = 0.1;

  function getFrameSrc(index) {
    const pad = String(index).padStart(3, '0');
    return `assets/ezgif-frame-${pad}.jpg`;
  }

  // Zoomed-out cover image sizing: guarantees NO empty space on left or right, and properly frames the character
  function drawCoverImage(img) {
    if (!img || !img.complete || img.naturalWidth === 0) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    // Calculate scaling:
    // scaleW guarantees the image stretches to fill 100% of the screen width (NO empty space on right or left)
    const scaleW = cw / iw;
    const scaleH = ch / ih;

    // Zoomed out fit:
    // Scale covers width completely (zero horizontal gap) and covers height comfortably
    const scale = Math.max(scaleW, scaleH);

    const nw = iw * scale;
    const nh = ih * scale;

    // Center horizontally so left and right are flush with zero gap
    const ox = (cw - nw) / 2;

    // Vertical framing:
    // When nh > ch, position with natural headroom so the character's head, glasses and suit are fully visible and not cut off at the top
    let oy = (ch - nh) * 0.12;
    if (nh <= ch) {
      oy = (ch - nh) / 2;
    }

    ctx.fillStyle = '#050609';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, iw, ih, ox, oy, nw, nh);
  }

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';

    if (lastDrawnFrame > 0 && images[lastDrawnFrame]) {
      drawCoverImage(images[lastDrawnFrame]);
    }
  }

  // Draw the target frame or closest loaded frame
  function renderFrame(index) {
    let indexToDraw = index;

    if (!isLoaded[index] || !images[index]) {
      // Find closest loaded frame
      let minDiff = Infinity;
      let closest = lastDrawnFrame > 0 ? lastDrawnFrame : 1;

      for (let i = 1; i <= FRAME_COUNT; i++) {
        if (isLoaded[i] && images[i]) {
          const diff = Math.abs(i - index);
          if (diff < minDiff) {
            minDiff = diff;
            closest = i;
          }
        }
      }
      indexToDraw = closest;
    }

    if (images[indexToDraw] && isLoaded[indexToDraw]) {
      if (indexToDraw !== lastDrawnFrame) {
        drawCoverImage(images[indexToDraw]);
        lastDrawnFrame = indexToDraw;
      }
    }
  }

  // Load a single frame
  function loadFrame(index) {
    if (index < 1 || index > FRAME_COUNT) return;
    if (images[index] || isLoading[index]) return;

    isLoading[index] = true;
    const img = new Image();
    img.src = getFrameSrc(index);

    img.onload = () => {
      images[index] = img;
      isLoaded[index] = true;
      isLoading[index] = false;

      // If this was the frame we are waiting for, draw it immediately
      if (Math.round(smoothedFrame) === index || lastDrawnFrame === -1) {
        renderFrame(index);
      }
    };

    img.onerror = () => {
      isLoading[index] = false;
    };
  }

  // Immediately request frames around the current view position
  function prioritizeFramesAround(centerIndex) {
    loadFrame(centerIndex);
    for (let offset = 1; offset <= 10; offset++) {
      if (centerIndex + offset <= FRAME_COUNT) loadFrame(centerIndex + offset);
      if (centerIndex - offset >= 1) loadFrame(centerIndex - offset);
    }
  }

  // Background progressive preloader
  function startBackgroundPreload() {
    let index = 1;
    const CONCURRENCY = 4;

    function fetchNext() {
      if (index > FRAME_COUNT) return;
      const nextIdx = index++;
      if (!images[nextIdx] && !isLoading[nextIdx]) {
        loadFrame(nextIdx);
      }
      setTimeout(fetchNext, 25);
    }

    for (let i = 0; i < CONCURRENCY; i++) {
      setTimeout(fetchNext, i * 50);
    }
  }

  // Calculate target frame from scroll
  function updateScroll() {
    const docHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight
    );
    const totalScroll = docHeight - window.innerHeight;
    
    const scrollY = window.pageYOffset || document.documentElement.scrollTop || window.scrollY || 0;
    
    if (totalScroll <= 0) {
      targetFrame = 1;
      return;
    }

    const progress = Math.max(0, Math.min(1, scrollY / totalScroll));
    targetFrame = Math.min(FRAME_COUNT, Math.max(1, Math.round(1 + progress * (FRAME_COUNT - 1))));

    prioritizeFramesAround(targetFrame);
  }

  // Main animation / render loop
  function loop() {
    const diff = targetFrame - smoothedFrame;

    if (Math.abs(diff) > 0.01) {
      smoothedFrame += diff * LERP_FACTOR;
    } else {
      smoothedFrame = targetFrame;
    }

    renderFrame(Math.round(smoothedFrame));

    requestAnimationFrame(loop);
  }

  // Event Listeners
  window.addEventListener('scroll', updateScroll, { passive: true });
  window.addEventListener('resize', () => {
    resizeCanvas();
    updateScroll();
  }, { passive: true });

  // ResizeObserver to track layout changes when images load
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => {
      updateScroll();
    });
    ro.observe(document.body);
  }

  // Init
  resizeCanvas();
  loadFrame(1);
  prioritizeFramesAround(1);
  updateScroll();

  requestAnimationFrame(loop);
  startBackgroundPreload();
})();
