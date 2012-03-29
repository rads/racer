var Memory, Promise, RESEND_INTERVAL, SEND_TIMEOUT, Serializer, arrayMutator, isPrivate, mergeTxn, specCreate, transaction,
  __slice = Array.prototype.slice;

Memory = require('../Memory');

Promise = require('../Promise');

Serializer = require('../Serializer');

transaction = require('../transaction');

isPrivate = require('../path').isPrivate;

specCreate = require('../speculative').create;

mergeTxn = require('./diff').mergeTxn;

arrayMutator = null;

module.exports = {
  type: 'Model',
  static: {
    SEND_TIMEOUT: SEND_TIMEOUT = 10000,
    RESEND_INTERVAL: RESEND_INTERVAL = 2000
  },
  events: {
    mixin: function(Model) {
      return arrayMutator = Model.arrayMutator, Model;
    },
    init: function(model) {
      var after, before, bundlePromises, memory, specCache, txnQueue, txns;
      if (bundlePromises = model._bundlePromises) {
        bundlePromises.push(model._txnsPromise = new Promise);
      }
      model._specCache = specCache = {
        invalidate: function() {
          delete this.data;
          return delete this.lastTxnId;
        }
      };
      model._count.txn = 0;
      model._txns = txns = {};
      model._txnQueue = txnQueue = [];
      model._removeTxn = function(txnId) {
        var i;
        delete txns[txnId];
        if (~(i = txnQueue.indexOf(txnId))) {
          txnQueue.splice(i, 1);
          specCache.invalidate();
        }
      };
      memory = model._memory;
      before = new Memory;
      after = new Memory;
      return model._onTxn = function(txn) {
        var isLocal, txnQ, ver;
        if (txn == null) return;
        if (txnQ = txns[transaction.getId(txn)]) {
          txn.callback = txnQ.callback;
          txn.emitted = txnQ.emitted;
        }
        if (!(isLocal = 'callback' in txn)) {
          mergeTxn(txn, txns, txnQueue, arrayMutator, memory, before, after);
        }
        ver = transaction.getVer(txn);
        if (ver > memory.version || ver === -1) model._applyTxn(txn, isLocal);
      };
    },
    bundle: function(model) {
      model._specModel();
      if (model._txnQueue.length) {
        model.__removeTxn = model._removeTxn;
        model._removeTxn = function(txnId) {
          model.__removeTxn(txnId);
          model._specModel();
          if (model._txnQueue.length) return;
          return process.nextTick(function() {
            return model._txnsPromise.resolve();
          });
        };
        return;
      }
      return model._txnsPromise.resolve();
    },
    socket: function(model, socket) {
      var addRemoteTxn, commit, fetchNewTxns, memory, notReady, onTxn, removeTxn, resend, resendInterval, txnApplier, txnQueue, txns;
      memory = model._memory;
      txns = model._txns;
      txnQueue = model._txnQueue;
      removeTxn = model._removeTxn;
      onTxn = model._onTxn;
      notReady = true;
      resendInterval = null;
      resend = function() {
        var id, now, txn, _i, _len;
        now = +(new Date);
        for (_i = 0, _len = txnQueue.length; _i < _len; _i++) {
          id = txnQueue[_i];
          txn = txns[id];
          if (!txn || txn.timeout > now) return;
          commit(txn);
        }
      };
      fetchNewTxns = function() {
        return socket.emit('txnsSince', memory.version + 1, model._startId, function(err, newTxns, num) {
          var id, txn, _i, _j, _len, _len2;
          if (err) throw err;
          for (_i = 0, _len = newTxns.length; _i < _len; _i++) {
            txn = newTxns[_i];
            onTxn(txn);
          }
          txnApplier.clearPending();
          if (num != null) txnApplier.setIndex(num + 1);
          notReady = false;
          for (_j = 0, _len2 = txnQueue.length; _j < _len2; _j++) {
            id = txnQueue[_j];
            commit(txns[id]);
          }
        });
      };
      txnApplier = new Serializer({
        withEach: onTxn,
        onTimeout: fetchNewTxns
      });
      socket.on('connect', function() {
        fetchNewTxns();
        if (!resendInterval) {
          return resendInterval = setInterval(resend, RESEND_INTERVAL);
        }
      });
      socket.on('disconnect', function() {
        notReady = true;
        if (resendInterval) clearInterval(resendInterval);
        return resendInterval = null;
      });
      model._addRemoteTxn = addRemoteTxn = function(txn, num) {
        if (num != null) {
          return txnApplier.add(txn, num);
        } else {
          return onTxn(txn);
        }
      };
      socket.on('txn', addRemoteTxn);
      socket.on('txnOk', function(txnId, ver, num) {
        var txn;
        if (!(txn = txns[txnId])) return;
        transaction.setVer(txn, ver);
        return addRemoteTxn(txn, num);
      });
      socket.on('txnErr', function(err, txnId) {
        var callback, callbackArgs, txn;
        txn = txns[txnId];
        if (txn && (callback = txn.callback)) {
          if (transaction.isCompound(txn)) {
            callbackArgs = transaction.ops(txn);
          } else {
            callbackArgs = transaction.getArgs(txn).slice(0);
          }
          callbackArgs.unshift(err);
          callback.apply(null, callbackArgs);
        }
        return removeTxn(txnId);
      });
      return model._commit = commit = function(txn) {
        if (txn.isPrivate || notReady) return;
        txn.timeout = +(new Date) + SEND_TIMEOUT;
        return socket.emit('txn', txn, model._startId);
      };
    }
  },
  server: {
    _commit: function(txn) {
      var _this = this;
      if (txn.isPrivate) return;
      return this.store._commit(txn, function(err, txn) {
        if (err) return _this._removeTxn(transaction.getId(txn));
        return _this._onTxn(txn);
      });
    }
  },
  proto: {
    force: function() {
      return Object.create(this, {
        _force: {
          value: true
        }
      });
    },
    _commit: function() {},
    _asyncCommit: function(txn, callback) {
      var id;
      if (!this.connected) return callback('disconnected');
      txn.callback = callback;
      id = transaction.getId(txn);
      this._txns[id] = txn;
      return this._commit(txn);
    },
    _nextTxnId: function() {
      return this._clientId + '.' + this._count.txn++;
    },
    _queueTxn: function(txn, callback) {
      var id;
      txn.callback = callback;
      id = transaction.getId(txn);
      this._txns[id] = txn;
      return this._txnQueue.push(id);
    },
    _getVersion: function() {
      if (this._force) {
        return null;
      } else {
        return this._memory.version;
      }
    },
    _addOpAsTxn: function(method, args, callback) {
      var arr, id, out, path, txn, ver;
      this.emit('beforeTxn', method, args);
      if ((path = args[0]) == null) return;
      ver = this._getVersion();
      id = this._nextTxnId();
      txn = transaction.create({
        ver: ver,
        id: id,
        method: method,
        args: args
      });
      txn.isPrivate = isPrivate(path);
      txn.emitted = args.cancelEmit;
      if (method === 'pop') {
        txn.push((arr = this.get(path) || null) && (arr.length - 1));
      } else if (method === 'unshift') {
        txn.push((this.get(path) || null) && 0);
      }
      this._queueTxn(txn, callback);
      out = this._specModel().$out;
      if (method === 'push') txn.push(out - args.length + 1);
      args = args.slice();
      if (!txn.emitted) {
        this.emit(method, args, out, true, this._pass);
        txn.emitted = true;
      }
      this._commit(txn);
      return out;
    },
    _applyTxn: function(txn, isLocal) {
      var callback, data, doEmit, isCompound, op, ops, out, txnId, ver, _i, _len;
      if (txnId = transaction.getId(txn)) this._removeTxn(txnId);
      data = this._memory._data;
      doEmit = !txn.emitted;
      ver = Math.floor(transaction.getVer(txn));
      if (isCompound = transaction.isCompound(txn)) {
        ops = transaction.ops(txn);
        for (_i = 0, _len = ops.length; _i < _len; _i++) {
          op = ops[_i];
          this._applyMutation(transaction.op, op, ver, data, doEmit, isLocal);
        }
      } else {
        out = this._applyMutation(transaction, txn, ver, data, doEmit, isLocal);
      }
      if (callback = txn.callback) {
        if (isCompound) {
          callback.apply(null, [null].concat(__slice.call(transaction.ops(txn))));
        } else {
          callback.apply(null, [null].concat(__slice.call(transaction.getArgs(txn)), [out]));
        }
      }
      return out;
    },
    _applyMutation: function(extractor, txn, ver, data, doEmit, isLocal) {
      var args, method, out, patch, _i, _len, _ref, _ref2;
      method = extractor.getMethod(txn);
      if (method === 'get') return;
      args = extractor.getArgs(txn);
      out = (_ref = this._memory)[method].apply(_ref, __slice.call(args).concat([ver], [data]));
      if (doEmit) {
        if (patch = txn.patch) {
          for (_i = 0, _len = patch.length; _i < _len; _i++) {
            _ref2 = patch[_i], method = _ref2.method, args = _ref2.args;
            this.emit(method, args, null, isLocal, this._pass);
          }
        } else {
          this.emit(method, args, out, isLocal, this._pass);
          txn.emitted = true;
        }
      }
      return out;
    },
    _specModel: function() {
      var cache, data, i, lastTxnId, len, op, ops, out, replayFrom, txn, txnQueue, txns, _i, _len;
      txns = this._txns;
      txnQueue = this._txnQueue;
      while ((txn = txns[txnQueue[0]]) && txn.isPrivate) {
        out = this._applyTxn(txn, true);
      }
      if (!(len = txnQueue.length)) {
        data = this._memory._data;
        data.$out = out;
        return data;
      }
      cache = this._specCache;
      if (lastTxnId = cache.lastTxnId) {
        if (cache.lastTxnId === txnQueue[len - 1]) return cache.data;
        data = cache.data;
        replayFrom = 1 + txnQueue.indexOf(cache.lastTxnId);
      } else {
        replayFrom = 0;
      }
      if (!data) data = cache.data = specCreate(this._memory._data);
      i = replayFrom;
      while (i < len) {
        txn = txns[txnQueue[i++]];
        if (transaction.isCompound(txn)) {
          ops = transaction.ops(txn);
          for (_i = 0, _len = ops.length; _i < _len; _i++) {
            op = ops[_i];
            this._applyMutation(transaction.op, op, null, data);
          }
        } else {
          out = this._applyMutation(transaction, txn, null, data);
        }
      }
      cache.data = data;
      cache.lastTxnId = transaction.getId(txn);
      data.$out = out;
      return data;
    }
  }
};
