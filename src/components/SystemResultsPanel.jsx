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

export default function SystemResultsPanel({
  activityLog,
  currentSessionId,
  onExportData,
  records,
}) {
  const latestLog = activityLog[0] ?? null;

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
          <span>{activityLog.length} logs</span>
          <span>{latestLog ? `Last log ${formatDateTime(latestLog.timestamp)}` : "No logs yet"}</span>
        </div>
        <button type="button" className="action-button action-button--ghost" onClick={onExportData}>
          Export JSON
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
                  <span>{record.categories.length} categories</span>
                </div>

                <div className="system-record__leader">
                  <Trophy size={14} />
                  <span>{formatPeople(record.bestOverall.names)}</span>
                  <strong>{formatScore(record.bestOverall.score)}</strong>
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
