import { useEffect, useState } from "react";

function format(ms: number) {
  if (ms <= 0) return "Kicking off";
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const remMins = mins % 60;

  if (days >= 1) return `in ${days}d ${hours}h`;
  if (hours >= 1) return `in ${hours}h ${remMins}m`;
  if (mins >= 1) return `in ${remMins}m`;
  return "Kicking off";
}

/** Renders nothing until mounted client-side, so SSR/client markup can't mismatch on the clock. */
export function KickoffCountdown({ kickoff, className }: { kickoff: string; className?: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const target = new Date(kickoff).getTime();
    if (Number.isNaN(target)) return;

    const tick = () => setLabel(format(target - Date.now()));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [kickoff]);

  if (!label) return null;
  return <span className={className}>{label}</span>;
}
