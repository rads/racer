var LiveQuery, Query, exports, mixinModel, mixinStore;

LiveQuery = require('./LiveQuery');

Query = require('./Query');

mixinModel = require('./pubSub.Model');

mixinStore = __dirname + '/pubSub.Store';

exports = module.exports = function(racer) {
  racer.LiveQuery = LiveQuery;
  racer.Query = Query;
  return racer.mixin(mixinModel, mixinStore);
};

exports.useWith = {
  server: true,
  browser: true
};
