import { AuthContext, useAuthProvider } from 'hooks/useAuth';

// ================================================
// Interface
// ================================================

export interface AuthProviderProps {
    children: React.ReactNode;
}

// ================================================
// Component
// ================================================

const AuthProvider = ({ children }: AuthProviderProps) => {
    const auth = useAuthProvider();

    return (
        <AuthContext.Provider value={auth}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthProvider;

