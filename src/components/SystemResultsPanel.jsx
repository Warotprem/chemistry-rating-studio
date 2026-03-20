import { Database, Trophy } from "lucide-react";
import { formatScore } from "../utils/scoring";

function formatDateTime(value) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatPeople(names) {
  return names.length ? names.join(", ") : "No result";
}

function getCommentCount(record) {
  return Object.values(record.commentsByPerson ?? {}).filter(
    (value) => typeof value === "string" && value.trim(),
  ).length;
}

export default function SystemResultsPanel({
  activityLog,
  currentSessionId,
  onExportData,
  records,
  storageMode,
}) {
  const latestLog = activityLog[0] ?? null;
  const storageLabel =
    storageMode === "shared"
      ? "Shared across devices"
      : storageMode === "connecting"
        ? "Connecting shared storage"
        : storageMode === "error"
          ? "Shared storage error"
          : "Local device only";

  return (
    <section className="summary-card">
      <div className="panel-head panel-head--compact">
        <div>
          <p className="eyebrow">System records</p>
          <h2>Saved reveal history</h2>
        </div>
        <span className="completion-badge">
          <Database size={14} />
          {records.length} saved
        </span>
      </div>

      <div className="system-records__toolbar">
        <div className="system-records__stats">
          <span>{storageLabel}</span>
          <span>{activityLog.length} logs</span>
          <span>{latestLog ? `Last log ${formatDateTime(latestLog.timestamp)}` : "No logs yet"}</span>
        </div>
        <button type="button" className="action-button action-button--ghost" onClick={onExportData}>
          Export report
        </button>
      </div>

      {records.length ? (
        <div className="system-records">
          {records.map((record) => {
            const isCurrent = record.sessionId === currentSessionId;

            return (
              <article
                key={record.sessionId}
                className={`system-record ${isCurrent ? "system-record--current" : ""}`}
              >
                <div className="system-record__header">
                  <div>
                    <strong>{record.raterName}</strong>
                    <p>Saved {formatDateTime(record.updatedAt)}</p>
                  </div>
                  {isCurrent ? <span className="system-record__badge">Current session</span> : null}
                </div>

                <div className="system-record__meta">
                  <span>
                    {record.analyzedCount}/{record.peopleCount} girls analyzed
                  </span>
                  <span>{getCommentCount(record)} comments</span>
                </div>

                <div className="system-record__results">
                  <div className="system-record__leader">
                    <Trophy size={14} />
                    <span>{formatPeople(record.bestOverall.names)}</span>
                    <strong>{formatScore(record.bestOverall.score)}</strong>
                  </div>

                  <div className="system-record__snapshot">
                    <div className="system-mini-grid">
                      <article className="system-mini-card system-mini-card--feature">
                        <p className="result-card__label">Top overall</p>
                        <h3>{formatPeople(record.bestOverall.names)}</h3>
                        <strong>{formatScore(record.bestOverall.score)}</strong>
                      </article>

                      <article className="system-mini-card">
                        <p className="result-card__label">Generated summary</p>
                        <p>{record.generatedSummary?.revealHeadline || "No summary available."}</p>
                      </article>

                      <article className="system-mini-card">
                        <p className="result-card__label">Rater profile</p>
                        <h3>{record.raterProfile?.headline || "No profile"}</h3>
                        <p>{record.raterProfile?.summary || "No profile summary available."}</p>
                      </article>
                    </div>

                    <div className="system-dense-list">
                      {record.bestByCategory.slice(0, 3).map((entry) => (
                        <div key={entry.category} className="dense-list__row">
                          <span>{entry.category}</span>
                          <strong>
                            {formatPeople(entry.names || [])} · {formatScore(entry.score)}
                          </strong>
                        </div>
                      ))}
                    </div>

                    <div className="system-ranking-wrap">
                      <table className="ranking-table">
                        <thead>
                          <tr>
                            <th>Rank</th>
                            <th>Girl</th>
                            <th>Overall</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(record.rankedRows ?? []).slice(0, 5).map((row, index) => (
                            <tr key={`${record.sessionId}-${row.person?.id || index}`}>
                              <td>{row.rank ?? "--"}</td>
                              <td>{row.person?.name || "Unknown"}</td>
                              <td>{formatScore(row.overallScore)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="system-records__empty">
          No reveal has been saved yet. When a rater unlocks the ranking and clicks reveal, the
          latest result will appear here.
        </p>
      )}
    </section>
  );
}
