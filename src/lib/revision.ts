// Spaced repetition gaps (days BETWEEN reviews).
// After completing a chapter you wait 1 day for the 1st review, then 3 more days
// for the 2nd, and so on. The next review is always counted from the LAST review
// the user actually ticked off (or completed_date if none yet).
export const REVISION_GAPS = [1, 3, 5, 7, 15, 30, 90];
export const REVISION_INTERVALS = REVISION_GAPS; // back-compat alias

export interface RevisionEntry {
  chapterName: string;
  subjectName: string;
  completedDate: string;
  revisionNumber: number;
}

/** Anchor date used to schedule the next review */
export function getRevisionAnchor(completedDate: string, lastRevisionDate: string | null): string {
  return lastRevisionDate || completedDate;
}

export function getRevisionDueDate(
  completedDate: string,
  revisionIndex: number,
  lastRevisionDate: string | null = null
): string {
  const anchor = getRevisionAnchor(completedDate, lastRevisionDate);
  const date = new Date(anchor);
  date.setDate(date.getDate() + REVISION_GAPS[revisionIndex]);
  return date.toISOString().split("T")[0];
}

export function getRevisionLabel(revisionNumber: number): string {
  const labels = [
    "1st Review (+1d)",
    "2nd Review (+3d)",
    "3rd Review (+5d)",
    "4th Review (+7d)",
    "5th Review (+15d)",
    "6th Review (+30d)",
    "Final Review (+90d)",
  ];
  return labels[revisionNumber] || "Review";
}

/** Returns the index of the next due review, or null if none due. */
export function getDueRevisions(
  completedDate: string,
  revisionsCompleted: number,
  today: string,
  lastRevisionDate: string | null = null
): number | null {
  if (revisionsCompleted >= REVISION_GAPS.length) return null;
  const dueDate = getRevisionDueDate(completedDate, revisionsCompleted, lastRevisionDate);
  return dueDate <= today ? revisionsCompleted : null;
}
