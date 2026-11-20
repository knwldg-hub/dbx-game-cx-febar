import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Card, CardContent } from '@databricks/appkit-ui/react';

export interface NextStep {
  label: ReactNode;
  /** Optional in-app link, e.g. '/risk-queue?action=suspend'. */
  to?: string;
  cta?: string;
}

interface InsightPanelProps {
  /** What is happening: the headline fact. */
  what: ReactNode;
  /** Why it matters: impact in money, players, or trust. */
  why: ReactNode;
  /** How we know / how it works: the data or rule behind it. */
  how: ReactNode;
  /** Next steps: numbered, each optionally linking to the page that performs it. */
  next: NextStep[];
  tone?: 'default' | 'alert';
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1 min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground leading-relaxed">{children}</div>
    </div>
  );
}

/**
 * What / Why / How / Next framing used at the top of every console page, so each view answers
 * what is happening, why it matters, how we know, and what to do next.
 */
export function InsightPanel({ what, why, how, next, tone = 'default' }: InsightPanelProps) {
  return (
    <Card className={tone === 'alert' ? 'border-destructive/40 bg-destructive/5' : 'border-primary/30 bg-primary/5'}>
      <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <Section label="What">{what}</Section>
        <Section label="Why it matters">{why}</Section>
        <Section label="How we know">{how}</Section>
        <Section label="Next steps">
          <ol className="list-decimal pl-4 space-y-1">
            {next.map((s, i) => (
              <li key={`step-${i}`}>
                {s.label}
                {s.to && (
                  <>
                    {' '}
                    <Link to={s.to} className="font-medium text-primary hover:underline whitespace-nowrap">
                      {s.cta ?? 'Open'} →
                    </Link>
                  </>
                )}
              </li>
            ))}
          </ol>
        </Section>
      </CardContent>
    </Card>
  );
}
