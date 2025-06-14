import React, { useState, useRef, useEffect } from "react";
import {
  FaFilter,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaUndo,
  FaPlus,
  FaFileExport,
  FaColumns,
} from "react-icons/fa";

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
  onAddTrade,
  onExport,
  onColumnVisibility,
}) {
  const containerRef = useRef(null);
  const filterButtonRef = useRef(null);
  const [sortConfig, setSortConfig] = useState({
    key: "entryTimestamp",
    direction: "desc",
  });

  // Add filter states
  const [filters, setFilters] = useState({
    winLoss: "all",
    tradingHour: "all",
    symbol: "all",
    direction: "all",
    setup: "all",
  });

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

  // Sort handler
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // Get sort icon
  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <FaSort style={{ opacity: 0.3 }} />;
    return sortConfig.direction === "asc" ? <FaSortUp /> : <FaSortDown />;
  };

  // Sort trades
  const sortedTrades = React.useMemo(() => {
    if (!sortConfig.key) return trades;

    return [...trades].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Handle special cases
      if (sortConfig.key === "accountName") {
        aValue = getAccountName(a.accountId);
        bValue = getAccountName(b.accountId);
      } else if (
        sortConfig.key === "entryTimestamp" ||
        sortConfig.key === "exitTimestamp"
      ) {
        aValue = a[sortConfig.key]?.toDate?.() || a[sortConfig.key];
        bValue = b[sortConfig.key]?.toDate?.() || b[sortConfig.key];
      }

      // Handle null/undefined values
      if (aValue == null) return sortConfig.direction === "asc" ? -1 : 1;
      if (bValue == null) return sortConfig.direction === "asc" ? 1 : -1;

      // Compare values
      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [trades, sortConfig, getAccountName]);

  // Filter trades
  const filteredTrades = React.useMemo(() => {
    return sortedTrades.filter((trade) => {
      // Win/Loss filter
      if (filters.winLoss !== "all") {
        const isWin = trade.netPnL > 0;
        if (filters.winLoss === "win" && !isWin) return false;
        if (filters.winLoss === "loss" && isWin) return false;
      }

      // Trading hour filter
      if (filters.tradingHour !== "all") {
        const entryHour = new Date(trade.entryTimestamp).getHours();
        const [startHour, endHour] = filters.tradingHour.split("-").map(Number);
        if (entryHour < startHour || entryHour >= endHour) return false;
      }

      // Symbol filter
      if (filters.symbol !== "all" && trade.symbol !== filters.symbol)
        return false;

      // Direction filter
      if (filters.direction !== "all" && trade.direction !== filters.direction)
        return false;

      // Setup filter
      if (filters.setup !== "all" && trade.setups !== filters.setup)
        return false;

      return true;
    });
  }, [sortedTrades, filters]);

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

  // Reset sort handler
  const handleResetSort = (e) => {
    e.stopPropagation();
    setSortConfig({ key: "entryTimestamp", direction: "desc" });
  };

  // Add handler functions
  const handleAddTrade = () => {
    // This should be handled by the parent component
    if (onAddTrade) {
      onAddTrade();
    }
  };

  const handleExport = () => {
    // This should be handled by the parent component
    if (onExport) {
      onExport();
    }
  };

  const handleColumnVisibility = () => {
    // This should be handled by the parent component
    if (onColumnVisibility) {
      onColumnVisibility();
    }
  };

  return (
    <div style={{ width: "100%" }}>
      <div
        ref={containerRef}
        style={{
          position: "relative",
          width: "100%",
          overflowX: "auto",
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          paddingTop: 32,
        }}
      >
        {/* Filter Icon */}
        <div
          ref={filterButtonRef}
          style={{
            position: "absolute",
            left: 8,
            top: 8,
            zIndex: 10,
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
            title="Filter Trades"
          />
        </div>

        {/* Filter Dropdown */}
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
              Filter Trades
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 16,
                fontSize: 14,
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 12, color: "#666" }}>Result</label>
                <select
                  value={filters.winLoss}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, winLoss: e.target.value }))
                  }
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #eee",
                    borderRadius: 8,
                    fontSize: 14,
                    width: "100%",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  <option value="all">All Trades</option>
                  <option value="win">Winning Trades</option>
                  <option value="loss">Losing Trades</option>
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 12, color: "#666" }}>
                  Trading Hour
                </label>
                <select
                  value={filters.tradingHour}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      tradingHour: e.target.value,
                    }))
                  }
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #eee",
                    borderRadius: 8,
                    fontSize: 14,
                    width: "100%",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  <option value="all">All Hours</option>
                  <option value="0-4">00:00 - 04:00</option>
                  <option value="4-8">04:00 - 08:00</option>
                  <option value="8-12">08:00 - 12:00</option>
                  <option value="12-16">12:00 - 16:00</option>
                  <option value="16-20">16:00 - 20:00</option>
                  <option value="20-24">20:00 - 24:00</option>
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 12, color: "#666" }}>Symbol</label>
                <select
                  value={filters.symbol}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, symbol: e.target.value }))
                  }
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #eee",
                    borderRadius: 8,
                    fontSize: 14,
                    width: "100%",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  <option value="all">All Symbols</option>
                  {Array.from(new Set(trades.map((t) => t.symbol))).map(
                    (symbol) => (
                      <option key={symbol} value={symbol}>
                        {symbol}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 12, color: "#666" }}>Direction</label>
                <select
                  value={filters.direction}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      direction: e.target.value,
                    }))
                  }
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #eee",
                    borderRadius: 8,
                    fontSize: 14,
                    width: "100%",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  <option value="all">All Directions</option>
                  <option value="Buy">Buy</option>
                  <option value="Sell">Sell</option>
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 12, color: "#666" }}>Setup</label>
                <select
                  value={filters.setup}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, setup: e.target.value }))
                  }
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #eee",
                    borderRadius: 8,
                    fontSize: 14,
                    width: "100%",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  <option value="all">All Setups</option>
                  {Array.from(new Set(trades.map((t) => t.setups)))
                    .filter(Boolean)
                    .map((setup) => (
                      <option key={setup} value={setup}>
                        {setup}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div
              style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}
            >
              <button
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: "1px solid #eee",
                  background: "#f4f6fa",
                  cursor: "pointer",
                }}
                onClick={() => {
                  setFilters({
                    winLoss: "all",
                    tradingHour: "all",
                    symbol: "all",
                    direction: "all",
                    setup: "all",
                  });
                }}
              >
                Reset Filters
              </button>
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

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 14,
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
                .map((col) => (
                  <th
                    key={col.key}
                    style={{
                      ...thStyle,
                      cursor: "pointer",
                      userSelect: "none",
                      position: "relative",
                    }}
                    onClick={() => handleSort(col.key)}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      {col.label}
                      {getSortIcon(col.key)}
                      {col.key === "entryTimestamp" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResetSort(e);
                          }}
                          style={{
                            position: "absolute",
                            right: 8,
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "none",
                            border: "none",
                            padding: 4,
                            cursor: "pointer",
                            color: "#888",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 4,
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background =
                              "rgba(0,0,0,0.05)";
                            e.currentTarget.style.color = "#666";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "none";
                            e.currentTarget.style.color = "#888";
                          }}
                          title="Reset to default sort"
                        >
                          <FaUndo style={{ fontSize: 12 }} />
                        </button>
                      )}
                    </div>
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
            ) : filteredTrades.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length + (showCheckboxes ? 1 : 0)}
                  style={{ textAlign: "center", color: "#888", padding: 32 }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filteredTrades.map((trade, idx) => (
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
            <div
              style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}
            >
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
    </div>
  );
}

export default TradeTable;
