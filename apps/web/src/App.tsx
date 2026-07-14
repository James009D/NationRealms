import { Navigate, Route, Routes } from "react-router-dom";
import { AgentsPage } from "./pages/AgentsPage";
import { DevelopmentPage } from "./pages/DevelopmentPage";
import { EventsPage } from "./pages/EventsPage";
import { FeedPage } from "./pages/FeedPage";
import { LandingPage } from "./pages/LandingPage";
import { MilitaryPage } from "./pages/MilitaryPage";
import { NationCreationPage } from "./features/nationCreation/NationCreationPage";
import { NationProfilePage } from "./pages/NationProfilePage";
import { NewsPage } from "./pages/NewsPage";
import { PostDetailPage } from "./pages/PostDetailPage";
import { AuthPage } from "./pages/AuthPage";
import { TechnologyPage } from "./pages/TechnologyPage";
import { AppShell } from "./components/app-shell/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { SettlementsPage } from "./pages/SettlementsPage";
import { SettlementPage } from "./pages/SettlementPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/create-nation" element={<NationCreationPage />} />
      <Route path="/feed" element={<FeedPage />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/demo" element={<Navigate to="/nation/demo-nation" replace />} />
      <Route path="/nation/:id" element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="profile" element={<NationProfilePage />} />
        <Route path="feed" element={<FeedPage />} />
        <Route path="news" element={<NewsPage />} />
        <Route path="news/:postId" element={<PostDetailPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="technology" element={<TechnologyPage />} />
        <Route path="map" element={<Navigate to="..?focus=map" relative="path" replace />} />
        <Route path="development" element={<DevelopmentPage />} />
        <Route path="settlements" element={<SettlementsPage />} />
        <Route path="settlements/:settlementId" element={<SettlementPage />} />
        <Route path="expansion" element={<Navigate to="..?focus=map" relative="path" replace />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="military" element={<MilitaryPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
