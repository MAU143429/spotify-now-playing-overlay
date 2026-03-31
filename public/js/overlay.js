(function () {
  'use strict';

  const POLL_INTERVAL_MS  = 8000;
  const CORRECTION_SNAP_MS = 3000;

  const widget      = document.getElementById('widget');
  const coverImg    = document.getElementById('cover-img');
  const bgImg       = document.getElementById('bg-img');
  const trackTitle  = document.getElementById('track-title');
  const trackArtist = document.getElementById('track-artist');
  const timeCurrent = document.getElementById('time-current');
  const timeTotal   = document.getElementById('time-total');
  const progressBar = document.getElementById('progress-bar');
  const progressDot = document.getElementById('progress-dot');

  let currentTrackId  = null;
  let localProgressMs = 0;
  let durationMs      = 0;
  let isPlaying       = false;
  let lastTickTime    = null;
  let tickHandle      = null;
  let pollHandle      = null;

  function formatMs(ms) {
    if (!ms || ms < 0) return '0:00';
    const total   = Math.floor(ms / 1000);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  function setWidgetState(state) {
    widget.classList.remove('state--loading', 'state--idle', 'state--playing', 'state--paused');
    widget.classList.add(`state--${state}`);
  }

  function renderProgress() {
    if (!durationMs) return;
    const safe = clamp(localProgressMs, 0, durationMs);
    const pct  = (safe / durationMs) * 100;
    progressBar.style.width = `${pct}%`;
    progressDot.style.left  = `${pct}%`;
    timeCurrent.textContent = formatMs(safe);
    timeTotal.textContent   = formatMs(durationMs);
  }

  function tick(timestamp) {
    if (lastTickTime !== null && isPlaying) {
      localProgressMs += timestamp - lastTickTime;
      if (localProgressMs > durationMs) localProgressMs = durationMs;
      renderProgress();
    }
    lastTickTime = timestamp;
    tickHandle   = requestAnimationFrame(tick);
  }

  function startTick() {
    if (tickHandle) cancelAnimationFrame(tickHandle);
    lastTickTime = null;
    tickHandle   = requestAnimationFrame(tick);
  }

  function stopTick() {
    if (tickHandle) cancelAnimationFrame(tickHandle);
    tickHandle   = null;
    lastTickTime = null;
  }

  function updateCoverArt(newUrl) {
    if (!newUrl) { coverImg.style.opacity = '0'; bgImg.style.opacity = '0'; return; }

    const preload    = new Image();
    preload.onload   = () => {
      widget.classList.add('cover-changing');
      setTimeout(() => {
        coverImg.src = newUrl;
        bgImg.src    = newUrl;
        void coverImg.offsetHeight;
        widget.classList.remove('cover-changing');
      }, 350);
    };
    preload.onerror  = () => { coverImg.src = ''; bgImg.src = ''; };
    preload.src      = newUrl;
  }

  function updateText(title, artist) {
    trackTitle.classList.add('updating');
    trackArtist.classList.add('updating');
    setTimeout(() => {
      trackTitle.textContent  = title  || '—';
      trackArtist.textContent = artist || '—';
      trackTitle.classList.remove('updating');
      trackArtist.classList.remove('updating');
      checkScrollingTitle();
    }, 200);
  }

  function checkScrollingTitle() {
    trackTitle.classList.remove('scrolling');
    trackTitle.style.removeProperty('--scroll-distance');
    const overflow = trackTitle.scrollWidth - trackTitle.parentElement.offsetWidth;
    if (overflow > 10) {
      trackTitle.style.setProperty('--scroll-distance', `-${overflow + 10}px`);
      trackTitle.classList.add('scrolling');
    }
  }

  function applyNewTrack(track) {
    currentTrackId = track.id;
    durationMs     = track.durationMs;
    const elapsed  = Date.now() - track.fetchedAt;
    localProgressMs = track.isPlaying
      ? Math.min(track.progressMs + elapsed, durationMs)
      : track.progressMs;
    updateCoverArt(track.coverUrl);
    updateText(track.title, track.artist);
    renderProgress();
  }

  function syncProgress(track) {
    const elapsed   = Date.now() - track.fetchedAt;
    const spotify   = track.isPlaying
      ? Math.min(track.progressMs + elapsed, track.durationMs)
      : track.progressMs;
    const drift     = Math.abs(localProgressMs - spotify);
    if (drift > CORRECTION_SNAP_MS) {
      localProgressMs = spotify;
    } else if (drift > 500) {
      localProgressMs += (spotify - localProgressMs) * 0.2;
    }
    durationMs = track.durationMs;
    renderProgress();
  }

  function handleTrackData(track) {
    if (!track) {
      setWidgetState('idle');
      stopTick();
      currentTrackId = null;
      localProgressMs = 0;
      durationMs = 0;
      return;
    }

    if (track.id !== currentTrackId) {
      applyNewTrack(track);
    } else {
      syncProgress(track);
    }

    isPlaying = track.isPlaying;
    if (isPlaying) {
      setWidgetState('playing');
      startTick();
    } else {
      setWidgetState('paused');
      stopTick();
    }
  }

  async function pollNowPlaying() {
    try {
      const res  = await fetch('/api/now-playing');
      if (!res.ok) { console.warn('[poll] Status:', res.status); return; }
      const data = await res.json();
      handleTrackData(data.track);
    } catch (err) {
      console.warn('[poll] Error:', err.message);
    } finally {
      pollHandle = setTimeout(pollNowPlaying, POLL_INTERVAL_MS);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopTick();
      if (pollHandle) clearTimeout(pollHandle);
    } else {
      if (pollHandle) clearTimeout(pollHandle);
      pollNowPlaying();
      if (isPlaying) startTick();
    }
  });

  setTimeout(() => {
    widget.classList.remove('state--loading');
    setWidgetState('idle');
    pollNowPlaying();
  }, 500);

})();