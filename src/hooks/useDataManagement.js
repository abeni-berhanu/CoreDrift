import { useState, useCallback } from "react";
import { dataService } from "../services/DataService";
import { backupService } from "../services/BackupService";
import { useAuth } from "../contexts/AuthContext";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

export const useDataManagement = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Trade operations
  const createTrade = useCallback(
    async (accountId, tradeData) => {
      if (!user) throw new Error("User not authenticated");
      setIsLoading(true);
      setError(null);
      try {
        await dataService.startBatch();
        const tradeId = await dataService.createTrade(
          user.uid,
          accountId,
          tradeData
        );
        const success = await dataService.commitBatch();
        if (!success) throw new Error("Failed to commit trade creation");
        return tradeId;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  const updateTrade = async (accountId, tradeId, tradeData) => {
    if (!user) throw new Error("User not authenticated");
    try {
      // Clean the trade data
      const cleanTradeData = {
        ...tradeData,
        // Convert any object values to their primitive values
        direction: tradeData.direction || null,
        setups: tradeData.setups || null,
        accountId: tradeData.accountId || null,
        // Ensure numbers are actually numbers
        volume: tradeData.volume ? Number(tradeData.volume) : null,
        entryPrice: tradeData.entryPrice ? Number(tradeData.entryPrice) : null,
        exitPrice: tradeData.exitPrice ? Number(tradeData.exitPrice) : null,
        sl: tradeData.sl ? Number(tradeData.sl) : null,
        commission: tradeData.commission ? Number(tradeData.commission) : null,
        swap: tradeData.swap ? Number(tradeData.swap) : null,
        netPnL: tradeData.netPnL ? Number(tradeData.netPnL) : null,
        maxDrawdownR: tradeData.maxDrawdownR
          ? Number(tradeData.maxDrawdownR)
          : null,
        maxRR: tradeData.maxRR ? Number(tradeData.maxRR) : null,
      };

      dataService.startBatch();
      dataService.addOperation((batch) => {
        const tradeRef = doc(
          db,
          "users",
          user.uid,
          "accounts",
          accountId,
          "trades",
          tradeId
        );
        updateDoc(tradeRef, cleanTradeData);
      });
      const result = await dataService.commitBatch();
      return result;
    } catch (error) {
      throw error;
    }
  };

  const deleteTrade = useCallback(
    async (accountId, tradeId) => {
      if (!user) throw new Error("User not authenticated");
      setIsLoading(true);
      setError(null);
      try {
        await dataService.startBatch();
        await dataService.deleteTrade(user.uid, accountId, tradeId);
        const success = await dataService.commitBatch();
        if (!success) throw new Error("Failed to commit trade deletion");
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  // Account operations
  const createAccount = useCallback(
    async (accountData) => {
      if (!user) throw new Error("User not authenticated");
      setIsLoading(true);
      setError(null);
      try {
        await dataService.startBatch();
        const accountId = await dataService.createAccount(
          user.uid,
          accountData
        );
        const success = await dataService.commitBatch();
        if (!success) throw new Error("Failed to commit account creation");
        return accountId;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  const deleteAccount = useCallback(
    async (accountId) => {
      if (!user) throw new Error("User not authenticated");
      setIsLoading(true);
      setError(null);
      try {
        await dataService.startBatch();
        await dataService.softDeleteAccount(user.uid, accountId);
        const success = await dataService.commitBatch();
        if (!success) throw new Error("Failed to commit account deletion");
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  // Setup operations
  const createSetup = useCallback(
    async (setupData) => {
      if (!user) throw new Error("User not authenticated");
      setIsLoading(true);
      setError(null);
      try {
        await dataService.startBatch();
        const setupId = await dataService.createSetup(user.uid, setupData);
        const success = await dataService.commitBatch();
        if (!success) throw new Error("Failed to commit setup creation");
        return setupId;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  const updateSetup = useCallback(
    async (setupId, setupData) => {
      if (!user) throw new Error("User not authenticated");
      setIsLoading(true);
      setError(null);
      try {
        await dataService.startBatch();
        await dataService.updateSetup(user.uid, setupId, setupData);
        const success = await dataService.commitBatch();
        if (!success) throw new Error("Failed to commit setup update");
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  const deleteSetup = useCallback(
    async (setupId) => {
      if (!user) throw new Error("User not authenticated");
      setIsLoading(true);
      setError(null);
      try {
        await dataService.startBatch();
        await dataService.softDeleteSetup(user.uid, setupId);
        const success = await dataService.commitBatch();
        if (!success) throw new Error("Failed to commit setup deletion");
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  // Backup operations
  const createBackup = useCallback(async () => {
    if (!user) throw new Error("User not authenticated");
    setIsLoading(true);
    setError(null);
    try {
      const success = await backupService.createBackup(user.uid);
      if (!success) throw new Error("Failed to create backup");
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const restoreFromBackup = useCallback(
    async (backupId) => {
      if (!user) throw new Error("User not authenticated");
      setIsLoading(true);
      setError(null);
      try {
        const success = await backupService.restoreFromBackup(
          user.uid,
          backupId
        );
        if (!success) throw new Error("Failed to restore from backup");
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  const getBackups = useCallback(async () => {
    if (!user) throw new Error("User not authenticated");
    setIsLoading(true);
    setError(null);
    try {
      return await backupService.getBackups(user.uid);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Recovery operations
  const recoverTrade = useCallback(
    async (accountId, deletedTradeId) => {
      if (!user) throw new Error("User not authenticated");
      setIsLoading(true);
      setError(null);
      try {
        await dataService.startBatch();
        await dataService.recoverDeletedTrade(
          user.uid,
          accountId,
          deletedTradeId
        );
        const success = await dataService.commitBatch();
        if (!success) throw new Error("Failed to commit trade recovery");
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  return {
    isLoading,
    error,
    createTrade,
    updateTrade,
    deleteTrade,
    createAccount,
    deleteAccount,
    createSetup,
    updateSetup,
    deleteSetup,
    createBackup,
    restoreFromBackup,
    getBackups,
    recoverTrade,
  };
};
