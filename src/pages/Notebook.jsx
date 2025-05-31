import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useAccount } from "../contexts/AccountContext";
import { db } from "../firebase";
import { dataService } from "../services/DataService";
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  getDocs,
  where,
  orderBy,
} from "firebase/firestore";
import {
  FaSearch,
  FaFilter,
  FaSort,
  FaChevronDown,
  FaLongArrowAltUp,
  FaLongArrowAltDown,
  FaExternalLinkAlt,
  FaCalendarAlt,
  FaStickyNote,
  FaChartLine,
} from "react-icons/fa";
import { NotesModal } from "../components/Notes";
import TradeModal from "../components/TradeModal";

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

// Add styles for chips
const chipStyles = {
  container: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    padding: "4px 8px",
    minHeight: "32px",
    border: "1px solid #eee",
    borderRadius: 4,
    background: "#fff",
    minWidth: 200,
    maxWidth: 300,
  },
  chip: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 8px",
    background: "#f0f0f0",
    borderRadius: 16,
    fontSize: 12,
    color: "#666",
  },
  removeButton: {
    background: "none",
    border: "none",
    padding: 0,
    margin: 0,
    cursor: "pointer",
    color: "#999",
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 16,
    height: 16,
    borderRadius: "50%",
    "&:hover": {
      background: "#e0e0e0",
      color: "#666",
    },
  },
  input: {
    border: "none",
    outline: "none",
    padding: "4px 0",
    fontSize: 13,
    flex: 1,
    minWidth: 60,
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    background: "#fff",
    border: "1px solid #eee",
    borderRadius: 4,
    marginTop: 4,
    maxHeight: 200,
    overflowY: "auto",
    zIndex: 1000,
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  },
  dropdownItem: {
    padding: "8px 12px",
    cursor: "pointer",
    fontSize: 13,
    "&:hover": {
      background: "#f5f5f5",
    },
  },
};

// Helper to strip HTML tags from note content
function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

// Helper to format date as 'TUE 20/01/2033'
function getTodayFormatted() {
  const today = new Date();
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const day = days[today.getDay()];
  const dd = String(today.getDate()).padStart(2, "0");
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const yyyy = today.getFullYear();
  return `${day} ${dd}/${mm}/${yyyy}`;
}

