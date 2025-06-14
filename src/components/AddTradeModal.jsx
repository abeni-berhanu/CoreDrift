import React, { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useAccount } from "../contexts/AccountContext";
import { useAddTradeModal } from "../contexts/AddTradeModalContext";
import TradeModal from "./TradeModal";
import { useSetups } from "../contexts/SetupsContext";
import { useDataManagement } from "../hooks/useDataManagement";

// Define all trade columns
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
  { key: "netPnL", label: "P&L" },
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

// Basic styling for the modal, can be moved to a CSS file or enhanced
const modalStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  background: "rgba(0,0,0,0.18)",
  zIndex: 9999, // Ensure it's on top
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const modalFormStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 32,
  minWidth: 400,
  maxWidth: "90%",
  boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
  position: "relative",
};

const inputStyle = {
  padding: "10px",
  border: "1px solid #ccc",
  borderRadius: 4,
  fontSize: "14px", // Consistent font size
  marginBottom: "8px", // Add some space below inputs
};

function AddTradeModal() {
  const { user } = useAuth();
  const { accounts, selectedAccountIds } = useAccount();
  const { showAddTradeModal, closeAddTradeModal } = useAddTradeModal();
  const { setups } = useSetups();
  const [colors, setColors] = useState([]);
  const [form, setForm] = useState({
    entryTimestamp: new Date(),
    exitTimestamp: new Date(),
    direction: "",
    symbol: "",
    volume: "",
    entryPrice: "",
    exitPrice: "",
    sl: "",
    riskAmount: "",
    commission: 0,
    swap: 0,
    netPnL: "",
    duration: "",
    riskToReward: "",
    percentRisk: "",
    percentPnL: "",
    session: "",
    status: "",
    maxDrawdownR: "",
    maxRR: "",
    setups: "",
    selectedRules: [],
    accountId: selectedAccountIds[0] || accounts[0]?.id || "",
    imageUrl: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const { createTrade, isLoading: isCreating } = useDataManagement();

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

  // Build setupColors map
  const setupColors = Object.fromEntries(
    setups.map((s) => {
      const colorObj = colors.find((c) => c.id === s.color);
      return [s.id, colorObj ? colorObj.color : "#eee"];
    })
  );

  // Effect to set default accountId when accounts load and modal is open
  useEffect(() => {
    if (showAddTradeModal && accounts.length > 0) {
      const defaultAccountId =
        selectedAccountIds.length > 0 ? selectedAccountIds[0] : accounts[0]?.id;
      if (defaultAccountId && form.accountId !== defaultAccountId) {
        setForm((prevForm) => ({
          ...prevForm,
          accountId: defaultAccountId || "",
        }));
      }
    }
    if (!showAddTradeModal || (showAddTradeModal && accounts.length === 0)) {
      if (form.accountId !== "") {
        setForm((prevForm) => ({ ...prevForm, accountId: "" }));
      }
    }
  }, [showAddTradeModal, accounts, selectedAccountIds]);

  // Reset form when modal is closed
  useEffect(() => {
    if (!showAddTradeModal) {
      setForm({
        entryTimestamp: new Date(),
        exitTimestamp: new Date(),
        direction: "",
        symbol: "",
        volume: "",
        entryPrice: "",
        exitPrice: "",
        sl: "",
        riskAmount: "",
        commission: 0,
        swap: 0,
        netPnL: "",
        duration: "",
        riskToReward: "",
        percentRisk: "",
        percentPnL: "",
        session: "",
        status: "",
        maxDrawdownR: "",
        maxRR: "",
        setups: "",
        selectedRules: [],
        accountId: accounts[0]?.id || "",
        imageUrl: "",
      });
      setSubmitting(false);
    }
  }, [showAddTradeModal, accounts]);

  const handleSave = async (updatedForm) => {
    if (!user || !user.uid) {
      alert("You must be logged in to add a trade.");
      return;
    }
    if (!updatedForm.accountId) {
      alert("Please select an account for the trade.");
      return;
    }
    if (updatedForm.direction === "" || updatedForm.symbol === "") {
      alert("Please select a symbol and direction for the trade.");
      return;
    }

    setSubmitting(true);
    try {
      // Prepare tradeData for Firestore
      const tradeData = {
        ...updatedForm,
        entryTimestamp: updatedForm.entryTimestamp
          ? updatedForm.entryTimestamp instanceof Date
            ? updatedForm.entryTimestamp
            : typeof updatedForm.entryTimestamp === "string" &&
              updatedForm.entryTimestamp
            ? new Date(updatedForm.entryTimestamp)
            : null
          : null,
        exitTimestamp: updatedForm.exitTimestamp
          ? updatedForm.exitTimestamp instanceof Date
            ? updatedForm.exitTimestamp
            : typeof updatedForm.exitTimestamp === "string" &&
              updatedForm.exitTimestamp
            ? new Date(updatedForm.exitTimestamp)
            : null
          : null,
        selectedRules: updatedForm.selectedRules || [],
      };

      if (
        tradeData.entryTimestamp &&
        tradeData.exitTimestamp &&
        tradeData.exitTimestamp < tradeData.entryTimestamp
      ) {
        alert("Close date/time cannot be before open date/time.");
        setSubmitting(false);
        return;
      }

      await createTrade(updatedForm.accountId, tradeData);
      closeAddTradeModal();
    } catch (err) {
      console.error("Error adding trade: ", err);
      alert("Error adding trade: " + err.message);
    }
    setSubmitting(false);
  };

  if (!showAddTradeModal) {
    return null;
  }

  return (
    <TradeModal
      open={showAddTradeModal}
      onClose={closeAddTradeModal}
      trade={form}
      columns={allTradeColumns}
      accounts={accounts}
      setups={setups}
      editMode={true}
      onSave={handleSave}
      onCancel={closeAddTradeModal}
      onChange={setForm}
      setupColors={setupColors}
    />
  );
}

export default AddTradeModal;
