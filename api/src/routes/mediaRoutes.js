const express = require('express');
const multer = require('multer');

const env = require('../config/env');
const { uploadProfileImage } = require('../controllers/mediaController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.maxUploadSizeMb * 1024 * 1024,
  },
});

router.post('/profile', requireAuth, upload.single('file'), uploadProfileImage);

module.exports = router;
