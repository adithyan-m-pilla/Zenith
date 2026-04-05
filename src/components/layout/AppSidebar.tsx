import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Brain, BookOpen, Timer, BarChart3, Trophy, Menu, LogOut } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo.png";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/ai-tutor", icon: Brain, label: "AI Tutor" },
  { to: "/syllabus", icon: BookOpen, label: "Syllabus" },
  { to: "/pomodoro", icon: Timer, label: "Pomodoro" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/rewards", icon: Trophy, label: "Rewards" },
];

const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => {
  const location = useLocation();
  const { signOut, user } = useAuth();

  return (
    <>
      <div className="flex items-center gap-3 px-3 py-4 mb-6">
        <img src={logo} alt="Zenith logo" className="w-10 h-10 rounded-xl object-cover" />
        <h1 className="font-heading text-xl font-bold text-foreground">Zenith</h1>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-accent text-accent-foreground glow-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          );
        })}
      </nav>

      <div className="glass-card p-4 mt-auto">
        <p className="text-xs text-muted-foreground mb-1">Daily Goal</p>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: "65%" }} />
        </div>
        <p className="text-xs text-muted-foreground mt-1">3.2 / 5 hrs</p>
      </div>
    </>
  );
};

const AppSidebar = () => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-sidebar border border-sidebar-border"
        >
          <Menu className="w-5 h-5 text-foreground" />
        </button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-64 bg-sidebar border-sidebar-border p-4 flex flex-col">
            <SidebarContent onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col p-4 z-50">
      <SidebarContent />
    </aside>
  );
};

export default AppSidebar;
