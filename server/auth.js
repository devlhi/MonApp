import jwt from 'jsonwebtoken';
import { config } from './config.js';

export function signUser(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: '365d' }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'invalid token' });
  }
}

export function adminRequired(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'forbidden: admin role required' });
  }
  next();
}
