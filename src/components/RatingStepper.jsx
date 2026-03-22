import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { CATEGORY_DESCRIPTIONS, RATING_MAX, RATING_MIN, RATING_STEP } from "../constants";
import { isValidRating } from "../utils/scoring";

function isPersonComplete(personId, categories, ratingsByPerson) {
  return categories.every((category) => {
    const value = Number(ratingsByPerson?.[personId]?.[category]);
    return isValidRating(value);
  });
}

function getCompletedCategoryCount(personId, categories, ratingsByPerson) {
  return categories.filter((category) => {
    const value = Number(ratingsByPerson?.[personId]?.[category]);
    return isValidRating(value);
  }).length;
}

export default function RatingStepper({
  activeIndex,
  categories,
  commentsByPerson,
  onCommentChange,
  onCommentCommit,
  onGoToPerson,
  onNext,
  onPrevious,
  onRatingChange,
  people,
  ratingsByPerson,
}) {
  const activePerson = people[activeIndex];

  if (!activePerson) {
    return null;
  }

  const personComplete = isPersonComplete(activePerson.id, categories, ratingsByPerson);
  const completedCategories = getCompletedCategoryCount(
    activePerson.id,
    categories,
    ratingsByPerson,
  );
  const remainingCategories = categories.length - completedCategories;
  const activeInitials = activePerson.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
  const currentComment = commentsByPerson?.[activePerson.id] ?? "";

  return (
    <section className="rating-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Rate the lineup</p>
          <h2>
            Girl {activeIndex + 1} of {people.length}
          </h2>
        </div>
        <span className={`completion-badge ${personComplete ? "completion-badge--done" : ""}`}>
          {personComplete ? <CheckCircle2 size={16} /> : null}
          {personComplete ? "Complete" : `${completedCategories}/${categories.length} complete`}
        </span>
      </div>

      <div className="rating-panel__intro">
        <div>
          <span>Active profile</span>
          <strong>{activePerson.name}</strong>
        </div>
        <div>
          <span>Categories left</span>
          <strong>{remainingCategories}</strong>
        </div>
        <div>
          <span>Board position</span>
          <strong>
            {activeIndex + 1}/{people.length}
          </strong>
        </div>
      </div>

      <div className="person-card">
        <div className="person-card__header">
          <div className="person-card__headline">
            <div>
              <p className="person-card__eyebrow">Now rating</p>
              <h3>{activePerson.name}</h3>
              {activePerson.role ? <p>{activePerson.role}</p> : null}
            </div>
            <div className="person-card__crest-block">
              <div className="person-card__crest">{activeInitials || "?"}</div>
              <div className="person-card__signal">
                <span>Scoring signal</span>
                <strong>{completedCategories}/{categories.length}</strong>
              </div>
            </div>
          </div>
          <div className="person-card__status">
            <strong>{personComplete ? "Board complete" : `${completedCategories}/${categories.length} scored`}</strong>
            <span>
              {personComplete
                ? "Ready to move on"
                : `${remainingCategories} category${remainingCategories === 1 ? "" : "ies"} left`}
            </span>
          </div>
        </div>

        <div className="category-stack category-stack--split">
          {categories.map((category, index) => {
            const rawScore = Number(ratingsByPerson?.[activePerson.id]?.[category]);
            const selectedScore = isValidRating(rawScore) ? rawScore : null;
            const description = CATEGORY_DESCRIPTIONS[category] ?? "";
            const scorePercent =
              selectedScore !== null
                ? ((selectedScore - RATING_MIN) / (RATING_MAX - RATING_MIN)) * 100
                : 0;

            return (
              <article
                key={category}
                className="category-card"
                style={{
                  "--score-percent": `${scorePercent}%`,
                }}
              >
                <div className="category-card__header">
                  <strong>
                    <span className="category-card__index">{index + 1}</span>
                    {category}
                  </strong>
                  <span>{selectedScore !== null ? `${selectedScore}/${RATING_MAX}` : "Required"}</span>
                </div>

                {description ? <p className="category-card__description">{description}</p> : null}

                <div className="score-slider">
                  <div className="score-slider__rail" aria-hidden="true">
                    <span />
                  </div>
                  <input
                    type="range"
                    className="score-slider__input"
                    min={RATING_MIN}
                    max={RATING_MAX}
                    step={RATING_STEP}
                    value={selectedScore ?? RATING_MIN}
                    aria-label={`${activePerson.name} ${category}`}
                    onChange={(event) =>
                      onRatingChange(activePerson.id, category, Number(event.target.value))
                    }
                  />
                  <div className="score-slider__meta" aria-hidden="true">
                    <span>{RATING_MIN}</span>
                    <strong>{selectedScore !== null ? selectedScore : "Set score"}</strong>
                    <span>{RATING_MAX}</span>
                  </div>
                  <p className="score-slider__hint">Locked to whole numbers only.</p>
                </div>
              </article>
            );
          })}
        </div>

        <div className="comment-card">
          <div className="category-card__header">
            <strong>Rater comment</strong>
            <span>Saved to system</span>
          </div>
          <textarea
            className="comment-input"
            rows={5}
            placeholder={`Add notes about ${activePerson.name}, why you scored this way, or anything you want saved in the export.`}
            value={currentComment}
            onChange={(event) => onCommentChange(activePerson.id, event.target.value)}
            onBlur={(event) => onCommentCommit(activePerson.id, event.target.value)}
          />
        </div>
      </div>

      <div className="stepper-footer">
        <button
          type="button"
          className="action-button action-button--ghost"
          onClick={onPrevious}
          disabled={activeIndex === 0}
        >
          <ArrowLeft size={16} />
          Previous
        </button>

        <div className="stepper-footer__hint">
          {personComplete
            ? "This girl is complete. Continue when ready."
            : "You can jump to any girl and come back later. Only fully completed girls count toward the 5-girl reveal."}
        </div>

        <button
          type="button"
          className="action-button"
          onClick={onNext}
          disabled={activeIndex === people.length - 1}
        >
          Next
          <ArrowRight size={16} />
        </button>
      </div>
    </section>
  );
}
