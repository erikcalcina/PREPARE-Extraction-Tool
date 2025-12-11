import classNames from 'classnames';

import Button from "components/Button";
import PrepareLogo from '../../assets/images/prepare_lo....svg';

import styles from './styles.module.css';

// ====================================
// Interface
// ====================================

type User = {
    name: string;
};

export interface HeaderProps {
    user?: User;
    onLogin?: () => void;
    onLogout?: () => void;
    onCreateAccount?: () => void;
}

// ====================================
// Component
// ====================================

const Header = ({ user, onLogin, onLogout, onCreateAccount }: HeaderProps) => (
    <header>
        <div className={classNames(styles.header)}>
            <div>
                <img src={PrepareLogo} alt="Prepare Rehab Logo" style={{ width: 32, height: 32 }} />
                <h1>PREPARE REHAB</h1>
            </div>
            <div>
                {user ? (
                    <>
                        <span className={styles.welcome}>
                            Welcome, <b>{user.name}</b>!
                        </span>
                        <Button size="small" onClick={onLogout} label="Log out" />
                    </>
                ) : (
                    <>
                        <Button size="small" onClick={onLogin} label="Log in" />
                        <Button primary size="small" onClick={onCreateAccount} label="Sign up" />
                    </>
                )}
            </div>
        </div>
    </header>
);

export default Header;