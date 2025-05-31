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
} from "firebase/firestore";

class DataService {
  constructor() {
    this.batch = null;
    this.operations = [];
    this.errorLog = [];
  }

  // Initialize a new batch
  startBatch() {
    this.batch = writeBatch(db);
    this.operations = [];
    this.errorLog = [];
  }

  // Add operation to batch
  addOperation(operation) {
    this.operations.push(operation);
  }

  // Log error
  logError(operation, error) {
    this.errorLog.push({
      operation,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }

  // Commit batch with error handling and retry logic
  async commitBatch(retryCount = 0, maxRetries = 3) {
    try {
      if (!this.batch) {
        throw new Error("No batch started");
      }

      // Execute all operations
      for (const operation of this.operations) {
        await operation(this.batch);
      }

      // Commit the batch
      await this.batch.commit();

      // Log successful operations
      console.log(
        "Batch committed successfully:",
        this.operations.length,
        "operations"
      );

      // Clear batch
      this.batch = null;
      this.operations = [];
      return true;
    } catch (error) {
      console.error("Batch commit failed:", {
        error,
        code: error.code,
        message: error.message,
        retryCount,
        maxRetries,
      });

      // Check if we should retry
      if (
        retryCount < maxRetries &&
        (error.code === "failed-precondition" ||
          error.code === "unavailable" ||
          error.code === "deadline-exceeded" ||
          error.message.includes("Bad Request"))
      ) {
        console.log(
          `Retrying batch commit (attempt ${
            retryCount + 1
          } of ${maxRetries})...`
        );

        // Create a new batch for retry
        this.batch = writeBatch(db);

        // Wait before retrying (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, retryCount) * 1000)
        );

        // Retry the commit
        return this.commitBatch(retryCount + 1, maxRetries);
      }

      this.logError("batch_commit", error);
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

  async softDeleteAccount(userId, accountId) {
    try {
      const accountRef = doc(db, `users/${userId}/accounts/${accountId}`);
      this.addOperation(() =>
        this.batch.update(accountRef, {
          isDeleted: true,
          deletedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    } catch (error) {
      this.logError("soft_delete_account", error);
      throw error;
    }
  }

  // Trade Operations
  async createTrade(userId, accountId, tradeData) {
    try {
      const tradeRef = doc(
        collection(db, `users/${userId}/accounts/${accountId}/trades`)
      );
      const tradeWithMetadata = {
        ...tradeData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isDeleted: false,
      };
      this.addOperation(() => this.batch.set(tradeRef, tradeWithMetadata));
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
      const tradeWithMetadata = {
        ...tradeData,
        updatedAt: serverTimestamp(),
      };
      this.addOperation(() => this.batch.update(tradeRef, tradeWithMetadata));
    } catch (error) {
      this.logError("update_trade", error);
      throw error;
    }
  }

  async softDeleteTrade(userId, accountId, tradeId) {
    try {
      console.log("Starting soft delete for trade:", {
        userId,
        accountId,
        tradeId,
      });

      if (!this.batch) {
        throw new Error("No batch started. Call startBatch() first.");
      }

      const tradeRef = doc(
        db,
        `users/${userId}/accounts/${accountId}/trades/${tradeId}`
      );
      const deletedTradesCollection = collection(
        db,
        `users/${userId}/accounts/${accountId}/deletedTrades`
      );
      const deletedTradeRef = doc(deletedTradesCollection);

      // Get the trade data
      console.log("Fetching trade data...");
      const tradeDoc = await getDoc(tradeRef);
      if (!tradeDoc.exists()) {
        console.error("Trade not found:", tradeId);
        throw new Error("Trade not found");
      }

      const tradeData = tradeDoc.data();
      console.log("Trade data fetched successfully");

      // Validate trade data
      if (!tradeData) {
        throw new Error("Invalid trade data");
      }

      // Add to deleted trades collection
      const deletedTradeData = {
        ...tradeData,
        deletedAt: serverTimestamp(),
        originalId: tradeId,
        deletedBy: userId,
      };
      console.log("Adding to deleted trades collection...", {
        path: deletedTradeRef.path,
        data: deletedTradeData,
      });
      this.addOperation(() =>
        this.batch.set(deletedTradeRef, deletedTradeData)
      );

      // Remove from original collection
      console.log("Removing from original collection...", {
        path: tradeRef.path,
      });
      this.addOperation(() => this.batch.delete(tradeRef));

      // Log all batch operations before commit
      console.log("Batch operations prepared:", {
        userId,
        accountId,
        tradeId,
        deletePath: tradeRef.path,
        addPath: deletedTradeRef.path,
        addData: deletedTradeData,
      });

      console.log("Soft delete operations added to batch successfully");
    } catch (error) {
      console.error("Error in softDeleteTrade:", {
        error,
        code: error.code,
        message: error.message,
        userId,
        accountId,
        tradeId,
      });
      this.logError("soft_delete_trade", error);
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

  // Recovery Operations
  async recoverDeletedTrade(userId, accountId, deletedTradeId) {
    try {
      const deletedTradeRef = doc(
        db,
        `users/${userId}/accounts/${accountId}/deletedTrades/${deletedTradeId}`
      );
      const deletedTradeDoc = await getDoc(deletedTradeRef);

      if (!deletedTradeDoc.exists()) {
        throw new Error("Deleted trade not found");
      }

      const deletedTradeData = deletedTradeDoc.data();
      const originalId = deletedTradeData.originalId;

      // Restore to original collection
      const tradeRef = doc(
        db,
        `users/${userId}/accounts/${accountId}/trades/${originalId}`
      );
      this.addOperation(() =>
        this.batch.set(tradeRef, {
          ...deletedTradeData,
          isDeleted: false,
          deletedAt: null,
          updatedAt: serverTimestamp(),
          recoveredAt: serverTimestamp(),
        })
      );

      // Remove from deleted trades
      this.addOperation(() => this.batch.delete(deletedTradeRef));
    } catch (error) {
      this.logError("recover_trade", error);
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
}

export const dataService = new DataService();
