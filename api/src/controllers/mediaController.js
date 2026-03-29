const userService = require('../services/userService');
const storageService = require('../services/storageService');

const uploadProfileImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'A file upload is required.' });
  }

  try {
    const upload = await storageService.uploadUserProfileImage({
      userId: req.user.uid,
      file: req.file,
    });

    const updatedUser = await userService.updateUser(req.user.uid, {
      profilePictureUrl: upload.imageUrl,
    });

    return res.json({
      imageUrl: upload.imageUrl,
      user: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({ message: `File upload failed: ${error.message}` });
  }
};

module.exports = {
  uploadProfileImage,
};
