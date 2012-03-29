var Model, Promise, Store, bufferifyMethods, createAdapter, eventRegExp, finishAfter, racer, socketio, subPathToDoc, transaction, _ref, _ref2,
  __slice = Array.prototype.slice;

socketio = require('socket.io');

Model = (racer = require('./racer')).Model;

Promise = require('./Promise');

createAdapter = require('./adapters').createAdapter;

transaction = require('./transaction.server');

_ref = require('./path'), eventRegExp = _ref.eventRegExp, subPathToDoc = _ref.subPathToDoc;

_ref2 = require('./util/async'), bufferifyMethods = _ref2.bufferifyMethods, finishAfter = _ref2.finishAfter;

Store = module.exports = function(options) {
  var clientId, db, journal, method, routes, type, _i, _len, _ref3;
  if (options == null) options = {};
  this._localModels = {};
  this._journal = journal = createAdapter('journal', options.journal || {
    type: 'Memory'
  });
  this._db = db = createAdapter('db', options.db || {
    type: 'Memory'
  });
  this._writeLocks = {};
  this._waitingForUnlock = {};
  this._clientId = clientId = createAdapter('clientId', options.clientId || {
    type: 'Rfc4122_v4'
  });
  this._commit = journal.commitFn(this, options.mode || 'lww');
  this._generateClientId = clientId.generateFn();
  this.mixinEmit('init', this, options);
  this._routes = routes = {};
  _ref3 = ['accessor', 'mutator'];
  for (_i = 0, _len = _ref3.length; _i < _len; _i++) {
    type = _ref3[_i];
    for (method in Store[type]) {
      routes[method] = [];
    }
  }
  db.setupRoutes(this);
};

