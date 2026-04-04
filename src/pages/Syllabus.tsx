import { useState } from "react";
import { Plus, BookOpen, Check, ChevronDown, ChevronRight, CalendarClock } from "lucide-react";
import { REVISION_INTERVALS, getRevisionDueDate, getRevisionLabel } from "@/lib/revision";

interface Chapter {
  id: string;
  name: string;
  completed: boolean;
  completedDate?: string;
  revisionsCompleted: number; // 0–7
}

interface Subject {
  id: string;
  name: string;
  chapters: Chapter[];
  expanded: boolean;
}

const initialSubjects: Subject[] = [
  {
    id: "1", name: "Physics", expanded: true,
    chapters: [
      { id: "p1", name: "Laws of Motion", completed: true, completedDate: "2026-04-01", revisionsCompleted: 2 },
      { id: "p2", name: "Work, Energy & Power", completed: true, completedDate: "2026-04-02", revisionsCompleted: 1 },
      { id: "p3", name: "Gravitation", completed: false, revisionsCompleted: 0 },
      { id: "p4", name: "Thermodynamics", completed: false, revisionsCompleted: 0 },
    ],
  },
  {
    id: "2", name: "Chemistry", expanded: false,
    chapters: [
      { id: "c1", name: "Atomic Structure", completed: true, completedDate: "2026-03-28", revisionsCompleted: 3 },
      { id: "c2", name: "Chemical Bonding", completed: false, revisionsCompleted: 0 },
      { id: "c3", name: "Organic Chemistry - Alcohols", completed: false, revisionsCompleted: 0 },
    ],
  },
  {
    id: "3", name: "Mathematics", expanded: false,
    chapters: [
      { id: "m1", name: "Integration", completed: true, completedDate: "2026-04-03", revisionsCompleted: 0 },
      { id: "m2", name: "Differentiation", completed: true, completedDate: "2026-03-30", revisionsCompleted: 2 },
      { id: "m3", name: "Matrices & Determinants", completed: false, revisionsCompleted: 0 },
    ],
  },
];

