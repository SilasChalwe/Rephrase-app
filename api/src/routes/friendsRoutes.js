const express = require('express');

const {
  approveFriendRequest,
  getFriends,
  getPendingRequests,
  getSentRequests,
  removeFriend,
  sendFriendRequest,
} = require('../controllers/friendsController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.get('/', getFriends);
router.get('/requests/pending', getPendingRequests);
router.get('/requests/sent', getSentRequests);
router.post('/requests', sendFriendRequest);
router.put('/requests/:requesterId', approveFriendRequest);
router.delete('/:friendId', removeFriend);

module.exports = router;
