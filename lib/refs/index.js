var Ref, RefList, derefPath, diffArrays, equal, exports, isPrivate, isServer, mixin, racer, regExpPathOrParent, regExpPathsOrChildren, _ref, _ref2,
  __slice = Array.prototype.slice;

_ref = require('../path'), isPrivate = _ref.isPrivate, regExpPathOrParent = _ref.regExpPathOrParent, regExpPathsOrChildren = _ref.regExpPathsOrChildren;

derefPath = require('./util').derefPath;

Ref = require('./Ref');

RefList = require('./RefList');

diffArrays = require('../diffMatchPatch').diffArrays;

_ref2 = require('../util'), isServer = _ref2.isServer, equal = _ref2.equal;

racer = require('../racer');

exports = module.exports = function(racer) {
  return racer.mixin(mixin);
};

exports.useWith = {
  server: true,
  browser: true
};

mixin = {
  type: 'Model',
  server: __dirname + '/refs.server',
  events: {
    init: function(model) {
      var Model, memory, method, _fn;
      model._root = model;
      model._refsToBundle = [];
      model._fnsToBundle = [];
      Model = model.constructor;
      _fn = function(method) {
        return model.on(method, function(_arg) {
          var path;
          path = _arg[0];
          return model.emit('mutator', method, path, arguments);
        });
      };
      for (method in Model.mutator) {
        _fn(method);
      }
      memory = model._memory;
      return model.on('beforeTxn', function(method, args) {
        var data, fn, obj, path;
        if (path = args[0]) {
          obj = memory.get(path, data = model._specModel());
          if (fn = data.$deref) args[0] = fn(method, args, model, obj);
        }
      });
    },
    bundle: function(model) {
      var from, get, item, onLoad, _i, _j, _len, _len2, _ref3, _ref4, _ref5;
      onLoad = model._onLoad;
      _ref3 = model._refsToBundle;
      for (_i = 0, _len = _ref3.length; _i < _len; _i++) {
        _ref4 = _ref3[_i], from = _ref4[0], get = _ref4[1], item = _ref4[2];
        if (model._getRef(from) === get) onLoad.push(item);
      }
      _ref5 = model._fnsToBundle;
      for (_j = 0, _len2 = _ref5.length; _j < _len2; _j++) {
        item = _ref5[_j];
        if (item) onLoad.push(item);
      }
    }
  },
  proto: {
    _getRef: function(path) {
      return this._memory.get(path, this._specModel(), true);
    },
    _ensurePrivateRefPath: function(from, modelMethod) {
      if (!isPrivate(this.dereference(from, true))) {
        throw new Error("cannot create " + modelMethod + " on public path '" + from + "'");
      }
    },
    dereference: function(path, getRef) {
      var data;
      if (getRef == null) getRef = false;
      this._memory.get(path, data = this._specModel(), getRef);
      return derefPath(data, path);
    },
    ref: function(from, to, key) {
      return this._createRef(Ref, 'ref', from, to, key);
    },
    refList: function(from, to, key) {
      return this._createRef(RefList, 'refList', from, to, key);
    },
    _createRef: function(RefType, modelMethod, from, to, key) {
      var get, listener, model, previous, value;
      if (this._at) {
        key = to;
        to = from;
        from = this._at;
      } else if (from._at) {
        from = from._at;
      }
      if (to._at) to = to._at;
      if (key && key._at) key = key._at;
      model = this._root;
      model._ensurePrivateRefPath(from, modelMethod);
      get = new RefType(model, from, to, key).get;
      listener = model.on('beforeTxn', function(method, args) {
        if (method === 'set' && args[1] === get) {
          args.cancelEmit = true;
          model.removeListener('beforeTxn', listener);
        }
      });
      previous = model.set(from, get);
      value = model.get(from);
      model.emit('set', [from, value], previous, true, void 0);
      if (typeof this._onCreateRef === "function") {
        this._onCreateRef(modelMethod, from, to, key, get);
      }
      return model.at(from);
    },
    fn: function() {
      var fn, i, input, inputs, model, path, _i, _len;
      inputs = 2 <= arguments.length ? __slice.call(arguments, 0, _i = arguments.length - 1) : (_i = 0, []), fn = arguments[_i++];
      for (i = 0, _len = inputs.length; i < _len; i++) {
        input = inputs[i];
        inputs[i] = input._at || input;
      }
      path = this._at || inputs.shift();
      model = this._root;
      model._ensurePrivateRefPath(path, 'fn');
      if (typeof fn === 'string') fn = new Function('return ' + fn)();
      return model._createFn(path, inputs, fn);
    },
    _createFn: function(path, inputs, fn, destroy, prevVal, currVal) {
      var listener, model, reInput, reSelf, updateVal,
        _this = this;
      reSelf = regExpPathOrParent(path);
      reInput = regExpPathsOrChildren(inputs);
      destroy = typeof this._onCreateFn === "function" ? this._onCreateFn(path, inputs, fn) : void 0;
      listener = this.on('mutator', function(mutator, mutatorPath, _arguments) {
        if (_arguments[3] === listener) return;
        if (reSelf.test(mutatorPath) && !equal(_this.get(path), currVal)) {
          _this.removeListener('mutator', listener);
          return typeof destroy === "function" ? destroy() : void 0;
        }
        if (reInput.test(mutatorPath)) return currVal = updateVal();
      });
      model = this.pass(listener);
      return (updateVal = function() {
        var input;
        prevVal = currVal;
        currVal = fn.apply(null, (function() {
          var _i, _len, _results;
          _results = [];
          for (_i = 0, _len = inputs.length; _i < _len; _i++) {
            input = inputs[_i];
            _results.push(this.get(input));
          }
          return _results;
        }).call(_this));
        if (equal(prevVal, currVal)) return currVal;
        model.set(path, currVal);
        return currVal;
      })();
    }
  }
};