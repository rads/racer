var Model, Ref, derefPath, eventRegExp, lookupPath, _ref;

eventRegExp = require('../path').eventRegExp;

_ref = require('./util'), derefPath = _ref.derefPath, lookupPath = _ref.lookupPath;

Model = require('../Model');

Ref = module.exports = function(model, from, to, key) {
  var _this = this;
  this.model = model;
  this.from = from;
  this.to = to;
  this.key = key;
  this.listeners = [];
  if (!from) throw new Error('Missing `from` in `model.ref(from, to, key)`');
  if (!to) throw new Error('Missing `to` in `model.ref(from, to, key)`');
  this.get = function(lookup, data, path, props, len, i) {
    return _this._get(lookup, data, path, props, len, i);
  };
  if (key) {
    this._get = this._getWithKey;
    this.addListener("" + to + ".*", function(match) {
      var index, keyPath, remainder;
      keyPath = model.get(key) + '';
      remainder = match[1];
      if (remainder === keyPath) return from;
      index = keyPath.length;
      if (remainder.slice(0, index + 1 || 9e9) === keyPath + '.') {
        remainder = remainder.slice(index + 1);
        return from + '.' + remainder;
      }
      return null;
    });
    this.addListener(key, function(match, mutator, args) {
      if (mutator === 'set') {
        args[1] = model.get(to + '.' + args[1]);
        args.out = model.get(to + '.' + args.out);
      } else if (mutator === 'del') {
        args.out = model.get(to + '.' + args.out);
      }
      return from;
    });
  } else {
    this._get = this._getWithoutKey;
    this.addListener("" + to + ".*", function(match) {
      return from + '.' + match[1];
    });
    this.addListener(to, function() {
      return from;
    });
  }
};

Ref.prototype = {
  addListener: function(pattern, callback) {
    var from, get, listener, model, re,
      _this = this;
    model = this.model, from = this.from, get = this.get;
    re = eventRegExp(pattern);
    this.listeners.push(listener = function(mutator, path, _arguments) {
      var args;
      if (re.test(path)) {
        if (model._getRef(from) !== get) return _this.destroy();
        args = _arguments[0].slice();
        args.out = _arguments[1];
        path = callback(re.exec(path), mutator, args);
        if (path === null) return;
        args[0] = path;
        model.emit(mutator, args, args.out, _arguments[2], _arguments[3]);
      }
    });
    return model.on('mutator', listener);
  },
  destroy: function() {
    var listener, model, _i, _len, _ref2;
    model = this.model;
    _ref2 = this.listeners;
    for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
      listener = _ref2[_i];
      model.removeListener('mutator', listener);
    }
  },
  _getWithKey: function(lookup, data, path, props, len, i) {
    var curr, currPath, dereffed, to;
    to = this.to;
    lookup(to, data);
    dereffed = derefPath(data, to) + '.' + lookup(this.key, data);
    curr = lookup(dereffed, data);
    currPath = lookupPath(dereffed, props, i);
    data.$deref = function(method) {
      if (i === len && method in Model.basicMutator) {
        return path;
      } else {
        return currPath;
      }
    };
    return [curr, currPath, i];
  },
  _getWithoutKey: function(lookup, data, path, props, len, i) {
    var curr, currPath, dereffed, to;
    to = this.to;
    curr = lookup(to, data);
    dereffed = derefPath(data, to);
    currPath = lookupPath(dereffed, props, i);
    data.$deref = function(method) {
      if (i === len && method in Model.basicMutator) {
        return path;
      } else {
        return currPath;
      }
    };
    return [curr, currPath, i];
  }
};