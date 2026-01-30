import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "hooks/useAuth";
import { usePageTitle } from "hooks/usePageTitle";
import Button from "components/Button";
import styles from "./styles.module.css";

// ================================================
// Component
// ================================================

const Login = () => {
  usePageTitle("Login");
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get the redirect path from location state, or default to /datasets
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/datasets";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!username.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }

    if (isRegister) {
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters");
        return;
      }
    }

    setIsLoading(true);

    try {
      if (isRegister) {
        await register({ username, password });
      } else {
        await login(username, password);
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setError(null);
    setConfirmPassword("");
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>{isRegister ? "Create Account" : "Sign in"}</h1>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="username" className={styles.label}>
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={styles.input}
              placeholder="Enter your username"
              disabled={isLoading}
              autoComplete="username"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              placeholder="Enter your password"
              disabled={isLoading}
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
          </div>

          {isRegister && (
            <div className={styles.field}>
              <label htmlFor="confirmPassword" className={styles.label}>
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={styles.input}
                placeholder="Confirm your password"
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>
          )}

          {error && <div className={styles.error}>{error}</div>}

          <Button variant="primary" type="submit" disabled={isLoading} className={styles.submitButton}>
            {isLoading ? "Please wait..." : isRegister ? "Create Account" : "Sign in"}
          </Button>
        </form>

        <div className={styles.switchMode}>
          <span className={styles.switchText}>
            {isRegister ? "Already have an account?" : "Don't have an account?"}
          </span>
          <Button variant="ghost" colorScheme="primary" onClick={toggleMode} disabled={isLoading}>
            {isRegister ? "Sign in" : "Create one"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Login;
