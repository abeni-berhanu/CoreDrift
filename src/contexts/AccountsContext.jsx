import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";

const AccountsContext = createContext();

export function useAccounts() {
  return useContext(AccountsContext);
}

export function AccountsProvider({ children }) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState([]); // Empty array means all accounts
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ... existing code ...
}
