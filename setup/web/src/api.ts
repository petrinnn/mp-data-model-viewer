import type { DataModel } from "./types";

export async function fetchModel(): Promise<{
  model: DataModel | null;
  baseline: DataModel | null;
  path: string | null;
  needsOpen?: boolean;
}> {
  const res = await fetch("/api/model");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function saveModel(model: DataModel): Promise<{
  model: DataModel;
  baseline: DataModel | null;
}> {
  const res = await fetch("/api/model", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return { model: data.model as DataModel, baseline: data.baseline ?? null };
}

export async function openModelFile(path?: string): Promise<{
  model: DataModel;
  baseline: DataModel | null;
  path: string;
  cancelled?: boolean;
}> {
  const res = await fetch("/api/open", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(path ? { path } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data?.cancelled)
      return { cancelled: true, model: null as never, baseline: null, path: "" };
    throw new Error(data?.error || (await res.text()));
  }
  return data;
}

export function subscribeModelEvents(handlers: {
  onChanged: (
    model: DataModel,
    source: string,
    path?: string,
    baseline?: DataModel | null,
  ) => void;
  onClosed?: () => void;
  onError?: (msg: string) => void;
}) {
  const es = new EventSource("/api/events");
  es.addEventListener("model-changed", (ev) => {
    try {
      const data = JSON.parse((ev as MessageEvent).data);
      handlers.onChanged(
        data.model,
        data.source || "external",
        data.path,
        data.baseline ?? null,
      );
    } catch {
      /* ignore */
    }
  });
  es.addEventListener("model-closed", () => {
    handlers.onClosed?.();
  });
  es.addEventListener("model-error", (ev) => {
    try {
      const data = JSON.parse((ev as MessageEvent).data);
      handlers.onError?.(data.error || "erro no arquivo");
    } catch {
      /* ignore */
    }
  });
  return () => es.close();
}
