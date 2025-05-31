import React, { useEffect, useState, useRef } from "react";
import {
  FaChartLine,
  FaPercentage,
  FaBalanceScale,
  FaTrophy,
  FaFilter,
  FaEdit,
  FaTrash,
  FaPlus,
} from "react-icons/fa";
import {
  collection,
  query,
  orderBy,
  where,
  onSnapshot,
  Timestamp,
  writeBatch,
  doc,
  updateDoc,
  getDocs,
  addDoc,
  deleteDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useDateRange } from "../contexts/DateRangeContext";
import { useAuth } from "../contexts/AuthContext";
import { useAccount } from "../contexts/AccountContext";
import Papa from "papaparse";
import Modal from "react-modal";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { storage } from "../firebase";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  uploadBytesResumable,
} from "firebase/storage";
import { supabase } from "../supabase";
import TradeModal from "../components/TradeModal";
import { useTradeLog } from "../contexts/TradeLogContext";
import { useSetups } from "../contexts/SetupsContext";
import ReactModal from "react-modal";
import TradeTable from "../components/TradeTable";
import {
  calcNetCumulativePnL,
  calcProfitFactor,
  calcWinPercentage,
  calcAvgWinLossRatio,
} from "../utils/tradeCalculations";
import { useDataManagement } from "../hooks/useDataManagement";
import { getSymbol } from "../services/SymbolService";

// CoreDrift Trade Log Page
// Handles trade import, upload, display, and summary calculations

// Initial structure for summary cards, icons and colors remain
const initialSummaryStructure = [
  {
    id: "netPnl",
    label: "Net Cumulative P&L",
    value: "$0.00",
    icon: <FaChartLine />,
    color: "#6C63FF",
    calculation: (trades) => `$${calcNetCumulativePnL(trades).toFixed(2)}`,
  },
  {
    id: "profitFactor",
    label: "Profit Factor",
    value: "N/A",
    icon: <FaBalanceScale />,
    color: "#00C9A7",
    calculation: (trades) => calcProfitFactor(trades),
  },
  {
    id: "winPercentage",
    label: "Trade Win %",
    value: "0%",
    icon: <FaTrophy />,
    color: "#52c41a",
    calculation: (trades) => calcWinPercentage(trades),
  },
  {
    id: "avgWinLossRatio",
    label: "Avg Win/Loss Ratio",
    value: "N/A",
    icon: <FaPercentage />,
    color: "#faad14",
    calculation: (trades) => calcAvgWinLossRatio(trades),
  },
];

const allTradeColumns = [
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
  { key: "riskToReward", label: "riskToReward" },
  { key: "percentRisk", label: "percentRisk" },
  { key: "percentPnL", label: "percentPnL" },
  { key: "session", label: "Session" },
  { key: "status", label: "Status" },
  { key: "maxDrawdownR", label: "Max DD R" },
  { key: "maxRR", label: "Max RR" },
  { key: "setups", label: "Setups" },
  { key: "accountName", label: "Account" },
];

