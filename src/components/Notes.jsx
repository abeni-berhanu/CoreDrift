import React, { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Heading from "@tiptap/extension-heading";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import ListItem from "@tiptap/extension-list-item";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Placeholder from "@tiptap/extension-placeholder";
import { db } from "../firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import {
  FaBold,
  FaItalic,
  FaUnderline,
  FaListUl,
  FaListOl,
  FaTasks,
  FaTable,
  FaMinus,
  FaHeading,
  FaParagraph,
} from "react-icons/fa";

// Function to store notes in Firestore
export const storeNotes = async (userId, tradeId, notes) => {
  if (!userId || !tradeId) return;

  // Get the trade document to find its accountId
  const tradeRef = doc(
    db,
    `users/${userId}/accounts/${tradeId.split("/")[0]}/trades/${
      tradeId.split("/")[1]
    }`
  );
  const tradeDoc = await getDoc(tradeRef);

  if (!tradeDoc.exists()) return;

  const tradeData = tradeDoc.data();
  const accountId = tradeData.accountId;

  // Store notes in the correct path under the account
  const notesRef = doc(
    db,
    `users/${userId}/accounts/${accountId}/trades/${tradeId.split("/")[1]}`
  );
  await setDoc(notesRef, { notes }, { merge: true });
};

// Function to fetch notes from Firestore
export const fetchNotes = async (userId, tradeId) => {
  if (!userId || !tradeId) return null;

  // Get the trade document to find its accountId
  const tradeRef = doc(
    db,
    `users/${userId}/accounts/${tradeId.split("/")[0]}/trades/${
      tradeId.split("/")[1]
    }`
  );
  const tradeDoc = await getDoc(tradeRef);

  if (!tradeDoc.exists()) return null;

  const tradeData = tradeDoc.data();
  const accountId = tradeData.accountId;

  // Fetch notes from the correct path under the account
  const notesRef = doc(
    db,
    `users/${userId}/accounts/${accountId}/trades/${tradeId.split("/")[1]}`
  );
  const notesDoc = await getDoc(notesRef);

  if (!notesDoc.exists()) return null;
  return notesDoc.data().notes;
};

// Function to store setup notes in Firestore
export const storeSetupNotes = async (userId, setupId, notes) => {
  if (!userId || !setupId) return;

  // Store notes directly in the setup document
  const setupRef = doc(db, `users/${userId}/setups/${setupId}`);
  await setDoc(setupRef, { notes }, { merge: true });
};

// Function to fetch setup notes from Firestore
export const fetchSetupNotes = async (userId, setupId) => {
  if (!userId || !setupId) return null;

  // Fetch notes directly from the setup document
  const setupRef = doc(db, `users/${userId}/setups/${setupId}`);
  const setupDoc = await getDoc(setupRef);

  if (!setupDoc.exists()) return null;
  return setupDoc.data().notes;
};

