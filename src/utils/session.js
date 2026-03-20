import { RATING_MAX, RATING_MIN } from "../constants";

export const MIN_COMPLETED_PROFILES = 5;

export function createEmptyRatingsMap(people, categories) {
  return Object.fromEntries(
    people.map((person) => [
      person.id,
      Object.fromEntries(categories.map((category) => [category, null])),
    ]),
  );
}

export function createEmptyCommentsMap(people) {
  return Object.fromEntries(people.map((person) => [person.id, ""]));
}

export function getCompletedPeopleCount(people, categories, ratingsByPerson) {
  return people.filter((person) =>
    categories.every((category) => {
      const value = Number(ratingsByPerson?.[person.id]?.[category]);
      return Number.isInteger(value) && value >= RATING_MIN && value <= RATING_MAX;
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
