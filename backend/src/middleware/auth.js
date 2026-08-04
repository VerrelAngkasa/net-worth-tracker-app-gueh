const jwt = require('jsonwebtoken');
const { queryOne } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// Even with continuous activity, a session is forced to fully re-login after
// this long. This is a security ceiling independent of the idle timeout.
const ABSOLUTE_SESSION_SECONDS = 7 * 24 * 60 * 60; // 7 days

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
};

function signToken(userId, sessionStart, idleTimeoutMinutes) {
  return jwt.sign({ userId, sessionStart }, JWT_SECRET, { expiresIn: idleTimeoutMinutes * 60 });
}

// Issues the initial cookie for a brand-new session (login/register).
function startSession(res, userId, idleTimeoutMinutes) {
  const sessionStart = Math.floor(Date.now() / 1000);
  const token = signToken(userId, sessionStart, idleTimeoutMinutes);
  res.cookie('token', token, { ...COOKIE_OPTS, maxAge: idleTimeoutMinutes * 60 * 1000 });
}

async function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Your session expired due to inactivity. Please sign in again.' });
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.sessionStart && now - payload.sessionStart > ABSOLUTE_SESSION_SECONDS) {
    res.clearCookie('token', COOKIE_OPTS);
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }

  let user;
  try {
    user = await queryOne('SELECT idle_timeout_minutes FROM users WHERE id = ?', [payload.userId]);
  } catch (err) {
    return next(err);
  }
  if (!user) {
    res.clearCookie('token', COOKIE_OPTS);
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Sliding expiration: every authenticated request extends the session by
  // the configured idle timeout, so it only lapses after genuine inactivity.
  const idleTimeoutMinutes = user.idle_timeout_minutes || 15;
  const refreshed = signToken(payload.userId, payload.sessionStart, idleTimeoutMinutes);
  res.cookie('token', refreshed, { ...COOKIE_OPTS, maxAge: idleTimeoutMinutes * 60 * 1000 });

  req.userId = payload.userId;
  next();
}

module.exports = { requireAuth, startSession, COOKIE_OPTS, JWT_SECRET };
