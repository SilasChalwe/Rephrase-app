const express = require('express');

const {
  checkOnlineStatus,
  getConversationSummaries,
  getChatHistory,
  markConversationAsRead,
  messageStream,
  saveConversationReadAnchor,
  sendMediaMessage,
  sendTextMessage,
  sendTypingIndicator,
  updateMessageStatus,
} = require('../controllers/chatController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.get('/conversations', getConversationSummaries);
router.post('/messages/text', sendTextMessage);
router.post('/messages/media', sendMediaMessage);
router.get('/messages/stream', messageStream);
router.get('/messages/:receiverId', getChatHistory);
router.patch('/messages/:messageId/status', updateMessageStatus);
router.post('/conversations/read', markConversationAsRead);
router.post('/conversations/anchor', saveConversationReadAnchor);
router.get('/presence/:id', checkOnlineStatus);
router.post('/typing', sendTypingIndicator);

module.exports = router;
