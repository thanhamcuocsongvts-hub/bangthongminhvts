import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    // If input is not an email, we might need to lookup email by username.
    // For simplicity, let's assume if it doesn't contain '@', it's a username.
    // However, Firebase Auth requires email.
    let loginEmail = email;
    if (!email.includes('@')) {
      loginEmail = `${email}@smartboard.local`; // A dummy domain for username-only login
    }
    await signInWithEmailAndPassword(auth, loginEmail, pass);
  };

  const register = async (email: string, pass: string, username: string) => {
    let registerEmail = email;
    if (!email || !email.includes('@')) {
      registerEmail = `${username}@smartboard.local`;
    }
    const userCred = await createUserWithEmailAndPassword(auth, registerEmail, pass);
    await updateProfile(userCred.user, { displayName: username });
    await setDoc(doc(db, 'users', userCred.user.uid), {
      username,
      email: registerEmail,
      createdAt: serverTimestamp()
    });
    setUser({ ...userCred.user, displayName: username } as User);
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
