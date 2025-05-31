import React, { useState, useEffect } from "react";
import {
  FaUser,
  FaLock,
  FaPalette,
  FaEdit,
  FaTrash,
  FaUndo,
  FaExchangeAlt,
} from "react-icons/fa";
import { useAuth } from "../contexts/AuthContext";
import { useAccount } from "../contexts/AccountContext";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  Timestamp,
  deleteDoc,
  addDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import "./Settings.css";
import TradeTable from "../components/TradeTable";
import SymbolSettings from "../components/SymbolSettings";

function Settings() {
  const { user, updateUserProfile } = useAuth();
  const { accounts, selectedAccountIds, updateAccount } = useAccount();
  const [activeTab, setActiveTab] = useState("profile");
  const [profileData, setProfileData] = useState({
    displayName: user?.displayName || "",
    email: user?.email || "",
    bio: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Colors state
  const [colors, setColors] = useState([]);
  const [editingColor, setEditingColor] = useState(null);

  // Recycle Bin state
  const [deletedTrades, setDeletedTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrades, setSelectedTrades] = useState([]);

  const tabs = [
    { id: "profile", label: "Profile", icon: <FaUser /> },
    { id: "security", label: "Security", icon: <FaLock /> },
    { id: "appearance", label: "Appearance", icon: <FaPalette /> },
    { id: "colors", label: "Colors", icon: <FaPalette /> },
    { id: "recycle-bin", label: "Recycle Bin", icon: <FaTrash /> },
    { id: "symbols", label: "Symbols", icon: <FaExchangeAlt /> },
  ];

  // Fetch colors on mount
  useEffect(() => {
    const fetchColors = async () => {
      try {
        const colorsRef = collection(db, "colors");
        const snapshot = await getDocs(colorsRef);
        const colorsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setColors(colorsList);
      } catch (err) {
        console.error("Error fetching colors:", err);
      }
    };
    fetchColors();
  }, []);

  // Fetch deleted trades when recycle bin tab is active
  useEffect(() => {
    if (activeTab === "recycle-bin" && user && selectedAccountIds.length > 0) {
      fetchDeletedTrades();
    }
  }, [activeTab, user, selectedAccountIds]);

  const fetchDeletedTrades = async () => {
    if (!user?.uid) {
      console.error("No user ID available");
      return;
    }

    if (selectedAccountIds.length === 0) {
      console.log("No accounts selected");
      setDeletedTrades([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const deletedTrades = [];

      console.log("Fetching deleted trades for user:", user.uid);
      console.log("Selected account IDs:", selectedAccountIds);

      // Fetch deleted trades from each account
      for (const accountId of selectedAccountIds) {
        try {
          const deletedTradesPath = `users/${user.uid}/accounts/${accountId}/deletedTrades`;
          console.log("Checking path:", deletedTradesPath);

          const deletedTradesRef = collection(db, deletedTradesPath);
          const q = query(
            deletedTradesRef,
            where(
              "deletedAt",
              ">=",
              Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
            )
          );

          console.log("Executing query for account:", accountId);
          const snapshot = await getDocs(q, { source: "server" }); // Force server fetch
          console.log(
            `Found ${snapshot.docs.length} deleted trades in account ${accountId}`
          );

          const accountDeletedTrades = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            accountId: accountId,
            accountName:
              accounts.find((acc) => acc.id === accountId)?.name ||
              "Unknown Account",
          }));
          deletedTrades.push(...accountDeletedTrades);
        } catch (accountError) {
          console.error(
            `Error fetching trades for account ${accountId}:`,
            accountError
          );
        }
      }

      console.log("Total deleted trades found:", deletedTrades.length);
      console.log(
        "Deleted trades IDs:",
        deletedTrades.map((t) => t.id)
      );
      setDeletedTrades(deletedTrades);
    } catch (error) {
      console.error("Error fetching deleted trades:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTrade = (tradeId) => {
    setSelectedTrades((prev) => {
      if (prev.includes(tradeId)) {
        return prev.filter((id) => id !== tradeId);
      } else {
        return [...prev, tradeId];
      }
    });
  };

  const handleSelectAllTrades = () => {
    if (selectedTrades.length === deletedTrades.length) {
      setSelectedTrades([]);
    } else {
      setSelectedTrades(deletedTrades.map((trade) => trade.id));
    }
  };

  const handleRestoreSelected = async () => {
    if (!user?.uid || selectedTrades.length === 0) return;

    try {
      for (const tradeId of selectedTrades) {
        const trade = deletedTrades.find((t) => t.id === tradeId);
        if (!trade) continue;

        // Restore to main trades collection
        const tradesPath = `users/${user.uid}/accounts/${trade.accountId}/trades`;
        const tradeData = { ...trade };
        delete tradeData.deletedAt;
        delete tradeData.id;
        delete tradeData.accountName;
        await addDoc(collection(db, tradesPath), tradeData);

        // Remove from deleted trades collection
        const deletedTradesPath = `users/${user.uid}/accounts/${trade.accountId}/deletedTrades/${trade.id}`;
        await deleteDoc(doc(db, deletedTradesPath));
      }

      // Update local state
      setDeletedTrades((prev) =>
        prev.filter((trade) => !selectedTrades.includes(trade.id))
      );
      setSelectedTrades([]);
    } catch (error) {
      console.error("Error restoring trades:", error);
      alert("Error restoring trades: " + error.message);
    }
  };

  const handleDeleteSelected = async () => {
    if (!user?.uid || selectedTrades.length === 0) {
      console.log("No user ID or no trades selected");
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to permanently delete ${
          selectedTrades.length
        } trade${
          selectedTrades.length !== 1 ? "s" : ""
        }? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      console.log("Starting permanent deletion of trades:", selectedTrades);

      for (const tradeId of selectedTrades) {
        const trade = deletedTrades.find((t) => t.id === tradeId);
        if (!trade) {
          console.log("Trade not found:", tradeId);
          continue;
        }

        console.log("Processing trade for deletion:", {
          tradeId,
          accountId: trade.accountId,
          symbol: trade.symbol,
        });

        // Construct the full path to the deleted trade
        const deletedTradesPath = `users/${user.uid}/accounts/${trade.accountId}/deletedTrades/${tradeId}`;
        console.log("Deleting from path:", deletedTradesPath);

        try {
          // Get a reference to the document
          const deletedTradeRef = doc(db, deletedTradesPath);

          // Verify the document exists before deleting
          const docSnap = await getDoc(deletedTradeRef);
          if (!docSnap.exists()) {
            console.log("Document does not exist:", deletedTradesPath);
            continue;
          }

          // Delete the document
          await deleteDoc(deletedTradeRef);
          console.log("Successfully deleted trade:", tradeId);
        } catch (deleteError) {
          console.error("Error deleting trade:", tradeId, deleteError);
          throw deleteError;
        }
      }

      // Update local state
      setDeletedTrades((prev) =>
        prev.filter((trade) => !selectedTrades.includes(trade.id))
      );
      setSelectedTrades([]);

      // Force refresh the deleted trades list
      await fetchDeletedTrades();

      console.log("Successfully completed deletion process");
    } catch (error) {
      console.error("Error in handleDeleteSelected:", error);
      alert("Error deleting trades: " + error.message);
    }
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({ ...prev, [name]: value }));
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      await updateUserProfile({ displayName: profileData.displayName.trim() });
      setSuccess("Profile updated successfully");
    } catch (err) {
      setError("Failed to update profile");
    }
  };

  const handleColorChange = (color) => {
    updateAccount({
      ...accounts.find((acc) => acc.id === selectedAccountIds[0]),
      themeColor: color,
    });
  };

  const handleEditColor = async (colorId, updatedColor) => {
    if (!updatedColor || !updatedColor.color) {
      console.log("Invalid color data:", updatedColor);
      return;
    }

    try {
      const colorRef = doc(db, "colors", colorId);
      await updateDoc(colorRef, {
        color: updatedColor.color,
      });

      // Update local state immediately
      setColors((prevColors) => {
        const newColors = prevColors.map((color) =>
          color.id === colorId ? { ...color, color: updatedColor.color } : color
        );
        return newColors;
      });

      setEditingColor(null);
    } catch (err) {
      console.error("Error updating color:", err);
      alert("Failed to update color. Please try again.");
    }
  };

  const renderProfileTab = () => (
    <div style={{ maxWidth: 600 }}>
      <h2 style={{ marginBottom: 24 }}>Profile Settings</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
            Display Name
          </label>
          <input
            type="text"
            name="displayName"
            value={profileData.displayName}
            onChange={handleProfileChange}
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 6,
              border: "1px solid #eee",
              fontSize: 15,
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
            Email
          </label>
          <input
            type="email"
            name="email"
            value={profileData.email}
            disabled
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 6,
              border: "1px solid #eee",
              fontSize: 15,
              background: "#f4f6fa",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
            Bio
          </label>
          <textarea
            name="bio"
            value={profileData.bio}
            onChange={handleProfileChange}
            rows={4}
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 6,
              border: "1px solid #eee",
              fontSize: 15,
              resize: "vertical",
            }}
          />
        </div>
        <button
          onClick={handleProfileUpdate}
          style={{
            padding: "10px 20px",
            background: "#6C63FF",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontWeight: 500,
            cursor: "pointer",
            alignSelf: "flex-start",
          }}
        >
          Update Profile
        </button>
      </div>
    </div>
  );

  const renderSecurityTab = () => (
    <div style={{ maxWidth: 600 }}>
      <h2 style={{ marginBottom: 24 }}>Security Settings</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <h3 style={{ marginBottom: 16 }}>Change Password</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="password"
              placeholder="Current Password"
              style={{
                padding: 8,
                borderRadius: 6,
                border: "1px solid #eee",
                fontSize: 15,
              }}
            />
            <input
              type="password"
              placeholder="New Password"
              style={{
                padding: 8,
                borderRadius: 6,
                border: "1px solid #eee",
                fontSize: 15,
              }}
            />
            <input
              type="password"
              placeholder="Confirm New Password"
              style={{
                padding: 8,
                borderRadius: 6,
                border: "1px solid #eee",
                fontSize: 15,
              }}
            />
            <button
              style={{
                padding: "10px 20px",
                background: "#6C63FF",
                color: "white",
                border: "none",
                borderRadius: 6,
                fontWeight: 500,
                cursor: "pointer",
                alignSelf: "flex-start",
              }}
            >
              Update Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAppearanceTab = () => (
    <div style={{ maxWidth: 600 }}>
      <h2 style={{ marginBottom: 24 }}>Appearance Settings</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <h3 style={{ marginBottom: 16 }}>Theme</h3>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              style={{
                padding: "12px 20px",
                background: "#fff",
                border: "1px solid #eee",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Light
            </button>
            <button
              style={{
                padding: "12px 20px",
                background: "#333",
                color: "#fff",
                border: "1px solid #333",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Dark
            </button>
          </div>
        </div>
        <div>
          <h3 style={{ marginBottom: 16 }}>Theme Color</h3>
          <div style={{ display: "flex", gap: 12 }}>
            {["blue", "green", "purple", "red"].map((color) => (
              <button
                key={color}
                onClick={() => handleColorChange(color)}
                style={{
                  padding: "12px 20px",
                  background: color,
                  border: "1px solid #eee",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderColorsTab = () => (
    <div style={{ maxWidth: 800 }}>
      <h2 style={{ marginBottom: 24 }}>Color Management</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Colors list */}
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8f9fa" }}>
                <th
                  style={{
                    padding: 12,
                    textAlign: "left",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  Color
                </th>
                <th
                  style={{
                    padding: 12,
                    textAlign: "left",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  Name
                </th>
                <th
                  style={{
                    padding: 12,
                    textAlign: "left",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {colors.map((color) => (
                <tr key={color.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 12 }}>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: color.color,
                        border: "1px solid #eee",
                      }}
                    />
                  </td>
                  <td style={{ padding: 12 }}>
                    {editingColor?.id === color.id ? (
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <input
                          type="color"
                          value={editingColor.color || "#6C63FF"}
                          onChange={(e) =>
                            setEditingColor((prev) => ({
                              ...prev,
                              color: e.target.value,
                            }))
                          }
                          style={{
                            width: 32,
                            height: 32,
                            padding: 0,
                            border: "none",
                            borderRadius: 4,
                          }}
                        />
                        <button
                          onClick={() =>
                            handleEditColor(color.id, editingColor)
                          }
                          style={{
                            padding: "4px 8px",
                            background: "#6C63FF",
                            color: "white",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingColor(null)}
                          style={{
                            padding: "4px 8px",
                            background: "#eee",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      color.name
                    )}
                  </td>
                  <td style={{ padding: 12 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() =>
                          setEditingColor({
                            id: color.id,
                            name: color.name,
                            color: color.color || "#6C63FF",
                          })
                        }
                        style={{
                          padding: "6px",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#666",
                        }}
                      >
                        <FaEdit />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderRecycleBinTab = () => (
    <div style={{ maxWidth: 800 }}>
      <h2 style={{ marginBottom: 24 }}>Recycle Bin</h2>
      <p style={{ color: "#666", marginBottom: "20px" }}>
        Deleted trades are stored here for 7 days before being permanently
        removed.
      </p>

      {loading ? (
        <div>Loading...</div>
      ) : deletedTrades.length === 0 ? (
        <p>No deleted trades found.</p>
      ) : (
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              padding: "12px",
              background: "#f8f9fa",
              borderBottom: "1px solid #eee",
            }}
          >
            <button
              onClick={handleRestoreSelected}
              disabled={selectedTrades.length === 0}
              style={{
                padding: "8px 16px",
                background: selectedTrades.length ? "#4CAF50" : "#ccc",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: selectedTrades.length ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FaUndo /> Restore Selected
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={selectedTrades.length === 0}
              style={{
                padding: "8px 16px",
                background: selectedTrades.length ? "#F44336" : "#ccc",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: selectedTrades.length ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FaTrash /> Delete Selected
            </button>
          </div>
          <TradeTable
            trades={deletedTrades}
            columns={[
              { key: "entryTimestamp", label: "Open Time" },
              { key: "exitTimestamp", label: "Close Time" },
              { key: "direction", label: "Direction" },
              { key: "symbol", label: "Symbol" },
              { key: "volume", label: "Volume" },
              { key: "entryPrice", label: "Entry Price" },
              { key: "exitPrice", label: "Exit Price" },
              { key: "sl", label: "SL" },
              { key: "riskAmount", label: "Risked Amount" },
              { key: "commission", label: "Commission" },
              { key: "swap", label: "Swap" },
              { key: "netPnL", label: "Net P&L" },
              { key: "duration", label: "Duration (min)" },
              { key: "riskToReward", label: "RR" },
              { key: "percentRisk", label: "Risk %" },
              { key: "percentPnL", label: "PnL %" },
              { key: "session", label: "Session" },
              { key: "status", label: "Status" },
              { key: "maxDrawdownR", label: "Max DD R" },
              { key: "maxRR", label: "Max RR" },
              { key: "accountName", label: "Account" },
            ]}
            accounts={accounts}
            selectedRows={selectedTrades}
            onSelectRow={handleSelectTrade}
            showCheckboxes={true}
            loading={loading}
            defaultVisibleColumns={[
              "entryTimestamp",
              "direction",
              "symbol",
              "volume",
              "riskAmount",
              "netPnL",
              "duration",
              "riskToReward",
              "percentRisk",
              "session",
              "status",
              "accountName",
            ]}
          />
        </div>
      )}
    </div>
  );

  const renderSymbolsTab = () => (
    <div style={{ maxWidth: 800 }}>
      <h2 style={{ marginBottom: 24 }}>Symbols Settings</h2>
      <SymbolSettings />
    </div>
  );

  return (
    <div style={{ padding: "24px 32px" }}>
      <div style={{ display: "flex", gap: 32 }}>
        {/* Sidebar */}
        <div
          style={{
            width: 240,
            borderRight: "1px solid #eee",
            paddingRight: 32,
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                width: "100%",
                padding: "12px 16px",
                background: activeTab === tab.id ? "#f4f6fa" : "transparent",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 12,
                color: activeTab === tab.id ? "#6C63FF" : "#333",
                marginBottom: 8,
                textAlign: "left",
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          {activeTab === "profile" && renderProfileTab()}
          {activeTab === "security" && renderSecurityTab()}
          {activeTab === "appearance" && renderAppearanceTab()}
          {activeTab === "colors" && renderColorsTab()}
          {activeTab === "recycle-bin" && renderRecycleBinTab()}
          {activeTab === "symbols" && renderSymbolsTab()}
        </div>
      </div>
    </div>
  );
}

export default Settings;