export function NotesModal({
  open,
  onClose,
  value,
  onChange,
  editMode = false,
  inline = false,
  onSave,
  onCancel,
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        bulletList: false,
        orderedList: false,
        listItem: false,
        horizontalRule: false,
      }),
      Underline,
      BulletList,
      OrderedList,
      ListItem,
      TaskList,
      TaskItem,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      HorizontalRule,
      Placeholder.configure({ placeholder: "Add notes about this trade..." }),
    ],
    content: value || "",
    editable: editMode,
    onUpdate: ({ editor }) => {
      if (onChange) onChange(editor.getHTML());
    },
  });

  // Update editor's editable state when editMode changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(editMode);
    }
  }, [editMode, editor]);

  // Update content when value changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "");
    }
  }, [value, editor]);

  if (!open) return null;

  const handleSave = () => {
    if (editor && onSave) {
      onSave(editor.getHTML());
    }
  };

  const handleCancel = () => {
    if (editor) {
      editor.commands.setContent(value || "");
    }
    if (onCancel) {
      onCancel();
    }
  };

  const handleToolbarAction = (action) => {
    if (!editMode) return; // Prevent actions when not in edit mode
    action();
    // Ensure editor maintains focus after toolbar action
    editor?.commands.focus();
  };

  const toolbar = [
    {
      icon: <FaParagraph size={14} />,
      action: () => editor.chain().focus().setParagraph().run(),
      label: "Paragraph",
      isActive: () => editor.isActive("paragraph"),
    },
    {
      icon: <FaHeading size={14} />,
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      label: "Heading 1",
      isActive: () => editor.isActive("heading", { level: 1 }),
    },
    {
      icon: <FaHeading size={12} />,
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      label: "Heading 2",
      isActive: () => editor.isActive("heading", { level: 2 }),
    },
    {
      icon: <FaHeading size={10} />,
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      label: "Heading 3",
      isActive: () => editor.isActive("heading", { level: 3 }),
    },
    {
      icon: <FaBold size={14} />,
      action: () => editor.chain().focus().toggleBold().run(),
      label: "Bold",
      isActive: () => editor.isActive("bold"),
    },
    {
      icon: <FaItalic size={14} />,
      action: () => editor.chain().focus().toggleItalic().run(),
      label: "Italic",
      isActive: () => editor.isActive("italic"),
    },
    {
      icon: <FaUnderline size={14} />,
      action: () => editor.chain().focus().toggleUnderline().run(),
      label: "Underline",
      isActive: () => editor.isActive("underline"),
    },
    {
      icon: <FaListUl size={14} />,
      action: () => editor.chain().focus().toggleBulletList().run(),
      label: "Bulleted List",
      isActive: () => editor.isActive("bulletList"),
    },
    {
      icon: <FaListOl size={14} />,
      action: () => editor.chain().focus().toggleOrderedList().run(),
      label: "Numbered List",
      isActive: () => editor.isActive("orderedList"),
    },
    {
      icon: <FaTasks size={14} />,
      action: () => editor.chain().focus().toggleTaskList().run(),
      label: "Checklist",
      isActive: () => editor.isActive("taskList"),
    },
    {
      icon: <FaTable size={14} />,
      action: () =>
        editor
          .chain()
          .focus()
          .insertTable({ rows: 2, cols: 2, withHeaderRow: true })
          .run(),
      label: "Table",
      isActive: () => editor.isActive("table"),
    },
    {
      icon: <FaMinus size={14} />,
      action: () => editor.chain().focus().setHorizontalRule().run(),
      label: "Divider",
      isActive: () => false,
    },
  ];

  if (inline) {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {editMode && (
          <>
            <div
              style={{
                display: "flex",
                gap: 4,
                flexWrap: "wrap",
                marginBottom: 8,
                padding: "8px",
                background: "#f8f9fa",
                borderRadius: "6px",
              }}
            >
              {toolbar.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleToolbarAction(item.action)}
                  style={{
                    padding: "6px",
                    border: "1px solid #eee",
                    borderRadius: 4,
                    background: item.isActive() ? "#e6e6ff" : "#f7f7fa",
                    cursor: "pointer",
                    color: item.isActive() ? "#6C63FF" : "#333",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 32,
                    height: 32,
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = item.isActive()
                      ? "#e6e6ff"
                      : "#eee";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = item.isActive()
                      ? "#e6e6ff"
                      : "#f7f7fa";
                  }}
                  title={item.label}
                >
                  {item.icon}
                </button>
              ))}
            </div>
          </>
        )}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            background: editMode ? "#fafbfc" : "#f7f7fa",
            border: "none",
            borderRadius: 6,
            padding: 16,
            fontSize: 15,
            color: "#222",
            overflowY: "auto",
            position: "relative",
          }}
        >
          <div
            style={{
              minHeight: "100%",
              outline: "none",
              caretColor: editMode ? "#333" : "transparent",
              padding: "8px 0",
            }}
          >
            <EditorContent
              editor={editor}
              style={{
                "& .ProseMirror": {
                  outline: "none",
                  padding: "8px 0",
                  border: "none",
                  boxShadow: "none",
                },
                "& .ProseMirror:focus": {
                  outline: "none",
                  border: "none",
                  boxShadow: "none",
                },
                "& .ProseMirror p": {
                  margin: "0.5em 0",
                },
              }}
            />
          </div>
          {!inline && editMode && (
            <div
              style={{
                position: "absolute",
                bottom: 16,
                right: 16,
                display: "flex",
                gap: 8,
                background: "#fff",
                padding: "4px",
                borderRadius: 6,
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              }}
            >
              <button
                onClick={handleCancel}
                style={{
                  padding: "6px 12px",
                  borderRadius: 4,
                  border: "1px solid #eee",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "#666",
                  minWidth: 100,
                  textAlign: "center",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                style={{
                  padding: "6px 12px",
                  borderRadius: 4,
                  border: "none",
                  background: "#6C63FF",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "#fff",
                  minWidth: 100,
                  textAlign: "center",
                }}
              >
                Save Changes
              </button>
            </div>
          )}
        </div>
        {!editMode && !value && (
          <div
            style={{
              color: "#aaa",
              fontStyle: "italic",
              fontSize: 14,
              marginTop: 8,
            }}
          >
            No notes for this trade.
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.18)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 32,
          minWidth: 340,
          maxWidth: 600,
          width: "100%",
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
            marginBottom: 12,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 17, color: "#222" }}>
            Notes
          </div>
          <button
            onClick={onClose}
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
        </div>
        {editMode && (
          <div
            style={{
              display: "flex",
              gap: 4,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            {toolbar.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => handleToolbarAction(item.action)}
                style={{
                  padding: "6px",
                  border: "1px solid #eee",
                  borderRadius: 4,
                  background: item.isActive() ? "#e6e6ff" : "#f7f7fa",
                  cursor: "pointer",
                  color: item.isActive() ? "#6C63FF" : "#333",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 32,
                  height: 32,
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = item.isActive()
                    ? "#e6e6ff"
                    : "#eee";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = item.isActive()
                    ? "#e6e6ff"
                    : "#f7f7fa";
                }}
                title={item.label}
              >
                {item.icon}
              </button>
            ))}
          </div>
        )}
        <div
          style={{
            minHeight: 80,
            background: editMode ? "#fafbfc" : "#f7f7fa",
            border: "none",
            borderRadius: 6,
            padding: 10,
            fontSize: 15,
            color: "#222",
          }}
        >
          <EditorContent editor={editor} />
        </div>
        {!editMode && !value && (
          <div
            style={{
              color: "#aaa",
              fontStyle: "italic",
              fontSize: 14,
              marginTop: 8,
            }}
          >
            No notes for this trade.
          </div>
        )}
      </div>
    </div>
  );
}

// For legacy usage, keep the default export as the inline Notes editor
function Notes(props) {
  // ...existing code (same as before, or just render nothing)
  return null;
}

export default Notes;
