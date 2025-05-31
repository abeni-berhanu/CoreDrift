import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
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

    const fetchSetups = async () => {
      try {
        console.log("Fetching setups for user:", user.uid);
        const setupsRef = collection(db, `users/${user.uid}/setups`);
        console.log("Setups ref path:", setupsRef.path);

        const setupsSnap = await getDocs(setupsRef);
        console.log("Number of setups found:", setupsSnap.size);

        const setupsData = setupsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setSetups(setupsData);
      } catch (error) {
        console.error("Error fetching setups:", error);
        setSetups([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSetups();
  }, [user]);

  const value = {
    setups,
    loading,
  };

  return (
    <SetupsContext.Provider value={value}>{children}</SetupsContext.Provider>
  );
}
