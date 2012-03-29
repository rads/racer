var adapters;

console.assert(require('../util').isServer);

adapters = {
  journal: {},
  pubSub: {},
  db: {},
  clientId: {}
};

exports.registerAdapter = function(adapterType, type, AdapterKlass) {
  return adapters[adapterType][type] = AdapterKlass;
};

exports.createAdapter = function(adapterType, opts) {
  var Adapter, adapter;
  if (typeof opts === 'string') {
    opts = {
      type: opts
    };
  }
  if (!opts.constructor === Object) {
    adapter = opts;
  } else {
    try {
      Adapter = adapters[adapterType][opts.type];
    } catch (err) {
      throw new Error("No " + adapterType + " adapter found for " + opts.type);
    }
    if (typeof Adapter !== 'function') {
      throw new Error("No " + adapterType + " adapter found for " + opts.type);
    }
    adapter = new Adapter(opts);
  }
  if (typeof adapter.connect === "function") adapter.connect();
  return adapter;
};