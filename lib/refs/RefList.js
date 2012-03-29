var Model, Ref, RefList, derefPath, hasKeys, lookupPath, mergeAll, _ref, _ref2;

_ref = require('../util'), mergeAll = _ref.mergeAll, hasKeys = _ref.hasKeys;

Ref = require('./Ref');

_ref2 = require('./util'), derefPath = _ref2.derefPath, lookupPath = _ref2.lookupPath;

Model = require('../Model');

RefList = module.exports = function(model, from, to, key) {
  var arrayMutators,
    _this = this;
  this.model = model;
  this.from = from;
  this.to = to;
  this.key = key;
  this.listeners = [];
  arrayMutators = Model.arrayMutator;
  if (!(from && to && key)) throw new Error('invalid arguments for model.refList');
  this.get = function(lookup, data, path, props, len, i) {
    return _this._get(lookup, data, path, props, len, i);
  };
  this.addListener(key, function(match, method, args) {
    var i, id, _ref3;
    if (i = (_ref3 = arrayMutators[method]) != null ? _ref3.insertArgs : void 0) {
      while ((id = args[i]) != null) {
        args[i] = model.get(to + '.' + id);
        i++;
      }
    }
    return from;
  });
  this.addListener("" + to + ".*", function(match) {
    var found, i, id, pointerList, remainder, value, _len;
    id = match[1];
    if (~(i = id.indexOf('.'))) {
      remainder = id.substr(i + 1);
      id = id.substr(0, i);
    }
    if (pointerList = model.get(key)) {
      for (i = 0, _len = pointerList.length; i < _len; i++) {
        value = pointerList[i];
        if (value == id) {
          found = true;
          break;
        }
      }
    }
    if (!found) return null;
    if (remainder) {
      return "" + from + "." + i + "." + remainder;
    } else {
      return "" + from + "." + i;
    }
  });
};

mergeAll(RefList.prototype, Ref.prototype);

RefList.prototype._get = function(lookup, data, path, props, len, i) {
  var arrayMutators, basicMutators, curr, currPath, dereffed, dereffedKey, from, index, key, obj, pointerList, prop, to;
  basicMutators = Model.basicMutator;
  arrayMutators = Model.arrayMutator;
  from = this.from, to = this.to, key = this.key;
  obj = lookup(to, data) || {};
  dereffed = derefPath(data, to);
  data.$deref = null;
  pointerList = lookup(key, data);
  dereffedKey = derefPath(data, key);
  if (i === len) {
    currPath = lookupPath(dereffed, props, i);
    data.$deref = function(method, args, model) {
      var arg, id, index, indexArgs, j, keyId, mutator, _i, _len, _len2;
      if (method in basicMutators) return path;
      if (mutator = arrayMutators[method]) {
        if (indexArgs = mutator.indexArgs) {
          for (_i = 0, _len = indexArgs.length; _i < _len; _i++) {
            j = indexArgs[_i];
            if (!((arg = args[j]) && ((id = arg.id) != null))) continue;
            for (index = 0, _len2 = pointerList.length; index < _len2; index++) {
              keyId = pointerList[index];
              if (keyId == id) {
                args[j] = index;
                break;
              }
            }
          }
        }
        if (j = mutator.insertArgs) {
          while (arg = args[j]) {
            if ((id = arg.id) == null) id = arg.id = model.id();
            if (hasKeys(arg, 'id')) model.set(dereffed + '.' + id, arg);
            args[j] = id;
            j++;
          }
        }
        return dereffedKey;
      }
      throw new Error(method + ' unsupported on refList');
    };
    if (pointerList) {
      curr = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = pointerList.length; _i < _len; _i++) {
          prop = pointerList[_i];
          _results.push(obj[prop]);
        }
        return _results;
      })();
      return [curr, currPath, i];
    }
    return [void 0, currPath, i];
  } else {
    index = props[i++];
    if (pointerList && ((prop = pointerList[index]) != null)) curr = obj[prop];
    if (i === len) {
      currPath = lookupPath(dereffed, props, i);
      data.$deref = function(method, args, model, obj) {
        var id, value;
        if (method === 'set') {
          value = args[1];
          if ((id = value.id) == null) id = value.id = model.id();
          if (pointerList) {
            model.set(dereffedKey + '.' + index, id);
          } else {
            model.set(dereffedKey, [id]);
          }
          return currPath + '.' + id;
        }
        if (method === 'del') {
          if ((id = obj.id) == null) {
            throw new Error('Cannot delete refList item without id');
          }
          model.del(dereffedKey + '.' + index);
          return currPath + '.' + id;
        }
        throw new Error(method + ' unsupported on refList index');
      };
    } else {
      currPath = lookupPath(dereffed + '.' + prop, props, i);
      data.$deref = function(method) {
        if (method && prop == null) {
          throw new Error(method + ' on undefined refList child ' + props.join('.'));
        }
        return currPath;
      };
    }
    return [curr, currPath, i];
  }
};