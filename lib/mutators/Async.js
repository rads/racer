var Async, AsyncAtomic, MAX_RETRIES, RETRY_DELAY, empty, transaction;

transaction = require('../transaction');

Async = module.exports = function(options) {
  var nextTxnId;
  if (options == null) options = {};
  this.get = options.get;
  this._commit = options.commit;
  if (nextTxnId = options.nextTxnId) {
    this._nextTxnId = function(callback) {
      return callback(null, '#' + nextTxnId());
    };
  }
};

Async.prototype = {
  set: function(path, value, ver, callback) {
    var _this = this;
    return this._nextTxnId(function(err, id) {
      var txn;
      txn = transaction.create({
        ver: ver,
        id: id,
        method: 'set',
        args: [path, value]
      });
      return _this._commit(txn, callback);
    });
  },
  del: function(path, ver, callback) {
    var _this = this;
    return this._nextTxnId(function(err, id) {
      var txn;
      txn = transaction.create({
        ver: ver,
        id: id,
        method: 'del',
        args: [path]
      });
      return _this._commit(txn, callback);
    });
  },
  push: function(path, items, ver, callback) {
    var _this = this;
    return this._nextTxnId(function(err, id) {
      var txn;
      txn = transaction.create({
        ver: ver,
        id: id,
        method: 'push',
        args: [path].concat(items)
      });
      return _this._commit(txn, callback);
    });
  },
  unshift: function(path, items, ver, callback) {
    var _this = this;
    return this._nextTxnId(function(err, id) {
      var txn;
      txn = transaction.create({
        ver: ver,
        id: id,
        method: 'unshift',
        args: [path].concat(items)
      });
      return _this._commit(txn, callback);
    });
  },
  insert: function(path, index, items, ver, callback) {
    var _this = this;
    return this._nextTxnId(function(err, id) {
      var txn;
      txn = transaction.create({
        ver: ver,
        id: id,
        method: 'insert',
        args: [path, index].concat(items)
      });
      return _this._commit(txn, callback);
    });
  },
  pop: function(path, ver, callback) {
    var _this = this;
    return this._nextTxnId(function(err, id) {
      var txn;
      txn = transaction.create({
        ver: ver,
        id: id,
        method: 'pop',
        args: [path]
      });
      return _this._commit(txn, callback);
    });
  },
  shift: function(path, ver, callback) {
    var _this = this;
    return this._nextTxnId(function(err, id) {
      var txn;
      txn = transaction.create({
        ver: ver,
        id: id,
        method: 'shift',
        args: [path]
      });
      return _this._commit(txn, callback);
    });
  },
  remove: function(path, start, howMany, ver, callback) {
    var _this = this;
    return this._nextTxnId(function(err, id) {
      var txn;
      txn = transaction.create({
        ver: ver,
        id: id,
        method: 'remove',
        args: [path, start, howMany]
      });
      return _this._commit(txn, callback);
    });
  },
  move: function(path, from, to, howMany, ver, callback) {
    var _this = this;
    return this._nextTxnId(function(err, id) {
      var txn;
      txn = transaction.create({
        ver: ver,
        id: id,
        method: 'move',
        args: [path, from, to, howMany]
      });
      return _this._commit(txn, callback);
    });
  },
  incr: function(path, byNum, callback) {
    var tryVal;
    if (typeof byNum === 'function') {
      callback = byNum;
      byNum = 1;
    } else {
      if (byNum == null) byNum = 1;
      callback || (callback = empty);
    }
    tryVal = null;
    return this.retry(function(atomic) {
      return atomic.get(path, function(val) {
        return atomic.set(path, tryVal = (val || 0) + byNum);
      });
    }, function(err) {
      return callback(err, tryVal);
    });
  },
  setNull: function(path, value, callback) {
    var tryVal;
    tryVal = null;
    return this.retry(function(atomic) {
      return atomic.get(path, function(val) {
        if (val != null) return tryVal = val;
        return atomic.set(path, tryVal = value);
      });
    }, function(err) {
      return callback(err, tryVal);
    });
  },
  retry: function(fn, callback) {
    var atomic, retries;
    retries = MAX_RETRIES;
    atomic = new AsyncAtomic(this, function(err) {
      if (!err) return typeof callback === "function" ? callback() : void 0;
      if (!retries--) {
        return typeof callback === "function" ? callback('maxRetries') : void 0;
      }
      atomic._reset();
      return setTimeout(fn, RETRY_DELAY, atomic);
    });
    return fn(atomic);
  }
};

Async.MAX_RETRIES = MAX_RETRIES = 20;

Async.RETRY_DELAY = RETRY_DELAY = 100;

empty = function() {};

AsyncAtomic = function(async, cb) {
  this.async = async;
  this.cb = cb;
  this.minVer = 0;
  this.count = 0;
};

AsyncAtomic.prototype = {
  _reset: function() {
    this.minVer = 0;
    return this.count = 0;
  },
  get: function(path, callback) {
    var cb, minVer,
      _this = this;
    minVer = this.minVer;
    cb = this.cb;
    return this.async.get(path, function(err, value, ver) {
      if (err) return cb(err);
      _this.minVer = minVer ? Math.min(minVer, ver) : ver;
      return typeof callback === "function" ? callback(value) : void 0;
    });
  },
  set: function(path, value, callback) {
    var cb,
      _this = this;
    this.count++;
    cb = this.cb;
    return this.async.set(path, value, this.minVer, function(err, value) {
      if (err) return cb(err);
      if (typeof callback === "function") callback(null, value);
      if (!--_this.count) return cb();
    });
  },
  del: function(path, callback) {
    var cb,
      _this = this;
    this.count++;
    cb = this.cb;
    return this.async.del(path, this.minVer, function(err) {
      if (err) return cb(err);
      if (typeof callback === "function") callback();
      if (!--_this.count) return cb();
    });
  }
};