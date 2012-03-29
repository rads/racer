var EventEmitter, PubSubMemory, exports, hasKeys, pathRegExp, subsMatchPath;

EventEmitter = require('events').EventEmitter;

pathRegExp = require('../path').regExp;

hasKeys = require('../util').hasKeys;

exports = module.exports = function(racer) {
  return racer.registerAdapter('pubSub', 'Memory', PubSubMemory);
};

exports.useWith = {
  server: true,
  browser: false
};

PubSubMemory = function() {
  this._pathSubs = {};
  this._patternSubs = {};
  this._subscriberPathSubs = {};
  this._subscriberPatternSubs = {};
};

PubSubMemory.prototype = {
  __proto__: EventEmitter.prototype,
  publish: function(path, message) {
    var pattern, subs, subscriberId, _ref, _results;
    _ref = this._patternSubs;
    for (pattern in _ref) {
      subs = _ref[pattern];
      if (!subsMatchPath(subs, path)) continue;
      for (subscriberId in subs) {
        this.emit('message', subscriberId, message);
      }
    }
    if (subs = this._pathSubs[path]) {
      _results = [];
      for (subscriberId in subs) {
        _results.push(this.emit('message', subscriberId, message));
      }
      return _results;
    }
  },
  subscribe: function(subscriberId, paths, callback, isLiteral) {
    var path, s, ss, subs, subscriberSubs, value, _i, _len;
    if (subscriberId == null) throw new Error('undefined subscriberId');
    if (isLiteral) {
      subs = this._pathSubs;
      subscriberSubs = this._subscriberPathSubs;
    } else {
      subs = this._patternSubs;
      subscriberSubs = this._subscriberPatternSubs;
    }
    ss = subscriberSubs[subscriberId] || (subscriberSubs[subscriberId] = {});
    for (_i = 0, _len = paths.length; _i < _len; _i++) {
      path = paths[_i];
      value = isLiteral ? true : pathRegExp(path);
      s = subs[path] || (subs[path] = {});
      s[subscriberId] = ss[path] = value;
    }
    return typeof callback === "function" ? callback() : void 0;
  },
  unsubscribe: function(subscriberId, paths, callback, isLiteral) {
    var path, s, ss, subs, subscriberSubs, _i, _len;
    if (subscriberId == null) throw new Error('undefined subscriberId');
    if (isLiteral) {
      subs = this._pathSubs;
      subscriberSubs = this._subscriberPathSubs;
    } else {
      subs = this._patternSubs;
      subscriberSubs = this._subscriberPatternSubs;
    }
    ss = subscriberSubs[subscriberId];
    paths = paths || (ss && Object.keys(ss)) || [];
    for (_i = 0, _len = paths.length; _i < _len; _i++) {
      path = paths[_i];
      if (ss) delete ss[path];
      if (s = subs[path]) {
        delete s[subscriberId];
        if (!hasKeys(s)) {
          delete subs[path];
          this.emit('noSubscribers', path);
        }
      }
    }
    return typeof callback === "function" ? callback() : void 0;
  },
  hasSubscriptions: function(subscriberId) {
    return (subscriberId in this._subscriberPatternSubs) || (subscriberId in this._subscriberPathSubs);
  },
  subscribedTo: function(subscriberId, path) {
    var p, re, _ref;
    _ref = this._subscriberPatternSubs[subscriberId];
    for (p in _ref) {
      re = _ref[p];
      if (re.test(path)) return true;
    }
    return false;
  }
};

subsMatchPath = function(subs, path) {
  var re, subscriberId;
  for (subscriberId in subs) {
    re = subs[subscriberId];
    return re.test(path);
  }
};
