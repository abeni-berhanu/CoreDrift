import React, { useState, useEffect, useCallback, useRef } from "react";
import { FaTimes, FaPlus, FaTrash } from "react-icons/fa";
import { db } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  increment,
  writeBatch,
  setDoc,
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import ConfirmDialog from "./ConfirmDialog";

const TagManager = ({
  selectedTags = [],
  initialTags = [],
  onTagsChange,
  placeholder = "Add tags...",
  maxTags = 10,
  allowCreate = true,
  style = {},
  collectionName = "tradeTags",
}) => {
  const { user, loading: authLoading } = useAuth();
  const [availableTags, setAvailableTags] = useState(initialTags);
  const [tagInput, setTagInput] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredTags, setFilteredTags] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMouseInDropdown, setIsMouseInDropdown] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState(null);

  // Ensure selectedTags is always an array
  const safeSelectedTags = Array.isArray(selectedTags) ? selectedTags : [];

  // Update availableTags when initialTags changes
  useEffect(() => {
    if (initialTags) {
      // Ensure no duplicate tags by using a Map
      const uniqueTags = new Map();
      initialTags.forEach((tag) => {
        if (tag && tag.id) {
          uniqueTags.set(tag.id, tag);
        }
      });
      setAvailableTags(Array.from(uniqueTags.values()));
    }
  }, [initialTags]);

  // Filter available tags based on input
  useEffect(() => {
    if (!availableTags) return;

    const input = tagInput.toLowerCase().trim();
    const filtered = availableTags.filter(
      (tag) =>
        tag &&
        tag.id &&
        tag.name &&
        (input === "" || tag.name.toLowerCase().includes(input)) &&
        !safeSelectedTags.includes(tag.id)
    );
    setFilteredTags(filtered);
  }, [tagInput, availableTags, safeSelectedTags]);

  const saveCustomTag = async (tagName) => {
    if (!user || !tagName.trim()) return null;

    try {
      setIsLoading(true);
      const tagsRef = collection(db, "users", user.uid, collectionName);
      const q = query(tagsRef, where("name", "==", tagName.trim()));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const existingTag = querySnapshot.docs[0];
        const tagData = existingTag.data();
        return {
          id: existingTag.id,
          name: tagData.name,
        };
      }

      const newTagRef = await addDoc(tagsRef, {
        name: tagName.trim(),
        createdAt: serverTimestamp(),
        lastUsed: serverTimestamp(),
        count: 0,
      });

      const newTag = {
        id: newTagRef.id,
        name: tagName.trim(),
      };

      // Update availableTags ensuring no duplicates
      setAvailableTags((prev) => {
        const uniqueTags = new Map(prev.map((tag) => [tag.id, tag]));
        uniqueTags.set(newTag.id, newTag);
        return Array.from(uniqueTags.values());
      });

      return newTag;
    } catch (error) {
      console.error("Error creating tag:", error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTag = async (tagId) => {
    if (!user) return;

    try {
      setIsLoading(true);
      const tagRef = doc(db, "users", user.uid, collectionName, tagId);
      await deleteDoc(tagRef);
      setAvailableTags((prev) => prev.filter((tag) => tag.id !== tagId));
      onTagsChange(safeSelectedTags.filter((id) => id !== tagId));
    } catch (error) {
      console.error("Error deleting tag:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTagSelect = async (tag) => {
    if (safeSelectedTags.length >= maxTags) {
      return;
    }

    if (!safeSelectedTags.includes(tag.id)) {
      onTagsChange([...safeSelectedTags, tag.id]);
    }
    setTagInput("");
    setShowDropdown(false);
  };

  const handleKeyDown = async (e) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      if (safeSelectedTags.length >= maxTags) {
        return;
      }

      const existingTag = availableTags.find(
        (t) => t.name.toLowerCase() === tagInput.toLowerCase()
      );

      if (existingTag) {
        handleTagSelect(existingTag);
      } else if (allowCreate) {
        const newTag = await saveCustomTag(tagInput.trim());
        if (newTag) {
          handleTagSelect(newTag);
        }
      }
    } else if (
      e.key === "Backspace" &&
      !tagInput &&
      safeSelectedTags.length > 0
    ) {
      onTagsChange(safeSelectedTags.slice(0, -1));
    }
  };

  const handleTagRemove = useCallback(
    (tagToRemove) => {
      onTagsChange(safeSelectedTags.filter((tag) => tag !== tagToRemove));
    },
    [safeSelectedTags, onTagsChange]
  );

  const handleInputChange = useCallback((e) => {
    setTagInput(e.target.value);
    setShowDropdown(true);
  }, []);

  const handleInputKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && tagInput.trim()) {
        e.preventDefault();
        handleKeyDown(e);
      } else if (
        e.key === "Backspace" &&
        !tagInput &&
        safeSelectedTags.length > 0
      ) {
        handleTagRemove(safeSelectedTags[safeSelectedTags.length - 1]);
      }
    },
    [tagInput, safeSelectedTags, handleKeyDown, handleTagRemove]
  );

  const handleContainerClick = useCallback(() => {
    if (!isLoading) {
      setShowDropdown(true);
      inputRef.current?.focus();
    }
  }, [isLoading]);

  const handleDropdownMouseEnter = useCallback(() => {
    setIsMouseInDropdown(true);
  }, []);

  const handleDropdownMouseLeave = useCallback(() => {
    setIsMouseInDropdown(false);
  }, []);

  const handleTagClick = useCallback(
    (tag) => {
      handleTagSelect(tag);
    },
    [handleTagSelect]
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target) &&
        !isMouseInDropdown
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMouseInDropdown]);

  const handleDeleteTag = (tag) => {
    setTagToDelete(tag);
    setIsConfirmOpen(true);
  };

  const confirmDeleteTag = async () => {
    if (!tagToDelete) return;

    try {
      await deleteTag(tagToDelete.id);
      setTagToDelete(null);
    } catch (error) {
      console.error("Error deleting tag:", error);
    } finally {
      setIsConfirmOpen(false);
    }
  };

  return (
    <div style={{ position: "relative", ...style }} ref={containerRef}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          border: "1px solid #eee",
          borderRadius: 8,
          padding: "8px 12px",
          background: "#fff",
          minHeight: 36,
          alignItems: "center",
          cursor: "text",
          opacity: isLoading ? 0.7 : 1,
          pointerEvents: isLoading ? "none" : "auto",
          transition: "all 0.2s",
          boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
        }}
        onClick={handleContainerClick}
      >
        {safeSelectedTags.map((tagId) => {
          const tag = availableTags.find((t) => t.id === tagId);
          return tag ? (
            <span
              key={`selected-${tagId}`}
              style={{
                background: "#f0f0f0",
                color: "#666",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 13,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.2s",
              }}
            >
              {tag.name}
              <button
                style={{
                  background: "none",
                  border: "none",
                  color: "#999",
                  padding: 0,
                  margin: 0,
                  cursor:
                    style.pointerEvents === "none" ? "default" : "pointer",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  transition: "all 0.2s",
                  opacity: style.pointerEvents === "none" ? 0 : 0.3,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteTag(tag);
                }}
                title="Remove tag"
                onMouseEnter={(e) => {
                  if (style.pointerEvents !== "none") {
                    e.currentTarget.style.background = "#e0e0e0";
                    e.currentTarget.style.color = "#666";
                    e.currentTarget.style.opacity = 1;
                  }
                }}
                onMouseLeave={(e) => {
                  if (style.pointerEvents !== "none") {
                    e.currentTarget.style.background = "none";
                    e.currentTarget.style.color = "#999";
                    e.currentTarget.style.opacity = 0.3;
                  }
                }}
              >
                ×
              </button>
            </span>
          ) : null;
        })}
        <input
          ref={inputRef}
          style={{
            border: "none",
            outline: "none",
            fontSize: 13,
            flex: 1,
            minWidth: 60,
            background: "transparent",
            padding: "4px 0",
            cursor: style.pointerEvents === "none" ? "default" : "text",
            color: style.pointerEvents === "none" ? "#999" : "inherit",
          }}
          value={tagInput}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onFocus={() => {
            if (style.pointerEvents !== "none") {
              setShowDropdown(true);
            }
          }}
          placeholder={style.pointerEvents === "none" ? "" : placeholder}
          disabled={style.pointerEvents === "none"}
        />
      </div>
      {showDropdown &&
        style.pointerEvents !== "none" &&
        (filteredTags.length > 0 || (allowCreate && tagInput)) && (
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
              zIndex: 1000,
              maxHeight: 200,
              overflowY: "auto",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
            onMouseEnter={handleDropdownMouseEnter}
            onMouseLeave={handleDropdownMouseLeave}
          >
            {filteredTags.map((tag) => (
              <div
                key={`dropdown-${tag.id}`}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "#555",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "all 0.2s",
                  borderBottom: "1px solid #f5f5f5",
                }}
                onClick={() => handleTagClick(tag)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f5f5f5";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#fff";
                }}
              >
                <span>{tag.name}</span>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    color: "#ff4d4f",
                    padding: "4px 8px",
                    borderRadius: 4,
                    opacity: 0.3,
                    transition: "all 0.2s",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTag(tag);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#fff1f0";
                    e.currentTarget.style.opacity = 1;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "none";
                    e.currentTarget.style.opacity = 0.3;
                  }}
                >
                  <FaTrash size={14} />
                </button>
              </div>
            ))}
            {allowCreate && tagInput && (
              <div
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "#6C63FF",
                  borderTop: "1px solid #eee",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
                onClick={async () => {
                  const newTag = await saveCustomTag(tagInput);
                  if (newTag) {
                    handleTagSelect(newTag);
                  }
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f5f5f5";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#fff";
                }}
              >
                <FaPlus size={12} />
                Create "{tagInput}"
              </div>
            )}
          </div>
        )}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => {
          setIsConfirmOpen(false);
          setTagToDelete(null);
        }}
        onConfirm={confirmDeleteTag}
        title="Delete Tag"
        message={`Are you sure you want to delete the tag "${tagToDelete?.name}"?`}
      />
    </div>
  );
};

export default TagManager;
