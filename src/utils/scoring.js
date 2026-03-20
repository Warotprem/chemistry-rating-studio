import { RATING_MAX, RATING_MIN } from "../constants";

const SCORE_EPSILON = 1e-9;

export function isValidRating(value) {
  return Number.isInteger(value) && value >= RATING_MIN && value <= RATING_MAX;
}

export function formatScore(value) {
  return value === null ? "--" : value.toFixed(2);
}

export function buildPeopleWithRatings(people, ratingsByPerson) {
  return people.map((person) => ({
    ...person,
    ratings: { ...(ratingsByPerson?.[person.id] ?? {}) },
  }));
}

export function getCategoryScore(person, category) {
  const value = Number(person?.ratings?.[category]);
  return isValidRating(value) ? value : null;
}

export function getOverallScore(person, categories) {
  const scores = categories
    .map((category) => getCategoryScore(person, category))
    .filter((score) => score !== null);

  if (!scores.length) {
    return null;
  }

  return scores.reduce((total, score) => total + score, 0) / scores.length;
}

function compareNullableScores(left, right) {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return right - left;
}

function scoresMatch(left, right) {
  return left !== null && right !== null && Math.abs(left - right) < SCORE_EPSILON;
}

export function buildRankedRows(people, mode, categories) {
  const rows = people.map((person) => {
    const categoryScores = Object.fromEntries(
      categories.map((category) => [category, getCategoryScore(person, category)]),
    );
    const overallScore = getOverallScore(person, categories);
    const rankingScore = mode === "overall" ? overallScore : categoryScores[mode] ?? null;
    const ratedCount = categories.filter((category) => categoryScores[category] !== null).length;

    return {
      person,
      categoryScores,
      overallScore,
      rankingScore,
      ratedCount,
    };
  });

  rows.sort((left, right) => {
    const rankingOrder = compareNullableScores(left.rankingScore, right.rankingScore);

    if (rankingOrder !== 0) {
      return rankingOrder;
    }

    const overallOrder = compareNullableScores(left.overallScore, right.overallScore);

    if (overallOrder !== 0) {
      return overallOrder;
    }

    return left.person.name.localeCompare(right.person.name);
  });

  let ratedSeen = 0;
  let lastRank = null;
  let lastScore = null;

  return rows.map((row) => {
    if (row.rankingScore === null) {
      return {
        ...row,
        displayRank: null,
      };
    }

    ratedSeen += 1;

    if (scoresMatch(lastScore, row.rankingScore)) {
      return {
        ...row,
        displayRank: lastRank,
      };
    }

    lastScore = row.rankingScore;
    lastRank = ratedSeen;

    return {
      ...row,
      displayRank: ratedSeen,
    };
  });
}

export function getBestOverall(people, categories) {
  const ranked = buildRankedRows(people, "overall", categories).filter(
    (row) => row.overallScore !== null,
  );

  if (!ranked.length) {
    return { score: null, people: [] };
  }

  const bestScore = ranked[0].overallScore;

  return {
    score: bestScore,
    people: ranked
      .filter((row) => scoresMatch(row.overallScore, bestScore))
      .map((row) => row.person),
  };
}

export function getBestByCategory(people, categories) {
  return categories.map((category) => {
    const rows = people
      .map((person) => ({
        person,
        score: getCategoryScore(person, category),
      }))
      .sort((left, right) => {
        const scoreOrder = compareNullableScores(left.score, right.score);
        return scoreOrder !== 0 ? scoreOrder : left.person.name.localeCompare(right.person.name);
      });

    if (!rows.length || rows[0].score === null) {
      return { category, score: null, people: [] };
    }

    const bestScore = rows[0].score;

    return {
      category,
      score: bestScore,
      people: rows
        .filter((row) => scoresMatch(row.score, bestScore))
        .map((row) => row.person),
    };
  });
}

export function getCategoryAverages(people, categories) {
  return categories.map((category) => {
    const scores = people
      .map((person) => getCategoryScore(person, category))
      .filter((score) => score !== null);

    if (!scores.length) {
      return {
        category,
        average: null,
        ratedCount: 0,
      };
    }

    return {
      category,
      average: scores.reduce((total, score) => total + score, 0) / scores.length,
      ratedCount: scores.length,
    };
  });
}
