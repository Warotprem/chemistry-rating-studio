export default function SystemResultsPanel({ onExportData }) {
  return (
    <section className="summary-card">
      <div className="panel-head panel-head--compact">
        <div>
          <p className="eyebrow">Export</p>
          <h2>Export report</h2>
        </div>
      </div>

      <div className="system-records__export">
        <button
          type="button"
          className="action-button system-records__export-button"
          onClick={onExportData}
        >
          Export report
        </button>
      </div>
    </section>
  );
}
