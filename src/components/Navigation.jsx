import {
  FaChartLine,
  FaExchangeAlt,
  FaChartBar,
  FaTrash,
} from "react-icons/fa";

const menuItems = [
  { label: "Dashboard", icon: <FaChartLine />, path: "/" },
  { label: "Trades", icon: <FaExchangeAlt />, path: "/trades" },
  { label: "Analytics", icon: <FaChartBar />, path: "/analytics" },
  { label: "Recycle Bin", icon: <FaTrash />, path: "/recycle-bin" },
];
