import type { Page, Request, Response } from "@playwright/test";

export type ProtectedAuditCode =
  | "OK"
  | "GRAPHQL_ERROR"
  | "HTTP_ERROR"
  | "REQUEST_FAILED"
  | "CONSOLE_ERROR";

export interface ProtectedAuditEntry {
  operation: string;
  status: number | null;
  code: ProtectedAuditCode;
}

export function redactAuditUrl(value: string): string {
  try {
    const parsed = new URL(value);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, parsed.pathname === "/" ? "/" : "");
  } catch {
    return "invalid-url";
  }
}

export function operationNameFromRequest(body: string | null): string {
  if (!body) return "unknown";
  try {
    const parsed = JSON.parse(body) as { operationName?: unknown; query?: unknown };
    if (typeof parsed.operationName === "string" && /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(parsed.operationName)) {
      return parsed.operationName;
    }
    if (typeof parsed.query === "string") {
      return parsed.query.match(/(?:query|mutation)\s+([A-Za-z][A-Za-z0-9_]*)/)?.[1] ?? "unknown";
    }
  } catch {
    return "unknown";
  }
  return "unknown";
}

export function summarizeGraphqlResponse({
  operation,
  status,
  payload,
}: {
  operation: string;
  status: number;
  payload: unknown;
}): ProtectedAuditEntry {
  const hasErrors = typeof payload === "object" && payload !== null &&
    Array.isArray((payload as { errors?: unknown }).errors) &&
    ((payload as { errors: unknown[] }).errors.length > 0);
  return {
    operation,
    status,
    code: hasErrors ? "GRAPHQL_ERROR" : status >= 400 ? "HTTP_ERROR" : "OK",
  };
}

export interface ConsoleNetworkAudit {
  entries: ProtectedAuditEntry[];
  assertClean(): void;
  stop(): void;
}

export function installConsoleNetworkAudit(page: Page): ConsoleNetworkAudit {
  const entries: ProtectedAuditEntry[] = [];
  const operations = new WeakMap<Request, string>();

  const onRequest = (request: Request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith("/graphql")) {
      operations.set(request, operationNameFromRequest(request.postData()));
    } else if (/\/api\/playlist\//.test(pathname)) {
      operations.set(request, "PublicMusicPlaylist");
    }
  };
  const onResponse = async (response: Response) => {
    const operation = operations.get(response.request());
    if (!operation) return;
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // The audit intentionally records classification, never response text.
    }
    entries.push(summarizeGraphqlResponse({ operation, status: response.status(), payload }));
  };
  const onRequestFailed = (request: Request) => {
    const operation = operations.get(request);
    if (operation) entries.push({ operation, status: null, code: "REQUEST_FAILED" });
  };
  const onConsole = (message: { type(): string }) => {
    if (message.type() === "error") entries.push({ operation: "browser-console", status: null, code: "CONSOLE_ERROR" });
  };

  page.on("request", onRequest);
  page.on("response", onResponse);
  page.on("requestfailed", onRequestFailed);
  page.on("console", onConsole);

  return {
    entries,
    assertClean() {
      const failures = entries.filter((entry) => entry.code !== "OK");
      if (failures.length) throw new Error(`PROTECTED_AUDIT_FAILED:${failures.map((entry) => `${entry.operation}:${entry.code}`).join(",")}`);
    },
    stop() {
      page.off("request", onRequest);
      page.off("response", onResponse);
      page.off("requestfailed", onRequestFailed);
      page.off("console", onConsole);
    },
  };
}
