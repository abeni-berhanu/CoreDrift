import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";

const SetupsContext = createContext();

export function useSetups() {
  return useContext(SetupsContext);
}

export function SetupsProvider({ children }) {
  const { user } = useAuth();
  const [setups, setSetups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSetups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const setupsRef = collection(db, `users/${user.uid}/setups`);
    const q = query(setupsRef, orderBy("createdAt", "desc"));

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const setupsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setSetups(setupsData);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching setups:", error);
        setSetups([]);
        setLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [user]);

  const value = {
    setups,
    loading,
  };

  return (
    <SetupsContext.Provider value={value}>{children}</SetupsContext.Provider>
  );
}
