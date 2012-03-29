var LiveQuery, compileDocFilter, compileSortComparator, deepEqual, deepIndexOf, evalToTrue, indexOf, lookup, transaction, _ref,
  __slice = Array.prototype.slice;

lookup = require('../path').lookup;

transaction = require('../transaction');

_ref = require('../util'), indexOf = _ref.indexOf, deepIndexOf = _ref.deepIndexOf, deepEqual = _ref.deepEqual;

module.exports = LiveQuery = function(query) {
  var args, method, _i, _len, _ref2, _ref3;
  this.query = query;
  this._predicates = [];
  _ref2 = query._calls;
  for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
    _ref3 = _ref2[_i], method = _ref3[0], args = _ref3[1];
    this[method].apply(this, args);
  }
};

LiveQuery.prototype = {
  from: function(namespace) {
    this.namespace = namespace;
    this._predicates.push(function(doc, channel) {
      var docNs;
      docNs = channel.slice(0, channel.indexOf('.'));
      return namespace === docNs;
    });
    return this;
  },
  testWithoutPaging: function(doc, channel) {
    this.testWithoutPaging = compileDocFilter(this._predicates);
    return this.testWithoutPaging(doc, channel);
  },
  test: function(doc, channel) {
    return this.testWithoutPaging(doc, channel);
  },
  byKey: function(keyVal) {
    this._predicates.push(function(doc, channel) {
      var id, ns, _ref2;
      _ref2 = channel.split('.'), ns = _ref2[0], id = _ref2[1];
      return id === keyVal;
    });
    return this;
  },
  where: function(_currProp) {
    this._currProp = _currProp;
    return this;
  },
  equals: function(val) {
    var currProp;
    currProp = this._currProp;
    this._predicates.push(function(doc) {
      var currVal;
      currVal = lookup(currProp, doc);
      if (typeof currVal === 'object') return deepEqual(currVal, val);
      return currVal === val;
    });
    return this;
  },
  notEquals: function(val) {
    var currProp;
    currProp = this._currProp;
    this._predicates.push(function(doc) {
      return lookup(currProp, doc) !== val;
    });
    return this;
  },
  gt: function(val) {
    var currProp;
    currProp = this._currProp;
    this._predicates.push(function(doc) {
      return lookup(currProp, doc) > val;
    });
    return this;
  },
  gte: function(val) {
    var currProp;
    currProp = this._currProp;
    this._predicates.push(function(doc) {
      return lookup(currProp, doc) >= val;
    });
    return this;
  },
  lt: function(val) {
    var currProp;
    currProp = this._currProp;
    this._predicates.push(function(doc) {
      return lookup(currProp, doc) < val;
    });
    return this;
  },
  lte: function(val) {
    var currProp;
    currProp = this._currProp;
    this._predicates.push(function(doc) {
      return lookup(currProp, doc) <= val;
    });
    return this;
  },
  within: function(list) {
    var currProp;
    currProp = this._currProp;
    this._predicates.push(function(doc) {
      return -1 !== list.indexOf(lookup(currProp, doc));
    });
    return this;
  },
  contains: function(list) {
    var currProp;
    currProp = this._currProp;
    this._predicates.push(function(doc) {
      var docList, x, _i, _len;
      docList = lookup(currProp, doc);
      if (docList === void 0) {
        if (list.length) return false;
        return true;
      }
      for (_i = 0, _len = list.length; _i < _len; _i++) {
        x = list[_i];
        if (x.constructor === Object) {
          if (-1 === deepIndexOf(docList, x)) return false;
        } else {
          if (-1 === docList.indexOf(x)) return false;
        }
      }
      return true;
    });
    return this;
  },
  only: function() {
    var path, paths, _i, _len;
    paths = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    if (this._except) {
      throw new Error("You cannot specify both query(...).except(...) and query(...).only(...)");
    }
    this._only || (this._only = {});
    for (_i = 0, _len = paths.length; _i < _len; _i++) {
      path = paths[_i];
      this._only[path] = 1;
    }
    return this;
  },
  except: function() {
    var path, paths, _i, _len;
    paths = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    if (this._only) {
      throw new Error("You cannot specify both query(...).except(...) and query(...).only(...)");
    }
    this._except || (this._except = {});
    for (_i = 0, _len = paths.length; _i < _len; _i++) {
      path = paths[_i];
      this._except[path] = 1;
    }
    return this;
  },
  limit: function(_limit) {
    this._limit = _limit;
    this.isPaginated = true;
    this._paginatedCache || (this._paginatedCache = []);
    return this;
  },
  skip: function(skip) {
    this.isPaginated = true;
    this._paginatedCache || (this._paginatedCache = []);
    return this;
  },
  sort: function() {
    var params;
    params = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    if (this._sort && this._sort.length) {
      this._sort = this._sort.concat(params);
    } else {
      this._sort = params;
    }
    this._comparator = compileSortComparator(this._sort);
    return this;
  },
  beforeOrAfter: function(doc) {
    var comparator;
    comparator = this._comparator;
    if (-1 === comparator(doc, this._paginatedCache[0])) return 'before';
    if (1 === comparator(doc, this._paginatedCache[this._paginatedCache.length - 1])) {
      return 'after';
    }
    return 'curr';
  },
  updateCache: function(store, callback) {
    var cache,
      _this = this;
    cache = this._paginatedCache;
    return store.query(this.query, function(err, found, ver) {
      var added, removed, x, _i, _j, _len, _len2;
      if (err) return callback(err);
      removed = [];
      added = [];
      for (_i = 0, _len = cache.length; _i < _len; _i++) {
        x = cache[_i];
        if (-1 === indexOf(found, x, function(y, z) {
          return y.id === z.id;
        })) {
          removed.push(x);
        }
      }
      for (_j = 0, _len2 = found.length; _j < _len2; _j++) {
        x = found[_j];
        if (-1 === indexOf(cache, x, function(y, z) {
          return y.id === z.id;
        })) {
          added.push(x);
        }
      }
      _this._paginatedCache = found;
      return callback(null, added, removed, ver);
    });
  },
  isCacheImpactedByTxn: function(txn) {
    var cache, id, ns, x, _i, _len, _ref2;
    _ref2 = transaction.getPath(txn).split('.'), ns = _ref2[0], id = _ref2[1];
    if (ns !== this.namespace) return false;
    cache = this._paginatedCache;
    for (_i = 0, _len = cache.length; _i < _len; _i++) {
      x = cache[_i];
      if (x.id === id) return true;
    }
    return false;
  }
};

evalToTrue = function() {
  return true;
};

compileDocFilter = function(predicates) {
  switch (predicates.length) {
    case 0:
      return evalToTrue;
    case 1:
      return predicates[0];
  }
  return function(doc, channel) {
    var pred, _i, _len;
    if (doc === void 0) return false;
    for (_i = 0, _len = predicates.length; _i < _len; _i++) {
      pred = predicates[_i];
      if (!pred(doc, channel)) return false;
    }
    return true;
  };
};

compileSortComparator = function(sortParams) {
  return function(a, b) {
    var aVal, bVal, factor, i, path, _len, _step;
    for (i = 0, _len = sortParams.length, _step = 2; i < _len; i += _step) {
      path = sortParams[i];
      factor = (function() {
        switch (sortParams[i + 1]) {
          case 'asc':
            return 1;
          case 'desc':
            return -1;
          default:
            throw new Error('Must be "asc" or "desc"');
        }
      })();
      aVal = lookup(path, a);
      bVal = lookup(path, b);
      if (aVal < bVal) {
        return -1 * factor;
      } else if (aVal > bVal) {
        return factor;
      }
    }
    return 0;
  };
};