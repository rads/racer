var Async, fn, modelProto, name, obj, proto, static, _ref, _ref2;

Async = require('./Async');

_ref = require('./mutators.Model'), static = _ref.static, modelProto = _ref.proto;

proto = {
  get: {
    type: 'accessor',
    fn: function(path, callback) {
      return this._sendToDb('get', [path || ''], callback);
    }
  }
};

_ref2 = Async.prototype;
for (name in _ref2) {
  fn = _ref2[name];
  proto[name] = (obj = modelProto[name]) ? {
    type: obj.type,
    fn: fn
  } : fn;
}

module.exports = {
  type: 'Store',
  static: static,
  proto: proto
};
