export const PERSONAL_RATING_CATEGORY =
  "Personal Rating (What You Think the Average Should Be)";

export const RATING_MIN = 1;
export const RATING_MAX = 10;
export const RATING_STEP = 1;

export const DEFAULT_CATEGORIES = [
  "Body",
  "Personality",
  "Wifey Qualities",
  "Mother of a Kid",
  "Face",
  PERSONAL_RATING_CATEGORY,
];

export const CATEGORY_DESCRIPTIONS = {
  Body: "Overall physical shape, fitness, and how she carries herself physically.",
  Personality: "Her character, behavior, and how she thinks and interacts with others.",
  "Wifey Qualities":
    "Traits that make her a reliable, loyal, and supportive long-term partner.",
  "Mother of a Kid":
    "Her ability to nurture, guide, and responsibly raise a child.",
  Face: "Her facial attractiveness, features, and expressions.",
  [PERSONAL_RATING_CATEGORY]:
    "Your overall subjective score based on your own standards.",
};

export const STORAGE_KEY = "people-rating-flow.v2";
export const COMMENTS_STORAGE_KEY = "people-rating-flow.comments.v1";
export const SESSION_STORAGE_KEY = "people-rating-flow.rater.v1";
export const REVEAL_RECORDS_STORAGE_KEY = "people-rating-flow.reveals.v1";
export const ACTIVITY_LOG_STORAGE_KEY = "people-rating-flow.logs.v1";
