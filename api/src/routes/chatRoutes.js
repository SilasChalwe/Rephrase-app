const express = require('express');

const {
  checkOnlineStatus,
  getChatHistory,
  markConversationAsRead,
  messageStream,
  sendMediaMessage,
  sendTextMessage,
  sendTypingIndicator,
  updateMessageStatus,
} = require('../controllers/chatController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.post('/messages/text', sendTextMessage);
router.post('/messages/media', sendMediaMessage);
router.get('/messages/stream', messageStream);
router.get('/messages/:receiverId', getChatHistory);
router.patch('/messages/:messageId/status', updateMessageStatus);
router.post('/conversations/read', markConversationAsRead);
router.get('/presence/:id', checkOnlineStatus);
router.post('/typing', sendTypingIndicator);

module.exports = router;
