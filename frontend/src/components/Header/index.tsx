import { NavLink, useNavigate } from "react-router-dom";

import UserAvatar from "components/UserAvatar";
import Dropdown from "components/Dropdown";
import Logo from "components/Logo";

import { useAuth } from '@/hooks/useAuth';

import styles from "./styles.module.css";

// ================================================
// Component
// ================================================

const NavBar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const dropdownItems = [
    {
      label: "View Profile",
      onClick: () => navigate("/profile"),
    },
    {
      label: "Logout",
      onClick: logout,
      variant: "danger" as const,
    },
  ];

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <Logo size="small" />
      </div>

      <nav className={styles.nav}>
        <NavLink to="/datasets" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ""}`}>
          Datasets
        </NavLink>
        <NavLink to="/vocabularies" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ""}`}>
          Vocabularies
        </NavLink>
        <NavLink to="/monitor" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ""}`}>
          Monitor
        </NavLink>
      </nav>

      <div className={styles.right}>
        {user && (
          <Dropdown
            trigger={<UserAvatar username={user.username} size="medium" />}
            items={dropdownItems}
            align="right"
          />
        )}
      </div>
    </header>
  );
};

export default NavBar;
