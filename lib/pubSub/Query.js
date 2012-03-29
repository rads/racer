var ABBREVS, Query, callsComparator, method, _fn, _i, _len, _ref,
  __slice = Array.prototype.slice;

ABBREVS = {
  equals: '$eq',
  notEquals: '$ne',
  gt: '$gt',
  gte: '$gte',
  lt: '$lt',
  lte: '$lte',
  within: '$w',
  contains: '$c'
};

Query = module.exports = function(namespace) {
  this._calls = [];
  this._json = {};
  if (namespace) this.from(namespace);
};

Query.prototype = {
  isQuery: true,
  toJSON: function() {
    return this._calls;
  },
  hash: function() {
    var arg, args, calls, group, groups, hash, i, limitHash, method, path, pathCalls, selectHash, sep, skipHash, sortHash, _i, _j, _k, _l, _len, _len2, _len3, _len4, _len5, _len6, _m, _ref, _ref2, _step;
    sep = ':';
    groups = [];
    calls = this._calls;
    for (_i = 0, _len = calls.length; _i < _len; _i++) {
      _ref = calls[_i], method = _ref[0], args = _ref[1];
      switch (method) {
        case 'from':
          continue;
        case 'where':
          group = {
            path: args[0]
          };
          pathCalls = group.calls = [];
          groups.push(group);
          break;
        case 'equals':
        case 'notEquals':
        case 'gt':
        case 'gte':
        case 'lt':
        case 'lte':
          pathCalls.push([ABBREVS[method], args]);
          break;
        case 'within':
        case 'contains':
          args[0].sort();
          pathCalls.push([ABBREVS[method], args]);
          break;
        case 'only':
        case 'except':
          selectHash = method === 'only' ? '$o' : '$e';
          for (_j = 0, _len2 = args.length; _j < _len2; _j++) {
            path = args[_j];
            selectHash += sep + path;
          }
          break;
        case 'sort':
          sortHash = '$s' + sep;
          for (i = 0, _len3 = args.length, _step = 2; i < _len3; i += _step) {
            path = args[i];
            sortHash += path + sep;
            sortHash += (function() {
              switch (args[i + 1]) {
                case 'asc':
                  return '^';
                case 'desc':
                  return 'v';
              }
            })();
          }
          break;
        case 'skip':
          skipHash = '$sk' + sep + args[0];
          break;
        case 'limit':
          limitHash = '$L' + sep + args[0];
      }
    }
    hash = this.namespace;
    if (sortHash) hash += sep + sortHash;
    if (selectHash) hash += sep + selectHash;
    if (skipHash) hash += sep + skipHash;
    if (limitHash) hash += sep + limitHash;
    groups = groups.map(function(group) {
      group.calls = group.calls.sort(callsComparator);
      return group;
    });
    groups.sort(function(groupA, groupB) {
      var pathA, pathB;
      pathA = groupA.path;
      pathB = groupB.path;
      if (pathA < pathB) return -1;
      if (pathA === pathB) return 0;
      return 1;
    });
    for (_k = 0, _len4 = groups.length; _k < _len4; _k++) {
      group = groups[_k];
      hash += sep + sep + group.path;
      calls = group.calls;
      for (_l = 0, _len5 = calls.length; _l < _len5; _l++) {
        _ref2 = calls[_l], method = _ref2[0], args = _ref2[1];
        hash += sep + method;
        for (_m = 0, _len6 = args.length; _m < _len6; _m++) {
          arg = args[_m];
          hash += sep + (typeof arg === 'object' ? JSON.stringify(arg) : arg);
        }
      }
    }
    return hash;
  },
  from: function(namespace) {
    this.namespace = namespace;
    this._calls.push(['from', [this.namespace]]);
    return this;
  },
  skip: function() {
    var args;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    this.isPaginated = true;
    this._calls.push(['skip', args]);
    return this;
  },
  limit: function() {
    var args;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    this.isPaginated = true;
    this._calls.push(['limit', args]);
    return this;
  }
};

_ref = ['byKey', 'where', 'equals', 'notEquals', 'gt', 'gte', 'lt', 'lte', 'within', 'contains', 'only', 'except', 'sort'];
_fn = function(method) {
  return Query.prototype[method] = function() {
    var args;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    this._calls.push([method, args]);
    return this;
  };
};
for (_i = 0, _len = _ref.length; _i < _len; _i++) {
  method = _ref[_i];
  _fn(method);
}

Query.deserialize = function(calls) {
  var args, query, _j, _len2, _ref2;
  query = new Query;
  for (_j = 0, _len2 = calls.length; _j < _len2; _j++) {
    _ref2 = calls[_j], method = _ref2[0], args = _ref2[1];
    query[method].apply(query, args);
  }
  return query;
};

callsComparator = function(_arg, _arg2) {
  var methodA, methodB;
  methodA = _arg[0];
  methodB = _arg2[0];
  if (methodA < methodB) return -1;
  if (methodA === methodB) return 0;
  return 1;
};
