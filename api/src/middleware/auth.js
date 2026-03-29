const { auth } = require('../config/firebase');

const requireAuth = async (req, res, next) => {
  const authorizationHeader = req.headers.authorization || '';

  if (!authorizationHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid Authorization header.' });
  }

  const token = authorizationHeader.slice(7);

  try {
    req.user = await auth.verifyIdToken(token);
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid Firebase token.' });
  }
};

module.exports = {
  requireAuth,
};
