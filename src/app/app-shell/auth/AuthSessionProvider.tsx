import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '@/app/data/contracts/entities';
import { storage, DEMO_USER } from '@/app/data/repositories/mockStorage';
import { createUuid } from '@/shared/utils/id';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => boolean;
  register: (data: RegisterData) => boolean;
  loginAsDemo: () => void;
  logout: () => void;
  refreshUser: () => void;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  username: string;
  profilePhoto?: string;
  coverPhoto?: string;
}

const defaultAuthContext: AuthContextType = {
  user: null,
  login: () => false,
  register: () => false,
  loginAsDemo: () => {},
  logout: () => {},
  refreshUser: () => {},
};

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const currentUser = storage.getCurrentUser();
    setUser(currentUser);
  }, []);

  const register = (data: RegisterData): boolean => {
    const existingUser = storage.findUserByEmail(data.email);
    if (existingUser) {
      return false;
    }

    // Check username uniqueness
    const users = storage.getUsers();
    if (users.some(u => u.username === data.username)) {
      return false;
    }

    const newUser: User = {
      id: createUuid(),
      email: data.email,
      name: data.name,
      username: data.username,
      profilePhoto: data.profilePhoto,
      coverPhoto: data.coverPhoto,
    };

    storage.saveUser(newUser);
    storage.setCurrentUser(newUser);
    setUser(newUser);
    return true;
  };

  const login = (email: string, password: string): boolean => {
    const foundUser = storage.findUserByEmail(email);
    if (foundUser) {
      storage.setCurrentUser(foundUser);
      setUser(foundUser);
      return true;
    }
    return false;
  };

  const loginAsDemo = () => {
    // Ensure demo user exists
    const existing = storage.findUserByEmail(DEMO_USER.email);
    if (!existing) {
      storage.saveUser(DEMO_USER);
    }
    storage.setCurrentUser(DEMO_USER);
    setUser(DEMO_USER);
  };

  const logout = () => {
    storage.setCurrentUser(null);
    setUser(null);
  };

  const refreshUser = () => {
    const currentUser = storage.getCurrentUser();
    setUser(currentUser);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, loginAsDemo, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  return context;
}
