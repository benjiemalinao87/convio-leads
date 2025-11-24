import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Webhooks from "./pages/Webhooks";
import Analytics from "./pages/Analytics";
import Leads from "./pages/Leads";
import ContactDetail from "./pages/ContactDetail";
import Settings from "./pages/Settings";
import Documentation from "./pages/Documentation";
import DocumentationSelection from "./pages/DocumentationSelection";
import Appointments from "./pages/Appointments";
import MermaidTest from "./pages/MermaidTest";
import AdminOnboarding from "./pages/AdminOnboarding";
import SidebarLayoutMockup from "./pages/SidebarLayoutMockup";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <Routes>
            {/* Public route */}
            <Route path="/login" element={<Login />} />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            />
            <Route
              path="/webhooks"
              element={
                <ProtectedRoute>
                  <Webhooks />
                </ProtectedRoute>
              }
            />
            <Route
              path="/contacts"
              element={
                <ProtectedRoute>
                  <Leads />
                </ProtectedRoute>
              }
            />
            <Route
              path="/leads"
              element={<Navigate to="/contacts" replace />}
            />
            <Route
              path="/contact/:contactId"
              element={
                <ProtectedRoute>
                  <ContactDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/appointments"
              element={
                <ProtectedRoute>
                  <Appointments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <Analytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/docs"
              element={
                <ProtectedRoute>
                  <DocumentationSelection />
                </ProtectedRoute>
              }
            />
            <Route
              path="/docs/:docId"
              element={
                <ProtectedRoute>
                  <Documentation />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mermaid-test"
              element={
                <ProtectedRoute>
                  <MermaidTest />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sidebar-mockup"
              element={
                <ProtectedRoute>
                  <SidebarLayoutMockup />
                </ProtectedRoute>
              }
            />

            {/* Public admin onboarding portal */}
            <Route path="/admin/onboarding" element={<AdminOnboarding />} />

            {/* Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
