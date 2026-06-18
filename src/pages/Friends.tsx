import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Users, UserPlus, Copy, Check, Trophy, Clock, X as XIcon } from "lucide-react";

type Profile = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  invite_code: string | null;
  avatar_url: string | null;
};

type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
};

const periodStart = (period: "day" | "week" | "month") => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === "week") {
    const day = (d.getDay() + 6) % 7; // Monday-start
    d.setDate(d.getDate() - day);
  } else if (period === "month") {
    d.setDate(1);
  }
  return d;
};

export default function Friends() {
  const { user } = useAuth();
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

  const inviteLink = useMemo(() => {
    if (!me?.invite_code) return "";
    return `${window.location.origin}/friends?invite=${me.invite_code}`;
  }, [me]);

  const loadAll = async () => {
    if (!user) return;
    const { data: myProfile } = await supabase
      .from("profiles")
      .select("user_id, display_name, username, invite_code, avatar_url")
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
        .select("user_id, display_name, username, invite_code, avatar_url")
        .in("user_id", otherIds);
      const map: Record<string, Profile> = {};
      (ps || []).forEach((p: any) => (map[p.user_id] = p));
      setProfilesById(map);

      const accepted = fsList.filter((f) => f.status === "accepted");
      const friendIds = accepted.map((f) => (f.requester_id === user.id ? f.addressee_id : f.requester_id));
      const ids = [user.id, ...friendIds];
      const monthStart = periodStart("month");
      const { data: ss } = await supabase
        .from("study_sessions")
        .select("user_id, duration_minutes, completed_at, session_type")
        .in("user_id", ids)
        .gte("completed_at", monthStart.toISOString());
      setSessions((ss || []) as any);
    } else {
      setProfilesById({});
      setSessions([]);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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
        .select("user_id, display_name, username, invite_code, avatar_url")
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
      .select("user_id, display_name, username, invite_code, avatar_url")
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
    sessions.forEach((s) => {
      if (new Date(s.completed_at) < start) return;
      if (totals[s.user_id] !== undefined) totals[s.user_id] += s.duration_minutes || 0;
    });
    return Object.entries(totals)
      .map(([uid, minutes]) => ({
        uid,
        minutes,
        name:
          uid === user.id
            ? (me?.display_name || "You") + " (you)"
            : profilesById[uid]?.display_name || profilesById[uid]?.username || "Friend",
        username: uid === user.id ? me?.username : profilesById[uid]?.username,
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [accepted, sessions, period, profilesById, me, user]);

  const fmt = (m: number) => {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return h ? `${h}h ${mm}m` : `${mm}m`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Users className="w-7 h-7 text-primary" />
        <h1 className="font-heading text-2xl sm:text-3xl font-bold">Friends</h1>
      </div>

      {/* Username + invite */}
      <Card className="p-5 space-y-4">
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
              {savingUsername ? "Saving..." : "Save"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">3-20 characters. Letters, numbers, underscore.</p>
        </div>

        {me?.invite_code && (
          <div>
            <p className="text-sm font-semibold mb-2">Your invite link</p>
            <div className="flex gap-2">
              <Input value={inviteLink} readOnly className="flex-1 text-xs" />
              <Button variant="outline" onClick={copyInvite}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Add friend */}
      <Card className="p-5 space-y-3">
        <p className="text-sm font-semibold">Add a friend by username</p>
        <div className="flex gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="search username..."
          />
          <Button onClick={runSearch} disabled={searching}>
            <UserPlus className="w-4 h-4 mr-1" />
            Search
          </Button>
        </div>
        {searchResults.length > 0 && (
          <div className="space-y-2">
            {searchResults.map((p) => (
              <div key={p.user_id} className="flex items-center justify-between p-2 rounded-md bg-muted/40">
                <div>
                  <p className="text-sm font-medium">{p.display_name}</p>
                  <p className="text-xs text-muted-foreground">@{p.username}</p>
                </div>
                <Button size="sm" onClick={() => sendRequest(p.user_id)}>Add</Button>
              </div>
            ))}
          </div>
        )}
      </Card>

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

      {/* Leaderboard */}
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
                    <p className="text-sm font-medium">{row.name}</p>
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

      {/* Friends list with stats */}
      {accepted.length > 0 && (
        <Card className="p-5 space-y-3">
          <p className="text-sm font-semibold">Your friends ({accepted.length})</p>
          {accepted.map((f) => {
            const fid = f.requester_id === user?.id ? f.addressee_id : f.requester_id;
            const p = profilesById[fid];
            const todayStart = periodStart("day");
            const todayMin = sessions
              .filter((s) => s.user_id === fid && new Date(s.completed_at) >= todayStart)
              .reduce((a, s) => a + (s.duration_minutes || 0), 0);
            return (
              <div key={f.id} className="flex items-center justify-between p-3 rounded-md bg-muted/40">
                <div>
                  <p className="text-sm font-medium">{p?.display_name}</p>
                  <p className="text-xs text-muted-foreground">@{p?.username} • {fmt(todayMin)} today</p>
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
