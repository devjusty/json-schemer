interface Rule {
  path: string;
  allowed: boolean;
}

interface Group {
  agents: string[];
  rules: Rule[];
}

interface RobotsDocument {
  groups: Group[];
  sitemaps: string[];
}

export interface RobotsRules {
  sitemaps: string[];
  isAllowed(url: URL): boolean;
}

function parseRobotsDocument(text: string): RobotsDocument {
  const groups: Group[] = [];
  const sitemaps: string[] = [];
  let current: Group | undefined;
  let sawDirective = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split("#", 1)[0].trim();
    if (!line) {
      current = undefined;
      sawDirective = false;
      continue;
    }
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
      if (value) current.agents.push(value.toLowerCase());
      continue;
    }
    if (!current) continue;
    sawDirective = true;
    if (!["allow", "disallow"].includes(key)) continue;
    if (value) current.rules.push({ path: value, allowed: key === "allow" });
  }

  return { groups, sitemaps: [...new Set(sitemaps)] };
}

function createRobotsMatcher(groups: Group[], userAgent: string): (url: URL) => boolean {
  const normalized = userAgent.toLowerCase();
  const matchingAgents = groups.flatMap((group) =>
    group.agents.filter((agent) => agent !== "*" && normalized.includes(agent)),
  );
  const specificLength = Math.max(0, ...matchingAgents.map((agent) => agent.length));
  const specificGroups = groups.filter((group) =>
    group.agents.some((agent) => agent !== "*" && agent.length === specificLength && normalized.includes(agent)),
  );
  const rules =
    specificGroups.length > 0
      ? specificGroups.flatMap((group) => group.rules)
      : groups.flatMap((group) => (group.agents.includes("*") ? group.rules : []));

  return (url: URL): boolean => {
    const matching = rules
      .filter((rule) => url.pathname.startsWith(rule.path))
      .sort((a, b) => b.path.length - a.path.length || Number(b.allowed) - Number(a.allowed))[0];
    return matching?.allowed ?? true;
  };
}

export function parseRobots(text: string, userAgent: string): RobotsRules {
  const document = parseRobotsDocument(text);
  return {
    sitemaps: document.sitemaps,
    isAllowed: createRobotsMatcher(document.groups, userAgent),
  };
}
