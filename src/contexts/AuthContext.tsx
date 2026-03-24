import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

export interface UserProfile {
    id: string;
    name: string;
    role: 'ADMIN' | 'EMPLOYEE';
    off_days?: number[];
}

interface AuthContextType {
    user: UserProfile | null;
    session: Session | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    logout: () => void;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
            if (!error && data) {
                setUser(data as UserProfile);
            } else {
                // If profile is missing (deleted from DB), invalidate the session
                console.warn('Profile missing for authenticated user. Logging out.');
                await supabase.auth.signOut();
                setUser(null);
                setSession(null);
            }
        } catch (e) {
            console.error('Error fetching profile:', e);
            setUser(null);
        }
    };

    useEffect(() => {
        // Check initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session?.user) {
                fetchProfile(session.user.id).finally(() => setIsLoading(false));
            } else {
                setIsLoading(false);
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                setSession(session);
                if (session?.user) {
                    await fetchProfile(session.user.id);
                    setIsLoading(false);
                } else {
                    setUser(null);
                    setIsLoading(false);
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const logout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
    };

    const refreshProfile = async () => {
        if (session?.user) await fetchProfile(session.user.id);
    };

    return (
        <AuthContext.Provider value={{ user, session, isAuthenticated: !!session, isLoading, logout, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
