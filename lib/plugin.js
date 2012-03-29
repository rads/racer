var emitFn, isServer, mergeAll, mergeProto, _ref, _require,
  __slice = Array.prototype.slice;

_ref = require('./util'), mergeAll = _ref.mergeAll, isServer = _ref.isServer;

_require = require;

module.exports = {
  use: function(plugin, options) {
    if (typeof plugin === 'string') {
      if (!isServer) return this;
      plugin = _require(plugin);
    }
    this._plugins || (this._plugins = []);
    if (-1 === this._plugins.indexOf(plugin)) {
      this._plugins.push(plugin);
      plugin(this, options);
    }
    return this;
  },
  mixin: function() {
    var Klass, fn, mixin, name, server, type, _i, _len, _ref2;
    for (_i = 0, _len = arguments.length; _i < _len; _i++) {
      mixin = arguments[_i];
      if (typeof mixin === 'string') {
        if (!isServer) continue;
        mixin = _require(mixin);
      }
      if (!(type = mixin.type)) throw new Error("Mixins require a type parameter");
      if (!(Klass = this[type])) throw new Error("Cannot find racer." + type);
      if (Klass.mixins) {
        Klass.mixins.push(mixin);
      } else {
        Klass.mixins = [mixin];
        Klass.prototype.mixinEmit = emitFn(this, type);
      }
      mergeAll(Klass, mixin.static);
      mergeProto(mixin.proto, Klass);
      if (isServer && (server = mixin.server)) {
        server = typeof server === 'string' ? _require(server) : mixin.server;
        mergeProto(server, Klass);
      }
      _ref2 = mixin.events;
      for (name in _ref2) {
        fn = _ref2[name];
        this.on(type + ':' + name, fn);
      }
      this.emit(type + ':mixin', Klass);
    }
    return this;
  }
};

mergeProto = function(protoSpec, Klass) {
  var descriptor, fn, groupName, key, methods, name, targetPrototype, value, _i, _len, _ref2;
  targetPrototype = Klass.prototype;
  for (name in protoSpec) {
    descriptor = protoSpec[name];
    if (typeof descriptor === 'function') {
      targetPrototype[name] = descriptor;
      continue;
    }
    fn = targetPrototype[name] = descriptor.fn;
    for (key in descriptor) {
      value = descriptor[key];
      switch (key) {
        case 'fn':
          continue;
        case 'type':
          _ref2 = value.split(',');
          for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
            groupName = _ref2[_i];
            methods = Klass[groupName] || (Klass[groupName] = {});
            methods[name] = fn;
          }
          break;
        default:
          fn[key] = value;
      }
    }
  }
};

emitFn = function(self, type) {
  return function() {
    var args, name;
    name = arguments[0], args = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    return self.emit.apply(self, [type + ':' + name].concat(__slice.call(args)));
  };
};
