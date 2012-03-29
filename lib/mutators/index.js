var exports, mixinModel, mixinStore;

mixinModel = require('./mutators.Model');

mixinStore = __dirname + '/mutators.Store';

exports = module.exports = function(racer) {
  return racer.mixin(mixinModel, mixinStore);
};

exports.useWith = {
  server: true,
  browser: true
};