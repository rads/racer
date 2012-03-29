var ClientIdMongo, exports;

exports = module.exports = function(racer) {
  return racer.registerAdapter('clientId', 'Mongo', ClientIdMongo);
};

exports.useWith = {
  server: true,
  browser: false
};

ClientIdMongo = function(_options) {
  this._options = _options;
};

ClientIdMongo.prototype.generateFn = function() {
  var ObjectID;
  ObjectID = this._options.mongo.BSONPure.ObjectID;
  return function(callback) {
    var guid;
    try {
      guid = (new ObjectId).toString();
      callback(null, guid);
    } catch (e) {
      callback(e);
    }
  };
};