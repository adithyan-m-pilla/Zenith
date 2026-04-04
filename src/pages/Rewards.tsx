import { Trophy, Star, Flame, Target, Zap, Award } from "lucide-react";

const badges = [
  { name: "First Steps", desc: "Complete your first chapter", icon: Star, earned: true },
  { name: "5-Day Streak", desc: "Study 5 consecutive days", icon: Flame, earned: true },
  { name: "Consistent Scholar", desc: "4+ hours for 5 days straight", icon: Target, earned: false, progress: 3, total: 5 },
  { name: "Speed Learner", desc: "Complete 10 chapters in a week", icon: Zap, earned: false, progress: 6, total: 10 },
  { name: "Master Mind", desc: "Score 100% on 5 quizzes", icon: Award, earned: false, progress: 2, total: 5 },
  { name: "Night Owl", desc: "Study past midnight 3 times", icon: Star, earned: true },
];

const Rewards = () => {
  const earned = badges.filter((b) => b.earned).length;

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="font-heading text-3xl font-bold text-foreground flex items-center gap-3">
          <Trophy className="w-8 h-8 text-primary" /> Rewards
        </h1>
        <p className="text-muted-foreground mt-1">{earned} of {badges.length} badges earned</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
        {badges.map((badge) => (
          <div
            key={badge.name}
            className={`glass-card p-5 transition-all ${badge.earned ? "glow-primary border-primary/30" : "opacity-70"}`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
              badge.earned ? "bg-primary/20" : "bg-muted"
            }`}>
              <badge.icon className={`w-6 h-6 ${badge.earned ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <h3 className="font-heading font-semibold text-foreground">{badge.name}</h3>
            <p className="text-xs text-muted-foreground mt-1">{badge.desc}</p>
            {!badge.earned && badge.progress !== undefined && (
              <div className="mt-3">
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary/60 rounded-full" style={{ width: `${(badge.progress / badge.total!) * 100}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{badge.progress}/{badge.total}</p>
              </div>
            )}
            {badge.earned && <p className="text-xs text-primary font-medium mt-2">✨ Earned!</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Rewards;
