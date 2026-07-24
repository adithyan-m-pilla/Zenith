import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePomodoro } from "@/contexts/PomodoroContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Users, UserPlus, Copy, Check, Trophy, Clock, X as XIcon, Settings, Search } from "lucide-react";

type Profile = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  invite_code: string | null;
  avatar_url: string | null;
  is_studying?: boolean | null;
  studying_since?: string | null;
};

// Consider a friend "studying" only if they started within the last 24h (guards against stale flags)
const isActivelyStudying = (p?: Profile | null) => {
  if (!p?.is_studying || !p.studying_since) return false;
  return Date.now() - new Date(p.studying_since).getTime() < 24 * 60 * 60 * 1000;
};

type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
};

const periodStart = (period: "day" | "week" | "month") => {
  // Use UTC boundaries so every viewer sees the same total for the same friend.
  // (If we used the viewer's local midnight, a friend's session logged before
  // the viewer's midnight but after the friend's midnight would be dropped —
  // meaning the same friend could appear with different totals to different
  // viewers in different timezones.)
  const d = new Date();
  if (period === "day") {
    d.setUTCHours(0, 0, 0, 0);
  } else if (period === "week") {
    d.setUTCHours(0, 0, 0, 0);
    const day = (d.getUTCDay() + 6) % 7; // Monday-start
    d.setUTCDate(d.getUTCDate() - day);
  } else {
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(1);
  }
  return d;
};

