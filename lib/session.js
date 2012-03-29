var sessionFactory;

module.exports = function(store) {
  var fn, middleware;
  fn = function(req, res, next) {
    if (!req.session) throw 'Missing session middleware';
    fn = sessionFactory(store);
    return fn(req, res, next);
  };
  middleware = function(req, res, next) {
    return fn(req, res, next);
  };
  middleware._setStore = function(_store) {
    return store = _store;
  };
  return middleware;
};

sessionFactory = function(store) {
  return function(req, res, next) {
    var model, sid;
    sid = req.sessionID;
    sid = sid.substr(0, sid.indexOf('.'));
    model = req.model || (req.model = store.createModel());
    return model.subscribe("sessions." + sid, function(err, session) {
      model.ref('_session', session);
      return next();
    });
  };
};