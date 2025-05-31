import React, { createContext, useContext, useState } from "react";

const DateRangeContext = createContext();

export function DateRangeProvider({ children }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  return (
    <DateRangeContext.Provider
      value={{ startDate, endDate, setStartDate, setEndDate }}
    >
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange() {
  return useContext(DateRangeContext);
}
