import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Brain, BookOpen, Timer, BarChart3, Trophy, Menu, LogOut, Settings, X, Users } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAppTheme, THEMES } from "@/contexts/ThemeContext";
import logo from "@/assets/logo.png";

const getLocalDateKey = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/ai-tutor", icon: Brain, label: "AI Tutor" },
  { to: "/syllabus", icon: BookOpen, label: "Syllabus" },
  { to: "/pomodoro", icon: Timer, label: "Pomodoro" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/rewards", icon: Trophy, label: "Rewards" },
  { to: "/friends", icon: Users, label: "Friends" },
];

const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const [showSettings, setShowSettings] = useState(false);
  const { theme, setTheme } = useAppTheme();
  const [displayName, setDisplayName] = useState("");
  const [dailyGoalHours, setDailyGoalHours] = useState(5);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [studiedToday, setStudiedToday] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const loadDailyGoal = async () => {
      const [{ data: profile }, { data: total }] = await Promise.all([
        supabase
      .from("profiles")
      .select("display_name, daily_goal_hours")
      .eq("user_id", user.id)
      .maybeSingle(),
        supabase
          .from("study_daily_totals")
          .select("total_minutes")
          .eq("user_id", user.id)
          .eq("study_date", getLocalDateKey())
          .maybeSingle(),
      ]);
      if (cancelled) return;
      if (profile?.display_name) setDisplayName(profile.display_name);
      if (profile?.daily_goal_hours) setDailyGoalHours(Number(profile.daily_goal_hours));
      const totalMin = Math.min(1440, Math.max(0, Math.floor(Number(total?.total_minutes || 0))));
      setStudiedToday(Math.round((totalMin / 60) * 10) / 10);
    };

    loadDailyGoal();
    window.addEventListener("zenith:study-update", loadDailyGoal);
    return () => {
      cancelled = true;
      window.removeEventListener("zenith:study-update", loadDailyGoal);
    };
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, daily_goal_hours: dailyGoalHours })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated" });
      setShowSettings(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  const goalPercent = dailyGoalHours > 0 ? Math.min(100, Math.round((studiedToday / dailyGoalHours) * 100)) : 0;

  return (
    <>
      <div className="flex items-center gap-3 px-3 py-4 mb-4 sm:mb-6">
        <img src={logo} alt="Zenith logo" className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover" />
        <h1 className="font-heading text-lg sm:text-xl font-bold text-primary">Zenith</h1>
      </div>

      <nav className="flex-1 space-y-0.5 sm:space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2 sm:py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
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

      {showSettings && (
        <div className="glass-card p-3 sm:p-4 mb-2 animate-fade-in space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Profile Settings</p>
            <button onClick={() => setShowSettings(false)}>
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Email</label>
            <p className="text-xs sm:text-sm text-foreground truncate">{user?.email}</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Display Name</label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Daily Goal (hours)</label>
            <Input
              type="number"
              min={1}
              max={24}
              value={dailyGoalHours}
              onChange={(e) => setDailyGoalHours(Number(e.target.value))}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-2">App Theme</label>
            <div className="grid grid-cols-2 gap-1.5">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`flex items-center gap-2 p-1.5 rounded-lg border text-left transition-all ${theme === t.id ? "border-primary bg-accent" : "border-border hover:border-muted-foreground/40"}`}
                  title={t.name}
                >
                  <div className="flex -space-x-1">
                    {t.swatch.map((c, i) => (
                      <span key={i} className="w-3.5 h-3.5 rounded-full border border-background" style={{ background: c }} />
                    ))}
                  </div>
                  <span className="text-[10px] text-foreground truncate">{t.name}</span>
                </button>
              ))}
            </div>
          </div>
          <Button size="sm" className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      )}

      <button
        onClick={() => setShowSettings(!showSettings)}
        className="flex items-center gap-3 px-3 py-2 sm:py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200"
      >
        <Settings className="w-5 h-5" />
        Settings
      </button>

      <div className="glass-card p-3 sm:p-4">
        <p className="text-xs text-muted-foreground mb-1">Daily Goal</p>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${goalPercent}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-1">{studiedToday} / {dailyGoalHours} hrs</p>
      </div>

      <button
        onClick={handleSignOut}
        disabled={signingOut}
        className="flex items-center gap-3 px-3 py-2 sm:py-2.5 mt-2 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200 disabled:opacity-50"
      >
        <LogOut className="w-5 h-5" />
        {signingOut ? "Signing out..." : "Sign Out"}
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
