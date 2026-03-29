const friendsService = require('../services/friendsService');

const getFriends = async (req, res) => {
  try {
    const friends = await friendsService.getFriends(req.user.uid);
    return res.json(friends);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load friends.' });
  }
};

const getPendingRequests = async (req, res) => {
  try {
    const requests = await friendsService.getPendingRequests(req.user.uid);
    return res.json(requests);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load pending friend requests.' });
  }
};

const getSentRequests = async (req, res) => {
  try {
    const requests = await friendsService.getSentRequests(req.user.uid);
    return res.json(requests);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load sent friend requests.' });
  }
};

const sendFriendRequest = async (req, res) => {
  if (!req.body?.recipientId) {
    return res.status(400).json({ message: 'recipientId is required.' });
  }

  try {
    const result = await friendsService.sendFriendRequest(req.user.uid, req.body.recipientId);
    return res.status(202).json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to send friend request.' });
  }
};

const approveFriendRequest = async (req, res) => {
  try {
    await friendsService.approveFriendRequest(req.user.uid, req.params.requesterId);
    return res.status(200).send();
  } catch (error) {
    return res.status(500).json({ message: 'Failed to approve friend request.' });
  }
};

const removeFriend = async (req, res) => {
  try {
    await friendsService.removeFriend(req.user.uid, req.params.friendId);
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: 'Failed to remove friend.' });
  }
};

module.exports = {
  approveFriendRequest,
  getFriends,
  getPendingRequests,
  getSentRequests,
  removeFriend,
  sendFriendRequest,
};
