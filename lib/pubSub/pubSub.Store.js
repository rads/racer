var createAdapter, deserialize, fetchPathData, fetchQueryData, finishAfter, lookup, patternMatchingDatum, queryPubSub, racer, sendToPubSub, splitPath, _ref;

_ref = require('../path'), splitPath = _ref.split, lookup = _ref.lookup;

finishAfter = require('../util/async').finishAfter;

deserialize = (queryPubSub = require('./queryPubSub')).deserialize;

createAdapter = require('../adapters').createAdapter;

racer = require('../racer');

module.exports = {
  type: 'Store',
  events: {
    init: function(store, opts) {
      var clientSockets, journal, liveQueries, pubSub;
      pubSub = store._pubSub = createAdapter('pubSub', opts.pubSub || {
        type: 'Memory'
      });
      store._liveQueries = liveQueries = {};
      store._clientSockets = clientSockets = {};
      journal = store._journal;
      pubSub.on('noSubscribers', function(path) {
        return delete liveQueries[path];
      });
      pubSub.on('message', function(clientId, _arg) {
        var data, type;
        type = _arg[0], data = _arg[1];
        return pubSub.emit(type, clientId, data);
      });
      return ['addDoc', 'rmDoc'].forEach(function(message) {
        return pubSub.on(message, function(clientId, data) {
          return journal.nextTxnNum(clientId, function(err, num) {
            if (err) throw err;
            return clientSockets[clientId].emit(message, data, num);
          });
        });
      });
    },
    socket: function(store, socket, clientId) {
      store._clientSockets[clientId] = socket;
      socket.on('disconnect', function() {
        return delete store._clientSockets[clientId];
      });
      return socket.on('sub', function(clientId, targets, ver, clientStartId) {
        socket.on('disconnect', function() {
          store.unsubscribe(clientId);
          return store._journal.unregisterClient(clientId);
        });
        return store._checkVersion(socket, ver, clientStartId, function(err) {
          if (err) return socket.emit('fatalErr', err);
          socket.on('fetch', function(targets, callback) {
            return store.fetch(clientId, deserialize(targets), callback);
          });
          socket.on('subAdd', function(targets, callback) {
            return store.subscribe(clientId, deserialize(targets), callback);
          });
          socket.on('subRemove', function(targets, callback) {
            return store.unsubscribe(clientId, deserialize(targets), callback);
          });
          return sendToPubSub('subscribe', store, clientId, deserialize(targets));
        });
      });
    }
  },
  proto: {
    fetch: function(clientId, targets, callback) {
      var data, finish, target, _i, _len,
        _this = this;
      data = [];
      finish = finishAfter(targets.length, function(err) {
        var out;
        if (err) return callback(err);
        out = {
          data: data
        };
        _this._pubSub.emit('fetch', out, clientId, targets);
        return callback(null, out);
      });
      for (_i = 0, _len = targets.length; _i < _len; _i++) {
        target = targets[_i];
        if (target.isQuery) {
          fetchQueryData(this, target, function(path, datum, ver) {
            return data.push([path, datum, ver]);
          }, finish);
        } else {
          fetchPathData(this, target, function(path, datum, ver) {
            return data.push([path, datum, ver]);
          }, finish);
        }
      }
    },
    subscribe: function(clientId, targets, callback) {
      var data, finish;
      data = null;
      finish = finishAfter(2, function(err) {
        return callback(err, data);
      });
      sendToPubSub('subscribe', this, clientId, targets, finish);
      return this.fetch(clientId, targets, function(err, _data) {
        data = _data;
        return finish(err);
      });
    },
    unsubscribe: function(clientId, targets, callback) {
      return sendToPubSub('unsubscribe', this, clientId, targets, callback);
    },
    publish: function(path, type, data, meta) {
      var message;
      message = [type, data];
      queryPubSub.publish(this, path, message, meta);
      return this._pubSub.publish(path, message);
    },
    query: function(query, callback) {
      var db, dbQuery, liveQueries;
      db = this._db;
      liveQueries = this._liveQueries;
      dbQuery = new db.Query(query);
      return dbQuery.run(db, function(err, found) {
        var liveQuery;
        if (query.isPaginated && Array.isArray(found) && (liveQuery = liveQueries[query.hash()])) {
          liveQuery._paginatedCache = found;
        }
        return callback(err, found, db.version);
      });
    }
  }
};

sendToPubSub = function(method, store, clientId, targets, callback) {
  var channels, count, finish, numChannels, numQueries, queries, queue, target, _i, _len;
  if (targets) {
    channels = [];
    queries = [];
    for (_i = 0, _len = targets.length; _i < _len; _i++) {
      target = targets[_i];
      queue = target.isQuery ? queries : channels;
      queue.push(target);
    }
    numChannels = channels.length;
    numQueries = queries.length;
    count = numChannels && numQueries ? 2 : 1;
    finish = finishAfter(count, callback);
    if (numQueries) queryPubSub[method](store, clientId, queries, finish);
    if (numChannels) store._pubSub[method](clientId, channels, finish);
    return;
  }
  finish = finishAfter(2, callback);
  queryPubSub[method](store, clientId, null, finish);
  return store._pubSub[method](clientId, null, finish);
};

fetchPathData = function(store, path, eachDatumCb, onComplete) {
  var remainder, root, _ref2;
  _ref2 = splitPath(path), root = _ref2[0], remainder = _ref2[1];
  return store.get(root, function(err, datum, ver) {
    if (err) return onComplete(err);
    if (remainder == null) {
      eachDatumCb(path, datum, ver);
    } else {
      patternMatchingDatum(root, remainder, datum, function(fullPath, datum) {
        return eachDatumCb(fullPath, datum, ver);
      });
    }
    return onComplete(null);
  });
};

patternMatchingDatum = function(prefix, remainder, subDoc, eachDatumCb) {
  var appendToPrefix, newPrefix, newValue, property, value, _ref2, _results;
  _ref2 = splitPath(remainder), appendToPrefix = _ref2[0], remainder = _ref2[1];
  _results = [];
  for (property in subDoc) {
    value = subDoc[property];
    if (!(value.constructor === Object || Array.isArray(value))) continue;
    newPrefix = prefix + '.' + property + '.' + appendToPrefix;
    newValue = lookup(appendToPrefix, value);
    if (remainder == null) {
      _results.push(eachDatumCb(newPrefix, newValue));
    } else {
      _results.push(patternMatchingDatum(newPrefix, remainder, newValue, eachDatumCb));
    }
  }
  return _results;
};

fetchQueryData = function(store, query, eachDatumCb, finish) {
  return store.query(query, function(err, result, version) {
    var doc, path, _i, _len;
    if (err) return finish(err);
    if (Array.isArray(result)) {
      for (_i = 0, _len = result.length; _i < _len; _i++) {
        doc = result[_i];
        path = query.namespace + '.' + doc.id;
        eachDatumCb(path, doc, version);
      }
    } else if (result) {
      path = query.namespace + '.' + result.id;
      eachDatumCb(path, result, version);
    }
    return finish(null);
  });
};
