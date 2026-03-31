const fs = require('fs');
const path = require('path');
const { tokenFileName } = require('./config');

const tokenFilePath = path.join(process.cwd(), tokenFileName);

function getEmptyTokens() {
  return {
    access_token: null,
    refresh_token: null,
    expires_at: 0
  };
}

function loadTokens() {
  try {
    if (!fs.existsSync(tokenFilePath)) {
      return getEmptyTokens();
    }

    const raw = fs.readFileSync(tokenFilePath, 'utf8');
    return { ...getEmptyTokens(), ...JSON.parse(raw) };
  } catch (error) {
    console.error('[token-store] Failed to load tokens:', error.message);
    return getEmptyTokens();
  }
}

function saveTokens(tokens) {
  fs.writeFileSync(tokenFilePath, JSON.stringify(tokens, null, 2));
}

function clearTokens() {
  try {
    if (fs.existsSync(tokenFilePath)) {
      fs.unlinkSync(tokenFilePath);
    }
  } catch (error) {
    console.error('[token-store] Failed to clear tokens:', error.message);
  }
}

module.exports = {
  loadTokens,
  saveTokens,
  clearTokens,
  getEmptyTokens
};