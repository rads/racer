var finishAfter;

module.exports = {
  finishAfter: finishAfter = function(count, callback) {
    var err;
    callback || (callback = function(err) {
      if (err) throw err;
    });
    if (!count) return callback;
    err = null;
    return function(_err) {
      err || (err = _err);
      return --count || callback(err);
    };
  },
  forEach: function(items, fn, done) {
    var finish, item, _i, _len;
    finish = finishAfter(items.length, done);
    for (_i = 0, _len = items.length; _i < _len; _i++) {
      item = items[_i];
      fn(item, finish);
    }
  },
  bufferifyMethods: function(Klass, methodNames, _arg) {
    var await, fns;
    await = _arg.await;
    fns = {};
    methodNames.forEach(function(methodName) {
      fns[methodName] = Klass.prototype[methodName];
      return Klass.prototype[methodName] = function() {
        var didFlush, flush, _arguments,
          _this = this;
        _arguments = arguments;
        didFlush = false;
        flush = function() {
          var args, buffer, _i, _len;
          didFlush = true;
          methodNames.forEach(function(methodName) {
            return _this[methodName] = fns[methodName];
          });
          delete await.alredyCalled;
          if (!buffer) return;
          for (_i = 0, _len = buffer.length; _i < _len; _i++) {
            args = buffer[_i];
            fns[methodName].apply(_this, args);
          }
          buffer = null;
        };
        if (await.alredyCalled) return;
        await.alredyCalled = true;
        await.call(this, flush);
        if (didFlush) return this[methodName].apply(this, _arguments);
        this[methodName] = function() {
          buffer || (buffer = []);
          return buffer.push(arguments);
        };
        this[methodName].apply(this, arguments);
      };
    });
    return {
      bufferify: function(methodName, _arg2) {
        var await, buffer, fn;
        fn = _arg2.fn, await = _arg2.await;
        buffer = null;
        return function() {
          var didFlush, flush, _arguments,
            _this = this;
          _arguments = arguments;
          didFlush = false;
          flush = function() {
            var args, _i, _len;
            didFlush = true;
            _this[methodName] = fn;
            if (!buffer) return;
            for (_i = 0, _len = buffer.length; _i < _len; _i++) {
              args = buffer[_i];
              fn.apply(_this, args);
            }
            buffer = null;
          };
          await.call(this, flush);
          if (didFlush) return this[methodName].apply(this, _arguments);
          this[methodName] = function() {
            buffer || (buffer = []);
            return buffer.push(arguments);
          };
          this[methodName].apply(this, arguments);
        };
      }
    };
  }
};