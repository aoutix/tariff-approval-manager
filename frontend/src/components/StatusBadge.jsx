const DOT = {
  Draft: "●",
  Pending: "◐",
  Approved: "✓",
  Rejected: "✕",
};

export default function StatusBadge({ status }) {
  const cls = {
    Draft: "stamp-draft",
    Pending: "stamp-pending",
    Approved: "stamp-approved",
    Rejected: "stamp-rejected",
  }[status] || "stamp-draft";

  return (
    <span className={`stamp ${cls}`}>
      <span aria-hidden="true">{DOT[status]}</span>
      {status}
    </span>
  );
}