function Notebook() {
  const { user } = useAuth();
  const { accounts, selectedAccountIds } = useAccount();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showTradeDetail, setShowTradeDetail] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editNoteOpen, setEditNoteOpen] = useState(false);
  const [editNoteForm, setEditNoteForm] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [noteType, setNoteType] = useState("notebook");
  const [selectedTags, setSelectedTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [availableTrades, setAvailableTrades] = useState([]);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [tradeSearch, setTradeSearch] = useState("");
  const [symbols, setSymbols] = useState([]);
  const [colors, setColors] = useState({});
  const [activeTab, setActiveTab] = useState("journal");

  // Add text type options
  const textTypes = [
    { id: "text", label: "Text", icon: "Aa" },
    { id: "h1", label: "Heading 1", icon: "H1" },
    { id: "h2", label: "Heading 2", icon: "H2" },
    { id: "h3", label: "Heading 3", icon: "H3" },
    { id: "bullet", label: "Bullet List", icon: "•" },
    { id: "numbered", label: "Numbered List", icon: "1." },
  ];

  const handleTextTypeChange = (type) => {
    const selection = window.getSelection();
    if (selection.toString()) {
      const noteContent = document.getElementById("note-content");
      const element = document.createElement(
        type === "text"
          ? "p"
          : type === "h1"
          ? "h1"
          : type === "h2"
          ? "h2"
          : type === "h3"
          ? "h3"
          : type === "bullet"
          ? "ul"
          : "ol"
      );

      if (type === "bullet" || type === "numbered") {
        const li = document.createElement("li");
        li.textContent = selection.toString();
        element.appendChild(li);
      } else {
        element.textContent = selection.toString();
      }

      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(element);
      selection.removeAllRanges();
    }
  };

  // Fetch symbols and colors from root
  useEffect(() => {
    const fetchSymbolsAndColors = async () => {
      try {
        // Fetch symbols
        const symbolsSnapshot = await getDocs(collection(db, "symbols"));
        const symbolsList = symbolsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setSymbols(symbolsList);

        // Fetch colors
        const colorsSnapshot = await getDocs(collection(db, "colors"));
        const colorsMap = {};
        colorsSnapshot.docs.forEach((doc) => {
          colorsMap[doc.id] = doc.data();
        });
        setColors(colorsMap);
      } catch (error) {
        console.error("Error fetching symbols and colors:", error);
      }
    };

    fetchSymbolsAndColors();
  }, []);

  // Fetch notes based on active tab
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    let collectionName = "journalNotes";
    if (activeTab === "note") collectionName = "notes";
    const notesPath = `users/${user.uid}/${collectionName}`;
    const q = query(collection(db, notesPath), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const entries = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setNotes(entries);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching notes:", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user, activeTab]);

  // Fetch trades for reference
  useEffect(() => {
    if (!user || !selectedAccountIds.length) return;

    const fetchTrades = async () => {
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
      setAvailableTrades(trades);
    };

    fetchTrades();
  }, [user, selectedAccountIds, accounts]);

  // Filter notes
  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      note.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTags =
      selectedTags.length === 0 ||
      selectedTags.every((tag) => note.tags?.includes(tag));
    return matchesSearch && matchesTags;
  });

  // Sort notes
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (sortBy === "date") {
      const dateA = a.createdAt?.toDate?.() || a.createdAt;
      const dateB = b.createdAt?.toDate?.() || b.createdAt;
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    } else if (sortBy === "title") {
      const titleA = (a.title || "").toLowerCase();
      const titleB = (b.title || "").toLowerCase();
      if (titleA < titleB) return sortOrder === "desc" ? 1 : -1;
      if (titleA > titleB) return sortOrder === "desc" ? -1 : 1;
      return 0;
    }
    return 0;
  });

  const handleNoteClick = (note) => {
    setSelectedNote(normalizeTradeDates(note));
  };

  const handleAddNote = () => {
    const isJournal = activeTab === "journal";
    const newNote = {
      title: isJournal ? getTodayFormatted() : "New Note",
      content: "",
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setSelectedNote(newNote);
    setIsEditing(true);
  };

  const handleEditNote = (note) => {
    setEditNoteForm(note);
    setIsEditing(true);
  };

  const handleEditNoteSave = async () => {
    if (!user || !editNoteForm) return;

    try {
      const noteRef = doc(db, `users/${user.uid}/notebooks/${editNoteForm.id}`);
      await updateDoc(noteRef, {
        ...editNoteForm,
        updatedAt: new Date(),
      });
      setNotes(
        notes.map((note) =>
          note.id === editNoteForm.id ? { ...note, ...editNoteForm } : note
        )
      );
      setEditNoteForm(null);
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving note:", error);
      alert("Failed to save note. Please try again.");
    }
  };

  const handleDeleteNote = async () => {
    if (!user || !selectedNote) return;
    const collectionName = activeTab === "note" ? "notes" : "journalNotes";
    if (window.confirm("Are you sure you want to delete this note?")) {
      try {
        const noteRef = doc(
          db,
          `users/${user.uid}/${collectionName}/${selectedNote.id}`
        );
        await deleteDoc(noteRef);
        setNotes(notes.filter((note) => note.id !== selectedNote.id));
        setSelectedNote(null);
        setIsEditing(false);
      } catch (error) {
        console.error("Error deleting note:", error);
        alert("Failed to delete note. Please try again.");
      }
    }
  };

  // Add trade handlers
  const handleEditTrade = (trade) => {
    setShowTradeDetail(false);
    setEditForm({
      ...trade,
      direction: trade.direction === "Buy" ? "long" : "short",
    });
    setEditOpen(true);
  };

  const handleEditCancel = () => {
    setEditOpen(false);
    setEditForm(null);
  };

  const handleEditSave = async () => {
    if (!editForm || !user) return;
    setEditSubmitting(true);

    try {
      const tradeId = editForm.id;
      const tradesPath = `users/${user.uid}/accounts/${editForm.accountId}/trades/${tradeId}`;

      // Prepare update object (convert numbers as needed)
      const updateObj = {
        ...editForm,
        direction: editForm.direction === "long" ? "Buy" : "Sell",
      };

      // Convert numeric fields
      [
        "entryPrice",
        "exitPrice",
        "sl",
        "riskAmount",
        "commission",
        "swap",
        "netPnL",
        "duration",
        "riskToReward",
        "percentRisk",
        "percentPnL",
        "maxDrawdownR",
        "maxRR",
        "volume",
      ].forEach((f) => {
        if (
          updateObj[f] !== undefined &&
          updateObj[f] !== null &&
          updateObj[f] !== ""
        ) {
          updateObj[f] = Number(updateObj[f]);
        }
      });

      await updateDoc(doc(db, tradesPath), updateObj);
      setEditOpen(false);
      setEditForm(null);
    } catch (err) {
      console.error("Error saving trade:", err);
      alert("Error saving trade: " + err.message);
    }
    setEditSubmitting(false);
  };

  const handleSaveNote = async () => {
    if (!user || !selectedNote) return;
    const collectionName = activeTab === "note" ? "notes" : "journalNotes";
    const notesRef = collection(db, `users/${user.uid}/${collectionName}`);
    const noteData = {
      title: selectedNote.title,
      content: selectedNote.content,
      createdAt: selectedNote.createdAt,
      updatedAt: new Date(),
      tags: selectedNote.tags || [],
    };
    console.log("[handleSaveNote] collectionName:", collectionName);
    console.log("[handleSaveNote] noteData:", noteData);
    try {
      if (selectedNote.id) {
        // Update existing note
        console.log("[handleSaveNote] Updating note with id:", selectedNote.id);
        const noteRef = doc(
          db,
          `users/${user.uid}/${collectionName}/${selectedNote.id}`
        );
        await updateDoc(noteRef, noteData);
        setNotes(
          notes.map((note) =>
            note.id === selectedNote.id ? { ...note, ...noteData } : note
          )
        );
      } else {
        // Create new note
        console.log("[handleSaveNote] Creating new note");
        const docRef = await addDoc(notesRef, noteData);
        const newNote = { id: docRef.id, ...noteData };
        setNotes([newNote, ...notes]);
        setSelectedNote(newNote);
      }
      setIsEditing(false);
    } catch (error) {
      console.error(
        "[handleSaveNote] Error saving note:",
        error,
        error?.message,
        error?.code
      );
      alert("Failed to save note. Please try again.");
    }
  };

  // Clear selected note and exit edit mode when switching tabs
  useEffect(() => {
    setSelectedNote(null);
    setIsEditing(false);
  }, [activeTab]);

  return (
    <div
      style={{
        padding: 32,
        maxWidth: 1400,
        margin: "0 auto",
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Row: Tabs (left) + Controls (right) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
          gap: 24,
        }}
      >
        {/* Tab Bar (left) */}
        <div
          style={{
            display: "flex",
            gap: 0,
            background: "#f7f8fa",
            borderRadius: 12,
            padding: 4,
            width: "fit-content",
            boxShadow: "none",
          }}
        >
          <button
            onClick={() => setActiveTab("journal")}
            style={{
              padding: "8px 18px",
              borderRadius: 10,
              border: "none",
              background: activeTab === "journal" ? "#fff" : "#f7f8fa",
              color: activeTab === "journal" ? "#6C63FF" : "#555",
              fontWeight: 600,
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              gap: 7,
              cursor: "pointer",
              boxShadow: "none",
            }}
          >
            <FaCalendarAlt style={{ marginRight: 4, fontSize: 18 }} /> Journal
          </button>
          <button
            onClick={() => setActiveTab("note")}
            style={{
              padding: "8px 18px",
              borderRadius: 10,
              border: "none",
              background: activeTab === "note" ? "#fff" : "#f7f8fa",
              color: activeTab === "note" ? "#6C63FF" : "#555",
              fontWeight: 600,
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              gap: 7,
              cursor: "pointer",
              boxShadow: "none",
            }}
          >
            <FaStickyNote style={{ marginRight: 4, fontSize: 18 }} /> Note
          </button>
        </div>
        {/* Controls (right) */}
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          {/* Search */}
          <div style={{ position: "relative" }}>
            <input
              placeholder="Search notes..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: "8px 12px 8px 36px",
                borderRadius: 8,
                border: "1px solid #eee",
                fontSize: 14,
                width: 200,
              }}
            />
            <FaSearch
              style={{
                color: "#888",
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 14,
              }}
            />
          </div>
          {/* Account Select */}
          <select
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #eee",
              fontSize: 14,
              background: "#fff",
              cursor: "pointer",
            }}
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
          >
            <option value="all">All Accounts</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
          {/* Tags Multiselect */}
          <div style={{ position: "relative", minWidth: 180 }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                border: "1px solid #eee",
                borderRadius: 8,
                padding: "6px 8px",
                background: "#fff",
                minHeight: 36,
                alignItems: "center",
                cursor: "text",
              }}
              onClick={() => setShowTagDropdown(true)}
            >
              {selectedTags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    background: "#f0f0f0",
                    color: "#888",
                    borderRadius: 6,
                    padding: "2px 8px",
                    fontSize: 13,
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {tag}
                  <button
                    style={{
                      background: "none",
                      border: "none",
                      color: "#aaa",
                      marginLeft: 4,
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTags(selectedTags.filter((t) => t !== tag));
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                style={{
                  border: "none",
                  outline: "none",
                  fontSize: 13,
                  flex: 1,
                  minWidth: 60,
                  background: "transparent",
                }}
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                onFocus={() => setShowTagDropdown(true)}
                placeholder={
                  selectedTags.length === 0 ? "Filter by tags..." : ""
                }
              />
            </div>
            {showTagDropdown && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  background: "#fff",
                  border: "1px solid #eee",
                  borderRadius: 8,
                  marginTop: 4,
                  zIndex: 10,
                  maxHeight: 200,
                  overflowY: "auto",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
              >
                {availableTags
                  .filter(
                    (tag) =>
                      tag.toLowerCase().includes(tagSearch.toLowerCase()) &&
                      !selectedTags.includes(tag)
                  )
                  .map((tag) => (
                    <div
                      key={tag}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        fontSize: 13,
                        color: "#555",
                      }}
                      onClick={() => {
                        setSelectedTags([...selectedTags, tag]);
                        setTagSearch("");
                        setShowTagDropdown(false);
                      }}
                    >
                      {tag}
                    </div>
                  ))}
                {availableTags.filter(
                  (tag) =>
                    tag.toLowerCase().includes(tagSearch.toLowerCase()) &&
                    !selectedTags.includes(tag)
                ).length === 0 && (
                  <div
                    style={{ padding: "8px 12px", color: "#aaa", fontSize: 13 }}
                  >
                    No tags found
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Sort/Order */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #eee",
                fontSize: 14,
                background: "#fff",
                cursor: "pointer",
              }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="date">Date</option>
              <option value="title">Title</option>
            </select>
            <button
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #eee",
                fontSize: 14,
                background: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
              onClick={() =>
                setSortOrder(sortOrder === "desc" ? "asc" : "desc")
              }
            >
              {sortOrder === "desc" ? "Desc" : "Asc"}
              {sortOrder === "desc" ? (
                <FaLongArrowAltDown style={{ fontSize: 12 }} />
              ) : (
                <FaLongArrowAltUp style={{ fontSize: 12 }} />
              )}
            </button>
          </div>
        </div>
      </div>
      {/* Main Content: Sidebar (left) + Main (right) */}
      <div style={{ display: "flex", gap: 24, flex: 1, minHeight: 0 }}>
        {/* Sidebar (left) */}
        <div
          style={{
            width: 300,
            minWidth: 220,
            maxWidth: 340,
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "24px 24px 12px 24px",
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 20 }}>
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </div>
            {activeTab !== "analysis" && (
              <button
                style={{
                  padding: "7px 16px",
                  background: "#6C63FF",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 500,
                  fontSize: 13,
                  cursor: "pointer",
                }}
                onClick={handleAddNote}
              >
                Add Note
              </button>
            )}
          </div>
          {/* Notes list */}
          <div
            style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px 16px" }}
          >
            {sortedNotes.length === 0 ? (
              <div
                style={{
                  color: "#888",
                  textAlign: "center",
                  marginTop: 32,
                  fontSize: 13,
                }}
              >
                No notes found.
              </div>
            ) : (
              sortedNotes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => handleNoteClick(note)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    background: "#fff",
                    borderRadius: 12,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    border:
                      selectedNote?.id === note.id
                        ? "2px solid #6C63FF"
                        : "1px solid #eee",
                    marginBottom: 16,
                    padding: "16px 16px 12px 16px",
                    cursor: "pointer",
                    position: "relative",
                    transition: "border 0.2s, box-shadow 0.2s",
                    fontSize: 14,
                  }}
                >
                  {/* Colored accent for selected note */}
                  {selectedNote?.id === note.id && (
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 4,
                        borderRadius: "12px 0 0 12px",
                        background: "#6C63FF",
                      }}
                    />
                  )}
                  {/* Title and tags row */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 15,
                        marginRight: 10,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        flex: 1,
                      }}
                    >
                      {note.title}
                    </span>
                    {note.tags && note.tags.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          gap: 4,
                          flexWrap: "wrap",
                          marginLeft: 8,
                        }}
                      >
                        {note.tags.map((tag) => (
                          <span
                            key={tag}
                            style={{
                              background: "#f0f0f0",
                              color: "#888",
                              borderRadius: 6,
                              padding: "2px 8px",
                              fontSize: 12,
                              fontWeight: 500,
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Note content preview */}
                  <div
                    style={{
                      color: "#666",
                      fontSize: 13,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {stripHtml(note.content)
                      .replace(/\r?\n|\r/g, " ")
                      .slice(0, 100)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        {/* Main content (right) */}
        <div
          style={{
            flex: 1,
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            padding: 0,
            overflowY: "auto",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
          {/* Top row controls and actions */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 12,
              padding: "20px 24px 0 24px",
              background: "#fff",
              borderRadius: "12px 12px 0 0",
              borderBottom: "1px solid #f0f0f0",
            }}
          >
            {/* Add tags */}
            <input
              placeholder="Add tags..."
              style={{
                padding: "7px 10px",
                borderRadius: 8,
                border: "1px solid #eee",
                fontSize: 13,
                minWidth: 120,
              }}
            />
            {/* Action buttons */}
            {activeTab === "analysis" && (
              <button
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  border: "1px solid #eee",
                  background: "#fff",
                  color: "#333",
                  fontWeight: 500,
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  cursor: "pointer",
                }}
              >
                <FaExternalLinkAlt style={{ fontSize: 14 }} /> Open Trade
              </button>
            )}
            <button
              style={{
                padding: "7px 14px",
                borderRadius: 8,
                border: "1px solid #eee",
                background: "#fff",
                color: "#333",
                fontWeight: 500,
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 5,
                cursor: "pointer",
              }}
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? "Cancel Edit" : "Edit Note"}
            </button>
            {isEditing && (
              <button
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: "#6C63FF",
                  color: "#fff",
                  fontWeight: 500,
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  cursor: "pointer",
                }}
                onClick={handleSaveNote}
              >
                Save Changes
              </button>
            )}
            <button
              style={{
                padding: "7px 14px",
                borderRadius: 8,
                border: "1px solid #eee",
                background: "#fff",
                color: "#ff4d4f",
                fontWeight: 500,
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 5,
                cursor: "pointer",
              }}
              onClick={handleDeleteNote}
            >
              Delete Note
            </button>
          </div>
          {/* Main note content area */}
          <div
            style={{
              flex: 1,
              background: "#f7f8fa",
              borderRadius: "0 0 12px 12px",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              height: "100%",
            }}
          >
            {selectedNote ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: "100%",
                  padding: "24px",
                  gap: "16px",
                  flex: 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                      flex: 1,
                    }}
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        value={selectedNote.title}
                        onChange={(e) => {
                          setSelectedNote((prev) => ({
                            ...prev,
                            title: e.target.value,
                          }));
                        }}
                        style={{
                          fontSize: 22,
                          fontWeight: 700,
                          border: "1px solid #6C63FF",
                          borderRadius: 8,
                          padding: "8px 12px",
                          width: "100%",
                          maxWidth: 400,
                          background: "#fff",
                        }}
                      />
                    ) : (
                      <h2
                        style={{
                          margin: 0,
                          fontSize: 22,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {selectedNote.title}
                      </h2>
                    )}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "16px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        color: "#888",
                        fontSize: 13,
                      }}
                    >
                      {isEditing ? (
                        <input
                          type="datetime-local"
                          value={
                            selectedNote.createdAt
                              ? new Date(
                                  selectedNote.createdAt?.toDate?.() ||
                                    selectedNote.createdAt
                                )
                                  .toISOString()
                                  .slice(0, 16)
                              : ""
                          }
                          onChange={(e) => {
                            const newDate = new Date(e.target.value);
                            setSelectedNote((prev) => ({
                              ...prev,
                              createdAt: newDate,
                            }));
                          }}
                          style={{
                            fontSize: 13,
                            border: "1px solid #6C63FF",
                            borderRadius: 6,
                            padding: "4px 8px",
                            background: "#fff",
                          }}
                        />
                      ) : selectedNote.createdAt ? (
                        new Date(
                          selectedNote.createdAt?.toDate?.() ||
                            selectedNote.createdAt
                        ).toLocaleString()
                      ) : (
                        ""
                      )}
                    </div>
                    {selectedNote.tags && selectedNote.tags.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          gap: "6px",
                          flexWrap: "wrap",
                        }}
                      >
                        {selectedNote.tags.map((tag) => (
                          <span
                            key={tag}
                            style={{
                              background: "#f0f0f0",
                              color: "#888",
                              borderRadius: 6,
                              padding: "3px 10px",
                              fontSize: 13,
                              fontWeight: 500,
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    flex: 1,
                    background: "#fff",
                    borderRadius: 12,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    minHeight: 0,
                  }}
                >
                  <NotesModal
                    key={
                      selectedNote.id ||
                      selectedNote.createdAt?.toString() ||
                      "new"
                    }
                    open={true}
                    onClose={() => {}}
                    value={selectedNote.content}
                    onChange={(content) => {
                      setSelectedNote((prev) => ({ ...prev, content }));
                    }}
                    editMode={isEditing}
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
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "#888",
                  fontSize: 16,
                }}
              >
                Select a note to view its content
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Note Modal */}
      {isEditing && editNoteForm && (
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
              background: "white",
              padding: "20px",
              borderRadius: "8px",
              width: "80%",
              maxWidth: "800px",
            }}
          >
            <h3>Edit Note</h3>
            <div style={{ marginBottom: "16px" }}>
              <input
                type="text"
                value={editNoteForm.title}
                onChange={(e) =>
                  setEditNoteForm({ ...editNoteForm, title: e.target.value })
                }
                placeholder="Note title"
                style={{
                  width: "100%",
                  padding: "8px",
                  marginBottom: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                }}
              />
              <textarea
                value={editNoteForm.content}
                onChange={(e) =>
                  setEditNoteForm({ ...editNoteForm, content: e.target.value })
                }
                placeholder="Note content"
                style={{
                  width: "100%",
                  height: "200px",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                  resize: "vertical",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
              }}
            >
              <button
                onClick={() => {
                  setEditNoteForm(null);
                  setIsEditing(false);
                }}
                style={{
                  padding: "8px 16px",
                  background: "#f0f0f0",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleEditNoteSave}
                style={{
                  padding: "8px 16px",
                  background: "#6C63FF",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trade Detail Modal */}
      {showTradeDetail && selectedNote && (
        <TradeModal
          open={showTradeDetail}
          onClose={() => {
            setShowTradeDetail(false);
          }}
          trade={selectedNote}
          accounts={accounts}
          symbols={symbols.map((s) => ({
            label: s.id,
            value: s.id,
            pipSize: s.pipSize,
            pipValuePerLot: s.pipValuePerLot,
          }))}
          colors={colors}
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
          onEdit={handleEditTrade}
          setupColors={colors}
        />
      )}

      {/* Edit Trade Modal */}
      {editOpen && editForm && (
        <TradeModal
          onClose={handleEditCancel}
          trade={editForm}
          accounts={accounts}
          symbols={symbols.map((s) => ({
            label: s.id,
            value: s.id,
            pipSize: s.pipSize,
            pipValuePerLot: s.pipValuePerLot,
          }))}
          colors={colors}
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
          onEdit={handleEditSave}
          setupColors={colors}
        />
      )}
    </div>
  );
}

export default Notebook;
