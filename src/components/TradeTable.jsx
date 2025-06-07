import React, { useState, useRef, useEffect } from "react";
import { FaFilter } from "react-icons/fa";

const thStyle = {
  padding: "10px 8px",
  textAlign: "left",
  color: "#888",
  fontWeight: 600,
  fontSize: 14,
  borderBottom: "2px solid #f0f0f0",
  whiteSpace: "nowrap",
  position: "relative",
  background: "#fff",
  borderRight: "none",
  borderLeft: "none",
};
const tdStyle = {
  padding: "10px 8px",
  color: "#333",
  fontSize: 15,
  whiteSpace: "nowrap",
  background: "inherit",
  borderRight: "none",
  borderLeft: "none",
};

function TradeTable({
  trades = [],
  columns = [],
  accounts = [],
  onRowClick,
  selectedRows = [],
  onSelectRow,
  showCheckboxes = false,
  emptyMessage = "No trades found.",
  loading = false,
  defaultVisibleColumns,
}) {
  const containerRef = useRef(null);
  const filterButtonRef = useRef(null);
  // Helper for account name
  const getAccountName = (accountId) =>
    accounts.find((a) => a.id === accountId)?.name || "";

  // Helper for date formatting
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

  // Column filter state
  const allColumnKeys = columns.map((col) => col.key);
  const [showColumnFilter, setShowColumnFilter] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(
    defaultVisibleColumns && defaultVisibleColumns.length > 0
      ? defaultVisibleColumns
      : allColumnKeys
  );

  const handleToggleColumn = (key) => {
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };
  const handleSelectAllColumns = () => setVisibleColumns(allColumnKeys);
  const handleDeselectAllColumns = () => setVisibleColumns([]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        showColumnFilter &&
        containerRef.current &&
        !containerRef.current.contains(event.target) &&
        !filterButtonRef.current?.contains(event.target)
      ) {
        setShowColumnFilter(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showColumnFilter]);

  // Three columns for checkboxes
  const colCount = 3;
  const colChunks = [];
  for (
    let i = 0;
    i < columns.length;
    i += Math.ceil(columns.length / colCount)
  ) {
    colChunks.push(columns.slice(i, i + Math.ceil(columns.length / colCount)));
  }

  const handleSelectAll = (e) => {
    e.stopPropagation();
    if (selectedRows.length === trades.length) {
      // Deselect all
      trades.forEach((trade) => onSelectRow && onSelectRow(trade.id));
    } else {
      // Select all
      trades.forEach((trade) => onSelectRow && onSelectRow(trade.id));
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        overflowX: "auto",
        width: "100%",
        boxSizing: "border-box",
        position: "relative",
        paddingTop: 24, // Add space for the filter icon
      }}
    >
      {/* Filter Icon */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          zIndex: 10,
          padding: 4,
          cursor: "pointer",
        }}
      >
        <FaFilter
          style={{
            fontSize: 14,
            color: showColumnFilter ? "#6C63FF" : "#888",
          }}
          onClick={(e) => {
            e.stopPropagation();
            setShowColumnFilter((v) => !v);
          }}
          title="Filter Columns"
        />
      </div>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          borderSpacing: 0,
          background: "#fff",
          fontSize: 15,
          minWidth: 1200,
        }}
      >
        <thead>
          <tr style={{ background: "#f4f6fa" }}>
            {showCheckboxes && (
              <th style={thStyle}>
                <input
                  type="checkbox"
                  checked={
                    selectedRows.length === trades.length && trades.length > 0
                  }
                  onChange={handleSelectAll}
                  style={{ cursor: "pointer" }}
                />
              </th>
            )}
            {columns
              .filter((col) => visibleColumns.includes(col.key))
              .map((col, idx) => (
                <th key={col.key} style={thStyle}>
                  {col.label}
                </th>
              ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan={visibleColumns.length + (showCheckboxes ? 1 : 0)}
                style={{ textAlign: "center", color: "#888", padding: 32 }}
              >
                Loading trades...
              </td>
            </tr>
          ) : trades.length === 0 ? (
            <tr>
              <td
                colSpan={visibleColumns.length + (showCheckboxes ? 1 : 0)}
                style={{ textAlign: "center", color: "#888", padding: 32 }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            trades.map((trade, idx) => (
              <tr
                key={trade.id || idx}
                style={{
                  borderBottom: "1px solid #f0f0f0",
                  cursor: onRowClick ? "pointer" : undefined,
                  background: selectedRows.includes(trade.id)
                    ? "#e6f7ff"
                    : idx % 2 === 0
                    ? "#fff"
                    : "#f9faff",
                  transition: "all 0.2s ease",
                }}
                onClick={onRowClick ? () => onRowClick(trade) : undefined}
                onMouseEnter={(e) => {
                  if (!selectedRows.includes(trade.id)) {
                    e.currentTarget.style.background = "#f0f4ff";
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow =
                      "0 2px 4px rgba(0,0,0,0.05)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!selectedRows.includes(trade.id)) {
                    e.currentTarget.style.background =
                      idx % 2 === 0 ? "#fff" : "#f9faff";
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }
                }}
              >
                {showCheckboxes && (
                  <td style={tdStyle}>
                    <input
                      type="checkbox"
                      checked={selectedRows.includes(trade.id)}
                      onChange={() => onSelectRow && onSelectRow(trade.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                )}
                {columns
                  .filter((col) => visibleColumns.includes(col.key))
                  .map((col) => (
                    <td key={col.key} style={tdStyle}>
                      {col.render
                        ? col.render(trade, {
                            accounts,
                            formatDateTime24,
                            getAccountName,
                          })
                        : col.key === "accountName"
                        ? getAccountName(trade.accountId)
                        : col.key === "entryTimestamp" ||
                          col.key === "exitTimestamp"
                        ? formatDateTime24(trade[col.key])
                        : trade[col.key] ?? ""}
                    </td>
                  ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Column Filter Dropdown */}
      {showColumnFilter && (
        <div
          style={{
            position: "fixed",
            top: 80,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 2000,
            background: "#fff",
            border: "1px solid #eee",
            borderRadius: 10,
            boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
            padding: 18,
            minWidth: 400,
            maxWidth: 600,
            maxHeight: "80vh",
            overflow: "hidden",
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 10 }}>
            Show Columns
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
              fontSize: 14,
              marginBottom: 12,
            }}
          >
            {columns.map((col) => (
              <label
                key={col.key}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <input
                  type="checkbox"
                  checked={visibleColumns.includes(col.key)}
                  onChange={() => {
                    setVisibleColumns((prev) =>
                      prev.includes(col.key)
                        ? prev.filter((k) => k !== col.key)
                        : [...prev, col.key]
                    );
                  }}
                />
                {col.label}
              </label>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "1px solid #eee",
                background: "#f4f6fa",
                cursor: "pointer",
              }}
              onClick={() => setShowColumnFilter(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TradeTable;
