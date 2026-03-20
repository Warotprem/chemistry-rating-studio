import {
  ACTIVITY_LOG_STORAGE_KEY,
  COMMENTS_STORAGE_KEY,
  REVEAL_RECORDS_STORAGE_KEY,
  SESSION_STORAGE_KEY,
  STORAGE_KEY,
} from "../constants";
import { createEmptyCommentsMap, createEmptyRatingsMap } from "./session";

function sanitizeRatingsForPerson(input, categories) {
  return Object.fromEntries(
    categories.map((category) => {
      const value = Number(input?.[category]);
      const valid = Number.isFinite(value) && value >= 1 && value <= 5;
      return [category, valid ? value : null];
    }),
  );
}

function sanitizeComment(value) {
  return typeof value === "string" ? value.replace(/\r\n/g, "\n").slice(0, 4000) : "";
}

function sanitizeCommentsByPerson(input, people) {
  return Object.fromEntries(
    people.map((person) => [person.id, sanitizeComment(input?.[person.id])]),
  );
}

function sanitizeRosterSnapshot(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((person) => person && typeof person === "object")
    .map((person) => ({
      id: typeof person.id === "string" ? person.id : "",
      name: typeof person.name === "string" ? person.name : "",
      role: typeof person.role === "string" ? person.role : "",
      summary: typeof person.summary === "string" ? person.summary : "",
    }));
}

export function sanitizeRaterName(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 80) : "";
}

export function createClientSessionId() {
  if (typeof window !== "undefined" && typeof window.crypto?.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function loadStoredRatings(people, categories) {
  const emptyRatings = createEmptyRatingsMap(people, categories);

  if (typeof window === "undefined") {
    return emptyRatings;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return emptyRatings;
    }

    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object") {
      return emptyRatings;
    }

    return Object.fromEntries(
      people.map((person) => [
        person.id,
        sanitizeRatingsForPerson(parsed[person.id], categories),
      ]),
    );
  } catch {
    return emptyRatings;
  }
}

export function loadStoredComments(people) {
  const emptyComments = createEmptyCommentsMap(people);

  if (typeof window === "undefined") {
    return emptyComments;
  }

  try {
    const raw = window.localStorage.getItem(COMMENTS_STORAGE_KEY);

    if (!raw) {
      return emptyComments;
    }

    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object") {
      return emptyComments;
    }

    return sanitizeCommentsByPerson(parsed, people);
  } catch {
    return emptyComments;
  }
}

export function saveStoredRatings(ratingsByPerson) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ratingsByPerson));
  } catch {
    // Ignore storage failures so the app still works without persistence.
  }
}

export function saveStoredComments(commentsByPerson) {
  try {
    window.localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(commentsByPerson));
  } catch {
    // Ignore storage failures so the app still works without persistence.
  }
}

export function clearStoredRatings() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures so in-memory reset still works.
  }
}

export function clearStoredComments() {
  try {
    window.localStorage.removeItem(COMMENTS_STORAGE_KEY);
  } catch {
    // Ignore storage failures so in-memory reset still works.
  }
}

export function loadStoredSession() {
  if (typeof window === "undefined") {
    return {
      raterName: "",
      sessionId: "",
    };
  }

  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);

    if (!raw) {
      return {
        raterName: "",
        sessionId: "",
      };
    }

    const parsed = JSON.parse(raw);

    return {
      raterName: sanitizeRaterName(parsed?.raterName),
      sessionId: typeof parsed?.sessionId === "string" ? parsed.sessionId : "",
    };
  } catch {
    return {
      raterName: "",
      sessionId: "",
    };
  }
}

export function saveStoredSession(session) {
  const raterName = sanitizeRaterName(session?.raterName);
  const sessionId = typeof session?.sessionId === "string" ? session.sessionId : "";

  if (!raterName || !sessionId) {
    return;
  }

  try {
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        raterName,
        sessionId,
      }),
    );
  } catch {
    // Ignore storage failures so the app still works without persistence.
  }
}

export function clearStoredSession() {
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage failures so in-memory reset still works.
  }
}

