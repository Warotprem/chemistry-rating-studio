import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, LockKeyhole, RotateCcw, Sparkles } from "lucide-react";
import RatingStepper from "./components/RatingStepper";
import ResultsSummary from "./components/ResultsSummary";
import RaterIdentityGate from "./components/RaterIdentityGate";
import SystemResultsPanel from "./components/SystemResultsPanel";
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
  createEmptyCommentsMap,
  createEmptyRatingsMap,
  getCompletedPeopleCount,
  hasReachedMinimumRatings,
  MIN_COMPLETED_PROFILES,
} from "./utils/session";
import {
  clearStoredComments,
  clearStoredSession,
  clearStoredRatings,
  createClientSessionId,
  loadStoredActivityLog,
  loadStoredComments,
  loadStoredRatings,
  loadStoredRevealRecords,
  loadStoredSession,
  saveStoredActivityLog,
  saveStoredComments,
  saveStoredRatings,
  saveStoredSession,
  sanitizeRaterName,
  upsertStoredRevealRecord,
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

function buildRosterSnapshot(people) {
  return people.map((person) => ({
    id: person.id,
    name: person.name,
    role: person.role,
    summary: person.summary,
    privateNotes: person.privateNotes,
  }));
}

function buildRevealSnapshot({
  bestByCategory,
  bestOverall,
  categoryAverages,
  categories,
  coachInsights,
  commentsByPerson,
  completedPeople,
  people,
  rankedRows,
  ratingsByPerson,
  raterName,
  raterProfile,
  sessionId,
}) {
  return {
    sessionId,
    raterName,
    analyzedCount: completedPeople.length,
    peopleCount: people.length,
    categories: [...categories],
    rosterSnapshot: buildRosterSnapshot(people),
    ratingsByPerson,
    commentsByPerson,
    bestOverall: {
      names: bestOverall.people.map((person) => person.name),
      score: bestOverall.score,
    },
    bestByCategory: bestByCategory.map((entry) => ({
      category: entry.category,
      names: entry.people.map((person) => person.name),
      score: entry.score,
    })),
    categoryAverages: categoryAverages.map((entry) => ({
      category: entry.category,
      average: entry.average,
      ratedCount: entry.ratedCount,
    })),
    rankedRows: rankedRows.map((row) => ({
      rank: row.displayRank,
      person: {
        id: row.person.id,
        name: row.person.name,
        role: row.person.role,
        summary: row.person.summary,
      },
      overallScore: row.overallScore,
      categoryScores: row.categoryScores,
    })),
    coachInsights,
    raterProfile,
    generatedSummary: {
      revealHeadline:
        bestOverall.score === null
          ? "No reveal result available."
          : `${bestOverall.people.map((person) => person.name).join(", ")} lead with ${formatScore(bestOverall.score)} overall.`,
      profileHeadline: raterProfile?.headline || "",
      profileSummary: raterProfile?.summary || "",
      profileVerdict: raterProfile?.overallVerdict || "",
      coachSummary: coachInsights[0]?.coachComment || "No coach summary available.",
    },
  };
}

function downloadJsonFile(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 0);
}

