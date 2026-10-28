// A color for each course's tag, so courses can be told apart at a glance. Colors are picked automatically
// from the courses' names, so devices with the same courses agree; a choice made in Course colors… replaces
// the automatic one on that device.

// Kept clear of the reds (Big, Overdue) and amber (due soon) that already mean something; see styles/list.css.
export const COURSE_COLORS = ["blue", "teal", "green", "olive", "purple", "pink", "brown", "slate"];

/**
 * A color for every course, as a Map. Chosen colors come first; every other course gets the color its
 * name points to, or the next one no other course has yet, so courses differ while there are colors to go
 * round (more than eight courses share). Courses are handed colors in alphabetical order, so the result
 * doesn't depend on the order of the list.
 */
export function courseColors(courses, chosen = {}) {
  const colors = new Map();
  const taken = new Set();
  for (const course of courses) {
    if (COURSE_COLORS.includes(chosen[course])) {
      colors.set(course, chosen[course]);
      taken.add(chosen[course]);
    }
  }
  for (const course of [...courses].sort()) {
    if (colors.has(course)) {
      continue;
    }
    const preferred = nameIndex(course);
    const offset = COURSE_COLORS.findIndex((_, step) => !taken.has(COURSE_COLORS[(preferred + step) % COURSE_COLORS.length]));
    const color = COURSE_COLORS[(preferred + Math.max(offset, 0)) % COURSE_COLORS.length];
    colors.set(course, color);
    taken.add(color);
  }
  return colors;
}

/** Where in COURSE_COLORS a course's name points: the same name always points to the same place. */
function nameIndex(course) {
  let hash = 0;
  for (const character of course.toLowerCase()) {
    hash = (hash * 31 + character.codePointAt(0)) >>> 0;
  }
  return hash % COURSE_COLORS.length;
}

/** Chosen colors saved in this browser (as JSON), keeping only real colors; {} if none or unreadable. */
export function parseChosenColors(text) {
  try {
    const saved = JSON.parse(text ?? "null");
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
      return {};
    }
    return Object.fromEntries(Object.entries(saved).filter(([, color]) => COURSE_COLORS.includes(color)));
  } catch {
    return {};
  }
}
