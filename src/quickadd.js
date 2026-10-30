// Quick add: reading one typed line, like "MP4 cs124 fri 11:59pm", into an assignment's fields.
// Words that aren't recognized stay in the title, so nothing typed is lost.

import { toDateKey } from "./calendar.js?v=03cdcd76";
import { shortCourseName } from "./canvas.js?v=03cdcd76";

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
// Longer spellings people type for each weekday, mapped to the three-letter ones above.
const WEEKDAY_SPELLINGS = { tues: "tue", thur: "thu", thurs: "thu" };
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const SIZES = ["big", "regular", "small"];
// Little words before a date or time ("due fri", "at 9am") that are dropped rather than kept in the title.
const FILLER_WORDS = ["due", "by", "at", "on"];

/**
 * Reads a quick-add line. `courses` are the course names already in the list, so "cs124" or "cs 124" becomes
 * the existing "CS 124". Returns { title, course, dueDate, dueTime, priority, hours }, where each part is
 * null (or "" for course) if the line didn't say it.
 */
export function parseQuickAdd(text, { now = new Date(), courses = [] } = {}) {
  const words = text.trim().split(/\s+/).filter((word) => word !== "");
  const result = { title: "", course: "", dueDate: null, dueTime: null, priority: null, hours: null };
  const used = new Set();

  for (let i = 0; i < words.length; i += 1) {
    const word = words[i].toLowerCase();
    const next = words[i + 1]?.toLowerCase();

    // A two-word course ("cs 124") or month date ("oct 30") uses this word and the next.
    if (!result.course && next) {
      const course = existingCourse(`${word} ${next}`, courses);
      if (course) {
        result.course = course;
        used.add(i).add(i + 1);
        i += 1;
        continue;
      }
    }
    if (!result.dueDate && next) {
      const date = monthDate(word, next, now);
      if (date) {
        result.dueDate = date;
        used.add(i).add(i + 1);
        i += 1;
        continue;
      }
    }
    if (!result.dueDate && word === "next" && weekday(next) !== null) {
      result.dueDate = weekdayDate(weekday(next), now, 7);
      used.add(i).add(i + 1);
      i += 1;
      continue;
    }

    const course = !result.course && (existingCourse(word, courses) ?? newCourse(word));
    const date = !result.dueDate && (dayWord(word, now) ?? numericDate(word, now));
    const time = !result.dueTime && clockTime(word);
    const hours = result.hours === null && hoursAmount(word);
    if (course) {
      result.course = course;
    } else if (date) {
      result.dueDate = date;
    } else if (time) {
      result.dueTime = time;
    } else if (!result.priority && SIZES.includes(word)) {
      result.priority = word;
    } else if (hours) {
      result.hours = hours;
    } else {
      continue;
    }
    used.add(i);
  }

  // "due fri" or "at 9am": drop the little word before a date or time instead of keeping it in the title.
  for (let i = 0; i < words.length - 1; i += 1) {
    if (!used.has(i) && used.has(i + 1) && FILLER_WORDS.includes(words[i].toLowerCase())) {
      used.add(i);
    }
  }
  result.title = words.filter((_, i) => !used.has(i)).join(" ");
  return result;
}

/** The existing course this is a way of writing ("cs124", "CS 124", "cs-124"), or null. */
function existingCourse(text, courses) {
  const key = squash(text);
  return courses.find((course) => squash(course) === key) ?? null;
}

/** A course code written as one word, like "ece220", as "ECE 220"; null for anything else, like "mp4". */
function newCourse(word) {
  if (!/^[a-z]{2,5}-?\d{3}[a-z]?$/i.test(word)) {
    return null;
  }
  return shortCourseName(word);
}

function squash(text) {
  return text.toLowerCase().replace(/[\s-]/g, "");
}

function dayWord(word, now) {
  if (word === "today" || word === "tonight") {
    return toDateKey(now);
  }
  if (["tomorrow", "tmr", "tmrw", "tom"].includes(word)) {
    return toDateKey(addDays(now, 1));
  }
  const day = weekday(word);
  return day === null ? null : weekdayDate(day, now, 0);
}

/** 0 for Sunday to 6 for Saturday, from "fri", "friday", "thurs" and so on; null if it isn't a weekday. */
function weekday(word) {
  if (!word || word.length < 3) {
    return null;
  }
  const short = WEEKDAY_SPELLINGS[word] ?? word.slice(0, 3);
  const index = WEEKDAYS.indexOf(short);
  return index !== -1 && `${WEEKDAYS[index]}${dayNameRest(index)}`.startsWith(word) ? index : null;
}

function dayNameRest(index) {
  return ["day", "day", "sday", "nesday", "rsday", "day", "urday"][index];
}

/** The next date on this weekday: today if it is that day, otherwise later this week; `extra` days added after. */
function weekdayDate(day, now, extra) {
  const ahead = (day - now.getDay() + 7) % 7;
  return toDateKey(addDays(now, ahead + extra));
}

/** "10/30" or "10/30/2026". Without a year, a date already past this year means next year. */
function numericDate(word, now) {
  const match = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(word);
  if (!match) {
    return null;
  }
  const year = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : null;
  return calendarDate(year, Number(match[1]) - 1, Number(match[2]), now);
}

/** "oct 30" or "30 oct" (and "october 30"). */
function monthDate(first, second, now) {
  const month = monthIndex(first);
  if (month !== null && /^\d{1,2}$/.test(second)) {
    return calendarDate(null, month, Number(second), now);
  }
  const monthAfter = monthIndex(second);
  if (monthAfter !== null && /^\d{1,2}$/.test(first)) {
    return calendarDate(null, monthAfter, Number(first), now);
  }
  return null;
}

/** 0 to 11 from "oct", "sept" or "october"; null otherwise, so a title word like "decision" isn't a month. */
function monthIndex(word) {
  if (!word || word.length < 3) {
    return null;
  }
  const index = MONTHS.findIndex((month) => month.startsWith(word));
  return index === -1 ? null : index;
}

function calendarDate(year, month, day, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let date = new Date(year ?? now.getFullYear(), month, day);
  if (date.getMonth() !== month || date.getDate() !== day) {
    // A day that doesn't exist, like 2/30.
    return null;
  }
  if (year === null && date < today) {
    date = new Date(now.getFullYear() + 1, month, day);
  }
  return toDateKey(date);
}

/** "11:59pm", "9am", "9:30 am" written together, "17:00", or "noon", as "HH:MM"; null otherwise. */
function clockTime(word) {
  if (word === "noon") {
    return "12:00";
  }
  const match = /^(\d{1,2})(?::(\d{2}))?(am|pm)?$/.exec(word);
  // A bare number like "4" is too likely to be part of the title, so a time needs ":" or am/pm.
  if (!match || (!match[2] && !match[3])) {
    return null;
  }
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (match[3]) {
    if (hour < 1 || hour > 12) {
      return null;
    }
    hour = (hour % 12) + (match[3] === "pm" ? 12 : 0);
  }
  if (hour > 23 || minute > 59) {
    return null;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** "2h", "1.5hrs", "30min" as a number of hours; null otherwise. */
function hoursAmount(word) {
  const hours = /^(\d+(?:\.\d+)?)(h|hr|hrs|hour|hours)$/.exec(word);
  if (hours) {
    return Number(hours[1]);
  }
  const minutes = /^(\d+)(m|min|mins|minutes)$/.exec(word);
  return minutes ? Number(minutes[1]) / 60 : null;
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}
