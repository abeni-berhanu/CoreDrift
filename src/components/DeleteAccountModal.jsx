import React from "react";
import { useAccount } from "../contexts/AccountContext";

const DeleteAccountModal = () => {
  const {
    deleteConfirmation,
    confirmDeleteAccount,
    cancelDeleteAccount,
    loading,
  } = useAccount();

  if (!deleteConfirmation) {
    return null;
  }

  const handleConfirm = () => {
    console.log("DeleteAccountModal: Confirm button clicked");
    confirmDeleteAccount();
  };

  const handleCancel = () => {
    console.log("DeleteAccountModal: Cancel button clicked");
    cancelDeleteAccount();
  };

  // Helper function to format balance
  const formatBalance = (value) => {
    const num = Number(value);
    return isNaN(num) ? "0.00" : num.toFixed(2);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "8px",
          padding: "24px",
          maxWidth: "500px",
          width: "90%",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontSize: "1.5rem",
            fontWeight: "bold",
            color: "#dc2626",
            marginBottom: "1rem",
          }}
        >
          Confirm Account Deletion
        </h2>

        <div style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              borderBottom: "1px solid #e5e7eb",
              paddingBottom: "1rem",
              marginBottom: "1rem",
            }}
          >
            <h3
              style={{
                fontSize: "1.25rem",
                fontWeight: "600",
                marginBottom: "0.5rem",
              }}
            >
              {deleteConfirmation.accountName}
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
              }}
            >
              <div>
                <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                  Initial Balance
                </p>
                <p style={{ fontWeight: "500" }}>
                  ${deleteConfirmation.initialBalance?.toFixed(2)}
                </p>
              </div>
              <div>
                <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
                  Current Balance
                </p>
                <p style={{ fontWeight: "500" }}>
                  ${deleteConfirmation.currentBalance?.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div
            style={{
              backgroundColor: "#fef3c7",
              padding: "1rem",
              borderRadius: "0.5rem",
            }}
          >
            <p
              style={{
                color: "#92400e",
                fontSize: "0.875rem",
              }}
            >
              ⚠️ Warning: This action cannot be undone. The account and all its
              data will be permanently deleted.
            </p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "1rem",
          }}
        >
          <button
            onClick={handleCancel}
            style={{
              padding: "0.5rem 1rem",
              color: "#4b5563",
              backgroundColor: "transparent",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: "500",
            }}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#dc2626",
              color: "white",
              border: "none",
              borderRadius: "0.375rem",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: "500",
              opacity: loading ? 0.5 : 1,
            }}
            disabled={loading}
          >
            {loading ? "Deleting..." : "Delete Account"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteAccountModal;
