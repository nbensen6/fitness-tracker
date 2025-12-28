import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/clerk-expo';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.config';
import { UserProfile } from '../types';

interface AuthContextType {
  userId: string | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isSignedIn: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, userId, isSignedIn } = useClerkAuth();
  const { user } = useUser();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrCreateProfile = async () => {
      if (!userId || !user) {
        setUserProfile(null);
        setLoading(false);
        return;
      }

      try {
        // Check if user profile exists in Firestore
        const docRef = doc(db, 'users', userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setUserProfile(docSnap.data() as UserProfile);
        } else {
          // Create new profile for first-time users
          const newProfile: UserProfile = {
            uid: userId,
            email: user.emailAddresses[0]?.emailAddress || '',
            displayName: user.firstName || user.username || 'User',
            calorieGoal: 2000,
            createdAt: new Date(),
          };
          await setDoc(docRef, newProfile);
          setUserProfile(newProfile);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isLoaded) {
      loadOrCreateProfile();
    }
  }, [isLoaded, userId, user]);

  return (
    <AuthContext.Provider
      value={{
        userId,
        userProfile,
        loading: !isLoaded || loading,
        isSignedIn: isSignedIn ?? false,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
