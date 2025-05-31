import React from "react";
import { NavLink } from "react-router-dom";
import {
  FaChartLine,
  FaFileAlt,
  FaBook,
  FaClipboardList,
  FaBars,
  FaPlus,
} from "react-icons/fa";
import { useAddTradeModal } from "../contexts/AddTradeModalContext";

function Sidebar({ collapsed, setCollapsed }) {
  const { openAddTradeModal } = useAddTradeModal();
  const menuItems = [
    { path: "/dashboard", icon: <FaChartLine />, label: "Dashboard" },
    { path: "/reports", icon: <FaFileAlt />, label: "Reports" },
    { path: "/notebook", icon: <FaBook />, label: "Notebook" },
    { path: "/setups", icon: <FaClipboardList />, label: "Setups" },
    { path: "/tradelog", icon: <FaClipboardList />, label: "Trade Log" },
  ];

  return (
    <div
      style={{
        width: collapsed ? 80 : 240,
        background: "white",
        height: "100vh",
        position: "fixed",
        left: 0,
        top: 0,
        boxShadow: "2px 0 8px rgba(0,0,0,0.06)",
        transition: "width 0.2s",
        zIndex: 1000,
      }}
    >
      {/* Logo and Collapse Button */}
      <div
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        {!collapsed && (
          <div
            style={{
              fontWeight: "bold",
              fontSize: 20,
              letterSpacing: 1,
              background: "linear-gradient(90deg, #6C63FF 30%, #00C9A7 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontFamily: "Segoe UI, Arial, sans-serif",
            }}
          >
            CoreDrift
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#666",
            padding: 8,
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <FaBars />
        </button>
      </div>

      {/* Add Trade Button */}
      <div
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid #f0f0f0",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <button
          style={{
            width: collapsed ? "auto" : "100%",
            padding: collapsed ? "10px" : "10px 15px",
            background: "#6C63FF",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "15px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: collapsed ? "0px" : "8px",
          }}
          onClick={openAddTradeModal}
        >
          <FaPlus style={{ fontSize: 18 }} />
          {!collapsed && <span>Add Trade</span>}
        </button>
      </div>

      {/* Navigation Menu */}
      <nav style={{ padding: "16px 0" }}>
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              padding: "12px 24px",
              color: isActive ? "#6C63FF" : "#666",
              textDecoration: "none",
              fontSize: 15,
              transition: "background 0.2s",
              background: isActive ? "#f4f6fa" : "transparent",
            })}
          >
            <span style={{ fontSize: 18, marginRight: collapsed ? 0 : 12 }}>
              {item.icon}
            </span>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default Sidebar;
