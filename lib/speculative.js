var merge;

merge = require('./util').merge;

module.exports = {
  createObject: function() {
    return {
      $spec: true
    };
  },
  createArray: function() {
    var obj;
    obj = [];
    obj.$spec = true;
    return obj;
  },
  create: function(proto) {
    var obj;
    if (proto.$spec) return proto;
    if (Array.isArray(proto)) {
      obj = proto.slice();
      obj.$spec = true;
      return obj;
    }
    return Object.create(proto, {
      $spec: {
        value: true
      }
    });
  },
  clone: function(proto) {
    var obj;
    if (Array.isArray(proto)) {
      obj = proto.slice();
      obj.$spec = true;
      return obj;
    }
    return merge({}, proto);
  },
  isSpeculative: function(obj) {
    return obj && obj.$spec;
  },
  identifier: '$spec'
};