import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, LockKeyhole, RotateCcw, Sparkles } from "lucide-react";
import RatingStepper from "./components/RatingStepper";
import ResultsSummary from "./components/ResultsSummary";
import { DEFAULT_CATEGORIES } from "./constants";
import { fetchPeopleRoster } from "./services/peopleService";
import { buildCoachInsights, buildRaterProfile } from "./utils/conclusions";
import {
  buildPeopleWithRatings,
  buildRankedRows,
  formatScore,
  getBestByCategory,
  getBestOverall,
  getCategoryAverages,
  isValidRating,
} from "./utils/scoring";
import {
  createEmptyRatingsMap,
  getCompletedPeopleCount,
  hasReachedMinimumRatings,
  MIN_COMPLETED_PROFILES,
} from "./utils/session";
import {
  clearStoredRatings,
  loadStoredRatings,
  saveStoredRatings,
} from "./utils/storage";

function getLockedMessage(totalPeople, completedPeople, minimumCompletedProfiles) {
  if (!totalPeople) {
    return "Waiting for the people list.";
  }

  if (completedPeople < minimumCompletedProfiles) {
    return `Complete at least ${minimumCompletedProfiles} full girls to unlock the conclusions. You can rate the rest anytime after that.`;
  }

  return `You have unlocked the conclusions with ${completedPeople} completed girls. Keep rating more girls to sharpen the ranking.`;
}

