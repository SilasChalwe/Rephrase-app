const { firestore } = require('../config/firebase');
const {
  matchesSearchQuery,
  normalizeUserDocument,
  validateUserId,
} = require('../utils/users');

const USERS_COLLECTION = 'users';

const getUserById = async (userId) => {
  validateUserId(userId);

  const snapshot = await firestore.collection(USERS_COLLECTION).doc(userId).get();
  if (!snapshot.exists) {
    return null;
  }

  return normalizeUserDocument(snapshot.id, snapshot.data());
};

const saveUser = async (userId, userInput = {}) => {
  validateUserId(userId);

  const existingUser = (await getUserById(userId)) || normalizeUserDocument(userId);
  const nextUser = normalizeUserDocument(userId, {
    ...existingUser,
    ...userInput,
    document_Id: userId,
    emailAddress: userInput.emailAddress ?? existingUser.emailAddress,
    phoneNumber: userInput.phoneNumber ?? existingUser.phoneNumber,
    friendIds: userInput.friendIds ?? existingUser.friendIds,
    FriendIdsWaitingApproval:
      userInput.FriendIdsWaitingApproval ??
      userInput.friendIdsWaitingApproval ??
      existingUser.FriendIdsWaitingApproval,
    profilePictureUrl: userInput.profilePictureUrl ?? existingUser.profilePictureUrl,
  });

  await firestore.collection(USERS_COLLECTION).doc(userId).set(nextUser);
  return nextUser;
};

const createUser = async ({ userId, ...userInput }) => saveUser(userId, userInput);

const updateUser = async (userId, userInput) => saveUser(userId, userInput);

const deleteUser = async (userId) => {
  validateUserId(userId);
  await firestore.collection(USERS_COLLECTION).doc(userId).delete();
};

const getUsersByIds = async (userIds = []) => {
  const documents = await Promise.all(userIds.map((userId) => getUserById(userId)));
  return documents.filter(Boolean);
};

const searchUsersByName = async (searchQuery) => {
  const snapshot = await firestore.collection(USERS_COLLECTION).get();

  return snapshot.docs
    .map((document) => normalizeUserDocument(document.id, document.data()))
    .filter((user) => matchesSearchQuery(user.fullName, searchQuery));
};

module.exports = {
  USERS_COLLECTION,
  createUser,
  deleteUser,
  getUserById,
  getUsersByIds,
  searchUsersByName,
  updateUser,
};
