import { useState, useCallback } from "react";
import { dataService } from "../services/DataService";
import { backupService } from "../services/BackupService";
import { useAuth } from "../contexts/AuthContext";

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

  const updateTrade = useCallback(
    async (accountId, tradeId, tradeData) => {
      if (!user) throw new Error("User not authenticated");
      setIsLoading(true);
      setError(null);
      try {
        await dataService.startBatch();
        await dataService.updateTrade(user.uid, accountId, tradeId, tradeData);
        const success = await dataService.commitBatch();
        if (!success) throw new Error("Failed to commit trade update");
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  const deleteTrade = useCallback(
    async (accountId, tradeId) => {
      if (!user) throw new Error("User not authenticated");
      setIsLoading(true);
      setError(null);
      try {
        console.log("Starting trade deletion process:", { accountId, tradeId });
        await dataService.startBatch();
        console.log("Batch started");

        await dataService.softDeleteTrade(user.uid, accountId, tradeId);
        console.log("Soft delete operation added to batch");

        const success = await dataService.commitBatch();
        console.log("Batch commit result:", success);

        if (!success) {
          console.error("Batch commit failed");
          throw new Error("Failed to commit trade deletion");
        }

        console.log("Trade deletion completed successfully");
      } catch (err) {
        console.error("Error in deleteTrade:", {
          error: err,
          code: err.code,
          message: err.message,
          accountId,
          tradeId,
        });
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
