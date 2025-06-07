import React, { useState, useEffect, useRef } from "react";
import {
  FaPlus,
  FaEllipsisV,
  FaEdit,
  FaTrash,
  FaGripVertical,
  FaStickyNote,
  FaTimes,
  FaCheck,
} from "react-icons/fa";
import Modal from "react-modal";
import { useAuth } from "../contexts/AuthContext";
import { useAccount } from "../contexts/AccountContext";
import { useSetups } from "../contexts/SetupsContext";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  onSnapshot,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useTradeLog } from "../contexts/TradeLogContext";
import TradeTable from "../components/TradeTable";
import TradeModal from "../components/TradeModal";
import {
  NotesModal,
  storeSetupNotes,
  fetchSetupNotes,
} from "../components/Notes";
import ColorPicker from "../components/ColorPicker";

const thStyle = {
  padding: "10px 8px",
  textAlign: "left",
  color: "#888",
  fontWeight: 600,
  fontSize: 14,
  borderBottom: "2px solid #f0f0f0",
  whiteSpace: "nowrap",
};
const tdStyle = {
  padding: "10px 8px",
  color: "#333",
  fontSize: 15,
  whiteSpace: "nowrap",
  background: "#fff",
};

function Setups() {
  const { user } = useAuth();
  const { setups, loading: setupsLoading } = useSetups();
  const { trades: globalTrades = [] } = useTradeLog();
  const [activeTab, setActiveTab] = useState("my");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.ceil(setups.length / pageSize);
  const pagedSetups = setups.slice((page - 1) * pageSize, page * pageSize);

  const [selectedSetup, setSelectedSetup] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create Setup form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [colors, setColors] = useState([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // Fetch colors from Firestore
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
  }, []); // Only run on mount

  // Ensure default color is set when colors are loaded and modal is open
  useEffect(() => {
    if (showCreateModal && colors.length > 0 && !selectedColor) {
      setSelectedColor(colors[0].id);
    }
  }, [showCreateModal, colors, selectedColor]);

  const openSetupDetail = (setup) => {
    setSelectedSetup(setup);
    setShowDetailModal(true);
  };
  const closeSetupDetail = () => {
    setShowDetailModal(false);
    setSelectedSetup(null);
  };

  const handleCreateSetup = () => {
    setShowCreateModal(true);
    setName("");
    setDescription("");
    setError("");
    // Set default color to the first color if available
    if (colors.length > 0) {
      setSelectedColor(colors[0].id);
    }
  };
  const closeCreateModal = () => {
    setShowCreateModal(false);
    setError("");
  };

  // Handle Create Setup submit
  const handleSubmitCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Playbook Name is required");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const setupsRef = collection(db, `users/${user.uid}/setups`);
      await addDoc(setupsRef, {
        name: name.trim(),
        description: description.trim(),
        color: selectedColor,
        createdAt: serverTimestamp(),
      });
      setShowCreateModal(false);
    } catch (err) {
      setError("Failed to create setup. Please try again.");
    }
    setCreating(false);
  };

  // Helper to get color value by color id
  const getColorValue = (colorId) => {
    const colorObj = colors.find((c) => c.id === colorId);
    return colorObj ? colorObj.color : "#eee";
  };

  // Helper to calculate stats for a setup from trades
  function getSetupStats(setup) {
    // Filter trades that belong to this setup
    const setupTrades = globalTrades.filter(
      (t) =>
        (Array.isArray(t.setups) && t.setups.includes(setup.id)) ||
        t.setups === setup.id ||
        t.setups === setup.name ||
        (Array.isArray(t.setupIds) && t.setupIds.includes(setup.id))
    );

    const tradesCount = setupTrades.length;
    const netPL = setupTrades.reduce(
      (sum, t) => sum + (Number(t.netPnL) || 0),
      0
    );
    const wins = setupTrades.filter((t) => t.status === "WIN").length;
    const losses = setupTrades.filter((t) => t.status === "LOSS").length;
    const winRate = tradesCount ? wins / tradesCount : 0;
    const avgTrade = tradesCount ? netPL / tradesCount : 0;
    const grossProfit = setupTrades
      .filter((t) => t.status === "WIN")
      .reduce((sum, t) => sum + (Number(t.netPnL) || 0), 0);
    const grossLoss = Math.abs(
      setupTrades
        .filter((t) => t.status === "LOSS")
        .reduce((sum, t) => sum + (Number(t.netPnL) || 0), 0)
    );
    const profitFactor = grossLoss
      ? grossProfit / grossLoss
      : grossProfit > 0
      ? Infinity
      : 0;

    return {
      tradesCount,
      netPL,
      winRate,
      avgTrade,
      profitFactor,
    };
  }

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: 32,
        overflowY: "auto",
        height: "100vh",
        boxSizing: "border-box",
      }}
    >
      {!selectedSetup ? (
        <>
          <div
            style={{ display: "flex", alignItems: "center", marginBottom: 24 }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  background: activeTab === "my" ? "#edeaff" : "#f4f6fa",
                  color: activeTab === "my" ? "#6C63FF" : "#888",
                  fontWeight: 600,
                  border: "none",
                  fontSize: 15,
                  cursor: "pointer",
                }}
                onClick={() => setActiveTab("my")}
              >
                My Setups
              </button>
              <button
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  background: activeTab === "shared" ? "#edeaff" : "#f4f6fa",
                  color: activeTab === "shared" ? "#6C63FF" : "#888",
                  fontWeight: 600,
                  border: "none",
                  fontSize: 15,
                  cursor: "pointer",
                }}
                onClick={() => setActiveTab("shared")}
              >
                Shared Setups
              </button>
            </div>
            <div style={{ flex: 1 }} />
            <button
              style={{
                background: "#6C63FF",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "8px 18px",
                fontWeight: 600,
                fontSize: 15,
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
              }}
              onClick={handleCreateSetup}
            >
              <FaPlus /> Create Setup
            </button>
          </div>
          {activeTab === "shared" ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px 24px",
                background: "#fff",
                borderRadius: 12,
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}
            >
              <h2 style={{ margin: "0 0 16px 0", color: "#6C63FF" }}>
                Coming Soon!
              </h2>
              <p style={{ color: "#666", fontSize: 16, margin: 0 }}>
                The ability to share and discover trading setups from other
                traders is coming soon.
              </p>
            </div>
          ) : (
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                padding: 0,
                overflow: "hidden",
              }}
            >
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 15,
                    minWidth: 900,
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f4f6fa" }}>
                      <th style={{ ...thStyle, width: 16 }}></th>
                      <th style={thStyle}>Setup Name</th>
                      <th style={thStyle}>Trades</th>
                      <th style={thStyle}>Net P&L</th>
                      <th style={thStyle}>Win Rate</th>
                      <th style={thStyle}>Avg Trade</th>
                      <th style={thStyle}>Profit Factor</th>
                      <th style={thStyle}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedSetups.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          style={{
                            textAlign: "center",
                            color: "#888",
                            padding: 32,
                          }}
                        >
                          No setups yet. Click "Create Setup" to get started!
                        </td>
                      </tr>
                    ) : (
                      pagedSetups.map((setup, idx) => {
                        const {
                          tradesCount,
                          netPL,
                          winRate,
                          avgTrade,
                          profitFactor,
                        } = getSetupStats(setup);
                        return (
                          <tr
                            key={setup.id}
                            style={{
                              borderBottom: "1px solid #f0f0f0",
                              background: idx % 2 === 0 ? "#fff" : "#f9faff",
                              cursor: "pointer",
                            }}
                            onClick={() => openSetupDetail(setup)}
                          >
                            {/* Vertical color bar */}
                            <td style={{ ...tdStyle, padding: 0, width: 16 }}>
                              <div
                                style={{
                                  width: 6,
                                  height: 32,
                                  borderRadius: 4,
                                  background: getColorValue(setup.color),
                                  margin: "0 auto",
                                }}
                              />
                            </td>
                            <td style={tdStyle}>{setup.name}</td>
                            <td style={tdStyle}>{tradesCount}</td>
                            <td
                              style={{
                                ...tdStyle,
                                color:
                                  netPL > 0
                                    ? "#389e0d"
                                    : netPL < 0
                                    ? "#cf1322"
                                    : "#222",
                                fontWeight: 600,
                              }}
                            >
                              {`$${netPL.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`}
                            </td>
                            <td style={tdStyle}>
                              {(winRate * 100).toFixed(2) + "%"}
                            </td>
                            <td
                              style={{
                                ...tdStyle,
                                color:
                                  avgTrade > 0
                                    ? "#389e0d"
                                    : avgTrade < 0
                                    ? "#cf1322"
                                    : "#222",
                              }}
                            >
                              {`$${avgTrade.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`}
                            </td>
                            <td style={tdStyle}>
                              {profitFactor === Infinity
                                ? "∞"
                                : profitFactor.toFixed(2)}
                            </td>
                            <td style={tdStyle}></td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  padding: 16,
                  color: "#888",
                  fontSize: 15,
                }}
              >
                Result: {setups.length === 0 ? 0 : (page - 1) * pageSize + 1} -{" "}
                {Math.min(page * pageSize, setups.length)} of {setups.length}{" "}
                setups
                <button
                  style={{
                    marginLeft: 24,
                    marginRight: 8,
                    background: "none",
                    border: "none",
                    color: page === 1 ? "#ccc" : "#6C63FF",
                    fontSize: 18,
                    cursor: page === 1 ? "not-allowed" : "pointer",
                  }}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  &#8592;
                </button>
                <span style={{ fontWeight: 600 }}>{page}</span>
                <button
                  style={{
                    marginLeft: 8,
                    background: "none",
                    border: "none",
                    color: page === totalPages ? "#ccc" : "#6C63FF",
                    fontSize: 18,
                    cursor: page === totalPages ? "not-allowed" : "pointer",
                  }}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  &#8594;
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <SetupDetailModal
          setup={selectedSetup}
          onClose={closeSetupDetail}
          colors={colors}
          getColorValue={getColorValue}
        />
      )}
      <Modal
        isOpen={showCreateModal}
        onRequestClose={closeCreateModal}
        contentLabel="Create Setup"
        style={{
          overlay: { zIndex: 1000, background: "rgba(0,0,0,0.3)" },
          content: {
            maxWidth: 600,
            margin: "auto",
            borderRadius: 12,
            padding: 32,
            minHeight: 300,
            background: "#fff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          },
        }}
        ariaHideApp={false}
      >
        <form onSubmit={handleSubmitCreate}>
          <h2 style={{ marginTop: 0, marginBottom: 24 }}>
            Create Trading Playbook
          </h2>
          {/* Reusable ColorPicker component */}
          <div style={{ marginBottom: 24 }}>
            <ColorPicker
              colors={colors}
              value={selectedColor}
              onChange={setSelectedColor}
              size={24}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              General Information
            </div>
            <div style={{ marginTop: 16 }}>
              <label style={{ fontWeight: 500 }}>Playbook Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter playbook name"
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  marginTop: 4,
                  marginBottom: 12,
                  fontSize: 16,
                }}
                required
              />
              <label style={{ fontWeight: 500 }}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add description to your trading playbook"
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  marginTop: 4,
                  marginBottom: 12,
                  fontSize: 16,
                  minHeight: 60,
                }}
              />
            </div>
          </div>
          {error && (
            <div style={{ color: "#cf1322", marginBottom: 12 }}>{error}</div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button
              type="button"
              onClick={closeCreateModal}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                border: "none",
                background: "#eee",
                color: "#888",
                fontWeight: 600,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                border: "none",
                background: "#6C63FF",
                color: "#fff",
                fontWeight: 600,
                fontSize: 15,
                cursor: creating ? "not-allowed" : "pointer",
              }}
            >
              {creating ? "Creating..." : "Create Setup"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function SetupDetailModal({ setup, onClose, colors, getColorValue }) {
  const { user } = useAuth();
  const { accounts, selectedAccountIds } = useAccount();
  const { trades: globalTrades } = useTradeLog();
  const [executedTrades, setExecutedTrades] = useState([]);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [error, setError] = useState(null);
  const [ruleGroups, setRuleGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [tab, setTab] = useState("overview");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupError, setGroupError] = useState("");
  const [showCreateRule, setShowCreateRule] = useState(null);
  const [newRule, setNewRule] = useState({
    name: "",
    followRate: "",
    netPL: "",
    profitFactor: "",
    winRate: "",
  });
  const [creatingRule, setCreatingRule] = useState(false);
  const [ruleError, setRuleError] = useState("");
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState(null);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [ruleMenuOpen, setRuleMenuOpen] = useState(null);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [editingRuleName, setEditingRuleName] = useState("");
  const [confirmDeleteRule, setConfirmDeleteRule] = useState(null);
  const [deletingRule, setDeletingRule] = useState(false);
  const [detailTrade, setDetailTrade] = useState(null);
  const [showTradeDetail, setShowTradeDetail] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [setupNotes, setSetupNotes] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(setup.name);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [colorLoading, setColorLoading] = useState(false);
  const [localName, setLocalName] = useState(setup.name); // for optimistic update
  const menuRef = useRef(null);
  const colorPickerRef = useRef(null);

  // Close menu and color picker when clicking outside
  useEffect(() => {
    if (!showMenu && !colorPickerOpen) return;
    const handleClick = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        colorPickerRef.current &&
        !colorPickerRef.current.contains(e.target)
      ) {
        setShowMenu(false);
        setColorPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu, colorPickerOpen]);

  // Clean up state when modal closes
  useEffect(() => {
    if (!setup) {
      setShowMenu(false);
      setColorPickerOpen(false);
      setRenaming(false);
    }
  }, [setup]);

  // Handler for renaming
  const handleRename = async () => {
    if (!renameValue.trim()) return;
    try {
      const setupRef = doc(db, `users/${user.uid}/setups/${setup.id}`);
      await updateDoc(setupRef, {
        name: renameValue.trim(),
        updatedAt: serverTimestamp(),
      });
      setLocalName(renameValue.trim()); // Optimistic update
      setRenaming(false);
      setShowMenu(false);
    } catch (err) {
      console.error("Error renaming setup:", err);
      setError("Failed to rename setup");
      setRenaming(false);
    }
  };

  const handleStartRename = () => {
    setRenameValue(setup.name);
    setRenaming(true);
    setShowMenu(false);
  };

  const handleCancelRename = () => {
    setRenaming(false);
    setRenameValue(setup.name);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleRename();
    } else if (e.key === "Escape") {
      handleCancelRename();
    }
  };

  const stats = [
    {
      label: "Total Trades",
      value: typeof setup.trades === "number" ? setup.trades : 0,
    },
    {
      label: "Net P&L",
      value:
        typeof setup.netPL === "number"
          ? `$${setup.netPL.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          : "$0.00",
      color:
        (setup.netPL ?? 0) > 0
          ? "#389e0d"
          : (setup.netPL ?? 0) < 0
          ? "#cf1322"
          : "#222",
    },
    {
      label: "Win Rate",
      value:
        typeof setup.winRate === "number"
          ? `${(setup.winRate * 100).toFixed(2)}%`
          : "0%",
    },
    {
      label: "Avg Trade",
      value:
        typeof setup.trades === "number" &&
        typeof setup.netPL === "number" &&
        setup.trades > 0
          ? `$${(setup.netPL / setup.trades).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          : "$0.00",
    },
    { label: "Best Trade", value: "$0.00" },
    { label: "Worst Trade", value: "$0.00" },
    { label: "Avg Win", value: "$0.00" },
    { label: "Avg Loss", value: "$0.00" },
    { label: "Largest Drawdown", value: "$0.00" },
    { label: "Profit Factor", value: "0.00" },
  ];

  useEffect(() => {
    if (!user || !setup?.id) return;
    setLoadingTrades(true);
    try {
      // Filter trades for this setup from globalTrades
      const setupTrades = globalTrades.filter(
        (trade) =>
          (Array.isArray(trade.setups) && trade.setups.includes(setup.id)) ||
          trade.setups === setup.id ||
          trade.setups === setup.name ||
          (Array.isArray(trade.setupIds) && trade.setupIds.includes(setup.id))
      );
      setExecutedTrades(setupTrades);
    } catch (err) {
      console.error("Error filtering trades:", err);
      setError("Failed to load trades");
    } finally {
      setLoadingTrades(false);
    }
  }, [user, setup, globalTrades]);

  // --- SUMMARY CALCULATION ---
  const totalTrades = executedTrades.length;
  const netPL = executedTrades.reduce(
    (sum, t) => sum + (Number(t.netPnL) || 0),
    0
  );
  const wins = executedTrades.filter((t) => t.status === "WIN").length;
  const losses = executedTrades.filter((t) => t.status === "LOSS").length;
  const winRate = totalTrades ? wins / totalTrades : 0;
  const avgTrade = totalTrades ? netPL / totalTrades : 0;
  const bestTrade = executedTrades.reduce(
    (max, t) => Math.max(max, Number(t.netPnL) || 0),
    0
  );
  const worstTrade = executedTrades.reduce(
    (min, t) => Math.min(min, Number(t.netPnL) || 0),
    0
  );
  const avgWin = wins
    ? executedTrades
        .filter((t) => t.status === "WIN")
        .reduce((sum, t) => sum + (Number(t.netPnL) || 0), 0) / wins
    : 0;
  const avgLoss = losses
    ? executedTrades
        .filter((t) => t.status === "LOSS")
        .reduce((sum, t) => sum + (Number(t.netPnL) || 0), 0) / losses
    : 0;
  const grossProfit = executedTrades
    .filter((t) => t.status === "WIN")
    .reduce((sum, t) => sum + (Number(t.netPnL) || 0), 0);
  const grossLoss = Math.abs(
    executedTrades
      .filter((t) => t.status === "LOSS")
      .reduce((sum, t) => sum + (Number(t.netPnL) || 0), 0)
  );
  const profitFactor = grossLoss
    ? grossProfit / grossLoss
    : grossProfit > 0
    ? Infinity
    : 0;

  // --- RULES SUMMARY ---
  const ruleStats = (setup.ruleGroups || []).map((group) => ({
    ...group,
    rules: (group.rules || []).map((rule) => {
      const tradesWithRule = executedTrades.filter(
        (t) =>
          Array.isArray(t.selectedRules) && t.selectedRules.includes(rule.id)
      );
      const ruleTotal = tradesWithRule.length;
      const ruleWins = tradesWithRule.filter((t) => t.status === "WIN").length;
      const ruleNetPL = tradesWithRule.reduce(
        (sum, t) => sum + (Number(t.netPnL) || 0),
        0
      );
      const ruleWinRate = ruleTotal ? ruleWins / ruleTotal : 0;
      return {
        ...rule,
        ruleTotal,
        ruleNetPL,
        ruleWinRate,
      };
    }),
  }));

  // --- UI: Overview tab ---
  const calculatedStats = [
    { label: "Total Trades", value: totalTrades },
    {
      label: "Net P&L",
      value: `$${netPL.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      color: netPL > 0 ? "#389e0d" : netPL < 0 ? "#cf1322" : "#222",
    },
    { label: "Win Rate", value: `${(winRate * 100).toFixed(2)}%` },
    {
      label: "Avg Trade",
      value: `$${avgTrade.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    },
    {
      label: "Best Trade",
      value: `$${bestTrade.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    },
    {
      label: "Worst Trade",
      value: `$${worstTrade.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    },
    {
      label: "Avg Win",
      value: `$${avgWin.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    },
    {
      label: "Avg Loss",
      value: `$${avgLoss.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    },
    {
      label: "Profit Factor",
      value: profitFactor === Infinity ? "∞" : profitFactor.toFixed(2),
    },
  ];

  // Fetch rule groups and rules when Rules tab is active (real-time for both)
  useEffect(() => {
    if (tab !== "rules" || !user || !setup?.id) return;
    setLoadingGroups(true);

    const groupsRef = collection(
      db,
      `users/${user.uid}/setups/${setup.id}/ruleGroups`
    );
    let unsubRulesArr = [];
    const unsubGroups = onSnapshot(groupsRef, (groupsSnap) => {
      const groups = groupsSnap.docs.map((groupDoc) => ({
        id: groupDoc.id,
        ...groupDoc.data(),
        rules: [],
      }));

      // Remove previous rules listeners
      unsubRulesArr.forEach((unsub) => unsub());
      unsubRulesArr = [];

      // For each group, set up a real-time listener for its rules
      groups.forEach((group, idx) => {
        const rulesRef = collection(
          db,
          `users/${user.uid}/setups/${setup.id}/ruleGroups/${group.id}/rules`
        );
        const unsubRules = onSnapshot(rulesRef, (rulesSnap) => {
          setRuleGroups((prevGroups) => {
            // Find the group by id (not by idx, in case of reordering)
            const newGroups = prevGroups.map((g) =>
              g.id === group.id
                ? {
                    ...g,
                    rules: rulesSnap.docs.map((ruleDoc) => ({
                      id: ruleDoc.id,
                      ...ruleDoc.data(),
                    })),
                  }
                : g
            );
            return newGroups;
          });
        });
        unsubRulesArr.push(unsubRules);
      });

      setRuleGroups(groups);
      setLoadingGroups(false);
    });

    // Cleanup function for both groups and rules listeners
    return () => {
      unsubGroups();
      unsubRulesArr.forEach((unsub) => unsub());
    };
  }, [tab, user, setup]);

  // Create Group handler
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      setGroupError("Group name is required");
      return;
    }
    setCreatingGroup(true);
    setGroupError("");
    try {
      const groupsRef = collection(
        db,
        `users/${user.uid}/setups/${setup.id}/ruleGroups`
      );
      await addDoc(groupsRef, {
        name: newGroupName.trim(),
        createdAt: serverTimestamp(),
      });
      setShowCreateGroup(false);
      setNewGroupName("");
    } catch (err) {
      setGroupError("Failed to create group. Try again.");
    }
    setCreatingGroup(false);
  };

  // Create Rule handler
  const handleCreateRule = async (e, groupId) => {
    e.preventDefault();
    if (!newRule.name.trim()) {
      setRuleError("Rule name is required");
      return;
    }
    setCreatingRule(true);
    setRuleError("");
    try {
      const path = `users/${user.uid}/setups/${setup.id}/ruleGroups/${groupId}/rules`;
      console.log("Creating rule at path:", path);
      console.log("Rule data:", {
        name: newRule.name.trim(),
        followRate: newRule.followRate ? Number(newRule.followRate) : null,
        netPL: newRule.netPL ? Number(newRule.netPL) : null,
        profitFactor: newRule.profitFactor || null,
        winRate: newRule.winRate ? Number(newRule.winRate) : null,
        createdAt: serverTimestamp(),
      });
      console.log(
        "user.uid:",
        user?.uid,
        "setup.id:",
        setup?.id,
        "groupId:",
        groupId
      );
      const rulesRef = collection(db, path);
      await addDoc(rulesRef, {
        name: newRule.name.trim(),
        followRate: newRule.followRate ? Number(newRule.followRate) : null,
        netPL: newRule.netPL ? Number(newRule.netPL) : null,
        profitFactor: newRule.profitFactor || null,
        winRate: newRule.winRate ? Number(newRule.winRate) : null,
        createdAt: serverTimestamp(),
      });
      setShowCreateRule(null);
      setNewRule({
        name: "",
        followRate: "",
        netPL: "",
        profitFactor: "",
        winRate: "",
      });
    } catch (err) {
      setRuleError("Failed to create rule. Try again.");
      console.error("Error creating rule:", err);
    }
    setCreatingRule(false);
  };

  // Edit group name handler
  const handleEditGroup = (group) => {
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
  };
  const handleCancelEditGroup = () => {
    setEditingGroupId(null);
    setEditingGroupName("");
  };
  const handleSaveEditGroup = async (groupId) => {
    if (!editingGroupName.trim()) return;
    try {
      const groupRef = doc(
        db,
        `users/${user.uid}/setups/${setup.id}/ruleGroups/${groupId}`
      );
      await updateDoc(groupRef, { name: editingGroupName.trim() });
      setEditingGroupId(null);
      setEditingGroupName("");
    } catch (err) {
      // Optionally show error
    }
  };

  // Delete group handler
  const handleDeleteGroup = async (groupId) => {
    setDeletingGroup(true);
    try {
      const groupRef = doc(
        db,
        `users/${user.uid}/setups/${setup.id}/ruleGroups/${groupId}`
      );
      await deleteDoc(groupRef);
      setConfirmDeleteGroupId(null);
    } catch (err) {
      // Optionally show error
    }
    setDeletingGroup(false);
  };

  // Rule menu handlers
  const handleRenameRule = (rule) => {
    setEditingRuleId(rule.id);
    setEditingRuleName(rule.name);
    setRuleMenuOpen(null);
  };
  const handleCancelEditRule = () => {
    setEditingRuleId(null);
    setEditingRuleName("");
  };
  const handleSaveEditRule = async (groupId, ruleId) => {
    if (!editingRuleName.trim()) return;
    try {
      const ruleRef = doc(
        db,
        `users/${user.uid}/setups/${setup.id}/ruleGroups/${groupId}/rules/${ruleId}`
      );
      await updateDoc(ruleRef, { name: editingRuleName.trim() });
      setEditingRuleId(null);
      setEditingRuleName("");
    } catch (err) {}
  };
  const handleDeleteRule = async (groupId, ruleId) => {
    setDeletingRule(true);
    try {
      const ruleRef = doc(
        db,
        `users/${user.uid}/setups/${setup.id}/ruleGroups/${groupId}/rules/${ruleId}`
      );
      await deleteDoc(ruleRef);
      setConfirmDeleteRule(null);
    } catch (err) {}
    setDeletingRule(false);
  };

  // Update useEffect to use fetchSetupNotes
  useEffect(() => {
    const loadSetupNotes = async () => {
      if (user && setup?.id) {
        const notes = await fetchSetupNotes(user.uid, setup.id);
        if (notes) {
          setSetupNotes(notes);
        }
      }
    };
    loadSetupNotes();
  }, [user, setup?.id]);

  // Update handler to use storeSetupNotes
  const handleNotesChange = async (newNotes) => {
    if (user && setup?.id) {
      await storeSetupNotes(user.uid, setup.id, newNotes);
      setSetupNotes(newNotes);
    }
  };

  // Handler for color change
  const handleColorChange = async (colorId) => {
    try {
      setColorLoading(true);
      const setupRef = doc(db, `users/${user.uid}/setups/${setup.id}`);
      await updateDoc(setupRef, { color: colorId });
      // Update the local setup object to reflect the change immediately
      setup.color = colorId;
      setColorPickerOpen(false);
    } catch (err) {
      console.error("Error updating color:", err);
    } finally {
      setColorLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={onClose}
        style={{
          display: "flex",
          alignItems: "center",
          background: "none",
          border: "none",
          color: "#6C63FF",
          fontSize: 20,
          cursor: "pointer",
          padding: "4px",
          marginBottom: 4,
          fontWeight: 600,
        }}
      >
        &#11164;
      </button>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        {/* Vertical color bar */}
        <div
          style={{
            width: 16,
            display: "flex",
            alignItems: "center",
            marginRight: 10,
          }}
        >
          <div
            style={{
              width: 6,
              height: 32,
              borderRadius: 4,
              background: getColorValue(setup.color),
              margin: "0 auto",
            }}
          />
        </div>
        {renaming ? (
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleKeyPress}
            style={{
              fontSize: 22,
              fontWeight: 700,
              border: "1px solid #ddd",
              borderRadius: 4,
              padding: "4px 8px",
              outline: "none",
              width: "auto",
              minWidth: 200,
            }}
            autoFocus
          />
        ) : (
          <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
            {localName}
          </h3>
        )}
        <div style={{ flex: 1 }} />
        {/* Three-dot menu */}
        <div style={{ position: "relative", marginRight: 8 }} ref={menuRef}>
          <FaEllipsisV
            style={{ fontSize: 20, color: "#888", cursor: "pointer" }}
            onClick={() => {
              setShowMenu((v) => !v);
              setColorPickerOpen(false);
            }}
          />
          {showMenu && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 28,
                background: "#fff",
                border: "1px solid #eee",
                borderRadius: 8,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                zIndex: 20,
                minWidth: 140,
              }}
            >
              <button
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px 16px",
                  background: "none",
                  border: "none",
                  textAlign: "left",
                  fontSize: 15,
                  cursor: "pointer",
                }}
                onClick={handleStartRename}
              >
                Rename
              </button>
              <button
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px 16px",
                  background: "none",
                  border: "none",
                  textAlign: "left",
                  fontSize: 15,
                  cursor: "pointer",
                }}
                onClick={() => {
                  setColorPickerOpen(true);
                  setShowMenu(false);
                }}
              >
                Change Color
              </button>
            </div>
          )}
          {/* Color picker popover for editing color */}
          {colorPickerOpen && (
            <div
              ref={colorPickerRef}
              style={{
                position: "absolute",
                right: 0,
                top: 60,
                zIndex: 30,
                minWidth: 160,
                maxWidth: 220,
                overflow: "visible",
                left: "auto",
                // Responsive: if would overflow right, align left
                ...(window.innerWidth && window.innerWidth - 220 < 300
                  ? { left: 0, right: "auto" }
                  : {}),
              }}
            >
              <ColorPicker
                colors={colors}
                value={setup.color}
                onChange={handleColorChange}
                size={24}
              />
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            fontSize: 22,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#888",
            marginLeft: 8,
          }}
        >
          ×
        </button>
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {["overview", "rules", "executed", "notes"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              background: tab === t ? "#edeaff" : "#f4f6fa",
              color: tab === t ? "#6C63FF" : "#888",
              fontWeight: 600,
              border: "none",
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            {t === "overview" && "Overview"}
            {t === "rules" && "Rules"}
            {t === "executed" && "Executed Trades"}
            {t === "notes" && "Notes"}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 24,
              marginBottom: 32,
            }}
          >
            {calculatedStats.slice(0, 6).map((s) => (
              <div
                key={s.label}
                style={{
                  flex: 1,
                  minWidth: 140,
                  background: "#fff",
                  borderRadius: 12,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 4,
                }}
              >
                <div style={{ color: "#888", fontSize: 13 }}>{s.label}</div>
                <div
                  style={{
                    color: s.color || "#222",
                    fontWeight: 600,
                    fontSize: 20,
                  }}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 24,
              marginBottom: 32,
            }}
          >
            {calculatedStats.slice(6).map((s) => (
              <div
                key={s.label}
                style={{
                  flex: 1,
                  minWidth: 140,
                  background: "#fff",
                  borderRadius: 12,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 4,
                }}
              >
                <div style={{ color: "#888", fontSize: 13 }}>{s.label}</div>
                <div
                  style={{
                    color: s.color || "#222",
                    fontWeight: 600,
                    fontSize: 20,
                  }}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              background: "#f8f9fa",
              borderRadius: 12,
              padding: 32,
              minHeight: 280,
              marginBottom: 16,
            }}
          >
            <div style={{ color: "#888", fontWeight: 600, marginBottom: 12 }}>
              Daily Net Cumulative P&L
            </div>
            {/* Placeholder for chart */}
            <div
              style={{
                height: 200,
                background: "linear-gradient(180deg, #edeaff 0%, #fff 100%)",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#bbb",
                fontSize: 22,
              }}
            >
              [P&L Chart Placeholder]
            </div>
          </div>
        </>
      )}
      {tab === "executed" && (
        <div>
          {loadingTrades ? (
            <div style={{ color: "#888", textAlign: "center", padding: 32 }}>
              Loading trades...
            </div>
          ) : error ? (
            <div
              style={{
                color: "#cf1322",
                textAlign: "center",
                padding: 32,
                background: "#fff2f0",
                borderRadius: 8,
                border: "1px solid #ffccc7",
              }}
            >
              {error}
            </div>
          ) : executedTrades.length === 0 ? (
            <div style={{ color: "#888", textAlign: "center", padding: 32 }}>
              No trades found for this setup.
            </div>
          ) : (
            <>
              <TradeTable
                trades={executedTrades}
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
                showCheckboxes={false}
                loading={loadingTrades}
                defaultVisibleColumns={[
                  "entryTimestamp",
                  "symbol",
                  "direction",
                  "netPnL",
                  "accountName",
                ]}
                onRowClick={(trade) => {
                  setDetailTrade(trade);
                  setShowTradeDetail(true);
                }}
              />
              {showTradeDetail && detailTrade && (
                <TradeModal
                  open={showTradeDetail}
                  onClose={() => setShowTradeDetail(false)}
                  trade={detailTrade}
                  setups={[setup]}
                  accounts={accounts}
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
                  editMode={false}
                  setupColors={Object.fromEntries(
                    colors.map((c) => [c.id, c.color])
                  )}
                />
              )}
            </>
          )}
        </div>
      )}
      {tab === "rules" && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 24,
            }}
          >
            <h3 style={{ margin: 0 }}>Rules</h3>
            <button
              onClick={() => setShowCreateGroup(true)}
              style={{
                background: "#6C63FF",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "8px 18px",
                fontWeight: 600,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              + Create Group
            </button>
          </div>
          {/* Common Table Header */}
          <div
            style={{
              display: "flex",
              background: "#f4f6fa",
              borderRadius: 8,
              fontWeight: 600,
              color: "#888",
              fontSize: 13,
              padding: "10px 0 10px 0",
              marginBottom: 8,
            }}
          >
            <div style={{ width: 32 }}></div>
            <div style={{ flex: 2, paddingLeft: 16 }}>Rule Name</div>
            <div style={{ flex: 1, textAlign: "right", paddingRight: 16 }}>
              Follow Rate
            </div>
            <div style={{ flex: 1, textAlign: "right", paddingRight: 16 }}>
              Net Profit / Loss
            </div>
            <div style={{ flex: 1, textAlign: "right", paddingRight: 16 }}>
              Profit Factor
            </div>
            <div style={{ flex: 1, textAlign: "right", paddingRight: 16 }}>
              Win Rate
            </div>
            <div style={{ width: 40 }}></div>
          </div>
          {loadingGroups ? (
            <div style={{ color: "#888", textAlign: "center", padding: 32 }}>
              Loading groups...
            </div>
          ) : ruleGroups.length === 0 ? (
            <div style={{ color: "#888", textAlign: "center", padding: 32 }}>
              No rule groups yet. Click "Create Group" to get started!
            </div>
          ) : (
            ruleGroups.map((group) => (
              <div
                key={group.id}
                style={{
                  marginBottom: 32,
                  background: "#fff",
                  borderRadius: 12,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                  padding: 0,
                }}
              >
                {/* Group Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    borderBottom: "1px solid #f0f0f0",
                    padding: "18px 0 18px 0",
                    background: "#fafbfc",
                    borderTopLeftRadius: 12,
                    borderTopRightRadius: 12,
                  }}
                >
                  <FaGripVertical
                    style={{
                      marginLeft: 16,
                      marginRight: 12,
                      color: "#bbb",
                      fontSize: 16,
                      cursor: "grab",
                    }}
                  />
                  {editingGroupId === group.id ? (
                    <>
                      <input
                        type="text"
                        value={editingGroupName}
                        onChange={(e) => setEditingGroupName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEditGroup(group.id);
                          if (e.key === "Escape") handleCancelEditGroup();
                        }}
                        style={{
                          flex: 2,
                          fontWeight: 700,
                          fontSize: 16,
                          padding: 4,
                          borderRadius: 4,
                          border: "1px solid #ccc",
                          marginRight: 8,
                        }}
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveEditGroup(group.id)}
                        style={{
                          color: "#6C63FF",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 16,
                          fontWeight: 600,
                          marginRight: 4,
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEditGroup}
                        style={{
                          color: "#888",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 16,
                          fontWeight: 600,
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <div
                        style={{
                          flex: 2,
                          fontWeight: 700,
                          fontSize: 16,
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        {group.name}
                        <button
                          onClick={() => handleEditGroup(group)}
                          style={{
                            marginLeft: 8,
                            color: "#6C63FF",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: 14,
                            display: "flex",
                            alignItems: "center",
                            opacity: 0.5,
                            transition: "opacity 0.2s",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.opacity = 1)
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.opacity = 0.5)
                          }
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteGroupId(group.id)}
                          style={{
                            marginLeft: 4,
                            color: "#cf1322",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            fontSize: 14,
                            display: "flex",
                            alignItems: "center",
                            opacity: 0.5,
                            transition: "opacity 0.2s",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.opacity = 1)
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.opacity = 0.5)
                          }
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </>
                  )}
                </div>
                {/* Rules List */}
                {group.rules.length === 0 && (
                  <div
                    style={{
                      color: "#888",
                      textAlign: "center",
                      padding: 12,
                      fontSize: 13,
                    }}
                  >
                    No rules yet.
                  </div>
                )}
                {group.rules.map((rule) => {
                  // --- CALCULATE STATS FOR THIS RULE ---
                  // Only use executedTrades (already filtered for this setup)
                  const tradesWithRule = executedTrades.filter(
                    (t) =>
                      Array.isArray(t.selectedRules) &&
                      t.selectedRules.includes(rule.id)
                  );
                  const ruleTotal = tradesWithRule.length;
                  const ruleNetPL = tradesWithRule.reduce(
                    (sum, t) => sum + (Number(t.netPnL) || 0),
                    0
                  );
                  const ruleWins = tradesWithRule.filter(
                    (t) => t.status === "WIN"
                  ).length;
                  const ruleLosses = tradesWithRule.filter(
                    (t) => t.status === "LOSS"
                  ).length;
                  const grossProfit = tradesWithRule
                    .filter((t) => t.status === "WIN")
                    .reduce((sum, t) => sum + (Number(t.netPnL) || 0), 0);
                  const grossLoss = Math.abs(
                    tradesWithRule
                      .filter((t) => t.status === "LOSS")
                      .reduce((sum, t) => sum + (Number(t.netPnL) || 0), 0)
                  );
                  const profitFactor = grossLoss
                    ? grossProfit / grossLoss
                    : grossProfit > 0
                    ? Infinity
                    : 0;
                  const ruleWinRate = ruleTotal ? ruleWins / ruleTotal : 0;
                  // ---
                  return (
                    <div
                      key={rule.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        borderBottom: "1px solid #f0f0f0",
                        padding: "10px 0 10px 0",
                        fontSize: 13,
                      }}
                    >
                      <FaGripVertical
                        style={{
                          marginLeft: 16,
                          marginRight: 12,
                          color: "#bbb",
                          fontSize: 16,
                          cursor: "grab",
                        }}
                      />
                      {editingRuleId === rule.id ? (
                        <>
                          <input
                            type="text"
                            value={editingRuleName}
                            onChange={(e) => setEditingRuleName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                handleSaveEditRule(group.id, rule.id);
                              if (e.key === "Escape") handleCancelEditRule();
                            }}
                            style={{
                              flex: 2,
                              fontSize: 13,
                              padding: 5,
                              borderRadius: 4,
                              border: "1px solid #ccc",
                              marginRight: 8,
                            }}
                            autoFocus
                          />
                          <button
                            onClick={() =>
                              handleSaveEditRule(group.id, rule.id)
                            }
                            style={{
                              color: "#6C63FF",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: 16,
                              fontWeight: 600,
                              marginRight: 4,
                            }}
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEditRule}
                            style={{
                              color: "#888",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: 16,
                              fontWeight: 600,
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <div style={{ flex: 2 }}>{rule.name}</div>
                      )}
                      <div
                        style={{
                          flex: 1,
                          textAlign: "right",
                          color: "#3b5cff",
                          fontWeight: 600,
                          paddingRight: 16,
                        }}
                      >
                        {totalTrades > 0
                          ? `${((ruleTotal / totalTrades) * 100).toFixed(1)} %`
                          : "-"}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          textAlign: "right",
                          paddingRight: 16,
                        }}
                      >
                        {`$${(ruleNetPL || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          textAlign: "right",
                          paddingRight: 16,
                        }}
                      >
                        {profitFactor === Infinity
                          ? "∞"
                          : profitFactor.toFixed(2)}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          textAlign: "right",
                          paddingRight: 16,
                        }}
                      >
                        {ruleTotal > 0
                          ? `${(ruleWinRate * 100).toFixed(2)} %`
                          : "-"}
                      </div>
                      <div
                        style={{
                          width: 40,
                          textAlign: "center",
                          position: "relative",
                        }}
                      >
                        <FaEllipsisV
                          style={{
                            color: "#888",
                            fontSize: 16,
                            cursor: "pointer",
                          }}
                          onClick={() =>
                            setRuleMenuOpen(
                              ruleMenuOpen &&
                                ruleMenuOpen.groupId === group.id &&
                                ruleMenuOpen.ruleId === rule.id
                                ? null
                                : { groupId: group.id, ruleId: rule.id }
                            )
                          }
                        />
                        {ruleMenuOpen &&
                          ruleMenuOpen.groupId === group.id &&
                          ruleMenuOpen.ruleId === rule.id && (
                            <div
                              style={{
                                position: "absolute",
                                right: 0,
                                top: 24,
                                background: "#fff",
                                border: "1px solid #eee",
                                borderRadius: 6,
                                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                                zIndex: 10,
                              }}
                            >
                              <button
                                onClick={() => handleRenameRule(rule)}
                                style={{
                                  display: "block",
                                  padding: "8px 16px",
                                  background: "none",
                                  border: "none",
                                  width: "100%",
                                  textAlign: "left",
                                  cursor: "pointer",
                                  fontSize: 14,
                                }}
                              >
                                Rename
                              </button>
                              <button
                                onClick={() =>
                                  setConfirmDeleteRule({
                                    groupId: group.id,
                                    ruleId: rule.id,
                                  })
                                }
                                style={{
                                  display: "block",
                                  padding: "8px 16px",
                                  background: "none",
                                  border: "none",
                                  width: "100%",
                                  textAlign: "left",
                                  color: "#cf1322",
                                  cursor: "pointer",
                                  fontSize: 14,
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                      </div>
                    </div>
                  );
                })}
                {/* Inline Create Rule Form */}
                {showCreateRule === group.id ? (
                  <form
                    onSubmit={(e) => handleCreateRule(e, group.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      borderBottom: "1px solid #f0f0f0",
                      padding: "10px 0 10px 0",
                      background: "#f8f9fa",
                    }}
                  >
                    <FaGripVertical
                      style={{
                        marginLeft: 16,
                        marginRight: 12,
                        color: "#bbb",
                        fontSize: 16,
                      }}
                    />
                    <input
                      type="text"
                      value={newRule.name}
                      onChange={(e) =>
                        setNewRule({ ...newRule, name: e.target.value })
                      }
                      placeholder="Rule Name"
                      style={{
                        flex: 2,
                        fontSize: 13,
                        padding: 5,
                        borderRadius: 4,
                        border: "1px solid #ccc",
                        marginRight: 8,
                      }}
                      required
                    />
                    <div style={{ width: 40, textAlign: "center" }}>
                      <button
                        type="submit"
                        disabled={creatingRule}
                        style={{
                          background: "#6C63FF",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          padding: "5px 10px",
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: creatingRule ? "not-allowed" : "pointer",
                        }}
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCreateRule(null)}
                        style={{
                          background: "#eee",
                          color: "#888",
                          border: "none",
                          borderRadius: 6,
                          padding: "5px 10px",
                          fontWeight: 600,
                          fontSize: 13,
                          marginLeft: 4,
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => {
                      setShowCreateRule(group.id);
                      setNewRule({
                        name: "",
                        followRate: "",
                        netPL: "",
                        profitFactor: "",
                        winRate: "",
                      });
                      setRuleError("");
                    }}
                    style={{
                      color: "#6C63FF",
                      background: "none",
                      border: "none",
                      fontWeight: 600,
                      cursor: "pointer",
                      margin: "10px 0 10px 56px",
                      fontSize: 13,
                    }}
                  >
                    + Create new rule
                  </button>
                )}
                {ruleError && showCreateRule === group.id && (
                  <div
                    style={{
                      color: "#cf1322",
                      marginLeft: 56,
                      marginBottom: 8,
                      fontSize: 13,
                    }}
                  >
                    {ruleError}
                  </div>
                )}
              </div>
            ))
          )}
          {/* Create Group Modal */}
          <Modal
            isOpen={showCreateGroup}
            onRequestClose={() => setShowCreateGroup(false)}
            ariaHideApp={false}
            style={{
              overlay: { zIndex: 1000, background: "rgba(0,0,0,0.3)" },
              content: {
                maxWidth: 400,
                margin: "auto",
                borderRadius: 12,
                padding: 32,
              },
            }}
          >
            <form onSubmit={handleCreateGroup}>
              <h3 style={{ marginTop: 0 }}>Create Group</h3>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Group name"
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  marginTop: 4,
                  marginBottom: 12,
                  fontSize: 16,
                }}
                required
              />
              {groupError && (
                <div style={{ color: "#cf1322", marginBottom: 8 }}>
                  {groupError}
                </div>
              )}
              <div
                style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
              >
                <button
                  type="button"
                  onClick={() => setShowCreateGroup(false)}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: "#eee",
                    color: "#888",
                    fontWeight: 600,
                    fontSize: 15,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingGroup}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: "#6C63FF",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 15,
                    cursor: creatingGroup ? "not-allowed" : "pointer",
                  }}
                >
                  {creatingGroup ? "Creating..." : "Create Group"}
                </button>
              </div>
            </form>
          </Modal>
        </div>
      )}
      {tab === "notes" && (
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 0,
            height: 400,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "24px 24px 0 24px",
              marginBottom: 0,
            }}
          >
            <h3 style={{ margin: 0 }}>Setup Notes</h3>
            <button
              onClick={() => {
                if (showNotesModal) {
                  // Save and exit edit mode
                  setShowNotesModal(false);
                } else {
                  setShowNotesModal(true);
                }
              }}
              style={{
                background: showNotesModal ? "#6C63FF" : "none",
                border: "none",
                cursor: "pointer",
                color: showNotesModal ? "#fff" : "#6C63FF",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 15,
                fontWeight: 600,
                padding: showNotesModal ? "8px 18px" : undefined,
                borderRadius: showNotesModal ? 8 : undefined,
                transition: "all 0.2s",
              }}
            >
              {showNotesModal ? <FaCheck /> : <FaEdit />}
              {showNotesModal ? "Save" : "Edit Notes"}
            </button>
          </div>
          <div
            style={{
              flex: 1,
              background: "#f7f8fa",
              borderRadius: 12,
              margin: 24,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <NotesModal
              open={true}
              onClose={() => {}}
              value={setupNotes}
              onChange={handleNotesChange}
              editMode={showNotesModal}
              inline={true}
              style={{
                position: "relative",
                boxShadow: "none",
                padding: 0,
                background: "transparent",
                width: "100%",
                height: "100%",
                minHeight: 0,
                flex: 1,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default Setups;
