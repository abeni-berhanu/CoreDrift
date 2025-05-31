// Trade calculation helpers for CoreDrift

// Helper to recalculate derived fields for trade detail modal
export function recalculateTradeFields(form, initialBalance = 100000) {
  const entryPrice = parseFloat(form.entryPrice);
  const exitPrice = parseFloat(form.exitPrice);
  const sl = parseFloat(form.sl);
  const volume = parseFloat(form.volume);
  const netPnL = parseFloat(form.netPnL);
  let entryTimestamp = form.entryTimestamp;
  let exitTimestamp = form.exitTimestamp;

  // Handle timestamp conversions
  if (
    entryTimestamp &&
    typeof entryTimestamp === "object" &&
    entryTimestamp.seconds !== undefined
  ) {
    entryTimestamp = new Date(entryTimestamp.seconds * 1000);
  } else if (entryTimestamp instanceof Date) {
    // ok
  } else if (typeof entryTimestamp === "string" && entryTimestamp) {
    entryTimestamp = new Date(entryTimestamp);
  } else {
    entryTimestamp = null;
  }

  if (
    exitTimestamp &&
    typeof exitTimestamp === "object" &&
    exitTimestamp.seconds !== undefined
  ) {
    exitTimestamp = new Date(exitTimestamp.seconds * 1000);
  } else if (exitTimestamp instanceof Date) {
    // ok
  } else if (typeof exitTimestamp === "string" && exitTimestamp) {
    exitTimestamp = new Date(exitTimestamp);
  } else {
    exitTimestamp = null;
  }

  // Get symbol properties
  const selectedSymbol = form.symbol
    ? {
        pipSize: form.pipSize || 0.0001,
        pipValuePerLot: form.pipValuePerLot || 10,
      }
    : null;

  // Calculate risk amount using pip size and value per lot
  let riskAmount = null;
  if (
    entryPrice !== undefined &&
    !isNaN(entryPrice) &&
    sl !== undefined &&
    !isNaN(sl) &&
    volume !== undefined &&
    !isNaN(volume) &&
    selectedSymbol
  ) {
    const pipCount = Math.abs(entryPrice - sl) / selectedSymbol.pipSize;
    riskAmount = pipCount * selectedSymbol.pipValuePerLot * volume;
    riskAmount = Number(riskAmount.toFixed(2));
  }

  // Duration
  let duration = null;
  if (
    entryTimestamp &&
    exitTimestamp &&
    !isNaN(entryTimestamp) &&
    !isNaN(exitTimestamp)
  ) {
    duration = Math.round((exitTimestamp - entryTimestamp) / 60000);
  }

  // Session
  let session = "";
  if (entryTimestamp instanceof Date && !isNaN(entryTimestamp)) {
    const hour = entryTimestamp.getUTCHours();
    if (hour >= 13 && hour < 21) session = "NY";
    else if (hour >= 7 && hour < 16) session = "LN";
    else session = "AS";
  }

  // Risk to Reward
  let riskToReward = null;
  if (
    netPnL !== undefined &&
    !isNaN(netPnL) &&
    riskAmount !== null &&
    riskAmount !== 0
  ) {
    riskToReward = netPnL / riskAmount;
    riskToReward = Number(riskToReward.toFixed(2));
  }

  // Percent Risk
  let percentRisk = null;
  if (riskAmount !== null && initialBalance) {
    percentRisk = (riskAmount / initialBalance) * 100;
    percentRisk = Number(percentRisk.toFixed(2));
  }

  // Percent PnL
  let percentPnL = null;
  if (netPnL !== undefined && !isNaN(netPnL) && initialBalance) {
    percentPnL = (netPnL / initialBalance) * 100;
    percentPnL = Number(percentPnL.toFixed(2));
  }

  // Status
  let status = "";
  if (riskToReward !== null) {
    if (riskToReward > 0.15) status = "WIN";
    else if (riskToReward < -0.15) status = "LOSS";
    else status = "BE";
  }

  return {
    ...form,
    riskAmount,
    duration,
    session,
    riskToReward,
    percentRisk,
    percentPnL,
    status,
  };
}

