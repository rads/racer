var deepCopy, deepEqual, equalsNaN, indexOf, isArguments, isServer, objEquiv, toString,
  __slice = Array.prototype.slice;

toString = Object.prototype.toString;

module.exports = {
  async: require('./async'),
  isServer: isServer = typeof window === 'undefined',
  isProduction: isServer && process.env.NODE_ENV === 'production',
  isArguments: isArguments = function(obj) {
    return toString.call(obj) === '[object Arguments]';
  },
  mergeAll: function() {
    var from, froms, key, to, _i, _len;
    to = arguments[0], froms = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    for (_i = 0, _len = froms.length; _i < _len; _i++) {
      from = froms[_i];
      if (from) {
        for (key in from) {
          to[key] = from[key];
        }
      }
    }
    return to;
  },
  merge: function(to, from) {
    var key;
    for (key in from) {
      to[key] = from[key];
    }
    return to;
  },
  hasKeys: function(obj, ignore) {
    var key;
    for (key in obj) {
      if (key === ignore) continue;
      return true;
    }
    return false;
  },
  deepIndexOf: function(arr, x) {
    var mem, _i, _len;
    for (_i = 0, _len = arr.length; _i < _len; _i++) {
      mem = arr[_i];
      if (deepEqual(mem, x)) return i;
    }
    return -1;
  },
  deepEqual: deepEqual = function(actual, expected) {
    if (actual === expected) return true;
    if (actual instanceof Date && expected instanceof Date) {
      return actual.getTime() === expected.getTime();
    }
    if (typeof actual !== 'object' && typeof expected !== 'object') {
      return actual === expected;
    }
    return objEquiv(actual, expected);
  },
  objEquiv: objEquiv = function(a, b) {
    var i, ka, kb, key;
    if (a == null || b == null) return false;
    if (a.prototype !== b.prototype) return false;
    if (isArguments(a)) {
      if (!isArguments(b)) return false;
      a = pSlice.call(a);
      b = pSlice.call(b);
      return deepEqual(a, b);
    }
    try {
      ka = Object.keys(a);
      kb = Object.keys(b);
    } catch (e) {
      return false;
    }
    if (ka.length !== kb.length) return false;
    ka.sort();
    kb.sort();
    i = ka.length;
    while (i--) {
      if (ka[i] !== kb[i]) return false;
    }
    i = ka.length;
    while (i--) {
      key = ka[i];
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  },
  deepCopy: deepCopy = function(obj) {
    var k, ret, v, _i, _len;
    if (typeof obj === 'object') {
      if (Array.isArray(obj)) {
        ret = [];
        for (_i = 0, _len = obj.length; _i < _len; _i++) {
          v = obj[_i];
          ret.push(deepCopy(v));
        }
        return ret;
      }
      ret = {};
      for (k in obj) {
        v = obj[k];
        ret[k] = deepCopy(v);
      }
      return ret;
    }
    return obj;
  },
  deepIndexOf: function(list, obj) {
    return indexOf(list, obj, deepEqual);
  },
  indexOf: indexOf = function(list, obj, isEqual) {
    var i, v, _len;
    for (i = 0, _len = list.length; i < _len; i++) {
      v = list[i];
      if (isEqual(obj, v)) return i;
    }
    return -1;
  },
  equalsNaN: equalsNaN = function(x) {
    return x !== x;
  },
  equal: function(a, b) {
    return a === b || (equalsNaN(a) && equalsNaN(b));
  }
};
