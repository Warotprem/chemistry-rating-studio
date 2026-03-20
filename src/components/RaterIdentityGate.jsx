export default function RaterIdentityGate({
  errorMessage,
  onChange,
  onSubmit,
  surpriseName,
  value,
}) {
  if (surpriseName) {
    return (
      <section className="identity-panel identity-panel--detector">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Surprise</p>
            <h2>Gray detector: Detected</h2>
          </div>
          <span className="completion-badge">5 second hold</span>
        </div>

        <p className="identity-panel__copy">
          Running a quick check for <strong>{surpriseName}</strong>. The rating flow will continue
          automatically in a moment.
        </p>
      </section>
    );
  }

  return (
    <section className="identity-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Before you start</p>
          <h2>Enter the rater's name</h2>
        </div>
        <span className="completion-badge">Required to continue</span>
      </div>

      <p className="identity-panel__copy">
        The rating session is tied to the rater's name, and the revealed result will be saved
        under that identity in the system log.
      </p>

      <form className="identity-form" onSubmit={onSubmit}>
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

        <button type="submit" className="action-button">
          Start rating
        </button>
      </form>
    </section>
  );
}
