const GITHUB_API = "https://api.github.com";
const CACHE_MS = 2 * 60 * 1000;
const cache = new Map();

function githubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "github-profile-analyzer",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

function readRateLimit(response) {
  const reset = response.headers.get("x-ratelimit-reset");
  const resetAt = reset ? new Date(Number(reset) * 1000).toISOString() : null;
  return {
    limit: response.headers.get("x-ratelimit-limit"),
    remaining: response.headers.get("x-ratelimit-remaining"),
    resetAt,
  };
}

async function githubGet(url) {
  const response = await fetch(url, { headers: githubHeaders() });
  if (response.status === 403 || response.status === 429) {
    const rate = readRateLimit(response);
    let message = "GitHub request was rejected";
    try {
      const body = await response.json();
      if (body && typeof body.message === "string") {
        message = body.message;
      }
    } catch {
      // GitHub sometimes returns an empty error body.
    }
    const rateLimited = rate.remaining === "0" || /rate limit/i.test(message);
    console.error("GitHub rate limit check:", {
      status: response.status,
      rateLimited,
      message,
      ...rate,
    });
    const error = new Error(rateLimited ? "GitHub API rate limit reached" : message);
    error.rateLimited = rateLimited;
    error.status = response.status;
    throw error;
  }
  return response;
}

async function mapPool(items, limit, mapper) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const current = next;
      next += 1;
      results[current] = await mapper(items[current]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function repoPath(repo, userName) {
  const fullName = typeof repo.full_name === "string" ? repo.full_name : `${userName}/${repo.name}`;
  return fullName
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
}

async function fetchLanguages(path) {
  const response = await githubGet(`${GITHUB_API}/repos/${path}/languages`);
  if (!response.ok) {
    return {};
  }

  const data = await response.json();
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {};
  }

  return data;
}

async function fetchReadmeExcerpt(path) {
  const response = await githubGet(`${GITHUB_API}/repos/${path}/readme`);
  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  if (!data || typeof data.content !== "string") {
    return null;
  }

  return excerptFromReadme(Buffer.from(data.content, "base64").toString("utf8"));
}

function excerptFromReadme(markdown) {
  const withoutCode = String(markdown || "").replace(/```[\s\S]*?```/g, "\n");
  const blocks = withoutCode.split(/\n\s*\n/);

  for (const block of blocks) {
    const text = block
      .split(/\r?\n/)
      .map(cleanMarkdownLine)
      .filter((line) => line && !isNoiseLine(line))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (text.length >= 40 && !isNoiseLine(text)) {
      return clampText(text, 280);
    }
  }

  return null;
}

function cleanMarkdownLine(rawLine) {
  return rawLine
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/^>\s+/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isNoiseLine(line) {
  return (
    line.length < 24 ||
    /^https?:\/\//i.test(line) ||
    /badge|shields\.io|img\.shields/i.test(line) ||
    /^(table of contents|license|installation|getting started|usage|contributing)\b/i.test(line)
  );
}

function clampText(text, max) {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  let result = "";

  for (const sentence of sentences) {
    const next = `${result} ${sentence}`.trim();
    if (next.length > max && result) {
      break;
    }
    result = next;
    if (result.length >= 140 && /[.!?]$/.test(result)) {
      break;
    }
  }

  if (result.length > max) {
    return `${result.slice(0, max - 1).trim()}…`;
  }

  return result || null;
}

function cleanText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.replace(/\s+/g, " ").trim();
  return text || null;
}

function ensureSentence(text) {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function aboutText(repo, readmeExcerpt) {
  const description = cleanText(repo.description);
  if (description && description.length >= 24) {
    return ensureSentence(description);
  }

  if (readmeExcerpt) {
    return ensureSentence(readmeExcerpt);
  }

  if (description) {
    return ensureSentence(description);
  }

  const topics = Array.isArray(repo.topics)
    ? repo.topics.filter((topic) => typeof topic === "string" && topic.trim())
    : [];
  if (topics.length) {
    return `Covers ${topics.slice(0, 4).join(", ")}.`;
  }

  if (repo.fork) {
    return "A fork with no public description or README summary.";
  }

  return "No public description or README summary is available.";
}

function languageShares(languageMap, primaryLanguage) {
  const entries = Object.entries(languageMap || {}).filter(
    ([, bytes]) => typeof bytes === "number" && bytes > 0,
  );

  if (!entries.length) {
    return primaryLanguage ? [{ name: primaryLanguage, percent: 100 }] : [];
  }

  const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0);
  return entries
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([name, bytes]) => ({
      name,
      percent: total > 0 ? Math.round((bytes / total) * 100) : 0,
    }))
    .filter((share) => share.percent > 0);
}

function describeLanguages(languageMap, primaryLanguage) {
  const shares = languageShares(languageMap, primaryLanguage);
  return {
    language: shares[0]?.name || primaryLanguage || null,
    languagesUsed: shares.map((share) => share.name),
    languages: Object.fromEntries(shares.map((share) => [share.name, share.percent])),
  };
}

function languageSentence(shares) {
  if (!shares.length) {
    return "No language was detected.";
  }

  if (shares.length === 1) {
    return `Written in ${shares[0].name}.`;
  }

  const [main, ...rest] = shares;
  const others = rest.map((share) => `${share.name} (${share.percent}%)`).join(", ");
  return `Written mainly in ${main.name} (${main.percent}%), with ${others}.`;
}

function buildRepoSummary({ description, readmeExcerpt, topics, fork, languages, primaryLanguage }) {
  const about = aboutText({ description, topics, fork }, readmeExcerpt);
  const shares = languageShares(languages, primaryLanguage);
  const prefix = fork ? "Fork. " : "";
  return `${prefix}${about} ${languageSentence(shares)}`;
}

async function summarizeRepos(repos, userName) {
  const cacheKey = String(userName || "").toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return cached.value;
  }

  let rateLimited = false;
  const languageTotals = {};
  const summarized = await mapPool(Array.isArray(repos) ? repos : [], 4, async (repo) => {
    const path = repoPath(repo, userName);
    const description = cleanText(repo.description);
    let languages = {};
    let readmeExcerpt = null;

    if (!rateLimited) {
      try {
        [languages, readmeExcerpt] = await Promise.all([
          fetchLanguages(path),
          !description || description.length < 24 ? fetchReadmeExcerpt(path) : Promise.resolve(null),
        ]);
      } catch (error) {
        if (error.rateLimited) {
          rateLimited = true;
        }
      }
    }

    for (const [name, bytes] of Object.entries(languages)) {
      if (typeof bytes === "number" && bytes > 0) {
        languageTotals[name] = (languageTotals[name] || 0) + bytes;
      }
    }

    const described = describeLanguages(languages, repo.language);
    return {
      name: repo.name,
      description: repo.description,
      html_url: repo.html_url,
      language: described.language,
      languagesUsed: described.languagesUsed,
      stargazers_count: repo.stargazers_count,
      summary: buildRepoSummary({
        description: repo.description,
        readmeExcerpt,
        topics: repo.topics,
        fork: Boolean(repo.fork),
        languages,
        primaryLanguage: repo.language,
      }),
      languages: described.languages,
    };
  });

  const value = {
    repos: summarized,
    languages: languageTotals,
    notice: rateLimited
      ? "GitHub rate-limited some repository lookups, so those summaries use only the description and primary language."
      : null,
  };
  cache.set(cacheKey, { at: Date.now(), value });
  return value;
}

module.exports = {
  summarizeRepos,
  describeLanguages,
  buildRepoSummary,
  excerptFromReadme,
  githubGet,
  readRateLimit,
};
