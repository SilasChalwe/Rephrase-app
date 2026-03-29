const { admin, firestore } = require('../config/firebase');
const { normalizeUserDocument } = require('../utils/users');
const userService = require('./userService');

const getUserOrThrow = async (userId) => {
  const user = await userService.getUserById(userId);
  if (!user) {
    throw new Error(`User ${userId} was not found.`);
  }

  return user;
};

const getFriends = async (userId) => {
  const user = await getUserOrThrow(userId);
  return userService.getUsersByIds(user.friendIds);
};

const getPendingRequests = async (userId) => {
  const user = await getUserOrThrow(userId);
  return userService.getUsersByIds(user.FriendIdsWaitingApproval);
};

const getSentRequests = async (userId) => {
  const snapshot = await firestore.collection(userService.USERS_COLLECTION).get();

  return snapshot.docs
    .map((document) => normalizeUserDocument(document.id, document.data()))
    .filter(
      (user) =>
        Array.isArray(user.FriendIdsWaitingApproval) &&
        user.FriendIdsWaitingApproval.includes(userId)
    );
};

const sendFriendRequest = async (currentUserId, recipientId) => {
  if (currentUserId === recipientId) {
    throw new Error('You cannot send a friend request to yourself.');
  }

  const [currentUser, recipient] = await Promise.all([
    getUserOrThrow(currentUserId),
    getUserOrThrow(recipientId),
  ]);

  if (currentUser.friendIds.includes(recipientId)) {
    return { message: `Users ${currentUserId} and ${recipientId} are already friends.` };
  }

  if (recipient.FriendIdsWaitingApproval.includes(currentUserId)) {
    return { message: `Friend request already sent to ${recipientId}.` };
  }

  await firestore.collection(userService.USERS_COLLECTION).doc(recipientId).update({
    FriendIdsWaitingApproval: admin.firestore.FieldValue.arrayUnion(currentUserId),
  });

  return { message: `Friend request sent to ${recipientId}.` };
};

const approveFriendRequest = async (userId, requesterId) => {
  await firestore.runTransaction(async (transaction) => {
    const userRef = firestore.collection(userService.USERS_COLLECTION).doc(userId);
    const requesterRef = firestore.collection(userService.USERS_COLLECTION).doc(requesterId);

    transaction.update(userRef, {
      FriendIdsWaitingApproval: admin.firestore.FieldValue.arrayRemove(requesterId),
      friendIds: admin.firestore.FieldValue.arrayUnion(requesterId),
    });
    transaction.update(requesterRef, {
      friendIds: admin.firestore.FieldValue.arrayUnion(userId),
    });
  });
};

const removeFriend = async (currentUserId, friendId) => {
  await firestore.runTransaction(async (transaction) => {
    const userRef = firestore.collection(userService.USERS_COLLECTION).doc(currentUserId);
    const friendRef = firestore.collection(userService.USERS_COLLECTION).doc(friendId);

    transaction.update(userRef, {
      friendIds: admin.firestore.FieldValue.arrayRemove(friendId),
    });
    transaction.update(friendRef, {
      friendIds: admin.firestore.FieldValue.arrayRemove(currentUserId),
    });
  });
};

module.exports = {
  approveFriendRequest,
  getFriends,
  getPendingRequests,
  getSentRequests,
  removeFriend,
  sendFriendRequest,
};
