// In-memory mock for mongoose - provides no-op connect/disconnect and connection
const mongoose = {
  connect: () => Promise.resolve(),
  disconnect: () => Promise.resolve(),
  connection: {
    dropDatabase: () => Promise.resolve(),
    readyState: 1,
  },
};

module.exports = mongoose;
module.exports.default = mongoose;
