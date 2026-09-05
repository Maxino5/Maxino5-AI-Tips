import { useState } from "react";
import { HandHeart, X } from "lucide-react";

// Placeholder — swap these for real details once the account is set up.
const SUPPORT_DETAILS = {
  provider: "Bank",
  accountName: "Max AI Tips (placeholder)",
  accountNumber: "0000000000 (placeholder)",
};

export function SupportButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <HandHeart className="size-3.5" /> Support this site
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div className="panel w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h2 className="font-display text-2xl tracking-wide">Support Max AI Tips</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-sm p-1 text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mt-2 font-serif text-sm leading-relaxed text-muted-foreground">
              Max AI Tips will always remain completely free. No logins or subscriptions.
              Building and hosting continous statistical models and live data pipelines incure daily infrastructure
              costs. If you've found our picks valuable and want to help keep the system running and expanding
              optional support is deeply appreciated and directly fund our server hosting. 
              
            </p>
            <div className="ticket-divider mt-4 space-y-1.5 pt-4 font-mono text-sm">
              <p>{SUPPORT_DETAILS.provider}</p>
              <p className="font-semibold">{SUPPORT_DETAILS.accountName}</p>
              <p>{SUPPORT_DETAILS.accountNumber}</p>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              (the site owner hasn't added the real account yet.)
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
