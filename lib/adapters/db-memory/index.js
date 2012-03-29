var DbMemory, MUTATORS, Memory, Query, deepCopy, exports, mergeAll, routePattern, _ref,
  __slice = Array.prototype.slice;

Memory = require('../../Memory');

_ref = require('../../util'), mergeAll = _ref.mergeAll, deepCopy = _ref.deepCopy;

Query = require('./Query');

MUTATORS = ['set', 'del', 'push', 'unshift', 'insert', 'pop', 'shift', 'remove', 'move'];

routePattern = /^[^.]+(?:\.[^.]+)?(?=\.|$)/;

exports = module.exports = function(racer) {
  return racer.registerAdapter('db', 'Memory', DbMemory);
};

exports.useWith = {
  server: true,
  browser: false
};

DbMemory = function() {
  this._flush();
};

mergeAll(DbMemory.prototype, Memory.prototype, {
  Query: Query,
  _flush: Memory.prototype.flush,
  flush: function(callback) {
    this._flush();
    return callback(null);
  },
  setVersion: Memory.prototype.setVersion,
  _get: Memory.prototype.get,
  get: function(path, callback) {
    var val;
    try {
      val = this._get(path);
    } catch (err) {
      return callback(err);
    }
    return callback(null, val, this.version);
  },
  filter: function(predicate, namespace) {
    var data, doc, docs, id, newResults, results;
    data = this._get();
    if (namespace) {
      docs = data[namespace];
      return (function() {
        var _results;
        _results = [];
        for (id in docs) {
          doc = docs[id];
          if (predicate(doc, "" + namespace + "." + id)) _results.push(doc);
        }
        return _results;
      })();
    }
    results = [];
    for (namespace in data) {
      docs = data[namespace];
      newResults = (function() {
        var _results;
        _results = [];
        for (id in docs) {
          doc = docs[id];
          if (predicate(doc, "" + namespace + "." + id)) _results.push(doc);
        }
        return _results;
      })();
      results.push.apply(results, newResults);
    }
    return results;
  },
  setupRoutes: function(store) {
    var getFn,
      _this = this;
    MUTATORS.forEach(function(method) {
      return store.route(method, '*', -1000, function() {
        var args, docPath, done, match, next, path, ver, _i;
        path = arguments[0], args = 5 <= arguments.length ? __slice.call(arguments, 1, _i = arguments.length - 3) : (_i = 1, []), ver = arguments[_i++], done = arguments[_i++], next = arguments[_i++];
        args = deepCopy(args);
        match = routePattern.exec(path);
        docPath = match && match[0];
        return _this.get(docPath, function(err, doc) {
          if (err) return done(err);
          doc = deepCopy(doc);
          try {
            _this[method].apply(_this, [path].concat(__slice.call(args), [ver], [null]));
          } catch (err) {
            return done(err, doc);
          }
          return done(null, doc);
        });
      });
    });
    getFn = function(path, done, next) {
      return _this.get(path, done);
    };
    return store.route('get', '*', -1000, getFn);
  }
});