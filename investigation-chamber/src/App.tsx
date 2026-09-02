import { Routes, Route } from 'react-router-dom';
import Shell from './components/layout/Shell';
import DashboardPage from './pages/DashboardPage';
import CasesListPage from './pages/CasesListPage';
import CaseDetailPage from './pages/CaseDetailPage';
import DefendantProfilePage from './pages/DefendantProfilePage';

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/cases" element={<CasesListPage />} />
        <Route path="/cases/:caseId" element={<CaseDetailPage />} />
        <Route path="/cases/:caseId/defendants/:defendantId" element={<DefendantProfilePage />} />
      </Routes>
    </Shell>
  );
}