const Syllabus = () => {
  const [subjects, setSubjects] = useState(initialSubjects);
  const [newSubject, setNewSubject] = useState("");
  const [addingChapter, setAddingChapter] = useState<string | null>(null);
  const [newChapter, setNewChapter] = useState("");

  const toggleExpand = (id: string) => {
    setSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, expanded: !s.expanded } : s)));
  };

  const toggleChapter = (subjectId: string, chapterId: string) => {
    setSubjects((prev) =>
      prev.map((s) =>
        s.id === subjectId
          ? {
              ...s,
              chapters: s.chapters.map((c) =>
                c.id === chapterId
                  ? {
                      ...c,
                      completed: !c.completed,
                      completedDate: !c.completed ? new Date().toISOString().split("T")[0] : undefined,
                      revisionsCompleted: !c.completed ? 0 : c.revisionsCompleted,
                    }
                  : c
              ),
            }
          : s
      )
    );
  };

  const addSubject = () => {
    if (!newSubject.trim()) return;
    setSubjects((prev) => [...prev, { id: Date.now().toString(), name: newSubject, chapters: [], expanded: true }]);
    setNewSubject("");
  };

  const addChapter = (subjectId: string) => {
    if (!newChapter.trim()) return;
    setSubjects((prev) =>
      prev.map((s) =>
        s.id === subjectId
          ? { ...s, chapters: [...s.chapters, { id: Date.now().toString(), name: newChapter, completed: false, revisionsCompleted: 0 }] }
          : s
      )
    );
    setNewChapter("");
    setAddingChapter(null);
  };

  const getNextRevisionInfo = (ch: Chapter) => {
    if (!ch.completed || !ch.completedDate) return null;
    if (ch.revisionsCompleted >= REVISION_INTERVALS.length) return { label: "All reviews done ✓", date: "" };
    const dueDate = getRevisionDueDate(ch.completedDate, ch.revisionsCompleted);
    const label = getRevisionLabel(ch.revisionsCompleted);
    return { label, date: dueDate };
  };

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="font-heading text-3xl font-bold text-foreground flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-primary" /> Syllabus
        </h1>
        <p className="text-muted-foreground mt-1">Spaced revision: Day 1 → 3 → 5 → 7 → 14 → 30 → 90</p>
      </div>

      {/* Revision schedule legend */}
      <div className="glass-card p-4 animate-fade-in">
        <div className="flex items-center gap-2 mb-2">
          <CalendarClock className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Revision Schedule</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {REVISION_INTERVALS.map((day, i) => (
            <span key={i} className="text-xs bg-secondary px-2.5 py-1 rounded-full text-muted-foreground">
              {getRevisionLabel(i).replace(/\(.*\)/, "")}— Day {day}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-2 animate-fade-in">
        <input
          value={newSubject}
          onChange={(e) => setNewSubject(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addSubject()}
          placeholder="Add new subject..."
          className="flex-1 bg-secondary rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button onClick={addSubject} className="bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      <div className="space-y-3 animate-fade-in">
        {subjects.map((subject) => {
          const completed = subject.chapters.filter((c) => c.completed).length;
          return (
            <div key={subject.id} className="glass-card overflow-hidden">
              <button onClick={() => toggleExpand(subject.id)} className="w-full flex items-center gap-3 p-4 hover:bg-secondary/30 transition-colors">
                {subject.expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                <h3 className="font-heading font-semibold text-foreground flex-1 text-left">{subject.name}</h3>
                <span className="text-xs text-muted-foreground">{completed}/{subject.chapters.length} chapters</span>
              </button>
              {subject.expanded && (
                <div className="border-t border-border px-4 pb-4">
                  <div className="space-y-1 mt-2">
                    {subject.chapters.map((ch) => {
                      const revInfo = getNextRevisionInfo(ch);
                      return (
                        <div key={ch.id}>
                          <button
                            onClick={() => toggleChapter(subject.id, ch.id)}
                            className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all ${
                              ch.completed ? "bg-accent/30" : "hover:bg-secondary/50"
                            }`}
                          >
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              ch.completed ? "bg-primary border-primary" : "border-muted-foreground/40"
                            }`}>
                              {ch.completed && <Check className="w-3 h-3 text-primary-foreground" />}
                            </div>
                            <span className={`text-sm flex-1 ${ch.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                              {ch.name}
                            </span>
                            {ch.completedDate && <span className="text-[10px] text-muted-foreground">✓ {ch.completedDate}</span>}
                          </button>
                          {revInfo && (
                            <div className="ml-10 mt-0.5 mb-1 flex items-center gap-1.5">
                              <CalendarClock className="w-3 h-3 text-info" />
                              <span className="text-[10px] text-info">
                                Next: {revInfo.label} {revInfo.date && `(${revInfo.date})`}
                              </span>
                              {ch.revisionsCompleted > 0 && (
                                <span className="text-[10px] text-muted-foreground ml-1">
                                  ({ch.revisionsCompleted}/{REVISION_INTERVALS.length} done)
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {addingChapter === subject.id ? (
                    <div className="flex gap-2 mt-2">
                      <input
                        value={newChapter}
                        onChange={(e) => setNewChapter(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addChapter(subject.id)}
                        placeholder="Chapter name..."
                        autoFocus
                        className="flex-1 bg-secondary rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <button onClick={() => addChapter(subject.id)} className="bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm">Add</button>
                      <button onClick={() => { setAddingChapter(null); setNewChapter(""); }} className="text-muted-foreground px-3 py-2 text-sm">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setAddingChapter(subject.id)} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground mt-2 p-2 transition-colors">
                      <Plus className="w-3 h-3" /> Add chapter
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Syllabus;
