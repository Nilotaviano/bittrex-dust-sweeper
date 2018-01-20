var bittrex = require('node-bittrex-api');

bittrex.options({
    'apikey': process.env.APIKEY,
    'apisecret': process.env.APISECRET,
    'stream': false,
    'verbose': false,
    'cleartext': false,
    'requestTimeoutInSeconds': 120
});

function adaptCallback(callback) {
  return (data, error) => {
    if (!error && data.success)
      callback(data);
    else {
      if (error.error)
        error = error.error;

      if (!data) // In some errors (like timeout), data is null
        data = { 'success': false };

      data.message = data.error = error.message || error || data.message;

      callback(data);
    }
  };
}

function cancelorder(options, callback) {
  bittrex.cancel(options, adaptCallback(callback));
}

function getorderbook(options, callback) {
  if (!options.type)
    options.type = 'both';

  bittrex.getorderbook(options, adaptCallback(callback));
}

function buylimit(options, callback) {
  bittrex.buylimit(options, adaptCallback(callback));
}

function selllimit(options, callback) {
  bittrex.selllimit(options, adaptCallback(callback));
}

function getorder(options, callback) {
  bittrex.getorder(options, adaptCallback(callback));
}

function getbalances(callback) {
  bittrex.getbalances(adaptCallback(callback));
}

function getbalance(options, callback) {
  bittrex.getbalance(options, adaptCallback(callback));
}

function getmarkets(callback) {
  bittrex.getmarkets(adaptCallback(callback));
}

function getmarketsummaries(callback) {
  bittrex.getmarketsummaries(adaptCallback(callback));
}

function getMinimumTrade(baseMarket) {
    return 0.00050000;
}

module.exports = {
    getorderbook,
    cancelorder,
    buylimit,
    selllimit,
    getorder,
    getbalances,
    getbalance,
    getmarkets,
    getmarketsummaries,
    defaultFee: 0.25 / 100, // 0.25%
    getMinimumTrade
};