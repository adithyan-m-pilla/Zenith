import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Brain, BookOpen, Timer, BarChart3, Trophy, Menu, LogOut, Settings, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();
  const [showSettings, setShowSettings] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.display_name) setDisplayName(data.display_name);
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated" });
      setShowSettings(false);
    }
  };

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

      {/* Settings panel */}
      {showSettings && (
        <div className="glass-card p-4 mb-2 animate-fade-in space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Profile Settings</p>
            <button onClick={() => setShowSettings(false)}>
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Email</label>
            <p className="text-sm text-foreground truncate">{user?.email}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Display Name</label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <Button size="sm" className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      )}

      {/* Settings button */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200"
      >
        <Settings className="w-5 h-5" />
        Settings
      </button>

      <div className="glass-card p-4">
        <p className="text-xs text-muted-foreground mb-1">Daily Goal</p>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: "65%" }} />
        </div>
        <p className="text-xs text-muted-foreground mt-1">3.2 / 5 hrs</p>
      </div>

      <button
        onClick={signOut}
        className="flex items-center gap-3 px-3 py-2.5 mt-2 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200"
      >
        <LogOut className="w-5 h-5" />
        Sign Out
      </button>
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
