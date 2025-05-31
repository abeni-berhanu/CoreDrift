import React, { useState, useRef, useEffect } from "react";
import {
  FaCalendarAlt,
  FaChevronDown,
  FaFilter,
  FaUser,
  FaCog,
} from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useDateRange } from "../contexts/DateRangeContext";
import { useAccount } from "../contexts/AccountContext";
import { db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";

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
    removeAccount,
    setSelectedAccountIds,
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
    accountType: "Demo",
  });
  const pageName = pageNames[location.pathname] || "Dashboard";

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

  const handleOpenAccountSettings = (acc) => {
    setAccountSettings({
      id: acc.id,
      name: acc.name,
      initialBalance: acc.initialBalance || "",
      accountType: acc.accountType || "Demo",
    });
    setShowAccountSettingsModal(true);
  };

  const handleAccountSettingsChange = (e) => {
    const { name, value } = e.target;
    setAccountSettings((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveAccountSettings = async () => {
    if (!accountSettings.id) return;
    try {
      const accRef = doc(db, "users", user.uid, "accounts", accountSettings.id);
      await updateDoc(accRef, {
        initialBalance: Number(accountSettings.initialBalance),
        accountType: accountSettings.accountType,
      });
      setShowAccountSettingsModal(false);
    } catch (err) {
      alert("Error saving account settings: " + err.message);
    }
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
                  minWidth: 320,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                  position: "relative",
                }}
              >
                <div
                  style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}
                >
                  Account Management
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
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
                      flex: 1,
                      padding: 8,
                      borderRadius: 6,
                      border: "1px solid #eee",
                      fontSize: 15,
                    }}
                  />
                  <button
                    onClick={() => {
                      if (newAccount.name.trim()) {
                        addAccount(newAccount.name.trim());
                        setNewAccount({
                          name: "",
                          initialBalance: 100000,
                          accountType: "Demo",
                        });
                      }
                    }}
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
                    Add
                  </button>
                </div>
                <div style={{ maxHeight: 180, overflowY: "auto" }}>
                  {accounts.map((acc) => (
                    <div
                      key={acc.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 0",
                        borderBottom: "1px solid #f4f6fa",
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span>{acc.name}</span>
                        <FaCog
                          style={{
                            color: "#888",
                            cursor: "pointer",
                            fontSize: 16,
                          }}
                          title="Account Settings"
                          onClick={() => handleOpenAccountSettings(acc)}
                        />
                      </span>
                      {accounts.length > 1 && (
                        <button
                          onClick={() => removeAccount(acc.id)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#cf1322",
                            cursor: "pointer",
                            fontSize: 15,
                          }}
                          title="Remove account"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: 18,
                  }}
                >
                  <button
                    onClick={() => setShowAccountModal(false)}
                    style={{
                      padding: "8px 18px",
                      background: "#6C63FF",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Close
                  </button>
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
                zIndex: 10000,
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
                  minWidth: 320,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                  position: "relative",
                }}
              >
                <div
                  style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}
                >
                  Account Settings: {accountSettings.name}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  <label style={{ fontWeight: 500 }}>
                    Initial Balance
                    <input
                      type="number"
                      name="initialBalance"
                      value={accountSettings.initialBalance}
                      onChange={handleAccountSettingsChange}
                      style={{
                        width: "100%",
                        padding: 8,
                        borderRadius: 6,
                        border: "1px solid #eee",
                        fontSize: 15,
                        marginTop: 4,
                      }}
                    />
                  </label>
                  <label style={{ fontWeight: 500 }}>
                    Account Type
                    <select
                      name="accountType"
                      value={accountSettings.accountType}
                      onChange={handleAccountSettingsChange}
                      style={{
                        width: "100%",
                        padding: 8,
                        borderRadius: 6,
                        border: "1px solid #eee",
                        fontSize: 15,
                        marginTop: 4,
                      }}
                    >
                      <option value="Live">Live</option>
                      <option value="Prop Evaluation">Prop Evaluation</option>
                      <option value="Prop Verification">
                        Prop Verification
                      </option>
                      <option value="Prop Funded">Prop Funded</option>
                      <option value="Demo">Demo</option>
                    </select>
                  </label>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 10,
                  }}
                >
                  <button
                    onClick={() => setShowAccountSettingsModal(false)}
                    style={{
                      padding: "8px 18px",
                      background: "#f4f6fa",
                      color: "#333",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAccountSettings}
                    style={{
                      padding: "8px 18px",
                      background: "#6C63FF",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Save
                  </button>
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
