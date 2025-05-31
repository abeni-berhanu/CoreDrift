import React, { createContext, useContext, useState } from "react";

const TradeLogContext = createContext();

export function TradeLogProvider({ children }) {
  const [trades, setTrades] = useState([]);

  return (
    <TradeLogContext.Provider value={{ trades, setTrades }}>
      {children}
    </TradeLogContext.Provider>
  );
}

export function useTradeLog() {
  return useContext(TradeLogContext);
}
