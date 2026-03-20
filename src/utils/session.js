export const MIN_COMPLETED_PROFILES = 5;

export function createEmptyRatingsMap(people, categories) {
  return Object.fromEntries(
    people.map((person) => [
      person.id,
      Object.fromEntries(categories.map((category) => [category, null])),
    ]),
  );
}

export function getCompletedPeopleCount(people, categories, ratingsByPerson) {
  return people.filter((person) =>
    categories.every((category) => {
      const value = Number(ratingsByPerson?.[person.id]?.[category]);
      return Number.isFinite(value) && value >= 1 && value <= 5;
    }),
  ).length;
}

export function hasCompletedAllRatings(people, categories, ratingsByPerson) {
  return people.length > 0 && getCompletedPeopleCount(people, categories, ratingsByPerson) === people.length;
}

export function hasReachedMinimumRatings(
  people,
  categories,
  ratingsByPerson,
  minimumCompletedProfiles = MIN_COMPLETED_PROFILES,
) {
  return getCompletedPeopleCount(people, categories, ratingsByPerson) >= minimumCompletedProfiles;
}
