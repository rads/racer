var Promise, finishAfter;

finishAfter = require('./util/async').finishAfter;

Promise = module.exports = function() {
  this.callbacks = [];
  this.resolved = false;
};

Promise.prototype = {
  resolve: function(err, value) {
    var callback, _i, _len, _ref;
    this.err = err;
    this.value = value;
    if (this.resolved) throw new Error('Promise has already been resolved');
    this.resolved = true;
    _ref = this.callbacks;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      callback = _ref[_i];
      callback(err, value);
    }
    this.callbacks = [];
    return this;
  },
  on: function(callback) {
    if (this.resolved) {
      callback(this.err, this.value);
      return this;
    }
    this.callbacks.push(callback);
    return this;
  },
  clear: function() {
    this.resolved = false;
    delete this.value;
    delete this.err;
    return this;
  }
};

Promise.parallel = function(promises) {
  var composite, finish, i;
  composite = new Promise;
  i = promises.length;
  finish = finishAfter(i, function(err) {
    return composite.resolve(err);
  });
  while (i--) {
    promises[i].on(finish);
  }
  return composite;
};