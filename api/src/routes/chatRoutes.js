const express = require('express');
const multer = require('multer');

const env = require('../config/env');
const {
  checkOnlineStatus,
  getConversationSummaries,
  getChatHistory,
  markConversationAsRead,
  messageStream,
  uploadChatAttachment,
  saveConversationReadAnchor,
  sendMediaMessage,
  sendTextMessage,
  sendTypingIndicator,
  updateMessageStatus,
} = require('../controllers/chatController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.maxUploadSizeMb * 1024 * 1024,
  },
});

router.use(requireAuth);
router.get('/conversations', getConversationSummaries);
router.post('/attachments/upload', upload.single('file'), uploadChatAttachment);
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
