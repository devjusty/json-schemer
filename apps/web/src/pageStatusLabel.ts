const PAGE_STATUS_LABELS: Record<string, string> = {
  success: "Success",
  ok: "Success",
  no_jsonld: "No JSON-LD",
  invalid_jsonld: "Invalid JSON-LD",
  http_error: "HTTP error",
  parse_error: "Parse error",
  blocked: "Blocked",
  fetch_error: "Fetch error",
};

export function pageStatusLabel(status: string): string {
  return PAGE_STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}
