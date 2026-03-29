const chatService = require('../services/chatService');
const userService = require('../services/userService');

const searchUsersByName = async (req, res) => {
  try {
    const users = await userService.searchUsersByName(req.query.q || '');
    if (!users.length) {
      return res.status(404).json([]);
    }

    return res.json(users);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to search users.' });
  }
};

const getChatHistory = async (req, res) => {
  try {
    const messages = await chatService.loadChatHistoryByUsers(
      req.params.userId,
      req.params.otherUserId
    );

    return res.json(messages);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load public chat history.' });
  }
};

module.exports = {
  getChatHistory,
  searchUsersByName,
};
