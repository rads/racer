var LiveQuery, Query, deserialize, empty, expandPath, splitPath, transaction, _ref,
  __slice = Array.prototype.slice;

transaction = require('../transaction');

_ref = require('../path'), expandPath = _ref.expand, splitPath = _ref.split;

LiveQuery = require('./LiveQuery');

deserialize = (Query = require('./Query')).deserialize;

empty = function() {};

module.exports = {
  type: 'Model',
  events: {
    init: function(model) {
      model._pathSubs = {};
      model._querySubs = {};
      return model._liveQueries = {};
    },
    bundle: function(model) {
      var query, querySubs, _;
      querySubs = (function() {
        var _ref2, _results;
        _ref2 = model._querySubs;
        _results = [];
        for (_ in _ref2) {
          query = _ref2[_];
          _results.push(query);
        }
        return _results;
      })();
      return model._onLoad.push(['_loadSubs', model._pathSubs, querySubs]);
    },
    socket: function(model, socket) {
      var memory;
      memory = model._memory;
      socket.on('connect', function() {
        var query, subs, _, _ref2;
        subs = Object.keys(model._pathSubs);
        _ref2 = model._querySubs;
        for (_ in _ref2) {
          query = _ref2[_];
          subs.push(query);
        }
        return socket.emit('sub', model._clientId, subs, memory.version, model._startId);
      });
      socket.on('addDoc', function(_arg, num) {
        var data, doc, ns, txn, ver;
        doc = _arg.doc, ns = _arg.ns, ver = _arg.ver;
        if ((data = memory.get(ns)) && data[doc.id]) {
          return model._addRemoteTxn(null, num);
        } else {
          txn = transaction.create({
            ver: ver,
            id: null,
            method: 'set',
            args: ["" + ns + "." + doc.id, doc]
          });
          model._addRemoteTxn(txn, num);
          return model.emit('addDoc', "" + ns + "." + doc.id, doc);
        }
      });
      return socket.on('rmDoc', function(_arg, num) {
        var doc, hash, id, key, ns, query, txn, ver, _ref2;
        doc = _arg.doc, ns = _arg.ns, hash = _arg.hash, id = _arg.id, ver = _arg.ver;
        _ref2 = model._liveQueries;
        for (key in _ref2) {
          query = _ref2[key];
          if (hash !== key && query.test(doc, "" + ns + "." + id)) {
            return model._addRemoteTxn(null, num);
          }
        }
        txn = transaction.create({
          ver: ver,
          id: null,
          method: 'del',
          args: ["" + ns + "." + id]
        });
        model._addRemoteTxn(txn, num);
        return model.emit('rmDoc', ns + '.' + id, doc);
      });
    }
  },
  proto: {
    _loadSubs: function(_pathSubs, querySubList) {
      var hash, item, liveQueries, query, querySubs, _i, _len;
      this._pathSubs = _pathSubs;
      querySubs = this._querySubs;
      liveQueries = this._liveQueries;
      for (_i = 0, _len = querySubList.length; _i < _len; _i++) {
        item = querySubList[_i];
        query = deserialize(item);
        hash = query.hash();
        querySubs[hash] = query;
        liveQueries[hash] = new LiveQuery(query);
      }
    },
    query: function(namespace) {
      return new Query(namespace);
    },
    fetch: function() {
      var callback, last, newTargets, out, path, root, target, targets, _i, _j, _len, _len2, _ref2,
        _this = this;
      targets = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      last = targets[targets.length - 1];
      callback = typeof last === 'function' ? targets.pop() : empty;
      newTargets = [];
      out = [];
      for (_i = 0, _len = targets.length; _i < _len; _i++) {
        target = targets[_i];
        if (target.isQuery) {
          root = target.namespace;
          newTargets.push(target);
        } else {
          if (target._at) target = target._at;
          root = splitPath(target)[0];
          _ref2 = expandPath(target);
          for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
            path = _ref2[_j];
            newTargets.push(path);
          }
        }
        out.push(this.at(root, true));
      }
      return this._fetch(newTargets, function(err, data) {
        _this._initSubData(data);
        return callback.apply(null, [err].concat(__slice.call(out)));
      });
    },
    subscribe: function() {
      var callback, hash, last, liveQueries, newTargets, out, path, pathSubs, querySubs, root, target, targets, _i, _j, _len, _len2, _ref2,
        _this = this;
      targets = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      last = targets[targets.length - 1];
      callback = typeof last === 'function' ? targets.pop() : empty;
      pathSubs = this._pathSubs;
      querySubs = this._querySubs;
      liveQueries = this._liveQueries;
      newTargets = [];
      out = [];
      for (_i = 0, _len = targets.length; _i < _len; _i++) {
        target = targets[_i];
        if (target.isQuery) {
          root = target.namespace;
          hash = target.hash();
          if (!querySubs[hash]) {
            querySubs[hash] = target;
            liveQueries[hash] = new LiveQuery(target);
            newTargets.push(target);
          }
        } else {
          if (target._at) target = target._at;
          root = splitPath(target)[0];
          _ref2 = expandPath(target);
          for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
            path = _ref2[_j];
            if (pathSubs[path]) continue;
            pathSubs[path] = 1;
            newTargets.push(path);
          }
        }
        out.push(this.at(root, true));
      }
      if (!newTargets.length) {
        return callback.apply(null, [null].concat(__slice.call(out)));
      }
      return this._subAdd(newTargets, function(err, data) {
        if (err) return callback(err);
        _this._initSubData(data);
        return callback.apply(null, [null].concat(__slice.call(out)));
      });
    },
    unsubscribe: function() {
      var callback, hash, last, liveQueries, newTargets, path, pathSubs, querySubs, target, targets, _i, _j, _len, _len2, _ref2;
      targets = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      last = targets[targets.length - 1];
      callback = typeof last === 'function' ? targets.pop() : empty;
      pathSubs = this._pathSubs;
      querySubs = this._querySubs;
      liveQueries = this._liveQueries;
      newTargets = [];
      for (_i = 0, _len = targets.length; _i < _len; _i++) {
        target = targets[_i];
        if (target.isQuery) {
          hash = target.hash();
          if (querySubs[hash]) {
            delete querySubs[hash];
            delete liveQueries[hash];
            newTargets.push(target);
          }
        } else {
          _ref2 = expandPath(target);
          for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
            path = _ref2[_j];
            if (!pathSubs[path]) continue;
            delete pathSubs[path];
            newTargets.push(path);
          }
        }
      }
      if (!newTargets.length) return callback();
      return this._subRemove(newTargets, callback);
    },
    _initSubData: function(data) {
      var memory, path, value, ver, _i, _len, _ref2, _ref3;
      this.emit('subInit', data);
      memory = this._memory;
      _ref2 = data.data;
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        _ref3 = _ref2[_i], path = _ref3[0], value = _ref3[1], ver = _ref3[2];
        memory.set(path, value, ver);
      }
    },
    _fetch: function(targets, callback) {
      if (!this.connected) return callback('disconnected');
      return this.socket.emit('fetch', targets, callback);
    },
    _subAdd: function(targets, callback) {
      if (!this.connected) return callback('disconnected');
      return this.socket.emit('subAdd', targets, callback);
    },
    _subRemove: function(targets, callback) {
      if (!this.connected) return callback('disconnected');
      return this.socket.emit('subRemove', targets, callback);
    }
  },
  server: {
    _fetch: function(targets, callback) {
      var store;
      store = this.store;
      return this._clientIdPromise.on(function(err, clientId) {
        if (err) return callback(err);
        return store.fetch(clientId, targets, callback);
      });
    },
    _subAdd: function(targets, callback) {
      var _this = this;
      return this._clientIdPromise.on(function(err, clientId) {
        if (err) return callback(err);
        return _this.store.subscribe(clientId, targets, callback);
      });
    },
    _subRemove: function(targets, callback) {
      var store;
      store = this.store;
      return this._clientIdPromise.on(function(err, clientId) {
        if (err) return callback(err);
        return store.unsubscribe(clientId, targets, callback);
      });
    }
  }
};