export default function App() {
  const [people, setPeople] = useState([]);
  const [ratingsByPerson, setRatingsByPerson] = useState({});
  const [commentsByPerson, setCommentsByPerson] = useState({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [status, setStatus] = useState("loading");
  const [raterName, setRaterName] = useState("");
  const [pendingRaterName, setPendingRaterName] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [nameError, setNameError] = useState("");
  const [revealRecords, setRevealRecords] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const resultsRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    async function loadRoster() {
      try {
        const roster = await fetchPeopleRoster();
        const storedSession = loadStoredSession();
        const nextSessionId = storedSession.sessionId || createClientSessionId();

        if (!mounted) {
          return;
        }

        setPeople(roster);
        setRatingsByPerson(loadStoredRatings(roster, DEFAULT_CATEGORIES));
        setCommentsByPerson(loadStoredComments(roster));
        setShowResults(false);
        setRaterName(storedSession.raterName);
        setPendingRaterName(storedSession.raterName);
        setSessionId(nextSessionId);
        setRevealRecords(loadStoredRevealRecords());
        setActivityLog(loadStoredActivityLog());
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
    if (status !== "ready" || !people.length) {
      return;
    }

    saveStoredComments(commentsByPerson);
  }, [commentsByPerson, people.length, status]);

  useEffect(() => {
    if (status !== "ready" || !raterName || !sessionId) {
      return;
    }

    saveStoredSession({
      raterName,
      sessionId,
    });
  }, [raterName, sessionId, status]);

  useEffect(() => {
    if (status !== "ready") {
      return;
    }

    saveStoredActivityLog(activityLog);
  }, [activityLog, status]);

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

  const baseRevealSnapshot = useMemo(
    () =>
      buildRevealSnapshot({
        bestByCategory,
        bestOverall,
        categoryAverages,
        categories: DEFAULT_CATEGORIES,
        coachInsights,
        commentsByPerson,
        completedPeople: completedPeopleOnly,
        people,
        rankedRows,
        ratingsByPerson,
        raterName,
        raterProfile,
        sessionId,
      }),
    [
      bestByCategory,
      bestOverall,
      categoryAverages,
      coachInsights,
      commentsByPerson,
      completedPeopleOnly,
      people,
      rankedRows,
      ratingsByPerson,
      raterName,
      raterProfile,
      sessionId,
    ],
  );

  useEffect(() => {
    if (
      status !== "ready" ||
      !showResults ||
      !hasMinimumProfiles ||
      !raterName ||
      !sessionId
    ) {
      return;
    }

    const nextRecords = upsertStoredRevealRecord({
      ...baseRevealSnapshot,
      updatedAt: new Date().toISOString(),
    });

    setRevealRecords(nextRecords);
  }, [baseRevealSnapshot, hasMinimumProfiles, raterName, sessionId, showResults, status]);

  function appendActivityEntry(entry, overrides = {}) {
    const timestamp = new Date().toISOString();

    setActivityLog((current) => [
      {
        timestamp,
        sessionId,
        raterName,
        ...overrides,
        ...entry,
      },
      ...current,
    ]);
  }

  function handleRatingChange(personId, category, value) {
    const person = people.find((entry) => entry.id === personId);

    setRatingsByPerson((current) => ({
      ...current,
      [personId]: {
        ...(current[personId] ?? {}),
        [category]: value,
      },
    }));

    appendActivityEntry({
      type: "rating_changed",
      personId,
      personName: person?.name || "",
      category,
      value,
      summary: `${person?.name || "Unknown"} rated ${value} for ${category}.`,
    });
  }

  function handleCommentChange(personId, value) {
    const person = people.find((entry) => entry.id === personId);

    setCommentsByPerson((current) => ({
      ...current,
      [personId]: value,
    }));

    appendActivityEntry({
      type: "comment_updated",
      personId,
      personName: person?.name || "",
      comment: value,
      summary: `${person?.name || "Unknown"} comment updated.`,
      details: {
        commentLength: value.length,
      },
    });
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

    clearStoredRatings();
    clearStoredComments();
    setRatingsByPerson(createEmptyRatingsMap(people, DEFAULT_CATEGORIES));
    setCommentsByPerson(createEmptyCommentsMap(people));
    setActiveIndex(0);
    setShowResults(false);
    appendActivityEntry({
      type: "ratings_reset",
      summary: "Ratings and comments reset for the current session.",
    });
  }

  function handleRaterNameSubmit(event) {
    event.preventDefault();

    const nextName = sanitizeRaterName(pendingRaterName);

    if (!nextName) {
      setNameError("Enter the rater's name before starting.");
      return;
    }

    const nextSessionId = sessionId || createClientSessionId();

    setSessionId(nextSessionId);
    setRaterName(nextName);
    setPendingRaterName(nextName);
    setNameError("");
    setActiveIndex(0);
    appendActivityEntry(
      {
        type: "session_started",
        summary: `Session started for ${nextName}.`,
      },
      {
        sessionId: nextSessionId,
        raterName: nextName,
      },
    );
  }

  function handleSwitchRater() {
    const confirmed = window.confirm(
      "Start a new rater session? This clears the current draft but keeps saved reveal records.",
    );

    if (!confirmed) {
      return;
    }

    appendActivityEntry({
      type: "switch_rater",
      summary: "Started a new rater session.",
    });

    clearStoredRatings();
    clearStoredComments();
    clearStoredSession();
    setRatingsByPerson(createEmptyRatingsMap(people, DEFAULT_CATEGORIES));
    setCommentsByPerson(createEmptyCommentsMap(people));
    setActiveIndex(0);
    setShowResults(false);
    setRaterName("");
    setPendingRaterName("");
    setNameError("");
    setSessionId(createClientSessionId());
  }

  function handleRevealRanking() {
    if (!hasMinimumProfiles || !raterName) {
      return;
    }

    setShowResults(true);
    appendActivityEntry({
      type: "results_revealed",
      summary: `Results revealed for ${raterName}.`,
      details: {
        analyzedCount: completedPeopleOnly.length,
      },
    });

    window.setTimeout(() => {
      resultsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  function handleExportData() {
    const exportedAt = new Date().toISOString();
    const exportStamp = exportedAt.replace(/[:.]/g, "-");
    const safeName =
      (raterName || "system")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "system";
    const exportLogEntry = {
      timestamp: exportedAt,
      sessionId,
      raterName,
      type: "data_exported",
      summary: "Full system dataset exported.",
      details: {
        exportedAt,
        revealRecordCount: revealRecords.length,
        activityLogCount: activityLog.length + 1,
      },
    };
    const nextActivityLog = [exportLogEntry, ...activityLog];

    const exportPayload = {
      exportedAt,
      app: "people-rating-flow",
      currentSession: {
        sessionId,
        raterName,
        activeIndex,
        showResults,
        completedPeople,
        totalPeople: people.length,
      },
      rosterSnapshot: buildRosterSnapshot(people),
      currentDraft: {
        ratingsByPerson,
        commentsByPerson,
      },
      currentRevealSnapshot: {
        ...baseRevealSnapshot,
        updatedAt: exportedAt,
      },
      revealRecords,
      activityLog: nextActivityLog,
    };

    setActivityLog(nextActivityLog);

    downloadJsonFile(`people-rating-export-${safeName}-${exportStamp}.json`, exportPayload);
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
            reveal unlocks, saves the full dataset under the rater's name, and keeps updating as
            you finish more.
          </p>
          <div className="hero-note">
            Finish rule: complete any 5 girls to unlock the conclusions. Ratings, comments, logs, and summaries are stored and exportable.
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
            <span>Saved logs</span>
            <strong>{activityLog.length}</strong>
          </div>
          <div className="hero-progress__row">
            <span>Rater</span>
            <strong>{raterName || "Name required"}</strong>
          </div>
          <div className="hero-progress__row">
            <span>Status</span>
            <strong>
              {!raterName
                ? "Waiting for rater"
                : hasMinimumProfiles
                  ? "Reveal ready"
                  : "Scoring in progress"}
            </strong>
          </div>
        </div>
      </section>

      {!raterName ? (
        <section className="content-grid">
          <RaterIdentityGate
            errorMessage={nameError}
            onChange={(value) => {
              setPendingRaterName(value);
              if (nameError) {
                setNameError("");
              }
            }}
            onSubmit={handleRaterNameSubmit}
            value={pendingRaterName}
          />

          <aside className="side-panel">
            <SystemResultsPanel
              activityLog={activityLog}
              currentSessionId={sessionId}
              onExportData={handleExportData}
              records={revealRecords}
            />
          </aside>
        </section>
      ) : (
        <>
          <section className="content-grid">
            <RatingStepper
              activeIndex={activeIndex}
              categories={DEFAULT_CATEGORIES}
              commentsByPerson={commentsByPerson}
              onCommentChange={handleCommentChange}
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
                  {showResults
                    ? `Latest revealed result, comments, summaries, and logs are being saved for ${raterName}.`
                    : `Minimum to finish: ${MIN_COMPLETED_PROFILES} fully rated girls.`}
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
                <p className="eyebrow">Active rater</p>
                <h2 className="summary-card__title">{raterName}</h2>
                <p className="summary-card__text">
                  Reveal snapshots, logs, comments, and summaries are saved under this name.
                </p>
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
                <div className="control-stack">
                  <button
                    type="button"
                    className="action-button action-button--ghost"
                    onClick={handleReset}
                  >
                    <RotateCcw size={16} />
                    Reset ratings
                  </button>
                  <button
                    type="button"
                    className="action-button action-button--ghost"
                    onClick={handleSwitchRater}
                  >
                    Switch rater
                  </button>
                </div>
              </section>

              <SystemResultsPanel
                activityLog={activityLog}
                currentSessionId={sessionId}
                onExportData={handleExportData}
                records={revealRecords}
              />
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
              raterName={raterName}
              raterProfile={raterProfile}
              rankedRows={rankedRows}
            />
          ) : (
            <section className="results-placeholder">
              <p className="eyebrow">After five full girls</p>
              <h2>Complete five full girls, then hit the button to reveal the ranking.</h2>
              <p>
                Once five girls are fully scored, the reveal button becomes active. After that, the
                ranking, comments, logs, and analysis update as you complete more girls, and the
                saved system record updates too.
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
        </>
      )}
    </main>
  );
}
