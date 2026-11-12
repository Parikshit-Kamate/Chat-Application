const mongoose = require('mongoose');

function objectId() {
  return new mongoose.Types.ObjectId().toString();
}

function query(value) {
  return {
    select() {
      return this;
    },
    populate() {
      return this;
    },
    limit() {
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
    catch(reject) {
      return Promise.resolve(value).catch(reject);
    },
  };
}

module.exports = { objectId, query };
