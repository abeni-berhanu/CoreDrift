import React, { createContext, useContext, useState, useEffect } from "react";
import {
  getFirestore,
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase"; // Corrected path
import { useAuth } from "./AuthContext";

const AccountContext = createContext();

export function AccountProvider({ children }) {
  const { user } = useAuth();
  // accounts will store an array of objects: { id: firestoreDocId, name: accountName }
  const [accounts, setAccounts] = useState([]);
  // selectedAccounts will store an array of Firestore document IDs
  const [selectedAccountIds, setSelectedAccountIds] = useState([]);

  useEffect(() => {
    let unsubscribe = () => {};

    if (user && user.uid) {
      const accountsColRef = collection(db, "users", user.uid, "accounts");
      unsubscribe = onSnapshot(
        accountsColRef,
        (snapshot) => {
          const fetchedAccountDocs = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
          // Sort by name for display consistency
          fetchedAccountDocs.sort((a, b) => a.name.localeCompare(b.name));
          setAccounts(fetchedAccountDocs);

          // Update selectedAccountIds: keep valid selections, default to first if none valid
          setSelectedAccountIds((prevSelectedIds) => {
            const currentAccountIds = fetchedAccountDocs.map((acc) => acc.id);
            let updatedSelectedIds = prevSelectedIds.filter((id) =>
              currentAccountIds.includes(id)
            );

            if (
              updatedSelectedIds.length === 0 &&
              fetchedAccountDocs.length > 0
            ) {
              updatedSelectedIds = [fetchedAccountDocs[0].id]; // Select the ID of the first account
            }
            return updatedSelectedIds;
          });
        },
        (error) => {
          console.error("Error fetching accounts from Firestore:", error);
          setAccounts([]);
          setSelectedAccountIds([]);
        }
      );
    } else {
      setAccounts([]);
      setSelectedAccountIds([]);
    }

    return () => unsubscribe();
  }, [user]);

  const addAccount = async (name) => {
    const trimmedName = name.trim();
    if (user && user.uid && trimmedName) {
      // Check if account name already exists (case-insensitive)
      const nameExists = accounts.some(
        (acc) => acc.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (nameExists) {
        console.warn(`Account with name \"${trimmedName}\" already exists.`);
        // Consider providing user feedback here (e.g., toast notification)
        return;
      }
      const accountsColRef = collection(db, "users", user.uid, "accounts");
      try {
        // Create account with default values
        const accountData = {
          name: trimmedName,
          initialBalance: 100000, // Default initial balance
          accountType: "Demo", // Default account type
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await addDoc(accountsColRef, accountData);
      } catch (error) {
        console.error("Error adding account to Firestore:", error);
      }
    }
  };

  // removeAccount now expects the account's Firestore document ID
  const removeAccount = async (accountIdToRemove) => {
    if (user && user.uid && accountIdToRemove) {
      try {
        await deleteDoc(
          doc(db, "users", user.uid, "accounts", accountIdToRemove)
        );
        // onSnapshot will update the 'accounts' list.
        // setSelectedAccountIds will also be updated by the effect if the removed account was selected.
      } catch (error) {
        console.error("Error removing account from Firestore:", error);
      }
    }
  };

  // toggleAccount now expects the account's Firestore document ID
  const toggleAccountSelection = (accountId) => {
    setSelectedAccountIds((prevSelectedIds) =>
      prevSelectedIds.includes(accountId)
        ? prevSelectedIds.filter((id) => id !== accountId)
        : [...prevSelectedIds, accountId]
    );
  };

  return (
    <AccountContext.Provider
      value={{
        accounts, // Now an array of {id, name} objects
        selectedAccountIds, // Array of Firestore document IDs
        setSelectedAccountIds, // Direct setter if needed
        addAccount, // Expects name
        removeAccount, // Expects accountId
        toggleAccountSelection, // Expects accountId
        // Helper to get selected account objects if needed elsewhere
        selectedAccounts: accounts.filter((acc) =>
          selectedAccountIds.includes(acc.id)
        ),
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  return useContext(AccountContext);
}
