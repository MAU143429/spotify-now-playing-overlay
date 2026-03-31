const axios = require('axios');
const {
  spotifyClientId,
  spotifyClientSecret,
  spotifyRedirectUri
} = require('./config');

function getBasicAuthHeader() {
  return (
    'Basic ' +
    Buffer.from(`${spotifyClientId}:${spotifyClientSecret}`).toString('base64')
  );
}

async function exchangeCodeForTokens(code) {
  const response = await axios.post(
    'https://accounts.spotify.com/api/token',
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: spotifyRedirectUri
    }).toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: getBasicAuthHeader()
      }
    }
  );

  return {
    access_token: response.data.access_token,
    refresh_token: response.data.refresh_token,
    expires_at: Date.now() + response.data.expires_in * 1000
  };
}

async function refreshAccessToken(refreshToken) {
  const response = await axios.post(
    'https://accounts.spotify.com/api/token',
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    }).toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: getBasicAuthHeader()
      }
    }
  );

  return {
    access_token: response.data.access_token,
    refresh_token: response.data.refresh_token || refreshToken,
    expires_at: Date.now() + response.data.expires_in * 1000
  };
}

async function fetchCurrentlyPlaying(accessToken) {
  return axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    validateStatus: null
  });
}

module.exports = {
  exchangeCodeForTokens,
  refreshAccessToken,
  fetchCurrentlyPlaying
};