import { useEffect, useState } from "react";
import { Cpu, ChevronDown } from "lucide-react";
type AIStatus = {
  configured: boolean;
  model: string | null;
  verified: boolean;
  connection_status: string;
  checked_at?: string;
};
const statusText: Record<string, string> = {
  not_tested: "Key configured · connection not yet tested",
  verified: "Connection verified",
  credits_required:
    "API credits required · local explanations remain available",
  provider_error:
    "Provider rejected request · check permissions and model access",
  incomplete_response: "Provider returned an incomplete response",
  request_pending: "Last request pending or interrupted; not verified",
};
export default function AIConnection({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  const [status, setStatus] = useState<AIStatus | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/ai/status", { signal: c.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setStatus)
      .catch((e) => {
        if (e.name !== "AbortError")
          setError("Unable to check AI configuration");
      });
    return () => c.abort();
  }, []);
  async function check(test = false) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(test ? "/api/ai/test" : "/api/ai/status", {
        method: test ? "POST" : "GET",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Unable to check connection");
      setStatus(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="panel ai-connection">
      <summary>
        <Cpu size={18} /> Explainable AI{" "}
        <span className="ai-label">
          {enabled ? "AI writing enabled" : "Local TreeSHAP active"}
        </span>
        <ChevronDown size={14} />
      </summary>
      <div className="ai-connection-body">
        <p className="helper">
          TreeSHAP and exact block contributions run locally without API
          credits.
        </p>
        <p>
          {status?.configured
            ? `${statusText[status.connection_status] || "Configuration available"} · ${status.model}`
            : status
              ? "OpenAI not configured · optional"
              : "Checking configuration…"}
        </p>
        {error && <p role="alert">{error}</p>}
        {status?.configured ? (
          <label>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onChange(e.target.checked)}
            />
            Use OpenAI to explain assessment answers
          </label>
        ) : (
          <p className="helper">
            Set OPENAI_API_KEY and OPENAI_MODEL in the server .env.local file,
            then restart. Keep the key out of chat and browser code.
          </p>
        )}
        <p className="helper">
          When enabled, your question and selected numerical evidence go to
          OpenAI. Photos, site coordinates and survey files are excluded from
          the evidence. AI text does not change scores or warnings.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void check()}
          >
            Refresh status
          </button>
          {status?.configured && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void check(true)}
            >
              {busy ? "Checking…" : "Test AI · uses API credits"}
            </button>
          )}
        </div>
        {status?.checked_at && (
          <p className="helper">
            Last request: {new Date(status.checked_at).toLocaleString()}
          </p>
        )}
      </div>
    </details>
  );
}
