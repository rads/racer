var EventEmitter, PubSubNone, exports;

EventEmitter = require('events').EventEmitter;

exports = module.exports = function(racer) {
  return racer.registerAdapter('pubSub', 'None', PubSubNone);
};

exports.useWith = {
  server: true,
  browser: false
};

PubSubNone = function() {};

PubSubNone.prototype = {
  __proto__: EventEmitter.prototype,
  publish: function() {},
  subscribe: function() {
    throw new Error('subscribe is not supported without a pubSub adapter');
  },
  unsubscribe: function() {},
  hasSubscriptions: function() {
    return false;
  },
  subscribedTo: function() {
    return false;
  }
};