export default function App() {
  const [people, setPeople] = useState([]);
  const [ratingsByPerson, setRatingsByPerson] = useState({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [status, setStatus] = useState("loading");
  const resultsRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    async function loadRoster() {
      try {
        const roster = await fetchPeopleRoster();

        if (!mounted) {
          return;
        }

        const initialRatings = loadStoredRatings(roster, DEFAULT_CATEGORIES);

        setPeople(roster);
        setRatingsByPerson(initialRatings);
        setShowResults(false);
        setStatus("ready");
      } catch {
        if (!mounted) {
          return;
        }

        setStatus("error");
      }
    }

    loadRoster();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (status !== "ready" || !people.length) {
      return;
    }

    saveStoredRatings(ratingsByPerson);
  }, [people.length, ratingsByPerson, status]);

  useEffect(() => {
    document.title = "People Rating Flow";
  }, []);

  const completedPeople = useMemo(
    () => getCompletedPeopleCount(people, DEFAULT_CATEGORIES, ratingsByPerson),
    [people, ratingsByPerson],
  );

  const hasMinimumProfiles = useMemo(
    () => hasReachedMinimumRatings(people, DEFAULT_CATEGORIES, ratingsByPerson),
    [people, ratingsByPerson],
  );

  const ratedPeople = useMemo(
    () => buildPeopleWithRatings(people, ratingsByPerson),
    [people, ratingsByPerson],
  );

  const completedPeopleOnly = useMemo(
    () =>
      ratedPeople.filter((person) =>
        DEFAULT_CATEGORIES.every((category) => isValidRating(Number(person.ratings?.[category]))),
      ),
    [ratedPeople],
  );

  const rankedRows = useMemo(
    () => buildRankedRows(completedPeopleOnly, "overall", DEFAULT_CATEGORIES),
    [completedPeopleOnly],
  );

  const bestOverall = useMemo(
    () => getBestOverall(completedPeopleOnly, DEFAULT_CATEGORIES),
    [completedPeopleOnly],
  );

  const bestByCategory = useMemo(
    () => getBestByCategory(completedPeopleOnly, DEFAULT_CATEGORIES),
    [completedPeopleOnly],
  );

  const categoryAverages = useMemo(
    () => getCategoryAverages(completedPeopleOnly, DEFAULT_CATEGORIES),
    [completedPeopleOnly],
  );

  const coachInsights = useMemo(
    () => buildCoachInsights(completedPeopleOnly, DEFAULT_CATEGORIES),
    [completedPeopleOnly],
  );

  const raterProfile = useMemo(
    () => buildRaterProfile(completedPeopleOnly, DEFAULT_CATEGORIES),
    [completedPeopleOnly],
  );

  function handleRatingChange(personId, category, value) {
    setRatingsByPerson((current) => ({
      ...current,
      [personId]: {
        ...(current[personId] ?? {}),
        [category]: value,
      },
    }));
  }

  function handleNext() {
    setActiveIndex((current) => Math.min(current + 1, Math.max(people.length - 1, 0)));
  }

  function handlePrevious() {
    setActiveIndex((current) => Math.max(current - 1, 0));
  }

  function handleGoToPerson(index) {
    setActiveIndex(index);
  }

  function handleReset() {
    const confirmed = window.confirm("Clear every rating and start over?");

    if (!confirmed) {
      return;
    }

    const clearedRatings = createEmptyRatingsMap(people, DEFAULT_CATEGORIES);

    clearStoredRatings();
    setRatingsByPerson(clearedRatings);
    setActiveIndex(0);
    setShowResults(false);
  }

  function handleRevealRanking() {
    if (!hasMinimumProfiles) {
      return;
    }

    setShowResults(true);

    window.setTimeout(() => {
      resultsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  if (status === "loading") {
    return (
      <main className="app-shell">
        <section className="state-panel">
          <p className="eyebrow">Loading roster</p>
          <h1>Preparing the rating flow.</h1>
          <p>Fetching the people list and any saved visitor progress.</p>
        </section>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="app-shell">
        <section className="state-panel">
          <p className="eyebrow">Something failed</p>
          <h1>The people list could not be loaded.</h1>
          <p>Check the roster service setup and try again.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">
            <Sparkles size={16} />
            Chemistry Rating Studio
          </span>
          <h1>Rate any girls you want. You can reveal results once at least five full girls are complete.</h1>
          <p>
            Rate any girls you want in any order. Once at least five full girls are done, the
            reveal unlocks and keeps updating as you finish more.
          </p>
          <div className="hero-note">
            Finish rule: complete any 5 girls to unlock the conclusions. You can stop there or keep going.
          </div>
        </div>

        <div className="hero-progress">
          <div className="hero-progress__row">
            <span>Girls completed</span>
            <strong>
              {completedPeople}/{people.length}
            </strong>
          </div>
          <div className="hero-progress__row">
            <span>Reveal threshold</span>
            <strong>{MIN_COMPLETED_PROFILES} full girls</strong>
          </div>
          <div className="hero-progress__row">
            <span>Required categories</span>
            <strong>{DEFAULT_CATEGORIES.length}</strong>
          </div>
          <div className="hero-progress__row">
            <span>Status</span>
            <strong>{hasMinimumProfiles ? "Reveal ready" : "Scoring in progress"}</strong>
          </div>
        </div>
      </section>

      <section className="content-grid">
        <RatingStepper
          activeIndex={activeIndex}
          categories={DEFAULT_CATEGORIES}
          onGoToPerson={handleGoToPerson}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onRatingChange={handleRatingChange}
          people={people}
          ratingsByPerson={ratingsByPerson}
        />

        <aside className="side-panel">
          <section className="locked-card">
            <div className="locked-card__header">
              {hasMinimumProfiles ? <CheckCircle2 size={18} /> : <LockKeyhole size={18} />}
              <strong>{hasMinimumProfiles ? "Reveal ready" : "Reveal locked"}</strong>
            </div>
            <p>{getLockedMessage(people.length, completedPeople, MIN_COMPLETED_PROFILES)}</p>
            <div className="locked-card__notice">
              Minimum to finish: {MIN_COMPLETED_PROFILES} fully rated girls.
            </div>
            <button
              type="button"
              className="action-button action-button--secondary"
              disabled={!hasMinimumProfiles}
              onClick={handleRevealRanking}
            >
              <ArrowRight size={16} />
              {showResults ? "Jump to ranking" : "Reveal ranking"}
            </button>
          </section>

          <section className="summary-card">
            <p className="eyebrow">Lineup progress</p>
            <ul className="progress-list">
              {people.map((person, index) => {
                const completedCategories = DEFAULT_CATEGORIES.filter((category) =>
                  isValidRating(Number(ratingsByPerson?.[person.id]?.[category])),
                ).length;
                const complete = completedCategories === DEFAULT_CATEGORIES.length;

                return (
                  <li key={person.id}>
                    <button
                      type="button"
                      className={`progress-person ${
                        index === activeIndex ? "progress-person--active" : ""
                      }`}
                      onClick={() => handleGoToPerson(index)}
                    >
                      <span>{person.name}</span>
                      <strong>
                        {complete
                          ? "Done"
                          : `${completedCategories}/${DEFAULT_CATEGORIES.length}`}
                      </strong>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="summary-card">
            <p className="eyebrow">Session controls</p>
            <button type="button" className="action-button action-button--ghost" onClick={handleReset}>
              <RotateCcw size={16} />
              Reset ratings
            </button>
          </section>
        </aside>
      </section>

      {showResults ? (
        <ResultsSummary
          sectionRef={resultsRef}
          analyzedCount={completedPeopleOnly.length}
          bestByCategory={bestByCategory}
          bestOverall={bestOverall}
          categoryAverages={categoryAverages}
          categories={DEFAULT_CATEGORIES}
          coachInsights={coachInsights}
          peopleCount={people.length}
          raterProfile={raterProfile}
          rankedRows={rankedRows}
        />
      ) : (
        <section className="results-placeholder">
          <p className="eyebrow">After five full girls</p>
          <h2>Complete five full girls, then hit the button to reveal the ranking.</h2>
          <p>
            Once five girls are fully scored, the reveal button becomes active. After that, the
            ranking and analysis update as you complete more girls.
          </p>
        </section>
      )}

      {showResults && bestOverall.score !== null ? (
        <section className="completion-note">
          <p className="eyebrow">Current leader</p>
          <h2>
            {bestOverall.people.map((person) => person.name).join(", ")} lead with{" "}
            {formatScore(bestOverall.score)} overall.
          </h2>
        </section>
      ) : null}
    </main>
  );
}
