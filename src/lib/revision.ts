// Spaced repetition revision intervals in days
// Day 0: Study, Day 1: 1st review, Day 3: 2nd, Day 5: 3rd, Day 7: 4th, Day 14: 5th, Day 30: 6th, Day 90: Final
export const REVISION_INTERVALS = [1, 3, 5, 7, 14, 30, 90];

export interface RevisionEntry {
  chapterName: string;
  subjectName: string;
  completedDate: string; // ISO date string YYYY-MM-DD
  revisionNumber: number; // which revision (0 = not yet revised, 1-7 = revision count)
}

export function getRevisionDueDate(completedDate: string, revisionIndex: number): string {
  const date = new Date(completedDate);
  date.setDate(date.getDate() + REVISION_INTERVALS[revisionIndex]);
  return date.toISOString().split("T")[0];
}

export function getRevisionLabel(revisionNumber: number): string {
  const labels = [
    "1st Review (Day 1)",
    "2nd Review (Day 3)",
    "3rd Review (Day 5)",
    "4th Review (Day 7)",
    "5th Review (Day 14)",
    "6th Review (Day 30)",
    "Final Review (Day 90)",
  ];
  return labels[revisionNumber] || "Review";
}

export function getDueRevisions(completedDate: string, revisionsCompleted: number, today: string): number | null {
  // Returns the next revision index that is due, or null if none
  for (let i = revisionsCompleted; i < REVISION_INTERVALS.length; i++) {
    const dueDate = getRevisionDueDate(completedDate, i);
    if (dueDate <= today) {
      return i;
    }
  }
  return null;
}
