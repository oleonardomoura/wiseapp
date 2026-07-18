import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuthContext } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";

import LoginPage from "@/pages/LoginPage";
import AuthCallbackPage from "@/pages/AuthCallbackPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import NotFound from "@/pages/NotFound";

// Student pages
import StudentDashboard from "@/pages/student/Dashboard";
import CoursePage from "@/pages/student/CoursePage";
import FlashcardsPage from "@/pages/student/FlashcardsPage";
import TextsWithAudioPage from "@/pages/student/TextsWithAudioPage";
import CommunityPage from "@/pages/student/CommunityPage";
import AchievementsPage from "@/pages/student/AchievementsPage";
import MyAccountPage from "@/pages/student/MyAccountPage";
import NotificationsPage from "@/pages/student/NotificationsPage";
import LivesPage from "@/pages/student/LivesPage";
import ConversationGroupsPage from "@/pages/student/ConversationGroupsPage";
import SupportPage from "@/pages/student/SupportPage";

// Teacher pages
import TeacherDashboard from "@/pages/teacher/TeacherDashboard";
import ClassesPage from "@/pages/teacher/ClassesPage";
import LessonPlanPage from "@/pages/teacher/LessonPlanPage";
import RegisterStudentPage from "@/pages/teacher/RegisterStudentPage";
import TeacherProgressPage from "@/pages/teacher/TeacherProgressPage";

// Admin pages
import AdminDashboard from "@/pages/admin/AdminDashboard";

const queryClient = new QueryClient();

const RoleHomeRedirect = () => {
  const { role } = useAuthContext();
  if (role === "teacher") return <Navigate to="/teacher" replace />;
  if (role === "admin") return <Navigate to="/admin" replace />;
  return <StudentDashboard />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Protected routes with layout */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              {/* Student */}
              <Route path="/" element={<RoleHomeRedirect />} />
              <Route path="/course" element={<ProtectedRoute allowedRoles={['student', 'admin']}><CoursePage /></ProtectedRoute>} />
              <Route path="/flashcards" element={<ProtectedRoute allowedRoles={['student', 'admin']}><FlashcardsPage /></ProtectedRoute>} />
              <Route path="/texts-with-audio" element={<ProtectedRoute allowedRoles={['student', 'admin']}><TextsWithAudioPage /></ProtectedRoute>} />
              <Route path="/community" element={<ProtectedRoute allowedRoles={['student', 'admin']}><CommunityPage /></ProtectedRoute>} />
              <Route path="/achievements" element={<ProtectedRoute allowedRoles={['student', 'admin']}><AchievementsPage /></ProtectedRoute>} />
              <Route path="/my-account" element={<MyAccountPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/lives" element={<ProtectedRoute allowedRoles={['student', 'admin']}><LivesPage /></ProtectedRoute>} />
              <Route path="/conversation-groups" element={<ProtectedRoute allowedRoles={['student', 'admin']}><ConversationGroupsPage /></ProtectedRoute>} />
              <Route path="/support" element={<SupportPage />} />

              {/* Teacher */}
              <Route path="/teacher" element={<ProtectedRoute allowedRoles={['teacher', 'admin']}><TeacherDashboard /></ProtectedRoute>} />
              <Route path="/teacher/classes" element={<ProtectedRoute allowedRoles={['teacher', 'admin']}><ClassesPage /></ProtectedRoute>} />
              <Route path="/teacher/progress" element={<ProtectedRoute allowedRoles={['teacher', 'admin']}><TeacherProgressPage /></ProtectedRoute>} />
              <Route path="/teacher/lesson-plan/:className" element={<ProtectedRoute allowedRoles={['teacher', 'admin']}><LessonPlanPage /></ProtectedRoute>} />
              <Route path="/teacher/students/register" element={<ProtectedRoute allowedRoles={['teacher', 'admin']}><RegisterStudentPage /></ProtectedRoute>} />

              {/* Admin */}
              <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
