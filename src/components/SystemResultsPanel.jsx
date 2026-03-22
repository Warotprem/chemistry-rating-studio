import { Download, FileText } from "lucide-react";

export default function SystemResultsPanel({ onExportData }) {
  return (
    <section className="summary-card summary-card--export">
      <div className="export-card__ghost" aria-hidden="true">
        DOSSIER
      </div>

      <div className="panel-head panel-head--compact">
        <div>
          <p className="eyebrow">Export</p>
          <h2>Export report</h2>
          <p className="summary-card__text">
            Download a clean HTML snapshot of the current board, comments, summaries, and logs.
          </p>
        </div>
      </div>

      <div className="export-card__meta">
        <span>
          <FileText size={15} />
          HTML report
        </span>
        <span>
          <Download size={15} />
          One-click export
        </span>
      </div>

      <div className="export-card__ticker" aria-hidden="true">
        <span>Current board</span>
        <span>Comments</span>
        <span>Summaries</span>
        <span>Logs</span>
      </div>

      <div className="system-records__export">
        <button
          type="button"
          className="action-button system-records__export-button"
          onClick={onExportData}
        >
          <span className="system-records__export-copy">
            <span className="system-records__export-label">Download HTML dossier</span>
            <strong>Export report</strong>
            <span className="system-records__export-note">
              Current board, comments, summaries, and logs
            </span>
          </span>
        </button>
      </div>
    </section>
  );
}
