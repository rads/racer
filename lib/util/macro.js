var compile, condition, existsSync, files, fs, join, normalize, watch, _ref;

fs = require('fs');

_ref = require('path'), normalize = _ref.normalize, join = _ref.join, existsSync = _ref.existsSync;

exports.files = files = function(dir, extension, out) {
  if (out == null) out = [];
  fs.readdirSync(dir).forEach(function(p) {
    p = join(dir, p);
    if (fs.statSync(p).isDirectory()) {
      return files(p, extension, out);
    } else if (extension.test(p)) {
      return out.push(p);
    }
  });
  return out;
};

exports.watch = watch = function(dir, extension, onChange) {
  var options;
  options = {
    interval: 100
  };
  return files(dir, extension).forEach(function(file) {
    return fs.watchFile(file, options, function(curr, prev) {
      if (prev.mtime < curr.mtime) return onChange(file);
    });
  });
};

condition = function(s) {
  return s.replace(/\s+or\s+/g, "' || def == '").replace(/\s+and\s+/g, "' && def == '");
};

exports.compile = compile = function(filename) {
  var content, defs, line, match, script, warn, _i, _len, _ref2;
  console.log('Compiling macro: ' + filename);
  content = fs.readFileSync(filename, 'utf8');
  warn = "##  WARNING:\\n" + "##  ========\\n" + "##  This file was compiled from a macro.\\n" + "##  Do not edit it directly.\\n\\n";
  script = "(function(){var out = '" + warn + "';";
  _ref2 = content.split('\n');
  for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
    line = _ref2[_i];
    if (~line.indexOf('#end')) {
      script += "}";
    } else if (match = /#if\s+(.*)/.exec(line)) {
      script += "if (def == '" + (condition(match[1])) + "') {";
    } else if (match = /#elseif\s+(.*)/.exec(line)) {
      script += "} else if (def == '" + (condition(match[1])) + "') {";
    } else if (~line.indexOf('#else')) {
      script += "} else {";
    } else if (match = /#for\s+(.*)/.exec(line)) {
      defs = "['" + match[1].replace(/\s+/g, "','") + "']";
      script += "for (var defs = " + defs + ", i = 0; def = defs[i++];) {";
    } else {
      line = line.replace(/'/g, "\\'");
      script += "out += '" + line + "\\n';";
    }
  }
  script += "return out;})()";
  content = eval(script);
  if (!existsSync('./dev')) fs.mkdirSync('./dev');
  filename = (filename.slice(0, -6) + '.coffee').replace('/racer/src/', '/racer/dev/');
  return fs.writeFileSync(filename, content, 'utf8');
};