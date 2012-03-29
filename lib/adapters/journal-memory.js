var JournalMemory, commit, commitFns, deepCopy, exports, transaction;

transaction = require('../transaction.server');

deepCopy = require('../util').deepCopy;

exports = module.exports = function(racer) {
  return racer.registerAdapter('journal', 'Memory', JournalMemory);
};

exports.useWith = {
  server: true,
  browser: false
};

JournalMemory = function() {
  this.flush();
};

JournalMemory.prototype = {
  flush: function(callback) {
    this._txns = [];
    this._txnClock = {};
    this._startId = (+(new Date)).toString(36);
    return typeof callback === "function" ? callback() : void 0;
  },
  startId: function(callback) {
    return callback(null, this._startId);
  },
  version: function(callback) {
    return callback(null, this._txns.length);
  },
  unregisterClient: function(clientId, callback) {
    delete this._txnClock[clientId];
    return typeof callback === "function" ? callback() : void 0;
  },
  txnsSince: function(ver, clientId, pubSub, callback) {
    var since, txn, txns;
    since = [];
    if (!pubSub.hasSubscriptions(clientId)) return callback(null, since);
    txns = this._txns;
    while (txn = txns[ver++]) {
      if (pubSub.subscribedTo(clientId, transaction.getPath(txn))) since.push(txn);
    }
    return callback(null, since);
  },
  nextTxnNum: function(clientId, callback) {
    var num, txnClock;
    txnClock = this._txnClock;
    num = txnClock[clientId] = (txnClock[clientId] || 0) + 1;
    return callback(null, num);
  },
  commitFn: function(store, mode) {
    return commitFns[mode](this, store);
  }
};

commit = function(txns, store, txn, callback) {
  var journalTxn, ver;
  journalTxn = JSON.parse(JSON.stringify(txn));
  ver = txns.push(journalTxn);
  transaction.setVer(journalTxn, ver);
  return store._finishCommit(txn, ver, callback);
};

commitFns = {
  lww: function(self, store) {
    return function(txn, callback) {
      return commit(self._txns, store, txn, callback);
    };
  },
  stm: function(self, store) {
    return function(txn, callback) {
      var err, item, txns, ver;
      ver = transaction.getVer(txn);
      txns = self._txns;
      if (ver != null) {
        if (typeof ver !== 'number') {
          return typeof callback === "function" ? callback(new Error('Version must be null or a number')) : void 0;
        }
        while (item = txns[ver++]) {
          if (err = transaction.conflict(txn, item)) {
            return typeof callback === "function" ? callback(err) : void 0;
          }
        }
      }
      return commit(txns, store, txn, callback);
    };
  }
};
