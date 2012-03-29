var LiveQuery, MemoryQuery, Promise, assign, assignExcept, deepCopy, lookup, mergeAll, _ref, _ref2,
  __slice = Array.prototype.slice;

_ref = require('../../util'), mergeAll = _ref.mergeAll, deepCopy = _ref.deepCopy;

_ref2 = require('../../path'), lookup = _ref2.lookup, assign = _ref2.assign;

Promise = require('../../Promise');

LiveQuery = require('../../pubSub/LiveQuery');

module.exports = MemoryQuery = function(query) {
  this._opts = {};
  LiveQuery.call(this, query);
};

mergeAll(MemoryQuery.prototype, LiveQuery.prototype, {
  only: function() {
    var fields, path, paths, _base, _i, _len;
    paths = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    this._selectType = 'only';
    fields = (_base = this._opts).fields || (_base.fields = {});
    for (_i = 0, _len = paths.length; _i < _len; _i++) {
      path = paths[_i];
      fields[path] = 1;
    }
    return this;
  },
  except: function() {
    var fields, path, paths, _base, _i, _len;
    paths = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    this._selectType = 'except';
    fields = (_base = this._opts).fields || (_base.fields = {});
    for (_i = 0, _len = paths.length; _i < _len; _i++) {
      path = paths[_i];
      fields[path] = 0;
    }
    return this;
  },
  skip: function(skip) {
    this._opts.skip = skip;
    return this;
  },
  limit: function(limit) {
    this._opts.limit = limit;
    return this;
  },
  run: function(memoryAdapter, callback) {
    var doc, field, fields, i, limit, matches, projectedDoc, promise, selectType, skip, _len, _ref3,
      _this = this;
    promise = (new Promise).on(callback);
    matches = memoryAdapter.filter(function(doc, namespacePlusId) {
      return _this.testWithoutPaging(doc, namespacePlusId);
    });
    matches = (function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = matches.length; _i < _len; _i++) {
        doc = matches[_i];
        _results.push(deepCopy(doc));
      }
      return _results;
    })();
    if (this._comparator) matches.sort(this._comparator);
    _ref3 = this._opts, skip = _ref3.skip, limit = _ref3.limit, fields = _ref3.fields;
    if (limit !== void 0) {
      if (skip === void 0) skip = 0;
      matches = matches.slice(skip, skip + limit);
    }
    if (selectType = this._selectType) {
      for (i = 0, _len = matches.length; i < _len; i++) {
        doc = matches[i];
        projectedDoc = {};
        if (selectType === 'only') {
          for (field in fields) {
            assign(projectedDoc, field, lookup(field, doc));
          }
          assign(projectedDoc, 'id', lookup('id', doc));
        } else if (selectType === 'except') {
          assignExcept(projectedDoc, doc, fields);
        } else {
          return promise.resolve(new Error);
        }
        matches[i] = projectedDoc;
      }
    }
    return promise.resolve(null, matches);
  }
});

assignExcept = function(to, from, exceptions) {
  var except, hasNextExceptions, key, nextExceptions, nextTo, periodPos, val;
  if (from === void 0) return;
  for (key in from) {
    val = from[key];
    if (key in exceptions) continue;
    nextExceptions = [];
    hasNextExceptions = false;
    for (except in exceptions) {
      periodPos = except.indexOf('.');
      if (except.slice(0, periodPos) === key) {
        hasNextExceptions = true;
        nextExceptions[excep.slice(0, periodPos + 1 || 9e9)] = 0;
      }
    }
    if (hasNextExceptions) {
      nextTo = to[key] = Array.isArray(from[key]) ? [] : {};
      assignExcept(nextTo, from[key], nextExceptions);
    } else {
      if (Array.isArray(from)) key = parseInt(key, 10);
      to[key] = from[key];
    }
  }
  return to;
};