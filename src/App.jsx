import { Routes, Route } from "react-router-dom";
import { Header } from "./components/Header.jsx";
import { Footer } from "./components/Footer.jsx";
import { BottomNav } from "./components/BottomNav.jsx";
import { ProtectedRoute, RequireAdmin } from "./components/ProtectedRoute.jsx";

import { HomePage } from "./pages/HomePage.jsx";
import { SeriesListPage } from "./pages/SeriesListPage.jsx";
import { MoviesListPage } from "./pages/MoviesListPage.jsx";
import { TitleDetailPage } from "./pages/TitleDetailPage.jsx";
import { AnnouncementsPage } from "./pages/AnnouncementsPage.jsx";
import { AnnouncementDetailPage } from "./pages/AnnouncementDetailPage.jsx";
import { UpcomingPage } from "./pages/UpcomingPage.jsx";
import { AiringPage } from "./pages/AiringPage.jsx";
import { MyListPage } from "./pages/MyListPage.jsx";
import { ProfilePage } from "./pages/ProfilePage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { SignupPage } from "./pages/SignupPage.jsx";
import { NotFoundPage } from "./pages/NotFoundPage.jsx";

import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage.jsx";
import { AdminReviewPage } from "./pages/admin/AdminReviewPage.jsx";
import { AdminSourcesPage } from "./pages/admin/AdminSourcesPage.jsx";
import { AdminAnnouncementsPage } from "./pages/admin/AdminAnnouncementsPage.jsx";
import { AdminCrawlerPage } from "./pages/admin/AdminCrawlerPage.jsx";

export default function App() {
  return (
    <div className="flex min-h-screen flex-col font-ui">
      <Header />
      <main className="flex-1 pb-16 md:pb-0">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/series" element={<SeriesListPage />} />
          <Route path="/series/:slug" element={<TitleDetailPage type="series" />} />
          <Route path="/movies" element={<MoviesListPage />} />
          <Route path="/movies/:slug" element={<TitleDetailPage type="movie" />} />
          <Route path="/announcements" element={<AnnouncementsPage />} />
          <Route path="/announcements/:slug" element={<AnnouncementDetailPage />} />
          <Route path="/upcoming" element={<UpcomingPage />} />
          <Route path="/airing" element={<AiringPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route
            path="/my-list"
            element={
              <ProtectedRoute>
                <MyListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminDashboardPage />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/review"
            element={
              <RequireAdmin>
                <AdminReviewPage />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/sources"
            element={
              <RequireAdmin>
                <AdminSourcesPage />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/announcements"
            element={
              <RequireAdmin>
                <AdminAnnouncementsPage />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/crawler"
            element={
              <RequireAdmin>
                <AdminCrawlerPage />
              </RequireAdmin>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
