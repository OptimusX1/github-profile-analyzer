export interface ProfileView {
  name: string;
  username: string;
  bio: string | null;
  location: string | null;
  company: string | null;
  followers: number | null;
  following: number | null;
  publicRepos: number | null;
  avatarUrl: string | null;
  profileUrl: string | null;
}

export interface LanguageView {
  name: string;
  percent: number;
}

export interface RepoView {
  name: string;
  description: string | null;
  url: string | null;
  language: string | null;
  stars: number | null;
  summary: string | null;
  languages: LanguageView[];
}

export interface AnalysisResult {
  profile: ProfileView | null;
  summary: string | null;
  languages: LanguageView[];
  repos: RepoView[];
  notice: string | null;
  unmatched: string | null;
}

const PROFILE_KEYS = [
  'name',
  'login',
  'username',
  'bio',
  'location',
  'company',
  'followers',
  'following',
  'publicRepos',
  'public_repos',
  'avatarUrl',
  'avatar_url',
] as const;

export function normalizeAnalysis(body: unknown): AnalysisResult {
  const root = isRecord(body) ? body : null;
  const profileSource = root
    ? isRecord(root['profile'])
      ? root['profile']
      : hasProfileFields(root)
        ? root
        : null
    : null;
  const profile = toProfile(profileSource);
  const summary = root ? readString(root['summary']) : null;
  const notice = root ? readString(root['notice']) : null;
  const languages = toLanguages(root?.['languages']);
  const repos = toRepos(root?.['repos'] ?? root?.['repositories']);
  const hasMapped =
    profile !== null || summary !== null || languages.length > 0 || repos.length > 0;

  return {
    profile,
    summary,
    languages,
    repos,
    notice,
    unmatched: hasMapped ? null : toPrettyJson(body),
  };
}

function toProfile(source: Record<string, unknown> | null): ProfileView | null {
  if (!source || !hasProfileFields(source)) {
    return null;
  }

  const username = readString(source['username'] ?? source['login']) ?? 'unknown';
  return {
    name: readString(source['name']) ?? username,
    username,
    bio: readString(source['bio']),
    location: readString(source['location']),
    company: readString(source['company']),
    followers: readNumber(source['followers']),
    following: readNumber(source['following']),
    publicRepos: readNumber(source['publicRepos'] ?? source['public_repos']),
    avatarUrl: readHttpUrl(source['avatarUrl'] ?? source['avatar_url']),
    profileUrl: readHttpUrl(source['profileUrl'] ?? source['htmlUrl'] ?? source['html_url']),
  };
}

function toLanguages(value: unknown): LanguageView[] {
  const entries = readLanguageEntries(value);
  if (entries.length === 0) {
    return [];
  }

  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  const alreadyPercent = total >= 95 && total <= 105;

  return entries
    .sort((left, right) => right.value - left.value)
    .map((entry) => ({
      name: entry.name,
      percent: alreadyPercent
        ? Math.round(entry.value)
        : total > 0
          ? Math.round((entry.value / total) * 100)
          : 0,
    }));
}

function readLanguageEntries(value: unknown): { name: string; value: number }[] {
  if (isRecord(value)) {
    return Object.entries(value).flatMap(([name, amount]) => {
      const parsed = readNumber(amount);
      return parsed === null ? [] : [{ name, value: parsed }];
    });
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const name = readString(item['name'] ?? item['language']);
    const amount = readNumber(
      item['percentage'] ?? item['percent'] ?? item['value'] ?? item['count'] ?? item['bytes'],
    );
    return name && amount !== null ? [{ name, value: amount }] : [];
  });
}

function toRepos(value: unknown): RepoView[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item === 'string') {
      const name = readString(item);
      return name ? [emptyRepo(name)] : [];
    }

    if (!isRecord(item)) {
      return [];
    }

    const name = readString(item['name'] ?? item['full_name'] ?? item['fullName']);
    if (!name) {
      return [];
    }

    return [
      {
        name,
        description: readString(item['description']),
        url: readHttpUrl(item['html_url'] ?? item['htmlUrl'] ?? item['url']),
        language: readString(item['language']),
        stars: readNumber(item['stars'] ?? item['stargazers_count'] ?? item['stargazersCount']),
        summary: readString(item['summary']),
        languages: toLanguages(item['languages']),
      },
    ];
  });
}

function emptyRepo(name: string): RepoView {
  return {
    name,
    description: null,
    url: null,
    language: null,
    stars: null,
    summary: null,
    languages: [],
  };
}

function hasProfileFields(record: Record<string, unknown>): boolean {
  return PROFILE_KEYS.some((key) => {
    const value = record[key];
    return value !== null && value !== undefined && value !== '';
  });
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }

  return null;
}

function readHttpUrl(value: unknown): string | null {
  const text = readString(value);
  if (!text) {
    return null;
  }

  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toPrettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
