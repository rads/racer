var exports, mixinModel, mixinStore;

mixinModel = require('./txns.Model');

mixinStore = __dirname + '/txns.Store';

exports = module.exports = function(racer) {
  return racer.mixin(mixinModel, mixinStore);
};

exports.useWith = {
  server: true,
  browser: true
};