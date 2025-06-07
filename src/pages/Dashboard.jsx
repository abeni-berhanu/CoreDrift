import React, { useState, useEffect, useCallback } from "react";
import {
  FaChevronLeft,
  FaChevronRight,
  FaDollarSign,
  FaTrophy,
  FaChartLine,
  FaCalendarCheck,
  FaBalanceScale,
  FaExchangeAlt,
} from "react-icons/fa";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  Timestamp,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useAccount } from "../contexts/AccountContext";
import { useDateRange } from "../contexts/DateRangeContext";
import { useSetups } from "../contexts/SetupsContext";
import { useTradeLog } from "../contexts/TradeLogContext";
import TradeTable from "../components/TradeTable";
import TradeModal from "../components/TradeModal";
import TestDataInitializer from "../components/TestDataInitializer";

// --- Summary Cards Component ---
function SummaryCards({ summary }) {
  const cards = [
    {
      label: "Net P&L",
      value: `$${parseFloat(summary.netPL || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      icon: <FaDollarSign />,
      iconBg: "#6C63FF",
    },
    {
      label: "Trade Win %",
      value: `${summary.tradeWin}%`,
      icon: <FaTrophy />,
      iconBg: "#00C9A7",
    },
    {
      label: "Profit Factor",
      value: summary.profitFactor,
      icon: <FaChartLine />,
      iconBg: "#1890ff",
    },
    {
      label: "Day Win %",
      value: `${summary.dayWin}%`,
      icon: <FaCalendarCheck />,
      iconBg: "#52c41a",
    },
    {
      label: "Avg win/loss trade",
      value: summary.avgWinLoss,
      icon: <FaBalanceScale />,
      iconBg: "#faad14",
    },
    {
      label: "Number of Trades",
      value: summary.numTrades,
      icon: <FaExchangeAlt />,
      iconBg: "#ff4d4f",
    },
  ];
  return (
    <div
      style={{
        display: "flex",
        gap: 24,
        marginBottom: 24,
        flexWrap: "wrap",
      }}
    >
      {cards.map((c) => (
        <div
          key={c.label}
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 24,
            minWidth: 160,
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: c.iconBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            {c.icon}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 2,
            }}
          >
            <div style={{ color: "#888", fontWeight: 500, fontSize: 13 }}>
              {c.label}
            </div>
            <div style={{ color: "#1890ff", fontWeight: 500, fontSize: 17 }}>
              {c.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Calendar with Weekly Summary ---
function CalendarWithWeeklySummary({
  calendarData, // This is an object: {'YYYY-MM-DD': { pnl: X, tradeCount: Y }}
  realToday,
  selectedMonth,
  selectedYear,
  setSelectedMonth, // Add this back for dropdowns
  setSelectedYear, // Add this back for dropdowns
  handleToday,
  handlePrevMonth,
  handleNextMonth,
  onDayClick, // Expects (dayNumber) => void
}) {
  function isSameDay(date1, date2) {
    return (
      date1 &&
      date2 &&
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  const daysInMonth =
    selectedYear !== null && selectedMonth !== null
      ? new Date(selectedYear, selectedMonth + 1, 0).getDate()
      : 0;
  const firstDay =
    selectedYear !== null && selectedMonth !== null
      ? new Date(selectedYear, selectedMonth, 1).getDay()
      : 0;
  const daysArray = [];
  for (let i = 0; i < firstDay; i++) daysArray.push(null);
  for (let i = 1; i <= daysInMonth; i++) daysArray.push(i);

  function getCalendarWeeks(daysArr) {
    const weeks = [];
    let week = [];
    daysArr.forEach((day) => {
      week.push(day);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    });
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
    return weeks;
  }
  const weeks = getCalendarWeeks(daysArray);
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const currentDisplayYear = realToday
    ? realToday.getFullYear()
    : new Date().getFullYear();
  const yearOptions = [];
  for (let y = currentDisplayYear - 5; y <= currentDisplayYear + 5; y++) {
    yearOptions.push(y);
  }

  const gridContainerStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(7, 11%) 12%",
    gap: "1%",
    width: "100%",
  };

  return (
    <div
      style={{
        flex: 2.5,
        background: "#fff",
        borderRadius: 12,
        padding: "20px",
        minWidth: 420,
        minHeight: 600,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
          padding: "0 8px",
        }}
      >
        <button
          onClick={handlePrevMonth}
          title="Previous Month"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#6C63FF",
            fontSize: 20,
            padding: 4,
          }}
        >
          <FaChevronLeft />
        </button>
        <button
          onClick={handleToday}
          title="Today"
          style={{
            background: "#f4f6fa",
            border: "1px solid #d9d9d9",
            borderRadius: 6,
            padding: "6px 12px",
            fontWeight: 600,
            color: "#6C63FF",
            cursor: "pointer",
            fontSize: 15,
          }}
        >
          Today
        </button>
        <button
          onClick={handleNextMonth}
          title="Next Month"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#6C63FF",
            fontSize: 20,
            padding: 4,
          }}
        >
          <FaChevronRight />
        </button>
        <select
          value={selectedMonth ?? ""}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          style={{
            padding: "7px 10px",
            borderRadius: 6,
            border: "1px solid #ddd",
            fontWeight: 500,
            marginLeft: 8,
            cursor: "pointer",
          }}
        >
          {monthNames.map((name, idx) => (
            <option key={name} value={idx}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={selectedYear ?? ""}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          style={{
            padding: "7px 10px",
            borderRadius: 6,
            border: "1px solid #ddd",
            fontWeight: 500,
            marginLeft: 4,
            cursor: "pointer",
          }}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div style={gridContainerStyle}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              color: "#888",
              fontWeight: 600,
              borderBottom: "2px solidrgba(224, 224, 224, 0.73)",
              paddingBottom: "4px",
            }}
          >
            {d}
          </div>
        ))}
        <div
          style={{
            textAlign: "center",
            color: "#888",
            fontWeight: 600,
            borderBottom: "2px solid #e0e0e0",
            paddingBottom: "4px",
            borderLeft: "1.5px solid #e0e0e0",
            background: "#f8f9fa",
          }}
        >
          Weekly
          <br />
          Summary
        </div>
      </div>

      {weeks.map((week, weekIdx) => {
        let weekPnl = 0;
        let weekTrades = 0;
        week.forEach((dayNumber) => {
          if (dayNumber) {
            const dateKey = `${selectedYear}-${(selectedMonth + 1)
              .toString()
              .padStart(2, "0")}-${dayNumber.toString().padStart(2, "0")}`;
            const dayData = calendarData[dateKey];
            if (dayData) {
              weekPnl += dayData.pnl || 0;
              weekTrades += dayData.tradeCount || 0;
            }
          }
        });

        let weeklySummaryBg = "#f3f5f8"; // Default to empty/neutral color
        if (weekPnl > 0) weeklySummaryBg = "#c4e7dc";
        else if (weekPnl < 0) weeklySummaryBg = "#f0b3b1";

        return (
          <div
            key={weekIdx}
            style={{
              ...gridContainerStyle,
              marginTop: weekIdx === 0 ? "4px" : "0",
              marginBottom: "4px",
            }}
          >
            {week.map((dayNumber, dayIdx) => {
              const dateKey = dayNumber
                ? `${selectedYear}-${(selectedMonth + 1)
                    .toString()
                    .padStart(2, "0")}-${dayNumber.toString().padStart(2, "0")}`
                : null;
              const dayDataForCell = dateKey ? calendarData[dateKey] : null;
              const isToday = dayNumber
                ? isSameDay(
                    new Date(selectedYear, selectedMonth, dayNumber),
                    realToday
                  )
                : false;

              let cellBg = "#f3f5f8";

              if (dayDataForCell) {
                if (dayDataForCell.pnl > 0) cellBg = "#c4e7dc";
                else if (dayDataForCell.pnl < 0) cellBg = "#f0b3b1";
              } else if (!isToday) {
                cellBg = "#f3f5f8";
              }

              return (
                <div
                  key={dayIdx}
                  style={{
                    aspectRatio: "1.5",
                    width: "100%",
                    background: dayNumber ? cellBg : "transparent",
                    border: dayNumber ? "1px solid rgba(0,0,0,0.2)" : "none",
                    borderRadius: 6,
                    padding: "3px",
                    position: "relative",
                    color: "#00000060",
                    fontSize: "11px",
                    transition: "background 0.2s",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    alignItems: "stretch",
                    cursor: dayNumber ? "pointer" : "default",
                  }}
                  onClick={() => dayNumber && onDayClick(dayNumber)}
                  onMouseEnter={(e) => {
                    if (dayNumber)
                      e.currentTarget.style.borderColor = "#6C63FF";
                  }}
                  onMouseLeave={(e) => {
                    if (dayNumber)
                      e.currentTarget.style.borderColor = "rgba(0,0,0,0.2)";
                  }}
                >
                  {dayNumber && (
                    <>
                      <div
                        style={{
                          textAlign: "right",
                          fontWeight: isToday ? 700 : 400,
                          color: "#000",
                        }}
                      >
                        {dayNumber}
                      </div>
                      {dayDataForCell && (
                        <div
                          style={{
                            textAlign: "center",
                            marginTop: "auto",
                            lineHeight: "1.4",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "10px",
                              fontWeight: 500,
                              color: "#000",
                            }}
                          >
                            {Number(dayDataForCell?.pnl || 0) > 0
                              ? `+$${Number(dayDataForCell.pnl || 0).toFixed(
                                  0
                                )}`
                              : Number(dayDataForCell?.pnl || 0) < 0
                              ? `-$${Math.abs(
                                  Number(dayDataForCell.pnl || 0)
                                ).toFixed(0)}`
                              : "$0"}
                          </div>
                          <div style={{ fontSize: "9px", color: "#000" }}>
                            {dayDataForCell.tradeCount} trade
                            {dayDataForCell.tradeCount !== 1 ? "s" : ""}
                          </div>
                        </div>
                      )}
                      {!dayDataForCell && dayNumber && (
                        <div
                          style={{
                            textAlign: "center",
                            marginTop: "auto",
                            lineHeight: "1.2",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#000",
                              fontStyle: "italic",
                            }}
                          >
                            -
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
            <div
              style={{
                background: weeklySummaryBg,
                borderRadius: 6,
                border: "1px solid rgba(0,0,0,0.2)",
                marginLeft: 2,
                width: "100%",
                aspectRatio: "1.5",
                padding: "3px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#000",
                fontWeight: 500,
                lineHeight: "1.3",
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "10px",
                  color: "#000",
                }}
              >
                {Number(weekPnl) > 0
                  ? `+$${Number(weekPnl).toFixed(0)}`
                  : Number(weekPnl) < 0
                  ? `-$${Math.abs(Number(weekPnl)).toFixed(0)}`
                  : "$0"}
              </div>
              <div style={{ color: "#000", fontSize: "9px" }}>
                {weekTrades} trade{weekTrades !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Open Trades Placeholder ---
function OpenTradesPlaceholder() {
  return (
    <div
      style={{
        flex: 1,
        background: "#fff",
        borderRadius: 12,
        padding: 24,
        minHeight: 600,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "#bbb",
        fontWeight: 600,
        fontSize: 18,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        minWidth: 300,
      }}
    >
      Open Trades
      <div style={{ marginTop: 16, color: "#eee", fontSize: 32 }}>
        [List/Table]
      </div>
    </div>
  );
}

// --- Day Detail Modal Component ---
function DayDetailModal({
  open,
  onClose,
  dayData,
  accounts = [],
  setups = [],
  setupColors,
}) {
  const stopPropagation = (e) => e.stopPropagation();

  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailTrade, setDetailTrade] = React.useState(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editForm, setEditForm] = React.useState(null);
  const [editSubmitting, setEditSubmitting] = React.useState(false);

  if (!open || !dayData) return null;

  const tradesToShow = dayData.trades || [];

  // Full columns array (like Trade Log)
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
  // Only show these by default
  const defaultVisibleColumns = [
    "entryTimestamp",
    "symbol",
    "direction",
    "netPnL",
    "accountName",
  ];

  const handleRowClick = (trade) => {
    setDetailTrade(trade);
    setDetailOpen(true);
  };

  // Open edit modal with selected trade
  const handleEditTrade = (trade) => {
    setDetailOpen(false);
    setEditForm(trade);
    setEditOpen(true);
  };

  // Save edit (placeholder: just closes modal)
  const handleEditSave = () => {
    setEditOpen(false);
    // TODO: Add Firestore update logic here if needed
  };

  // Cancel edit
  const handleEditCancel = () => {
    setEditOpen(false);
    setEditForm(null);
  };

  // Symbol/direction options (can be customized)
  const symbolOptions = [
    "EURUSD",
    "XAUUSD",
    "GBPUSD",
    "USDJPY",
    "AUDUSD",
    "USDCAD",
    "USDCHF",
    "NZDUSD",
  ];
  const directionOptions = ["Buy", "Sell"];

  return (
    <div
      onClick={onClose}
      style={{
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
      }}
    >
      <div
        onClick={stopPropagation}
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 32,
          minWidth: 420,
          minHeight: 200,
          maxWidth: 600,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 18 }}>{dayData.date}</div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 22,
              cursor: "pointer",
              color: "#888",
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div style={{ color: "#444", fontSize: 15, marginBottom: 18 }}>
          {dayData.summary}
        </div>
        {tradesToShow.length > 0 ? (
          <TradeTable
            trades={tradesToShow}
            columns={allTradeColumns}
            accounts={accounts}
            showCheckboxes={false}
            loading={false}
            defaultVisibleColumns={defaultVisibleColumns}
            onRowClick={handleRowClick}
          />
        ) : (
          <div
            style={{ textAlign: "center", color: "#888", padding: "20px 0" }}
          >
            No trades recorded for this day.
          </div>
        )}
        <TradeModal
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          trade={detailTrade}
          columns={allTradeColumns}
          accounts={accounts}
          setups={setups}
          onEdit={handleEditTrade}
          setupColors={setupColors}
        />
        {/* Edit Modal */}
        {editOpen && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0,0,0,0.18)",
              zIndex: 1300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={handleEditCancel}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                padding: 32,
                minWidth: 420,
                maxWidth: 700,
                boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                position: "relative",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <TradeModal
                open={editOpen}
                onClose={handleEditCancel}
                trade={editForm}
                columns={allTradeColumns}
                accounts={accounts}
                setups={setups}
                editMode={true}
                onSave={handleEditSave}
                onCancel={handleEditCancel}
                setupColors={setupColors}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const modalThStyle = {
  padding: "8px 10px",
  textAlign: "left",
  color: "#666",
  fontWeight: 600,
  fontSize: 13,
  borderBottom: "2px solid #e9ecef",
};

const modalTdStyle = {
  padding: "10px",
  color: "#333",
  fontSize: 14,
};

// --- Main Dashboard Component ---
export default function Dashboard() {
  const { user } = useAuth();
  const { accounts, selectedAccountIds } = useAccount();
  const { startDate, endDate } = useDateRange();
  const { setups = [] } = useSetups();
  const { trades: globalTrades, loading: loadingTrades } = useTradeLog();

  const [allFetchedTrades, setAllFetchedTrades] = useState([]);
  const [dailyTradeData, setDailyTradeData] = useState({});
  const [dashboardSummaryData, setDashboardSummaryData] = useState({
    netPL: 0,
    tradeWin: 0,
    profitFactor: "N/A",
    dayWin: 0,
    avgWinLoss: "N/A",
    numTrades: 0,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalDayData, setModalDayData] = useState(null);

  const [realToday, setRealToday] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const [calendarDisplayData, setCalendarDisplayData] = useState({});

  // --- Add color state ---
  const [colors, setColors] = useState([]);
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

  // --- Build setupColors map ---
  const setupColors = Object.fromEntries(
    setups.map((s) => {
      const colorObj = colors.find((c) => c.id === s.color);
      return [s.id, colorObj ? colorObj.color : "#eee"];
    })
  );

  useEffect(() => {
    if (!user || !user.uid) {
      setAllFetchedTrades([]);
      setDailyTradeData({});
      setDashboardSummaryData({
        netPL: 0,
        tradeWin: 0,
        profitFactor: "N/A",
        dayWin: 0,
        avgWinLoss: "N/A",
        numTrades: 0,
      });
      setCalendarDisplayData({});
      return;
    }

    // Filter trades based on date range
    let filteredTrades = [...globalTrades];

    if (startDate) {
      filteredTrades = filteredTrades.filter((trade) => {
        const exitDate =
          trade.exitTimestamp?.toDate?.() || new Date(trade.exitTimestamp);
        return exitDate >= new Date(startDate);
      });
    }

    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      filteredTrades = filteredTrades.filter((trade) => {
        const exitDate =
          trade.exitTimestamp?.toDate?.() || new Date(trade.exitTimestamp);
        return exitDate <= endOfDay;
      });
    }

    // Sort trades by exit timestamp
    filteredTrades.sort((a, b) => {
      const timeA = a.exitTimestamp?.toMillis
        ? a.exitTimestamp.toMillis()
        : a.exitTimestamp?.toDate
        ? a.exitTimestamp.toDate().getTime()
        : a.exitTimestamp instanceof Date
        ? a.exitTimestamp.getTime()
        : typeof a.exitTimestamp === "string"
        ? new Date(a.exitTimestamp).getTime()
        : 0;
      const timeB = b.exitTimestamp?.toMillis
        ? b.exitTimestamp.toMillis()
        : b.exitTimestamp?.toDate
        ? b.exitTimestamp.toDate().getTime()
        : b.exitTimestamp instanceof Date
        ? b.exitTimestamp.getTime()
        : typeof b.exitTimestamp === "string"
        ? new Date(b.exitTimestamp).getTime()
        : 0;
      return timeB - timeA;
    });

    setAllFetchedTrades(filteredTrades);
  }, [user, globalTrades, startDate, endDate]);

  useEffect(() => {
    if (!allFetchedTrades.length && !loadingTrades) {
      setDailyTradeData({});
      setDashboardSummaryData({
        netPL: 0,
        tradeWin: 0,
        profitFactor: "N/A",
        dayWin: 0,
        avgWinLoss: "N/A",
        numTrades: 0,
      });
      setCalendarDisplayData({});
      return;
    }
    if (allFetchedTrades.length > 0) {
      const dailyData = {};
      allFetchedTrades.forEach((trade) => {
        if (trade.exitTimestamp) {
          let dateStr;
          if (trade.exitTimestamp.toDate) {
            dateStr = trade.exitTimestamp.toDate().toISOString().split("T")[0];
          } else if (trade.exitTimestamp instanceof Date) {
            dateStr = trade.exitTimestamp.toISOString().split("T")[0];
          } else if (typeof trade.exitTimestamp === "string") {
            dateStr = trade.exitTimestamp.split("T")[0];
          } else {
            return;
          }

          if (!dailyData[dateStr]) {
            dailyData[dateStr] = {
              pnl: 0,
              tradeCount: 0,
              trades: [],
            };
          }

          dailyData[dateStr].pnl += parseFloat(trade.netPnL) || 0;
          dailyData[dateStr].tradeCount += 1;
          dailyData[dateStr].trades.push(trade);
        }
      });

      setDailyTradeData(dailyData);

      // Calculate summary data
      const totalPnL = allFetchedTrades.reduce(
        (sum, trade) => sum + (parseFloat(trade.netPnL) || 0),
        0
      );
      const winningTrades = allFetchedTrades.filter(
        (trade) => (parseFloat(trade.netPnL) || 0) > 0
      );
      const losingTrades = allFetchedTrades.filter(
        (trade) => (parseFloat(trade.netPnL) || 0) < 0
      );
      const totalWins = winningTrades.reduce(
        (sum, trade) => sum + (parseFloat(trade.netPnL) || 0),
        0
      );
      const totalLosses = Math.abs(
        losingTrades.reduce(
          (sum, trade) => sum + (parseFloat(trade.netPnL) || 0),
          0
        )
      );

      // Calculate winning days
      const winningDays = Object.values(dailyData).filter(
        (day) => day.pnl > 0
      ).length;
      const totalDays = Object.keys(dailyData).length;

      setDashboardSummaryData({
        netPL: totalPnL,
        tradeWin:
          allFetchedTrades.length > 0
            ? Math.round((winningTrades.length / allFetchedTrades.length) * 100)
            : 0,
        profitFactor:
          totalLosses > 0 ? (totalWins / totalLosses).toFixed(2) : "N/A",
        dayWin: totalDays > 0 ? Math.round((winningDays / totalDays) * 100) : 0,
        avgWinLoss:
          winningTrades.length > 0 && losingTrades.length > 0
            ? (
                totalWins /
                winningTrades.length /
                (totalLosses / losingTrades.length)
              ).toFixed(2)
            : "N/A",
        numTrades: allFetchedTrades.length,
      });

      // Prepare calendar data
      const calendarData = {};
      Object.entries(dailyData).forEach(([dateStr, data]) => {
        calendarData[dateStr] = {
          pnl: data.pnl,
          tradeCount: data.tradeCount,
        };
      });
      setCalendarDisplayData(calendarData);
    } else if (!loadingTrades && allFetchedTrades.length === 0) {
      setDailyTradeData({});
      setDashboardSummaryData({
        netPL: 0,
        tradeWin: 0,
        profitFactor: "N/A",
        dayWin: 0,
        avgWinLoss: "N/A",
        numTrades: 0,
      });
      setCalendarDisplayData({});
    }
  }, [allFetchedTrades, loadingTrades]);

  const handlePrevMonth = () => {
    setCurrentMonth((prevMonth) => {
      if (prevMonth === 0) {
        setCurrentYear(currentYear - 1);
        return 11;
      }
      return prevMonth - 1;
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth((prevMonth) => {
      if (prevMonth === 11) {
        setCurrentYear(currentYear + 1);
        return 0;
      }
      return prevMonth + 1;
    });
  };

  const handleToday = () => {
    const today = new Date();
    setRealToday(today);
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  const handleDayClick = useCallback(
    (dayNumber) => {
      if (!dayNumber) return;
      // Use UTC to avoid timezone mismatch
      const clickedDate = new Date(
        Date.UTC(currentYear, currentMonth, dayNumber)
      );
      const dateStr = clickedDate.toISOString().split("T")[0];

      const dayDataForModal = dailyTradeData[dateStr] || {
        pnl: 0,
        count: 0,
        trades: [],
      };

      setModalDayData({
        date: clickedDate.toLocaleDateString(undefined, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        summary: `P&L: $${Number(dayDataForModal.pnl || 0).toFixed(
          2
        )}, Trades: ${dayDataForModal.count}`,
        trades: dayDataForModal.trades,
      });
      setModalOpen(true);
    },
    [currentYear, currentMonth, dailyTradeData]
  );

  return (
    <>
      <DayDetailModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        dayData={modalDayData}
        accounts={accounts}
        setups={setups}
        setupColors={setupColors}
      />

      {loadingTrades && (
        <div style={{ textAlign: "center", padding: 20 }}>
          Loading dashboard data...
        </div>
      )}

      {!loadingTrades && (
        <>
          <SummaryCards summary={dashboardSummaryData} />

          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 24,
              marginBottom: 24,
            }}
          >
            <ChartPlaceholder title="Performance Over Time" />
            <ChartPlaceholder title="Win/Loss Ratio by Setup" />
          </div>

          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <OpenTradesPlaceholder />
            <CalendarWithWeeklySummary
              calendarData={calendarDisplayData}
              realToday={realToday}
              selectedMonth={currentMonth}
              selectedYear={currentYear}
              setSelectedMonth={setCurrentMonth}
              setSelectedYear={setCurrentYear}
              handleToday={handleToday}
              handlePrevMonth={handlePrevMonth}
              handleNextMonth={handleNextMonth}
              onDayClick={handleDayClick}
            />
          </div>
        </>
      )}
    </>
  );
}

function ChartPlaceholder({ title }) {
  return (
    <div
      style={{
        flex: 1,
        background: "#fff",
        borderRadius: 12,
        padding: 24,
        minHeight: 220,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "#bbb",
        fontWeight: 600,
        fontSize: 18,
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}
    >
      {title}
      <div style={{ marginTop: 16, color: "#eee", fontSize: 32 }}>[Chart]</div>
    </div>
  );
}
