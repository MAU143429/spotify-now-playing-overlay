const { pollIntervalMs } = require('./config');
const { refreshAccessToken, fetchCurrentlyPlaying } = require('./spotify');

function createPoller({ getTokens, setTokens }) {
  let cachedTrack = null;
  let isPolling = false;
  let backoffMs = pollIntervalMs;
  let timeoutHandle = null;

  async function ensureValidToken() {
    const tokens = getTokens();

    if (!tokens.access_token) {
      throw new Error('Not authenticated');
    }

    if (Date.now() >= tokens.expires_at - 60000) {
      const refreshed = await refreshAccessToken(tokens.refresh_token);
      setTokens(refreshed);
      return refreshed;
    }

    return tokens;
  }

  async function pollSpotify() {
    try {
      const tokens = await ensureValidToken();
      const response = await fetchCurrentlyPlaying(tokens.access_token);

      if (response.status === 204) {
        cachedTrack = null;
        backoffMs = pollIntervalMs;
        return;
      }

      if (response.status === 401) {
        const refreshed = await refreshAccessToken(getTokens().refresh_token);
        setTokens(refreshed);
        return;
      }

      if (response.status === 429) {
        backoffMs = Number(response.headers['retry-after'] || 10) * 1000;
        console.warn(`[poller] Rate limited. Retrying in ${backoffMs}ms`);
        return;
      }

      if (response.status !== 200) {
        console.warn(`[poller] Unexpected status: ${response.status}`);
        return;
      }

      backoffMs = pollIntervalMs;
      const data = response.data;

      if (!data.item || data.item.type !== 'track') {
        cachedTrack = null;
        return;
      }

      const images = data.item.album?.images || [];
      const cover = images.find((img) => img.width >= 300) || images[0] || null;

      cachedTrack = {
        id: data.item.id,
        title: data.item.name,
        artist: data.item.artists.map((artist) => artist.name).join(', '),
        album: data.item.album.name,
        coverUrl: cover ? cover.url : null,
        durationMs: data.item.duration_ms,
        progressMs: data.progress_ms,
        isPlaying: data.is_playing,
        fetchedAt: Date.now()
      };
    } catch (error) {
      if (!String(error.message).includes('Not authenticated')) {
        console.error('[poller] Error:', error.response?.data || error.message);
      }
    }
  }

  function scheduleNextPoll() {
    timeoutHandle = setTimeout(async () => {
      await pollSpotify();
      if (isPolling) {
        scheduleNextPoll();
      }
    }, backoffMs);
  }

  function start() {
    if (isPolling) return;
    isPolling = true;
    pollSpotify().finally(scheduleNextPoll);
  }

  function stop() {
    isPolling = false;
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
  }

  function getCachedTrack() {
    return cachedTrack;
  }

  function getStatus() {
    return {
      isPolling,
      currentTrack: cachedTrack
        ? `${cachedTrack.artist} - ${cachedTrack.title}`
        : null
    };
  }

  return {
    start,
    stop,
    getCachedTrack,
    getStatus
  };
}

module.exports = {
  createPoller
};