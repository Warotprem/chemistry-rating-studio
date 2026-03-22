export default function RaterIdentityGate({
  errorMessage,
  onChange,
  onSubmit,
  value,
}) {
  const highlights = [
    {
      title: "Identity-bound save trail",
      text: "Reveals, comments, summaries, and logs stay attached to the same rater name.",
    },
    {
      title: "Consistent scoring board",
      text: "Whole-number sliders keep the board comparable from one profile to the next.",
    },
    {
      title: "Readable report output",
      text: "The export downloads as a clean HTML dossier instead of a raw data dump.",
    },
  ];

  const initials = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  return (
    <section className="identity-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Before you start</p>
          <h2>Enter the rater's name</h2>
        </div>
        <span className="completion-badge">Required to continue</span>
      </div>

      <div className="identity-shell">
        <div className="identity-intro">
          <div className="identity-intro__hero">
            <p className="eyebrow">Identity protocol</p>
            <h3>One name. One saved rating trail.</h3>
          </div>

          <p className="identity-panel__copy">
            The rating session is tied to the rater's name, and the revealed result will be saved
            under that identity in the system log.
          </p>

          <div className="identity-highlights">
            {highlights.map((highlight) => (
              <article key={highlight.title} className="identity-highlight">
                <h4>{highlight.title}</h4>
                <p>{highlight.text}</p>
              </article>
            ))}
          </div>
        </div>

        <form className="identity-form identity-form--card" onSubmit={onSubmit}>
          <div className="identity-form__hero">
            <div className="identity-form__seal">{initials || "?"}</div>
            <div>
              <p className="eyebrow">Session mark</p>
              <h3>{value.trim() || "Rater identity"}</h3>
            </div>
          </div>

          <label className="identity-field" htmlFor="rater-name">
            <span>Rater name</span>
            <input
              id="rater-name"
              name="rater-name"
              type="text"
              autoComplete="name"
              maxLength={80}
              placeholder="Enter full name"
              value={value}
              onChange={(event) => onChange(event.target.value)}
            />
          </label>

          {errorMessage ? <p className="identity-error">{errorMessage}</p> : null}

          <p className="identity-form__note">
            This name becomes the label for saves, summaries, and exported reports.
          </p>

          <button type="submit" className="action-button">
            Start rating
          </button>
        </form>
      </div>
    </section>
  );
}
