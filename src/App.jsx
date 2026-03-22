import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Fingerprint,
  LockKeyhole,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import RatingStepper from "./components/RatingStepper";
import ResultsSummary from "./components/ResultsSummary";
import RaterIdentityGate from "./components/RaterIdentityGate";
import SystemResultsPanel from "./components/SystemResultsPanel";
import BoardMatrix from "./components/BoardMatrix";
import ConnectedFieldCanvas from "./components/ConnectedFieldCanvas";
import { DEFAULT_CATEGORIES, RATING_MAX } from "./constants";
import useSoundscape from "./hooks/useSoundscape";
import { fetchPeopleRoster } from "./services/peopleService";
import {
  fetchSharedActivityLog,
  fetchSharedRevealRecords,
  isSharedResultsEnabled,
  saveSharedActivityEntries,
  saveSharedRevealRecord,
} from "./services/sharedResultsService";
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

function createActivityEntryId(entry) {
  if (typeof window !== "undefined" && typeof window.crypto?.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return [
    entry.timestamp,
    entry.type,
    entry.sessionId,
    entry.personId ?? "",
    entry.category ?? "",
  ].join("-");
}

function mergeRevealRecords(...groups) {
  const merged = new Map();

  groups.flat().forEach((record) => {
    if (!record?.sessionId) {
      return;
    }

    const existing = merged.get(record.sessionId);

    if (!existing || String(record.updatedAt).localeCompare(String(existing.updatedAt)) > 0) {
      merged.set(record.sessionId, record);
    }
  });

  return [...merged.values()].sort((left, right) =>
    String(right.updatedAt).localeCompare(String(left.updatedAt)),
  );
}

function mergeActivityLog(...groups) {
  const merged = new Map();

  groups.flat().forEach((entry) => {
    if (!entry?.id) {
      return;
    }

    const existing = merged.get(entry.id);

    if (!existing || String(entry.timestamp).localeCompare(String(existing.timestamp)) > 0) {
      merged.set(entry.id, entry);
    }
  });

  return [...merged.values()].sort((left, right) =>
    String(right.timestamp).localeCompare(String(left.timestamp)),
  );
}

function createHtmlSafeText(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPeopleList(names) {
  return names.length ? names.join(", ") : "No result";
}

function formatExportDateTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function createExportFilename(raterName, exportedAt) {
  const exportStamp = exportedAt.replace(/[:.]/g, "-");
  const safeName =
    (raterName || "system")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "system";

  return `people-rating-report-${safeName}-${exportStamp}.html`;
}

function sanitizeRecordForEmbeddedExport(record) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const { reportFileName, reportHtml, ...rest } = record;

  return {
    ...rest,
    reportFileName: typeof reportFileName === "string" ? reportFileName : "",
  };
}

function buildExportPayload({
  activityLog,
  activeIndex,
  commentsByPerson,
  completedPeople,
  people,
  ratingsByPerson,
  raterName,
  revealRecords,
  sessionId,
  showResults,
  snapshot,
  exportedAt,
}) {
  return {
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
    currentRevealSnapshot: sanitizeRecordForEmbeddedExport(snapshot),
    revealRecords: revealRecords.map(sanitizeRecordForEmbeddedExport).filter(Boolean),
    activityLog,
  };
}

function buildReadableExportHtml({ exportedAt, exportPayload }) {
  const snapshot = exportPayload.currentRevealSnapshot;
  const topRows = snapshot.rankedRows.slice(0, 10);
  const commentEntries = Object.entries(snapshot.commentsByPerson).filter(([, value]) =>
    typeof value === "string" && value.trim(),
  );
  const activityRows = exportPayload.activityLog.slice(0, 25);

  const categoryLeaderRows = snapshot.bestByCategory
    .map(
      (entry) => `
        <div class="dense-row">
          <span>${createHtmlSafeText(entry.category)}</span>
          <strong>${createHtmlSafeText(formatPeopleList(entry.names))} · ${createHtmlSafeText(formatScore(entry.score))}</strong>
        </div>`,
    )
    .join("");

  const categoryAverageRows = snapshot.categoryAverages
    .map(
      (entry) => `
        <div class="dense-row">
          <span>${createHtmlSafeText(entry.category)}</span>
          <strong>${createHtmlSafeText(formatScore(entry.average))}</strong>
        </div>`,
    )
    .join("");

  const rankingRows = topRows
    .map(
      (row) => `
        <tr>
          <td>${createHtmlSafeText(row.rank ?? "--")}</td>
          <td>${createHtmlSafeText(row.person.name)}</td>
          <td>${createHtmlSafeText(formatScore(row.overallScore))}</td>
          ${snapshot.categories
            .map(
              (category) =>
                `<td>${createHtmlSafeText(formatScore(row.categoryScores?.[category] ?? null))}</td>`,
            )
            .join("")}
        </tr>`,
    )
    .join("");

  const coachRows = snapshot.coachInsights
    .slice(0, 8)
    .map(
      (insight) => `
        <article class="coach-card">
          <div class="coach-head">
            <div>
              <h3>${createHtmlSafeText(insight.name)}</h3>
              <p>${createHtmlSafeText(insight.scoreboard)}</p>
            </div>
            <span class="pill">${createHtmlSafeText(insight.profileTag)}</span>
          </div>
          <p class="coach-label">${createHtmlSafeText(insight.instinctLabel)}</p>
          <p>${createHtmlSafeText(insight.profileVerdict)}</p>
          <p class="muted">${createHtmlSafeText(insight.coachComment)}</p>
        </article>`,
    )
    .join("");

  const commentRows = commentEntries.length
    ? commentEntries
        .map(([personId, comment]) => {
          const person = snapshot.rosterSnapshot.find((entry) => entry.id === personId);
          return `
            <article class="comment-card">
              <h3>${createHtmlSafeText(person?.name || personId)}</h3>
              <p>${createHtmlSafeText(comment)}</p>
            </article>`;
        })
        .join("")
    : `<p class="empty">No comments were saved for this reveal.</p>`;

  const activityLogRows = activityRows
    .map(
      (entry) => `
        <tr>
          <td>${createHtmlSafeText(formatExportDateTime(entry.timestamp))}</td>
          <td>${createHtmlSafeText(entry.type)}</td>
          <td>${createHtmlSafeText(entry.summary || "")}</td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${createHtmlSafeText(`Chemistry Rating Report - ${snapshot.raterName || "Unknown"}`)}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #14080d;
        --surface: rgba(43, 14, 23, 0.92);
        --surface-strong: rgba(62, 20, 32, 0.96);
        --border: rgba(255, 225, 214, 0.12);
        --text: #fff3ec;
        --text-soft: #d6b9b6;
        --accent: #ff9fb6;
        --warm: #f6c48d;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Inter", "Segoe UI", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(223, 106, 136, 0.24), transparent 28%),
          linear-gradient(180deg, #14080d 0%, #281019 48%, #12070b 100%);
      }
      main { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 56px; }
      section, article {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 24px;
        padding: 20px;
      }
      h1, h2, h3, p { margin-top: 0; }
      h1, h2, h3 { font-family: "Georgia", serif; letter-spacing: -0.03em; }
      .eyebrow, .pill, th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--accent); }
      .hero { display: grid; gap: 16px; }
      .hero-meta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
      .metric { background: rgba(255,255,255,0.04); border-radius: 18px; padding: 14px; }
      .metric strong { display: block; margin-top: 10px; font-size: 22px; color: var(--text); }
      .results-grid, .coach-grid, .comments-grid { display: grid; gap: 12px; margin-top: 20px; }
      .results-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .coach-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .comments-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .result-card { background: var(--surface-strong); }
      .dense-row { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
      .dense-row:last-child { border-bottom: 0; }
      .dense-row span, .muted, .empty, td { color: var(--text-soft); }
      table { width: 100%; border-collapse: collapse; margin-top: 18px; overflow: hidden; border-radius: 20px; background: rgba(255,255,255,0.04); }
      th, td { padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.08); text-align: left; }
      th { background: rgba(87, 30, 44, 0.84); }
      .coach-card, .comment-card { background: rgba(255,255,255,0.04); }
      .coach-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
      .coach-label { color: var(--warm); font-weight: 700; margin: 12px 0; }
      .pill { display: inline-flex; align-items: center; padding: 8px 11px; border-radius: 999px; background: rgba(255,159,182,0.1); }
      .section-title { margin: 28px 0 14px; }
      details { margin-top: 24px; }
      pre { white-space: pre-wrap; word-break: break-word; color: var(--text-soft); background: rgba(255,255,255,0.04); padding: 16px; border-radius: 16px; overflow: auto; }
      @media (max-width: 980px) {
        .results-grid, .coach-grid, .comments-grid, .hero-meta { grid-template-columns: 1fr; }
        .dense-row, .coach-head { flex-direction: column; }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <div>
          <p class="eyebrow">Saved Reveal Report</p>
          <h1>Chemistry ranking and summary</h1>
          <p class="muted">Saved for ${createHtmlSafeText(snapshot.raterName || "Unknown")} · Exported ${createHtmlSafeText(formatExportDateTime(exportedAt))}</p>
        </div>
        <div class="hero-meta">
          <div class="metric">
            <span class="eyebrow">Top overall</span>
            <strong>${createHtmlSafeText(formatPeopleList(snapshot.bestOverall.names))}</strong>
            <p>${createHtmlSafeText(formatScore(snapshot.bestOverall.score))}</p>
          </div>
          <div class="metric">
            <span class="eyebrow">Girls analyzed</span>
            <strong>${createHtmlSafeText(snapshot.analyzedCount)}</strong>
            <p>${createHtmlSafeText(`${snapshot.peopleCount} in roster`)}</p>
          </div>
          <div class="metric">
            <span class="eyebrow">Saved comments</span>
            <strong>${createHtmlSafeText(commentEntries.length)}</strong>
            <p>Notes included in this report</p>
          </div>
          <div class="metric">
            <span class="eyebrow">Activity log</span>
            <strong>${createHtmlSafeText(exportPayload.activityLog.length)}</strong>
            <p>Recorded actions</p>
          </div>
        </div>
      </section>

      <div class="results-grid">
        <article class="result-card">
          <p class="eyebrow">Category leaders</p>
          ${categoryLeaderRows}
        </article>
        <article class="result-card">
          <p class="eyebrow">Category averages</p>
          ${categoryAverageRows}
        </article>
        <article class="result-card">
          <p class="eyebrow">Rater profile</p>
          <h3>${createHtmlSafeText(snapshot.raterProfile?.headline || "No profile")}</h3>
          <p>${createHtmlSafeText(snapshot.raterProfile?.summary || "No profile summary available.")}</p>
          <p class="muted">${createHtmlSafeText(snapshot.raterProfile?.overallVerdict || "")}</p>
        </article>
        <article class="result-card">
          <p class="eyebrow">Generated summary</p>
          <h3>${createHtmlSafeText(snapshot.generatedSummary?.revealHeadline || "No summary")}</h3>
          <p>${createHtmlSafeText(snapshot.generatedSummary?.profileSummary || "")}</p>
          <p class="muted">${createHtmlSafeText(snapshot.generatedSummary?.coachSummary || "")}</p>
        </article>
      </div>

      <h2 class="section-title">Ranking</h2>
      <section>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Girl</th>
              <th>Overall</th>
              ${snapshot.categories.map((category) => `<th>${createHtmlSafeText(category)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rankingRows}
          </tbody>
        </table>
      </section>

      <h2 class="section-title">Assessment</h2>
      <div class="coach-grid">
        ${coachRows}
      </div>

      <h2 class="section-title">Comments</h2>
      <div class="comments-grid">
        ${commentRows}
      </div>

      <h2 class="section-title">Recent activity</h2>
      <section>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Type</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            ${activityLogRows}
          </tbody>
        </table>
      </section>

      <details>
        <summary>Raw data</summary>
        <pre>${createHtmlSafeText(JSON.stringify(exportPayload, null, 2))}</pre>
      </details>
    </main>
  </body>
</html>`;
}

function downloadFile(filename, contents, type) {
  const blob = new Blob([contents], {
    type,
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
  const sharedResultsEnabled = isSharedResultsEnabled();
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
  const [grayDetectorName, setGrayDetectorName] = useState("");
  const [revealRecords, setRevealRecords] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [sharedStatus, setSharedStatus] = useState(sharedResultsEnabled ? "connecting" : "local");
  const resultsRef = useRef(null);
  const syncedActivityIdsRef = useRef(new Set());
  const grayDetectorTimeoutRef = useRef(null);
  const cursorLabelRef = useRef(null);
  const cursorMotionRef = useRef({
    x: 0,
    y: 0,
    timestamp: 0,
  });
  const {
    soundEnabled,
    soundUnlocked,
    toggleSound,
    playExport,
    playHover,
    playReset,
    playReveal,
    playSlider,
    playStart,
    playStep,
  } = useSoundscape();

  useEffect(() => {
    let mounted = true;

    async function loadRoster() {
      try {
        const roster = await fetchPeopleRoster();
        const storedSession = loadStoredSession();
        const nextSessionId = storedSession.sessionId || createClientSessionId();
        const localRevealRecords = loadStoredRevealRecords();
        const localActivityLog = loadStoredActivityLog();

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
        setRevealRecords(localRevealRecords);
        setActivityLog(localActivityLog);
        syncedActivityIdsRef.current = new Set();

        if (sharedResultsEnabled) {
          try {
            const [remoteRevealRecords, remoteActivityLog] = await Promise.all([
              fetchSharedRevealRecords(),
              fetchSharedActivityLog(),
            ]);

            if (!mounted) {
              return;
            }

            const mergedRevealRecords = mergeRevealRecords(remoteRevealRecords, localRevealRecords);
            const mergedActivityLog = mergeActivityLog(remoteActivityLog, localActivityLog);

            setRevealRecords(mergedRevealRecords);
            setActivityLog(mergedActivityLog);
            syncedActivityIdsRef.current = new Set(
              remoteActivityLog.map((entry) => entry.id).filter(Boolean),
            );
            setSharedStatus("shared");
          } catch {
            if (!mounted) {
              return;
            }

            setSharedStatus("error");
          }
        } else {
          setSharedStatus("local");
        }

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
  }, [sharedResultsEnabled]);

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
    if (status !== "ready" || !sharedResultsEnabled) {
      return;
    }

    let cancelled = false;

    async function refreshSharedResults() {
      try {
        const [remoteRevealRecords, remoteActivityLog] = await Promise.all([
          fetchSharedRevealRecords(),
          fetchSharedActivityLog(),
        ]);

        if (cancelled) {
          return;
        }

        setRevealRecords((current) => mergeRevealRecords(remoteRevealRecords, current));
        setActivityLog((current) => mergeActivityLog(remoteActivityLog, current));
        remoteActivityLog.forEach((entry) => {
          if (entry.id) {
            syncedActivityIdsRef.current.add(entry.id);
          }
        });
        setSharedStatus("shared");
      } catch {
        if (!cancelled) {
          setSharedStatus("error");
        }
      }
    }

    refreshSharedResults();
    const intervalId = window.setInterval(refreshSharedResults, 20000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [sharedResultsEnabled, status]);

  useEffect(() => {
    document.title = "People Rating Flow";
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const root = document.documentElement;
    const cursorLabelNode = cursorLabelRef.current;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targetCursor = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      speed: 0,
      angle: 0,
    };
    const smoothCursor = {
      x: targetCursor.x,
      y: targetCursor.y,
      speed: 0,
    };
    let animationFrameId = 0;

    function setCursorLabel(value) {
      if (!cursorLabelNode) {
        return;
      }

      const label = typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 20) : "";

      cursorLabelNode.textContent = label;
      cursorLabelNode.dataset.visible = label ? "true" : "false";
    }

    function resolveCursorState(target) {
      if (!(target instanceof Element)) {
        return {
          mode: "default",
          label: "",
        };
      }

      if (target.closest('input[type="range"], .category-card')) {
        return {
          mode: "rate",
          label: "Rate",
        };
      }

      if (target.closest("textarea, input:not([type='range'])")) {
        return {
          mode: "text",
          label: "Type",
        };
      }

      const buttonTarget = target.closest("button, [role='button']");

      if (buttonTarget) {
        const rawText =
          buttonTarget.getAttribute("data-cursor-label") ||
          buttonTarget.getAttribute("aria-label") ||
          buttonTarget.textContent ||
          "";
        const normalizedText = rawText.trim().replace(/\s+/g, " ").toLowerCase();
        let label = "Select";

        if (normalizedText.includes("export")) {
          label = "Export";
        } else if (normalizedText.includes("reveal")) {
          label = "Reveal";
        } else if (normalizedText.includes("start")) {
          label = "Start";
        } else if (normalizedText.includes("reset")) {
          label = "Reset";
        } else if (normalizedText.includes("switch")) {
          label = "Switch";
        } else if (normalizedText.includes("next")) {
          label = "Next";
        } else if (normalizedText.includes("previous")) {
          label = "Back";
        }

        return {
          mode: "action",
          label,
        };
      }

      if (target.closest(".progress-person")) {
        return {
          mode: "inspect",
          label: "Jump",
        };
      }

      if (
        target.closest(
          ".result-card, .podium-card, .coach-card, .summary-card, .locked-card, .signal-stage__lead-card, .signal-stage__support-card, .signal-stage__band",
        )
      ) {
        return {
          mode: "inspect",
          label: "",
        };
      }

      return {
        mode: "default",
        label: "",
      };
    }

    function setPointerPosition(event) {
      if (event.pointerType && event.pointerType !== "mouse") {
        root.dataset.cursorVisible = "false";
        return;
      }

      const now = performance.now();
      const previous = cursorMotionRef.current;
      const deltaX = event.clientX - previous.x;
      const deltaY = event.clientY - previous.y;
      const deltaTime = Math.max(now - previous.timestamp, 16);
      const distance = Math.hypot(deltaX, deltaY);
      const speed = Math.min(distance / deltaTime / 1.2, 1.4);
      const angle = distance > 0.5 ? Math.atan2(deltaY, deltaX) : 0;

      root.style.setProperty("--cursor-x", `${event.clientX}px`);
      root.style.setProperty("--cursor-y", `${event.clientY}px`);
        root.style.setProperty("--cursor-speed", speed.toFixed(3));
        root.style.setProperty("--cursor-angle", `${angle}rad`);
      root.dataset.cursorVisible = "true";

      targetCursor.x = event.clientX;
      targetCursor.y = event.clientY;
      targetCursor.speed = speed;
      targetCursor.angle = angle;

      cursorMotionRef.current = {
        x: event.clientX,
        y: event.clientY,
        timestamp: now,
      };
    }

    function handlePointerDown() {
      root.dataset.pointerDown = "true";
    }

    function handlePointerUp() {
      root.dataset.pointerDown = "false";
    }

    function updateCursorMode(event) {
      const target = event.target;
      const nextCursorState = resolveCursorState(target);
      const previousMode = root.dataset.cursorMode || "default";

      root.dataset.cursorMode = nextCursorState.mode;
      setCursorLabel(nextCursorState.label);

      if (
        nextCursorState.mode !== previousMode &&
        (nextCursorState.mode === "action" ||
          nextCursorState.mode === "rate" ||
          nextCursorState.mode === "inspect")
      ) {
        playHover(nextCursorState.mode);
      }
    }

    function handlePointerLeave() {
      root.dataset.cursorVisible = "false";
      root.dataset.cursorMode = "default";
      setCursorLabel("");
    }

    function animateCursorField() {
      const motionEase = prefersReducedMotion ? 0.36 : 0.11;
      const speedEase = prefersReducedMotion ? 0.34 : 0.08;

      smoothCursor.x += (targetCursor.x - smoothCursor.x) * motionEase;
      smoothCursor.y += (targetCursor.y - smoothCursor.y) * motionEase;
      smoothCursor.speed += (targetCursor.speed - smoothCursor.speed) * speedEase;

      const normalizedX = smoothCursor.x / window.innerWidth - 0.5;
      const normalizedY = smoothCursor.y / window.innerHeight - 0.5;
      const softX = normalizedX * 5;
      const softY = normalizedY * 5;
      const mediumX = normalizedX * 10;
      const mediumY = normalizedY * 10;
      const strongX = normalizedX * 16;
      const strongY = normalizedY * 16;

      root.style.setProperty("--cursor-smooth-x", `${smoothCursor.x}px`);
      root.style.setProperty("--cursor-smooth-y", `${smoothCursor.y}px`);
      root.style.setProperty("--cursor-shift-x-soft", `${softX}px`);
      root.style.setProperty("--cursor-shift-y-soft", `${softY}px`);
      root.style.setProperty("--cursor-shift-x-medium", `${mediumX}px`);
      root.style.setProperty("--cursor-shift-y-medium", `${mediumY}px`);
      root.style.setProperty("--cursor-shift-x-strong", `${strongX}px`);
      root.style.setProperty("--cursor-shift-y-strong", `${strongY}px`);
      root.style.setProperty("--cursor-orbit-x", `${normalizedX * 72}px`);
      root.style.setProperty("--cursor-orbit-y", `${normalizedY * 72}px`);
      root.style.setProperty("--cursor-field-bloom", `${0.92 + smoothCursor.speed * 0.22}`);
      root.style.setProperty("--cursor-field-alpha", `${0.12 + smoothCursor.speed * 0.05}`);
      root.style.setProperty("--cursor-field-spark", `${0.2 + smoothCursor.speed * 0.12}`);
      root.style.setProperty("--cursor-field-drift", `${0.42 + smoothCursor.speed * 0.16}`);

      animationFrameId = window.requestAnimationFrame(animateCursorField);
    }

    window.addEventListener("pointermove", setPointerPosition);
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("pointerover", updateCursorMode);
    window.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("blur", handlePointerLeave);
    root.dataset.pointerDown = "false";
    root.dataset.cursorMode = "default";
    root.dataset.cursorVisible = "false";
    root.style.setProperty("--cursor-speed", "0");
    root.style.setProperty("--cursor-angle", "0rad");
    root.style.setProperty("--cursor-smooth-x", `${targetCursor.x}px`);
    root.style.setProperty("--cursor-smooth-y", `${targetCursor.y}px`);
    root.style.setProperty("--cursor-shift-x-soft", "0px");
    root.style.setProperty("--cursor-shift-y-soft", "0px");
    root.style.setProperty("--cursor-shift-x-medium", "0px");
    root.style.setProperty("--cursor-shift-y-medium", "0px");
    root.style.setProperty("--cursor-shift-x-strong", "0px");
    root.style.setProperty("--cursor-shift-y-strong", "0px");
    root.style.setProperty("--cursor-orbit-x", "0px");
    root.style.setProperty("--cursor-orbit-y", "0px");
    root.style.setProperty("--cursor-field-bloom", "1");
    root.style.setProperty("--cursor-field-alpha", "0.24");
    root.style.setProperty("--cursor-field-spark", "0.52");
    root.style.setProperty("--cursor-field-drift", "0.72");
    setCursorLabel("");
    animationFrameId = window.requestAnimationFrame(animateCursorField);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("pointermove", setPointerPosition);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("pointerover", updateCursorMode);
      window.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("blur", handlePointerLeave);
      delete root.dataset.pointerDown;
      delete root.dataset.cursorMode;
      delete root.dataset.cursorVisible;
    };
  }, []);

  useEffect(
    () => () => {
      if (grayDetectorTimeoutRef.current) {
        window.clearTimeout(grayDetectorTimeoutRef.current);
      }
    },
    [],
  );

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

  const overallProgressPercent = people.length ? Math.round((completedPeople / people.length) * 100) : 0;
  const revealProgressPercent = Math.min(
    100,
    Math.round((completedPeople / MIN_COMPLETED_PROFILES) * 100),
  );
  const revealProfilesLeft = Math.max(MIN_COMPLETED_PROFILES - completedPeople, 0);
  const provisionalLeader = bestOverall.people[0]?.name || "No leader yet";
  const hottestCategory = [...categoryAverages]
    .filter((entry) => entry.average !== null)
    .sort((left, right) => right.average - left.average)[0];
  const revealSignalLabel = !raterName
    ? "Awaiting rater identity"
    : hasMinimumProfiles
      ? "Reveal signal live"
      : revealProfilesLeft === 1
        ? "One profile away"
        : `${revealProfilesLeft} profiles to reveal`;
  const signalTapeItems = [
    `Rater: ${raterName || "Not set"}`,
    `Reveal status: ${hasMinimumProfiles ? "Ready" : `${revealProfilesLeft} left`}`,
    `Provisional leader: ${
      bestOverall.score !== null ? `${provisionalLeader} at ${formatScore(bestOverall.score)}` : "No completed leader yet"
    }`,
    `Hottest category: ${
      hottestCategory ? `${hottestCategory.category} at ${formatScore(hottestCategory.average)}` : "No category average yet"
    }`,
    `Board progress: ${completedPeople}/${people.length} completed`,
    `Saved logs: ${activityLog.length}`,
  ];

  function buildReportHtml({
    exportedAt,
    snapshot,
    activityEntries,
    records,
  }) {
    const exportPayload = buildExportPayload({
      activityLog: activityEntries,
      activeIndex,
      commentsByPerson,
      completedPeople,
      people,
      ratingsByPerson,
      raterName,
      revealRecords: records,
      sessionId,
      showResults,
      snapshot,
      exportedAt,
    });

    return buildReadableExportHtml({
      exportedAt,
      exportPayload,
    });
  }

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

    const updatedAt = new Date().toISOString();
    const snapshotBase = {
      ...baseRevealSnapshot,
      updatedAt,
    };
    const reportHtml = buildReportHtml({
      exportedAt: updatedAt,
      snapshot: snapshotBase,
      activityEntries: activityLog,
      records: revealRecords,
    });
    const snapshotToStore = {
      ...snapshotBase,
      reportFileName: createExportFilename(snapshotBase.raterName, updatedAt),
      reportHtml,
    };
    const nextRecords = upsertStoredRevealRecord(snapshotToStore);

    setRevealRecords(nextRecords);

    if (!sharedResultsEnabled) {
      return;
    }

    let cancelled = false;

    async function syncRevealRecord() {
      try {
        const savedRecord = await saveSharedRevealRecord(snapshotToStore);

        if (cancelled || !savedRecord) {
          return;
        }

        setRevealRecords((current) => mergeRevealRecords([savedRecord], current));
        setSharedStatus("shared");
      } catch {
        if (!cancelled) {
          setSharedStatus("error");
        }
      }
    }

    syncRevealRecord();

    return () => {
      cancelled = true;
    };
  }, [baseRevealSnapshot, hasMinimumProfiles, raterName, sessionId, sharedResultsEnabled, showResults, status]);

  useEffect(() => {
    if (status !== "ready" || !sharedResultsEnabled || !activityLog.length) {
      return;
    }

    const unsyncedEntries = activityLog.filter(
      (entry) => entry.id && !syncedActivityIdsRef.current.has(entry.id),
    );

    if (!unsyncedEntries.length) {
      return;
    }

    let cancelled = false;

    async function syncActivityLog() {
      try {
        const savedEntries = await saveSharedActivityEntries(unsyncedEntries);

        if (cancelled) {
          return;
        }

        savedEntries.forEach((entry) => {
          if (entry.id) {
            syncedActivityIdsRef.current.add(entry.id);
          }
        });
        setSharedStatus("shared");
      } catch {
        if (!cancelled) {
          setSharedStatus("error");
        }
      }
    }

    syncActivityLog();

    return () => {
      cancelled = true;
    };
  }, [activityLog, sharedResultsEnabled, status]);

  function appendActivityEntry(entry, overrides = {}) {
    const timestamp = new Date().toISOString();
    const nextEntry = {
      id: createActivityEntryId({
        ...entry,
        ...overrides,
        timestamp,
        sessionId: overrides.sessionId ?? sessionId,
      }),
      timestamp,
      sessionId,
      raterName,
      ...overrides,
      ...entry,
    };

    setActivityLog((current) => [nextEntry, ...current]);
  }

  function finalizeRaterSession(nextName, nextSessionId) {
    setSessionId(nextSessionId);
    setRaterName(nextName);
    setPendingRaterName(nextName);
    setGrayDetectorName("");
    setNameError("");
    setActiveIndex(0);
    playStart();
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

  function handleRatingChange(personId, category, value) {
    const person = people.find((entry) => entry.id === personId);

    setRatingsByPerson((current) => ({
      ...current,
      [personId]: {
        ...(current[personId] ?? {}),
        [category]: value,
      },
    }));
    playSlider(value, RATING_MAX);

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
    setCommentsByPerson((current) => ({
      ...current,
      [personId]: value,
    }));
  }

  function handleCommentCommit(personId, value) {
    const person = people.find((entry) => entry.id === personId);

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
    playStep("next");
    setActiveIndex((current) => Math.min(current + 1, Math.max(people.length - 1, 0)));
  }

  function handlePrevious() {
    playStep("previous");
    setActiveIndex((current) => Math.max(current - 1, 0));
  }

  function handleGoToPerson(index) {
    playStep("next");
    setActiveIndex(index);
  }

  function handleReset() {
    const confirmed = window.confirm("Clear every rating and start over?");

    if (!confirmed) {
      return;
    }

    playReset();
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
    const hasGrayDetectorMatch = /m/i.test(nextName);

    if (grayDetectorTimeoutRef.current) {
      window.clearTimeout(grayDetectorTimeoutRef.current);
    }

    if (hasGrayDetectorMatch) {
      setSessionId(nextSessionId);
      setPendingRaterName(nextName);
      setGrayDetectorName(nextName);
      setNameError("");
      grayDetectorTimeoutRef.current = window.setTimeout(() => {
        grayDetectorTimeoutRef.current = null;
        finalizeRaterSession(nextName, nextSessionId);
      }, 5000);
      return;
    }

    finalizeRaterSession(nextName, nextSessionId);
  }

  function handleSwitchRater() {
    const confirmed = window.confirm(
      "Start a new rater session? This clears the current draft but keeps saved reveal records.",
    );

    if (!confirmed) {
      return;
    }

    playReset();
    if (grayDetectorTimeoutRef.current) {
      window.clearTimeout(grayDetectorTimeoutRef.current);
      grayDetectorTimeoutRef.current = null;
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
    setGrayDetectorName("");
    setNameError("");
    setSessionId(createClientSessionId());
  }

  function handleRevealRanking() {
    if (!hasMinimumProfiles || !raterName) {
      return;
    }

    playReveal();
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
    const exportLogEntry = {
      id: createActivityEntryId({
        timestamp: exportedAt,
        type: "data_exported",
        sessionId,
      }),
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
    const snapshot = {
      ...baseRevealSnapshot,
      updatedAt: exportedAt,
    };
    const exportPayload = buildExportPayload({
      activityLog: nextActivityLog,
      activeIndex,
      commentsByPerson,
      completedPeople,
      people,
      ratingsByPerson,
      raterName,
      revealRecords,
      sessionId,
      showResults,
      snapshot,
      exportedAt,
    });

    setActivityLog(nextActivityLog);

    const exportHtml = buildReadableExportHtml({
      exportedAt,
      exportPayload,
    });

    playExport();
    downloadFile(createExportFilename(raterName, exportedAt), exportHtml, "text/html");
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

  if (grayDetectorName) {
    return (
      <main className="app-shell app-shell--detector">
        <section className="detector-screen">
          <p className="detector-screen__eyebrow">Surprise check</p>
          <h1>Gray detector: Detected</h1>
          <p className="detector-screen__name">{grayDetectorName}</p>
          <p className="detector-screen__copy">
            Hold for 5 seconds. The rating flow will continue automatically.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="scene-backdrop" aria-hidden="true">
        <ConnectedFieldCanvas />
        <span className="scene-backdrop__field scene-backdrop__field--aurora" />
        <span className="scene-backdrop__nebula scene-backdrop__nebula--one" />
        <span className="scene-backdrop__nebula scene-backdrop__nebula--two" />
        <span className="scene-backdrop__stars scene-backdrop__stars--far" />
        <span className="scene-backdrop__stars scene-backdrop__stars--near" />
        <span className="scene-backdrop__beam scene-backdrop__beam--left" />
        <span className="scene-backdrop__beam scene-backdrop__beam--right" />
        <span className="scene-backdrop__ring scene-backdrop__ring--one" />
        <span className="scene-backdrop__ring scene-backdrop__ring--two" />
        <span className="scene-backdrop__grain" />
      </div>

      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">
            <Sparkles size={16} />
            Shared rating system
          </span>
          <p className="hero-kicker">
            {!raterName
              ? "Identity required before the board begins."
              : hasMinimumProfiles
                ? "Reveal unlocked. The board is ready to open."
                : "Scoring in progress. The reveal opens after five completed profiles."}
          </p>
          <h1>Chemistry Rating Studio</h1>
          <p className="hero-copy__promise">
            Reveal a shared ranking after five completed profiles, then keep sharpening the board
            in real time.
          </p>
          <p className="hero-copy__lead">
            Identity, scoring, comments, summaries, exports, and saved reveals all stay attached
            to the active rater session.
          </p>
          <div className="hero-meta-strip">
            <span>Shared saves</span>
            <span>Readable HTML export</span>
            <span>Live reveal progression</span>
          </div>
        </div>

        <div className="hero-progress">
          <div className="hero-progress__header">
            <div className="hero-progress__eyebrow-row">
              <p className="eyebrow">Live board status</p>
              <button
                type="button"
                className="sound-toggle"
                onClick={toggleSound}
                data-cursor-label="Sound"
                aria-pressed={soundEnabled}
                aria-label={soundEnabled ? "Mute sound" : "Enable sound"}
              >
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                <span>{soundEnabled ? "Sound on" : "Sound off"}</span>
              </button>
            </div>
            <strong>{raterName || "Waiting for rater"}</strong>
            <p className="hero-progress__status-copy">
              {!raterName
                ? "No rater identity has been locked yet."
                : hasMinimumProfiles
                  ? "The reveal threshold has been met and the report can be opened."
                  : "The board is still building toward the first shared reveal."}
            </p>
          </div>
          <div
            className={`hero-beacon ${
              hasMinimumProfiles
                ? "hero-beacon--live"
                : revealProfilesLeft === 1
                  ? "hero-beacon--hot"
                  : ""
            }`}
          >
            <span className="hero-beacon__label">Reveal signal</span>
            <strong>{revealSignalLabel}</strong>
            <p>
              {bestOverall.score !== null
                ? `${provisionalLeader} is currently leading at ${formatScore(bestOverall.score)} overall.`
                : "Complete full profiles to surface a provisional leader."}
            </p>
          </div>
          <div className="hero-progress__stats">
            <div className="hero-progress__stat">
              <span>Girls completed</span>
              <strong>
                {completedPeople}/{people.length}
              </strong>
            </div>
            <div className="hero-progress__stat">
              <span>Reveal threshold</span>
              <strong>{MIN_COMPLETED_PROFILES} full girls</strong>
            </div>
            <div className="hero-progress__stat">
              <span>Saved logs</span>
              <strong>{activityLog.length}</strong>
            </div>
            <div className="hero-progress__stat">
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
          <p className="hero-progress__sound-note">
            {soundUnlocked
              ? "Reactive ambience and interaction sounds are live."
              : "Sound unlocks on the first click or key press."}
          </p>
          <div className="hero-progress__meter">
            <div>
              <span>Roster progress</span>
              <strong>{overallProgressPercent}%</strong>
            </div>
            <div className="hero-progress__track">
              <span style={{ width: `${overallProgressPercent}%` }} />
            </div>
          </div>
          <div className="hero-progress__meter">
            <div>
              <span>Reveal progress</span>
              <strong>{revealProgressPercent}%</strong>
            </div>
            <div className="hero-progress__track hero-progress__track--warm">
              <span style={{ width: `${revealProgressPercent}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="signal-ribbon" aria-label="Live board signals">
        <div className="signal-ribbon__track">
          {[...signalTapeItems, ...signalTapeItems].map((item, index) => (
            <span key={`${item}-${index}`}>{item}</span>
          ))}
        </div>
      </section>

      <section className="workflow-shell" aria-label="Workflow stages">
        <div className="workflow-band">
          <div className="workflow-band__threshold">
            <span>Reveal threshold</span>
            <strong>{String(MIN_COMPLETED_PROFILES).padStart(2, "0")}</strong>
            <p>Complete five full profiles to unlock the first ranking, then keep sharpening the board.</p>
          </div>
          <div className="workflow-band__tags">
            <span>1-10 locked sliders</span>
            <span>Name-bound dataset</span>
            <span>Readable HTML dossier</span>
          </div>
        </div>

        <div className="workflow-shell__header">
          <div>
            <p className="eyebrow">Workflow</p>
            <h2>Three clear phases, one saved board.</h2>
          </div>
          <p>
            The interface now moves like a session: identify the rater, build the board, then open
            the report.
          </p>
        </div>

        <div className="stage-strip">
          <article
            className={`stage-card ${!raterName ? "stage-card--active" : "stage-card--done"}`}
          >
            <span className="stage-card__icon">
              <Fingerprint size={16} />
            </span>
            <span className="stage-card__index">01</span>
            <div className="stage-card__copy">
              <p>Identify</p>
              <strong>Set the rater name and lock the session identity.</strong>
            </div>
          </article>
          <article
            className={`stage-card ${
              raterName && !showResults
                ? "stage-card--active"
                : showResults
                  ? "stage-card--done"
                  : ""
            }`}
          >
            <span className="stage-card__icon">
              <SlidersHorizontal size={16} />
            </span>
            <span className="stage-card__index">02</span>
            <div className="stage-card__copy">
              <p>Score</p>
              <strong>Rate profiles, leave comments, and build the board.</strong>
            </div>
          </article>
          <article className={`stage-card ${showResults ? "stage-card--active" : ""}`}>
            <span className="stage-card__icon">
              <Trophy size={16} />
            </span>
            <span className="stage-card__index">03</span>
            <div className="stage-card__copy">
              <p>Reveal</p>
              <strong>Unlock the ranking, summary, and export snapshot.</strong>
            </div>
          </article>
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
            <section className="summary-card summary-card--setup">
              <p className="eyebrow">How it works</p>
              <div className="setup-list">
                <p>Enter the rater name to tie the full board to one identity.</p>
                <p>Complete any five full profiles to unlock the first reveal.</p>
                <p>Export a clean HTML report whenever you want a snapshot.</p>
              </div>
            </section>

            <SystemResultsPanel onExportData={handleExportData} />
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
              onCommentCommit={handleCommentCommit}
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

              <section className="summary-card summary-card--identity">
                <p className="eyebrow">Active rater</p>
                <h2 className="summary-card__title">{raterName}</h2>
                <p className="summary-card__text">
                  Reveal snapshots, logs, comments, and summaries are saved under this name.
                </p>
                <div className="summary-metric-grid">
                  <div className="summary-metric">
                    <span>Completed</span>
                    <strong>{completedPeople}</strong>
                  </div>
                  <div className="summary-metric">
                    <span>Logs</span>
                    <strong>{activityLog.length}</strong>
                  </div>
                  <div className="summary-metric">
                    <span>Reveal</span>
                    <strong>{showResults ? "Live" : "Locked"}</strong>
                  </div>
                </div>
              </section>

              <section className="summary-card summary-card--lineup">
                <p className="eyebrow">Lineup progress</p>
                <div className="progress-summary-grid">
                  <div className="progress-summary-card">
                    <span>Done</span>
                    <strong>{completedPeople}</strong>
                  </div>
                  <div className="progress-summary-card">
                    <span>Left</span>
                    <strong>{Math.max(people.length - completedPeople, 0)}</strong>
                  </div>
                  <div className="progress-summary-card">
                    <span>Threshold</span>
                    <strong>{MIN_COMPLETED_PROFILES}</strong>
                  </div>
                </div>
                <ul className="progress-list">
                  {people.map((person, index) => {
                    const completedCategories = DEFAULT_CATEGORIES.filter((category) =>
                      isValidRating(Number(ratingsByPerson?.[person.id]?.[category])),
                    ).length;
                    const complete = completedCategories === DEFAULT_CATEGORIES.length;
                    const completionPercent = Math.round(
                      (completedCategories / DEFAULT_CATEGORIES.length) * 100,
                    );

                    return (
                      <li key={person.id}>
                        <button
                          type="button"
                          className={`progress-person ${
                            index === activeIndex ? "progress-person--active" : ""
                          }`}
                          onClick={() => handleGoToPerson(index)}
                        >
                          <div className="progress-person__copy">
                            <span>{person.name}</span>
                            <small>
                              {complete
                                ? "Fully scored"
                                : `${completedCategories}/${DEFAULT_CATEGORIES.length} categories complete`}
                            </small>
                            <div className="progress-person__bar" aria-hidden="true">
                              <span style={{ width: `${completionPercent}%` }} />
                            </div>
                          </div>
                          <strong>{complete ? "Done" : `${completionPercent}%`}</strong>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className="summary-card summary-card--controls">
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

              <SystemResultsPanel onExportData={handleExportData} />
            </aside>
          </section>

          <BoardMatrix
            activeIndex={activeIndex}
            categories={DEFAULT_CATEGORIES}
            onGoToPerson={handleGoToPerson}
            people={people}
            ratingsByPerson={ratingsByPerson}
          />

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
