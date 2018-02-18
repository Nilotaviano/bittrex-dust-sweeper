'use strict'

let bittrex = require('./bittrex_adapter');

bittrex.getmarketsummaries(async (response) => {
  if (response.success && response.result && response.result.length > 0) {
    let marketsByCoin = {}; // Index markets by target coin

    for (let i in response.result) {
      let marketSummary = response.result[i];
      let splittedMarket = marketSummary.MarketName.split("-");

      let targetCoin = splittedMarket[1];
      let baseCoin = splittedMarket[0];

      if (!marketsByCoin.hasOwnProperty(targetCoin)) {
        marketsByCoin[targetCoin] = {};
      }

      let marketsOfTargetCoin = marketsByCoin[targetCoin];

      if (!marketsOfTargetCoin.hasOwnProperty(baseCoin)) {
        marketsOfTargetCoin[baseCoin] = marketSummary;
      }
    }

    await cleanMarketsWithBalance(marketsByCoin);
  }
  else {
    console.error("Error on getmarketsummaries:\n" + JSON.stringify(response));
  }
});

async function cleanMarketsWithBalance(marketsByCoin) {
  bittrex.getbalances(async (response) => {
    if (response.success && response.result && response.result.length > 0) {
      await sleep(10);
      cleanDust(response.result, marketsByCoin);
    }
    else {
      console.error("Error on getbalances:\n" + JSON.stringify(response));
    }
  });
}

async function cleanDust(balances, marketsByCoin) {
  for (let i = 0; i < balances.length; i++) {
    let balance = balances[i];

    if (balance.Available == 0)
      continue;
    else if (balance.Currency == "BTC")
      continue;
    else {
      let marketsOfTargetCoin = marketsByCoin[balance.Currency];

      if (!marketsOfTargetCoin) {
        console.log(`No market found for coin ${balance.Currency}`);
        continue;
      }

      let btcMarket = marketsOfTargetCoin["BTC"];

      if (!btcMarket) {
        console.log(`BTC market not found for coin ${balance.Currency}`);
        console.log(`Available balances are: `);
        console.log(JSON.stringify(marketsOfTargetCoin));
        continue;
      }

      if (!isWorthSweeping(btcMarket.Bid, balance.Available)) {
        console.log(`Sweeping ${balance.Currency} is not worth it`);
        continue;
      }

      await sweep(balance);
      await sleep(10);
    }
  }

  await sleep(1000 * 60 * 30); // Waits 30 minutes
}

async function sweep(balance) {
  return new Promise((resolve, reject) => {
    let targetMarket = `BTC-${balance.Currency}`

    bittrex.getorderbook({
      market: targetMarket,
      type: 'both',
      depth: 5
    }, async (response) => {
      await sleep(10);

      if (response.success && response.result && response.result.buy && response.result.buy.length > 0 && response.result.sell && response.result.sell.length > 0) {
        let orderbook = response.result;

        // The 5th order is used because we might have to buy up to that if there's not enough in the first few orders in the orderbook
        let rateToBeUsedWhenSelling = orderbook.buy[4].Rate;
        let rateToBeUsedWhenBuying = orderbook.sell[4].Rate;

        // Check if it's dust and, if it is, check if it would be worth sweeping
        if (isDust(rateToBeUsedWhenSelling, balance.Available) && isWorthSweeping(rateToBeUsedWhenSelling, balance.Available)) {
          let amountToBuy = round(bittrex.getMinimumTrade() / rateToBeUsedWhenSelling);

          bittrex.buylimit({
            market: targetMarket,
            quantity: amountToBuy,
            rate: rateToBeUsedWhenBuying
          }, async (response) => {
            await sleep(100);

            if (response.success && response.result) {
              let amoundToSell = balance.Available + amountToBuy;

              bittrex.selllimit({
                market: targetMarket,
                quantity: amoundToSell,
                rate: rateToBeUsedWhenSelling
              }, async (response) => {
                if (response.success && response.result) {
                  resolve();
                }
                else {
                  console.error(`Error on selllimit (${targetMarket}):\n${JSON.stringify(response)}`);
                  resolve();
                }
              });
            }
            else {
              console.error(`Error on buylimit (${targetMarket}):\n${JSON.stringify(response)}`);
              resolve();
            }
          });
        }
        else {
          resolve();
        }
      }
      else {
        console.error(`Error on getorderbook (${targetMarket}):\n${JSON.stringify(response)}`);
        resolve();
      }
    });
  });
}

function isDust(rateToBeUsedWhenSelling, availableBalance) {
  return rateToBeUsedWhenSelling * availableBalance < bittrex.getMinimumTrade();
}

// Check if the amount recovered from dust is bigger than the amount paid on fees
function isWorthSweeping(rateToBeUsedWhenSelling, availableBalance) {
  let availableBalanceConvertedToBaseCurrency = rateToBeUsedWhenSelling * availableBalance;
  let feesSpentOnBuying = bittrex.defaultFee * bittrex.getMinimumTrade();
  let feesSpentOnSelling = bittrex.defaultFee * (bittrex.getMinimumTrade() + availableBalanceConvertedToBaseCurrency);

  return availableBalanceConvertedToBaseCurrency > feesSpentOnBuying + feesSpentOnSelling;
}

function round(value) {
  let decimalPlaces = 8;
  let precision = Math.pow(10, decimalPlaces);

  let integerValue = Math.floor(value);
  let decimalValue = value - integerValue;

  let roundedDecimalValue = Math.ceil(decimalValue * precision) / precision;

  let result = integerValue + roundedDecimalValue;

  return result;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}