import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from 'hooks/useAuth';

// ================================================
// Interface
// ================================================

export interface ProtectedRouteProps {
    children: React.ReactNode;
}

// ================================================
// Component
// ================================================

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
    const { isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                fontSize: '1.2rem',
                color: '#666',
            }}>
                Loading...
            </div>
        );
    }

    if (!isAuthenticated) {
        // Redirect to login page, but save the attempted location
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;

