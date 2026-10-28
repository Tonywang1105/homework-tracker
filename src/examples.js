// Example assignments, so someone trying the app (a classmate giving feedback) can see every
// feature without entering their own homework. No DOM, so it can be unit-tested with Node.

import { createAssignment, validateAssignmentInput } from "./assignments.js?v=ebc36942";
import { toDateKey } from "./calendar.js?v=ebc36942";

// Due dates are days from today, so the examples always look current. Together they show every
// size and type, notes, one overdue and one finished assignment, and a busy day ("+N more").
const EXAMPLES = [
  { title: "MP3: Checkpoint 2", course: "CS 124", days: 2, dueTime: "23:59", priority: "big", hours: 4,
    notes: "Start from the checkpoint 1 tests. Office hours Tuesday 4-6 PM." },
  { title: "Quiz 5", course: "SPAN 101", days: 1, dueTime: "09:00", priority: "small", notes: "Vocabulary from chapter 6." },
  { title: "Midterm 2", course: "MATH 221", days: 6, dueTime: "19:00", priority: "big", hours: 5,
    notes: "Covers 4.1 to 5.3. Redo the practice exam first." },
  { title: "Lab Report 4: Titration", course: "CHEM 102", days: 3, dueTime: "17:00", priority: "big", hours: 2,
    notes: "Data is on lab notebook page 14." },
  { title: "Problem Set 7", course: "MATH 221", days: 3, dueTime: "23:59", priority: "regular", hours: 1.5 },
  { title: "Reading Response 3", course: "RHET 105", days: 3, dueTime: "12:00", priority: "regular", hours: 0.5 },
  { title: "Bring calculator to lab", course: "CHEM 102", days: 3, dueTime: "08:00", priority: "small" },
  { title: "Essay draft", course: "RHET 105", days: 9, dueTime: "23:59", priority: "big", notes: "Outline is in my notes app." },
  { title: "HW 6", course: "CS 124", days: -1, dueTime: "23:59", priority: "regular", hours: 1 },
  { title: "Pre-lab questions", course: "CHEM 102", days: -2, dueTime: "08:00", priority: "regular", type: "lab", done: true },
  { title: "Email TA about regrade", course: "", days: 1, dueTime: "12:00", priority: "small" },
  { title: "Oral presentation", course: "SPAN 101", days: 8, dueTime: "10:00", priority: "big", type: "exam" },
];

/** The example assignments, due relative to `now`, each marked `example: true` so they can be removed together. */
export function exampleAssignments(now = new Date()) {
  return EXAMPLES.map(({ days, done = false, ...fields }, index) => {
    const dueDate = toDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
    const result = validateAssignmentInput({ ...fields, dueDate });
    if (!result.ok) {
      throw new Error(`Example "${fields.title}" is invalid: ${JSON.stringify(result.errors)}`);
    }
    return { ...createAssignment(result.fields, { id: `example-${index + 1}`, now }), done, example: true };
  });
}

export function hasExamples(assignments) {
  return assignments.some((a) => a.example);
}

/** The list without the example assignments; anything the student added stays. */
export function removeExamples(assignments) {
  return assignments.filter((a) => !a.example);
}
