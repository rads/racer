var Field, FieldConnection, syncqueue, text;

text = require('../../node_modules/share/lib/types/text');

syncqueue = require('../../node_modules/share/lib/server/syncqueue');

FieldConnection = require('./FieldConnection.server');

Field = module.exports = function(store, path, version, type) {
  var _this = this;
  this.version = version;
  this.type = type != null ? type : text;
  this.store = store;
  this.path = path;
  this.snapshot = '';
  this.meta = {};
  this.ops = [];
  this.connections = {};
  this.applyQueue = syncqueue(function(_arg, callback) {
    var newDocData, newOpData, op, opMeta, opVersion, ops, realOp, _i, _len;
    op = _arg.op, opVersion = _arg.v, opMeta = _arg.meta;
    opMeta || (opMeta = {});
    opMeta.ts = Date.now();
    if (opVersion > _this.version) {
      return callback(new Error('Op at future version'));
    }
    if (opVersion < _this.version) {
      ops = _this.getOps(opVersion);
      try {
        for (_i = 0, _len = ops.length; _i < _len; _i++) {
          realOp = ops[_i];
          op = _this.type.transform(op, realOp.op, 'left');
          opVersion++;
        }
      } catch (err) {
        return callback(err);
      }
    }
    try {
      _this.snapshot = _this.type.apply(_this.snapshot, op);
      _this.version++;
    } catch (err) {
      return callback(err);
    }
    newOpData = {
      path: _this.path,
      op: op,
      meta: opMeta,
      v: opVersion
    };
    newDocData = {
      snapshot: _this.snapshot,
      type: _this.type.name,
      v: opVersion + 1,
      meta: _this.meta
    };
    _this.ops.push({
      op: op,
      v: opVersion,
      meta: opMeta
    });
    store.publish(_this.path, 'ot', newOpData);
    return callback(null, opVersion);
  });
};

Field.prototype = {
  applyOp: function(opData, callback) {
    var _this = this;
    return process.nextTick(function() {
      return _this.applyQueue(opData, callback);
    });
  },
  registerSocket: function(socket, ver) {
    var client;
    client = new FieldConnection(this, socket);
    if (ver != null) client.listenSinceVer(ver != null ? ver : null);
    this.connections[socket.id] = client;
    return client;
  },
  unregisterSocket: function(socket) {
    return delete this.connections[socket.id];
  },
  client: function(socketId) {
    return this.connections[socketId];
  },
  getOps: function(start, end) {
    if (end == null) end = this.version;
    return this.ops.slice(start, end);
  },
  toJSON: function() {
    return {
      version: this.version,
      path: this.path,
      snapshot: this.snapshot,
      meta: this.meta,
      ops: this.ops
    };
  }
};