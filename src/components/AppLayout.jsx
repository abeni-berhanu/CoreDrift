import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import AddTradeModal from "./AddTradeModal";
import { AddTradeModalProvider } from "../contexts/AddTradeModalContext";
import { DateRangeProvider } from "../contexts/DateRangeContext";
import { AccountProvider } from "../contexts/AccountContext";
import { TradeLogProvider } from "../contexts/TradeLogContext";

function AppLayout({ children }) {
  // Initialize collapsed state from localStorage or default to false
  const [collapsed, setCollapsed] = useState(() => {
    const savedState = localStorage.getItem("sidebarCollapsed");
    return savedState ? JSON.parse(savedState) : false;
  });

  // Update localStorage when collapsed state changes
  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", JSON.stringify(collapsed));
  }, [collapsed]);

  return (
    <AddTradeModalProvider>
      <DateRangeProvider>
        <AccountProvider>
          <TradeLogProvider>
            <div className="app-container">
              <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
              <div className={`main-content ${collapsed ? "collapsed" : ""}`}>
                <Topbar collapsed={collapsed} />
                <main className="page-content">
                  {children}
                  <AddTradeModal />
                </main>
              </div>
            </div>
          </TradeLogProvider>
        </AccountProvider>
      </DateRangeProvider>
    </AddTradeModalProvider>
  );
}

export default AppLayout;
