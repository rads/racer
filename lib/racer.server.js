var browserify, fs, isProduction, registerAdapter, socketio, socketioClient, uglify,
  __slice = Array.prototype.slice;

fs = require('fs');

browserify = require('browserify');

socketio = require('socket.io');

socketioClient = require('socket.io-client');

uglify = require('uglify-js');

registerAdapter = require('./adapters').registerAdapter;

isProduction = require('./util').isProduction;

module.exports = function(racer) {
  var Store;
  racer.settings = {
    env: process.env.NODE_ENV || 'development'
  };
  racer.configure = function() {
    var envs, fn, _i;
    envs = 2 <= arguments.length ? __slice.call(arguments, 0, _i = arguments.length - 1) : (_i = 0, []), fn = arguments[_i++];
    if (envs[0] === 'all' || ~envs.indexOf(this.settings.env)) {
      return fn.call(this);
    }
  };
  racer.set = function(setting, value) {
    this.settings[setting] = value;
    return this;
  };
  racer.get = function(setting) {
    return this.settings[setting];
  };
  racer.set('transports', ['websocket', 'xhr-polling']);
  racer.configure('production', function() {
    return this.set('minify', true);
  });
  racer.merge({
    session: require('./session'),
    Store: Store = require('./Store'),
    createStore: function(options) {
      var listen, sockets, store;
      if (options == null) options = {};
      store = new Store(options);
      if (sockets = options.sockets) {
        store.setSockets(sockets, options.socketUri);
      } else if (listen = options.listen) {
        store.listen(listen, options.namespace);
      }
      return store;
    },
    registerAdapter: function(type, name, AdapterKlass) {
      return registerAdapter(type, name, AdapterKlass);
    },
    js: function(options, callback) {
      var minify;
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }
      minify = options.minify || this.get('minify');
      if (minify && !options.filter) {
        options.filter = this.get('minifyFilter') || uglify;
      }
      if (!(isProduction || (options.debug != null))) options.debug = true;
      return socketioClient.builder(racer.get('transports'), {
        minify: minify
      }, function(err, value) {
        return callback(err, value + ';' + browserify.bundle(options));
      });
    }
  });
  Object.defineProperty(racer, 'version', {
    get: function() {
      return JSON.parse(fs.readFileSync(__dirname + '/../package.json', 'utf8')).version;
    }
  });
  return racer.use(require('./bundle.Model')).use(require('./adapters/journal-memory')).use(require('./adapters/journal-none')).use(require('./adapters/pubsub-memory')).use(require('./adapters/pubsub-none')).use(require('./adapters/db-memory')).use(require('./adapters/clientid-mongo')).use(require('./adapters/clientid-redis')).use(require('./adapters/clientid-rfc4122_v4'));
};