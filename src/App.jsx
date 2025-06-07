import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Reports from "./pages/Reports";
import TradeLog from "./pages/TradeLog";
import Notebook from "./pages/Notebook";
import AppLayout from "./components/AppLayout";
import Setups from "./pages/Setups";
import Settings from "./pages/Settings";
import { SetupsProvider } from "./contexts/SetupsContext";
import { AccountProvider, useAccount } from "./contexts/AccountContext";
import { TradeLogProvider } from "./contexts/TradeLogContext";
import { AddTradeModalProvider } from "./contexts/AddTradeModalContext";
import RecycleBin from "./components/RecycleBin";
import { initializeSymbols } from "./services/SymbolService";
import "./index.css";
import Topbar from "./components/Topbar";
import DeleteAccountModal from "./components/DeleteAccountModal";
import { ThemeProvider } from "./contexts/ThemeContext";
import { DateRangeProvider } from "./contexts/DateRangeContext";

// Separate component for initialization
function AppContent() {
  const { user } = useAuth();
  const { selectedAccountIds } = useAccount();

  // Initialize symbols collection
  React.useEffect(() => {
    const initSymbols = async () => {
      try {
        await initializeSymbols();
      } catch (error) {
        console.error("Error initializing symbols:", error);
      }
    };
    initSymbols();
  }, []);

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/" element={<Navigate to="/dashboard" />} />

      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tradelog"
        element={
          <ProtectedRoute>
            <AppLayout>
              <TradeLog />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Reports />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/notebook"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Notebook />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/setups"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Setups />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Settings />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/recycle-bin"
        element={
          <ProtectedRoute>
            <AppLayout>
              <RecycleBin />
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ThemeProvider>
          <AccountProvider>
            <DateRangeProvider>
              <SetupsProvider>
                <TradeLogProvider>
                  <AddTradeModalProvider>
                    <div className="app">
                      <Topbar />
                      <AppContent />
                      <DeleteAccountModal />
                    </div>
                  </AddTradeModalProvider>
                </TradeLogProvider>
              </SetupsProvider>
            </DateRangeProvider>
          </AccountProvider>
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
