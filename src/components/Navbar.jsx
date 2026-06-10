import { NavLink } from 'react-router-dom';
import './Navbar.css';

const navItems = [
  { to: '/',              label: 'Upload JD',     icon: '📄' },
  { to: '/review',        label: 'Review JD',     icon: '✏️' },
  { to: '/upload-resume', label: 'Upload Resume',  icon: '📎' },
  { to: '/report',        label: 'Report',         icon: '📊' },
];

export default function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar__inner container">
        {/* Brand */}
        <NavLink to="/" className="navbar__brand">
          <span className="navbar__logo">⚡</span>
          <span className="navbar__name">
            CV<span className="navbar__name--accent">Match</span>
          </span>
        </NavLink>

        {/* Navigation links */}
        <nav className="navbar__nav">
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `navbar__link ${isActive ? 'navbar__link--active' : ''}`
              }
            >
              <span className="navbar__link-icon">{icon}</span>
              <span className="navbar__link-label">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
