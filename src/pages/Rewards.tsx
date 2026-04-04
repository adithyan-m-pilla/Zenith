import { Trophy, Star, Flame, Target, Zap, Award, CheckCircle2, Circle, Sparkles } from "lucide-react";
import { useState, useMemo } from "react";

// Daily challenge pool
const challengePool = [
  "Study for 1 hour straight",
  "Revise today's topic",
  "Complete today's task list",
  "Study 2 subjects, 2 chapters each",
  "Practice 20 MCQs",
  "Revise 3 chapters from last week",
  "Study for 2 hours total",
  "Complete a Pomodoro session",
  "Finish all pending revisions",
  "Read and summarize 1 chapter",
  "Solve 10 practice problems",
  "Study a new chapter from scratch",
  "Revise your weakest subject",
  "Complete 3 Pomodoro cycles",
  "Study without breaks for 45 mins",
  "Review all bookmarked topics",
  "Teach a concept to someone",
  "Write notes for 2 chapters",
  "Attempt a full mock quiz",
  "Study before 8 AM",
];

// 50 levels
const levelNames = [
  "Newcomer", "Curious Mind", "Page Turner", "Note Taker", "Quick Learner",
  "Bookworm", "Focused One", "Steady Pacer", "Sharp Eye", "Deep Thinker",
  "Quiz Whiz", "Chapter Crusher", "Time Master", "Streak Holder", "Brain Spark",
  "Knowledge Seeker", "Iron Will", "Swift Scholar", "Concept King", "Formula Pro",
  "Night Scholar", "Dawn Warrior", "Mind Mapper", "Logic Lord", "Memory Ace",
  "Revision Beast", "Discipline King", "Study Monk", "Grind Master", "Focus Fury",
  "Brain Storm", "Elite Learner", "Titan Mind", "Unstoppable", "Academic Ace",
  "Prodigy", "Grandmaster", "Sage", "Enlightened", "Virtuoso",
  "Mastermind", "Legendary", "Mythical Mind", "Transcendent", "Apex Scholar",
  "Omega Brain", "Universal Sage", "Cosmic Intellect", "Eternal Scholar", "Ascended",
];

const xpPerLevel = (level: number) => 100 + level * 50;

function getDailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  let s = seed;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 16807 + 12345) % 2147483647;
    const j = s % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const Rewards = () => {
  const earned = badges.filter((b) => b.earned).length;

  // XP & Level (demo: stored in state, would persist with backend)
  const [totalXP, setTotalXP] = useState(1270);

  const { level, currentXP, needed } = useMemo(() => {
    let xp = totalXP;
    let lvl = 0;
    while (lvl < 49) {
      const req = xpPerLevel(lvl);
      if (xp < req) break;
      xp -= req;
      lvl++;
    }
    return { level: lvl, currentXP: xp, needed: xpPerLevel(lvl) };
  }, [totalXP]);

  // Daily challenges (seeded by date)
  const dailyChallenges = useMemo(() => {
    return seededShuffle(challengePool, getDailySeed()).slice(0, 5);
  }, []);

  const [completedChallenges, setCompletedChallenges] = useState<Set<number>>(new Set());

  const toggleChallenge = (idx: number) => {
    setCompletedChallenges((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
        setTotalXP((x) => x - 50);
      } else {
        next.add(idx);
        setTotalXP((x) => x + 50);
      }
      return next;
    });
  };

  const pct = Math.min((currentXP / needed) * 100, 100);

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="font-heading text-3xl font-bold text-foreground flex items-center gap-3">
          <Trophy className="w-8 h-8 text-primary" /> Rewards
        </h1>
        <p className="text-muted-foreground mt-1">{earned} of {badges.length} badges earned</p>
      </div>

      {/* Daily Challenges */}
      <div className="glass-card p-5 animate-fade-in">
        <h3 className="font-heading font-semibold text-foreground flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-warning" /> Today's Challenges
          <span className="text-xs text-muted-foreground ml-auto">{completedChallenges.size}/5 • +50 XP each</span>
        </h3>
        <div className="space-y-2">
          {dailyChallenges.map((challenge, idx) => (
            <button
              key={idx}
              onClick={() => toggleChallenge(idx)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left ${
                completedChallenges.has(idx) ? "bg-primary/10 border border-primary/20" : "bg-secondary/50 hover:bg-secondary"
              }`}
            >
              {completedChallenges.has(idx) ? (
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
              )}
              <span className={`text-sm ${completedChallenges.has(idx) ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {challenge}
              </span>
              <span className="text-xs text-primary ml-auto font-medium">+50 XP</span>
            </button>
          ))}
        </div>
      </div>

      {/* Badges */}
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

      {/* XP & Level Bar */}
      <div className="glass-card p-5 animate-fade-in">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
              <Zap className="w-5 h-5 text-warning" />
              Level {level + 1}: {levelNames[level]}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{totalXP} total XP • {currentXP}/{needed} XP to next level</p>
          </div>
          {level < 49 && (
            <span className="text-xs text-muted-foreground">
              Next: <span className="text-primary font-medium">{levelNames[level + 1]}</span>
            </span>
          )}
        </div>
        <div className="w-full h-4 bg-muted rounded-full overflow-hidden relative">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">
            {Math.round(pct)}%
          </span>
        </div>
        <div className="flex justify-between mt-3 text-[10px] text-muted-foreground">
          <span>Lv.{level + 1}</span>
          <span>Lv.{Math.min(level + 2, 50)}</span>
        </div>
      </div>
    </div>
  );
};

export default Rewards;
