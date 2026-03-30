const generateChatKey = (uid1, uid2) => {
  const left = String(uid1 || '').toLowerCase();
  const right = String(uid2 || '').toLowerCase();

  return left.localeCompare(right) < 0 ? `${left}_${right}` : `${right}_${left}`;
};

const normalizeChatMessage = (documentId = '', rawMessage = {}) => ({
  messageId: rawMessage.messageId || documentId,
  clientMessageId: rawMessage.clientMessageId || '',
  senderId: rawMessage.senderId || '',
  receiverId: rawMessage.receiverId || '',
  message: rawMessage.message || '',
  status: rawMessage.status || 'SENT',
  mediaUrl: rawMessage.mediaUrl ?? rawMessage.MediaUrl ?? null,
  type: rawMessage.type ?? rawMessage.Type ?? 'TEXT',
  timestamp: Number(rawMessage.timestamp || Date.now()),
});

module.exports = {
  generateChatKey,
  normalizeChatMessage,
};
