import { db } from "../firebase";
import {
  collection,
  doc,
  writeBatch,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
  serverTimestamp,
  deleteDoc,
  updateDoc,
  addDoc,
  orderBy,
} from "firebase/firestore";

class DataService {
  constructor() {
    this.batch = null;
    this.operations = [];
    this.errorLog = [];
  }

  // Initialize a new batch
  async startBatch() {
    console.log("Starting new batch operation");
    this.batch = writeBatch(db);
    this.operations = [];
    console.log("Batch initialized");
  }

  // Add operation to batch
  addOperation(operation) {
    if (!this.batch) {
      console.error("Attempted to add operation without starting batch");
      throw new Error("Batch not started");
    }
    console.log("Adding operation to batch");
    this.operations.push(operation);
    console.log(`Total operations in batch: ${this.operations.length}`);
  }

  // Log error
  logError(operation, error) {
    const errorLog = {
      operation,
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
    };
    console.error(`Error in ${operation}:`, errorLog);
    this.errorLog.push(errorLog);
  }

  // Commit batch with error handling and retry logic
  async commitBatch() {
    if (!this.batch) {
      console.error("Attempted to commit without starting batch");
      throw new Error("Batch not started");
    }

    try {
      console.log(`Executing ${this.operations.length} operations in batch`);

      // Execute all operations
      this.operations.forEach((operation, index) => {
        console.log(
          `Executing operation ${index + 1}/${this.operations.length}`
        );
        operation();
      });

      console.log("All operations executed, committing batch");
      // Commit the batch
      await this.batch.commit();
      console.log("Batch committed successfully");

      // Reset batch and operations
      this.batch = null;
      this.operations = [];

      return true;
    } catch (error) {
      console.error("Error committing batch:", {
        error,
        code: error.code,
        message: error.message,
        stack: error.stack,
      });
      this.logError("commit_batch", error);
      return false;
    }
  }

