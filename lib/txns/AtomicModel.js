var EventEmitter, Serializer, mergeAll, proto, transaction;

EventEmitter = require('events').EventEmitter;

Serializer = require('../Serializer');

transaction = require('../transaction');

mergeAll = require('../util').mergeAll;

module.exports = function(id, parentModel) {
  var AtomicModel;
  AtomicModel = function(id, parentModel) {
    var memory, method, _fn,
      _this = this;
    this.id = id;
    this.parentModel = parentModel;
    this._memory = memory = parentModel._memory;
    this.version = memory.version;
    this._specCache = {
      invalidate: function() {
        delete this.data;
        return delete this.lastTxnId;
      }
    };
    this._opCount = 0;
    this._txns = parentModel._txns;
    this._txnQueue = parentModel._txnQueue.slice(0);
    _fn = function(method) {
      return _this[method] = function() {
        return parentModel[method].apply(parentModel, arguments);
      };
    };
    for (method in EventEmitter.prototype) {
      _fn(method);
    }
  };
  mergeAll(AtomicModel.prototype, Object.getPrototypeOf(parentModel), proto);
  return new AtomicModel(id, parentModel);
};

proto = {
  isMyOp: function(id) {
    var extracted;
    extracted = id.substr(0, id.lastIndexOf('.'));
    return extracted === this.id;
  },
  oplog: function() {
    var id, txnQueue, txns;
    txns = this._txns;
    txnQueue = this._txnQueue;
    return (function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = txnQueue.length; _i < _len; _i++) {
        id = txnQueue[_i];
        if (this.isMyOp(id)) _results.push(txns[id]);
      }
      return _results;
    }).call(this);
  },
  _oplogAsTxn: function() {
    var ops, txn;
    ops = (function() {
      var _i, _len, _ref, _results;
      _ref = this.oplog();
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        txn = _ref[_i];
        _results.push(transaction.op.create({
          method: transaction.getMethod(txn),
          args: transaction.getArgs(txn)
        }));
      }
      return _results;
    }).call(this);
    return transaction.create({
      ver: this.version,
      id: this.id,
      ops: ops
    });
  },
  _getVersion: function() {
    return this.version;
  },
  commit: function(callback) {
    var txn;
    txn = this._oplogAsTxn();
    this.parentModel._queueTxn(txn, callback);
    return this.parentModel._commit(txn);
  },
  get: function(path) {
    var val, ver;
    val = this._memory.get(path, this._specModel());
    ver = this._memory.version;
    if (ver <= this.version) this._addOpAsTxn('get', [path]);
    return val;
  },
  _nextTxnId: function() {
    return this.id + '.' + (++this._opCount);
  },
  _conflictsWithMe: function(txn) {
    var id, myTxn, txns, ver, _i, _len, _ref;
    txns = this._txns;
    ver = this.version;
    _ref = this._txnQueue;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      id = _ref[_i];
      myTxn = txns[id];
      if (this.isMyOp(id) && transaction.pathConflict(txn, myTxn) && ver < transaction.getVer(txn)) {
        return true;
      }
    }
    return false;
  }
};