var cbs, isProduction, uglify,
  __slice = Array.prototype.slice;

uglify = require('uglify-js');

isProduction = require('../util').isProduction;

cbs = {};

module.exports = {
  _onCreateRef: function(method, from, to, key, get) {
    var args;
    args = [method, from, to];
    if (key) args.push(key);
    return this._refsToBundle.push([from, get, args]);
  },
  _onCreateFn: function(path, inputs, callback) {
    var cb, fnsToBundle, len, uglified;
    cb = callback.toString();
    if (isProduction) {
      cb = cbs[cb] || (uglified = uglify("(" + cb + ")()"), cbs[cb] = uglified.slice(1, -3));
    }
    fnsToBundle = this._fnsToBundle;
    len = fnsToBundle.push(['fn', path].concat(__slice.call(inputs), [cb]));
    return function() {
      return delete fnsToBundle[len - 1];
    };
  }
};