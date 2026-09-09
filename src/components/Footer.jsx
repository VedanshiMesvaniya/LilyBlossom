import { COPYRIGHT_LINE, SUPPORT_EMAIL } from "../lib/constants.js";

export function Footer() {
  return (
    <footer className="border-t border-border bg-cream-surface py-8 font-ui text-sm text-text-muted">
      <div className="mx-auto max-w-6xl px-4">
        <p className="text-text-primary">{COPYRIGHT_LINE}</p>
        <p className="mt-2 max-w-2xl">
          Original LilyBlossom UI, software and tracking experience. Third-party
          titles, trademarks, posters, logos and source material remain the
          property of their respective rights holders.
        </p>
        <p className="mt-2">
          Support:{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:text-primary-hover">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    </footer>
  );
}
