interface Rule {
  path: string;
  allowed: boolean;
}

interface Group {
  agents: string[];
  rules: Rule[];
}

export interface RobotsRules {
  sitemaps: string[];
  isAllowed(url: URL): boolean;
}

function matchingGroup(groups: Group[], userAgent: string): Group | undefined {
  const normalized = userAgent.toLowerCase();
  const exact = groups.find((group) => group.agents.some((agent) => agent !== "*" && normalized.includes(agent)));
  return exact ?? groups.find((group) => group.agents.includes("*"));
}

export function parseRobots(text: string, userAgent: string): RobotsRules {
  const groups: Group[] = [];
  const sitemaps: string[] = [];
  let current: Group | undefined;
  let sawDirective = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split("#", 1)[0].trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (key === "sitemap") {
      if (value) sitemaps.push(value);
      continue;
    }
    if (key === "user-agent") {
      if (!current || sawDirective) {
        current = { agents: [], rules: [] };
        groups.push(current);
        sawDirective = false;
      }
      current.agents.push(value.toLowerCase());
      continue;
    }
    if (!current || !["allow", "disallow"].includes(key)) continue;
    sawDirective = true;
    if (value) current.rules.push({ path: value, allowed: key === "allow" });
  }

  const group = matchingGroup(groups, userAgent);
  return {
    sitemaps: [...new Set(sitemaps)],
    isAllowed(url: URL): boolean {
      if (!group) return true;
      const matching = group.rules
        .filter((rule) => url.pathname.startsWith(rule.path))
        .sort((a, b) => b.path.length - a.path.length)[0];
      return matching?.allowed ?? true;
    },
  };
}
