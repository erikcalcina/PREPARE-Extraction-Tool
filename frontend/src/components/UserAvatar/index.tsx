import classNames from "classnames";

import styles from "./styles.module.css";

export interface UserAvatarProps {
  username: string;
  size?: "small" | "medium" | "large";
  onClick?: () => void;
}

const UserAvatar = ({ username, size = "medium", onClick }: UserAvatarProps) => {
  const getInitials = (name: string): string => {
    const parts = name.split(/[_\s-]+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const initials = getInitials(username);

  return (
    <button
      className={classNames(styles.avatar, styles[`avatar--${size}`])}
      onClick={onClick}
      title={username}
      type="button"
    >
      {initials}
    </button>
  );
};

export default UserAvatar;
