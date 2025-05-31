import { db } from "../firebase";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { dataService } from "./DataService";

class BackupService {
  constructor() {
    this.backupInterval = 24 * 60 * 60 * 1000; // 24 hours
    this.lastBackup = null;
  }

  // Create a backup of user data
  async createBackup(userId) {
    try {
      const backupData = {
        timestamp: new Date().toISOString(),
        userId: userId.toLowerCase(),
        accounts: [],
        trades: [],
        setups: [],
      };

      // Backup accounts
      const accountsSnapshot = await getDocs(
        collection(db, `users/${userId.toLowerCase()}/accounts`)
      );
      backupData.accounts = accountsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Backup trades for each account
      for (const account of backupData.accounts) {
        const tradesSnapshot = await getDocs(
          collection(
            db,
            `users/${userId.toLowerCase()}/accounts/${account.id}/trades`
          )
        );
        backupData.trades.push(
          ...tradesSnapshot.docs.map((doc) => ({
            id: doc.id,
            accountId: account.id,
            ...doc.data(),
          }))
        );
      }

      // Backup setups
      const setupsSnapshot = await getDocs(
        collection(db, `users/${userId.toLowerCase()}/setups`)
      );
      backupData.setups = setupsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Store backup in Firestore
      const backupRef = collection(db, `users/${userId.toLowerCase()}/backups`);
      await dataService.startBatch();
      await dataService.addOperation(() =>
        dataService.batch.set(doc(backupRef), {
          ...backupData,
          createdAt: new Date().toISOString(),
        })
      );
      await dataService.commitBatch();

      this.lastBackup = new Date();
      return true;
    } catch (error) {
      console.error("Backup creation failed:", error);
      return false;
    }
  }

  // Restore from backup
  async restoreFromBackup(userId, backupId) {
    try {
      const backupRef = doc(db, `users/${userId}/backups/${backupId}`);
      const backupDoc = await getDoc(backupRef);

      if (!backupDoc.exists()) {
        throw new Error("Backup not found");
      }

      const backupData = backupDoc.data();

      // Start batch operation
      await dataService.startBatch();

      // Restore accounts
      for (const account of backupData.accounts) {
        const accountRef = doc(collection(db, `users/${userId}/accounts`));
        await dataService.addOperation(() =>
          dataService.batch.set(accountRef, {
            ...account,
            restoredAt: new Date().toISOString(),
          })
        );
      }

      // Restore trades
      for (const trade of backupData.trades) {
        const tradeRef = doc(
          collection(db, `users/${userId}/accounts/${trade.accountId}/trades`)
        );
        await dataService.addOperation(() =>
          dataService.batch.set(tradeRef, {
            ...trade,
            restoredAt: new Date().toISOString(),
          })
        );
      }

      // Restore setups
      for (const setup of backupData.setups) {
        const setupRef = doc(collection(db, `users/${userId}/setups`));
        await dataService.addOperation(() =>
          dataService.batch.set(setupRef, {
            ...setup,
            restoredAt: new Date().toISOString(),
          })
        );
      }

      // Commit all operations
      await dataService.commitBatch();
      return true;
    } catch (error) {
      console.error("Backup restoration failed:", error);
      return false;
    }
  }

  // Get list of available backups
  async getBackups(userId) {
    try {
      const backupsSnapshot = await getDocs(
        collection(db, `users/${userId}/backups`)
      );
      return backupsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("Failed to get backups:", error);
      return [];
    }
  }

  // Check if backup is needed
  shouldCreateBackup() {
    if (!this.lastBackup) return true;
    const now = new Date();
    return now - this.lastBackup >= this.backupInterval;
  }

  // Set backup interval
  setBackupInterval(interval) {
    this.backupInterval = interval;
  }
}

export const backupService = new BackupService();
