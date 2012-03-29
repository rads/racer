var EventEmitter, Memory, Model, eventListener, eventRegExp, mergeAll,
  __slice = Array.prototype.slice;

EventEmitter = require('events').EventEmitter;

Memory = require('./Memory');

eventRegExp = require('./path').eventRegExp;

mergeAll = require('./util').mergeAll;

Model = module.exports = function() {
  this._memory = new Memory;
  this._count = {
    id: 0
  };
  this.setMaxListeners(0);
  this.mixinEmit('init', this);
};

mergeAll(Model.prototype, EventEmitter.prototype, {
  id: function() {
    return '$_' + this._clientId + '_' + (this._count.id++).toString(36);
  },
  connected: true,
  canConnect: true,
  _setSocket: function(socket) {
    var onConnected,
      _this = this;
    this.socket = socket;
    this.mixinEmit('socket', this, socket);
    this.canConnect = true;
    socket.on('fatalErr', function(msg) {
      _this.canConnect = false;
      _this.emit('canConnect', false);
      return socket.disconnect();
    });
    this.connected = false;
    onConnected = function() {
      _this.emit('connected', _this.connected);
      return _this.emit('connectionStatus', _this.connected, _this.canConnect);
    };
    socket.on('connect', function() {
      _this.connected = true;
      return onConnected();
    });
    socket.on('disconnect', function() {
      _this.connected = false;
      return setTimeout(onConnected, 400);
    });
    return socket.on('connect_failed', onConnected);
  },
  at: function(segment, absolute) {
    var at;
    return Object.create(this, {
      _at: {
        value: (at = this._at) && !absolute ? segment === '' ? at : at + '.' + segment : segment.toString()
      }
    });
  },
  parent: function(levels) {
    var at, segments;
    if (levels == null) levels = 1;
    if (!(at = this._at)) return this;
    segments = at.split('.');
    return this.at(segments.slice(0, segments.length - levels).join('.'), true);
  },
  path: function() {
    return this._at || '';
  },
  leaf: function(path) {
    var i;
    if (path == null) path = this._at || '';
    i = path.lastIndexOf('.');
    return path.substr(i + 1);
  },
  _on: EventEmitter.prototype.on,
  on: function(type, pattern, callback) {
    var listener;
    this._on(type, listener = eventListener(type, pattern, callback, this._at));
    return listener;
  },
  _once: EventEmitter.prototype.once,
  once: function(type, pattern, callback) {
    var g, listener,
      _this = this;
    listener = eventListener(type, pattern, callback, this._at);
    this._on(type, g = function() {
      var matches;
      matches = listener.apply(null, arguments);
      if (matches) return _this.removeListener(type, g);
    });
    return listener;
  },
  pass: function(arg) {
    return Object.create(this, {
      _pass: {
        value: arg
      }
    });
  }
});

Model.prototype.addListener = Model.prototype.on;

eventListener = function(method, pattern, callback, at) {
  var re;
  if (at) {
    if (typeof pattern === 'string') {
      pattern = at + '.' + pattern;
    } else if (pattern instanceof Function) {
      callback = pattern;
      pattern = at;
    } else {
      throw new Error('Unsupported event pattern on scoped model');
    }
  } else {
    if (pattern instanceof Function) return pattern;
  }
  re = eventRegExp(pattern);
  return function(_arg, out, isLocal, pass) {
    var args, argsForEmit, path;
    path = _arg[0], args = 2 <= _arg.length ? __slice.call(_arg, 1) : [];
    if (re.test(path)) {
      argsForEmit = re.exec(path).slice(1).concat(args);
      argsForEmit.push(out, isLocal, pass);
      callback.apply(null, argsForEmit);
      return true;
    }
  };
};