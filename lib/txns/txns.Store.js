var Promise, transaction;

Promise = require('../Promise');

transaction = require('../transaction');

module.exports = {
  type: 'Store',
  events: {
    init: function(store) {
      var clientSockets, journal, localModels;
      clientSockets = store._clientSockets;
      localModels = store._localModels;
      journal = store._journal;
      return store._pubSub.on('txn', function(clientId, txn) {
        var model, socket, ver;
        if (clientId === transaction.getClientId(txn)) return;
        if (model = localModels[clientId]) return model._onTxn(txn);
        if (socket = clientSockets[clientId]) {
          ver = transaction.getVer(txn);
          if (ver > socket.__ver) {
            socket.__ver = ver;
            return journal.nextTxnNum(clientId, function(err, num) {
              if (err) throw err;
              return socket.emit('txn', txn, num);
            });
          }
        }
      });
    },
    socket: function(store, socket, clientId) {
      var journal, pubSub;
      journal = store._journal;
      pubSub = store._pubSub;
      socket.__ver = 0;
      socket.on('txn', function(txn, clientStartId) {
        var ver;
        ver = transaction.getVer(txn);
        return store._checkVersion(socket, ver, clientStartId, function(err) {
          if (err) return socket.emit('fatalErr', err);
          return store._commit(txn, function(err) {
            var txnId;
            txnId = transaction.getId(txn);
            ver = transaction.getVer(txn);
            if (err && err !== 'duplicate') {
              return socket.emit('txnErr', err, txnId);
            }
            return journal.nextTxnNum(clientId, function(err, num) {
              if (err) throw err;
              return socket.emit('txnOk', txnId, ver, num);
            });
          });
        });
      });
      return socket.on('txnsSince', function(ver, clientStartId, callback) {
        return store._checkVersion(socket, ver, clientStartId, function(err) {
          if (err) return socket.emit('fatalErr', err);
          return journal.txnsSince(ver, clientId, pubSub, function(err, txns) {
            if (err) return callback(err);
            return journal.nextTxnNum(clientId, function(err, num) {
              var len;
              if (err) return callback(err);
              if (len = txns.length) {
                socket.__ver = transaction.getVer(txns[len - 1]);
              }
              return callback(null, txns, num);
            });
          });
        });
      });
    }
  }
};
