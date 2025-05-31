import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  Timestamp,
  addDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { FaTrash, FaUndo } from "react-icons/fa";
import { useAuth } from "../contexts/AuthContext";
import { useAccount } from "../contexts/AccountContext";
import { useDataManagement } from "../hooks/useDataManagement";

function RecycleBin() {
  const [deletedTrades, setDeletedTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { accounts, selectedAccountIds } = useAccount();
  const { recoverTrade, isLoading: isRecovering } = useDataManagement();

  useEffect(() => {
    console.log("RecycleBin mounted/updated");
    console.log("User:", user?.uid);
    console.log(
      "User auth state:",
      user ? "Authenticated" : "Not authenticated"
    );
    console.log("Selected accounts:", selectedAccountIds);
    console.log("Accounts:", accounts);

    if (user && selectedAccountIds.length > 0) {
      fetchDeletedTrades();
    } else {
      console.log("Skipping fetch - missing user or no selected accounts");
      setLoading(false);
    }
  }, [user, selectedAccountIds]);

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
          console.log(
            "Collection reference created for path:",
            deletedTradesPath
          );

          const q = query(
            deletedTradesRef,
            where(
              "deletedAt",
              ">=",
              Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
            )
          );
          console.log("Query created with timestamp filter");

          console.log("Executing query for account:", accountId);
          const snapshot = await getDocs(q);
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
          console.error("Error details:", {
            code: accountError.code,
            message: accountError.message,
            stack: accountError.stack,
          });
        }
      }

      console.log("Total deleted trades found:", deletedTrades.length);
      setDeletedTrades(deletedTrades);
    } catch (error) {
      console.error("Error fetching deleted trades:", error);
      console.error("Error details:", {
        code: error.code,
        message: error.message,
        stack: error.stack,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (trade) => {
    if (!user?.uid) {
      console.error("No user ID available for restore");
      return;
    }

    try {
      await recoverTrade(trade.accountId, trade.id);
      // Refresh the list
      fetchDeletedTrades();
    } catch (error) {
      console.error("Error restoring trade:", error);
      alert("Error restoring trade: " + error.message);
    }
  };

  const handlePermanentDelete = async (trade) => {
    if (!user?.uid) {
      console.error("No user ID available for permanent delete");
      return;
    }

    if (
      !window.confirm("Are you sure you want to permanently delete this trade?")
    ) {
      return;
    }

    try {
      // Delete from deleted trades using the nested path
      const deletedTradesPath = `users/${user.uid}/accounts/${trade.accountId}/deletedTrades/${trade.id}`;
      console.log("Permanently deleting from path:", deletedTradesPath);
      await deleteDoc(doc(db, deletedTradesPath));
      fetchDeletedTrades();
    } catch (error) {
      console.error("Error permanently deleting trade:", error);
      console.error("Error details:", {
        code: error.code,
        message: error.message,
        stack: error.stack,
      });
      alert("Error deleting trade: " + error.message);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ padding: "20px" }}>
      <h2>Recycle Bin</h2>
      <p style={{ color: "#666", marginBottom: "20px" }}>
        Deleted trades are stored here for 7 days before being permanently
        removed.
      </p>

      {deletedTrades.length === 0 ? (
        <p>No deleted trades found.</p>
      ) : (
        <div
          style={{
            border: "1px solid #eee",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8f9fa" }}>
                <th
                  style={{
                    padding: "12px",
                    textAlign: "left",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  Symbol
                </th>
                <th
                  style={{
                    padding: "12px",
                    textAlign: "left",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  Type
                </th>
                <th
                  style={{
                    padding: "12px",
                    textAlign: "left",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  Entry
                </th>
                <th
                  style={{
                    padding: "12px",
                    textAlign: "left",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  Exit
                </th>
                <th
                  style={{
                    padding: "12px",
                    textAlign: "left",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  Deleted On
                </th>
                <th
                  style={{
                    padding: "12px",
                    textAlign: "left",
                    borderBottom: "1px solid #eee",
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {deletedTrades.map((trade) => (
                <tr key={trade.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "12px" }}>{trade.symbol}</td>
                  <td style={{ padding: "12px" }}>{trade.direction}</td>
                  <td style={{ padding: "12px" }}>{trade.entryPrice}</td>
                  <td style={{ padding: "12px" }}>{trade.exitPrice}</td>
                  <td style={{ padding: "12px" }}>
                    {trade.deletedAt?.toDate().toLocaleDateString()}
                  </td>
                  <td style={{ padding: "12px" }}>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => handleRestore(trade)}
                        style={{
                          padding: "6px",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#4CAF50",
                        }}
                        title="Restore Trade"
                      >
                        <FaUndo />
                      </button>
                      <button
                        onClick={() => handlePermanentDelete(trade)}
                        style={{
                          padding: "6px",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#F44336",
                        }}
                        title="Delete Permanently"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default RecycleBin;
