import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signup, user, authError } = useAuth();

  // If user is already logged in, redirect to dashboard
  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Signup form submitted with email:", email);

    // Validate password match
    if (password !== confirmPassword) {
      console.log("Password mismatch");
      return;
    }

    try {
      setLoading(true);
      console.log("Attempting to create user with email:", email);
      const result = await signup(email, password);
      console.log("Signup result:", result);

      if (result.success) {
        // Wait for the user to be fully initialized
        await new Promise((resolve) => setTimeout(resolve, 1000));

        console.log("Creating user document in Firestore");
        console.log("Firebase Auth user:", result.user);
        console.log("User UID:", result.user.uid);

        // Use the Firebase Auth uid as the document ID
        const userDocRef = doc(db, "users", result.user.uid);
        console.log("User document reference path:", userDocRef.path);

        const userData = {
          uid: result.user.uid,
          email: email.toLowerCase(),
          displayName: email.split("@")[0],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        console.log("User data to be saved:", userData);

        try {
          console.log("Attempting to save user document to Firestore...");
          await setDoc(userDocRef, userData);
          console.log(
            "User document created successfully at path:",
            userDocRef.path
          );

          // Verify the document was created
          console.log("Verifying document creation...");
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            console.log("Document verified:", docSnap.data());
            navigate("/dashboard");
          } else {
            console.error("Document was not created successfully");
          }
        } catch (firestoreError) {
          console.error("Firestore document creation error:", firestoreError);
          console.error("Error code:", firestoreError.code);
          console.error("Error message:", firestoreError.message);
          console.error("Full error object:", firestoreError);
          console.error("Error stack:", firestoreError.stack);

          // Check if it's a permissions error
          if (firestoreError.code === "permission-denied") {
            console.error(
              "This is a permissions error. Check your Firestore rules."
            );
          }
        }
      } else {
        console.error("Signup failed:", result.error);
      }
    } catch (err) {
      console.error("Signup error:", err);
      console.error("Error code:", err.code);
      console.error("Error message:", err.message);
      console.error("Full error object:", err);
      console.error("Error stack:", err.stack);
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
        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
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
          {loading ? "Creating Account..." : "Sign Up"}
        </button>

        {/* Login Link */}
        <div style={{ fontSize: 14 }}>
          Already have an account?{" "}
          <Link
            to="/login"
            style={{
              color: "#6C63FF",
              textDecoration: "none",
              opacity: loading ? 0.7 : 1,
            }}
          >
            Login
          </Link>
        </div>
      </form>
    </div>
  );
}

export default Signup;
