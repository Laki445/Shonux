
module.exports = async ({ sock, body, from }) => {
  if (body === '.ping') {
    await sock.sendMessage(from, { text: '🏓 Pong! Working fine.' });
  }
};
