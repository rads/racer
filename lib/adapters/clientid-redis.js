var ClientIdRedis, exports;

exports = module.exports = function(racer) {
  return racer.registerAdapter('clientId', 'Redis', ClientIdRedis);
};

exports.useWith = {
  server: true,
  browser: false
};

ClientIdRedis = function(_options) {
  this._options = _options;
};

ClientIdRedis.prototype.generateFn = function() {
  var redisClient;
  redisClient = this._options.redisClient;
  return function(callback) {
    return redisClient.incr('clientClock', function(err, val) {
      var clientId;
      if (err) return callback(err);
      clientId = val.toString(36);
      return callback(null, clientId);
    });
  };
};