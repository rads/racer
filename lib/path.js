
module.exports = {
  isPrivate: function(name) {
    return /(?:^_)|(?:\._)/.test(name);
  },
  eventRegExp: function(pattern) {
    if (pattern instanceof RegExp) {
      return pattern;
    } else {
      return new RegExp('^' + pattern.replace(/[,.*]/g, function(match, index) {
        if (match === '.') {
          return '\\.';
        } else if (match === ',') {
          return '|';
        } else if (pattern.length - index === 1) {
          return '(.+)';
        } else {
          return '([^.]+)';
        }
      }) + '$');
    }
  },
  regExp: function(pattern) {
    if (!pattern) {
      return /^/;
    } else {
      return new RegExp('^' + pattern.replace(/[.*]/g, function(match, index) {
        if (match === '.') {
          return '\\.';
        } else {
          return '[^.]+';
        }
      }) + '(?:\\.|$)');
    }
  },
  regExpPathOrParent: function(path) {
    var i, p, segment, source;
    p = '';
    source = ((function() {
      var _len, _ref, _results;
      _ref = path.split('.');
      _results = [];
      for (i = 0, _len = _ref.length; i < _len; i++) {
        segment = _ref[i];
        _results.push("(?:" + (p += i ? '\\.' + segment : segment) + ")");
      }
      return _results;
    })()).join('|');
    return new RegExp('^(?:' + source + ')$');
  },
  regExpPathsOrChildren: function(paths) {
    var path, source;
    source = ((function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = paths.length; _i < _len; _i++) {
        path = paths[_i];
        _results.push("(?:" + path + "(?:\\..+)?)");
      }
      return _results;
    })()).join('|');
    return new RegExp('^(?:' + source + ')$');
  },
  lookup: function(path, obj) {
    var parts, prop, _i, _len;
    if (path.indexOf('.') === -1) return obj[path];
    parts = path.split('.');
    for (_i = 0, _len = parts.length; _i < _len; _i++) {
      prop = parts[_i];
      if (obj == null) return;
      obj = obj[prop];
    }
    return obj;
  },
  assign: function(obj, path, val) {
    var i, lastIndex, parts, prop, _len;
    parts = path.split('.');
    lastIndex = parts.length - 1;
    for (i = 0, _len = parts.length; i < _len; i++) {
      prop = parts[i];
      if (i === lastIndex) {
        obj[prop] = val;
      } else {
        obj = obj[prop] || (obj[prop] = {});
      }
    }
  },
  split: function(path) {
    return path.split(/\.?[(*]\.?/);
  },
  expand: function(path) {
    var lastClosed, match, out, paths, pre, stack, token, val;
    path = path.replace(/[\s\n]/g, '');
    if (!~path.indexOf('(')) return [path];
    stack = {
      paths: paths = [''],
      out: out = []
    };
    while (path) {
      if (!(match = /^([^,()]*)([,()])(.*)/.exec(path))) {
        return (function() {
          var _i, _len, _results;
          _results = [];
          for (_i = 0, _len = out.length; _i < _len; _i++) {
            val = out[_i];
            _results.push(val + path);
          }
          return _results;
        })();
      }
      pre = match[1];
      token = match[2];
      path = match[3];
      if (pre) {
        paths = (function() {
          var _i, _len, _results;
          _results = [];
          for (_i = 0, _len = paths.length; _i < _len; _i++) {
            val = paths[_i];
            _results.push(val + pre);
          }
          return _results;
        })();
        if (token !== '(') out = lastClosed ? paths : out.concat(paths);
      }
      lastClosed = false;
      if (token === ',') {
        stack.out = stack.out.concat(paths);
        paths = stack.paths;
      } else if (token === '(') {
        stack = {
          parent: stack,
          paths: paths,
          out: out = []
        };
      } else if (token === ')') {
        lastClosed = true;
        paths = out = stack.out.concat(paths);
        stack = stack.parent;
      }
    }
    return out;
  },
  triplet: function(path) {
    var parts;
    parts = path.split('.');
    return [parts[0], parts[1], parts.slice(2).join('.')];
  },
  subPathToDoc: function(path) {
    return path.split('.').slice(0, 2).join('.');
  }
};