Store.prototype = {
  listen: function(to, namespace) {
    var io, socketUri;
    io = socketio.listen(to);
    io.configure(function() {
      io.set('browser client', false);
      return io.set('transports', racer.get('transports'));
    });
    io.configure('production', function() {
      return io.set('log level', 1);
    });
    socketUri = typeof to === 'number' ? ':' + to : '';
    if (namespace) {
      return this.setSockets(io.of("/" + namespace), "" + socketUri + "/" + namespace);
    } else {
      return this.setSockets(io.sockets, socketUri);
    }
  },
  setSockets: function(sockets, _ioUri) {
    var _this = this;
    this.sockets = sockets;
    this._ioUri = _ioUri != null ? _ioUri : '';
    return sockets.on('connection', function(socket) {
      var clientId;
      clientId = socket.handshake.query.clientId;
      return _this.mixinEmit('socket', _this, socket, clientId);
    });
  },
  flushJournal: function(callback) {
    return this._journal.flush(callback);
  },
  flushDb: function(callback) {
    return this._db.flush(callback);
  },
  flush: function(callback) {
    var finish;
    finish = finishAfter(2, callback);
    this.flushJournal(finish);
    return this.flushDb(finish);
  },
  disconnect: function() {
    var _base, _base2, _base3, _base4;
    if (typeof (_base = this._journal).disconnect === "function") {
      _base.disconnect();
    }
    if (typeof (_base2 = this._pubSub).disconnect === "function") {
      _base2.disconnect();
    }
    if (typeof (_base3 = this._db).disconnect === "function") _base3.disconnect();
    return typeof (_base4 = this._clientId).disconnect === "function" ? _base4.disconnect() : void 0;
  },
  _checkVersion: function(socket, ver, clientStartId, callback) {
    return this._journal.startId(function(err, startId) {
      if (err) return callback(err);
      if (clientStartId !== startId) {
        err = "clientStartId != startId (" + clientStartId + " != " + startId + ")";
        return callback(err);
      }
      return callback(null);
    });
  },
  _nextTxnId: function(callback) {
    var _this = this;
    this._txnCount = 0;
    return this._generateClientId(function(err, clientId) {
      if (err) throw err;
      _this._clientId = clientId;
      _this._nextTxnId = function(callback) {
        return callback(null, '#' + this._clientId + '.' + this._txnCount++);
      };
      return _this._nextTxnId(callback);
    });
  },
  _finishCommit: function(txn, ver, callback) {
    var args, method,
      _this = this;
    transaction.setVer(txn, ver);
    args = transaction.getArgs(txn).slice();
    method = transaction.getMethod(txn);
    args.push(ver);
    return this._sendToDb(method, args, function(err, origDoc) {
      _this.publish(transaction.getPath(txn), 'txn', txn, {
        origDoc: origDoc
      });
      if (callback) return callback(err, txn);
    });
  },
  createModel: function() {
    var clientIdPromise, localModels, model, startIdPromise;
    model = new Model;
    model.store = this;
    model._ioUri = this._ioUri;
    model._startIdPromise = startIdPromise = new Promise;
    this._journal.startId(function(err, startId) {
      model._startId = startId;
      return startIdPromise.resolve(err, startId);
    });
    localModels = this._localModels;
    model._clientIdPromise = clientIdPromise = new Promise;
    this._generateClientId(function(err, clientId) {
      model._clientId = clientId;
      localModels[clientId] = model;
      return clientIdPromise.resolve(err, clientId);
    });
    model._bundlePromises.push(startIdPromise, clientIdPromise);
    return model;
  },
  _unregisterLocalModel: function(clientId) {
    var localModels;
    this.unsubscribe(clientId);
    localModels = this._localModels;
    delete localModels[clientId].store;
    return delete localModels[clientId];
  },
  route: function(method, path, priority, fn) {
    var handler, i, re, route, routes, _len;
    if (typeof priority === 'function') {
      fn = priority;
      priority = 0;
    } else {
      priority || (priority = 0);
    }
    re = eventRegExp(path);
    handler = [re, fn, priority];
    routes = this._routes[method];
    for (i = 0, _len = routes.length; i < _len; i++) {
      route = routes[i];
      if (handler[2] <= priority) {
        routes.splice(i, 0, handler);
        return this;
      }
    }
    routes.push(handler);
    return this;
  },
  _sendToDb: function(method, args, done) {
    var i, lockingDone, next, path, pathToDoc, rest, routes, _base,
      _this = this;
    path = args[0], rest = 2 <= args.length ? __slice.call(args, 1) : [];
    if (method !== 'get') {
      pathToDoc = subPathToDoc(path);
      if (pathToDoc in this._writeLocks) {
        return ((_base = this._waitingForUnlock)[pathToDoc] || (_base[pathToDoc] = [])).push([method, args, done]);
      }
      this._writeLocks[pathToDoc] = true;
      done || (done = function(err) {
        if (err) throw err;
      });
      lockingDone = function() {
        var buffer, __done, _ref3;
        delete _this._writeLocks[pathToDoc];
        if (buffer = _this._waitingForUnlock[pathToDoc]) {
          _ref3 = buffer.shift(), method = _ref3[0], args = _ref3[1], __done = _ref3[2];
          if (!buffer.length) delete _this._waitingForUnlock[pathToDoc];
          _this._sendToDb(method, args, __done);
        }
        return done.apply(null, arguments);
      };
    } else {
      lockingDone = done;
    }
    routes = this._routes[method];
    i = 0;
    return (next = function() {
      var captures, fn, handler, match, re;
      if (!(handler = routes[i++])) {
        throw new Error("No persistence handler for " + method + "(" + (args.join(', ')) + ")");
      }
      re = handler[0], fn = handler[1];
      if (!(path === '' || (match = path.match(re)))) return next();
      captures = path === '' ? [''] : match.length > 1 ? match.slice(1) : [match[0]];
      return fn.apply(null, captures.concat(rest, [lockingDone, next]));
    })();
  }
};

Store.MODES = ['lww', 'stm'];

bufferifyMethods(Store, ['_sendToDb'], {
  await: function(done) {
    var db;
    db = this._db;
    if (db.version !== void 0) return done();
    return this._journal.version(function(err, ver) {
      if (err) throw err;
      db.version = parseInt(ver, 10);
      return done();
    });
  }
});