// Helper for 24-hour time format without seconds
const formatDateTime24 = (dateObj) => {
  if (!dateObj) return "N/A";
  let d = dateObj;
  if (typeof d.toDate === "function") d = d.toDate();
  if (!(d instanceof Date)) d = new Date(d);
  if (isNaN(d)) return "N/A";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

// Add symbol and direction options
const symbolOptions = [
  "EURUSD",
  "XAUUSD",
  "GBPUSD",
  "USDJPY",
  "AUDUSD",
  "USDCAD",
  "USDCHF",
  "NZDUSD",
  // ...add more as needed
];
const directionOptions = ["Buy", "Sell"];

// Helper to recalculate derived fields for the trade detail modal
function recalculateTradeFields(form, initialBalance = 100000) {
  // Parse numbers
  const entryPrice = parseFloat(form.entryPrice);
  const exitPrice = parseFloat(form.exitPrice);
  const sl = parseFloat(form.sl);
  const volume = parseFloat(form.volume);
  const netPnL = parseFloat(form.netPnL);
  let entryTimestamp = form.entryTimestamp;
  let exitTimestamp = form.exitTimestamp;
  if (
    entryTimestamp &&
    typeof entryTimestamp === "object" &&
    entryTimestamp.seconds !== undefined
  ) {
    entryTimestamp = new Date(entryTimestamp.seconds * 1000);
  } else if (entryTimestamp instanceof Date) {
    // ok
  } else if (typeof entryTimestamp === "string" && entryTimestamp) {
    entryTimestamp = new Date(entryTimestamp);
  } else {
    entryTimestamp = null;
  }
  if (
    exitTimestamp &&
    typeof exitTimestamp === "object" &&
    exitTimestamp.seconds !== undefined
  ) {
    exitTimestamp = new Date(exitTimestamp.seconds * 1000);
  } else if (exitTimestamp instanceof Date) {
    // ok
  } else if (typeof exitTimestamp === "string" && exitTimestamp) {
    exitTimestamp = new Date(exitTimestamp);
  } else {
    exitTimestamp = null;
  }
  // Pip value
  let pipValue = 10;
  if (
    typeof form.symbol === "string" &&
    form.symbol.toUpperCase().startsWith("XAUUSD")
  )
    pipValue = 100;
  // Risk Amount
  let riskAmount = null;
  if (
    entryPrice !== undefined &&
    !isNaN(entryPrice) &&
    sl !== undefined &&
    !isNaN(sl) &&
    volume !== undefined &&
    !isNaN(volume)
  ) {
    riskAmount = Math.abs(entryPrice - sl) * volume * pipValue;
    riskAmount = Number(riskAmount.toFixed(2));
  }
  // Duration
  let duration = null;
  if (
    entryTimestamp &&
    exitTimestamp &&
    !isNaN(entryTimestamp) &&
    !isNaN(exitTimestamp)
  ) {
    duration = Math.round((exitTimestamp - entryTimestamp) / 60000);
  }
  // Session
  let session = "";
  if (entryTimestamp instanceof Date && !isNaN(entryTimestamp)) {
    const hour = entryTimestamp.getUTCHours();
    if (hour >= 13 && hour < 21) session = "NY";
    else if (hour >= 7 && hour < 16) session = "LN";
    else session = "AS";
  }
  // Risk to Reward
  let riskToReward = null;
  if (
    netPnL !== undefined &&
    !isNaN(netPnL) &&
    riskAmount !== null &&
    riskAmount !== 0
  ) {
    riskToReward = netPnL / riskAmount;
    riskToReward = Number(riskToReward.toFixed(2));
  }
  // Percent Risk
  let percentRisk = null;
  if (riskAmount !== null && initialBalance) {
    percentRisk = (riskAmount / initialBalance) * 100;
    percentRisk = Number(percentRisk.toFixed(2));
  }
  // Percent PnL
  let percentPnL = null;
  if (netPnL !== undefined && !isNaN(netPnL) && initialBalance) {
    percentPnL = (netPnL / initialBalance) * 100;
    percentPnL = Number(percentPnL.toFixed(2));
  }
  // Status
  let status = "";
  if (riskToReward !== null) {
    if (riskToReward > 0.15) status = "WIN";
    else if (riskToReward < -0.15) status = "LOSS";
    else status = "BE";
  }
  return {
    ...form,
    riskAmount,
    duration,
    session,
    riskToReward,
    percentRisk,
    percentPnL,
    status,
  };
}

// Helper to recalculate derived fields for upload modal
function recalculateTradeFieldsUpload(trade, initialBalance = 100000) {
  const entryPrice = parseFloat(trade.entryPrice);
  const exitPrice = parseFloat(trade.exitPrice);
  const sl = parseFloat(trade.sl);
  const volume = parseFloat(trade.volume);
  const netPnL = parseFloat(trade.netPnL);
  let openTime = trade.openTime;
  let closeTime = trade.closeTime;
  if (openTime && typeof openTime === "string") openTime = new Date(openTime);
  if (closeTime && typeof closeTime === "string")
    closeTime = new Date(closeTime);
  let pipValue = 10;
  if (
    typeof trade.symbol === "string" &&
    trade.symbol.toUpperCase().startsWith("XAUUSD")
  )
    pipValue = 100;
  let riskAmount = null;
  if (
    entryPrice !== undefined &&
    !isNaN(entryPrice) &&
    sl !== undefined &&
    !isNaN(sl) &&
    volume !== undefined &&
    !isNaN(volume)
  ) {
    riskAmount = Math.abs(entryPrice - sl) * volume * pipValue;
    riskAmount = Number(riskAmount.toFixed(2));
  }
  let duration = null;
  if (openTime && closeTime && !isNaN(openTime) && !isNaN(closeTime)) {
    duration = Math.round((closeTime - openTime) / 60000);
  }
  let session = "";
  if (openTime instanceof Date && !isNaN(openTime)) {
    const hour = openTime.getUTCHours();
    if (hour >= 13 && hour < 21) session = "NY";
    else if (hour >= 7 && hour < 16) session = "LN";
    else session = "AS";
  }
  // Calculate riskToReward first
  let riskToReward = null;
  if (
    netPnL !== undefined &&
    !isNaN(netPnL) &&
    riskAmount !== null &&
    riskAmount !== 0
  ) {
    riskToReward = netPnL / riskAmount;
    riskToReward = Number(riskToReward.toFixed(2));
  }
  let percentRisk = null;
  if (riskAmount !== null && initialBalance) {
    percentRisk = (riskAmount / initialBalance) * 100;
    percentRisk = Number(percentRisk.toFixed(2));
  }
  let percentPnL = null;
  if (netPnL !== undefined && !isNaN(netPnL) && initialBalance) {
    percentPnL = (netPnL / initialBalance) * 100;
    percentPnL = Number(percentPnL.toFixed(2));
  }
  // Now calculate status using the freshly calculated riskToReward
  let status = "";
  if (riskToReward !== null) {
    if (riskToReward > 0.15) status = "WIN";
    else if (riskToReward < -0.15) status = "LOSS";
    else status = "BE";
  }
  return {
    ...trade,
    riskAmount,
    duration,
    session,
    riskToReward,
    percentRisk,
    percentPnL,
    status,
  };
}

// Add normalizeTradeDates function
function normalizeTradeDates(trade) {
  if (!trade) return null;
  const dateFields = [
    "entryTimestamp",
    "exitTimestamp",
    "createdAt",
    "updatedAt",
  ];
  const result = { ...trade };
  dateFields.forEach((field) => {
    if (result[field]?.toDate) {
      const date = result[field].toDate();
      result[field] = date.toLocaleString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    }
  });
  return result;
}

function TradeLog() {
  const [trades, setTrades] = useState([]);
  const { setTrades: setGlobalTrades } = useTradeLog();
  const [loading, setLoading] = useState(true);
  const [calculatedSummaryData, setCalculatedSummaryData] = useState(
    initialSummaryStructure.map((s) => ({
      ...s,
      value: s.label.includes("P&L")
        ? "$0.00"
        : s.label.includes("Win %")
        ? "0%"
        : "N/A",
    }))
  );

  const { user } = useAuth();
  const { accounts, selectedAccountIds } = useAccount();
  const { startDate, endDate } = useDateRange();

  const [csvFile, setCsvFile] = useState(null);
  const [isProcessingCsv, setIsProcessingCsv] = useState(false);
  const fileInputRef = useRef(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [tradesToUpload, setTradesToUpload] = useState([]);
  const [selectedTrades, setSelectedTrades] = useState([]);
  const [selectedAccountsForUpload, setSelectedAccountsForUpload] = useState(
    []
  );
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("idle");
  const [visibleColumns, setVisibleColumns] = useState(
    allTradeColumns.map((col) => col.key)
  );
  const [showColumnFilter, setShowColumnFilter] = useState(false);

  const CONTRACT_SIZE = 100; // Change if you want a different default

  const [showAccountSelectModal, setShowAccountSelectModal] = useState(false);
  const [pendingCsvFile, setPendingCsvFile] = useState(null);

  const [selectedTableTrades, setSelectedTableTrades] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showMergeConfirm, setShowMergeConfirm] = useState(false);
  const [merging, setMerging] = useState(false);

  const [showTradeDetail, setShowTradeDetail] = useState(false);
  const [detailTrade, setDetailTrade] = useState(null);

  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const fileInputImageRef = useRef(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);

  const [showUploadEditModal, setShowUploadEditModal] = useState(false);
  const [uploadEditIdx, setUploadEditIdx] = useState(null);
  const [uploadEditForm, setUploadEditForm] = useState(null);

  // Upload edit modal image state
  const [uploadImageUploading, setUploadImageUploading] = useState(false);
  const [uploadImagePreviewUrl, setUploadImagePreviewUrl] = useState(null);
  const uploadFileInputImageRef = useRef(null);

  const { setups } = useSetups();

  // Add colors state
  const [colors, setColors] = useState([]);

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
  }, []);

  // Add setupColors mapping
  const setupColors = Object.fromEntries(
    setups.map((s) => {
      const colorObj = colors.find((c) => c.id === s.color);
      return [s.id, colorObj ? colorObj.color : "#eee"];
    })
  );

  // Define default visible columns for Trade Log
  const defaultVisibleColumns = [
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
  ];

  const { deleteTrade, isLoading: isDeleting } = useDataManagement();

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && (file.type === "text/csv" || file.name.endsWith(".csv"))) {
      setCsvFile(file);
      setShowAccountSelectModal(true);
    } else {
      alert("Please select a CSV file.");
      setCsvFile(null);
    }
  };

  const handleConfirmAccountSelect = async () => {
    if (!selectedAccountsForUpload[0]) {
      alert("Please select an account to import trades into.");
      return;
    }
    setShowAccountSelectModal(false);
    setIsProcessingCsv(true);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const csvText = event.target.result;
          // Split file into lines
          const lines = csvText.split("\n").map((line) => line.trim());
          // Detect delimiter (tab or comma)
          let delimiter = ",";
          if (lines.some((line) => line.includes("\t"))) {
            delimiter = "\t";
          }

          let positionsRows = [];
          let inPositions = false;
          let headerParsed = false;
          let positionsHeader = [];

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith("Positions")) {
              inPositions = true;
              headerParsed = false;
              continue;
            }
            if (inPositions && !headerParsed && line.startsWith("Time")) {
              positionsHeader = line.split(delimiter);
              headerParsed = true;
              continue;
            }
            if (inPositions && headerParsed) {
              if (
                line === "" ||
                line.startsWith("Orders") ||
                line.startsWith("Deals")
              ) {
                break; // End of Positions table
              }
              positionsRows.push(line.split(delimiter));
            }
          }

          // Find indices for duplicate columns
          const allIndices = (name) =>
            positionsHeader.reduce(
              (arr, h, i) =>
                h.trim().toLowerCase() === name.toLowerCase()
                  ? [...arr, i]
                  : arr,
              []
            );
          const timeIndices = allIndices("Time");
          const priceIndices = allIndices("Price");
          const stopLossIdx = positionsHeader.findIndex(
            (h) => h.trim().toLowerCase() === "s / l"
          );
          const commissionIdx = positionsHeader.findIndex(
            (h) => h.trim().toLowerCase() === "commission"
          );
          const swapIdx = positionsHeader.findIndex(
            (h) => h.trim().toLowerCase() === "swap"
          );
          const netPnLIdx = positionsHeader.findIndex(
            (h) => h.trim().toLowerCase() === "profit"
          );
          const directionIdx = positionsHeader.findIndex(
            (h) => h.trim().toLowerCase() === "type"
          );
          const symbolIdx = positionsHeader.findIndex(
            (h) => h.trim().toLowerCase() === "symbol"
          );
          const volumeIdx = positionsHeader.findIndex(
            (h) => h.trim().toLowerCase() === "volume"
          );
          const riskAmountIdx = positionsHeader.findIndex(
            (h) => h.trim().toLowerCase() === "risk amount"
          );

          // Get initial balance for calculations
          const selectedAccount = accounts.find(
            (acc) => acc.id === selectedAccountsForUpload[0]
          );
          const initialBalance = selectedAccount
            ? Number(selectedAccount.initialBalance)
            : 100000;

          // Map each row to a trade object
          const tradesToUpload = positionsRows
            .map((row) => {
              const openTimeStr =
                timeIndices.length > 0 ? row[timeIndices[0]] || "" : "";
              const closeTimeStr =
                timeIndices.length > 1 ? row[timeIndices[1]] || "" : "";
              const entryPrice =
                priceIndices.length > 0 && row[priceIndices[0]]
                  ? parseFloat(row[priceIndices[0]].replace(/\s/g, ""))
                  : null;
              const exitPrice =
                priceIndices.length > 1 && row[priceIndices[1]]
                  ? parseFloat(row[priceIndices[1]].replace(/\s/g, ""))
                  : null;
              const stopLoss =
                stopLossIdx !== -1 && row[stopLossIdx]
                  ? parseFloat(row[stopLossIdx].replace(/\s/g, ""))
                  : null;
              const netPnL =
                netPnLIdx !== -1 && row[netPnLIdx]
                  ? parseFloat(
                      row[netPnLIdx].replace(/\s/g, "").replace(",", "")
                    )
                  : null;
              const direction =
                directionIdx !== -1 && row[directionIdx]
                  ? row[directionIdx].charAt(0).toUpperCase() +
                    row[directionIdx].slice(1).toLowerCase()
                  : "";
              const riskAmount =
                riskAmountIdx !== -1 && row[riskAmountIdx]
                  ? parseFloat(row[riskAmountIdx].replace(/\s/g, ""))
                  : null;
              const symbol = symbolIdx !== -1 ? row[symbolIdx] || "" : "";
              const volume =
                volumeIdx !== -1 && row[volumeIdx]
                  ? parseFloat(row[volumeIdx].replace(/\s/g, ""))
                  : null;
              const commission =
                commissionIdx !== -1 && row[commissionIdx]
                  ? parseFloat(row[commissionIdx].replace(/\s/g, ""))
                  : null;
              const swap =
                swapIdx !== -1 && row[swapIdx]
                  ? parseFloat(row[swapIdx].replace(/\s/g, ""))
                  : null;

              // Normalize XAUUSD and EURUSD symbol
              let normalizedSymbol = symbol;
              if (typeof symbol === "string") {
                if (symbol.startsWith("XAUUSD")) {
                  normalizedSymbol = "XAUUSD";
                } else if (symbol.startsWith("EURUSD")) {
                  normalizedSymbol = "EURUSD";
                }
              }

              // Parse times
              const openTimeDate = openTimeStr
                ? new Date(openTimeStr.replace(/\./g, "-").replace(" ", "T"))
                : null;
              const closeTimeDate = closeTimeStr
                ? new Date(closeTimeStr.replace(/\./g, "-").replace(" ", "T"))
                : null;

              // Calculate duration in minutes
              let duration = null;
              if (openTimeDate && closeTimeDate) {
                duration = Math.round((closeTimeDate - openTimeDate) / 60000);
              }

              // Calculate riskToReward
              let riskToReward = null;
              if (netPnL !== null && riskAmount !== null && riskAmount !== 0) {
                riskToReward = netPnL / riskAmount;
              }

              // Calculate percentRisk
              let percentRisk = null;
              if (riskAmount !== null && initialBalance) {
                percentRisk = (riskAmount / initialBalance) * 100;
              }

              // Calculate percentPnL
              let percentPnL = null;
              if (netPnL !== null && initialBalance) {
                percentPnL = (netPnL / initialBalance) * 100;
              }

              // Calculate session
              let session = "";
              if (openTimeDate) {
                const hour = openTimeDate.getUTCHours();
                if (hour >= 13 && hour < 21) session = "NY";
                else if (hour >= 7 && hour < 16) session = "LN";
                else session = "AS";
              }

              // Calculate status
              let status = "";
              if (riskToReward !== null) {
                if (riskToReward > 0.15) status = "WIN";
                else if (riskToReward < -0.15) status = "LOSS";
                else status = "BE";
              }

              const trade = {
                entryTimestamp: openTimeDate,
                exitTimestamp: closeTimeDate,
                direction,
                symbol: normalizedSymbol,
                volume,
                entryPrice,
                exitPrice,
                sl: stopLoss,
                riskAmount,
                commission,
                swap,
                netPnL,
                duration,
                riskToReward,
                percentRisk,
                percentPnL,
                session,
                status,
                maxDrawdownR: null,
                maxRR: null,
                setups: "",
              };

              // Filter out incomplete rows
              if (
                !trade.entryTimestamp ||
                !trade.exitTimestamp ||
                !trade.symbol ||
                !trade.direction ||
                trade.entryPrice === null ||
                trade.exitPrice === null ||
                trade.netPnL === null
              ) {
                return null;
              }
              return trade;
            })
            .filter(Boolean);

          if (tradesToUpload.length === 0 && positionsRows.length > 0) {
            alert(
              "No valid positions found in the CSV after processing. Please check CSV content and mapping logic."
            );
          } else if (tradesToUpload.length > 0) {
            setTradesToUpload(tradesToUpload);
            setSelectedTrades(tradesToUpload.map((_, idx) => idx));
            setShowUploadModal(true);
          }
        } catch (error) {
          console.error("Error processing CSV:", error);
          alert("An error occurred while processing the CSV file.");
        } finally {
          setIsProcessingCsv(false);
          setCsvFile(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = null;
          }
        }
      };

      reader.readAsText(csvFile);
    } catch (error) {
      console.error("Error reading file:", error);
      alert("An error occurred while reading the file.");
      setIsProcessingCsv(false);
    }
  };

  useEffect(() => {
    if (!user || !user.email || accounts.length === 0) {
      setTrades([]);
      setGlobalTrades([]);
      setLoading(false);
      setCalculatedSummaryData(
        initialSummaryStructure.map((s) => ({
          ...s,
          value: s.label.includes("P&L")
            ? "$0.00"
            : s.label.includes("Win %")
            ? "0%"
            : "N/A",
        }))
      );
      return;
    }

    setLoading(true);
    const unsubscribes = [];

    const accountIdToNameMap = accounts.reduce((acc, current) => {
      acc[current.id] = current.name;
      return acc;
    }, {});

    // Use all accounts if none selected (All Accounts)
    const accountIdsToFetch =
      selectedAccountIds.length === 0
        ? accounts.map((a) => a.id)
        : selectedAccountIds;

    if (accountIdsToFetch.length === 0) {
      setTrades([]);
      setGlobalTrades([]);
      setLoading(false);
      return;
    }

    accountIdsToFetch.forEach((accountId) => {
      const tradesPath = `users/${user.uid}/accounts/${accountId}/trades`;
      let tradesQuery = query(collection(db, tradesPath));

      if (startDate) {
        try {
          tradesQuery = query(
            tradesQuery,
            where(
              "entryTimestamp",
              ">=",
              Timestamp.fromDate(new Date(startDate))
            )
          );
        } catch (e) {
          console.error("Error creating start date timestamp:", e);
        }
      }
      if (endDate) {
        try {
          const endOfDay = new Date(endDate);
          endOfDay.setHours(23, 59, 59, 999);
          tradesQuery = query(
            tradesQuery,
            where("entryTimestamp", "<=", Timestamp.fromDate(endOfDay))
          );
        } catch (e) {
          console.error("Error creating end date timestamp:", e);
        }
      }
      tradesQuery = query(tradesQuery, orderBy("entryTimestamp", "desc"));

      const unsubscribe = onSnapshot(
        tradesQuery,
        (querySnapshot) => {
          const accountTrades = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            accountName: accountIdToNameMap[accountId] || "Unknown Account",
            accountId: accountId,
          }));

          setTrades((prevTrades) => {
            const otherAccountTrades = prevTrades.filter(
              (t) => t.accountId !== accountId
            );
            const combined = [...otherAccountTrades, ...accountTrades];
            combined.sort((a, b) => {
              const timeA = a.entryTimestamp?.toMillis
                ? a.entryTimestamp.toMillis()
                : 0;
              const timeB = b.entryTimestamp?.toMillis
                ? b.entryTimestamp.toMillis()
                : 0;
              return timeB - timeA;
            });
            setGlobalTrades(combined); // Update global trades
            return combined;
          });
          setLoading(false);
        },
        (error) => {
          console.error(
            `Error fetching trades for account ${accountId} from ${tradesPath}:`,
            error
          );
          setLoading(false);
        }
      );
      unsubscribes.push(unsubscribe);
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [user, selectedAccountIds, startDate, endDate, accounts, setGlobalTrades]);

  useEffect(() => {
    if (trades.length === 0 && !loading) {
      setCalculatedSummaryData(
        initialSummaryStructure.map((s) => ({
          ...s,
          value: s.label.includes("P&L")
            ? "$0.00"
            : s.label.includes("Win %")
            ? "0%"
            : "N/A",
        }))
      );
      return;
    }

    if (trades.length > 0) {
      const newSummaryData = initialSummaryStructure.map((metric) => ({
        ...metric,
        value: metric.calculation(trades),
      }));
      setCalculatedSummaryData(newSummaryData);
    }
  }, [trades, loading]);

  // Modal content for confirming upload
  const handleToggleTrade = (idx) => {
    setSelectedTrades((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };
  const handleSelectAllTrades = () => {
    if (selectedTrades.length === tradesToUpload.length) {
      setSelectedTrades([]);
    } else {
      setSelectedTrades(tradesToUpload.map((_, idx) => idx));
    }
  };
  const handleAccountRadio = (accountId) => {
    setSelectedAccountsForUpload([accountId]);
  };
  const handleCancelUpload = () => {
    setShowUploadModal(false);
    setTradesToUpload([]);
    setSelectedTrades([]);
    setSelectedAccountsForUpload([]);
  };
  const handleConfirmUpload = async () => {
    if (!selectedAccountsForUpload[0]) {
      alert("Please select an account to import trades into.");
      return;
    }

    if (selectedTrades.length === 0) {
      alert("Please select at least one trade to upload.");
      return;
    }

    setUploading(true);
    try {
      const batch = writeBatch(db);
      const selectedAccountId = selectedAccountsForUpload[0];
      const tradesRef = collection(
        db,
        `users/${user.uid}/accounts/${selectedAccountId}/trades`
      );

      for (const idx of selectedTrades) {
        const trade = tradesToUpload[idx];
        if (!trade) continue;

        const tradeData = {
          ...trade,
          accountId: selectedAccountId,
          entryTimestamp: trade.entryTimestamp
            ? Timestamp.fromDate(new Date(trade.entryTimestamp))
            : null,
          exitTimestamp: trade.exitTimestamp
            ? Timestamp.fromDate(new Date(trade.exitTimestamp))
            : null,
          createdAt: Timestamp.now(),
        };

        const docRef = doc(tradesRef);
        batch.set(docRef, tradeData);
      }

      await batch.commit();
      setTradesToUpload([]);
      setSelectedTrades([]);
      setShowUploadModal(false);
      setUploadProgress(0);
      setUploadStatus("success");
      setUploadMessage("Trades uploaded successfully!");
    } catch (error) {
      console.error("Error uploading trades:", error);
      setUploadStatus("error");
      setUploadMessage("Error uploading trades: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleEditTradeField = (idx, field, value) => {
    setTradesToUpload((prev) =>
      prev.map((trade, i) =>
        i === idx
          ? recalculateTradeFieldsUpload(
              {
                ...trade,
                [field]: value === "" ? null : value,
              },
              (() => {
                const selectedAccount = accounts.find(
                  (acc) => acc.id === selectedAccountsForUpload[0]
                );
                return selectedAccount
                  ? Number(selectedAccount.initialBalance)
                  : 100000;
              })()
            )
          : trade
      )
    );
  };

  const handleToggleColumn = (key) => {
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };
  const handleSelectAllColumns = () => {
    setVisibleColumns(allTradeColumns.map((col) => col.key));
  };
  const handleDeselectAllColumns = () => {
    setVisibleColumns([]);
  };

  useEffect(() => {
    if (tradesToUpload.length === 0 || selectedAccountsForUpload.length === 0)
      return;
    const selectedAccount = accounts.find(
      (acc) => acc.id === selectedAccountsForUpload[0]
    );
    const initialBalance = selectedAccount
      ? Number(selectedAccount.initialBalance)
      : 100000;
    setTradesToUpload((prev) =>
      prev.map((trade) => {
        const updated = { ...trade };
        // Determine pip value based on symbol
        let pipValue = 10;
        if (
          typeof updated.symbol === "string" &&
          updated.symbol.toUpperCase().startsWith("XAUUSD")
        ) {
          pipValue = 100;
        }
        // Calculate riskAmount if entryPrice, sl, and volume are present
        if (
          updated.entryPrice !== undefined &&
          updated.entryPrice !== null &&
          updated.sl !== undefined &&
          updated.sl !== null &&
          updated.volume !== undefined &&
          updated.volume !== null
        ) {
          updated.riskAmount =
            Math.abs(Number(updated.entryPrice) - Number(updated.sl)) *
            Number(updated.volume) *
            pipValue;
          updated.riskAmount = Number(updated.riskAmount.toFixed(2));
        } else {
          updated.riskAmount = null;
        }
        // Calculate riskToReward if netPnL and riskAmount are present
        if (
          updated.netPnL !== undefined &&
          updated.netPnL !== null &&
          updated.riskAmount !== undefined &&
          updated.riskAmount !== null &&
          updated.riskAmount !== 0
        ) {
          updated.riskToReward = updated.netPnL / updated.riskAmount;
          updated.riskToReward = Number(updated.riskToReward.toFixed(2));
        } else {
          updated.riskToReward = null;
        }
        // Calculate percentRisk if riskAmount is present
        if (updated.riskAmount !== null && updated.riskAmount !== undefined) {
          updated.percentRisk =
            (Number(updated.riskAmount) / initialBalance) * 100;
          updated.percentRisk = Number(updated.percentRisk.toFixed(2));
        }
        // Calculate percentPnL if netPnL is present
        if (updated.netPnL !== undefined && updated.netPnL !== null) {
          updated.percentPnL = (Number(updated.netPnL) / initialBalance) * 100;
          updated.percentPnL = Number(updated.percentPnL.toFixed(2));
        }
        return updated;
      })
    );
  }, [selectedAccountsForUpload, accounts, tradesToUpload]);

  // Handler for selecting/deselecting a trade in the table
  const handleTableTradeSelect = (tradeId) => {
    setSelectedTableTrades((prev) =>
      prev.includes(tradeId)
        ? prev.filter((id) => id !== tradeId)
        : [...prev, tradeId]
    );
  };
  const handleSelectAllTableTrades = () => {
    if (selectedTableTrades.length === trades.length) {
      setSelectedTableTrades([]);
    } else {
      setSelectedTableTrades(trades.map((t) => t.id));
    }
  };
  // Handler for delete button above table
  const handleDeleteSelectedTrades = () => {
    setShowDeleteConfirm(true);
  };
  // Handler for confirming deletion
  const handleConfirmDeleteTrades = async () => {
    setDeleting(true);
    try {
      for (const tradeId of selectedTableTrades) {
        const trade = trades.find((t) => t.id === tradeId);
        if (trade) {
          await deleteTrade(trade.accountId, tradeId);
        }
      }
      setSelectedTableTrades([]);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error("Error deleting trades:", err);
      alert("Error deleting trades: " + err.message);
    }
    setDeleting(false);
  };

  // Add a new state for preview mode
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Open detail modal (view or edit)
  const openTradeDetail = (trade) => {
    try {
      if (!user || !user.email) {
        console.error("User not authenticated when opening trade detail");
        alert("You must be logged in to view trade details");
        return;
      }

      if (!trade || !trade.id || !trade.accountId) {
        console.error("Invalid trade data:", trade);
        alert("Invalid trade data");
        return;
      }

      console.log("Opening trade detail:", {
        tradeId: trade.id,
        accountId: trade.accountId,
        userId: user.uid,
      });

      // Convert timestamps to Date objects
      const tradeWithDates = {
        ...trade,
        entryTimestamp: trade.entryTimestamp?.toDate
          ? trade.entryTimestamp.toDate()
          : new Date(trade.entryTimestamp),
        exitTimestamp: trade.exitTimestamp?.toDate
          ? trade.exitTimestamp.toDate()
          : new Date(trade.exitTimestamp),
      };

      setDetailTrade(tradeWithDates);
      setShowTradeDetail(true);
    } catch (err) {
      console.error("Error opening trade detail:", err);
      alert("Error opening trade details: " + err.message);
    }
  };

  // Image upload handler
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !detailTrade) return;
    setImageUploading(true);
    setImageUploadProgress(0);
    try {
      const tradeId = detailTrade.id;
      const accountId = detailTrade.accountId;
      const filePath = `users/${
        user.uid
      }/accounts/${accountId}/trades/${tradeId}/chart_${Date.now()}_${
        file.name
      }`;
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from("chart-images")
        .upload(filePath, file, { upsert: true });
      if (error) throw error;
      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("chart-images")
        .getPublicUrl(filePath);
      const url = publicUrlData.publicUrl;
      // Update Firestore (or your DB)
      const tradesPath = `users/${user.uid}/accounts/${accountId}/trades/${tradeId}`;
      await (
        await import("firebase/firestore")
      ).updateDoc(doc(db, tradesPath), { imageUrl: url });
      setDetailTrade((prev) => ({ ...prev, imageUrl: url }));
    } catch (err) {
      console.error("Image upload error:", err);
      alert("Error uploading image: " + err.message);
    }
    setImageUploading(false);
    setImageUploadProgress(0);
  };

  // Remove image handler
  const handleRemoveImage = async () => {
    if (!detailTrade || !detailTrade.imageUrl) return;
    setImageUploading(true);
    try {
      // Extract file path from URL
      const url = detailTrade.imageUrl;
      const bucketUrl = supabase.storage.from("chart-images").getPublicUrl("");
      const baseUrl = bucketUrl.data.publicUrl;
      let filePath = url.replace(baseUrl, "");
      if (filePath.startsWith("/")) filePath = filePath.slice(1);
      await supabase.storage.from("chart-images").remove([filePath]);
      // Remove from Firestore
      const tradeId = detailTrade.id;
      const accountId = detailTrade.accountId;
      const tradesPath = `users/${user.uid}/accounts/${accountId}/trades/${tradeId}`;
      await (
        await import("firebase/firestore")
      ).updateDoc(doc(db, tradesPath), { imageUrl: null });
      setDetailTrade((prev) => ({ ...prev, imageUrl: null }));
    } catch (err) {
      alert("Error removing image: " + err.message);
    }
    setImageUploading(false);
  };

  // Add drag-and-drop and paste support for image upload
  const handleImageDrop = (e) => {
    e.preventDefault();
    if (!detailTrade || imageUploading) return;
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleImageUpload({ target: { files: [file] } });
    }
  };
  const handleImagePaste = (e) => {
    if (!detailTrade || imageUploading) return;
    const items = e.clipboardData && e.clipboardData.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            handleImageUpload({ target: { files: [file] } });
            break;
          }
        }
      }
    }
  };

  // Open upload edit modal
  const openUploadEditModal = (trade, idx) => {
    // Always recalculate the trade before editing to ensure calculated fields are up-to-date
    const selectedAccount = accounts.find(
      (acc) => acc.id === selectedAccountsForUpload[0]
    );
    const initialBalance = selectedAccount
      ? Number(selectedAccount.initialBalance)
      : 100000;
    setUploadEditForm(recalculateTradeFieldsUpload(trade, initialBalance));
    setUploadEditIdx(idx);
    setShowUploadEditModal(true);
  };
  const closeUploadEditModal = () => {
    setShowUploadEditModal(false);
    setUploadEditForm(null);
    setUploadEditIdx(null);
  };
  const handleSaveUploadEdit = () => {
    if (uploadEditIdx !== null && uploadEditForm) {
      setTradesToUpload((prev) =>
        prev.map((t, i) => (i === uploadEditIdx ? uploadEditForm : t))
      );
    }
    closeUploadEditModal();
  };

  // Image upload handler for upload edit modal
  const handleUploadEditImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || uploadEditForm == null) return;
    setUploadImageUploading(true);
    try {
      const filePath = `upload-preview/${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage
        .from("chart-images")
        .upload(filePath, file, { upsert: true });
      if (error) throw error;
      const { data: publicUrlData } = supabase.storage
        .from("chart-images")
        .getPublicUrl(filePath);
      const url = publicUrlData.publicUrl;
      setUploadEditForm((prev) => ({ ...prev, imageUrl: url }));
    } catch (err) {
      alert("Error uploading image: " + err.message);
    }
    setUploadImageUploading(false);
  };
  // Remove image handler for upload edit modal
  const handleUploadEditRemoveImage = async () => {
    if (!uploadEditForm || !uploadEditForm.imageUrl) return;
    setUploadImageUploading(true);
    try {
      const url = uploadEditForm.imageUrl;
      const bucketUrl = supabase.storage.from("chart-images").getPublicUrl("");
      const baseUrl = bucketUrl.data.publicUrl;
      let filePath = url.replace(baseUrl, "");
      if (filePath.startsWith("/")) filePath = filePath.slice(1);
      await supabase.storage.from("chart-images").remove([filePath]);
      setUploadEditForm((prev) => ({ ...prev, imageUrl: null }));
    } catch (err) {
      alert("Error removing image: " + err.message);
    }
    setUploadImageUploading(false);
  };
  // Drag-and-drop and paste support for upload edit modal
  const handleUploadEditImageDrop = (e) => {
    e.preventDefault();
    if (uploadImageUploading) return;
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      handleUploadEditImageUpload({ target: { files: [file] } });
    }
  };
  const handleUploadEditImagePaste = (e) => {
    if (uploadImageUploading) return;
    const items = e.clipboardData && e.clipboardData.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            handleUploadEditImageUpload({ target: { files: [file] } });
            break;
          }
        }
      }
    }
  };

  // Helper to get rule names from selected rule IDs
  const getRuleNames = (setupId, selectedRuleIds) => {
    if (!setupId || !selectedRuleIds || !selectedRuleIds.length) return [];

    const setup = setups.find((s) => s.id === setupId);
    if (!setup) return [];

    const ruleNames = [];
    setup.ruleGroups.forEach((group) => {
      group.rules.forEach((rule) => {
        if (selectedRuleIds.includes(rule.id)) {
          ruleNames.push(`${group.name}: ${rule.name}`);
        }
      });
    });
    return ruleNames;
  };

  // Helper to get setup name by id
  const getSetupName = (setupId) =>
    setups.find((s) => s.id === setupId)?.name || setupId;
  // Helper to get setup object
  const getSetupObj = (setupId) => setups.find((s) => s.id === setupId);

  // Define columns for the main trade log
  const tradeLogColumns = [
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
  ];

  const onPreviewSave = (updatedTrade) => {
    const index = parseInt(updatedTrade.id.replace("preview-", ""));
    setTradesToUpload((prevTrades) =>
      prevTrades.map((trade, i) =>
        i === index
          ? {
              ...updatedTrade,
              entryTimestamp:
                updatedTrade.entryTimestamp instanceof Date
                  ? updatedTrade.entryTimestamp
                  : new Date(updatedTrade.entryTimestamp),
              exitTimestamp:
                updatedTrade.exitTimestamp instanceof Date
                  ? updatedTrade.exitTimestamp
                  : new Date(updatedTrade.exitTimestamp),
            }
          : trade
      )
    );
    setShowTradeDetail(false);
    setIsPreviewMode(false);
  };

  // Add this handler to save edited trades
  const handleEditTradeSave = async (updatedTrade) => {
    if (!updatedTrade.id || !updatedTrade.accountId) {
      alert("Trade ID or Account ID missing.");
      return;
    }
    try {
      const tradeRef = doc(
        db,
        `users/${user.uid}/accounts/${updatedTrade.accountId}/trades/${updatedTrade.id}`
      );
      // Remove id from the object before saving
      const { id, ...tradeData } = updatedTrade;

      // Convert timestamps to Firestore Timestamps
      const dataToSave = {
        ...tradeData,
        entryTimestamp: Timestamp.fromDate(
          tradeData.entryTimestamp instanceof Date
            ? tradeData.entryTimestamp
            : tradeData.entryTimestamp?.toDate
            ? tradeData.entryTimestamp.toDate()
            : new Date(tradeData.entryTimestamp)
        ),
        exitTimestamp: Timestamp.fromDate(
          tradeData.exitTimestamp instanceof Date
            ? tradeData.exitTimestamp
            : tradeData.exitTimestamp?.toDate
            ? tradeData.exitTimestamp.toDate()
            : new Date(tradeData.exitTimestamp)
        ),
        updatedAt: serverTimestamp(),
      };

      await updateDoc(tradeRef, dataToSave);
      setShowTradeDetail(false);
      setDetailTrade(null);
    } catch (err) {
      alert("Failed to update trade: " + err.message);
    }
  };

  // Check if selected trades can be merged
  const canMergeSelectedTrades = React.useMemo(() => {
    if (selectedTableTrades.length < 2) return false;

    const selectedTrades = trades.filter((t) =>
      selectedTableTrades.includes(t.id)
    );
    if (selectedTrades.length < 2) return false;

    // Check if all trades are from the same day and have the same symbol
    const firstTrade = selectedTrades[0];
    const firstTradeDate = firstTrade.entryTimestamp?.toDate
      ? firstTrade.entryTimestamp.toDate().toDateString()
      : new Date(firstTrade.entryTimestamp).toDateString();
    const firstTradeSymbol = firstTrade.symbol;

    return selectedTrades.every((trade) => {
      const currentTradeDate = trade.entryTimestamp?.toDate
        ? trade.entryTimestamp.toDate().toDateString()
        : new Date(trade.entryTimestamp).toDateString();
      return (
        currentTradeDate === firstTradeDate && trade.symbol === firstTradeSymbol
      );
    });
  }, [selectedTableTrades, trades]);

  // Handler for merge button click
  const handleMergeSelectedTrades = () => {
    if (!canMergeSelectedTrades) return;
    setShowMergeConfirm(true);
  };

  // Handler for confirming merge
  const handleConfirmMergeTrades = async () => {
    setMerging(true);
    try {
      const selectedTrades = trades.filter((t) =>
        selectedTableTrades.includes(t.id)
      );

      // Get symbol settings from Firestore using SymbolService
      const symbolSettings = await getSymbol(selectedTrades[0].symbol);

      // Calculate weighted averages for prices
      const totalVolume = selectedTrades.reduce(
        (sum, t) => sum + (t.volume || 0),
        0
      );

      const weightedEntryPrice =
        selectedTrades.reduce(
          (sum, t) => sum + (t.entryPrice || 0) * (t.volume || 0),
          0
        ) / totalVolume;

      const weightedExitPrice =
        selectedTrades.reduce(
          (sum, t) => sum + (t.exitPrice || 0) * (t.volume || 0),
          0
        ) / totalVolume;

      const weightedSL =
        selectedTrades.reduce(
          (sum, t) => sum + (t.sl || 0) * (t.volume || 0),
          0
        ) / totalVolume;

      // Get initial balance for calculations
      const account = accounts.find(
        (a) => a.id === selectedTrades[0].accountId
      );
      const initialBalance = account ? Number(account.initialBalance) : 100000;

      // Create base merged trade
      const baseMergedTrade = {
        entryTimestamp: selectedTrades.reduce((earliest, trade) => {
          const currentTime = trade.entryTimestamp?.toDate
            ? trade.entryTimestamp.toDate()
            : new Date(trade.entryTimestamp);
          return !earliest || currentTime < earliest ? currentTime : earliest;
        }, null),
        exitTimestamp: selectedTrades.reduce((latest, trade) => {
          const currentTime = trade.exitTimestamp?.toDate
            ? trade.exitTimestamp.toDate()
            : new Date(trade.exitTimestamp);
          return !latest || currentTime > latest ? currentTime : latest;
        }, null),
        direction: selectedTrades[0].direction,
        symbol: selectedTrades[0].symbol,
        volume: Number(totalVolume.toFixed(2)),
        entryPrice: Number(weightedEntryPrice.toFixed(5)),
        exitPrice: Number(weightedExitPrice.toFixed(5)),
        sl: Number(weightedSL.toFixed(5)),
        commission: Number(
          selectedTrades
            .reduce((sum, t) => sum + (t.commission || 0), 0)
            .toFixed(2)
        ),
        swap: Number(
          selectedTrades.reduce((sum, t) => sum + (t.swap || 0), 0).toFixed(2)
        ),
        netPnL: Number(
          selectedTrades.reduce((sum, t) => sum + (t.netPnL || 0), 0).toFixed(2)
        ),
        accountId: selectedTrades[0].accountId,
        setups: selectedTrades[0].setups,
        pipValuePerLot: symbolSettings.pipValuePerLot,
        pipSize: symbolSettings.pipSize,
        contractSize: symbolSettings.contractSize,
      };

      // Use recalculateTradeFields to calculate all derived values
      const mergedTrade = recalculateTradeFields(
        baseMergedTrade,
        initialBalance
      );

      // Delete old trades and add merged trade
      const batch = writeBatch(db);

      // Delete old trades
      for (const trade of selectedTrades) {
        const tradeRef = doc(
          db,
          `users/${user.uid}/accounts/${trade.accountId}/trades`,
          trade.id
        );
        batch.delete(tradeRef);
      }

      // Add merged trade
      const mergedTradeRef = doc(
        collection(
          db,
          `users/${user.uid}/accounts/${mergedTrade.accountId}/trades`
        )
      );
      batch.set(mergedTradeRef, {
        ...mergedTrade,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
      setSelectedTableTrades([]);
      setShowMergeConfirm(false);
    } catch (err) {
      console.error("Error merging trades:", err);
      alert("Error merging trades: " + err.message);
    }
    setMerging(false);
  };

  // For CSV upload processing
  const processTrade = (row, positionsHeader, initialBalance = 100000) => {
    const trade = {
      entryTimestamp: null,
      exitTimestamp: null,
      direction: "",
      symbol: "",
      volume: null,
      entryPrice: null,
      exitPrice: null,
      sl: null,
      commission: null,
      swap: null,
      netPnL: null,
      setups: "",
      accountName: "",
      maxDrawdownR: null,
      maxRR: null,
    };

    // ... existing code ...

    // Calculate derived values using recalculateTradeFields
    const calculatedTrade = recalculateTradeFields(trade, initialBalance);
    return calculatedTrade;
  };

  // For trade updates
  const handleTradeUpdate = (updated, initialBalance = 100000) => {
    // Calculate all derived values using recalculateTradeFields
    return recalculateTradeFields(updated, initialBalance);
  };

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            style={{ display: "none" }}
            ref={fileInputRef}
          />
          <button
            onClick={() => fileInputRef.current.click()}
            disabled={isProcessingCsv}
            style={buttonStyle}
          >
            Import Trades (csv)
          </button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 24, marginBottom: 32 }}>
        {calculatedSummaryData.map((card) => (
          <div
            key={card.id}
            style={{
              flex: 1,
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              padding: 24,
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                background: card.color,
                borderRadius: "50%",
                width: 40,
                height: 40,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 20,
              }}
            >
              {card.icon}
            </div>
            <div>
              <div style={{ fontSize: 13, color: "#888" }}>{card.label}</div>
              <div style={{ fontWeight: 600, fontSize: 20 }}>{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          padding: 24,
          margin: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            marginBottom: 8,
            gap: 12,
          }}
        >
          <FaTrash
            style={{
              cursor: selectedTableTrades.length ? "pointer" : "not-allowed",
              fontSize: 16,
              color: selectedTableTrades.length ? "#cf1322" : "#ccc",
            }}
            onClick={
              selectedTableTrades.length
                ? handleDeleteSelectedTrades
                : undefined
            }
            title="Delete Selected"
          />
          <button
            onClick={handleMergeSelectedTrades}
            disabled={!canMergeSelectedTrades}
            style={{
              padding: "6px 12px",
              borderRadius: 4,
              border: "1px solid #d9d9d9",
              background: canMergeSelectedTrades ? "#1890ff" : "#f5f5f5",
              color: canMergeSelectedTrades ? "#fff" : "#d9d9d9",
              cursor: canMergeSelectedTrades ? "pointer" : "not-allowed",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginLeft: 8,
            }}
          >
            <FaPlus style={{ fontSize: 12 }} />
            Merge Trades
          </button>
        </div>
        <div
          style={{ overflowX: "auto", width: "100%", boxSizing: "border-box" }}
        >
          {loading ? (
            <div style={{ textAlign: "center", color: "#888", padding: 32 }}>
              Loading trades...
            </div>
          ) : !loading && trades.length === 0 ? (
            <div style={{ textAlign: "center", color: "#888", padding: 32 }}>
              No trades found for the selected criteria.
            </div>
          ) : (
            <TradeTable
              trades={trades}
              columns={tradeLogColumns}
              accounts={accounts}
              selectedRows={selectedTableTrades}
              onSelectRow={handleTableTradeSelect}
              showCheckboxes={true}
              loading={loading}
              onRowClick={openTradeDetail}
              defaultVisibleColumns={defaultVisibleColumns}
            />
          )}
        </div>
      </div>
      <Modal
        isOpen={showUploadModal}
        onRequestClose={handleCancelUpload}
        contentLabel="Confirm Trades to Upload"
        style={{
          overlay: { zIndex: 1000, background: "rgba(0,0,0,0.3)" },
          content: {
            maxWidth: 1200,
            margin: "auto",
            borderRadius: 12,
            padding: 32,
          },
        }}
        ariaHideApp={false}
      >
        <h2>Review Trades to Upload</h2>
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: "#666", fontSize: 14 }}>
            Importing into account:{" "}
            {
              accounts.find((acc) => acc.id === selectedAccountsForUpload[0])
                ?.name
            }
          </div>
        </div>
        <div
          style={{
            maxHeight: 350,
            overflowY: "auto",
            border: "2px solid #6C63FF",
            borderRadius: 12,
            marginBottom: 16,
            background: "#fff",
            boxShadow: "0 2px 8px rgba(108,99,255,0.08)",
          }}
        >
          <table
            style={{
              width: "100%",
              fontSize: 15,
              borderCollapse: "collapse",
              minWidth: 1200,
              background: "#fff",
            }}
          >
            <thead>
              <tr style={{ background: "#f4f6fa" }}>
                <th style={thStyle}>
                  <input
                    type="checkbox"
                    checked={selectedTrades.length === tradesToUpload.length}
                    onChange={handleSelectAllTrades}
                  />
                </th>
                <th style={thStyle}>Open Time</th>
                <th style={thStyle}>Close Time</th>
                <th style={thStyle}>Direction</th>
                <th style={thStyle}>Symbol</th>
                <th style={thStyle}>Volume</th>
                <th style={thStyle}>Entry Price</th>
                <th style={thStyle}>Exit Price</th>
                <th style={thStyle}>SL</th>
                <th style={thStyle}>Risked Amount</th>
                <th style={thStyle}>Commission</th>
                <th style={thStyle}>Swap</th>
                <th style={thStyle}>Net P&L</th>
                <th style={thStyle}>Duration (min)</th>
                <th style={thStyle}>RR</th>
                <th style={thStyle}>Risk %</th>
                <th style={thStyle}>PnL %</th>
                <th style={thStyle}>Session</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Max DD R</th>
                <th style={thStyle}>Max RR</th>
                <th style={thStyle}>Setups</th>
              </tr>
            </thead>
            <tbody>
              {tradesToUpload.map((trade, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    cursor: "pointer",
                    background: selectedTrades.includes(idx)
                      ? "#e6f7ff"
                      : idx % 2 === 0
                      ? "#f9faff"
                      : "#fff",
                  }}
                  onClick={() => {
                    const trade = tradesToUpload[idx];
                    setDetailTrade({
                      ...trade,
                      id: `preview-${idx}`,
                      accountId: selectedAccountsForUpload[0],
                      accountName: accounts.find(
                        (acc) => acc.id === selectedAccountsForUpload[0]
                      )?.name,
                      entryTimestamp:
                        trade.entryTimestamp instanceof Date
                          ? trade.entryTimestamp
                          : new Date(trade.entryTimestamp),
                      exitTimestamp:
                        trade.exitTimestamp instanceof Date
                          ? trade.exitTimestamp
                          : new Date(trade.exitTimestamp),
                    });
                    setIsPreviewMode(true);
                    setShowTradeDetail(true);
                  }}
                >
                  <td style={tdStyle}>
                    <input
                      type="checkbox"
                      checked={selectedTrades.includes(idx)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleToggleTrade(idx);
                      }}
                    />
                  </td>
                  <td style={tdStyle}>
                    {trade.entryTimestamp instanceof Date
                      ? formatDateTime24(trade.entryTimestamp)
                      : trade.entryTimestamp?.toDate
                      ? formatDateTime24(trade.entryTimestamp.toDate())
                      : ""}
                  </td>
                  <td style={tdStyle}>
                    {trade.exitTimestamp instanceof Date
                      ? formatDateTime24(trade.exitTimestamp)
                      : trade.exitTimestamp?.toDate
                      ? formatDateTime24(trade.exitTimestamp.toDate())
                      : ""}
                  </td>
                  <td style={tdStyle}>{trade.direction}</td>
                  <td style={tdStyle}>{trade.symbol}</td>
                  <td style={tdStyle}>{trade.volume}</td>
                  <td style={tdStyle}>{trade.entryPrice}</td>
                  <td style={tdStyle}>{trade.exitPrice}</td>
                  <td style={tdStyle}>{trade.sl}</td>
                  <td style={tdStyle}>{trade.riskAmount}</td>
                  <td style={tdStyle}>{trade.commission}</td>
                  <td style={tdStyle}>{trade.swap}</td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        color:
                          trade.status === "WIN"
                            ? "#389e0d"
                            : trade.status === "LOSS"
                            ? "#cf1322"
                            : "#222",
                        fontWeight: 600,
                      }}
                    >
                      {trade.netPnL !== undefined && trade.netPnL !== null
                        ? trade.netPnL
                        : ""}
                    </span>
                  </td>
                  <td style={tdStyle}>{trade.duration}</td>
                  <td style={tdStyle}>{trade.riskToReward}</td>
                  <td style={tdStyle}>{trade.percentRisk}</td>
                  <td style={tdStyle}>{trade.percentPnL}</td>
                  <td style={tdStyle}>{trade.session}</td>
                  <td style={tdStyle}>{trade.status}</td>
                  <td style={tdStyle}>{trade.maxDrawdownR}</td>
                  <td style={tdStyle}>{trade.maxRR}</td>
                  <td style={tdStyle}>{trade.setups}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
            alignItems: "center",
          }}
        >
          {uploading && (
            <span style={{ color: "#888", marginRight: 12 }}>Uploading...</span>
          )}
          {uploadMessage && (
            <span
              style={{
                color: uploadMessage.startsWith("Error") ? "red" : "green",
                marginRight: 12,
              }}
            >
              {uploadMessage}
            </span>
          )}
          <button
            onClick={handleCancelUpload}
            style={buttonStyle}
            disabled={uploading}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmUpload}
            style={{ ...buttonStyle, background: "#6C63FF", color: "#fff" }}
            disabled={selectedTrades.length === 0 || uploading}
          >
            Confirm & Upload
          </button>
        </div>
        {/* Upload Edit Modal */}
        <Modal
          isOpen={showUploadEditModal}
          onRequestClose={closeUploadEditModal}
          contentLabel="Edit Trade Before Upload"
          style={{
            overlay: { zIndex: 1200, background: "rgba(0,0,0,0.3)" },
            content: {
              maxWidth: 900,
              margin: "auto",
              borderRadius: 12,
              padding: 32,
              minHeight: 400,
              background: "#fff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            },
          }}
          ariaHideApp={false}
        >
          {uploadEditForm && (
            <div>
              <h2 style={{ marginBottom: 24 }}>Edit Trade Before Upload</h2>
              <TradeModal
                open={showUploadEditModal}
                onClose={closeUploadEditModal}
                trade={uploadEditForm}
                columns={tradeLogColumns}
                accounts={accounts}
                setups={setups}
                editMode={true}
                onSave={handleSaveUploadEdit}
                onCancel={closeUploadEditModal}
                onChange={setUploadEditForm}
              />
            </div>
          )}
        </Modal>
      </Modal>
      {showAccountSelectModal && (
        <Modal
          isOpen={showAccountSelectModal}
          onRequestClose={() => setShowAccountSelectModal(false)}
          contentLabel="Select Account for Import"
          style={{
            overlay: { zIndex: 1000, background: "rgba(0,0,0,0.3)" },
            content: {
              maxWidth: 400,
              margin: "auto",
              borderRadius: 12,
              padding: 32,
            },
          }}
          ariaHideApp={false}
        >
          <h2>Select Account for Import</h2>
          <div style={{ marginBottom: 16 }}>
            {accounts.map((acc) => (
              <label key={acc.id} style={{ display: "block", marginBottom: 8 }}>
                <input
                  type="radio"
                  name="importAccount"
                  checked={selectedAccountsForUpload[0] === acc.id}
                  onChange={() => setSelectedAccountsForUpload([acc.id])}
                />
                {acc.name}
              </label>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
            <button
              onClick={() => setShowAccountSelectModal(false)}
              style={buttonStyle}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmAccountSelect}
              style={{ ...buttonStyle, background: "#6C63FF", color: "#fff" }}
              disabled={!selectedAccountsForUpload[0]}
            >
              Confirm
            </button>
          </div>
        </Modal>
      )}
      <Modal
        isOpen={showDeleteConfirm}
        onRequestClose={() => setShowDeleteConfirm(false)}
        contentLabel="Confirm Delete Trades"
        style={{
          overlay: { zIndex: 1000, background: "rgba(0,0,0,0.3)" },
          content: {
            maxWidth: 400,
            margin: "auto",
            borderRadius: 12,
            padding: 32,
            textAlign: "center",
            background: "#fff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          },
        }}
        ariaHideApp={false}
      >
        <div style={{ marginBottom: 24 }}>
          <FaTrash
            style={{ fontSize: 32, color: "#cf1322", marginBottom: 16 }}
          />
          <h2 style={{ margin: "0 0 16px 0", fontSize: 20 }}>
            Delete Selected Trades?
          </h2>
          <p style={{ color: "#666", margin: 0, lineHeight: 1.5 }}>
            {selectedTableTrades.length} trade
            {selectedTableTrades.length !== 1 ? "s" : ""} will be moved to the
            Recycle Bin. You can restore them within 7 days.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
            marginTop: 24,
          }}
        >
          <button
            onClick={() => setShowDeleteConfirm(false)}
            style={{
              ...buttonStyle,
              background: "#f0f0f0",
              color: "#333",
              border: "1px solid #d9d9d9",
            }}
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmDeleteTrades}
            style={{
              ...buttonStyle,
              background: "#cf1322",
              color: "#fff",
              border: "none",
              minWidth: 100,
            }}
            disabled={deleting}
          >
            {deleting ? "Moving..." : "Move to Bin"}
          </button>
        </div>
      </Modal>
      {/* Trade Detail Modal */}
      <TradeModal
        open={showTradeDetail}
        onClose={() => {
          setShowTradeDetail(false);
          setIsPreviewMode(false);
        }}
        trade={detailTrade}
        columns={tradeLogColumns}
        accounts={accounts}
        setups={setups}
        setupColors={setupColors}
        isPreviewMode={isPreviewMode}
        onPreviewSave={onPreviewSave}
        onSave={handleEditTradeSave}
      />

      {/* Image Preview Modal */}
      <Modal
        isOpen={!!imagePreviewUrl}
        onRequestClose={() => setImagePreviewUrl(null)}
        contentLabel="Image Preview"
        style={{
          overlay: { zIndex: 2000, background: "rgba(0,0,0,0.7)" },
          content: {
            maxWidth: 900,
            margin: "auto",
            borderRadius: 12,
            padding: 0,
            background: "#111",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
          },
        }}
        ariaHideApp={false}
      >
        <div
          style={{ position: "relative", width: "100%", textAlign: "center" }}
        >
          <button
            onClick={() => setImagePreviewUrl(null)}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              background: "rgba(0,0,0,0.7)",
              color: "#fff",
              border: "none",
              borderRadius: "50%",
              width: 36,
              height: 36,
              fontSize: 22,
              cursor: "pointer",
              zIndex: 10,
            }}
            aria-label="Close"
          >
            ×
          </button>
          <img
            src={imagePreviewUrl}
            alt="Trade Preview"
            style={{
              maxWidth: "90vw",
              maxHeight: "80vh",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              borderRadius: 12,
              boxShadow: "0 4px 32px rgba(0,0,0,0.5)",
              margin: "0 auto",
              display: "block",
              background: "#222",
            }}
          />
        </div>
      </Modal>
      <Modal
        isOpen={showMergeConfirm}
        onRequestClose={() => setShowMergeConfirm(false)}
        contentLabel="Confirm Merge Trades"
        style={{
          overlay: { zIndex: 1000, background: "rgba(0,0,0,0.3)" },
          content: {
            maxWidth: 400,
            margin: "auto",
            borderRadius: 12,
            padding: 32,
            textAlign: "center",
            background: "#fff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          },
        }}
        ariaHideApp={false}
      >
        <div style={{ marginBottom: 24 }}>
          <FaTrash
            style={{ fontSize: 32, color: "#cf1322", marginBottom: 16 }}
          />
          <h2 style={{ margin: "0 0 16px 0", fontSize: 20 }}>
            Merge Selected Trades?
          </h2>
          <p style={{ color: "#666", margin: 0, lineHeight: 1.5 }}>
            {selectedTableTrades.length} trade
            {selectedTableTrades.length !== 1 ? "s" : ""} will be merged.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
            marginTop: 24,
          }}
        >
          <button
            onClick={() => setShowMergeConfirm(false)}
            style={{
              ...buttonStyle,
              background: "#f0f0f0",
              color: "#333",
              border: "1px solid #d9d9d9",
            }}
            disabled={merging}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmMergeTrades}
            style={{
              ...buttonStyle,
              background: "#cf1322",
              color: "#fff",
              border: "none",
              minWidth: 100,
            }}
            disabled={merging}
          >
            {merging ? "Merging..." : "Merge"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

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
};

const inputStyle = {
  padding: "10px",
  border: "1px solid #ccc",
  borderRadius: 4,
};

const buttonStyle = {
  padding: "8px 15px",
  border: "1px solid #ccc",
  borderRadius: "4px",
  cursor: "pointer",
  backgroundColor: "#f0f0f0",
};

export default TradeLog;