  // User Operations
  async createUser(userData) {
    try {
      const userId = userData.uid;
      const userRef = doc(db, "users", userId);
      await this.batch.set(userRef, {
        ...userData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      this.addOperation(() => this.batch.set(userRef, userData));
    } catch (error) {
      this.logError("create_user", error);
      throw error;
    }
  }

  // Account Operations
  async createAccount(userId, accountData) {
    try {
      const accountRef = doc(collection(db, `users/${userId}/accounts`));
      const accountWithMetadata = {
        ...accountData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isDeleted: false,
      };
      this.addOperation(() => this.batch.set(accountRef, accountWithMetadata));
      return accountRef.id;
    } catch (error) {
      this.logError("create_account", error);
      throw error;
    }
  }

  async deleteAccount(userId, accountId) {
    console.log("Starting account deletion:", { userId, accountId });
    try {
      // Delete the account document - subcollections (trades) will be automatically deleted
      const accountRef = doc(db, `users/${userId}/accounts/${accountId}`);
      console.log("Deleting account document:", accountRef.path);
      await deleteDoc(accountRef);
      console.log("Account document deleted successfully");
      return true;
    } catch (err) {
      console.error("Error deleting account:", {
        error: err,
        code: err.code,
        message: err.message,
        stack: err.stack,
      });
      throw err;
    }
  }

  // Trade Operations
  async createTrade(userId, accountId, tradeData) {
    try {
      const tradeRef = doc(
        collection(db, `users/${userId}/accounts/${accountId}/trades`)
      );

      // Convert numeric fields to numbers
      const numericFields = [
        "entryPrice",
        "exitPrice",
        "sl",
        "riskAmount",
        "commission",
        "swap",
        "netPnL",
        "duration",
        "riskToReward",
        "percentRisk",
        "percentPnL",
        "maxDrawdownR",
        "maxRR",
        "volume",
      ];

      const processedTradeData = {
        ...tradeData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isDeleted: false,
      };

      // Convert all numeric fields
      numericFields.forEach((field) => {
        if (
          processedTradeData[field] !== undefined &&
          processedTradeData[field] !== null &&
          processedTradeData[field] !== ""
        ) {
          processedTradeData[field] = Number(processedTradeData[field]);
        }
      });

      this.addOperation(() => this.batch.set(tradeRef, processedTradeData));

      // Update account current balance
      const accountRef = doc(db, `users/${userId}/accounts/${accountId}`);
      const accountDoc = await getDoc(accountRef);
      if (accountDoc.exists()) {
        const account = accountDoc.data();
        const newBalance =
          (account.currentBalance || account.initialBalance) +
          (Number(processedTradeData.netPnL) || 0);

        this.addOperation(() =>
          this.batch.update(accountRef, {
            currentBalance: newBalance,
            updatedAt: serverTimestamp(),
          })
        );
      }

      return tradeRef.id;
    } catch (error) {
      this.logError("create_trade", error);
      throw error;
    }
  }

  async updateTrade(userId, accountId, tradeId, tradeData) {
    try {
      const tradeRef = doc(
        db,
        `users/${userId}/accounts/${accountId}/trades/${tradeId}`
      );
      const oldTradeDoc = await getDoc(tradeRef);

      if (!oldTradeDoc.exists()) {
        throw new Error("Trade not found");
      }

      const oldTrade = oldTradeDoc.data();

      // Convert numeric fields to numbers
      const numericFields = [
        "entryPrice",
        "exitPrice",
        "sl",
        "riskAmount",
        "commission",
        "swap",
        "netPnL",
        "duration",
        "riskToReward",
        "percentRisk",
        "percentPnL",
        "maxDrawdownR",
        "maxRR",
        "volume",
      ];

      const processedTradeData = {
        ...tradeData,
        updatedAt: serverTimestamp(),
      };

      // Convert all numeric fields
      numericFields.forEach((field) => {
        if (
          processedTradeData[field] !== undefined &&
          processedTradeData[field] !== null &&
          processedTradeData[field] !== ""
        ) {
          processedTradeData[field] = Number(processedTradeData[field]);
        }
      });

      this.addOperation(() => this.batch.update(tradeRef, processedTradeData));

      // Update account current balance
      const accountRef = doc(db, `users/${userId}/accounts/${accountId}`);
      const accountDoc = await getDoc(accountRef);
      if (accountDoc.exists()) {
        const account = accountDoc.data();
        const oldPnL = Number(oldTrade.netPnL) || 0;
        const newPnL = Number(processedTradeData.netPnL) || 0;
        const balanceDiff = newPnL - oldPnL;
        const newBalance =
          (account.currentBalance || account.initialBalance) + balanceDiff;

        this.addOperation(() =>
          this.batch.update(accountRef, {
            currentBalance: newBalance,
            updatedAt: serverTimestamp(),
          })
        );
      }
    } catch (error) {
      this.logError("update_trade", error);
      throw error;
    }
  }

  async deleteTrade(userId, accountId, tradeId) {
    try {
      const tradeRef = doc(
        db,
        `users/${userId}/accounts/${accountId}/trades/${tradeId}`
      );
      const tradeDoc = await getDoc(tradeRef);

      if (!tradeDoc.exists()) {
        throw new Error("Trade not found");
      }

      const trade = tradeDoc.data();
      this.addOperation(() =>
        this.batch.update(tradeRef, {
          isDeleted: true,
          deletedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );

      // Update account current balance
      const accountRef = doc(db, `users/${userId}/accounts/${accountId}`);
      const accountDoc = await getDoc(accountRef);
      if (accountDoc.exists()) {
        const account = accountDoc.data();
        const newBalance =
          (account.currentBalance || account.initialBalance) -
          (Number(trade.netPnL) || 0);

        this.addOperation(() =>
          this.batch.update(accountRef, {
            currentBalance: newBalance,
            updatedAt: serverTimestamp(),
          })
        );
      }
    } catch (error) {
      this.logError("delete_trade", error);
      throw error;
    }
  }

  // Setup Operations
  async createSetup(userId, setupData) {
    try {
      const setupRef = doc(collection(db, `users/${userId}/setups`));
      const setupWithMetadata = {
        ...setupData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isDeleted: false,
      };
      this.addOperation(() => this.batch.set(setupRef, setupWithMetadata));
      return setupRef.id;
    } catch (error) {
      this.logError("create_setup", error);
      throw error;
    }
  }

  async updateSetup(userId, setupId, setupData) {
    try {
      const setupRef = doc(db, `users/${userId}/setups/${setupId}`);
      const setupWithMetadata = {
        ...setupData,
        updatedAt: serverTimestamp(),
      };
      this.addOperation(() => this.batch.update(setupRef, setupWithMetadata));
    } catch (error) {
      this.logError("update_setup", error);
      throw error;
    }
  }

  async softDeleteSetup(userId, setupId) {
    try {
      const setupRef = doc(db, `users/${userId}/setups/${setupId}`);
      this.addOperation(() =>
        this.batch.update(setupRef, {
          isDeleted: true,
          deletedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    } catch (error) {
      this.logError("soft_delete_setup", error);
      throw error;
    }
  }

  // Note Operations
  async createNote(userId, noteData) {
    try {
      const noteRef = doc(collection(db, `users/${userId}/notes`));
      const noteWithMetadata = {
        ...noteData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isDeleted: false,
      };
      this.addOperation(() => this.batch.set(noteRef, noteWithMetadata));
      return noteRef.id;
    } catch (error) {
      this.logError("create_note", error);
      throw error;
    }
  }

  async updateNote(userId, noteId, noteData) {
    try {
      const noteRef = doc(db, `users/${userId}/notes/${noteId}`);
      const noteWithMetadata = {
        ...noteData,
        updatedAt: serverTimestamp(),
      };
      this.addOperation(() => this.batch.update(noteRef, noteWithMetadata));
    } catch (error) {
      this.logError("update_note", error);
      throw error;
    }
  }

  async deleteNote(userId, noteId) {
    try {
      const noteRef = doc(db, `users/${userId}/notes/${noteId}`);
      this.addOperation(() => this.batch.delete(noteRef));
    } catch (error) {
      this.logError("delete_note", error);
      throw error;
    }
  }

  // Journal Operations
  async createJournalEntry(userId, journalData) {
    try {
      const journalRef = doc(collection(db, `users/${userId}/journal`));
      const journalWithMetadata = {
        ...journalData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isDeleted: false,
      };
      this.addOperation(() => this.batch.set(journalRef, journalWithMetadata));
      return journalRef.id;
    } catch (error) {
      this.logError("create_journal", error);
      throw error;
    }
  }

  async updateJournalEntry(userId, journalId, journalData) {
    try {
      const journalRef = doc(db, `users/${userId}/journal/${journalId}`);
      const journalWithMetadata = {
        ...journalData,
        updatedAt: serverTimestamp(),
      };
      this.addOperation(() =>
        this.batch.update(journalRef, journalWithMetadata)
      );
    } catch (error) {
      this.logError("update_journal", error);
      throw error;
    }
  }

  async deleteJournalEntry(userId, journalId) {
    try {
      const journalRef = doc(db, `users/${userId}/journal/${journalId}`);
      this.addOperation(() => this.batch.delete(journalRef));
    } catch (error) {
      this.logError("delete_journal", error);
      throw error;
    }
  }

  // Get error log
  getErrorLog() {
    return this.errorLog;
  }

  // Clear error log
  clearErrorLog() {
    this.errorLog = [];
  }

  async initializeAccountBalances(userId) {
    try {
      // Get all accounts for the user
      const accountsRef = collection(db, `users/${userId}/accounts`);
      const accountsSnapshot = await getDocs(accountsRef);

      for (const accountDoc of accountsSnapshot.docs) {
        const account = accountDoc.data();

        // Skip if account already has currentBalance
        if (account.currentBalance !== undefined) continue;

        // Get all trades for this account (including deleted ones for historical accuracy)
        const tradesQuery = query(
          collection(db, `users/${userId}/accounts/${accountDoc.id}/trades`),
          orderBy("entryTimestamp", "asc") // Get trades in chronological order
        );
        const tradesSnapshot = await getDocs(tradesQuery);

        // Calculate total PnL from all trades
        let totalPnL = 0;
        tradesSnapshot.docs.forEach((doc) => {
          const trade = doc.data();
          // Only add PnL if the trade is not deleted
          if (!trade.isDeleted) {
            totalPnL += Number(trade.netPnL) || 0;
          }
        });

        // Set currentBalance to initialBalance + totalPnL
        const newBalance = (account.initialBalance || 0) + totalPnL;

        console.log(`Initializing balance for account ${accountDoc.id}:`, {
          initialBalance: account.initialBalance,
          totalPnL,
          newBalance,
          tradeCount: tradesSnapshot.docs.length,
        });

        // Update the account
        const accountRef = doc(db, `users/${userId}/accounts/${accountDoc.id}`);
        await updateDoc(accountRef, {
          currentBalance: newBalance,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      this.logError("initialize_account_balances", error);
      throw error;
    }
  }
}

export const dataService = new DataService();
