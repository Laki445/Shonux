
module.exports = async ({ sock, body, from }) => {
  if (body === '.alive') {
    await sock.sendMessage(from, { text: '✅ I am alive (plugin)!' });
  }
};
