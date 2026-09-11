export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="grid max-w-2xl gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-leaf">{eyebrow}</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        {description && <p className="text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ title, description, children }: { title: string; description?: React.ReactNode; children: React.ReactNode }) {
  const id = `panel-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="grid gap-5 rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div className="grid gap-1">
        <h2 id={id} className="font-display text-lg font-semibold">
          {title}
        </h2>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}
