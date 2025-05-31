import React, { createContext, useContext, useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../firebase/config";

// Error messages for different scenarios
const ERROR_MESSAGES = {
  "auth/invalid-email": "Invalid email address",
  "auth/user-disabled": "This account has been disabled",
  "auth/user-not-found": "No account found with this email",
  "auth/wrong-password": "Incorrect password",
  "auth/email-already-in-use": "An account already exists with this email",
  "auth/operation-not-allowed": "Email/password accounts are not enabled",
  "auth/weak-password": "Password is too weak",
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Set up auth state listener
  useEffect(() => {
    console.log("Setting up auth state listener...");
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log(
        "Auth state changed:",
        firebaseUser ? "User logged in" : "No user"
      );
      if (firebaseUser) {
        console.log("Firebase user details:", {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          emailVerified: firebaseUser.emailVerified,
          isAnonymous: firebaseUser.isAnonymous,
          metadata: firebaseUser.metadata,
        });
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    console.log("Attempting login for email:", email);
    try {
      setAuthError(null);
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      console.log("Login successful - User details:", {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        emailVerified: userCredential.user.emailVerified,
        isAnonymous: userCredential.user.isAnonymous,
        metadata: userCredential.user.metadata,
        providerData: userCredential.user.providerData,
      });
      return { success: true, user: userCredential.user };
    } catch (error) {
      console.error("Login error:", {
        code: error.code,
        message: error.message,
        fullError: error,
      });
      const errorMessage = ERROR_MESSAGES[error.code] || error.message;
      setAuthError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const signup = async (email, password) => {
    console.log("Attempting signup for email:", email);
    try {
      setAuthError(null);
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      console.log("Signup successful - User details:", {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        emailVerified: userCredential.user.emailVerified,
        isAnonymous: userCredential.user.isAnonymous,
        metadata: userCredential.user.metadata,
        providerData: userCredential.user.providerData,
      });
      return { success: true, user: userCredential.user };
    } catch (error) {
      console.error("Signup error:", {
        code: error.code,
        message: error.message,
        fullError: error,
      });
      const errorMessage = ERROR_MESSAGES[error.code] || error.message;
      setAuthError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    console.log("Attempting logout for user:", user?.email);
    try {
      setAuthError(null);
      await signOut(auth);
      console.log("Logout successful");
      return { success: true };
    } catch (error) {
      console.error("Logout error:", {
        code: error.code,
        message: error.message,
        fullError: error,
      });
      const errorMessage = ERROR_MESSAGES[error.code] || error.message;
      setAuthError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        login,
        logout,
        signup,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
