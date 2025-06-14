import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
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
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
import { dataService } from "../services/DataService";
import DeleteAccountModal from "../components/DeleteAccountModal";

const AccountContext = createContext();

export function AccountProvider({ children }) {
  const { user } = useAuth();
  // accounts will store an array of objects: { id: firestoreDocId, name: accountName }
  const [accounts, setAccounts] = useState([]);
  // selectedAccounts will store an array of Firestore document IDs
  const [selectedAccountIds, setSelectedAccountIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);

  const loadAccounts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const accountsData = await dataService.getAccounts(user.uid);
      setAccounts(accountsData);

      // Initialize currentBalance for existing accounts
      await dataService.initializeAccountBalances(user.uid);

      // Reload accounts to get updated balances
      const updatedAccounts = await dataService.getAccounts(user.uid);
      setAccounts(updatedAccounts);
    } catch (err) {
      console.error("Error loading accounts:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

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

          // Update selectedAccountIds: keep valid selections, remove invalid ones
          setSelectedAccountIds((prevSelectedIds) => {
            const currentAccountIds = fetchedAccountDocs.map((acc) => acc.id);
            return prevSelectedIds.filter((id) =>
              currentAccountIds.includes(id)
            );
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

  const addAccount = async (accountData) => {
    if (!user) throw new Error("User not authenticated");

    try {
      const accountsColRef = collection(db, "users", user.uid, "accounts");
      const accountWithMetadata = {
        ...accountData,
        currentBalance: accountData.initialBalance, // Set current balance equal to initial balance
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isDeleted: false,
      };

      const docRef = await addDoc(accountsColRef, accountWithMetadata);
      return docRef.id;
    } catch (error) {
      console.error("Error adding account:", error);
      throw error;
    }
  };

  const updateAccount = async (accountId, accountData) => {
    if (!user) throw new Error("User not authenticated");

    try {
      const accountRef = doc(db, "users", user.uid, "accounts", accountId);
      const accountWithMetadata = {
        ...accountData,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(accountRef, accountWithMetadata);
    } catch (error) {
      console.error("Error updating account:", error);
      throw error;
    }
  };

  const updateAccountBalance = async (accountId, newBalance) => {
    if (!user) throw new Error("User not authenticated");

    try {
      const accountRef = doc(db, "users", user.uid, "accounts", accountId);
      await updateDoc(accountRef, {
        currentBalance: newBalance,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating account balance:", error);
      throw error;
    }
  };

  const deleteAccount = useCallback(
    async (accountId) => {
      if (!user) {
        console.error("Attempted to delete account without user");
        return;
      }

      try {
        console.log("Starting account deletion preparation:", { accountId });

        // Get account details
        const account = accounts.find((acc) => acc.id === accountId);
        if (!account) {
          console.error("Account not found:", accountId);
          throw new Error("Account not found");
        }
        console.log("Found account:", account);

        // Show confirmation with details
        const confirmationDetails = {
          accountId,
          accountName: account.name,
          initialBalance: Number(account.initialBalance) || 0,
          currentBalance: Number(account.currentBalance) || 0,
        };
        console.log(
          "Setting deletion confirmation with details:",
          confirmationDetails
        );
        setDeleteConfirmation(confirmationDetails);
      } catch (err) {
        console.error("Error preparing account deletion:", {
          error: err,
          code: err.code,
          message: err.message,
          stack: err.stack,
        });
        setError(err.message);
      }
    },
    [user, accounts]
  );

  const confirmDeleteAccount = useCallback(async () => {
    console.log("confirmDeleteAccount called with:", {
      hasUser: !!user,
      hasConfirmation: !!deleteConfirmation,
      confirmationDetails: deleteConfirmation,
    });

    if (!user || !deleteConfirmation) {
      console.error("Cannot delete account:", {
        hasUser: !!user,
        hasConfirmation: !!deleteConfirmation,
      });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      console.log(
        "Starting account deletion confirmation:",
        deleteConfirmation
      );

      // Delete the account (trades will be automatically deleted)
      console.log("Calling dataService.deleteAccount with:", {
        userId: user.uid,
        accountId: deleteConfirmation.accountId,
      });
      await dataService.deleteAccount(user.uid, deleteConfirmation.accountId);
      console.log("Account deleted successfully");

      // Update local state
      console.log("Updating local state after successful deletion");
      setAccounts((prev) => {
        const newAccounts = prev.filter(
          (acc) => acc.id !== deleteConfirmation.accountId
        );
        console.log("Updated accounts:", newAccounts);
        return newAccounts;
      });
      setSelectedAccountIds((prev) => {
        const newSelectedIds = prev.filter(
          (id) => id !== deleteConfirmation.accountId
        );
        console.log("Updated selected account IDs:", newSelectedIds);
        return newSelectedIds;
      });

      console.log("Account deletion completed successfully");
    } catch (err) {
      console.error("Error deleting account:", {
        error: err,
        code: err.code,
        message: err.message,
        stack: err.stack,
      });
      setError(err.message);
    } finally {
      setLoading(false);
      setDeleteConfirmation(null);
    }
  }, [user, deleteConfirmation]);

  const cancelDeleteAccount = useCallback(() => {
    console.log("Cancelling account deletion");
    setDeleteConfirmation(null);
  }, []);

  const toggleAccountSelection = (accountId) => {
    setSelectedAccountIds((prevSelectedIds) =>
      prevSelectedIds.includes(accountId)
        ? prevSelectedIds.filter((id) => id !== accountId)
        : [...prevSelectedIds, accountId]
    );
  };

  const value = {
    accounts,
    selectedAccountIds,
    setSelectedAccountIds,
    loading,
    error,
    deleteAccount,
    confirmDeleteAccount,
    cancelDeleteAccount,
    deleteConfirmation,
    addAccount,
    updateAccount,
    updateAccountBalance,
    toggleAccountSelection,
    selectedAccounts: accounts.filter((acc) =>
      selectedAccountIds.includes(acc.id)
    ),
    setAccounts,
  };

  return (
    <AccountContext.Provider value={value}>
      {children}
      <DeleteAccountModal />
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error("useAccount must be used within an AccountProvider");
  }
  return context;
}
