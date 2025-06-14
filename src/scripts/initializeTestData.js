import { db } from "../firebase";
import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  addDoc,
} from "firebase/firestore";

// Test user data
const testUser = {
  uid: "test-user-123",
  email: "test@example.com",
  displayName: "Test User",
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
};

// Test account data
const testAccounts = [
  {
    name: "Demo Account 1",
    initialBalance: 100000,
    accountType: "Demo",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  },
  {
    name: "Live Account 1",
    initialBalance: 50000,
    accountType: "Live",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  },
];

// Test trades data
const testTrades = [
  {
    symbol: "EURUSD",
    direction: "BUY",
    entryPrice: 1.085,
    exitPrice: 1.09,
    volume: 0.1,
    status: "WIN",
    netPnL: 50,
    entryTimestamp: serverTimestamp(),
    exitTimestamp: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  },
  {
    symbol: "GBPUSD",
    direction: "SELL",
    entryPrice: 1.265,
    exitPrice: 1.26,
    volume: 0.1,
    status: "WIN",
    netPnL: 50,
    entryTimestamp: serverTimestamp(),
    exitTimestamp: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  },
  {
    symbol: "XAUUSD",
    direction: "BUY",
    entryPrice: 1950,
    exitPrice: 1945,
    volume: 0.05,
    status: "LOSS",
    netPnL: -25,
    entryTimestamp: serverTimestamp(),
    exitTimestamp: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  },
  {
    symbol: "USDJPY",
    direction: "SELL",
    entryPrice: 150.5,
    exitPrice: 151.0,
    volume: 0.2,
    status: "LOSS",
    netPnL: -100,
    entryTimestamp: serverTimestamp(),
    exitTimestamp: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  },
  {
    symbol: "EURUSD",
    direction: "BUY",
    entryPrice: 1.082,
    exitPrice: 1.087,
    volume: 0.15,
    status: "WIN",
    netPnL: 75,
    entryTimestamp: serverTimestamp(),
    exitTimestamp: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  },
];

// Test setups data
const testSetups = [
  {
    name: "London Breakout",
    description: "Breakout strategy for London session",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  },
  {
    name: "New York Range",
    description: "Range trading strategy for NY session",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  },
];

// Test journal entries
const testJournalEntries = [
  {
    title: "First Trading Day",
    content: "Started with demo account. Testing strategies.",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  },
  {
    title: "Strategy Review",
    content: "London Breakout strategy showing good results.",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  },
];

// Test notes
const testNotes = [
  {
    title: "Market Hours",
    content: "London: 8-16 GMT\nNew York: 13-21 GMT",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  },
  {
    title: "Risk Management",
    content: "Max 2% risk per trade\nMax 6% risk per day",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  },
];

// Test notebook entries
const testNotebookEntries = [
  {
    title: "EURUSD Analysis",
    content:
      "Strong support at 1.0800. Looking for long opportunities above this level. Key resistance at 1.0950.",
    tags: ["EURUSD", "Technical Analysis", "Support/Resistance"],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  },
  {
    title: "GBPUSD Trade Plan",
    content:
      "Waiting for price to reach 1.2600 support. Will look for bullish reversal patterns. Stop loss below 1.2550.",
    tags: ["GBPUSD", "Trade Plan", "Support"],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  },
  {
    title: "XAUUSD Weekly Outlook",
    content:
      "Gold showing strength above 1950. Key levels to watch: Support at 1940, Resistance at 1980. Potential for continuation of uptrend.",
    tags: ["XAUUSD", "Weekly Analysis", "Trend"],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  },
  {
    title: "USDJPY Market Notes",
    content:
      "Bank of Japan intervention risk at 152.00. Current range between 149.50-151.50. Trading with caution due to intervention risk.",
    tags: ["USDJPY", "Market Notes", "Intervention"],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  },
];

async function initializeTestData() {
  try {
    console.log("Starting test data initialization...");

    // Create test user
    const userRef = doc(db, "users", testUser.uid);
    await setDoc(userRef, testUser);
    console.log("Test user created");

    // Create test accounts
    const accountsRef = collection(db, "users", testUser.uid, "accounts");
    for (const account of testAccounts) {
      const accountRef = await addDoc(accountsRef, account);
      console.log(`Test account created: ${account.name}`);

      // Create test trades for each account
      const tradesRef = collection(
        db,
        "users",
        testUser.uid,
        "accounts",
        accountRef.id,
        "trades"
      );
      for (const trade of testTrades) {
        await addDoc(tradesRef, trade);
      }
      console.log(`Test trades created for account: ${account.name}`);
    }

    // Create test setups
    const setupsRef = collection(db, "users", testUser.uid, "setups");
    for (const setup of testSetups) {
      await addDoc(setupsRef, setup);
    }
    console.log("Test setups created");

    // Create test journal entries
    const journalRef = collection(db, "users", testUser.uid, "journal");
    for (const entry of testJournalEntries) {
      await addDoc(journalRef, entry);
    }
    console.log("Test journal entries created");

    // Create test notes
    const notesRef = collection(db, "users", testUser.uid, "notes");
    for (const note of testNotes) {
      await addDoc(notesRef, note);
    }
    console.log("Test notes created");

    // Create test notebook entries
    const notebooksRef = collection(db, "users", testUser.uid, "notebooks");
    for (const entry of testNotebookEntries) {
      await addDoc(notebooksRef, entry);
    }
    console.log("Test notebook entries created");

    console.log("Test data initialization completed successfully!");
  } catch (error) {
    console.error("Error initializing test data:", error);
  }
}

// Export the function
export default initializeTestData;
