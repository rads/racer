var Promise, exports, mixin, onBundleTimeout;

Promise = require('./Promise');

exports = module.exports = function(racer) {
  var BUNDLE_TIMEOUT;
  BUNDLE_TIMEOUT = racer.get('bundle timeout') || racer.set('bundle timeout', 1000);
  mixin.static = {
    BUNDLE_TIMEOUT: BUNDLE_TIMEOUT
  };
  return racer.mixin(mixin);
};

exports.useWith = {
  server: true,
  browser: true
};

mixin = {
  type: "Model",
  events: {
    init: function(model) {
      model._bundlePromises = [];
      return model._onLoad = [];
    }
  },
  server: {
    bundle: function(callback) {
      var timeout,
        _this = this;
      this.mixinEmit('bundle', this);
      timeout = setTimeout(onBundleTimeout, mixin.static.BUNDLE_TIMEOUT);
      return Promise.parallel(this._bundlePromises).on(function() {
        clearTimeout(timeout);
        return _this._bundle(callback);
      });
    },
    _bundle: function(callback) {
      var clientId;
      clientId = this._clientId;
      this.store._unregisterLocalModel(clientId);
      return callback(JSON.stringify([clientId, this._memory, this._count, this._onLoad, this._startId, this._ioUri]));
    }
  }
};

onBundleTimeout = function() {
  throw new Error("Model bundling took longer than " + mixin.static.BUNDLE_TIMEOUT + " ms");
};