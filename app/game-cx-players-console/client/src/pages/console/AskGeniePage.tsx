import { useState } from 'react';
import { Badge, Button, GenieChat } from '@databricks/appkit-ui/react';
import { useJson, type WhoAmI } from '../../lib/useJson';

interface AskGeniePageProps {
  alias: 'trust' | 'experience';
  title: string;
  spaceName: string;
  description: string;
  /** Mirrors the sample questions configured in the Genie space. */
  sampleQuestions: string[];
}

/**
 * Genie chat page with the trust requirements: signed-in identity, streaming status and
 * generated SQL (rendered by GenieChat), per-answer disclaimer, and truthful governance disclosure.
 * Genie runs on-behalf-of the user because the app declares user_api_scopes: [genie, sql].
 * Sample questions copy to the clipboard: GenieChat owns its own input, so we don't inject text into it.
 */
export function AskGeniePage({ alias, title, spaceName, description, sampleQuestions }: AskGeniePageProps) {
  const me = useJson<WhoAmI>('/api/whoami');
  const who = me.data?.email ?? me.data?.user ?? null;
  const [copied, setCopied] = useState<string | null>(null);

  const copyQuestion = async (q: string) => {
    try {
      await navigator.clipboard.writeText(q);
      setCopied(q);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="space-y-4 w-full max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        <Badge variant="secondary">{who ? `Asking as ${who}` : 'Signed in'}</Badge>
      </div>

      <p className="text-sm text-foreground">
        Use this when a question is not answered on the Executive Overview: ask in plain English, check the SQL, then act
        from the Risk Queue or Fraud Rings.
      </p>

      <div className="text-xs text-muted-foreground border rounded-md p-3 space-y-1">
        <p>
          Genie space <span className="font-medium text-foreground">{spaceName}</span>. Queries run with your own
          Databricks permissions (on-behalf-of user), so Unity Catalog grants and PII column masks apply to you.
        </p>
        <p>Expand an answer to inspect the SQL Genie generated before relying on the result.</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Try asking</p>
        <div className="flex flex-wrap gap-2">
          {sampleQuestions.map((q) => (
            <Button
              key={q}
              size="sm"
              variant={copied === q ? 'default' : 'outline'}
              className="h-auto whitespace-normal text-left py-1.5"
              onClick={() => copyQuestion(q)}
            >
              {q}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground" role="status">
          {copied
            ? 'Copied. Paste it into the chat box below (Ctrl/Cmd+V) and press Enter.'
            : 'Click a question to copy it, then paste it into the chat box below.'}
        </p>
      </div>

      <div key={alias} className="h-[min(640px,70vh)] border rounded-lg overflow-hidden">
        <GenieChat alias={alias} />
      </div>

      <p className="text-xs text-muted-foreground">
        AI-generated from your data via Genie and may be wrong. Review the generated SQL before acting on results.
      </p>
    </div>
  );
}
