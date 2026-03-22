import { CheckCircle2 } from "lucide-react";
import { isValidRating } from "../utils/scoring";

function getCompletedCategoryCount(personId, categories, ratingsByPerson) {
  return categories.filter((category) =>
    isValidRating(Number(ratingsByPerson?.[personId]?.[category])),
  ).length;
}

export default function BoardMatrix({
  activeIndex,
  categories,
  onGoToPerson,
  people,
  ratingsByPerson,
}) {
  return (
    <section className="board-matrix">
      <div className="panel-head panel-head--matrix">
        <div>
          <p className="eyebrow">Board matrix</p>
          <h2>Scan the whole board at once</h2>
          <p className="board-matrix__subhead">
            Every profile, every category, one live view. Click any row to jump straight back into
            that profile.
          </p>
        </div>
        <div className="board-matrix__legend">
          <span>Dash = not rated</span>
          <span>Warmer cells = higher score</span>
        </div>
      </div>

      <div className="board-matrix__wrap">
        <table className="board-matrix__table">
          <thead>
            <tr>
              <th>Profile</th>
              <th>Progress</th>
              {categories.map((category) => (
                <th key={category} title={category}>
                  {category}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((person, index) => {
              const completedCount = getCompletedCategoryCount(person.id, categories, ratingsByPerson);
              const isComplete = completedCount === categories.length;

              return (
                <tr
                  key={person.id}
                  className={[
                    index === activeIndex ? "board-matrix__row--active" : "",
                    isComplete ? "board-matrix__row--complete" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <td>
                    <button
                      type="button"
                      className="board-matrix__profile"
                      onClick={() => onGoToPerson(index)}
                    >
                      <span className="board-matrix__profile-name">{person.name}</span>
                      <span className="board-matrix__profile-meta">
                        {person.role || "Scored profile"}
                      </span>
                    </button>
                  </td>
                  <td>
                    <div className="board-matrix__progress">
                      <strong>
                        {completedCount}/{categories.length}
                      </strong>
                      {isComplete ? <CheckCircle2 size={14} /> : null}
                    </div>
                  </td>
                  {categories.map((category) => {
                    const score = Number(ratingsByPerson?.[person.id]?.[category]);
                    const isRated = isValidRating(score);

                    return (
                      <td key={category}>
                        <span
                          className={`board-matrix__score ${
                            isRated ? "board-matrix__score--rated" : ""
                          }`}
                          style={
                            isRated
                              ? {
                                  "--matrix-score": score,
                                }
                              : undefined
                          }
                          title={isRated ? `${category}: ${score}/10` : `${category}: not rated`}
                        >
                          {isRated ? score : "--"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
