import React, { useState } from "react";
import { collection } from "firebase/firestore";
import { addDoc } from "firebase/firestore";
import { toast } from "react-hot-toast";
import ExcelJS from "exceljs";
import { useAccounts } from "../contexts/AccountsContext";
import { useUser } from "../contexts/UserContext";
import { useDb } from "../contexts/DbContext";

const TradeUploadModal = ({ onClose }) => {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState("");
  const accounts = useAccounts();
  const user = useUser();
  const db = useDb();

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    try {
      setLoading(true);
      const data = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(data);
      const worksheet = workbook.worksheets[0];

      const trades = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row

        // Get the account's initial balance
        const account = accounts.find((acc) => acc.id === selectedAccount);
        const initialBalance = account ? Number(account.initialBalance) : null;

        if (!initialBalance) {
          console.error(
            "No initial balance found for account:",
            selectedAccount
          );
          return;
        }

        const trade = {
          symbol: row.getCell(1).value,
          direction: row.getCell(2).value,
          entryPrice: Number(row.getCell(3).value),
          exitPrice: Number(row.getCell(4).value),
          volume: Number(row.getCell(5).value),
          entryTimestamp: new Date(row.getCell(6).value),
          exitTimestamp: new Date(row.getCell(7).value),
          accountId: selectedAccount,
          userId: user.uid,
        };

        // Recalculate trade fields with the correct initial balance
        const recalculatedTrade = recalculateTradeFieldsUpload(
          trade,
          initialBalance
        );
        trades.push(recalculatedTrade);
      });

      // Upload trades in batches
      const batchSize = 500;
      for (let i = 0; i < trades.length; i += batchSize) {
        const batch = trades.slice(i, i + batchSize);
        const batchPromises = batch.map((trade) =>
          addDoc(collection(db, "trades"), trade)
        );
        await Promise.all(batchPromises);
      }

      onClose();
      toast.success("Trades uploaded successfully!");
    } catch (error) {
      console.error("Error uploading trades:", error);
      toast.error("Error uploading trades: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return <div>{/* Render your component content here */}</div>;
};

export default TradeUploadModal;