// Helper to recalculate derived fields for upload modal
export function recalculateTradeFieldsUpload(trade, initialBalance = 100000) {
  const entryPrice = parseFloat(trade.entryPrice);
  const exitPrice = parseFloat(trade.exitPrice);
  const sl = parseFloat(trade.sl);
  const volume = parseFloat(trade.volume);
  const netPnL = parseFloat(trade.netPnL);
  let openTime = trade.openTime;
  let closeTime = trade.closeTime;

  if (openTime && typeof openTime === "string") openTime = new Date(openTime);
  if (closeTime && typeof closeTime === "string")
    closeTime = new Date(closeTime);

  // Get symbol properties
  const selectedSymbol = trade.symbol
    ? {
        pipSize: trade.pipSize || 0.0001,
        pipValuePerLot: trade.pipValuePerLot || 10,
      }
    : null;

  // Calculate risk amount using pip size and value per lot
  let riskAmount = null;
  if (
    entryPrice !== undefined &&
    !isNaN(entryPrice) &&
    sl !== undefined &&
    !isNaN(sl) &&
    volume !== undefined &&
    !isNaN(volume) &&
    selectedSymbol
  ) {
    const pipCount = Math.abs(entryPrice - sl) / selectedSymbol.pipSize;
    riskAmount = pipCount * selectedSymbol.pipValuePerLot * volume;
    riskAmount = Number(riskAmount.toFixed(2));
  }

  let duration = null;
  if (openTime && closeTime && !isNaN(openTime) && !isNaN(closeTime)) {
    duration = Math.round((closeTime - openTime) / 60000);
  }

  let session = "";
  if (openTime instanceof Date && !isNaN(openTime)) {
    const hour = openTime.getUTCHours();
    if (hour >= 13 && hour < 21) session = "NY";
    else if (hour >= 7 && hour < 16) session = "LN";
    else session = "AS";
  }

  // Calculate riskToReward first
  let riskToReward = null;
  if (
    netPnL !== undefined &&
    !isNaN(netPnL) &&
    riskAmount !== null &&
    riskAmount !== 0
  ) {
    riskToReward = netPnL / riskAmount;
    riskToReward = Number(riskToReward.toFixed(2));
  }

  let percentRisk = null;
  if (riskAmount !== null && initialBalance) {
    percentRisk = (riskAmount / initialBalance) * 100;
    percentRisk = Number(percentRisk.toFixed(2));
  }

  let percentPnL = null;
  if (netPnL !== undefined && !isNaN(netPnL) && initialBalance) {
    percentPnL = (netPnL / initialBalance) * 100;
    percentPnL = Number(percentPnL.toFixed(2));
  }

  // Now calculate status using the freshly calculated riskToReward
  let status = "";
  if (riskToReward !== null) {
    if (riskToReward > 0.15) status = "WIN";
    else if (riskToReward < -0.15) status = "LOSS";
    else status = "BE";
  }

  return {
    ...trade,
    riskAmount,
    duration,
    session,
    riskToReward,
    percentRisk,
    percentPnL,
    status,
  };
}

// Trade Log Summary Stat Calculations

/**
 * Calculate Net Cumulative P&L
 * @param {Array} trades
 * @returns {number}
 */
export function calcNetCumulativePnL(trades) {
  return trades.reduce(
    (sum, trade) => sum + (Number(trade.netPnL ?? trade.netPL) || 0),
    0
  );
}

/**
 * Calculate Profit Factor
 * @param {Array} trades
 * @returns {number|string}
 */
export function calcProfitFactor(trades) {
  const grossProfit = trades
    .filter(
      (t) =>
        (t.status === "WIN" || t.status === "win") &&
        Number(t.netPnL ?? t.netPL) > 0
    )
    .reduce((sum, t) => sum + Number(t.netPnL ?? t.netPL), 0);
  const grossLoss = Math.abs(
    trades
      .filter(
        (t) =>
          (t.status === "LOSS" || t.status === "loss") &&
          Number(t.netPnL ?? t.netPL) < 0
      )
      .reduce((sum, t) => sum + Number(t.netPnL ?? t.netPL), 0)
  );
  if (grossLoss === 0) return grossProfit > 0 ? "∞" : "N/A";
  return (grossProfit / grossLoss).toFixed(2);
}

/**
 * Calculate Win Percentage
 * @param {Array} trades
 * @returns {string}
 */
export function calcWinPercentage(trades) {
  const winningTrades = trades.filter(
    (t) => t.status === "WIN" || t.status === "win"
  ).length;
  const losingTrades = trades.filter(
    (t) => t.status === "LOSS" || t.status === "loss"
  ).length;
  const totalConsidered = winningTrades + losingTrades;
  if (totalConsidered === 0) return "0%";
  return `${((winningTrades / totalConsidered) * 100).toFixed(2)}%`;
}

/**
 * Calculate Average Win/Loss Ratio
 * @param {Array} trades
 * @returns {string}
 */
export function calcAvgWinLossRatio(trades) {
  const winningTrades = trades.filter(
    (t) =>
      (t.status === "WIN" || t.status === "win") &&
      Number(t.netPnL ?? t.netPL) > 0
  );
  const losingTrades = trades.filter(
    (t) =>
      (t.status === "LOSS" || t.status === "loss") &&
      Number(t.netPnL ?? t.netPL) < 0
  );
  if (winningTrades.length === 0 || losingTrades.length === 0) return "N/A";
  const avgWin =
    winningTrades.reduce((sum, t) => sum + Number(t.netPnL ?? t.netPL), 0) /
    winningTrades.length;
  const avgLoss = Math.abs(
    losingTrades.reduce((sum, t) => sum + Number(t.netPnL ?? t.netPL), 0) /
      losingTrades.length
  );
  if (avgLoss === 0) return avgWin > 0 ? "∞" : "N/A";
  return (avgWin / avgLoss).toFixed(2);
}

// Calculate risked amount based on entry, stop loss, volume and symbol properties
export const calculateRiskedAmount = ({
  entry,
  stop,
  volume,
  pipSize,
  pipValuePerLot,
}) => {
  const pipCount = Math.abs(entry - stop) * (1 / pipSize);
  const risked = pipCount * pipValuePerLot * volume;
  return Number(risked.toFixed(2));
};
