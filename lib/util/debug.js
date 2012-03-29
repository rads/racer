var coffee, fs, tags,
  __slice = Array.prototype.slice;

fs = require('fs');

coffee = require('coffee-script');

tags = [];

require.extensions['.coffee'] = function(module, filename) {
  var content, re;
  content = fs.readFileSync(filename, 'utf8');
  if (!tags.length) {
    re = /# *debug: */gm;
  } else {
    re = new RegExp("# *debug (" + (tags.join('|')) + "): *", 'gm');
  }
  content = content.replace(re, '');
  content = coffee.compile(content, {
    filename: filename
  });
  return module._compile(content, filename);
};

module.exports = function() {
  var _tags;
  _tags = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
  return tags = tags.concat(_tags);
};
