const chatService = require('../services/chatService');

const sendTextMessage = async (req, res) => {
  try {
    const message = await chatService.sendTextMessage(
      req.user.uid,
      req.body.receiverId,
      req.body.text
    );
    return res.status(200).json(message);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to send text message.' });
  }
};

const sendMediaMessage = async (req, res) => {
  try {
    const message = await chatService.sendMediaMessage(
      req.user.uid,
      req.body.receiverId,
      req.body.mediaUrl,
      req.body.mediaType
    );

    return res.status(200).json(message);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to send media message.' });
  }
};

const getChatHistory = async (req, res) => {
  try {
    const messages = await chatService.loadChatHistoryByUsers(req.user.uid, req.params.receiverId);
    return res.json(messages);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load chat history.' });
  }
};

const updateMessageStatus = async (req, res) => {
  try {
    await chatService.updateMessageStatus(
      req.params.messageId,
      req.user.uid,
      req.body.receiverId,
      req.body.status
    );

    return res.status(200).send();
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update message status.' });
  }
};

const markConversationAsRead = async (req, res) => {
  try {
    await chatService.markConversationAsRead(req.user.uid, req.query.id);
    return res.status(200).send();
  } catch (error) {
    return res.status(500).json({ message: 'Failed to mark conversation as read.' });
  }
};

const checkOnlineStatus = async (req, res) => {
  try {
    const isOnline = await chatService.isUserOnline(req.params.id);
    return res.json(isOnline);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to check online status.' });
  }
};

const sendTypingIndicator = async (req, res) => {
  try {
    await chatService.sendTypingIndicator(req.user.uid, req.body.receiverId, req.body.isTyping);
    return res.status(200).send();
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update typing indicator.' });
  }
};

const messageStream = (req, res) => {
  const currentUserId = req.user.uid;
  const otherUserId = req.query.otherUserId;

  if (!otherUserId) {
    return res.status(400).json({ message: 'otherUserId is required.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const unsubscribe = chatService.listenForMessages(
    currentUserId,
    otherUserId,
    (messages) => {
      res.write(`data: ${JSON.stringify(messages)}\n\n`);
    },
    (error) => {
      res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`);
    }
  );

  const keepAliveTimer = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAliveTimer);
    unsubscribe();
    res.end();
  });

  return undefined;
};

module.exports = {
  checkOnlineStatus,
  getChatHistory,
  markConversationAsRead,
  messageStream,
  sendMediaMessage,
  sendTextMessage,
  sendTypingIndicator,
  updateMessageStatus,
};
