import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
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
import { useAccount } from "../contexts/AccountContext";
import { useSetups } from "../contexts/SetupsContext";
import {
  doc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
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
import TagManager from "./TagManager";

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
  const { accounts: authAccounts } = useAccount();
  const { setups: authSetups } = useSetups();
  const {
    updateTrade,
    isLoading: isUpdating,
    createTrade,
  } = useDataManagement();
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
  const [showFullImage, setShowFullImage] = useState(false);
  const [availableTags, setAvailableTags] = useState([]);
  const [authReady, setAuthReady] = useState(false);

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
    "tagIds",
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
  const getCol = useCallback(
    (key) => columns.find((c) => c.key === key) || { key, label: key },
    [columns]
  );

  // Memoize the rule checkbox change handler
  const handleRuleCheckboxChange = useCallback((ruleId) => {
    setLocalSelectedRules((prev) => {
      const newRules = prev.includes(ruleId)
        ? prev.filter((id) => id !== ruleId)
        : [...prev, ruleId];
      return newRules;
    });
  }, []);

  // Memoize the close dropdown handler
  const handleCloseRulesDropdown = useCallback(() => {
    setShowRulesDropdown(false);
    setTrade((prev) => {
      const newTrade = { ...prev, selectedRules: localSelectedRules };
      if (onChange) {
        onChange(newTrade);
      }
      return newTrade;
    });
  }, [localSelectedRules, onChange, trade]);

  // Memoize the open dropdown handler
  const handleOpenRulesDropdown = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (trade.setups && !rulesLoading) {
        setRulesLoading(true);
        try {
          await fetchRulesForSetup(trade.setups);
          setShowRulesDropdown(true);
        } finally {
          setRulesLoading(false);
        }
      }
    },
    [trade.setups, rulesLoading]
  );

  // Memoize the grouped rules
  const groupedRules = useMemo(
    () =>
      rules.reduce((acc, rule) => {
        const group = rule.groupName || "Other";
        if (!acc[group]) acc[group] = [];
        acc[group].push(rule);
        return acc;
      }, {}),
    [rules]
  );

  // Memoize the dropdown content
  const rulesDropdownContent = useMemo(() => {
    if (rulesLoading) {
      return (
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
      );
    }

    if (rules.length === 0) {
      return (
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
      );
    }

    const allRuleIds = rules.map((rule) => rule.id);
    const areAllSelected = allRuleIds.every((id) =>
      localSelectedRules.includes(id)
    );

    return (
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
        {editMode && (
          <div
            style={{
              padding: "8px 4px",
              borderBottom: "1px solid #eee",
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <input
              type="checkbox"
              checked={areAllSelected}
              onChange={(e) => {
                e.stopPropagation();
                if (editMode) {
                  setLocalSelectedRules(areAllSelected ? [] : allRuleIds);
                }
              }}
              style={{
                marginRight: 8,
                accentColor: "#3b5cff",
                width: 14,
                height: 14,
                borderRadius: 4,
                border: "1px solid #bbb",
                outline: "none",
                cursor: editMode ? "pointer" : "default",
              }}
            />
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "#222",
              }}
            >
              {areAllSelected ? "Unselect All" : "Select All"}
            </span>
          </div>
        )}
        {Object.entries(groupedRules).map(([group, groupRules]) => (
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
                  ...(editMode ? { cursor: "pointer" } : {}),
                }}
                onMouseEnter={(e) =>
                  editMode && (e.currentTarget.style.background = "#f4f6fa")
                }
                onMouseLeave={(e) =>
                  editMode && (e.currentTarget.style.background = "transparent")
                }
              >
                <input
                  type="checkbox"
                  checked={
                    Array.isArray(localSelectedRules) &&
                    localSelectedRules.includes(rule.id)
                  }
                  onChange={(e) => {
                    e.stopPropagation();
                    if (editMode) {
                      handleRuleCheckboxChange(rule.id);
                    }
                  }}
                  readOnly={!editMode}
                  style={{
                    marginRight: 8,
                    accentColor: "#3b5cff",
                    width: 14,
                    height: 14,
                    borderRadius: 4,
                    border: "1px solid #bbb",
                    outline: "none",
                    cursor: editMode ? "pointer" : "default",
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
        ))}
      </div>
    );
  }, [
    rules,
    rulesLoading,
    groupedRules,
    localSelectedRules,
    editMode,
    handleRuleCheckboxChange,
  ]);

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
  }, [showRulesDropdown, handleCloseRulesDropdown]);

  // Fetch rules for the selected setup
  const fetchRulesForSetup = async (setupId) => {
    if (!user || !setupId) return;
    try {
      // Find the setup object
      const setupObj = authSetups.find((s) => s.id === setupId);
      if (!setupObj) {
        setRules([]);
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
      console.error("Error fetching rules:", err);
      setRules([]);
    }
  };

  // Add paste event handler
  useEffect(() => {
    const handlePaste = async (e) => {
      if (!editMode || !trade.id || imageUploading) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.indexOf("image") !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            setImageUploading(true);
            try {
              const filePath = `users/${user.uid}/accounts/${
                trade.accountId
              }/trades/${trade.id}/chart_${Date.now()}_pasted.png`;

              const { data, error } = await supabase.storage
                .from("chart-images")
                .upload(filePath, file, { upsert: true });

              if (error) throw error;

              const { data: publicUrlData } = supabase.storage
                .from("chart-images")
                .getPublicUrl(filePath);

              const url = publicUrlData.publicUrl;
              setTrade((prev) => ({ ...prev, imageUrl: url }));
              if (onChange) {
                onChange({ ...trade, imageUrl: url });
              }
            } catch (err) {
              alert("Error uploading pasted image: " + err.message);
            }
            setImageUploading(false);
          }
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [
    editMode,
    trade.id,
    imageUploading,
    user,
    trade.accountId,
    onChange,
    trade,
  ]);

  useEffect(() => {
    setAuthReady(!!user);
  }, [user]);

  // Fetch trade tags
  useEffect(() => {
    if (!authReady || !user) return;

    try {
      const tagsRef = collection(db, `users/${user.uid}/tradeTags`);
      const q = query(tagsRef, orderBy("lastUsed", "desc"));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const tags = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
            };
          });
          setAvailableTags(tags);
        },
        (error) => {
          setAvailableTags([]);
        }
      );

      return () => unsubscribe();
    } catch (error) {
      setAvailableTags([]);
    }
  }, [authReady, user]);

  const deleteTag = async (tagId) => {
    if (!user) return;

    if (
      !window.confirm(
        "Are you sure you want to delete this tag? This will remove it from all trades."
      )
    ) {
      return;
    }

    try {
      // Delete the tag from the correct path
      const tagRef = doc(db, "users", user.uid, "tradeTags", tagId);
      await deleteDoc(tagRef);

      // Update available tags
      setAvailableTags((prev) => prev.filter((tag) => tag.id !== tagId));

      // Remove the tag from the current trade if it's selected
      if (trade.tagIds?.includes(tagId)) {
        handleFieldChange(
          "tagIds",
          trade.tagIds.filter((id) => id !== tagId)
        );
      }
    } catch (error) {
      console.error("Error deleting tag:", error);
      alert("Error deleting tag: " + error.message);
    }
  };

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

  const handleFieldChange = (field, value) => {
    if (!editMode) return;

    // If value is an event object, extract the value from it
    const newValue = value?.target ? value.target.value : value;
    const name = value?.target ? value.target.name : field;

    // Validate and clean the value based on field type
    let validatedValue = newValue;

    // Number fields validation
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
    if (numberFields.includes(name)) {
      // Allow empty string for clearing the field
      if (newValue === "") {
        validatedValue = null;
      } else {
        // Convert to number and validate
        const num = Number(newValue);
        if (isNaN(num)) {
          return; // Don't update if invalid number
        }
        validatedValue = num;
      }
    }

    // Direction field validation
    if (name === "direction") {
      if (!["Buy", "Sell"].includes(newValue)) {
        return; // Don't update if invalid direction
      }
    }

    // Setups field validation
    if (name === "setups") {
      // Ensure setups is either a valid ID or null
      if (newValue && !authSetups.some((s) => s.id === newValue)) {
        return; // Don't update if invalid setup ID
      }
    }

    // Account field validation
    if (name === "accountId") {
      // Ensure accountId is either a valid ID or null
      if (newValue && !authAccounts.some((a) => a.id === newValue)) {
        return; // Don't update if invalid account ID
      }
    }

    // Update the trade with validated value
    const updatedTrade = { ...trade, [name]: validatedValue };

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

    // Get the account's initial balance
    const account = accounts.find((acc) => acc.id === trade.accountId);
    const initialBalance = account ? Number(account.initialBalance) : null;

    if (!initialBalance) {
      console.error("No initial balance found for account:", trade.accountId);
      return;
    }

    const recalculatedTrade = recalculateTradeFields(
      updatedTrade,
      initialBalance
    );
    setTrade(recalculatedTrade);
    onChange && onChange(recalculatedTrade);
  };

  const handleDateChange = (field, date) => {
    if (!editMode) return;

    const updatedTrade = { ...trade, [field]: date };

    // Get the account's initial balance
    const account = accounts.find((acc) => acc.id === trade.accountId);
    const initialBalance = account ? Number(account.initialBalance) : null;

    if (!initialBalance) {
      console.error("No initial balance found for account:", trade.accountId);
      return;
    }

    const recalculatedTrade = recalculateTradeFields(
      updatedTrade,
      initialBalance
    );
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
        await updateTrade(trade.accountId, trade.id, trade);
        alert("Trade updated successfully!");
      } else {
        // Add new trade
        const newTrade = {
          ...trade,
          accountId: trade.accountId || authAccounts[0]?.id,
          isDeleted: false,
        };

        await createTrade(newTrade.accountId, newTrade);
        alert("Trade added successfully!");
      }
      setEditMode(false);
    } catch (err) {
      console.error("Error saving trade:", err);
      alert("Error saving trade: " + err.message);
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
    authAccounts.find((a) => a.id === accountId)?.name || "";
  // Helper to get setup name by id
  const getSetupName = (setupId) =>
    authSetups.find((s) => s.id === setupId)?.name || setupId;

  // Image upload handler
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];

    if (!file || !trade || !user || !trade.accountId || !trade.id) {
      return;
    }
    setImageUploading(true);
    try {
      const filePath = `users/${user.uid}/accounts/${trade.accountId}/trades/${
        trade.id
      }/chart_${Date.now()}_${file.name}`;

      const { data, error } = await supabase.storage
        .from("chart-images")
        .upload(filePath, file, { upsert: true });
      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from("chart-images")
        .getPublicUrl(filePath);
      const url = publicUrlData.publicUrl;

      setTrade((prev) => {
        return { ...prev, imageUrl: url };
      });
      if (onChange) {
        onChange({ ...trade, imageUrl: url });
      }
    } catch (err) {
      alert("Error uploading image: " + err.message);
    }
    setImageUploading(false);
  };
  // Remove image handler
  const handleRemoveImage = () => {
    setTrade((prev) => ({ ...prev, imageUrl: null }));
    onChange && onChange({ ...trade, imageUrl: null });
  };

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
                  onClick={handleSave}
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
                    type="text"
                    value={trade[key] ?? ""}
                    onChange={(e) => handleFieldChange(key, e)}
                    style={numberInputStyle}
                    inputMode="decimal"
                    pattern="-?\d*\.?\d*"
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
                          onClick={(e) => e.stopPropagation()}
                        >
                          {rulesDropdownContent}
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
                      handleFieldChange("setups", option?.value || null);
                    }}
                    options={authSetups.map((setup) => ({
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
                          onClick={(e) => e.stopPropagation()}
                        >
                          {rulesDropdownContent}
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
                    options={authAccounts.map((account) => ({
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

            // Max RR field
            if (key === "maxRR") {
              return (
                <div key={key} style={cardStyle}>
                  <div style={cardLabelStyle}>{col.label}</div>
                  {editMode ? (
                    <input
                      type="number"
                      step="0.01"
                      value={trade[key] || ""}
                      onChange={(e) => handleFieldChange(key, e.target.value)}
                      style={inputStyle}
                    />
                  ) : (
                    <div style={readOnlyStyle}>{trade[key] || "N/A"}</div>
                  )}
                </div>
              );
            }

            // Tags field
            if (key === "tagIds") {
              return (
                <div key={key} style={cardStyle}>
                  <div style={cardLabelStyle}>Tags</div>
                  {editMode ? (
                    <TagManager
                      selectedTags={
                        Array.isArray(trade.tagIds) ? trade.tagIds : []
                      }
                      initialTags={availableTags}
                      onTagsChange={(tags) => handleFieldChange("tagIds", tags)}
                      placeholder="Add tags..."
                      maxTags={5}
                      allowCreate={true}
                      collectionName="tradeTags"
                    />
                  ) : (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {trade.tagIds?.map((tagId) => {
                        const tag = availableTags.find((t) => t.id === tagId);
                        return tag ? (
                          <span
                            key={tagId}
                            style={{
                              background: "#f0f0f0",
                              color: "#666",
                              borderRadius: 6,
                              padding: "2px 8px",
                              fontSize: 13,
                              fontWeight: 500,
                            }}
                          >
                            {tag.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Default: text input in edit mode
            if (editMode) {
              return (
                <div key={key} style={cardStyle}>
                  <div style={cardLabelStyle}>{col.label}</div>
                  <input
                    type="text"
                    value={trade[key] || ""}
                    onChange={(e) => handleFieldChange(key, e.target.value)}
                    style={inputStyle}
                  />
                </div>
              );
            }

            // Default: read-only display
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
                  {trade[key] !== undefined &&
                  trade[key] !== null &&
                  trade[key] !== ""
                    ? key === "setups"
                      ? getSetupName(trade[key])
                      : key === "entryTimestamp" || key === "exitTimestamp"
                      ? formatDateTime24(trade[key])
                      : trade[key]
                    : "N/A"}
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
                    cursor: "pointer",
                  }}
                  onClick={() => setShowFullImage(true)}
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
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
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
                  <span style={{ color: "#666", fontSize: 13 }}>
                    You can also paste an image directly (Ctrl+V)
                  </span>
                </div>
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
      {/* Full Size Image Modal */}
      {showFullImage && trade.imageUrl && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.9)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={(e) => {
            e.stopPropagation();
            setShowFullImage(false);
          }}
        >
          <img
            src={trade.imageUrl}
            alt="Trade Chart Full Size"
            style={{
              maxWidth: "90vw",
              maxHeight: "90vh",
              objectFit: "contain",
              borderRadius: 8,
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowFullImage(false);
            }}
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "50%",
              width: 40,
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#fff",
              fontSize: 24,
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default TradeModal;
