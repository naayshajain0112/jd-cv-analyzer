import { useLocation } from 'react-router-dom';
import './Stepper.css';

const steps = [
  { path: '/',              label: 'Upload JD',     num: 1 },
  { path: '/review',        label: 'Review JD',     num: 2 },
  { path: '/upload-resume', label: 'Upload Resume',  num: 3 },
  { path: '/report',        label: 'Report',         num: 4 },
];

export default function Stepper() {
  const { pathname } = useLocation();
  const currentIdx = steps.findIndex((s) => s.path === pathname);

  return (
    <div className="stepper container">
      {steps.map((step, i) => {
        const isCompleted = i < currentIdx;
        const isActive    = i === currentIdx;

        return (
          <div key={step.path} className="stepper__fragment">
            {i > 0 && (
              <div
                className={`stepper__line ${isCompleted ? 'completed' : ''}`}
              />
            )}
            <div
              className={`stepper__step ${
                isCompleted ? 'completed' : ''
              } ${isActive ? 'active' : ''}`}
            >
              <span className="stepper__dot">
                {isCompleted ? '✓' : step.num}
              </span>
              <span>{step.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
