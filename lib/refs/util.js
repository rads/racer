
module.exports = {
  derefPath: function(data, to) {
    return (typeof data.$deref === "function" ? data.$deref() : void 0) || to;
  },
  lookupPath: function(path, props, i) {
    return [path].concat(props.slice(i)).join('.');
  }
};