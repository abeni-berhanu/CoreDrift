import React, { createContext, useContext, useState } from "react";

const AddTradeModalContext = createContext();

export function AddTradeModalProvider({ children }) {
  const [showAddTradeModal, setShowAddTradeModal] = useState(false);

  const openAddTradeModal = () => {
    setShowAddTradeModal(true);
  };
  const closeAddTradeModal = () => {
    setShowAddTradeModal(false);
  };
  return (
    <AddTradeModalContext.Provider
      value={{ showAddTradeModal, openAddTradeModal, closeAddTradeModal }}
    >
      {children}
    </AddTradeModalContext.Provider>
  );
}

export function useAddTradeModal() {
  return useContext(AddTradeModalContext);
}
