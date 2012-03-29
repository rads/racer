var DEFAULT_TIMEOUT, Serializer;

DEFAULT_TIMEOUT = 1000;

module.exports = Serializer = function(_arg) {
  var init, onTimeout, timeout;
  this.withEach = _arg.withEach, onTimeout = _arg.onTimeout, timeout = _arg.timeout, init = _arg.init;
  if (onTimeout) {
    if (timeout === void 0) timeout = DEFAULT_TIMEOUT;
    this._setWaiter = function() {
      var _this = this;
      if (this._waiter) return;
      return this._waiter = setTimeout(function() {
        onTimeout();
        return _this._clearWaiter();
      }, timeout);
    };
    this._clearWaiter = function() {
      if (this._waiter) {
        clearTimeout(this._waiter);
        return this._waiter = null;
      }
    };
  }
  this._pending = {};
  this._index = init != null ? init : 1;
};

Serializer.prototype = {
  _clearWaiter: function() {},
  _setWaiter: function() {},
  add: function(msg, msgIndex, arg) {
    var index, pending;
    index = this._index;
    if (msgIndex > index) {
      this._pending[msgIndex] = msg;
      this._setWaiter();
      return true;
    }
    if (msgIndex < index) return false;
    this.withEach(msg, index, arg);
    this._clearWaiter();
    index++;
    pending = this._pending;
    while (msg = pending[index]) {
      this.withEach(msg, index, arg);
      delete pending[index++];
    }
    this._index = index;
    return true;
  },
  setIndex: function(_index) {
    this._index = _index;
  },
  clearPending: function() {
    var i, index, pending, _results;
    index = this._index;
    pending = this._pending;
    _results = [];
    for (i in pending) {
      if (i < index) {
        _results.push(delete pending[i]);
      } else {
        _results.push(void 0);
      }
    }
    return _results;
  }
};
