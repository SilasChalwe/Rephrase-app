const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');

const env = require('./config/env');
const { createOpenApiSpec } = require('./config/swagger');
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const friendsRoutes = require('./routes/friendsRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const publicRoutes = require('./routes/publicRoutes');

const app = express();

const getBaseUrl = (req) => {
  const forwardedProtocol = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProtocol || req.protocol || 'https';
  return `${protocol}://${req.get('host')}`;
};

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

app.get('/openapi.json', (req, res) => {
  res.json(createOpenApiSpec(getBaseUrl(req)));
});

app.use('/docs', swaggerUi.serve);
app.get(
  ['/docs', '/docs/'],
  swaggerUi.setup(null, {
    explorer: true,
    swaggerOptions: {
      url: '/openapi.json',
    },
    customSiteTitle: 'Rephrase API Docs',
  })
);

app.get('/', (req, res) => {
  res.status(200).send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Covian Hive Rephrase API</title>
    <link rel="icon" href="https://www.covianhive.me/favicon.png" />
    <style>
      :root {
        color-scheme: light;
        --bg: #130320;
        --panel: rgba(255, 255, 255, 0.08);
        --text: #f6f0ff;
        --muted: #d5c7eb;
        --accent: #ff7a1a;
        --line: rgba(255, 255, 255, 0.12);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: Arial, sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(255, 122, 26, 0.28), transparent 36%),
          radial-gradient(circle at bottom right, rgba(109, 40, 217, 0.22), transparent 32%),
          linear-gradient(160deg, #1b0333 0%, var(--bg) 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      .card {
        width: min(720px, 100%);
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 24px;
        backdrop-filter: blur(14px);
        padding: 32px;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
        position: relative;
      }
      .brand {
        display: inline-flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 18px;
      }
      .brand img {
        width: 52px;
        height: 52px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.94);
        padding: 8px;
      }
      .brand-copy {
        text-align: left;
      }
      .brand-copy small {
        display: block;
        color: var(--muted);
        letter-spacing: 0.22em;
        text-transform: uppercase;
        font-size: 11px;
        margin-bottom: 4px;
      }
      .brand-copy strong {
        font-size: 20px;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        border-radius: 999px;
        padding: 8px 14px;
        background: rgba(255, 255, 255, 0.1);
        color: var(--muted);
        font-size: 14px;
        position: absolute;
        top: 24px;
        right: 24px;
      }
      .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #22c55e;
        box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.18);
      }
      h1 {
        margin: 18px 0 10px;
        font-size: clamp(32px, 6vw, 56px);
        line-height: 1;
      }
      p {
        margin: 0 0 18px;
        color: var(--muted);
        font-size: 16px;
        line-height: 1.7;
      }
      a {
        color: var(--accent);
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="badge"><span class="dot"></span> Rephrase API is live</div>
      <div class="brand">
        <img src="https://www.covianhive.me/images/logo-icon.png" alt="Covian Hive logo" />
        <div class="brand-copy">
          <small>Covian Hive</small>
          <strong>Rephrase Backend</strong>
        </div>
      </div>
      <h1>Welcome To Covian Hive App</h1>
      <p><a href="/docs">Open API Docs</a></p>
    </main>
  </body>
</html>`);
});

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
