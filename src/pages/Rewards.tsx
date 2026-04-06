import { Trophy, Zap, CheckCircle2, Circle, Sparkles, Clock } from "lucide-react";
import { useState, useMemo, useEffect } from "react";

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

function getTimeUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

function formatCountdown(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const Rewards = () => {
  const [totalXP, setTotalXP] = useState(0);
  const [todayKey, setTodayKey] = useState(getTodayKey);
  const [countdown, setCountdown] = useState(getTimeUntilMidnight());

  // Countdown timer + midnight reset
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = getTimeUntilMidnight();
      setCountdown(remaining);
      const newKey = getTodayKey();
      if (newKey !== todayKey) {
        setTodayKey(newKey);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [todayKey]);

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

  const dailyChallenges = useMemo(() => {
    return seededShuffle(challengePool, getDailySeed()).slice(0, 5);
  }, [todayKey]);

  const [completedChallenges, setCompletedChallenges] = useState<Set<number>>(() => {
    const saved = localStorage.getItem(`zenith-challenges-${getTodayKey()}`);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Reset completed challenges when day changes
  useEffect(() => {
    const saved = localStorage.getItem(`zenith-challenges-${todayKey}`);
    setCompletedChallenges(saved ? new Set(JSON.parse(saved)) : new Set());
  }, [todayKey]);

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
      const arr = Array.from(next);
      localStorage.setItem(`zenith-challenges-${todayKey}`, JSON.stringify(arr));
      return next;
    });
  };

  const pct = Math.min((currentXP / needed) * 100, 100);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="animate-fade-in">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2 sm:gap-3">
          <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-primary" /> Rewards
        </h1>
      </div>

      <div className="glass-card p-4 sm:p-5 animate-fade-in">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <h3 className="font-heading font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-warning" /> Today's Challenges
          </h3>
          <span className="text-xs text-muted-foreground ml-auto flex items-center gap-2">
            {completedChallenges.size}/5 • +50 XP each
            <span className="inline-flex items-center gap-1 bg-secondary px-2 py-0.5 rounded-full text-[10px] font-mono text-primary">
              <Clock className="w-3 h-3" />
              {formatCountdown(countdown)}
            </span>
          </span>
        </div>
        <div className="space-y-2">
          {dailyChallenges.map((challenge, idx) => (
            <button
              key={idx}
              onClick={() => toggleChallenge(idx)}
              className={`w-full flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg transition-all text-left ${
                completedChallenges.has(idx) ? "bg-primary/10 border border-primary/20" : "bg-secondary/50 hover:bg-secondary"
              }`}
            >
              {completedChallenges.has(idx) ? (
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
              ) : (
                <Circle className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground shrink-0" />
              )}
              <span className={`text-xs sm:text-sm flex-1 ${completedChallenges.has(idx) ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {challenge}
              </span>
              <span className="text-[10px] sm:text-xs text-primary ml-auto font-medium shrink-0">+50 XP</span>
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card p-4 sm:p-5 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-1">
          <div>
            <h3 className="font-heading font-semibold text-foreground flex items-center gap-2 text-sm sm:text-base">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-warning" />
              Level {level + 1}: {levelNames[level]}
            </h3>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{totalXP} total XP • {currentXP}/{needed} XP to next level</p>
          </div>
          {level < 49 && (
            <span className="text-[10px] sm:text-xs text-muted-foreground">
              Next: <span className="text-primary font-medium">{levelNames[level + 1]}</span>
            </span>
          )}
        </div>
        <div className="w-full h-3 sm:h-4 bg-muted rounded-full overflow-hidden relative">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
          <span className="absolute inset-0 flex items-center justify-center text-[8px] sm:text-[10px] font-bold text-foreground">
            {Math.round(pct)}%
          </span>
        </div>
        <div className="flex justify-between mt-2 sm:mt-3 text-[10px] text-muted-foreground">
          <span>Lv.{level + 1}</span>
          <span>Lv.{Math.min(level + 2, 50)}</span>
        </div>
      </div>
    </div>
  );
};

export default Rewards;
