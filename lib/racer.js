var EventEmitter, isServer, mergeAll, plugin, racer, util, _ref,
  __slice = Array.prototype.slice;

_ref = util = require('./util'), mergeAll = _ref.mergeAll, isServer = _ref.isServer;

if (!isServer) require('es5-shim');

EventEmitter = require('events').EventEmitter;

plugin = require('./plugin');

racer = module.exports = new EventEmitter;

racer.merge = function() {
  return mergeAll.apply(null, [this].concat(__slice.call(arguments)));
};

racer.merge(plugin, {
  Model: require('./Model')
});

if (isServer) racer.use(__dirname + '/racer.server');

racer.use(require('./mutators')).use(require('./refs')).use(require('./pubSub')).use(require('./txns'));

if (!isServer) racer.use(require('./racer.browser'));
