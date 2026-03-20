import { PEOPLE_ROSTER } from "../data/peopleRoster";

function sanitizeRosterEntry(person) {
  if (!person || typeof person !== "object") {
    return null;
  }

  if (typeof person.id !== "string" || typeof person.name !== "string") {
    return null;
  }

  const name = person.name.trim();

  if (!name) {
    return null;
  }

  return {
    id: person.id,
    name,
    role: typeof person.role === "string" ? person.role.trim() : "",
    summary: typeof person.summary === "string" ? person.summary.trim() : "",
    privateNotes: typeof person.privateNotes === "string" ? person.privateNotes.trim() : "",
  };
}

export async function fetchPeopleRoster() {
  const roster = PEOPLE_ROSTER.map(sanitizeRosterEntry).filter(Boolean);

  return Promise.resolve(roster);
}
