const express = require('express');
const cors = require('cors');

const env = require('./config/env');
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const friendsRoutes = require('./routes/friendsRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const publicRoutes = require('./routes/publicRoutes');

const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || !env.allowedOrigins.length || env.allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/users/media', mediaRoutes);

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json({
    message: error.message || 'Unexpected server error.',
  });
});

module.exports = app;
