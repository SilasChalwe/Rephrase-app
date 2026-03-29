const express = require('express');

const { getChatHistory, searchUsersByName } = require('../controllers/publicController');

const router = express.Router();

router.get('/users/search', searchUsersByName);
router.get('/messages/history/:userId/:otherUserId', getChatHistory);

module.exports = router;
