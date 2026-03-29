const { auth } = require('../config/firebase');
const userService = require('../services/userService');

const sendAuthenticatedUser = async (req, res) => {
  const user = await userService.getUserById(req.user.uid);

  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  return res.json(user);
};

const registerUser = async (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ message: 'Missing user data. Please register again.' });
  }

  try {
    const createdUser = await userService.createUser({
      userId: req.user.uid,
      emailAddress: req.user.email || req.body.emailAddress || '',
      fullName: req.body.fullName,
      phoneNumber: req.body.phoneNumber,
      profilePictureUrl: req.body.profilePictureUrl,
    });

    return res.status(201).json(createdUser);
  } catch (error) {
    try {
      await auth.deleteUser(req.user.uid);
    } catch (deleteError) {
      console.error('Failed to delete user from Firebase Auth:', deleteError.message);
    }

    return res.status(500).json({
      message: `Failed to register user. User removed from Auth. Reason: ${error.message}`,
    });
  }
};

const getCurrentUserInfo = async (req, res) => {
  try {
    return await sendAuthenticatedUser(req, res);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load user profile.' });
  }
};

const updateUser = async (req, res) => {
  try {
    const updatedUser = await userService.updateUser(req.user.uid, req.body || {});
    return res.json(updatedUser);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update user profile.' });
  }
};

const updateUserProfile = async (req, res) => {
  if (!req.body?.imageUrl) {
    return res.status(400).json({ message: 'imageUrl is required.' });
  }

  try {
    const updatedUser = await userService.updateUser(req.user.uid, {
      profilePictureUrl: req.body.imageUrl,
    });

    return res.json(updatedUser);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update user profile image.' });
  }
};

const deleteUser = async (req, res) => {
  try {
    await userService.deleteUser(req.user.uid);
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete user.' });
  }
};

module.exports = {
  deleteUser,
  getCurrentUserInfo,
  registerUser,
  updateUser,
  updateUserProfile,
};
