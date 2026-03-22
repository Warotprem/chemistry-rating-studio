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
  const topRows = rankedRows.filter((row) => row.displayRank !== null).slice(0, 3);
  const leadNames = formatPeople(bestOverall.people);
  const leadInsight = coachInsights[0];
  const profileSummaryById = Object.fromEntries(
    rankedRows.map((row) => [row.person.id, typeof row.person.summary === "string" ? row.person.summary.trim() : ""]),
  );

  return (
    <section ref={sectionRef} className="results-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Final reveal</p>
          <span className="results-panel__stamp">Ranking report</span>
          <h2>Chemistry ranking and summary</h2>
          <p className="results-panel__subhead">Saved for {raterName}</p>
        </div>
        <span className="completion-badge completion-badge--done">Complete score set collected</span>
      </div>

      <div className="results-report-head">
        <section className="results-lead-callout">
          <p className="result-card__label">Lead statement</p>
          <h3>
            {leadNames} set the pace at {formatScore(bestOverall.score)} overall.
          </h3>
          <p>
            {raterProfile?.summary ||
              "The board now has enough completed profiles to show a real pattern instead of loose guesses."}
          </p>
        </section>

        <div className="results-hero-band">
          <div>
            <p className="result-card__label">Lead result</p>
            <strong>{formatPeople(bestOverall.people)}</strong>
            <span>Highest overall board score at reveal time.</span>
          </div>
          <div>
            <p className="result-card__label">Overall score</p>
            <strong>{formatScore(bestOverall.score)}</strong>
            <span>Calculated from the completed category average.</span>
          </div>
          <div>
            <p className="result-card__label">Profiles analyzed</p>
            <strong>{analyzedCount}</strong>
            <span>Completed profiles included in this report.</span>
          </div>
        </div>
      </div>

      <div className="results-insight-strip">
        <article className="results-insight-card results-insight-card--feature">
          <p className="result-card__label">Rater profile</p>
          <h3>{raterProfile?.headline || "Profile still forming"}</h3>
          <p>
            {raterProfile?.overallVerdict ||
              "Reveal more completed profiles to make the taste profile sharper."}
          </p>
        </article>

        <article className="results-insight-card">
          <p className="result-card__label">Lead read</p>
          <h3>{leadInsight?.name || "No assessment yet"}</h3>
          <p>
            {leadInsight?.coachComment ||
              "Once the reveal is available, the strongest profile note will surface here."}
          </p>
        </article>
      </div>

      {topRows.length ? (
        <div className="results-podium">
          {topRows.map((row, index) => (
            <article
              key={row.person.id}
              className={`podium-card ${index === 0 ? "podium-card--lead" : ""}`}
            >
              <p className="result-card__label">
                {index === 0 ? "Current leader" : `Place ${index + 1}`}
              </p>
              <h3>{row.person.name}</h3>
              <strong>{formatScore(row.overallScore)}</strong>
              <span>
                {row.displayRank ? `Rank ${row.displayRank}` : "Unranked"} ·{" "}
                {row.person.role || "Scored profile"}
              </span>
            </article>
          ))}
        </div>
      ) : null}

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
              <tr
                key={row.person.id}
                className={row.displayRank && row.displayRank <= 3 ? "ranking-row--top" : ""}
              >
                <td>
                  <span className="rank-badge">{row.displayRank ?? "--"}</span>
                </td>
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

              {profileSummaryById[insight.id] ? (
                <p className="coach-card__comment">{profileSummaryById[insight.id]}</p>
              ) : null}
              <p>{insight.profileVerdict}</p>
              <p className="coach-card__note">{insight.coachComment}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
