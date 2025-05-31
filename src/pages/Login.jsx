import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, user, authError } = useAuth();

  // If user is already logged in, redirect to dashboard
  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      // Convert email to lowercase only when receiving from user
      const normalizedEmail = email.toLowerCase();
      const result = await login(normalizedEmail, password);
      if (result.success) {
        navigate("/dashboard");
      }
    } catch (err) {
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f4f6fa",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 2px 16px rgba(0,0,0,0.08)",
          padding: 40,
          minWidth: 340,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* App Name/Logo */}
        <div
          style={{
            fontWeight: "bold",
            fontSize: 28,
            letterSpacing: 2,
            marginBottom: 32,
            background: "linear-gradient(90deg, #6C63FF 30%, #00C9A7 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            fontFamily: "Segoe UI, Arial, sans-serif",
            textTransform: "uppercase",
          }}
        >
          CoreDrift
        </div>

        {/* Error Messages */}
        {authError && (
          <div
            style={{
              color: "#ff4d4f",
              marginBottom: 16,
              width: "100%",
              textAlign: "center",
              padding: "8px 16px",
              background: "#fff1f0",
              borderRadius: 8,
              border: "1px solid #ffccc7",
            }}
          >
            {authError}
          </div>
        )}

        {/* Form Fields */}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px 16px",
            marginBottom: 18,
            borderRadius: 8,
            border: "1px solid #ccc",
            fontSize: 16,
            outline: "none",
            opacity: loading ? 0.7 : 1,
          }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px 16px",
            marginBottom: 18,
            borderRadius: 8,
            border: "1px solid #ccc",
            fontSize: 16,
            outline: "none",
            opacity: loading ? 0.7 : 1,
          }}
        />

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            background: "linear-gradient(90deg, #6C63FF 30%, #00C9A7 100%)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "12px 0",
            fontWeight: 700,
            fontSize: 16,
            cursor: loading ? "not-allowed" : "pointer",
            marginBottom: 16,
            boxShadow: "0 2px 8px rgba(108,99,255,0.10)",
            transition: "background 0.2s",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        {/* Signup Link */}
        <div style={{ fontSize: 14 }}>
          Don't have an account?{" "}
          <Link
            to="/signup"
            style={{
              color: "#6C63FF",
              textDecoration: "none",
              opacity: loading ? 0.7 : 1,
            }}
          >
            Sign up
          </Link>
        </div>
      </form>
    </div>
  );
}

export default Login;
