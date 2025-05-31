import React, { useState } from "react";
import initializeTestData from "../scripts/initializeTestData";

function TestDataInitializer() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleInitialize = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      await initializeTestData();
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Test Data Initializer</h2>
      <button
        onClick={handleInitialize}
        disabled={loading}
        style={{
          padding: "10px 20px",
          background: "#6C63FF",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Initializing..." : "Initialize Test Data"}
      </button>

      {error && (
        <div style={{ color: "red", marginTop: "10px" }}>Error: {error}</div>
      )}

      {success && (
        <div style={{ color: "green", marginTop: "10px" }}>
          Test data initialized successfully!
        </div>
      )}
    </div>
  );
}

export default TestDataInitializer;
