import React, { useState, useEffect, useRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Select from "react-select";
import {
  FaEdit,
  FaTimes,
  FaCheck,
  FaStickyNote,
  FaTrash,
} from "react-icons/fa";
import { NotesModal, storeNotes, fetchNotes } from "./Notes";
import { useAuth } from "../contexts/AuthContext";
import {
  doc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import MinimalSelect from "./MinimalSelect";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import {
  recalculateTradeFields,
  calculateRiskedAmount,
} from "../utils/tradeCalculations";
import { useDataManagement } from "../hooks/useDataManagement";
import { getSymbols } from "../services/SymbolService";
import { supabase } from "../supabase";
import Modal from "react-modal";

const directionOptions = ["Buy", "Sell"];

const formatDateTime24 = (dateObj) => {
  if (!dateObj) return "N/A";
  let d = dateObj;
  if (typeof d.toDate === "function") d = d.toDate();
  if (!(d instanceof Date)) d = new Date(d);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const modalStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  background: "rgba(0,0,0,0.18)",
  zIndex: 1200,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const contentStyle = {
  maxWidth: 900,
  margin: "auto",
  borderRadius: 12,
  padding: 32,
  maxHeight: "85vh",
  overflowY: "auto",
  background: "#fff",
  boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
  position: "relative",
};
const inputStyle = {
  padding: "8px 12px",
  border: "1px solid #6C63FF",
  borderRadius: 8,
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
  background: "#fff",
  color: "#222",
};
const readOnlyStyle = {
  padding: "5px 8px",
  border: "none",
  background: "none",
  fontSize: "14px",
  marginBottom: "6px",
  width: "100%",
  color: "#222",
};

function TradeModal({
  open,
  onClose,
  trade: initialTrade = {},
  columns = [],
  accounts = [],
  setups = [],
  editMode: editModeProp = false,
  onSave,
  onCancel,
  onChange,
  setupColors = {},
  isPreviewMode = false,
  onPreviewSave,
}) {
  const [editMode, setEditMode] = useState(editModeProp);
  const [trade, setTrade] = useState(initialTrade || {});
  const [showNotesModal, setShowNotesModal] = useState(false);
  const { user } = useAuth();
  const { updateTrade, isLoading: isUpdating } = useDataManagement();
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = React.useRef(null);
  const [showNotesCard, setShowNotesCard] = useState(false);
  const [symbolOptions, setSymbolOptions] = useState([]);
  const [showNotesPopup, setShowNotesPopup] = useState(false);
  const [activeTab, setActiveTab] = useState("chart");
  const [showRulesDropdown, setShowRulesDropdown] = useState(false);
  const [rules, setRules] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const rulesButtonRef = useRef(null);
  const rulesDropdownRef = useRef(null);
  const [localSelectedRules, setLocalSelectedRules] = useState(
    trade.selectedRules || []
  );

  // Move all useEffect calls to the top level, before any return
  useEffect(() => {
    const fetchSymbols = async () => {
      try {
        const symbols = await getSymbols();
        setSymbolOptions(
          symbols.map((s) => ({
            label: s.id,
            value: s.id,
            pipSize: s.pipSize,
            pipValuePerLot: s.pipValuePerLot,
          }))
        );
      } catch (error) {
        console.error("Error fetching symbols:", error);
      }
    };
    fetchSymbols();
  }, []);

  useEffect(() => {
    setEditMode(editModeProp);
  }, [editModeProp]);

  useEffect(() => {
    setTrade(initialTrade || {});
  }, [initialTrade]);

  useEffect(() => {
    const loadNotes = async () => {
      if (user && trade?.id) {
        const notes = await fetchNotes(user.uid, trade.id);
        if (notes) {
          setTrade((t) => ({ ...t, notes }));
        }
      }
    };
    loadNotes();
  }, [user, trade?.id]);

  // Reset localSelectedRules when dropdown opens or trade.selectedRules changes
  useEffect(() => {
    if (showRulesDropdown) {
      setLocalSelectedRules(trade.selectedRules || []);
    }
  }, [showRulesDropdown, trade.selectedRules]);

  // Update local state only on checkbox click
  const handleRuleCheckboxChange = (ruleId) => {
    setLocalSelectedRules((prev) =>
      prev.includes(ruleId)
        ? prev.filter((id) => id !== ruleId)
        : [...prev, ruleId]
    );
  };

  // Only call setTrade/onChange in handleCloseRulesDropdown
  const handleCloseRulesDropdown = () => {
    setShowRulesDropdown(false);
    setTrade((prev) => ({ ...prev, selectedRules: localSelectedRules }));
    if (onChange) onChange({ ...trade, selectedRules: localSelectedRules });
  };

  // Close rules dropdown when clicking outside
  useEffect(() => {
    if (!showRulesDropdown) return;
    const handleClickOutside = (event) => {
      if (
        rulesDropdownRef.current &&
        !rulesDropdownRef.current.contains(event.target) &&
        rulesButtonRef.current &&
        !rulesButtonRef.current.contains(event.target)
      ) {
        handleCloseRulesDropdown();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showRulesDropdown]);

  // Define which fields are inputs and which are calculated
  const inputFields = [
    "entryTimestamp",
    "exitTimestamp",
    "direction",
    "symbol",
    "volume",
    "entryPrice",
    "exitPrice",
    "sl",
    "commission",
    "swap",
    "netPnL",
    "setups",
    "accountName",
    "maxDrawdownR",
    "maxRR",
  ];
  const calculatedFields = [
    "riskAmount",
    "duration",
    "riskToReward",
    "percentRisk",
    "percentPnL",
    "session",
    "status",
  ];

  // Helper to get column meta by key
  const getCol = (key) =>
    columns.find((c) => c.key === key) || { key, label: key };

  if (!open) return null;

  // Format dates for display
  const formattedTrade = {
    ...trade,
    entryTimestamp: trade?.entryTimestamp
      ? trade.entryTimestamp instanceof Date
        ? formatDateTime24(trade.entryTimestamp)
        : trade.entryTimestamp?.toDate
        ? formatDateTime24(trade.entryTimestamp.toDate())
        : trade.entryTimestamp
      : "N/A",
    exitTimestamp: trade?.exitTimestamp
      ? trade.exitTimestamp instanceof Date
        ? formatDateTime24(trade.exitTimestamp)
        : trade.exitTimestamp?.toDate
        ? formatDateTime24(trade.exitTimestamp.toDate())
        : trade.exitTimestamp
      : "N/A",
  };

  // Card style for both view and edit mode
  const cardStyle = {
    flex: "1 1 160px",
    minWidth: 140,
    background: "#fff",
    borderRadius: 8,
    boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 2,
  };

  const cardLabelStyle = { color: "#888", fontSize: 12 };
  const cardValueStyle = { color: "#222", fontWeight: 600, fontSize: 14 };

  // Get color for PnL value
  const getPnLColor = (value) => {
    if (!value) return "#222";
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return "#222";
    return numValue > 0 ? "#389e0d" : numValue < 0 ? "#cf1322" : "#222";
  };

  // Get color for direction
  const getDirectionColor = (direction) => {
    if (!direction) return "#222";
    return direction.toUpperCase() === "BUY" ? "#389e0d" : "#cf1322";
  };

  // Get color for status
  const getStatusColor = (status) => {
    if (!status) return "#222";
    return status === "WIN"
      ? "#389e0d"
      : status === "LOSS"
      ? "#cf1322"
      : "#faad14";
  };

  // Number input style
  const numberInputStyle = {
    ...inputStyle,
    textAlign: "right",
    fontSize: 14,
    padding: "4px 8px",
  };

  // Select style
  const selectStyle = {
    ...inputStyle,
    padding: "4px 8px",
    fontSize: 14,
  };

  // Date picker style
  const datePickerStyle = {
    ...inputStyle,
    padding: "4px 8px",
    fontSize: 14,
  };

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    const updatedTrade = { ...trade, [name]: value };

    // Calculate risk amount when entry price, stop loss, or volume changes
    if (name === "entryPrice" || name === "sl" || name === "volume") {
      const selectedSymbol = symbolOptions.find(
        (s) => s.value === updatedTrade.symbol
      );
      if (selectedSymbol) {
        updatedTrade.pipSize = selectedSymbol.pipSize;
        updatedTrade.pipValuePerLot = selectedSymbol.pipValuePerLot;
      }
    }

    const recalculatedTrade = recalculateTradeFields(updatedTrade);
    setTrade(recalculatedTrade);
    onChange && onChange(recalculatedTrade);
  };
  const handleDateChange = (field, date) => {
    const updatedTrade = { ...trade, [field]: date };
    const recalculatedTrade = recalculateTradeFields(updatedTrade);
    setTrade(recalculatedTrade);
    onChange && onChange(recalculatedTrade);
  };
  const handleNotesChange = async (val) => {
    if (user && trade.id) {
      await storeNotes(user.uid, trade.id, val);
      setTrade((prev) => ({ ...prev, notes: val }));
      onChange && onChange({ ...trade, notes: val });
    }
  };
  const handleSave = async () => {
    if (isPreviewMode) {
      onPreviewSave && onPreviewSave(trade);
      return;
    }

    try {
      if (!user || !user.uid) {
        throw new Error("You must be logged in to save trades");
      }

      if (user && trade.id && !trade.id.startsWith("preview-")) {
        // Update existing trade
        console.log("Updating trade:", {
          tradeId: trade.id,
          accountId: trade.accountId,
          userId: user.uid,
          path: `users/${user.uid}/accounts/${trade.accountId}/trades/${trade.id}`,
          isDeleted: trade.isDeleted,
        });
        await updateTrade(trade.accountId, trade.id, trade);
        alert("Trade updated successfully!");
      } else {
        // Add new trade
        const newTrade = {
          ...trade,
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: user.uid,
          accountId: trade.accountId || accounts[0]?.id,
          isDeleted: false,
        };

        console.log("Adding new trade:", {
          accountId: newTrade.accountId,
          userId: user.uid,
          path: `users/${user.uid}/accounts/${newTrade.accountId}/trades`,
          isDeleted: newTrade.isDeleted,
        });

        // Add to Firestore under the correct path
        const tradesRef = collection(
          db,
          `users/${user.uid}/accounts/${newTrade.accountId}/trades`
        );
        const docRef = await addDoc(tradesRef, newTrade);

        // Update the trade with the new ID
        newTrade.id = docRef.id;
        alert("Trade added successfully!");
      }
      setEditMode(false);
    } catch (err) {
      console.error("Error saving trade:", err);
      if (err.code === "permission-denied") {
        console.error("Permission denied details:", {
          error: err,
          user: user?.uid,
          trade: trade?.id,
          account: trade?.accountId,
          path: `users/${user?.uid}/accounts/${trade?.accountId}/trades/${trade?.id}`,
          isDeleted: trade?.isDeleted,
        });
        alert(
          "Permission denied. Please check if you have the right access to this trade."
        );
      } else {
        alert("Error saving trade: " + err.message);
      }
    }
  };
  const handleCancel = () => {
    setTrade(initialTrade);
    setEditMode(false);
  };
  const handleEdit = () => setEditMode(true);

  // Add onClose handler
  const handleClose = () => {
    setEditMode(false);
    onClose();
  };

  // Helper for account name
  const getAccountName = (accountId) =>
    accounts.find((a) => a.id === accountId)?.name || "";
  // Helper to get setup name by id
  const getSetupName = (setupId) =>
    setups.find((s) => s.id === setupId)?.name || setupId;

  // Image upload handler
  const handleImageUpload = async (e) => {
    console.log("Image upload handler triggered");
    const file = e.target.files[0];
    console.log("Selected file:", file);
    console.log("Current trade:", trade);
    console.log("Current user:", user);
    console.log("trade.accountId:", trade.accountId);
    console.log("trade.id:", trade.id);

    if (!file || !trade || !user || !trade.accountId || !trade.id) {
      console.log("Missing required info for upload", { file, trade, user });
      return;
    }
    setImageUploading(true);
    try {
      const filePath = `users/${user.uid}/accounts/${trade.accountId}/trades/${
        trade.id
      }/chart_${Date.now()}_${file.name}`;
      console.log("Uploading to Supabase Storage at path:", filePath);

      const { data, error } = await supabase.storage
        .from("chart-images")
        .upload(filePath, file, { upsert: true });
      console.log("Upload result:", { data, error });
      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from("chart-images")
        .getPublicUrl(filePath);
      const url = publicUrlData.publicUrl;
      console.log("Public URL from Supabase:", url);

      setTrade((prev) => {
        console.log("Updating trade state with imageUrl:", url);
        return { ...prev, imageUrl: url };
      });
      if (onChange) {
        console.log("Calling onChange with new imageUrl");
        onChange({ ...trade, imageUrl: url });
      }
    } catch (err) {
      alert("Error uploading image: " + err.message);
      console.error("Upload error:", err);
    }
    setImageUploading(false);
  };
  // Remove image handler
  const handleRemoveImage = () => {
    setTrade((prev) => ({ ...prev, imageUrl: null }));
    onChange && onChange({ ...trade, imageUrl: null });
  };

  // Fetch rules for the selected setup
  const fetchRulesForSetup = async (setupId) => {
    if (!user || !setupId) return;
    setRulesLoading(true);
    try {
      // Find the setup object
      const setupObj = setups.find((s) => s.id === setupId);
      if (!setupObj) {
        setRules([]);
        setRulesLoading(false);
        return;
      }
      // Fetch rule groups and rules from Firestore
      const ruleGroupsRef = collection(
        db,
        `users/${user.uid}/setups/${setupId}/ruleGroups`
      );
      const groupsSnap = await getDocs(ruleGroupsRef);
      let allRules = [];
      for (const groupDoc of groupsSnap.docs) {
        const rulesRef = collection(
          db,
          `users/${user.uid}/setups/${setupId}/ruleGroups/${groupDoc.id}/rules`
        );
        const rulesSnap = await getDocs(rulesRef);
        allRules.push(
          ...rulesSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            groupName: groupDoc.data().name,
          }))
        );
      }
      setRules(allRules);
    } catch (err) {
      setRules([]);
    }
    setRulesLoading(false);
  };

  // Open rules dropdown and fetch rules
  const handleOpenRulesDropdown = async (e) => {
    e.stopPropagation();
    if (trade.setups) {
      await fetchRulesForSetup(trade.setups);
      setShowRulesDropdown(true);
    }
  };

  // Group rules by groupName
  const groupedRules = rules.reduce((acc, rule) => {
    const group = rule.groupName || "Other";
    if (!acc[group]) acc[group] = [];
    acc[group].push(rule);
    return acc;
  }, {});

  return (
    <div style={modalStyle} onClick={onClose}>
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 32,
          minWidth: 420,
          maxWidth: 900,
          maxHeight: "85vh",
          overflowY: "auto",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 20 }}>
            {isPreviewMode
              ? "Preview Trade"
              : editMode
              ? "Edit Trade"
              : "Trade Detail"}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {editMode ? (
              <>
                <FaTimes
                  style={{ cursor: "pointer", color: "#cf1322", fontSize: 22 }}
                  onClick={handleCancel}
                  title="Cancel"
                />
                <FaCheck
                  style={{ cursor: "pointer", color: "#52c41a", fontSize: 22 }}
                  onClick={async (e) => {
                    e.stopPropagation();
                    await handleSave();
                  }}
                  title="Save"
                />
                <button
                  onClick={handleClose}
                  style={{
                    background: "#f4f6fa",
                    border: "none",
                    borderRadius: "50%",
                    width: 36,
                    height: 36,
                    fontSize: 22,
                    cursor: "pointer",
                    color: "#888",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  aria-label="Close"
                  title="Close"
                >
                  ×
                </button>
              </>
            ) : (
              <>
                <FaEdit
                  style={{ cursor: "pointer", color: "#6C63FF", fontSize: 22 }}
                  onClick={handleEdit}
                  title="Edit"
                />
                <button
                  onClick={handleClose}
                  style={{
                    background: "#f4f6fa",
                    border: "none",
                    borderRadius: "50%",
                    width: 36,
                    height: 36,
                    fontSize: 22,
                    cursor: "pointer",
                    color: "#888",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  aria-label="Close"
                >
                  ×
                </button>
              </>
            )}
          </div>
        </div>
        {/* Inputs Section */}
        <div
          style={{
            fontWeight: 700,
            color: "#6C63FF",
            fontSize: 14,
            marginBottom: 8,
          }}
        >
          Inputs
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 18,
          }}
        >
          {inputFields.map((key) => {
            const col = getCol(key);
            if (!col) return null;

            // Symbol field
            if (key === "symbol" && editMode) {
              return (
                <div key={key} style={cardStyle}>
                  <div style={cardLabelStyle}>{col.label}</div>
                  <MinimalSelect
                    value={
                      trade.symbol
                        ? {
                            label: trade.symbol,
                            value: trade.symbol,
                          }
                        : null
                    }
                    onChange={(option) => {
                      const selectedSymbol = symbolOptions.find(
                        (s) => s.value === option?.value
                      );

                      // Update the trade state with the new symbol and its properties
                      const updatedTrade = {
                        ...trade,
                        symbol: option?.value || "",
                        pipSize: selectedSymbol?.pipSize || 0.0001,
                        pipValuePerLot: selectedSymbol?.pipValuePerLot || 10,
                      };

                      // Recalculate all trade fields
                      const recalculatedTrade =
                        recalculateTradeFields(updatedTrade);

                      // Update the trade state
                      setTrade(recalculatedTrade);

                      // Notify parent component of changes
                      if (onChange) {
                        onChange(recalculatedTrade);
                      }
                    }}
                    options={symbolOptions}
                    placeholder="Select symbol..."
                    styles={{
                      control: (base) => ({
                        ...base,
                        ...selectStyle,
                      }),
                    }}
                  />
                </div>
              );
            }

            // Date fields
            if (
              (key === "entryTimestamp" || key === "exitTimestamp") &&
              editMode
            ) {
              let dateValue = null;
              if (trade[key]) {
                if (typeof trade[key].toDate === "function") {
                  dateValue = trade[key].toDate();
                } else if (trade[key] instanceof Date) {
                  dateValue = trade[key];
                } else if (typeof trade[key] === "string") {
                  dateValue = new Date(trade[key]);
                }
                // Check if the date is valid
                if (isNaN(dateValue.getTime())) {
                  dateValue = null;
                }
              }
              return (
                <div key={key} style={cardStyle}>
                  <div style={cardLabelStyle}>{col.label}</div>
                  <DatePicker
                    selected={dateValue}
                    onChange={(date) => handleDateChange(key, date)}
                    showTimeSelect
                    dateFormat="yyyy-MM-dd HH:mm"
                    style={datePickerStyle}
                    calendarClassName="compact-calendar"
                    popperClassName="compact-popper"
                  />
                </div>
              );
            }

            // Direction field
            if (key === "direction" && editMode) {
              return (
                <div key={key} style={cardStyle}>
                  <div style={cardLabelStyle}>{col.label}</div>
                  <MinimalSelect
                    value={
                      formattedTrade.direction
                        ? {
                            label: formattedTrade.direction,
                            value: formattedTrade.direction,
                          }
                        : null
                    }
                    onChange={(option) =>
                      handleFieldChange({
                        target: { name: "direction", value: option?.value },
                      })
                    }
                    options={directionOptions.map((dir) => ({
                      label: dir,
                      value: dir,
                    }))}
                    placeholder="Select direction..."
                    styles={{
                      control: (base) => ({
                        ...base,
                        ...selectStyle,
                      }),
                    }}
                  />
                </div>
              );
            }

            // Number fields
            const numberFields = [
              "volume",
              "entryPrice",
              "exitPrice",
              "sl",
              "commission",
              "swap",
              "netPnL",
              "maxDrawdownR",
              "maxRR",
            ];
            if (numberFields.includes(key) && editMode) {
              return (
                <div key={key} style={cardStyle}>
                  <div style={cardLabelStyle}>{col.label}</div>
                  <input
                    name={key}
                    type="number"
                    value={formattedTrade[key] ?? ""}
                    onChange={handleFieldChange}
                    style={numberInputStyle}
                    step="any"
                  />
                </div>
              );
            }

            // Setups field
            if (key === "setups" && editMode) {
              return (
                <div key={key} style={cardStyle}>
                  <div style={cardLabelStyle}>
                    {col.label}
                    <span
                      ref={rulesButtonRef}
                      style={{
                        color: "#3b5cff",
                        fontWeight: 600,
                        fontSize: 12,
                        marginLeft: 8,
                        cursor: "pointer",
                        textDecoration: "underline",
                        position: "relative",
                      }}
                      onClick={handleOpenRulesDropdown}
                    >
                      rules
                      {showRulesDropdown && (
                        <div
                          ref={rulesDropdownRef}
                          style={{
                            position: "absolute",
                            top: 20,
                            right: 0,
                            left: "auto",
                            minWidth: 220,
                            maxWidth: "100%",
                            background: "#fff",
                            border: "1px solid #eee",
                            borderRadius: 8,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                            zIndex: 1000,
                            padding: 8,
                            fontSize: 14,
                          }}
                        >
                          {rulesLoading ? (
                            <div
                              style={{
                                color: "#888",
                                textAlign: "center",
                                padding: 12,
                                fontSize: 12,
                              }}
                            >
                              Loading...
                            </div>
                          ) : rules.length === 0 ? (
                            <div
                              style={{
                                color: "#888",
                                textAlign: "center",
                                padding: 12,
                                fontSize: 12,
                              }}
                            >
                              No rules found for this setup.
                            </div>
                          ) : (
                            <div
                              style={{
                                maxHeight: 220,
                                maxWidth: 320,
                                width: "100%",
                                overflowY: "auto",
                                overflowX: "hidden",
                                background: "#fff",
                              }}
                            >
                              {Object.entries(groupedRules).map(
                                ([group, groupRules]) => (
                                  <div key={group} style={{ marginBottom: 0 }}>
                                    <div
                                      style={{
                                        fontWeight: 500,
                                        fontSize: 13,
                                        color: "#222",
                                        marginBottom: 4,
                                        textTransform: "uppercase",
                                        letterSpacing: 0.5,
                                        padding: "2px 4px",
                                      }}
                                    >
                                      {group}
                                    </div>
                                    {groupRules.map((rule) => (
                                      <div
                                        key={rule.id}
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          padding: "2px 2px 2px 0",
                                          borderRadius: 6,
                                          fontSize: 12,
                                          color: "#222",
                                          fontWeight: 400,
                                          transition: "background 0.15s",
                                          ...(editMode
                                            ? { cursor: "pointer" }
                                            : {}),
                                        }}
                                        onMouseEnter={(e) =>
                                          editMode &&
                                          (e.currentTarget.style.background =
                                            "#f4f6fa")
                                        }
                                        onMouseLeave={(e) =>
                                          editMode &&
                                          (e.currentTarget.style.background =
                                            "transparent")
                                        }
                                      >
                                        <input
                                          type="checkbox"
                                          checked={
                                            Array.isArray(localSelectedRules) &&
                                            localSelectedRules.includes(rule.id)
                                          }
                                          onChange={
                                            editMode
                                              ? () =>
                                                  handleRuleCheckboxChange(
                                                    rule.id
                                                  )
                                              : undefined
                                          }
                                          readOnly={!editMode}
                                          style={{
                                            marginRight: 8,
                                            accentColor: "#3b5cff",
                                            width: 14,
                                            height: 14,
                                            borderRadius: 4,
                                            border: "1px solid #bbb",
                                            outline: "none",
                                            cursor: editMode
                                              ? "pointer"
                                              : "default",
                                          }}
                                        />
                                        <span
                                          style={{
                                            flex: 1,
                                            color: "#222",
                                            fontSize: 12,
                                            fontWeight: 400,
                                            wordBreak: "break-word",
                                          }}
                                        >
                                          {rule.name}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </span>
                  </div>
                  <MinimalSelect
                    value={
                      trade.setups
                        ? {
                            label: getSetupName(trade.setups),
                            value: trade.setups,
                          }
                        : null
                    }
                    onChange={(option) => {
                      handleFieldChange({
                        target: { name: "setups", value: option?.value },
                      });
                    }}
                    options={setups.map((setup) => ({
                      label: setup.name,
                      value: setup.id,
                    }))}
                    placeholder="Select setup..."
                    styles={{
                      control: (base) => ({
                        ...base,
                        ...selectStyle,
                      }),
                    }}
                  />
                </div>
              );
            }

            // Setups field in view mode
            if (key === "setups" && !editMode) {
              return (
                <div key={key} style={cardStyle}>
                  <div style={cardLabelStyle}>
                    {col.label}
                    <span
                      ref={rulesButtonRef}
                      style={{
                        color: "#3b5cff",
                        fontWeight: 600,
                        fontSize: 12,
                        marginLeft: 8,
                        cursor: "pointer",
                        textDecoration: "underline",
                        position: "relative",
                      }}
                      onClick={handleOpenRulesDropdown}
                    >
                      rules
                      {showRulesDropdown && (
                        <div
                          ref={rulesDropdownRef}
                          style={{
                            position: "absolute",
                            top: 20,
                            right: 0,
                            left: "auto",
                            minWidth: 220,
                            maxWidth: "100%",
                            background: "#fff",
                            border: "1px solid #eee",
                            borderRadius: 8,
                            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                            zIndex: 1000,
                            padding: 8,
                            fontSize: 14,
                          }}
                        >
                          {rulesLoading ? (
                            <div
                              style={{
                                color: "#888",
                                textAlign: "center",
                                padding: 12,
                                fontSize: 12,
                              }}
                            >
                              Loading...
                            </div>
                          ) : rules.length === 0 ? (
                            <div
                              style={{
                                color: "#888",
                                textAlign: "center",
                                padding: 12,
                                fontSize: 12,
                              }}
                            >
                              No rules found for this setup.
                            </div>
                          ) : (
                            <div
                              style={{
                                maxHeight: 220,
                                maxWidth: 320,
                                width: "100%",
                                overflowY: "auto",
                                overflowX: "hidden",
                                background: "#fff",
                              }}
                            >
                              {Object.entries(groupedRules).map(
                                ([group, groupRules]) => (
                                  <div key={group} style={{ marginBottom: 0 }}>
                                    <div
                                      style={{
                                        fontWeight: 500,
                                        fontSize: 13,
                                        color: "#222",
                                        marginBottom: 4,
                                        textTransform: "uppercase",
                                        letterSpacing: 0.5,
                                        padding: "2px 4px",
                                      }}
                                    >
                                      {group}
                                    </div>
                                    {groupRules.map((rule) => (
                                      <div
                                        key={rule.id}
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          padding: "2px 2px 2px 0",
                                          borderRadius: 6,
                                          fontSize: 12,
                                          color: "#222",
                                          fontWeight: 400,
                                          transition: "background 0.15s",
                                          ...(editMode
                                            ? { cursor: "pointer" }
                                            : {}),
                                        }}
                                        onMouseEnter={(e) =>
                                          editMode &&
                                          (e.currentTarget.style.background =
                                            "#f4f6fa")
                                        }
                                        onMouseLeave={(e) =>
                                          editMode &&
                                          (e.currentTarget.style.background =
                                            "transparent")
                                        }
                                      >
                                        <input
                                          type="checkbox"
                                          checked={
                                            Array.isArray(localSelectedRules) &&
                                            localSelectedRules.includes(rule.id)
                                          }
                                          onChange={
                                            editMode
                                              ? () =>
                                                  handleRuleCheckboxChange(
                                                    rule.id
                                                  )
                                              : undefined
                                          }
                                          readOnly={!editMode}
                                          style={{
                                            marginRight: 8,
                                            accentColor: "#3b5cff",
                                            width: 14,
                                            height: 14,
                                            borderRadius: 4,
                                            border: "1px solid #bbb",
                                            outline: "none",
                                            cursor: editMode
                                              ? "pointer"
                                              : "default",
                                          }}
                                        />
                                        <span
                                          style={{
                                            flex: 1,
                                            color: "#222",
                                            fontSize: 12,
                                            fontWeight: 400,
                                            wordBreak: "break-word",
                                          }}
                                        >
                                          {rule.name}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </span>
                  </div>
                  <div style={cardValueStyle}>{getSetupName(trade.setups)}</div>
                </div>
              );
            }

            // Account field
            if (key === "accountName" && editMode) {
              return (
                <div key={key} style={cardStyle}>
                  <div style={cardLabelStyle}>{col.label}</div>
                  <MinimalSelect
                    value={
                      trade.accountId
                        ? {
                            label: getAccountName(trade.accountId),
                            value: trade.accountId,
                          }
                        : null
                    }
                    onChange={(option) =>
                      handleFieldChange({
                        target: { name: "accountId", value: option?.value },
                      })
                    }
                    options={accounts.map((account) => ({
                      label: account.name,
                      value: account.id,
                    }))}
                    placeholder="Select account..."
                    styles={{
                      control: (base) => ({
                        ...base,
                        ...selectStyle,
                      }),
                    }}
                  />
                </div>
              );
            }

            // Default: text input in edit mode
            if (editMode) {
              return (
                <div key={key} style={cardStyle}>
                  <div style={cardLabelStyle}>{col.label}</div>
                  <input
                    name={key}
                    type="text"
                    value={trade[key] ?? ""}
                    onChange={handleFieldChange}
                    style={inputStyle}
                  />
                </div>
              );
            }

            // View mode: read-only
            return (
              <div key={key} style={cardStyle}>
                <div style={cardLabelStyle}>{col.label}</div>
                <div
                  style={{
                    ...cardValueStyle,
                    color:
                      key === "netPnL"
                        ? getPnLColor(trade[key])
                        : key === "direction"
                        ? getDirectionColor(trade[key])
                        : key === "status"
                        ? getStatusColor(trade[key])
                        : "#222",
                  }}
                >
                  {key === "setups"
                    ? getSetupName(trade[key])
                    : key === "entryTimestamp" || key === "exitTimestamp"
                    ? formatDateTime24(trade[key])
                    : trade[key] ?? ""}
                </div>
              </div>
            );
          })}
        </div>
        {/* Calculated Section */}
        <div
          style={{
            fontWeight: 700,
            color: "#6C63FF",
            fontSize: 14,
            marginBottom: 8,
          }}
        >
          Calculated
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 18,
          }}
        >
          {calculatedFields.map((key) => {
            const col = getCol(key);
            if (!col) return null;
            return (
              <div key={key} style={cardStyle}>
                <div style={cardLabelStyle}>{col.label}</div>
                <div style={cardValueStyle}>
                  {key === "entryTimestamp" || key === "exitTimestamp"
                    ? formatDateTime24(trade[key])
                    : trade[key] ?? ""}
                </div>
              </div>
            );
          })}
        </div>
        {/* Tabs Section */}
        <div
          style={{
            display: "flex",
            gap: 2,
            marginBottom: 16,
            borderBottom: "1px solid #eee",
            paddingBottom: 8,
          }}
        >
          <button
            onClick={() => setActiveTab("chart")}
            style={{
              background: activeTab === "chart" ? "#6C63FF" : "#f4f6fa",
              color: activeTab === "chart" ? "#fff" : "#666",
              border: "none",
              padding: "8px 16px",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Chart
          </button>
          <button
            onClick={() => setActiveTab("notes")}
            style={{
              background: activeTab === "notes" ? "#6C63FF" : "#f4f6fa",
              color: activeTab === "notes" ? "#fff" : "#666",
              border: "none",
              padding: "8px 16px",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Notes
          </button>
        </div>

        {/* Chart Tab Content */}
        {activeTab === "chart" && (
          <div>
            {trade.imageUrl ? (
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  marginBottom: 24,
                }}
              >
                <img
                  src={trade.imageUrl}
                  alt="Trade Chart"
                  style={{
                    width: "100%",
                    maxHeight: 400,
                    objectFit: "contain",
                    borderRadius: 12,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    background: "#f7f7fa",
                  }}
                />
                {editMode && (
                  <button
                    onClick={handleRemoveImage}
                    style={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      background: "rgba(255,255,255,0.85)",
                      border: "none",
                      borderRadius: "50%",
                      width: 36,
                      height: 36,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    }}
                    title="Remove Image"
                  >
                    <FaTrash style={{ color: "#cf1322", fontSize: 18 }} />
                  </button>
                )}
              </div>
            ) : editMode && trade.id ? (
              <div style={{ marginBottom: 24 }}>
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  disabled={imageUploading}
                />
                <button
                  onClick={() =>
                    fileInputRef.current && fileInputRef.current.click()
                  }
                  style={{
                    background: "#6C63FF",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 24px",
                    fontWeight: 600,
                    fontSize: 15,
                    cursor: imageUploading ? "not-allowed" : "pointer",
                    opacity: imageUploading ? 0.7 : 1,
                  }}
                  disabled={imageUploading}
                >
                  {imageUploading ? "Uploading..." : "Add Image"}
                </button>
              </div>
            ) : (
              editMode && (
                <div style={{ color: "#cf1322", marginBottom: 24 }}>
                  Please save the trade before uploading an image.
                </div>
              )
            )}
          </div>
        )}

        {/* Notes Tab Content */}
        {activeTab === "notes" && (
          <div style={{ background: "#f7f7fa", borderRadius: 12, padding: 16 }}>
            <NotesModal
              open={true}
              onClose={() => {}}
              value={trade.notes}
              onChange={(content) => {
                setTrade((prev) => ({ ...prev, notes: content }));
                onChange && onChange({ ...trade, notes: content });
              }}
              editMode={editMode}
              inline={true}
              style={{
                position: "relative",
                boxShadow: "none",
                padding: 0,
                background: "transparent",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default TradeModal;
