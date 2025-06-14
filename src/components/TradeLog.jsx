import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { useAccounts } from "../contexts/AccountsContext";
import { useNotes } from "../contexts/NotesContext";
import { useJournalNotes } from "../contexts/JournalNotesContext";
import { useTags } from "../contexts/TagsContext";
import { useTrades } from "../contexts/TradesContext";
import { TradeModal } from "./TradeModal";
import { useNavigate } from "react-router-dom";

const TradeLog = () => {
  const { user } = useAuth();
  const { accounts } = useAccounts();
  const { notes } = useNotes();
  const { journalNotes } = useJournalNotes();
  const { tags } = useTags();
  const { trades, setTrades } = useTrades();
  const [selectedAccountIds, setSelectedAccountIds] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState("all");
  const [sortOrder, setSortOrder] = useState("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [showTradeDetail, setShowTradeDetail] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const fetchTrades = async () => {
      try {
        const trades = [];
        for (const accountId of selectedAccountIds) {
          const tradesPath = `users/${user.uid}/accounts/${accountId}/trades`;
          const q = query(
            collection(db, tradesPath),
            orderBy("entryTimestamp", "desc")
          );
          const querySnapshot = await getDocs(q);
          const accountTrades = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            accountId: accountId,
            accountName:
              accounts.find((acc) => acc.id === accountId)?.name ||
              "Unknown Account",
          }));
          trades.push(...accountTrades);
        }
        setTrades(trades);
      } catch (error) {
        alert("Failed to fetch trades. Please try again.");
      }
    };

    fetchTrades();
  }, [user, selectedAccountIds, accounts]);

  const handleEditTrade = (trade) => {
    setSelectedTrade(trade);
    setEditForm({
      ...trade,
      entryDate: trade.entryDate || new Date().toISOString().split("T")[0],
      exitDate: trade.exitDate || new Date().toISOString().split("T")[0],
    });
    setEditOpen(true);
  };

  const handleEditCancel = () => {
    setEditForm(null);
    setEditOpen(false);
  };

  const handleEditSave = async () => {
    if (!user || !editForm) return;

    try {
      setEditSubmitting(true);
      const tradeRef = doc(
        db,
        `users/${user.uid}/accounts/${editForm.accountId}/trades`,
        editForm.id
      );

      const updatedTrade = {
        ...editForm,
        entryTimestamp: new Date(editForm.entryDate).getTime(),
        exitTimestamp: new Date(editForm.exitDate).getTime(),
        updatedAt: serverTimestamp(),
      };

      await updateDoc(tradeRef, updatedTrade);
      setEditOpen(false);
      setEditForm(null);
    } catch (error) {
      alert("Failed to update trade. Please try again.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteTrade = async (trade) => {
    if (!user) return;

    if (!window.confirm("Are you sure you want to delete this trade?")) {
      return;
    }

    try {
      const tradeRef = doc(
        db,
        `users/${user.uid}/accounts/${trade.accountId}/trades`,
        trade.id
      );
      await deleteDoc(tradeRef);
    } catch (error) {
      alert("Failed to delete trade. Please try again.");
    }
  };

  const handleTradeClick = (trade) => {
    // Get the account's initial balance
    const account = accounts.find((acc) => acc.id === trade.accountId);
    const initialBalance = account ? Number(account.initialBalance) : null;

    if (!initialBalance) {
      console.error("No initial balance found for account:", trade.accountId);
      return;
    }

    // Preserve mistakes array when recalculating
    const mistakes = Array.isArray(trade.mistakes) ? trade.mistakes : [];

    // Recalculate trade fields with the correct initial balance
    const recalculatedTrade = {
      ...recalculateTradeFields(trade, initialBalance),
      mistakes, // Ensure mistakes array is preserved
    };

    setSelectedTrade(recalculatedTrade);
    setShowTradeDetail(true);
  };

  const handleCloseTradeDetail = () => {
    setShowTradeDetail(false);
    setSelectedTrade(null);
  };

  const handleAddNote = async (trade) => {
    if (!user) return;

    try {
      const noteRef = collection(db, `users/${user.uid}/notes`);
      const newNote = {
        tradeId: trade.id,
        accountId: trade.accountId,
        symbol: trade.symbol,
        title: `Note for ${trade.symbol} trade`,
        content: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        tagIds: [],
      };

      const docRef = await addDoc(noteRef, newNote);
      navigate(`/notebook?note=${docRef.id}`);
    } catch (error) {
      alert("Failed to create note. Please try again.");
    }
  };

  const handleAddJournalNote = async (trade) => {
    if (!user) return;

    try {
      const noteRef = collection(db, `users/${user.uid}/journalNotes`);
      const newNote = {
        tradeId: trade.id,
        accountId: trade.accountId,
        symbol: trade.symbol,
        title: `Journal for ${trade.symbol} trade`,
        content: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        tagIds: [],
      };

      const docRef = await addDoc(noteRef, newNote);
      navigate(`/notebook?note=${docRef.id}`);
    } catch (error) {
      alert("Failed to create journal note. Please try again.");
    }
  };

  const getTagName = (tagId) => {
    const tag = tags.find((t) => t.id === tagId);
    return tag ? tag.name : "Unknown Tag";
  };

  const filteredTrades = trades.filter((trade) => {
    const matchesSearch =
      !searchQuery ||
      trade.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trade.accountName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAccount =
      selectedAccount === "all" || trade.accountId === selectedAccount;

    return matchesSearch && matchesAccount;
  });

  const sortedTrades = [...filteredTrades].sort((a, b) => {
    const dateA = a.entryTimestamp || 0;
    const dateB = b.entryTimestamp || 0;
    return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
  });

  return (
    <div style={{ padding: "20px", maxWidth: 1200, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 24 }}>Trade Log</h1>
        <button
          onClick={() => setShowTradeModal(true)}
          style={{
            padding: "8px 16px",
            background: "#6C63FF",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Add Trade
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <input
            type="text"
            placeholder="Search trades..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #eee",
              borderRadius: 8,
              fontSize: 14,
            }}
          />
        </div>
        <select
          value={selectedAccount}
          onChange={(e) => setSelectedAccount(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid #eee",
            borderRadius: 8,
            fontSize: 14,
            minWidth: 150,
          }}
        >
          <option value="all">All Accounts</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid #eee",
            borderRadius: 8,
            fontSize: 14,
            minWidth: 150,
          }}
        >
          <option value="desc">Newest First</option>
          <option value="asc">Oldest First</option>
        </select>
      </div>

      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          overflow: "hidden",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 14,
          }}
        >
          <thead>
            <tr
              style={{
                background: "#f7f8fa",
                borderBottom: "1px solid #eee",
              }}
            >
              <th
                style={{
                  padding: "12px 16px",
                  textAlign: "left",
                  fontWeight: 500,
                  color: "#666",
                }}
              >
                Date
              </th>
              <th
                style={{
                  padding: "12px 16px",
                  textAlign: "left",
                  fontWeight: 500,
                  color: "#666",
                }}
              >
                Symbol
              </th>
              <th
                style={{
                  padding: "12px 16px",
                  textAlign: "left",
                  fontWeight: 500,
                  color: "#666",
                }}
              >
                Account
              </th>
              <th
                style={{
                  padding: "12px 16px",
                  textAlign: "right",
                  fontWeight: 500,
                  color: "#666",
                }}
              >
                P/L
              </th>
              <th
                style={{
                  padding: "12px 16px",
                  textAlign: "right",
                  fontWeight: 500,
                  color: "#666",
                }}
              >
                P/L%
              </th>
              <th
                style={{
                  padding: "12px 16px",
                  textAlign: "center",
                  fontWeight: 500,
                  color: "#666",
                }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedTrades.map((trade) => (
              <tr
                key={trade.id}
                style={{
                  borderBottom: "1px solid #eee",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onClick={() => handleTradeClick(trade)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f7f8fa";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#fff";
                }}
              >
                <td style={{ padding: "12px 16px" }}>
                  {new Date(trade.entryTimestamp).toLocaleDateString()}
                </td>
                <td style={{ padding: "12px 16px", fontWeight: 500 }}>
                  {trade.symbol}
                </td>
                <td style={{ padding: "12px 16px", color: "#666" }}>
                  {trade.accountName}
                </td>
                <td
                  style={{
                    padding: "12px 16px",
                    textAlign: "right",
                    color: trade.profitLoss >= 0 ? "#52c41a" : "#ff4d4f",
                    fontWeight: 500,
                  }}
                >
                  ${trade.profitLoss.toFixed(2)}
                </td>
                <td
                  style={{
                    padding: "12px 16px",
                    textAlign: "right",
                    color: trade.profitLossPercent >= 0 ? "#52c41a" : "#ff4d4f",
                    fontWeight: 500,
                  }}
                >
                  {trade.profitLossPercent.toFixed(2)}%
                </td>
                <td style={{ padding: "12px 16px", textAlign: "center" }}>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      justifyContent: "center",
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditTrade(trade);
                      }}
                      style={{
                        padding: "4px 8px",
                        background: "none",
                        border: "1px solid #eee",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontSize: 12,
                        color: "#666",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTrade(trade);
                      }}
                      style={{
                        padding: "4px 8px",
                        background: "none",
                        border: "1px solid #ff4d4f",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontSize: 12,
                        color: "#ff4d4f",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showTradeModal && (
        <TradeModal
          onClose={() => setShowTradeModal(false)}
          onSave={async (tradeData) => {
            if (!user) return;

            try {
              const tradeRef = collection(
                db,
                `users/${user.uid}/accounts/${tradeData.accountId}/trades`
              );
              const newTrade = {
                ...tradeData,
                entryTimestamp: new Date(tradeData.entryDate).getTime(),
                exitTimestamp: new Date(tradeData.exitDate).getTime(),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              };

              await addDoc(tradeRef, newTrade);
              setShowTradeModal(false);
            } catch (error) {
              alert("Failed to create trade. Please try again.");
            }
          }}
          accounts={accounts}
        />
      )}

      {editOpen && editForm && (
        <TradeModal
          onClose={handleEditCancel}
          onSave={handleEditSave}
          accounts={accounts}
          initialData={editForm}
          isEditing={true}
        />
      )}

      {showTradeDetail && selectedTrade && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              width: "100%",
              maxWidth: 600,
              maxHeight: "90vh",
              overflow: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 20 }}>
                {selectedTrade.symbol} Trade Details
              </h2>
              <button
                onClick={handleCloseTradeDetail}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 20,
                  cursor: "pointer",
                  color: "#666",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <h3 style={{ margin: "0 0 10px 0", fontSize: 16 }}>Trade Info</h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ color: "#666", fontSize: 13 }}>Entry Date</div>
                  <div style={{ fontSize: 14 }}>
                    {new Date(
                      selectedTrade.entryTimestamp
                    ).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <div style={{ color: "#666", fontSize: 13 }}>Exit Date</div>
                  <div style={{ fontSize: 14 }}>
                    {new Date(selectedTrade.exitTimestamp).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <div style={{ color: "#666", fontSize: 13 }}>Account</div>
                  <div style={{ fontSize: 14 }}>
                    {selectedTrade.accountName}
                  </div>
                </div>
                <div>
                  <div style={{ color: "#666", fontSize: 13 }}>Symbol</div>
                  <div style={{ fontSize: 14 }}>{selectedTrade.symbol}</div>
                </div>
                <div>
                  <div style={{ color: "#666", fontSize: 13 }}>Entry Price</div>
                  <div style={{ fontSize: 14 }}>
                    ${selectedTrade.entryPrice}
                  </div>
                </div>
                <div>
                  <div style={{ color: "#666", fontSize: 13 }}>Exit Price</div>
                  <div style={{ fontSize: 14 }}>${selectedTrade.exitPrice}</div>
                </div>
                <div>
                  <div style={{ color: "#666", fontSize: 13 }}>Quantity</div>
                  <div style={{ fontSize: 14 }}>{selectedTrade.quantity}</div>
                </div>
                <div>
                  <div style={{ color: "#666", fontSize: 13 }}>Position</div>
                  <div style={{ fontSize: 14 }}>{selectedTrade.position}</div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <h3 style={{ margin: "0 0 10px 0", fontSize: 16 }}>P/L</h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ color: "#666", fontSize: 13 }}>Profit/Loss</div>
                  <div
                    style={{
                      fontSize: 14,
                      color:
                        selectedTrade.profitLoss >= 0 ? "#52c41a" : "#ff4d4f",
                      fontWeight: 500,
                    }}
                  >
                    ${selectedTrade.profitLoss.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div style={{ color: "#666", fontSize: 13 }}>P/L%</div>
                  <div
                    style={{
                      fontSize: 14,
                      color:
                        selectedTrade.profitLossPercent >= 0
                          ? "#52c41a"
                          : "#ff4d4f",
                      fontWeight: 500,
                    }}
                  >
                    {selectedTrade.profitLossPercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>

            {selectedTrade.tags && selectedTrade.tags.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: "0 0 10px 0", fontSize: 16 }}>Tags</h3>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {selectedTrade.tags.map((tagId) => (
                    <span
                      key={tagId}
                      style={{
                        background: "#f0f0f0",
                        padding: "4px 8px",
                        borderRadius: 4,
                        fontSize: 12,
                        color: "#666",
                      }}
                    >
                      {getTagName(tagId)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: 12,
                justifyContent: "flex-end",
                marginTop: 24,
              }}
            >
              <button
                onClick={() => handleAddNote(selectedTrade)}
                style={{
                  padding: "8px 16px",
                  background: "#fff",
                  border: "1px solid #6C63FF",
                  borderRadius: 8,
                  color: "#6C63FF",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Add Note
              </button>
              <button
                onClick={() => handleAddJournalNote(selectedTrade)}
                style={{
                  padding: "8px 16px",
                  background: "#fff",
                  border: "1px solid #6C63FF",
                  borderRadius: 8,
                  color: "#6C63FF",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Add Journal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeLog;
