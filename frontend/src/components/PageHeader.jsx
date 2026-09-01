import logo from '../assets/logo.png';
import './PageHeader.css';

export default function PageHeader({ step, title, subtitle }) {
  return (
    <header className="page-header">
      <div className="page-header__wrapper">
        <div className="page-header__logo-section">
          <img className="page-header__logo" src={logo} alt="Company logo" />
        </div>
        <div className="page-header__content">
          {step && <span className="page-header__step">{step}</span>}
          <h1 className="page-header__title">{title}</h1>
          {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
        </div>
      </div>
    </header>
  );
}
