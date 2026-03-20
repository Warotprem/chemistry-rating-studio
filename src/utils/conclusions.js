import { PERSONAL_RATING_CATEGORY } from "../constants";
import { formatScore, getCategoryScore, getOverallScore } from "./scoring";

function getCoreCategories(categories) {
  return categories.filter((category) => category !== PERSONAL_RATING_CATEGORY);
}

function getCoreAverage(person, categories) {
  const scores = getCoreCategories(categories)
    .map((category) => getCategoryScore(person, category))
    .filter((score) => score !== null);

  if (!scores.length) {
    return null;
  }

  return scores.reduce((total, score) => total + score, 0) / scores.length;
}

function getNoteFragments(notes) {
  return notes
    .split(",")
    .map((fragment) => fragment.trim())
    .filter(Boolean)
    .filter(
      (fragment) =>
        !/^(thai|russian|chinese|asian|japanese|korean|wasian)$/i.test(fragment),
    );
}

function rewriteFragment(fragment) {
  const text = fragment.toLowerCase().trim();

  if (text.includes("juicy body")) return "strong physical presence";
  if (text.includes("perfect body")) return "exceptional physical presence";
  if (text.includes("good body")) return "good physical presence";
  if (text.includes("bad body")) return "a weaker physical profile";
  if (text.includes("beautiful face")) return "a notably strong face";
  if (text.includes("very beautiful face")) return "an exceptionally strong face";
  if (text.includes("decent face")) return "a reasonably solid face";
  if (text.includes("ok face")) return "an acceptable face";
  if (text.includes("good face")) return "a strong face";
  if (text.includes("not the best face")) return "a less convincing face";
  if (text.includes("good looking")) return "strong visual appeal";
  if (text.includes("lots of makeup")) return "a highly styled presentation";
  if (text.includes("smiley")) return "an easy, upbeat energy";
  if (text.includes("nice personality")) return "a clearly likable personality";
  if (text.includes("nice person")) return "a pleasant overall temperament";
  if (text === "nice") return "a consistently pleasant temperament";
  if (text.includes("not really nice")) return "a difficult interpersonal edge";
  if (text.includes("mean girl")) return "a sharp social edge";
  if (text.includes("annoying")) return "a noticeable irritation factor";
  if (text.includes("aggressive")) return "a forceful personality";
  if (text.includes("quiet")) return "a quieter presence";
  if (text.includes("artistic")) return "an artistic streak";
  if (text.includes("hidden gem")) return "underrated upside";
  if (text.includes("bubbly")) return "a lively, outgoing personality";
  if (text.includes("smart")) return "clear intelligence";
  if (text.includes("stupid")) return "limited intellectual appeal";
  if (text.includes("leadership")) return "natural leadership presence";
  if (text.includes("has voice")) return "strong personal presence";
  if (text.includes("sporty")) return "a sporty presentation";
  if (text.includes("swimmer")) return "an athletic profile";
  if (text.includes("footballer")) return "a sporty, athletic profile";
  if (text.includes("athlete")) return "an athletic profile";
  if (text.includes("tanned")) return "a sun-toned look";
  if (text.includes("slim")) return "a slimmer build";
  if (text.includes("small")) return "a smaller frame";
  if (text.includes("slightly big")) return "a fuller build";
  if (text === "big") return "a larger frame";
  if (text.includes("slightly wide")) return "a broader build";
  if (text === "wide") return "a broader build";
  if (text.includes("curly hair")) return "distinctive hair and styling";
  if (text.includes("blonde")) return "a striking blonde look";
  if (text.includes("ginger")) return "a distinctive ginger look";
  if (text.includes("eyebrows")) return "strong facial definition";
  if (text.includes("strong facial structure")) return "strong facial structure";
  if (text.includes("weird in a good way")) return "an unusual but memorable appeal";
  if (text.includes("love-hate")) return "a polarizing presence";
  if (text.includes("taken")) return "limited availability";
  if (text === "idk") return "an unclear overall read";

  return text;
}

function formatFragments(fragments) {
  if (!fragments.length) {
    return "";
  }

  const rewritten = fragments.map(rewriteFragment);

  if (rewritten.length === 1) {
    return rewritten[0];
  }

  if (rewritten.length === 2) {
    return `${rewritten[0]} and ${rewritten[1]}`;
  }

  return `${rewritten[0]}, ${rewritten[1]}, and ${rewritten[2]}`;
}

