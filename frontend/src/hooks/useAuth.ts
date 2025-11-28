import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import type { User, UserRegister } from 'types';
import {
    login as apiLogin,
    register as apiRegister,
    getCurrentUser,
    setToken,
    clearToken,
    getToken,
} from 'api';

// ================================================
// Auth Context
// ================================================

export interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (username: string, password: string) => Promise<void>;
    register: (data: UserRegister) => Promise<void>;
    logout: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

// ================================================
// Auth Hook
// ================================================

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

// ================================================
// Auth Provider Hook (for creating context value)
// ================================================

export function useAuthProvider(): AuthContextType {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const isAuthenticated = !!user;

    // Check for existing token on mount
    useEffect(() => {
        const checkAuth = async () => {
            const token = getToken();
            if (token) {
                try {
                    const userData = await getCurrentUser();
                    setUser(userData);
                } catch {
                    // Token is invalid, clear it
                    clearToken();
                }
            }
            setIsLoading(false);
        };

        checkAuth();
    }, []);

    const login = useCallback(async (username: string, password: string) => {
        const tokenData = await apiLogin(username, password);
        setToken(tokenData.access_token);
        const userData = await getCurrentUser();
        setUser(userData);
    }, []);

    const register = useCallback(async (data: UserRegister) => {
        await apiRegister(data);
        // After successful registration, log the user in
        await login(data.username, data.password);
    }, [login]);

    const logout = useCallback(() => {
        clearToken();
        setUser(null);
    }, []);

    return {
        user,
        isLoading,
        isAuthenticated,
        login,
        register,
        logout,
    };
}

