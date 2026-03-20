import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { isValidRating } from "../utils/scoring";

const SCORES = [1, 2, 3, 4, 5];

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

      <div className="person-card">
        <div className="person-card__header">
          <div>
            <h3>{activePerson.name}</h3>
            {activePerson.role ? <p>{activePerson.role}</p> : null}
          </div>
          <button
            type="button"
            className="mini-link"
            onClick={() => onGoToPerson(Math.max(activeIndex - 1, 0))}
            disabled={activeIndex === 0}
          >
            Previous girl
          </button>
        </div>

        {activePerson.summary ? <p className="person-card__summary">{activePerson.summary}</p> : null}

        <div className="category-stack">
          {categories.map((category) => {
            const rawScore = Number(ratingsByPerson?.[activePerson.id]?.[category]);
            const selectedScore = isValidRating(rawScore) ? rawScore : null;

            return (
              <article key={category} className="category-card">
                <div className="category-card__header">
                  <strong>{category}</strong>
                  <span>{selectedScore !== null ? `${selectedScore}/5` : "Required"}</span>
                </div>

                <div className="score-grid" role="group" aria-label={`${activePerson.name} ${category}`}>
                  {SCORES.map((score) => (
                    <button
                      key={score}
                      type="button"
                      className={`score-pill ${selectedScore === score ? "score-pill--active" : ""}`}
                      onClick={() => onRatingChange(activePerson.id, category, score)}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
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
