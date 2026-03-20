import { STORAGE_KEY } from "../constants";
import { createEmptyRatingsMap } from "./session";

function sanitizeRatingsForPerson(input, categories) {
  return Object.fromEntries(
    categories.map((category) => {
      const value = Number(input?.[category]);
      const valid = Number.isFinite(value) && value >= 1 && value <= 5;
      return [category, valid ? value : null];
    }),
  );
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

export function saveStoredRatings(ratingsByPerson) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ratingsByPerson));
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
