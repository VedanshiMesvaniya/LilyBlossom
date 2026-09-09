/**
 * Home page hero. Shows the logged-out tagline by default, or personal
 * stats once stats are passed in for a signed-in user.
 * stats shape: { total, watching, watched, planToWatch, dropped }
 */
export function Hero({ stats }) {
  return (
    <section className="bg-background px-4 py-16 text-center">
      <h1 className="font-display text-4xl text-text-primary md:text-5xl">
        Your GL Library
      </h1>
      <p className="mx-auto mt-3 max-w-md font-ui text-text-muted">
        One place for every story you want to watch.
      </p>

      {stats && (
        <dl className="mx-auto mt-8 grid max-w-2xl grid-cols-2 gap-4 font-ui sm:grid-cols-4">
          {[
            ["Total GL Titles", stats.total],
            ["Watching", stats.watching],
            ["Watched", stats.watched],
            ["Plan to Watch", stats.planToWatch]
          ].map(([label, value]) => (
            <div key={label} className="rounded-card bg-surface p-4 shadow-sm">
              <dt className="text-xs text-text-muted">{label}</dt>
              <dd className="mt-1 text-2xl text-text-primary">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
