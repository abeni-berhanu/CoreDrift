import { db } from "../firebase";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";

// Initialize symbols collection if empty
export const initializeSymbols = async () => {
  try {
    const symbolsRef = collection(db, "symbols");
    const querySnapshot = await getDocs(symbolsRef);

    if (querySnapshot.empty) {
      console.log("Initializing symbols collection...");
      // Create default symbols with current market standard values
      const defaultSymbols = [
        {
          id: "EURUSD",
          pipSize: 0.0001,
          pipValuePerLot: 10,
          contractSize: 100000,
        },
        {
          id: "XAUUSD",
          pipSize: 0.1,
          pipValuePerLot: 10,
          contractSize: 100,
        },
        {
          id: "NASDAQ",
          pipSize: 1,
          pipValuePerLot: 1,
          contractSize: 1,
        },
        {
          id: "BTCUSD",
          pipSize: 1,
          pipValuePerLot: 1,
          contractSize: 1,
        },
      ];

      for (const symbol of defaultSymbols) {
        const symbolRef = doc(db, "symbols", symbol.id);
        await setDoc(symbolRef, {
          ...symbol,
          updatedAt: serverTimestamp(),
        });
      }
      console.log("Symbols collection initialized successfully");
    }
  } catch (error) {
    console.error("Error initializing symbols:", error);
    throw error;
  }
};

// Get all symbols from the global collection
export const getSymbols = async () => {
  try {
    const symbolsRef = collection(db, "symbols");
    const querySnapshot = await getDocs(symbolsRef);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error getting symbols:", error);
    throw error;
  }
};

// Get a single symbol by ID
export const getSymbol = async (symbolId) => {
  try {
    const symbolRef = doc(db, "symbols", symbolId);
    const symbolDoc = await getDoc(symbolRef);
    if (!symbolDoc.exists()) {
      throw new Error(`Symbol ${symbolId} not found`);
    }
    return {
      id: symbolDoc.id,
      ...symbolDoc.data(),
    };
  } catch (error) {
    console.error(`Error getting symbol ${symbolId}:`, error);
    throw error;
  }
};

// Add or update a symbol (global collection)
export const addSymbol = async (id, pipSize, pipValuePerLot) => {
  try {
    const symbolRef = doc(db, "symbols", id);
    await setDoc(
      symbolRef,
      {
        id,
        pipSize,
        pipValuePerLot,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error("Error adding/updating symbol:", error);
    throw error;
  }
};
