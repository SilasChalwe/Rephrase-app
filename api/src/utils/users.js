const ensureStringArray = (value) =>
  Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];

const normalizeUserDocument = (documentId = '', rawUser = {}) => ({
  document_Id: rawUser.document_Id || documentId,
  fullName: rawUser.fullName || '',
  emailAddress: rawUser.emailAddress || '',
  phoneNumber: rawUser.phoneNumber || '',
  friendIds: ensureStringArray(rawUser.friendIds),
  FriendIdsWaitingApproval: ensureStringArray(
    rawUser.FriendIdsWaitingApproval ?? rawUser.friendIdsWaitingApproval
  ),
  profilePictureUrl: rawUser.profilePictureUrl || '',
  role: rawUser.role || 'user',
});

const validateUserId = (userId) => {
  if (!userId || typeof userId !== 'string') {
    throw new Error('User ID cannot be empty.');
  }
};

const matchesSearchQuery = (fullName, searchQuery) => {
  const name = String(fullName || '').trim().toLowerCase();
  const query = String(searchQuery || '').trim().toLowerCase();

  if (!name || !query) {
    return false;
  }

  if (name.includes(query)) {
    return true;
  }

  const nameWords = name.split(/\s+/);
  const searchWords = query.split(/\s+/);

  return searchWords.every((searchWord) =>
    nameWords.some((nameWord) => nameWord.includes(searchWord))
  );
};

module.exports = {
  ensureStringArray,
  matchesSearchQuery,
  normalizeUserDocument,
  validateUserId,
};
