const express = require('express');

const {
  deleteUser,
  getCurrentUserInfo,
  registerUser,
  updateUser,
  updateUserProfile,
} = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/auth/register', requireAuth, registerUser);
router.get('/auth/me', requireAuth, getCurrentUserInfo);
router.get('/users/me', requireAuth, getCurrentUserInfo);
router.put('/users/me', requireAuth, updateUser);
router.put('/users/me/profile', requireAuth, updateUserProfile);
router.delete('/users/me', requireAuth, deleteUser);

module.exports = router;
