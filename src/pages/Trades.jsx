import { collection, addDoc, Timestamp } from "firebase/firestore";

const handleDeleteTrade = async (tradeId) => {
  if (!window.confirm("Are you sure you want to delete this trade?")) return;

  try {
    // Get the trade data before deleting
    const tradeRef = doc(db, "trades", tradeId);
    const tradeDoc = await getDoc(tradeRef);
    const tradeData = tradeDoc.data();

    // Add to deleted trades collection
    const deletedTradesRef = collection(db, "deletedTrades");
    await addDoc(deletedTradesRef, {
      ...tradeData,
      deletedAt: Timestamp.now(),
    });

    // Delete from main trades collection
    await deleteDoc(tradeRef);

    // Refresh trades list
    fetchTrades();
  } catch (error) {
    console.error("Error deleting trade:", error);
    alert("Failed to delete trade. Please try again.");
  }
};
