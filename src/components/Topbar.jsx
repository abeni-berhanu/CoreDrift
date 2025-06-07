import React, { useState, useRef, useEffect } from "react";
import {
  FaCalendarAlt,
  FaChevronDown,
  FaFilter,
  FaUser,
  FaCog,
  FaTrash,
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
} from "firebase/firestore";
import { Link } from "react-router-dom";
import AccountTypeSelect from "./AccountTypeSelect";

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

function Topbar({ collapsed }) {
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
    initialBalance: "",
    currentBalance: "",
    accountType: "Demo",
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

  const handleOpenAccountSettings = (account) => {
    setAccountSettings({
      id: account.id,
      name: account.name,
      initialBalance: account.initialBalance || 0,
      currentBalance: account.currentBalance || 0,
      accountType: account.accountType || "Demo",
    });
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
    if (!accountSettings.id) return;
    try {
      const accRef = doc(db, "users", user.uid, "accounts", accountSettings.id);
      const initialBalance = Number(accountSettings.initialBalance) || 0;

      if (initialBalance <= 0) {
        throw new Error("Initial balance must be a positive number");
      }

      const updateData = {
        name: accountSettings.name,
        initialBalance: initialBalance,
        accountType: accountSettings.accountType,
        updatedAt: serverTimestamp(),
      };

      console.log("Updating account with data:", updateData);
      await updateDoc(accRef, updateData);
      console.log("Account updated successfully");

      setShowAccountSettingsModal(false);
      setError("");
    } catch (err) {
      console.error("Error updating account:", err);
      setError(err.message);
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
            {/* Dropdown content can go here if needed */}
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
                  minWidth: 400,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                }}
              >
                <h2 style={{ margin: "0 0 24px 0", fontSize: 20 }}>
                  Account Settings
                </h2>
                <div style={{ marginBottom: 16 }}>
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
                <div style={{ marginBottom: 16 }}>
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
                <div style={{ marginBottom: 16 }}>
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
                <div style={{ marginBottom: 24 }}>
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
