
module.exports = {
  create: function(obj) {
    var txn;
    if (obj.ops) {
      txn = [obj.ver, obj.id, obj.ops];
    } else {
      txn = [obj.ver, obj.id, obj.method, obj.args];
    }
    return txn;
  },
  getVer: function(txn) {
    return txn[0];
  },
  setVer: function(txn, val) {
    return txn[0] = val;
  },
  getId: function(txn) {
    return txn[1];
  },
  setId: function(txn, id) {
    return txn[1] = id;
  },
  clientIdAndVer: function(txn) {
    var res;
    res = this.getId(txn).split('.');
    res[1] = parseInt(res[1], 10);
    return res;
  },
  getMethod: function(txn) {
    return txn[2];
  },
  setMethod: function(txn, name) {
    return txn[2] = name;
  },
  getArgs: function(txn) {
    return txn[3];
  },
  setArgs: function(txn, vals) {
    return txn[3] = vals;
  },
  getPath: function(txn) {
    return this.getArgs(txn)[0];
  },
  setPath: function(txn, val) {
    return this.getArgs(txn)[0] = val;
  },
  getMeta: function(txn) {
    return txn[4];
  },
  setMeta: function(txn, vals) {
    return txn[4] = vals;
  },
  getClientId: function(txn) {
    return this.getId(txn).split('.')[0];
  },
  setClientId: function(txn, newClientId) {
    var clientId, num, _ref;
    _ref = this.getId(txn).split('.'), clientId = _ref[0], num = _ref[1];
    this.setId(txn, newClientId + '.' + num);
    return newClientId;
  },
  pathConflict: function(pathA, pathB) {
    var pathALen, pathBLen;
    if (pathA === pathB) return 'equal';
    pathALen = pathA.length;
    pathBLen = pathB.length;
    if (pathALen === pathBLen) return false;
    if (pathALen > pathBLen) {
      return pathA.charAt(pathBLen) === '.' && pathA.slice(0, pathBLen) === pathB && 'child';
    }
    return pathB.charAt(pathALen) === '.' && pathB.slice(0, pathALen) === pathA && 'parent';
  },
  ops: function(txn, ops) {
    if (ops !== void 0) txn[2] = ops;
    return txn[2];
  },
  isCompound: function(txn) {
    return Array.isArray(txn[2]);
  },
  op: {
    create: function(obj) {
      var op;
      op = [obj.method, obj.args];
      return op;
    },
    getMethod: function(op) {
      return op[0];
    },
    setMethod: function(op, name) {
      return op[0] = name;
    },
    getArgs: function(op) {
      return op[1];
    },
    setArgs: function(op, vals) {
      return op[1] = vals;
    }
  }
};