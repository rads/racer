var JournalNone, exports;

exports = module.exports = function(racer) {
  return racer.registerAdapter('journal', 'None', JournalNone);
};

exports.useWith = {
  server: true,
  browser: false
};

JournalNone = function() {};

JournalNone.prototype = {
  flush: function(callback) {
    return typeof callback === "function" ? callback() : void 0;
  },
  startId: function(callback) {
    return callback(null, null);
  },
  version: function(callback) {
    return callback(null, -1);
  },
  unregisterClient: function(clientId, callback) {
    return typeof callback === "function" ? callback() : void 0;
  },
  txnsSince: function(ver, clientId, pubSub, callback) {
    return callback(null, []);
  },
  nextTxnNum: function(clientId, callback) {
    return callback(null, null);
  },
  commitFn: function(store) {
    return function(txn, callback) {
      return store._finishCommit(txn, -1, callback);
    };
  }
};
