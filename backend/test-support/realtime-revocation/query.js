const mongoose = require('mongoose');

function objectId() {
  return new mongoose.Types.ObjectId().toString();
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function query(value) {
  return {
    limit() {
      return this;
    },
    populate() {
      return this;
    },
    select() {
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
}

module.exports = { objectId, deferred, query };
