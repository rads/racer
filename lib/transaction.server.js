var transaction;

transaction = module.exports = require('./transaction');

transaction.conflict = function(txnA, txnB) {
  var clientIdA, clientIdB, clientVerA, clientVerB, txnAId, _ref, _ref2;
  if (!transaction.pathConflict(transaction.getPath(txnA), transaction.getPath(txnB))) {
    return false;
  }
  txnAId = transaction.getId(txnA);
  if (txnAId.charAt(0) !== '#') {
    _ref = transaction.clientIdAndVer(txnA), clientIdA = _ref[0], clientVerA = _ref[1];
    _ref2 = transaction.clientIdAndVer(txnB), clientIdB = _ref2[0], clientVerB = _ref2[1];
    if (clientIdA === clientIdB) if (clientVerA > clientVerB) return false;
  }
  if (txnAId === transaction.getId(txnB)) return 'duplicate';
  return 'conflict';
};
