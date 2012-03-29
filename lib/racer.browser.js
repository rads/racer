var exports, isReady, model;

isReady = model = null;

exports = module.exports = function(racer) {
  return racer.merge({
    init: function(_arg, socket) {
      var clientId, count, ioUri, item, memory, method, onLoad, startId, _i, _len;
      clientId = _arg[0], memory = _arg[1], count = _arg[2], onLoad = _arg[3], startId = _arg[4], ioUri = _arg[5];
      model = new racer.Model;
      model._clientId = clientId;
      model._startId = startId;
      model._memory.init(memory);
      model._count = count;
      for (_i = 0, _len = onLoad.length; _i < _len; _i++) {
        item = onLoad[_i];
        method = item.shift();
        model[method].apply(model, item);
      }
      racer.emit('init', model);
      model._setSocket(socket || io.connect(ioUri, {
        'reconnection delay': 100,
        'max reconnection attempts': 20,
        query: 'clientId=' + clientId
      }));
      isReady = true;
      racer.emit('ready', model);
      return racer;
    },
    ready: function(onready) {
      return function() {
        var connected;
        if (isReady) {
          connected = model.socket.socket.connected;
          onready(model);
          if (connected) model.socket.socket.publish('connect');
          return;
        }
        return racer.on('ready', onready);
      };
    }
  });
};

exports.useWith = {
  server: false,
  browser: true
};