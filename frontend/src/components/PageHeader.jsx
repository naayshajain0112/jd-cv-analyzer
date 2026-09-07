import logo from '../assets/logo.png';
import './PageHeader.css';

export default function PageHeader({ step, title, subtitle, logoClassName = '' }) {
  return (
    <div className="section-header page-header">
      <div className="page-header__content">
        <p className="section-header__badge">✦ {step}</p>
        <h1 className="section-header__title">{title}</h1>
        <p className="section-header__subtitle">{subtitle}</p>
      </div>
      <img className={`page-header__logo ${logoClassName}`} src={logo} alt="Company logo" />
    </div>
  );
}
