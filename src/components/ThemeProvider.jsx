import React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { migrateUserData } from '@/utils/dataMigration';

const ThemeProviderContext = createContext(undefined)

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'vite-ui-theme',
  ...props
}) {
  const [theme, setTheme] = useState(
    () => localStorage.getItem(storageKey) || defaultTheme
  )

  useEffect(() => {
    const root = window.document.documentElement

    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light'

      root.classList.add(systemTheme)
      return
    }

    root.classList.add(theme)
  }, [theme])

  const value = {
    theme,
    setTheme: (newTheme) => {
      localStorage.setItem(storageKey, newTheme)
      setTheme(newTheme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider')

  return context
}

// --- USER PROVIDER CONTEXT ---
const UserProviderContext = createContext(undefined);

export function UserProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = not logged in
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [migrationStatus, setMigrationStatus] = useState(null);

  const fetchUser = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/me', {
        credentials: 'include' // Required to send cookies with the request
      });
      if (!res.ok) {
        // If 401/403, user is not authenticated - this is normal
        if (res.status === 401 || res.status === 403) {
          setUser(null);
          return;
        }
        // For other errors, throw to be caught below
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const fetchedUser = data.user || null;
      
      // If we have a user and haven't set user state yet (initial login), attempt migration
      if (fetchedUser?.email && !user?.email) {
        console.log(`👤 User logged in: ${fetchedUser.email}`);
        
        try {
          const migrationResult = await migrateUserData(fetchedUser);
          setMigrationStatus(migrationResult);
          
          if (migrationResult.migrated) {
            console.log(`🔄 Migration completed: ${migrationResult.message}`);
          }
        } catch (migrationError) {
          console.error('Migration failed:', migrationError);
          setMigrationStatus({
            success: false,
            migrated: false,
            message: 'Failed to migrate existing data'
          });
        }
      }
      
      setUser(fetchedUser);
    } catch (e) {
      // Handle network errors gracefully - don't break the app
      console.warn('UserProvider: User fetch error:', e.message);
      setUser(null);
      // Only set error for non-network issues
      if (e.name !== 'TypeError' && !e.message.includes('fetch')) {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    await fetchUser();
  };

  useEffect(() => {
    let ignore = false;
    const initialFetch = async () => {
      await fetchUser();
    };
    initialFetch();
    return () => { ignore = true; };
  }, []);

  const value = { user, setUser, loading, error, refreshUser, migrationStatus };
  return (
    <UserProviderContext.Provider value={value}>
      {children}
    </UserProviderContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserProviderContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
