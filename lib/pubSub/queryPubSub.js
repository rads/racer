var LiveQuery, Memory, applyTxn, deepCopy, deserializeQuery, memory, publish, transaction,
  __slice = Array.prototype.slice;

console.assert(require('../util').isServer);

Memory = require('../Memory');

transaction = require('../transaction.server');

deepCopy = require('../util').deepCopy;

LiveQuery = require('./LiveQuery');

deserializeQuery = require('./Query').deserialize;

module.exports = {
  deserialize: function(targets) {
    var i, target, _len;
    for (i = 0, _len = targets.length; i < _len; i++) {
      target = targets[i];
      if (Array.isArray(target)) targets[i] = deserializeQuery(target);
    }
    return targets;
  },
  subscribe: function(store, subscriberId, queries, callback) {
    var channels, hash, liveQueries, query, _i, _len;
    liveQueries = store._liveQueries;
    channels = [];
    for (_i = 0, _len = queries.length; _i < _len; _i++) {
      query = queries[_i];
      hash = query.hash();
      channels.push("$q." + hash);
      liveQueries[hash] || (liveQueries[hash] = new LiveQuery(query));
    }
    return store._pubSub.subscribe(subscriberId, channels, callback, true);
  },
  unsubscribe: function(store, subscriberId, queries, callback) {
    var channels, hash, query, _i, _len;
    if (queries) {
      channels = [];
      for (_i = 0, _len = queries.length; _i < _len; _i++) {
        query = queries[_i];
        hash = query.hash();
        channels.push("$q." + hash);
      }
    } else {
      channels = null;
    }
    return store._pubSub.unsubscribe(subscriberId, channels, callback, true);
  },
  publish: function(store, path, message, meta) {
    var newDoc, origDoc, txn;
    if (message[0] !== 'txn' || path.slice(0, 3) === '$q.') return;
    if (origDoc = meta.origDoc) {
      txn = message[1];
      if (origDoc) {
        newDoc = deepCopy(origDoc);
      } else {
        newDoc = transaction.getArgs(txn)[1];
      }
      newDoc = applyTxn(txn, newDoc);
      publish(store, message, origDoc, newDoc);
    } else {
      publish(store, message, meta);
    }
  }
};

publish = function(store, message, origDoc, newDoc) {
  var doc, hash, liveQueries, nsPlusId, parts, pseudoVer, pubSub, query, queryChannel, txn, txnId, txnNs, txnPath, txnVer, _ref;
  txn = message[1];
  txnVer = transaction.getVer(txn);
  pseudoVer = function() {
    return txnVer += 0.01;
  };
  txnPath = transaction.getPath(txn);
  _ref = parts = txnPath.split('.'), txnNs = _ref[0], txnId = _ref[1];
  nsPlusId = txnNs + '.' + txnId;
  liveQueries = store._liveQueries;
  pubSub = store._pubSub;
  if (transaction.getMethod(txn) === 'set' && parts.length === 2) {
    doc = transaction.getArgs(txn)[1];
    for (hash in liveQueries) {
      query = liveQueries[hash];
      queryChannel = "$q." + hash;
      if (query.isPaginated) {
        if (!query.testWithoutPaging(doc, nsPlusId)) continue;
        query.updateCache(store, function(err, newMembers, oldMembers, ver) {
          var mem, _i, _j, _len, _len2, _results;
          if (err) throw err;
          for (_i = 0, _len = newMembers.length; _i < _len; _i++) {
            mem = newMembers[_i];
            pubSub.publish(queryChannel, [
              'addDoc', {
                ns: txnNs,
                doc: mem,
                ver: pseudoVer()
              }
            ]);
          }
          _results = [];
          for (_j = 0, _len2 = oldMembers.length; _j < _len2; _j++) {
            mem = oldMembers[_j];
            _results.push(pubSub.publish(queryChannel, [
              'rmDoc', {
                ns: txnNs,
                doc: mem,
                hash: hash,
                id: mem.id,
                ver: pseudoVer()
              }
            ]));
          }
          return _results;
        });
      }
      if (!query.test(doc, nsPlusId)) continue;
      if (!query.isPaginated || (query.isPaginated && query.isCacheImpactedByTxn(txn))) {
        pubSub.publish(queryChannel, message);
      }
    }
    return;
  }
  for (hash in liveQueries) {
    query = liveQueries[hash];
    queryChannel = "$q." + hash;
    if (query.isPaginated) {
      if (query.testWithoutPaging(origDoc, nsPlusId) || query.testWithoutPaging(newDoc, nsPlusId)) {
        query.updateCache(store, function(err, newMembers, oldMembers, ver) {
          var mem, _i, _j, _len, _len2;
          if (err) throw err;
          for (_i = 0, _len = newMembers.length; _i < _len; _i++) {
            mem = newMembers[_i];
            pubSub.publish(queryChannel, [
              'addDoc', {
                ns: txnNs,
                doc: mem,
                ver: pseudoVer()
              }
            ]);
          }
          for (_j = 0, _len2 = oldMembers.length; _j < _len2; _j++) {
            mem = oldMembers[_j];
            pubSub.publish(queryChannel, [
              'rmDoc', {
                ns: txnNs,
                doc: mem,
                hash: hash,
                id: mem.id,
                ver: pseudoVer()
              }
            ]);
          }
          if (query.isCacheImpactedByTxn(txn)) {
            pubSub.publish(queryChannel, message);
          }
        });
      }
    } else if (query.test(origDoc, nsPlusId)) {
      if (query.test(newDoc, nsPlusId)) {
        pubSub.publish(queryChannel, message);
      } else {
        pubSub.publish(queryChannel, [
          'rmDoc', {
            ns: txnNs,
            doc: newDoc,
            hash: hash,
            id: origDoc.id,
            ver: pseudoVer()
          }
        ]);
      }
    } else if (query.test(newDoc, nsPlusId)) {
      pubSub.publish(queryChannel, [
        'addDoc', {
          ns: txnNs,
          doc: newDoc,
          ver: pseudoVer()
        }
      ]);
      pubSub.publish(queryChannel, message);
    }
  }
};

memory = new Memory;

memory.setVersion = function() {};

applyTxn = function(txn, doc) {
  var args, data, id, method, ns, path, world, _ref;
  method = transaction.getMethod(txn);
  args = transaction.getArgs(txn);
  path = transaction.getPath(txn);
  if (method === 'del' && path.split('.').length === 2) return;
  _ref = path.split('.'), ns = _ref[0], id = _ref[1];
  world = {};
  world[ns] = {};
  world[ns][id] = doc;
  data = {
    world: world
  };
  try {
    memory[method].apply(memory, __slice.call(args).concat([-1], [data]));
  } catch (err) {

  }
  return doc;
};