function sanitizeRevealRecord(record) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const raterName = sanitizeRaterName(record.raterName);
  const sessionId = typeof record.sessionId === "string" ? record.sessionId : "";
  const createdAt = typeof record.createdAt === "string" ? record.createdAt : "";
  const updatedAt = typeof record.updatedAt === "string" ? record.updatedAt : "";

  if (!raterName || !sessionId || !updatedAt) {
    return null;
  }

  return {
    sessionId,
    raterName,
    createdAt: createdAt || updatedAt,
    updatedAt,
    analyzedCount: Number.isFinite(Number(record.analyzedCount)) ? Number(record.analyzedCount) : 0,
    peopleCount: Number.isFinite(Number(record.peopleCount)) ? Number(record.peopleCount) : 0,
    categories: Array.isArray(record.categories) ? record.categories.filter((item) => typeof item === "string") : [],
    bestOverall: {
      names: Array.isArray(record.bestOverall?.names)
        ? record.bestOverall.names.filter((item) => typeof item === "string")
        : [],
      score: Number.isFinite(Number(record.bestOverall?.score))
        ? Number(record.bestOverall.score)
        : null,
    },
    bestByCategory: Array.isArray(record.bestByCategory) ? record.bestByCategory : [],
    categoryAverages: Array.isArray(record.categoryAverages) ? record.categoryAverages : [],
    rankedRows: Array.isArray(record.rankedRows) ? record.rankedRows : [],
    rosterSnapshot: sanitizeRosterSnapshot(record.rosterSnapshot),
    ratingsByPerson:
      record.ratingsByPerson && typeof record.ratingsByPerson === "object"
        ? record.ratingsByPerson
        : {},
    commentsByPerson:
      record.commentsByPerson && typeof record.commentsByPerson === "object"
        ? record.commentsByPerson
        : {},
    coachInsights: Array.isArray(record.coachInsights) ? record.coachInsights : [],
    generatedSummary:
      record.generatedSummary && typeof record.generatedSummary === "object"
        ? record.generatedSummary
        : null,
    raterProfile:
      record.raterProfile && typeof record.raterProfile === "object" ? record.raterProfile : null,
  };
}

export function loadStoredRevealRecords() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(REVEAL_RECORDS_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(sanitizeRevealRecord)
      .filter(Boolean)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  } catch {
    return [];
  }
}

export function upsertStoredRevealRecord(record) {
  const sanitized = sanitizeRevealRecord(record);

  if (!sanitized) {
    return [];
  }

  const existing = loadStoredRevealRecords();
  const existingRecord = existing.find((entry) => entry.sessionId === sanitized.sessionId);
  const next = existing.filter((entry) => entry.sessionId !== sanitized.sessionId);
  const recordToStore = {
    ...sanitized,
    createdAt: existingRecord?.createdAt || sanitized.createdAt || sanitized.updatedAt,
  };

  next.unshift(recordToStore);

  try {
    window.localStorage.setItem(REVEAL_RECORDS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage failures so the app still works without persistence.
  }

  return next;
}

function sanitizeActivityLogEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const fallbackId = [
    typeof entry.timestamp === "string" ? entry.timestamp : "",
    typeof entry.type === "string" ? entry.type : "",
    typeof entry.sessionId === "string" ? entry.sessionId : "",
    typeof entry.personId === "string" ? entry.personId : "",
    typeof entry.category === "string" ? entry.category : "",
    entry.value ?? "",
    typeof entry.summary === "string" ? entry.summary : "",
  ].join("|");
  const timestamp = typeof entry.timestamp === "string" ? entry.timestamp : "";
  const type = typeof entry.type === "string" ? entry.type : "";
  const sessionId = typeof entry.sessionId === "string" ? entry.sessionId : "";
  const raterName = sanitizeRaterName(entry.raterName);

  if (!timestamp || !type) {
    return null;
  }

  return {
    id: typeof entry.id === "string" && entry.id ? entry.id : fallbackId,
    timestamp,
    type,
    sessionId,
    raterName,
    personId: typeof entry.personId === "string" ? entry.personId : "",
    personName: typeof entry.personName === "string" ? entry.personName : "",
    category: typeof entry.category === "string" ? entry.category : "",
    value: entry.value ?? null,
    comment: sanitizeComment(entry.comment),
    summary: typeof entry.summary === "string" ? entry.summary : "",
    details: entry.details && typeof entry.details === "object" ? entry.details : {},
  };
}

export function loadStoredActivityLog() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(ACTIVITY_LOG_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(sanitizeActivityLogEntry)
      .filter(Boolean)
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp));
  } catch {
    return [];
  }
}

export function saveStoredActivityLog(activityLog) {
  try {
    window.localStorage.setItem(ACTIVITY_LOG_STORAGE_KEY, JSON.stringify(activityLog));
  } catch {
    // Ignore storage failures so the app still works without persistence.
  }
}
