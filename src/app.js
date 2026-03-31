const express = require('express');
const path = require('path');
const {
  port,
  spotifyClientId,
  spotifyClientSecret,
  spotifyRedirectUri
} = require('./config');
const { loadTokens, saveTokens, clearTokens } = require('./token-store');
const { exchangeCodeForTokens } = require('./spotify');
const { createPoller } = require('./poller');

if (!spotifyClientId || !spotifyClientSecret) {
  console.error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in .env');
  process.exit(1);
}

const app = express();
let tokens = loadTokens();

function getTokens() {
  return tokens;
}

function setTokens(nextTokens) {
  tokens = nextTokens;
  saveTokens(tokens);
}

function resetTokens() {
  tokens = {
    access_token: null,
    refresh_token: null,
    expires_at: 0
  };
  clearTokens();
}

const poller = createPoller({ getTokens, setTokens });

app.use(express.static(path.join(process.cwd(), 'public')));

app.get('/login', (req, res) => {
  const authUrl =
    'https://accounts.spotify.com/authorize?' +
    new URLSearchParams({
      response_type: 'code',
      client_id: spotifyClientId,
      scope: 'user-read-currently-playing user-read-playback-state',
      redirect_uri: spotifyRedirectUri
    }).toString();

  res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
  if (req.query.error) {
    return res.status(400).send(`Spotify error: ${req.query.error}`);
  }

  if (!req.query.code) {
    return res.status(400).send('Missing authorization code');
  }

  try {
    const newTokens = await exchangeCodeForTokens(req.query.code);
    setTokens(newTokens);
    poller.start();
    res.redirect('/');
  } catch (error) {
    console.error('[callback] Error:', error.response?.data || error.message);
    res.status(500).send('Failed to complete Spotify authentication');
  }
});

app.get('/api/now-playing', (req, res) => {
  res.json({ track: poller.getCachedTrack() });
});

app.get('/status', (req, res) => {
  const status = poller.getStatus();

  res.json({
    authenticated: !!tokens.access_token,
    tokenValid: Date.now() < tokens.expires_at,
    hasRefreshToken: !!tokens.refresh_token,
    redirectUri: spotifyRedirectUri,
    ...status
  });
});

app.get('/logout', (req, res) => {
  poller.stop();
  resetTokens();
  res.send('Local session cleared. Open /login to authenticate again.');
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Spotify overlay running at http://127.0.0.1:${port}`);

  if (tokens.refresh_token) {
    poller.start();
  } else {
    console.log(`Open http://127.0.0.1:${port}/login to authenticate with Spotify`);
  }
});