export default function Friends() {
  const { user } = useAuth();
  const { running: pomoRunning, mode: pomoModeType, swRunning } = usePomodoro();
  const meIsStudying = (pomoRunning && pomoModeType === "work") || swRunning;
  const { toast } = useToast();
  const [me, setMe] = useState<Profile | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [sessions, setSessions] = useState<Array<{ user_id: string; duration_minutes: number; completed_at: string; session_type: string | null }>>([]);
  const [copied, setCopied] = useState(false);
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const [now, setNow] = useState(Date.now()); // For live study time updates

  const inviteLink = useMemo(() => {
    if (!me?.invite_code) return "";
    return `${window.location.origin}/friends?invite=${me.invite_code}`;
  }, [me]);

  const loadAll = useCallback(async () => {
    if (!user) return;
    const { data: myProfile } = await supabase
      .from("profiles")
      .select("user_id, display_name, username, invite_code, avatar_url, is_studying, studying_since")
      .eq("user_id", user.id)
      .maybeSingle();
    if (myProfile) {
      setMe(myProfile as Profile);
      setUsernameInput(myProfile.username || "");
    }

    const { data: fs } = await supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    const fsList = (fs || []) as Friendship[];
    setFriendships(fsList);

    const otherIds = Array.from(
      new Set(fsList.map((f) => (f.requester_id === user.id ? f.addressee_id : f.requester_id)))
    );
    if (otherIds.length) {
      const { data: ps } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, invite_code, avatar_url, is_studying, studying_since")
        .in("user_id", otherIds);
      const map: Record<string, Profile> = {};
      (ps || []).forEach((p: any) => (map[p.user_id] = p));
      setProfilesById(map);
    } else {
      setProfilesById({});
    }

    // Always fetch sessions for current user + accepted friends so the leaderboard
    // shows the user's own study time even when they have no friends yet.
    const accepted = fsList.filter((f) => f.status === "accepted");
    const friendIds = accepted.map((f) => (f.requester_id === user.id ? f.addressee_id : f.requester_id));
    const ids = [user.id, ...friendIds];
    const monthStart = periodStart("month");
    const { data: ss, error: sessError } = await supabase
      .from("study_sessions")
      .select("user_id, duration_minutes, completed_at, session_type")
      .in("user_id", ids)
      .gte("completed_at", monthStart.toISOString());
    if (sessError) {
      console.error("Failed to fetch sessions:", sessError);
    }
    setSessions((ss || []) as any);
  }, [user]);

  useEffect(() => {
    loadAll();
    if (!user) return;

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        loadAll();
      }
    };

    const onStudyUpdate = () => {
      loadAll();
    };

    window.addEventListener("focus", loadAll);
    window.addEventListener("visibilitychange", onVisible);
    window.addEventListener("zenith:study-update", onStudyUpdate);

    // Update every 1 second for live study time tracking
    const updateInterval = window.setInterval(() => setNow(Date.now()), 1000);
    // Poll frequently so friends' saved study time appears quickly after they finish a session
    const id = window.setInterval(loadAll, 10_000);

    // Realtime: refresh whenever any study_sessions row is inserted/updated,
    // or any profile studying flag changes. Cheap filter happens in loadAll.
    const channel = supabase
      .channel("friends-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "study_sessions" }, () => loadAll())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => loadAll())
      .subscribe();

    return () => {
      window.removeEventListener("focus", loadAll);
      window.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("zenith:study-update", onStudyUpdate);
      clearInterval(id);
      clearInterval(updateInterval);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loadAll]);

  // Auto-add from invite link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("invite");
    if (!code || !user || !me) return;
    if (me.invite_code === code) {
      window.history.replaceState({}, "", "/friends");
      return;
    }
    (async () => {
      const { data: target } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, invite_code, avatar_url, is_studying, studying_since")
        .eq("invite_code", code)
        .maybeSingle();
      window.history.replaceState({}, "", "/friends");
      if (!target) {
        toast({ title: "Invalid invite link", variant: "destructive" });
        return;
      }
      await sendRequest(target.user_id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, me?.invite_code]);

  const saveUsername = async () => {
    if (!user) return;
    const u = usernameInput.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(u)) {
      toast({ title: "Invalid username", description: "3-20 chars, letters/numbers/underscore.", variant: "destructive" });
      return;
    }
    setSavingUsername(true);
    const { error } = await supabase.from("profiles").update({ username: u }).eq("user_id", user.id);
    setSavingUsername(false);
    if (error) {
      toast({ title: "Could not save", description: error.message.includes("duplicate") ? "Username taken" : error.message, variant: "destructive" });
    } else {
      toast({ title: "Username saved" });
      loadAll();
    }
  };

  const runSearch = async () => {
    const q = search.trim().toLowerCase();
    if (!q || !user) return;
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name, username, invite_code, avatar_url, is_studying, studying_since")
      .ilike("username", `%${q}%`)
      .neq("user_id", user.id)
      .limit(10);
    setSearchResults((data || []) as Profile[]);
    setSearching(false);
  };

  const sendRequest = async (targetId: string) => {
    if (!user) return;
    const existing = friendships.find(
      (f) =>
        (f.requester_id === user.id && f.addressee_id === targetId) ||
        (f.addressee_id === user.id && f.requester_id === targetId)
    );
    if (existing) {
      toast({ title: existing.status === "accepted" ? "Already friends" : "Request already pending" });
      return;
    }
    const { error } = await supabase
      .from("friendships")
      .insert({ requester_id: user.id, addressee_id: targetId, status: "pending" });
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Friend request sent" });
      loadAll();
    }
  };

  const accept = async (id: string) => {
    const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else loadAll();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("friendships").delete().eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else loadAll();
  };

  const copyInvite = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const incoming = friendships.filter((f) => f.status === "pending" && f.addressee_id === user?.id);
  const outgoing = friendships.filter((f) => f.status === "pending" && f.requester_id === user?.id);
  const accepted = friendships.filter((f) => f.status === "accepted");

  const leaderboard = useMemo(() => {
    if (!user) return [];
    const start = periodStart(period);
    const totals: Record<string, number> = { [user.id]: 0 };
    accepted.forEach((f) => {
      const fid = f.requester_id === user.id ? f.addressee_id : f.requester_id;
      totals[fid] = 0;
    });
    let includedCount = 0;
    sessions.forEach((s) => {
      const sDate = new Date(s.completed_at);
      if (sDate < start) return;
      includedCount++;
      if (totals[s.user_id] !== undefined) {
        // Defensive: floor + cap per-row to guard against corrupted rows
        const d = Math.min(1440, Math.max(0, Math.floor(s.duration_minutes || 0)));
        totals[s.user_id] += d;
      }
    });
    return Object.entries(totals)
      .map(([uid, minutes]) => {
        const isMe = uid === user.id;
        const profile = isMe ? me : profilesById[uid];
        // For current user, trust local timer state; for friends, use DB flag (with 2h staleness guard)
        const studying = isMe ? meIsStudying : isActivelyStudying(profile);
        // Use the DB-summed minutes as the source of truth so the current
        // user and every friend see the same number for the same person.
        // (Previously we mixed in the local `studiedTodayMin` which used a
        // different day boundary and caused mismatches across viewers.)
        const baseMinutes = minutes;
        // Add live elapsed time if actively studying (cap at 24h safety)
        let liveMinutes = baseMinutes;
        if (studying && profile?.studying_since) {
          const elapsedMs = now - new Date(profile.studying_since).getTime();
          const elapsedMins = Math.min(1440, Math.max(0, Math.floor(elapsedMs / 1000 / 60)));
          liveMinutes = baseMinutes + elapsedMins;
        }
        return {
          uid,
          minutes: Math.floor(liveMinutes),
          name:
            isMe
              ? (me?.display_name || "You") + " (you)"
              : profile?.display_name || profile?.username || "Friend",
          username: isMe ? me?.username : profile?.username,
          studying,
        };
      })
      .sort((a, b) => b.minutes - a.minutes);
  }, [accepted, sessions, period, profilesById, me, user, now, meIsStudying]);

  const fmt = (m: number) => {
    const total = Math.floor(m);
    const h = Math.floor(total / 60);
    const mm = total % 60;
    return h ? `${h}h ${mm}m` : `${mm}m`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Users className="w-7 h-7 text-primary" />
          <h1 className="font-heading text-2xl sm:text-3xl font-bold">Friends</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Search popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="icon" variant="outline" aria-label="Search friends">
                <Search className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-3">
              <p className="text-sm font-semibold">Find a friend</p>
              <div className="flex gap-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
                  placeholder="search username..."
                  autoFocus
                />
                <Button size="icon" onClick={runSearch} disabled={searching} aria-label="Search">
                  <Search className="w-4 h-4" />
                </Button>
              </div>
              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-72 overflow-auto">
                  {searchResults.map((p) => (
                    <div key={p.user_id} className="flex items-center justify-between p-2 rounded-md bg-muted/40">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.display_name}</p>
                        <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
                      </div>
                      <Button size="sm" onClick={() => sendRequest(p.user_id)}>
                        <UserPlus className="w-4 h-4 mr-1" />Add
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Settings popover (username + invite) */}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="icon" variant="outline" aria-label="Friend settings">
                <Settings className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-4">
              <div>
                <p className="text-sm font-semibold mb-2">Your username</p>
                <div className="flex gap-2">
                  <div className="flex items-center px-3 rounded-md border border-input bg-background text-muted-foreground text-sm">@</div>
                  <Input
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="yourname"
                    className="flex-1"
                  />
                  <Button onClick={saveUsername} disabled={savingUsername}>
                    {savingUsername ? "..." : "Save"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">3-20 chars. Letters, numbers, underscore.</p>
              </div>
              {me?.invite_code && (
                <div>
                  <p className="text-sm font-semibold mb-2">Invite link</p>
                  <div className="flex gap-2">
                    <Input value={inviteLink} readOnly className="flex-1 text-xs" />
                    <Button variant="outline" size="icon" onClick={copyInvite}>
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Requests */}
      {(incoming.length > 0 || outgoing.length > 0) && (
        <Card className="p-5 space-y-3">
          <p className="text-sm font-semibold">Requests</p>
          {incoming.map((f) => {
            const p = profilesById[f.requester_id];
            return (
              <div key={f.id} className="flex items-center justify-between p-2 rounded-md bg-muted/40">
                <div>
                  <p className="text-sm font-medium">{p?.display_name || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">@{p?.username} wants to be friends</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => accept(f.id)}>Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => remove(f.id)}>Decline</Button>
                </div>
              </div>
            );
          })}
          {outgoing.map((f) => {
            const p = profilesById[f.addressee_id];
            return (
              <div key={f.id} className="flex items-center justify-between p-2 rounded-md bg-muted/40">
                <p className="text-sm text-muted-foreground">Pending: @{p?.username}</p>
                <Button size="sm" variant="ghost" onClick={() => remove(f.id)}>
                  <XIcon className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </Card>
      )}

      {/* Leaderboard (top) */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          <p className="text-sm font-semibold">Leaderboard</p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as any)}>
          <TabsList>
            <TabsTrigger value="day">Today</TabsTrigger>
            <TabsTrigger value="week">This Week</TabsTrigger>
            <TabsTrigger value="month">This Month</TabsTrigger>
          </TabsList>
          <TabsContent value={period} className="mt-4 space-y-2">
            {leaderboard.length === 0 && (
              <p className="text-sm text-muted-foreground">Add friends to see the leaderboard.</p>
            )}
            {leaderboard.map((row, i) => (
              <div
                key={row.uid}
                className={`flex items-center justify-between p-3 rounded-md ${
                  i === 0 ? "bg-primary/10 border border-primary/30" : "bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                    i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}>
                    {i + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{row.name}</p>
                      {row.studying && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" title="Studying now"></span>
                        </span>
                      )}
                      {row.studying && (
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-600">
                          studying
                        </span>
                      )}
                    </div>
                    {row.username && <p className="text-xs text-muted-foreground">@{row.username}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-sm font-semibold">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  {fmt(row.minutes)}
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </Card>

      {/* Friends list (below leaderboard) */}
      {accepted.length > 0 && (
        <Card className="p-5 space-y-3">
          <p className="text-sm font-semibold">Your friends ({accepted.length})</p>
          {accepted.map((f) => {
            const fid = f.requester_id === user?.id ? f.addressee_id : f.requester_id;
            const p = profilesById[fid];
            const todayStart = periodStart("day");
            const todayMin = Math.floor(sessions
              .filter((s) => s.user_id === fid && new Date(s.completed_at) >= todayStart)
              .reduce((a, s) => a + Math.min(1440, Math.max(0, Math.floor(s.duration_minutes || 0))), 0));
            const studying = isActivelyStudying(p);
            return (
              <div key={f.id} className="flex items-center justify-between p-3 rounded-md bg-muted/40">
                <div className="flex items-center gap-3">
                  <span className="relative inline-flex">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${studying ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                      title={studying ? "Currently studying" : "Offline"}
                    />
                    {studying && (
                      <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-60" />
                    )}
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      {p?.display_name}
                      {studying && (
                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                          Studying
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">@{p?.username} • {fmt(todayMin)} today</p>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove(f.id)}>
                  <XIcon className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
