import React, { useState, useRef, useEffect } from "react";
import {
  FaCalendarAlt,
  FaChevronDown,
  FaFilter,
  FaUser,
  FaCog,
  FaTrash,
  FaStickyNote,
} from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useDateRange } from "../contexts/DateRangeContext";
import { useAccount } from "../contexts/AccountContext";
import { db } from "../firebase";
import {
  doc,
  updateDoc,
  serverTimestamp,
  collection,
  getDocs,
  getDoc,
  addDoc,
} from "firebase/firestore";
import { Link } from "react-router-dom";
import AccountTypeSelect from "./AccountTypeSelect";
import { NotesModal } from "./Notes";

const pageNames = {
  "/": "Dashboard",
  "/dashboard": "Dashboard",
  "/reports": "Reports",
  "/notebook": "Notebook",
  "/setups": "Setups",
  "/tradelog": "Trade Log",
  "/daily-journal": "Daily Journal",
  "/playbook": "Playbook",
};

function Topbar({ collapsed, trades = [], onFilterChange }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { startDate, endDate, setStartDate, setEndDate } = useDateRange();
  const {
    accounts,
    selectedAccountIds,
    selectedAccounts,
    toggleAccountSelection,
    addAccount,
    deleteAccount,
    setSelectedAccountIds,
    selectedAccount,
    setAccounts,
  } = useAccount();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const dateDropdownRef = useRef(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterDropdownRef = useRef(null);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const accountDropdownRef = useRef(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [newAccount, setNewAccount] = useState({
    name: "",
    initialBalance: 100000,
    accountType: "Demo",
  });
  const [showAccountSettingsModal, setShowAccountSettingsModal] =
    useState(false);
  const [accountSettings, setAccountSettings] = useState({
    id: "",
    name: "",
    initialBalance: 0,
    currentBalance: 0,
    accountType: "Demo",
    status: "Active",
  });
  const [error, setError] = useState("");
  const pageName = pageNames[location.pathname] || "Dashboard";
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [accountData, setAccountData] = useState({
    name: "",
    initialBalance: 100000,
    currency: "USD",
  });
  const [filters, setFilters] = useState({
    winLoss: "all",
    tradingHour: "all",
    symbol: "all",
    direction: "all",
    setup: "all",
  });
  const [accountNotes, setAccountNotes] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const saveTimeoutRef = useRef(null);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedStatus, setExpandedStatus] = useState(null);

  // Filter trades
  const filteredTrades = React.useMemo(() => {
    return trades.filter((trade) => {
      // Win/Loss filter
      if (filters.winLoss !== "all") {
        const isWin = trade.netPnL > 0;
        if (filters.winLoss === "win" && !isWin) return false;
        if (filters.winLoss === "loss" && isWin) return false;
      }

      // Trading hour filter
      if (filters.tradingHour !== "all") {
        const entryHour = new Date(trade.entryTimestamp).getHours();
        const [startHour, endHour] = filters.tradingHour.split("-").map(Number);
        if (entryHour < startHour || entryHour >= endHour) return false;
      }

      // Symbol filter
      if (filters.symbol !== "all" && trade.symbol !== filters.symbol)
        return false;

      // Direction filter
      if (filters.direction !== "all" && trade.direction !== filters.direction)
        return false;

      // Setup filter
      if (filters.setup !== "all" && trade.setups !== filters.setup)
        return false;

      return true;
    });
  }, [trades, filters]);

  // Update parent when filters change
  useEffect(() => {
    if (onFilterChange) {
      onFilterChange(filteredTrades);
    }
  }, [filteredTrades, onFilterChange]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Close date dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        dateDropdownRef.current &&
        !dateDropdownRef.current.contains(event.target)
      ) {
        setShowDateDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(event.target)
      ) {
        setShowFilterDropdown(false);
      }
      if (
        accountDropdownRef.current &&
        !accountDropdownRef.current.contains(event.target)
      ) {
        setShowAccountDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleOpenAccountSettings = async (account) => {
    setAccountSettings({
      id: account.id,
      name: account.name,
      initialBalance: account.initialBalance || 0,
      currentBalance: account.currentBalance || 0,
      accountType: account.accountType || "Demo",
      status: account.status || "Active",
    });

    // Fetch account notes
    try {
      const accountRef = doc(db, "users", user.uid, "accounts", account.id);
      const accountDoc = await getDoc(accountRef);
      if (accountDoc.exists()) {
        setAccountNotes(accountDoc.data().notes || "");
      }
    } catch (err) {
      console.error("Error fetching account notes:", err);
    }

    setShowAccountSettingsModal(true);
  };

  const handleDeleteAccount = (accountId) => {
    console.log("handleDeleteAccount called with:", accountId);
    setShowAccountSettingsModal(false); // Close settings modal
    deleteAccount(accountId); // This will trigger the confirmation modal
  };

  const handleAccountSettingsChange = (e) => {
    const { name, value } = e.target;
    setAccountSettings((prev) => ({
      ...prev,
      [name]: name === "initialBalance" ? Number(value) || 0 : value,
    }));
  };

  const handleRecalculateBalance = async () => {
    if (!accountSettings.id) return;
    try {
      const tradesRef = collection(
        db,
        "users",
        user.uid,
        "accounts",
        accountSettings.id,
        "trades"
      );
      const tradesSnapshot = await getDocs(tradesRef);
      const trades = tradesSnapshot.docs.map((doc) => doc.data());

      // Calculate total PnL from trades
      const totalPnL = trades.reduce(
        (sum, trade) => sum + (parseFloat(trade.netPnL) || 0),
        0
      );

      // Update current balance based on initial balance and total PnL
      const newCurrentBalance = accountSettings.initialBalance + totalPnL;

      // Update the account document
      const accRef = doc(db, "users", user.uid, "accounts", accountSettings.id);
      await updateDoc(accRef, {
        currentBalance: newCurrentBalance,
        updatedAt: serverTimestamp(),
      });

      // Update local state
      setAccountSettings((prev) => ({
        ...prev,
        currentBalance: newCurrentBalance,
      }));

      setError("");
    } catch (err) {
      console.error("Error recalculating balance:", err);
      setError("Failed to recalculate balance");
    }
  };

  const handleSaveAccountSettings = async () => {
    if (!user || !accountSettings.id) return;

    try {
      const initialBalance = Number(accountSettings.initialBalance) || 0;
      if (initialBalance <= 0) {
        throw new Error("Initial balance must be a positive number");
      }

      const accountRef = doc(
        db,
        "users",
        user.uid,
        "accounts",
        accountSettings.id
      );
      await updateDoc(accountRef, {
        name: accountSettings.name,
        initialBalance: initialBalance,
        accountType: accountSettings.accountType,
        status: accountSettings.status || "Active",
        updatedAt: serverTimestamp(),
      });

      // Update local state
      const updatedAccounts = accounts.map((acc) =>
        acc.id === accountSettings.id
          ? {
              ...acc,
              name: accountSettings.name,
              initialBalance: initialBalance,
              accountType: accountSettings.accountType,
              status: accountSettings.status || "Active",
            }
          : acc
      );
      setAccounts(updatedAccounts);
      setShowAccountSettingsModal(false);
      setError(null);
    } catch (err) {
      console.error("Error updating account:", err);
      setError(err.message || "Failed to update account. Please try again.");
    }
  };

  const handleAddAccount = async () => {
    try {
      setError("");
      if (!newAccount.name.trim()) {
        throw new Error("Account name is required");
      }

      const initialBalance = Number(newAccount.initialBalance) || 0;
      if (initialBalance <= 0) {
        throw new Error("Initial balance must be a positive number");
      }

      await addAccount({
        name: newAccount.name.trim(),
        initialBalance: initialBalance,
        currentBalance: initialBalance, // Set current balance equal to initial balance
        accountType: newAccount.accountType || "Demo",
        status: "Active", // Add default status
      });

      setNewAccount({
        name: "",
        initialBalance: 100000,
        accountType: "Demo",
      });
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleNotesChange = async (content) => {
    if (!user || !accountSettings.id) return;

    // Update local state immediately for responsive UI
    setAccountNotes(content);

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set saving indicator
    setIsSaving(true);

    // Debounce the save operation
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const accountRef = doc(
          db,
          "users",
          user.uid,
          "accounts",
          accountSettings.id
        );
        await updateDoc(accountRef, {
          notes: content,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error("Error saving notes:", err);
        setError("Failed to save notes. Please try again.");
      } finally {
        setIsSaving(false);
      }
    }, 1000); // Wait 1 second after last change before saving
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const renderAccountInfo = () => {
    if (!selectedAccount) return null;

    return (
      <div className="flex items-center space-x-4">
        <div className="text-sm">
          <span className="text-gray-500">Initial Balance:</span>
          <span className="ml-2 font-medium">
            {selectedAccount.initialBalance?.toLocaleString() || "0"}{" "}
            {selectedAccount.currency || "USD"}
          </span>
        </div>
        <div className="text-sm">
          <span className="text-gray-500">Current Balance:</span>
          <span className="ml-2 font-medium">
            {selectedAccount.currentBalance?.toLocaleString() || "0"}{" "}
            {selectedAccount.currency || "USD"}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        height: 64,
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.06)",
        position: "fixed",
        width: `calc(100% - ${collapsed ? 80 : 240}px)`,
        left: collapsed ? 80 : 240,
        zIndex: 300,
        background: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 32px",
        top: 0,
        transition: "left 0.2s, width 0.2s",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        {/* Page Name on the left */}
        <div style={{ fontWeight: 600, fontSize: 20, color: "#333" }}>
          {pageName}
        </div>
        {/* Right side - Filters, Date Range, Account, Profile */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Filters Dropdown */}
          <div ref={filterDropdownRef} style={{ position: "relative" }}>
            <button
              style={{
                display: "flex",
                alignItems: "center",
                background: "#fff",
                border: "1px solid #eee",
                borderRadius: 8,
                padding: "4px 12px 4px 10px",
                fontSize: 14,
                color: "#333",
                cursor: "pointer",
                fontWeight: 500,
                gap: 6,
                minWidth: 90,
              }}
              onClick={() => setShowFilterDropdown((v) => !v)}
            >
              <FaFilter style={{ color: "#7c6fd7", fontSize: 15 }} />
              Filters
              <FaChevronDown style={{ fontSize: 11, marginLeft: 6 }} />
            </button>
            {showFilterDropdown && (
              <div
                style={{
                  position: "absolute",
                  top: "110%",
                  left: 0,
                  background: "#fff",
                  borderRadius: 10,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
                  padding: 18,
                  minWidth: 400,
                  maxWidth: 600,
                  zIndex: 1000,
                }}
              >
                <div
                  style={{ fontWeight: 600, fontSize: 15, marginBottom: 10 }}
                >
                  Filter Trades
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: 16,
                    fontSize: 14,
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    <label style={{ fontSize: 12, color: "#666" }}>
                      Result
                    </label>
                    <select
                      value={filters.winLoss}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          winLoss: e.target.value,
                        }))
                      }
                      style={{
                        padding: "8px 12px",
                        border: "1px solid #eee",
                        borderRadius: 8,
                        fontSize: 14,
                        width: "100%",
                        background: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <option value="all">All Trades</option>
                      <option value="win">Winning Trades</option>
                      <option value="loss">Losing Trades</option>
                    </select>
                  </div>

                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    <label style={{ fontSize: 12, color: "#666" }}>
                      Trading Hour
                    </label>
                    <select
                      value={filters.tradingHour}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          tradingHour: e.target.value,
                        }))
                      }
                      style={{
                        padding: "8px 12px",
                        border: "1px solid #eee",
                        borderRadius: 8,
                        fontSize: 14,
                        width: "100%",
                        background: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <option value="all">All Hours</option>
                      <option value="0-4">00:00 - 04:00</option>
                      <option value="4-8">04:00 - 08:00</option>
                      <option value="8-12">08:00 - 12:00</option>
                      <option value="12-16">12:00 - 16:00</option>
                      <option value="16-20">16:00 - 20:00</option>
                      <option value="20-24">20:00 - 24:00</option>
                    </select>
                  </div>

                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    <label style={{ fontSize: 12, color: "#666" }}>
                      Symbol
                    </label>
                    <select
                      value={filters.symbol}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          symbol: e.target.value,
                        }))
                      }
                      style={{
                        padding: "8px 12px",
                        border: "1px solid #eee",
                        borderRadius: 8,
                        fontSize: 14,
                        width: "100%",
                        background: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <option value="all">All Symbols</option>
                      {Array.from(new Set(trades.map((t) => t.symbol))).map(
                        (symbol) => (
                          <option key={symbol} value={symbol}>
                            {symbol}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    <label style={{ fontSize: 12, color: "#666" }}>
                      Direction
                    </label>
                    <select
                      value={filters.direction}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          direction: e.target.value,
                        }))
                      }
                      style={{
                        padding: "8px 12px",
                        border: "1px solid #eee",
                        borderRadius: 8,
                        fontSize: 14,
                        width: "100%",
                        background: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <option value="all">All Directions</option>
                      <option value="Buy">Buy</option>
                      <option value="Sell">Sell</option>
                    </select>
                  </div>

                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    <label style={{ fontSize: 12, color: "#666" }}>Setup</label>
                    <select
                      value={filters.setup}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          setup: e.target.value,
                        }))
                      }
                      style={{
                        padding: "8px 12px",
                        border: "1px solid #eee",
                        borderRadius: 8,
                        fontSize: 14,
                        width: "100%",
                        background: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <option value="all">All Setups</option>
                      {Array.from(new Set(trades.map((t) => t.setups)))
                        .filter(Boolean)
                        .map((setup) => (
                          <option key={setup} value={setup}>
                            {setup}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 10,
                  }}
                >
                  <button
                    style={{
                      padding: "6px 14px",
                      borderRadius: 6,
                      border: "1px solid #eee",
                      background: "#f4f6fa",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setFilters({
                        winLoss: "all",
                        tradingHour: "all",
                        symbol: "all",
                        direction: "all",
                        setup: "all",
                      });
                    }}
                  >
                    Reset Filters
                  </button>
                  <button
                    style={{
                      padding: "6px 14px",
                      borderRadius: 6,
                      border: "1px solid #eee",
                      background: "#f4f6fa",
                      cursor: "pointer",
                    }}
                    onClick={() => setShowFilterDropdown(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Date Range Picker Dropdown */}
          <div ref={dateDropdownRef} style={{ position: "relative" }}>
            <button
              style={{
                display: "flex",
                alignItems: "center",
                background: "#fff",
                border: "1px solid #eee",
                borderRadius: 8,
                padding: "4px 12px 4px 10px",
                fontSize: 14,
                color: "#333",
                cursor: "pointer",
                fontWeight: 500,
                gap: 6,
                minWidth: 110,
              }}
              onClick={() => setShowDateDropdown((v) => !v)}
            >
              <FaCalendarAlt style={{ color: "#7c6fd7", fontSize: 15 }} />
              {startDate && endDate
                ? `${startDate} to ${endDate}`
                : "Date range"}
              <FaChevronDown style={{ fontSize: 11, marginLeft: 6 }} />
            </button>
            {showDateDropdown && (
              <div
                style={{
                  position: "absolute",
                  top: "110%",
                  left: 0,
                  background: "#fff",
                  borderRadius: 10,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
                  padding: 18,
                  minWidth: 220,
                  zIndex: 1000,
                }}
              >
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  <label
                    style={{ fontWeight: 500, color: "#555", fontSize: 13 }}
                  >
                    Start date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{
                      padding: 6,
                      borderRadius: 6,
                      border: "1px solid #eee",
                      fontSize: 13,
                    }}
                  />
                  <label
                    style={{ fontWeight: 500, color: "#555", fontSize: 13 }}
                  >
                    End date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{
                      padding: 6,
                      borderRadius: 6,
                      border: "1px solid #eee",
                      fontSize: 13,
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: 6,
                      marginTop: 6,
                    }}
                  >
                    <button
                      onClick={() => {
                        setStartDate("");
                        setEndDate("");
                        setShowDateDropdown(false);
                      }}
                      style={{
                        background: "#f4f6fa",
                        border: "none",
                        borderRadius: 6,
                        padding: "4px 12px",
                        cursor: "pointer",
                        color: "#333",
                        fontSize: 13,
                      }}
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => setShowDateDropdown(false)}
                      style={{
                        background: "#6C63FF",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        padding: "4px 12px",
                        cursor: "pointer",
                        fontWeight: 500,
                        fontSize: 13,
                      }}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Account Dropdown */}
          <div ref={accountDropdownRef} style={{ position: "relative" }}>
            <button
              style={{
                display: "flex",
                alignItems: "center",
                background: "#fff",
                border: "1px solid #eee",
                borderRadius: 8,
                padding: "4px 10px",
                fontSize: 14,
                color: "#333",
                cursor: "pointer",
                fontWeight: 500,
                gap: 6,
                minWidth: 110,
              }}
              onClick={() => setShowAccountDropdown((v) => !v)}
            >
              <FaUser style={{ color: "#7c6fd7", fontSize: 15 }} />
              {selectedAccountIds.length === 0
                ? "All Accounts"
                : selectedAccountIds.length === 1
                ? accounts.find((a) => a.id === selectedAccountIds[0])?.name ||
                  "Select account"
                : `${selectedAccountIds.length} accounts`}
              <FaChevronDown style={{ fontSize: 11, marginLeft: 6 }} />
            </button>
            {showAccountDropdown && (
              <div
                style={{
                  position: "absolute",
                  top: "110%",
                  left: 0,
                  background: "#fff",
                  borderRadius: 10,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
                  padding: 0,
                  minWidth: 220,
                  zIndex: 1000,
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "4px 0 4px 0" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 16px",
                      cursor: "pointer",
                      fontWeight: 500,
                      color: "#333",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedAccountIds.length === 0}
                      onChange={() => setSelectedAccountIds([])}
                      style={{ accentColor: "#6C63FF" }}
                    />
                    All Accounts
                  </label>
                  {accounts.map((acc) => (
                    <label
                      key={acc.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 16px",
                        cursor: "pointer",
                        fontWeight: 500,
                        color: "#333",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedAccountIds.includes(acc.id)}
                        onChange={() => {
                          let newIds;
                          if (selectedAccountIds.includes(acc.id)) {
                            // Remove this account
                            newIds = selectedAccountIds.filter(
                              (id) => id !== acc.id
                            );
                          } else {
                            // Add this account
                            newIds = [...selectedAccountIds, acc.id];
                          }
                          // If none selected, revert to All Accounts
                          setSelectedAccountIds(
                            newIds.length === 0 ? [] : newIds
                          );
                        }}
                        style={{ accentColor: "#6C63FF" }}
                      />
                      {acc.name}
                    </label>
                  ))}
                </div>
                <div
                  style={{
                    borderTop: "1px solid #f0f0f0",
                    padding: "8px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    color: "#6C63FF",
                    fontWeight: 600,
                  }}
                  onClick={() => {
                    setShowAccountModal(true);
                    setShowAccountDropdown(false);
                  }}
                >
                  <FaCog style={{ fontSize: 16 }} /> Manage Accounts
                </div>
              </div>
            )}
          </div>
          {/* Account Management Modal */}
          {showAccountModal && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                background: "rgba(0,0,0,0.18)",
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onClick={() => setShowAccountModal(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: "#fff",
                  borderRadius: 12,
                  padding: 32,
                  minWidth: 400,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                  position: "relative",
                }}
              >
                <div
                  style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}
                >
                  Account Management
                </div>
                {error && (
                  <div
                    style={{
                      color: "#cf1322",
                      marginBottom: 16,
                      padding: 8,
                      background: "#fff1f0",
                      border: "1px solid #ffccc7",
                      borderRadius: 4,
                    }}
                  >
                    {error}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                    marginBottom: 24,
                  }}
                >
                  <input
                    value={newAccount.name}
                    onChange={(e) =>
                      setNewAccount((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="New account name"
                    style={{
                      padding: 8,
                      borderRadius: 6,
                      border: "1px solid #eee",
                      fontSize: 15,
                    }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="number"
                      value={newAccount.initialBalance}
                      onChange={(e) =>
                        setNewAccount((prev) => ({
                          ...prev,
                          initialBalance: Number(e.target.value),
                        }))
                      }
                      placeholder="Initial balance"
                      style={{
                        flex: 1,
                        padding: 8,
                        borderRadius: 6,
                        border: "1px solid #eee",
                        fontSize: 15,
                      }}
                    />
                    <AccountTypeSelect
                      value={newAccount.accountType}
                      onChange={(e) =>
                        setNewAccount({
                          ...newAccount,
                          accountType: e.target.value,
                        })
                      }
                    />
                  </div>
                  <button
                    onClick={handleAddAccount}
                    style={{
                      background: "#6C63FF",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      padding: "8px 16px",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Add Account
                  </button>
                </div>
                <div style={{ maxHeight: 300, overflowY: "auto" }}>
                  {accounts.map((acc) => (
                    <div
                      key={acc.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 0",
                        borderBottom: "1px solid #f4f6fa",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>{acc.name}</span>
                        <span style={{ fontSize: 13, color: "#666" }}>
                          {renderAccountInfo(acc)}
                        </span>
                      </div>
                      <div>
                        <FaCog
                          style={{
                            color: "#888",
                            cursor: "pointer",
                            fontSize: 16,
                          }}
                          title="Account Settings"
                          onClick={() => handleOpenAccountSettings(acc)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* Account Settings Modal */}
          {showAccountSettingsModal && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                background: "rgba(0,0,0,0.18)",
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onClick={() => setShowAccountSettingsModal(false)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: "#fff",
                  borderRadius: 12,
                  padding: 32,
                  width: "800px",
                  maxWidth: "90vw",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                }}
              >
                <h2 style={{ margin: "0 0 24px 0", fontSize: 20 }}>
                  Account Settings
                </h2>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "24px",
                    marginBottom: "24px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: 8,
                        fontSize: 14,
                        color: "#666",
                      }}
                    >
                      Account Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={accountSettings.name}
                      onChange={handleAccountSettingsChange}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: "1px solid #d9d9d9",
                        fontSize: 14,
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: 8,
                        fontSize: 14,
                        color: "#666",
                      }}
                    >
                      Account Type
                    </label>
                    <AccountTypeSelect
                      value={accountSettings.accountType}
                      onChange={handleAccountSettingsChange}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: 8,
                        fontSize: 14,
                        color: "#666",
                      }}
                    >
                      Account Status
                    </label>
                    <select
                      name="status"
                      value={accountSettings.status}
                      onChange={handleAccountSettingsChange}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: "1px solid #d9d9d9",
                        fontSize: 14,
                        background: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <option value="Active">Active</option>
                      <option value="Blown/Breached">Blown/Breached</option>
                      <option value="Passed">Passed</option>
                      <option value="Archive">Archive</option>
                    </select>
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: 8,
                        fontSize: 14,
                        color: "#666",
                      }}
                    >
                      Initial Balance
                    </label>
                    <input
                      type="number"
                      name="initialBalance"
                      value={accountSettings.initialBalance}
                      onChange={handleAccountSettingsChange}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: "1px solid #d9d9d9",
                        fontSize: 14,
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: 8,
                        fontSize: 14,
                        color: "#666",
                      }}
                    >
                      Current Balance
                    </label>
                    <div
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                      <input
                        type="number"
                        name="currentBalance"
                        value={accountSettings.currentBalance}
                        onChange={handleAccountSettingsChange}
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          borderRadius: 6,
                          border: "1px solid #d9d9d9",
                          fontSize: 14,
                        }}
                        disabled
                      />
                      <button
                        onClick={handleRecalculateBalance}
                        style={{
                          padding: "8px 12px",
                          background: "none",
                          border: "none",
                          color: "#1890ff",
                          cursor: "pointer",
                          fontSize: 14,
                          fontWeight: 500,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Recalculate
                      </button>
                    </div>
                  </div>
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 8,
                      fontSize: 14,
                      color: "#666",
                    }}
                  >
                    Notes{" "}
                    {isSaving && (
                      <span style={{ color: "#666", fontSize: 12 }}>
                        (Saving...)
                      </span>
                    )}
                  </label>
                  <div
                    style={{
                      background: "#f7f7fa",
                      borderRadius: 12,
                      padding: 16,
                      maxHeight: "200px",
                      overflowY: "auto",
                    }}
                  >
                    <NotesModal
                      open={true}
                      onClose={() => {}}
                      value={accountNotes}
                      onChange={handleNotesChange}
                      editMode={isEditingNotes}
                      inline={true}
                      style={{
                        position: "relative",
                        boxShadow: "none",
                        padding: 0,
                        background: "transparent",
                        maxHeight: "180px",
                        overflowY: "auto",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: 12,
                      marginTop: 12,
                    }}
                  >
                    {!isEditingNotes ? (
                      <button
                        onClick={() => setIsEditingNotes(true)}
                        style={{
                          padding: "8px 16px",
                          background: "#6C63FF",
                          color: "white",
                          border: "none",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 14,
                          fontWeight: 500,
                        }}
                      >
                        Edit Notes
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setIsEditingNotes(false);
                            // Reset notes to last saved state
                            const accountRef = doc(
                              db,
                              "users",
                              user.uid,
                              "accounts",
                              accountSettings.id
                            );
                            getDoc(accountRef).then((doc) => {
                              if (doc.exists()) {
                                setAccountNotes(doc.data().notes || "");
                              }
                            });
                          }}
                          style={{
                            padding: "8px 16px",
                            background: "#f0f0f0",
                            border: "none",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 14,
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => setIsEditingNotes(false)}
                          style={{
                            padding: "8px 16px",
                            background: "#6C63FF",
                            color: "white",
                            border: "none",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 14,
                            fontWeight: 500,
                          }}
                        >
                          Save Changes
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {error && (
                  <div
                    style={{
                      color: "#cf1322",
                      marginBottom: 16,
                      fontSize: 14,
                    }}
                  >
                    {error}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <button
                    onClick={() => handleDeleteAccount(accountSettings.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#cf1322",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 14,
                      padding: "8px 16px",
                      borderRadius: 6,
                      transition: "background-color 0.2s",
                    }}
                    onMouseOver={(e) =>
                      (e.currentTarget.style.backgroundColor = "#fff1f0")
                    }
                    onMouseOut={(e) =>
                      (e.currentTarget.style.backgroundColor = "transparent")
                    }
                  >
                    <FaTrash style={{ fontSize: 14 }} />
                    Delete Account
                  </button>
                  <div style={{ display: "flex", gap: 12 }}>
                    <button
                      onClick={() => setShowAccountSettingsModal(false)}
                      style={{
                        padding: "8px 16px",
                        background: "#f0f0f0",
                        border: "1px solid #d9d9d9",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 14,
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveAccountSettings}
                      style={{
                        padding: "8px 16px",
                        background: "#1890ff",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 14,
                      }}
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* User Profile Section (icon only) */}
          <div
            ref={dropdownRef}
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 12,
              cursor: "pointer",
            }}
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "linear-gradient(90deg, #6C63FF 30%, #00C9A7 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: "bold",
                fontSize: 14,
              }}
            >
              {user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            {/* No email displayed */}
            {showDropdown && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  background: "#fff",
                  borderRadius: 8,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  padding: "8px 0",
                  minWidth: 200,
                  marginTop: 8,
                }}
              >
                <div
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid #f0f0f0",
                    color: "#666",
                    fontSize: 14,
                  }}
                >
                  Logged in as: <strong>{user?.email || "Unknown"}</strong>
                </div>
                <button
                  onClick={() => navigate("/settings")}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    background: "none",
                    border: "none",
                    textAlign: "left",
                    cursor: "pointer",
                    color: "#333",
                    fontSize: 14,
                    transition: "background 0.2s",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#f4f6fa")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "none")
                  }
                >
                  <FaCog style={{ fontSize: 16 }} /> Settings
                </button>
                <button
                  onClick={handleLogout}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    background: "none",
                    border: "none",
                    textAlign: "left",
                    cursor: "pointer",
                    color: "#ff4d4f",
                    fontSize: 14,
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#fff1f0")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "none")
                  }
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Topbar;
