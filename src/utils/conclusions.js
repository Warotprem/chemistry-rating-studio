import { PERSONAL_RATING_CATEGORY } from "../constants";
import { formatScore, getCategoryScore, getOverallScore } from "./scoring";

function getCoreCategories(categories) {
  return categories.filter((category) => category !== PERSONAL_RATING_CATEGORY);
}

function average(values) {
  if (!values.length) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function averageCategory(people, category) {
  return average(
    people
      .map((person) => getCategoryScore(person, category))
      .filter((score) => score !== null),
  );
}

function getCoreAverage(person, categories) {
  return average(
    getCoreCategories(categories)
      .map((category) => getCategoryScore(person, category))
      .filter((score) => score !== null),
  );
}

function getVisualAverage(person) {
  return average([getCategoryScore(person, "Body"), getCategoryScore(person, "Face")].filter(Boolean));
}

function getCharacterAverage(person) {
  return average(
    [
      getCategoryScore(person, "Personality"),
      getCategoryScore(person, "Wifey Qualities"),
      getCategoryScore(person, "Mother of a Kid"),
    ].filter((score) => score !== null),
  );
}

function getScoreProfileRead(person, categories) {
  const overallScore = getOverallScore(person, categories);
  const visualAverage = getVisualAverage(person);
  const characterAverage = getCharacterAverage(person);
  const personalRating = getCategoryScore(person, PERSONAL_RATING_CATEGORY);
  const coreAverage = getCoreAverage(person, categories);
  const delta =
    personalRating !== null && coreAverage !== null ? personalRating - coreAverage : null;

  if (overallScore === null) {
    return {
      tag: "Not enough signal",
      verdict:
        "There is not enough score data here for a confident read yet. Finish the board before treating this as a stable conclusion.",
    };
  }

  if (
    visualAverage !== null &&
    characterAverage !== null &&
    overallScore >= 4.1 &&
    Math.abs(visualAverage - characterAverage) < 0.35
  ) {
    return {
      tag: "Strong all-rounder",
      verdict:
        "This profile scores well across both attraction and long-term categories. The case is broad, not just carried by one lane.",
    };
  }

  if (
    visualAverage !== null &&
    characterAverage !== null &&
    visualAverage - characterAverage >= 0.6
  ) {
    return {
      tag: "Visual-first profile",
      verdict:
        "The visual side is clearly leading the board here. The appeal is strong, but it is being carried more by surface pull than by long-term categories.",
    };
  }

  if (
    visualAverage !== null &&
    characterAverage !== null &&
    characterAverage - visualAverage >= 0.5
  ) {
    return {
      tag: "Long-term profile",
      verdict:
        "This profile wins more on personality and partner-value categories than on immediate visual impact. The strength here looks steadier than flashy.",
    };
  }

  if (delta !== null && delta >= 0.6) {
    return {
      tag: "Instinct favorite",
      verdict:
        "Your final personal score is running ahead of the rest of the board. That usually means this person fits your taste more than the category sheet alone explains.",
    };
  }

  if (delta !== null && delta <= -0.6) {
    return {
      tag: "Undersold by instinct",
      verdict:
        "The category sheet is stronger than your final personal score. Something in the full package is not landing as well as the individual parts suggest.",
    };
  }

  return {
    tag: "Mixed case",
    verdict:
      "The board shows some clear positives, but not a fully dominant pattern. This looks more like a selective or situational case than an obvious consensus one.",
  };
}

function getInstinctRead(delta) {
  if (delta === null) {
    return {
      label: "Incomplete read",
      coachComment:
        "You have not committed to a final view yet, so there is no meaningful instinct read here.",
    };
  }

  if (delta >= 0.9) {
    return {
      label: "You are overbuying",
      coachComment:
        "You are giving this girl more credit than your own category scores justify. That usually means attraction is outrunning your stated criteria.",
    };
  }

  if (delta >= 0.35) {
    return {
      label: "Instinct is leading",
      coachComment:
        "You clearly like this girl more than the board itself supports. The final score is being carried more by instinct than by evidence.",
    };
  }

  if (delta <= -0.9) {
    return {
      label: "You do not buy it",
      coachComment:
        "Your scores say there is value, but your final reaction remains restrained. That usually means the chemistry is not fully there.",
    };
  }

  if (delta <= -0.35) {
    return {
      label: "Instinct is skeptical",
      coachComment:
        "Your final instinct is cooler than the category sheet. Something about the overall package is not landing, even if individual parts score well.",
    };
  }

  return {
    label: "Clean read",
    coachComment:
      "Your instinct and your scoring match. This is a clear, internally consistent assessment.",
  };
}

export function buildCoachInsights(people, categories) {
  return people
    .map((person) => {
      const personalRating = getCategoryScore(person, PERSONAL_RATING_CATEGORY);
      const coreAverage = getCoreAverage(person, categories);
      const overallScore = getOverallScore(person, categories);
      const delta =
        personalRating !== null && coreAverage !== null ? personalRating - coreAverage : null;
      const instinctRead = getInstinctRead(delta);
      const profileRead = getScoreProfileRead(person, categories);

      return {
        id: person.id,
        name: person.name,
        role: person.role,
        overallScore,
        personalRating,
        coreAverage,
        delta,
        instinctLabel: instinctRead.label,
        profileTag: profileRead.tag,
        profileVerdict: profileRead.verdict,
        coachComment: instinctRead.coachComment,
        scoreboard: `Personal ${formatScore(personalRating)} vs core ${formatScore(coreAverage)}`,
      };
    })
    .sort((left, right) => {
      const leftDelta = Math.abs(left.delta ?? 0);
      const rightDelta = Math.abs(right.delta ?? 0);

      if (rightDelta !== leftDelta) {
        return rightDelta - leftDelta;
      }

      return (right.overallScore ?? 0) - (left.overallScore ?? 0);
    });
}

export function buildRaterProfile(people, categories) {
  if (!people.length) {
    return null;
  }

  const bodyAverage = averageCategory(people, "Body") ?? 0;
  const faceAverage = averageCategory(people, "Face") ?? 0;
  const personalityAverage = averageCategory(people, "Personality") ?? 0;
  const wifeyAverage = averageCategory(people, "Wifey Qualities") ?? 0;
  const motherAverage = averageCategory(people, "Mother of a Kid") ?? 0;
  const personalAverage = averageCategory(people, PERSONAL_RATING_CATEGORY) ?? 0;
  const visualAverage = (bodyAverage + faceAverage) / 2;
  const characterAverage = (personalityAverage + wifeyAverage + motherAverage) / 3;
  const averageDelta =
    average(
      people
        .map((person) => {
          const personal = getCategoryScore(person, PERSONAL_RATING_CATEGORY);
          const core = getCoreAverage(person, categories);
          return personal !== null && core !== null ? personal - core : null;
        })
        .filter((delta) => delta !== null),
    ) ?? 0;

  const categoryAverages = [
    { category: "Body", value: bodyAverage },
    { category: "Face", value: faceAverage },
    { category: "Personality", value: personalityAverage },
    { category: "Wifey Qualities", value: wifeyAverage },
    { category: "Mother of a Kid", value: motherAverage },
  ].sort((left, right) => right.value - left.value);

  const topCategory = categoryAverages[0]?.category ?? null;
  const lowCategory = categoryAverages[categoryAverages.length - 1]?.category ?? null;

  let headline = "Balanced but selective";
  let summary =
    "There is a clear pattern in what you reward. Your board has structure, and the scores make your taste reasonably easy to read.";
  let overallVerdict =
    "You are not random, but your strongest preferences still show through clearly in the final board.";

  if (visualAverage - characterAverage >= 0.45) {
    headline = "Looks-first rater";
    summary =
      "Your board is clearly led more by face and body than by softer personality categories. If someone looks right, you are willing to forgive a lot.";
    overallVerdict =
      "You may talk in broader terms, but your scoring pattern still prioritizes visual pull first.";
  } else if (characterAverage - visualAverage >= 0.35) {
    headline = "Personality-leaning rater";
    summary =
      "You are not purely visual. You give real credit to people who feel steady, easy, and long-term, even when the physical side is not perfect.";
    overallVerdict =
      "You are trying to judge substance, not just surface. Whether that reads as maturity or overcorrection depends on the person.";
  }

  if (topCategory) {
    summary += ` Your strongest category on average is ${topCategory}.`;
  }

  const bullets = [];

  if (averageDelta >= 0.35) {
    bullets.push(
      "You trust your gut more than your own structure. When someone fits your taste, the personal score tends to move ahead of the evidence.",
    );
  } else if (averageDelta <= -0.35) {
    bullets.push(
      "You are harsher in the final call than in the category sheet. You often award decent category scores, then pull back when the full picture does not convince you.",
    );
  } else {
    bullets.push(
      "Your personal rating usually stays close to the rest of your board. You are more controlled than impulsive, at least in your scoring pattern.",
    );
  }

  if (topCategory === "Body" || topCategory === "Face") {
    bullets.push(
      "The board reacts fastest to obvious physical upside. Strong visual impact still earns immediate credit from you.",
    );
  } else if (
    topCategory === "Personality" ||
    topCategory === "Wifey Qualities" ||
    topCategory === "Mother of a Kid"
  ) {
    bullets.push(
      "You give meaningful weight to long-term and interpersonal categories. The board is not just following looks.",
    );
  }

  if (
    (bodyAverage + faceAverage) / 2 >= (wifeyAverage + motherAverage) / 2 + 0.3 &&
    lowCategory !== null
  ) {
    bullets.push(
      "Relationship-value categories trail attraction on your board. That gap is visible once the averages are lined up.",
    );
  } else if ((wifeyAverage + motherAverage) / 2 >= (bodyAverage + faceAverage) / 2 + 0.2) {
    bullets.push(
      "Long-term stability matters in your scoring. You are willing to rank substance above immediate visual payoff.",
    );
  }

  return {
    headline,
    summary,
    overallVerdict,
    bullets: bullets.slice(0, 3),
    metrics: {
      visualAverage,
      characterAverage,
      personalAverage,
    },
  };
}
