import { Crown, Medal, Scale, Users } from "lucide-react";
import { formatScore } from "../utils/scoring";

function formatPeople(people) {
  return people.length ? people.map((person) => person.name).join(", ") : "No result";
}

export default function ResultsSummary({
  sectionRef,
  analyzedCount,
  bestByCategory,
  bestOverall,
  categoryAverages,
  categories,
  coachInsights,
  peopleCount,
  raterName,
  raterProfile,
  rankedRows,
}) {
  return (
    <section ref={sectionRef} className="results-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Final reveal</p>
          <h2>Chemistry ranking and summary</h2>
          <p className="results-panel__subhead">Saved for {raterName}</p>
        </div>
        <span className="completion-badge completion-badge--done">Complete score set collected</span>
      </div>

      <div className="results-grid">
        <article className="result-card result-card--feature">
          <div className="result-card__icon">
            <Crown size={18} />
          </div>
          <p className="result-card__label">Top overall</p>
          <h3>{formatPeople(bestOverall.people)}</h3>
          <strong>{formatScore(bestOverall.score)}</strong>
        </article>

        <article className="result-card">
          <div className="result-card__icon">
            <Users size={18} />
          </div>
          <p className="result-card__label">Girls analyzed</p>
          <h3>{analyzedCount}</h3>
          <strong>{peopleCount} in roster · {categories.length} categories each</strong>
        </article>

        <article className="result-card">
          <div className="result-card__icon">
            <Medal size={18} />
          </div>
          <p className="result-card__label">Category leaders</p>
          <div className="dense-list">
            {bestByCategory.map((entry) => (
              <div key={entry.category} className="dense-list__row">
                <span>{entry.category}</span>
                <strong>
                  {formatPeople(entry.people)} · {formatScore(entry.score)}
                </strong>
              </div>
            ))}
          </div>
        </article>

        <article className="result-card">
          <div className="result-card__icon">
            <Scale size={18} />
          </div>
          <p className="result-card__label">Category averages</p>
          <div className="dense-list">
            {categoryAverages.map((entry) => (
              <div key={entry.category} className="dense-list__row">
                <span>{entry.category}</span>
                <strong>{formatScore(entry.average)}</strong>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="ranking-wrap">
        <table className="ranking-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Girl</th>
              <th>Overall</th>
              {categories.map((category) => (
                <th key={category}>{category}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rankedRows.map((row) => (
              <tr key={row.person.id}>
                <td>{row.displayRank ?? "--"}</td>
                <td>
                  <div className="person-cell">
                    <strong>{row.person.name}</strong>
                    {row.person.role ? <span>{row.person.role}</span> : null}
                  </div>
                </td>
                <td>{formatScore(row.overallScore)}</td>
                {categories.map((category) => (
                  <td key={category}>{formatScore(row.categoryScores[category])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {raterProfile ? (
        <section className="taste-section">
          <div className="panel-head panel-head--coach">
            <div>
              <p className="eyebrow">Your taste</p>
              <h2>What your ratings say about you</h2>
            </div>
            <span className="completion-badge">{raterProfile.headline}</span>
          </div>

          <article className="taste-card">
            <p>{raterProfile.summary}</p>
            <p className="taste-verdict">{raterProfile.overallVerdict}</p>
            <div className="taste-metrics">
              <span>Visual pull {formatScore(raterProfile.metrics.visualAverage)}</span>
              <span>Character pull {formatScore(raterProfile.metrics.characterAverage)}</span>
              <span>Personal average {formatScore(raterProfile.metrics.personalAverage)}</span>
            </div>
            <div className="taste-points">
              {raterProfile.bullets.map((bullet) => (
                <p key={bullet}>{bullet}</p>
              ))}
            </div>
          </article>
        </section>
      ) : null}

      <section className="coach-section">
        <div className="panel-head panel-head--coach">
          <div>
            <p className="eyebrow">Assessment</p>
            <h2>How each girl is likely to read</h2>
          </div>
          <span className="completion-badge">Direct interpretation</span>
        </div>

        <div className="coach-grid">
          {coachInsights.map((insight) => (
            <article key={insight.id} className="coach-card">
              <div className="coach-card__header">
                <div>
                  <h3>{insight.name}</h3>
                  {insight.role ? <p>{insight.role}</p> : null}
                </div>
                <span className="coach-card__badge">{insight.profileTag}</span>
              </div>

              <div className="coach-card__meta">
                <span>{insight.scoreboard}</span>
                <strong>{insight.instinctLabel}</strong>
              </div>

              <p>{insight.profileVerdict}</p>
              <p className="coach-card__note">{insight.coachComment}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
