import React, { createContext, useContext, useState } from "react";

const DateRangeContext = createContext({
  startDate: "",
  endDate: "",
  setStartDate: () => {},
  setEndDate: () => {},
});

export function DateRangeProvider({ children }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const value = {
    startDate,
    endDate,
    setStartDate,
    setEndDate,
  };

  return (
    <DateRangeContext.Provider value={value}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange() {
  const context = useContext(DateRangeContext);
  if (context === undefined) {
    throw new Error("useDateRange must be used within a DateRangeProvider");
  }
  return context;
}
