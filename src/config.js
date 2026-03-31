require('dotenv').config();

const PORT = Number(process.env.PORT) || 3000;

module.exports = {
  port: PORT,
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID,
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  spotifyRedirectUri:
    process.env.SPOTIFY_REDIRECT_URI || `http://127.0.0.1:${PORT}/callback`,
  tokenFileName: '.tokens.json',
  pollIntervalMs: 8000
};