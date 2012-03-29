var Field, Promise, Serializer, isSpeculative, text;

text = require('../../node_modules/share/lib/types/text');

Promise = require('../Promise');

Serializer = require('../Serializer');

isSpeculative = require('../speculative').isSpeculative;

Field = module.exports = function(model, path, version, type) {
  var _this = this;
  this.model = model;
  this.path = path;
  this.version = version != null ? version : 0;
  this.type = type != null ? type : text;
  this.snapshot = null;
  this.queue = [];
  this.pendingOp = null;
  this.pendingCallbacks = [];
  this.inflightOp = null;
  this.inflightCallbacks = [];
  this.serverOps = {};
  this.incomingSerializer = new Serializer({
    init: this.version,
    withEach: function(_arg, ver) {
      var callback, docOp, err, isRemote, oldInflightOp, op, undo, _i, _j, _len, _len2, _ref, _ref2, _ref3, _ref4, _ref5;
      op = _arg[0], isRemote = _arg[1], err = _arg[2];
      if (isRemote) {
        docOp = op;
        if (_this.inflightOp) {
          _ref = _this.xf(_this.inflightOp, docOp), _this.inflightOp = _ref[0], docOp = _ref[1];
        }
        if (_this.pendingOp) {
          _ref2 = _this.xf(_this.pendingOp, docOp), _this.pendingOp = _ref2[0], docOp = _ref2[1];
        }
        _this.version++;
        return _this.otApply(docOp, false);
      } else {
        oldInflightOp = _this.inflightOp;
        _this.inflightOp = null;
        if (err) {
          if (!_this.type.invert) {
            throw new Error("Op apply failed (" + err + ") and the OT type does not define an invert function.");
          }
          throw new Error(err);
          undo = _this.type.invert(oldInflightOp);
          if (_this.pendingOp) {
            _ref3 = _this.xf(_this.pendingOp, undo), _this.pendingOp = _ref3[0], undo = _ref3[1];
          }
          _this.otApply(undo);
          _ref4 = _this.inflightCallbacks;
          for (_i = 0, _len = _ref4.length; _i < _len; _i++) {
            callback = _ref4[_i];
            callback(err);
          }
          return _this.flush;
        }
        if (ver !== _this.version) throw new Error('Invalid version from server');
        _this.serverOps[_this.version] = oldInflightOp;
        _this.version++;
        _ref5 = _this.inflightCallbacks;
        for (_j = 0, _len2 = _ref5.length; _j < _len2; _j++) {
          callback = _ref5[_j];
          callback(null, oldInflightOp);
        }
        return _this.flush();
      }
    },
    timeout: 5000,
    onTimeout: function() {
      throw new Error("Did not receive a prior op in time. Invalid version would result by applying buffered received ops unless prior op was applied first.");
    }
  });
  model.on('change', function(_arg, isLocal) {
    var d, i, oldSnapshot, op, p, _i, _len, _path, _ref;
    _path = _arg[0], op = _arg[1], oldSnapshot = _arg[2];
    if (_path !== path) return;
    for (_i = 0, _len = op.length; _i < _len; _i++) {
      _ref = op[_i], p = _ref.p, i = _ref.i, d = _ref.d;
      if (i) {
        model.emit('otInsert', [path, p, i], isLocal);
      } else {
        model.emit('otDel', [path, p, d], isLocal);
      }
    }
  });
};

Field.prototype = {
  onRemoteOp: function(op, v) {
    var docOp;
    if (v < this.version) return;
    if (v !== this.version) {
      throw new Error("Expected version " + this.version + " but got " + v);
    }
    docOp = this.serverOps[this.version] = op;
    return this.incomingSerializer.add([docOp, true], v);
  },
  otApply: function(docOp, isLocal) {
    var oldSnapshot;
    if (isLocal == null) isLocal = true;
    oldSnapshot = this.snapshot;
    this.snapshot = this.type.apply(oldSnapshot, docOp);
    this.model.emit('change', [this.path, docOp, oldSnapshot], isLocal);
    return this.snapshot;
  },
  submitOp: function(op, callback) {
    var type,
      _this = this;
    type = this.type;
    op = type.normalize(op);
    this.otApply(op);
    this.pendingOp = this.pendingOp ? type.compose(this.pendingOp, op) : op;
    if (callback) this.pendingCallbacks.push(callback);
    return setTimeout(function() {
      return _this.flush();
    }, 0);
  },
  specTrigger: function(shouldResolve) {
    var _this = this;
    if (!this._specTrigger) {
      this._specTrigger = new Promise;
      this._specTrigger.on(function() {
        return _this.flush();
      });
    }
    if ((shouldResolve || this.model.isOtPath(this.path, true)) && !this._specTrigger.value) {
      this._specTrigger.resolve(null, true);
    }
    return this._specTrigger;
  },
  flush: function() {
    var shouldResolve,
      _this = this;
    if (!this._specTrigger) {
      shouldResolve = !isSpeculative(this.model._specModel());
      this.specTrigger(shouldResolve);
      return;
    }
    if (this.inflightOp !== null || this.pendingOp === null) return;
    this.inflightOp = this.pendingOp;
    this.pendingOp = null;
    this.inflightCallbacks = this.pendingCallbacks;
    this.pendingCallbacks = [];
    return this.model.socket.emit('otOp', {
      path: this.path,
      op: this.inflightOp,
      v: this.version
    }, function(err, msg) {
      if (msg) {
        return _this.incomingSerializer.add([_this.inflightOp, false, err], msg.v);
      }
    });
  },
  xf: function(client, server) {
    var client_, server_;
    client_ = this.type.transform(client, server, 'left');
    server_ = this.type.transform(server, client, 'right');
    return [client_, server_];
  }
};

Field.fromJSON = function(json, model) {
  var field;
  field = new Field(model, json.path, json.version);
  field.snapshot = json.snapshot;
  return field;
};