function getProfileRead(notes) {
  const text = notes.toLowerCase();
  const fragments = getNoteFragments(notes).slice(0, 3);
  const detail = fragments.length ? ` She comes across as ${formatFragments(fragments)}.` : "";

  if (!text.trim() || text.includes("idk")) {
    return {
      tag: "Not enough signal",
      verdict:
        "There is not enough reliable signal here for a confident assessment. A high score would say more about projection than judgment.",
    };
  }

  if (text.includes("taken")) {
    return {
      tag: "Locked girl",
      verdict:
        `The appeal may be real, but she is effectively unavailable. A very high score would be rewarding a situation with limited real upside.${detail}`,
    };
  }

  if (
    /(mean|annoying|aggressive|stupid|not really nice)/.test(text) &&
    /(beautiful|good body|good face|decent face|juicy|perfect body|good looking)/.test(text)
  ) {
    return {
      tag: "Looks vs attitude",
      verdict:
        `The visual case is strong, but the temperament risk is equally visible. This type of girl often lands well at first and weakens under closer judgment.${detail}`,
    };
  }

  if (/(beautiful|perfect body|juicy|very beautiful face|beautiful face)/.test(text)) {
    return {
      tag: "High ceiling",
      verdict:
        `This is clearly top-tier upside. A low score would be hard to defend on merit alone.${detail}`,
    };
  }

  if (/(niche|quiet|hidden gem|artistic|weird in a good way)/.test(text)) {
    return {
      tag: "Niche pick",
      verdict:
        `This is a selective rather than universal type of appeal. A high score here would say as much about your taste as about broad consensus.${detail}`,
    };
  }

  if (/(swimmer|footballer|sporty|athlete|tanned)/.test(text)) {
    return {
      tag: "Sporty value",
      verdict:
        `She reads as more athletic and grounded than glamorous. Strong practical appeal, though not the kind of presence that dominates a room on face value alone.${detail}`,
    };
  }

  if (/(nice|smiley|bubbly|smart|leadership|has voice)/.test(text)) {
    return {
      tag: "Strong all-rounder",
      verdict:
        `She has enough warmth and substance to remain attractive beyond first impression. This is an all-round case, not a single-trait one.${detail}`,
    };
  }

  return {
    tag: "Mixed case",
    verdict:
      `There is some value here, but not a fully convincing case. A high ranking would need a clearer justification than general interest.${detail}`,
  };
}

function getInstinctRead(delta) {
  if (delta === null) {
    return {
      label: "Incomplete read",
      coachComment: "You have not committed to a final view yet, so there is no meaningful instinct read here.",
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
      const profileRead = getProfileRead(person.privateNotes ?? "");

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

function averagePersonalByPattern(people, pattern) {
  return average(
    people
      .filter((person) => pattern.test((person.privateNotes ?? "").toLowerCase()))
      .map((person) => getCategoryScore(person, PERSONAL_RATING_CATEGORY))
      .filter((score) => score !== null),
  );
}

function getTopNoteSignals(people) {
  const buckets = new Map();

  people
    .map((person) => ({
      personal: getCategoryScore(person, PERSONAL_RATING_CATEGORY) ?? 0,
      fragments: getNoteFragments(person.privateNotes ?? "").slice(0, 3),
    }))
    .sort((left, right) => right.personal - left.personal)
    .slice(0, 7)
    .forEach((entry) => {
      entry.fragments.forEach((fragment) => {
        const key = fragment.toLowerCase();
        buckets.set(key, {
          label: fragment,
          score: (buckets.get(key)?.score ?? 0) + entry.personal,
        });
      });
    });

  return [...buckets.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((entry) => entry.label);
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
  const nicheAverage =
    averagePersonalByPattern(people, /(niche|quiet|artistic|hidden gem|weird in a good way)/) ?? 0;
  const warmAverage =
    averagePersonalByPattern(people, /(nice|smiley|bubbly|warm|very nice|nice personality)/) ?? 0;
  const flashyAverage =
    averagePersonalByPattern(people, /(beautiful|juicy|perfect body|very beautiful face|good looking)/) ?? 0;
  const topSignals = getTopNoteSignals(people);

  let headline = "Balanced but selective";
  let summary =
    "There is a clear pattern in what you reward. You are not random, and your board makes your taste pretty easy to read.";
  let overallVerdict =
    "You have some structure, but your taste still shows through in very obvious ways.";

  if (visualAverage - characterAverage >= 0.45) {
    headline = "Looks-first rater";
    summary =
      "Your board is clearly led more by face and body than by softer personality categories. If a girl looks right, you are willing to forgive a lot.";
    overallVerdict =
      "You are not evaluating in a fully balanced way. You may speak in broader terms, but your board still prioritizes visual pull first.";
  } else if (characterAverage - visualAverage >= 0.35) {
    headline = "Personality-leaning rater";
    summary =
      "You are not purely visual. You give real credit to girls who feel nice, easy, and long-term, even when the physical side is not perfect.";
    overallVerdict =
      "You are trying to judge substance, not just surface. Whether that reads as maturity or overcorrection depends on the girl.";
  }

  if (topSignals.length) {
    summary += ` The girls you rate highly tend to combine ${formatFragments(topSignals)}.`;
  }

  const bullets = [];

  if (averageDelta >= 0.35) {
    bullets.push(
      "You trust your gut more than your own structure. When a girl fits your taste, the personal score starts moving ahead of the evidence.",
    );
  } else if (averageDelta <= -0.35) {
    bullets.push(
      "You are harsher in your final call than in the category sheet. You award decent category scores, then pull back when the full picture does not convince you.",
    );
  } else {
    bullets.push(
      "Your personal rating usually stays close to the rest of your board. You are more controlled than impulsive, at least in your scoring pattern.",
    );
  }

  if (nicheAverage >= personalAverage + 0.25) {
    bullets.push(
      "You have a clear preference for niche girls. Quiet, artistic, or less obvious girls receive extra credit from you with surprising consistency.",
    );
  } else if (flashyAverage >= personalAverage + 0.25) {
    bullets.push(
      "You respond quickly to obvious upside. When a girl has clear visual impact, your standards become noticeably more flexible.",
    );
  }

  if (warmAverage >= personalAverage + 0.2) {
    bullets.push(
      "You are noticeably easier on girls who seem warm, smiley, or easy to like. Positive energy earns immediate credit from you.",
    );
  } else if (wifeyAverage < bodyAverage && wifeyAverage < faceAverage) {
    bullets.push(
      "You mention long-term categories, but your actual board still leans more toward attraction than relationship value. Your scoring pattern makes that clear.",
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
