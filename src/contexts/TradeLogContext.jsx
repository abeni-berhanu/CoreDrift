import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { useAccount } from "./AccountContext";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";

const TradeLogContext = createContext();

export function TradeLogProvider({ children }) {
  const { user } = useAuth();
  const { selectedAccountIds } = useAccount();
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTrades([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribes = [];

    const fetchTrades = async () => {
      try {
        // First, clear trades from unselected accounts
        setTrades((prevTrades) =>
          prevTrades.filter(
            (trade) =>
              selectedAccountIds.length === 0 ||
              selectedAccountIds.includes(trade.accountId)
          )
        );

        const accountsRef = collection(db, `users/${user.uid}/accounts`);
        const accountsSnap = await getDocs(accountsRef);

        for (const accDoc of accountsSnap.docs) {
          const accountId = accDoc.id;
          // If specific accounts are selected, only fetch those
          if (
            selectedAccountIds.length > 0 &&
            !selectedAccountIds.includes(accountId)
          ) {
            continue;
          }

          const tradesRef = collection(
            db,
            `users/${user.uid}/accounts/${accountId}/trades`
          );
          const q = query(tradesRef, orderBy("entryTimestamp", "desc"));

          const unsubscribe = onSnapshot(q, (snapshot) => {
            const accountTrades = snapshot.docs.map((doc) => ({
              id: doc.id,
              accountId,
              ...doc.data(),
            }));

            // Update trades for this account
            setTrades((prevTrades) => {
              const otherAccountTrades = prevTrades.filter(
                (t) => t.accountId !== accountId
              );
              return [...otherAccountTrades, ...accountTrades];
            });
          });

          unsubscribes.push(unsubscribe);
        }
      } catch (error) {
        console.error("Error fetching trades:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrades();

    // Cleanup function to unsubscribe from all listeners
    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [user, selectedAccountIds]);

  return (
    <TradeLogContext.Provider value={{ trades, setTrades, loading }}>
      {children}
    </TradeLogContext.Provider>
  );
}

export function useTradeLog() {
  return useContext(TradeLogContext);
}
