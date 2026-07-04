const STATUS_COLOR = {
  Pending: "var(--amber)",
  Approved: "var(--teal)",
};

const ROW_HEIGHT = 22;
const ROW_GAP = 4;

// Greedily packs segments into the fewest sub-tracks such that no two
// segments sharing a track overlap - using the same shared-day-counts-as-
// overlap boundary rule as the backend's overlap check, so a bar that visibly
// touches another in the same track really is a same-day boundary, not a
// rendering artifact.
function packTracks(segments) {
  const trackEnds = []; // last valid_until (as Date) occupied per track
  const placed = [];
  for (const seg of segments) {
    const start = new Date(seg.valid_from);
    const end = new Date(seg.valid_until);
    let track = trackEnds.findIndex((endDate) => start > endDate);
    if (track === -1) {
      track = trackEnds.length;
      trackEnds.push(end);
    } else {
      trackEnds[track] = end;
    }
    placed.push({ ...seg, track });
  }
  return { placed, trackCount: trackEnds.length || 1 };
}

export default function Timeline({ lanes }) {
  if (!lanes || lanes.length === 0) {
    return (
      <p className="text-sm text-[var(--ink-faint)] py-4 text-center">
        No Pending or Approved tariffs yet to plot.
      </p>
    );
  }

  const allDates = lanes.flatMap((lane) =>
    lane.segments.flatMap((s) => [new Date(s.valid_from), new Date(s.valid_until)])
  );
  const minDate = new Date(Math.min(...allDates));
  const maxDate = new Date(Math.max(...allDates));
  const rangeMs = Math.max(maxDate - minDate, 1);

  const pct = (d) => ((new Date(d) - minDate) / rangeMs) * 100;

  return (
    <div className="space-y-5">
      <div className="flex justify-between text-[0.65rem] font-mono text-[var(--ink-faint)]">
        <span>{minDate.toISOString().slice(0, 10)}</span>
        <span>{maxDate.toISOString().slice(0, 10)}</span>
      </div>
      <div className="space-y-4">
        {lanes.map((lane) => {
          const { placed, trackCount } = packTracks(lane.segments);
          return (
            <div key={`${lane.size}-${lane.move_type}`} className="flex items-start gap-3">
              <div className="w-28 shrink-0 pt-0.5">
                <p className="text-xs font-medium text-[var(--ink)]">{lane.size}</p>
                <p className="text-[0.68rem] text-[var(--ink-dim)] capitalize">{lane.move_type}</p>
              </div>
              <div
                className="relative flex-1 rounded-md bg-[var(--panel-2)]"
                style={{ height: trackCount * ROW_HEIGHT + (trackCount - 1) * ROW_GAP + 8 }}
              >
                {placed.map((seg) => {
                  const left = pct(seg.valid_from);
                  const width = Math.max(pct(seg.valid_until) - left, 1.5);
                  return (
                    <div
                      key={seg.id}
                      title={`${seg.contract_name}: ${seg.valid_from} → ${seg.valid_until} (${seg.status})`}
                      className="absolute rounded text-[0.62rem] font-mono text-[#04231d] px-1.5 flex items-center overflow-hidden whitespace-nowrap"
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        top: 4 + seg.track * (ROW_HEIGHT + ROW_GAP),
                        height: ROW_HEIGHT,
                        background: STATUS_COLOR[seg.status] || "var(--ink-faint)",
                      }}
                    >
                      #{seg.id}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 text-[0.68rem] text-[var(--ink-dim)]">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "var(--teal)" }} />
          Approved
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "var(--amber)" }} />
          Pending
        </span>
        <span className="text-[var(--ink-faint)]">
          Bars stacked in the same lane overlap in time - only Approved-vs-Approved overlap is blocked by the backend.
        </span>
      </div>
    </div>
  );
}
