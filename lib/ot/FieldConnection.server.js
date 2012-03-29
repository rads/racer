var FieldConnection;

FieldConnection = module.exports = function(field, socket) {
  this.field = field;
  this.socket = socket;
  this.listener = null;
  this.queue = [];
  return this.busy = false;
};

FieldConnection.prototype = {
  selfDestruct: function() {
    return delete this.field.connections[this.socket.id];
  },
  flush: function() {
    var callback, query, socketioCallback, _ref,
      _this = this;
    if (this.busy || !this.queue.length) return;
    this.busy = true;
    _ref = this.queue.shift(), query = _ref[0], socketioCallback = _ref[1];
    callback = function() {
      _this.busy = false;
      return _this.flush();
    };
    if (query.op) return this.otApply(query, callback, socketioCallback);
  },
  otApply: function(_arg, callback, socketioCallback) {
    var field, op, opData, v;
    op = _arg.op, v = _arg.v;
    opData = {
      op: op,
      v: v
    };
    opData.meta || (opData.meta = {});
    opData.meta.src = this.socket.id;
    field = this.field;
    return field.applyOp(opData, function(err, appliedVer) {
      if (err) {
        socketioCallback(err.message);
      } else {
        socketioCallback(null, {
          path: field.path,
          v: appliedVer
        });
      }
      return callback();
    });
  },
  listenSinceVer: function(ver) {
    var op, ops, _i, _len, _results;
    if (ver !== null) {
      ops = this.field.getOps(ver);
      _results = [];
      for (_i = 0, _len = ops.length; _i < _len; _i++) {
        op = ops[_i];
        _results.push(this.socket.emit('otOp', op));
      }
      return _results;
    }
  }
};