import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppSidebar from "@/components/layout/AppSidebar";
import Index from "./pages/Index";
import AITutor from "./pages/AITutor";
import Syllabus from "./pages/Syllabus";
import Pomodoro from "./pages/Pomodoro";
import Analytics from "./pages/Analytics";
import Rewards from "./pages/Rewards";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="flex min-h-screen">
          <AppSidebar />
          <main className="flex-1 md:ml-64 p-6 pt-16 md:pt-6">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/ai-tutor" element={<AITutor />} />
              <Route path="/syllabus" element={<Syllabus />} />
              <Route path="/pomodoro" element={<Pomodoro />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/rewards" element={<Rewards />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
