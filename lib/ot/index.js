var exports, mixinModel, mixinStore;

mixinModel = require('./ot.Model');

mixinStore = __dirname + '/ot.Store';

exports = module.exports = function(racer) {
  return racer.mixin(mixinModel, mixinStore);
};

exports.useWith = {
  browser: true,
  server: true
};
