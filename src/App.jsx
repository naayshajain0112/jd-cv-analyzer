import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Navbar from './components/Navbar';
import Stepper from './components/Stepper';

import UploadJD from './pages/UploadJD';
import ReviewJD from './pages/ReviewJD';
import UploadResume from './pages/UploadResume';
import Report from './pages/Report';

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Stepper />

      <Routes>
        <Route path="/" element={<UploadJD />} />
        <Route path="/review" element={<ReviewJD />} />
        <Route path="/upload-resume" element={<UploadResume />} />
        <Route path="/report" element={<Report />} />
      </Routes>
    </BrowserRouter>
  );
}
