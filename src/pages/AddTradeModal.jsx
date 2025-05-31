import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useSetups } from "../contexts/SetupsContext";
import { useAccounts } from "../contexts/AccountsContext";
import TradeEditForm from "../components/TradeEditForm";

const AddTradeModal = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { setups } = useSetups();
  const { accounts } = useAccounts();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (tradeData) => {
    if (!currentUser) {
      setError("You must be logged in to add a trade");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const tradeRef = await addDoc(
        collection(db, "users", currentUser.uid, "trades"),
        {
          ...tradeData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      navigate("/trade-log");
    } catch (err) {
      console.error("Error adding trade:", err);
      setError("Failed to add trade. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/trade-log");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <TradeEditForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={isSubmitting}
        error={error}
        setups={setups}
        accounts={accounts}
        initialValues={{
          symbol: "",
          direction: "long",
          entryPrice: "",
          exitPrice: "",
          quantity: "",
          account: accounts[0]?.id || "",
          setup: setups[0]?.id || "",
          rules: [],
          notes: "",
          imageUrl: "",
          openTime: new Date(),
          closeTime: new Date(),
          pnl: 0,
          fees: 0,
        }}
      />
    </div>
  );
};

export default AddTradeModal;
