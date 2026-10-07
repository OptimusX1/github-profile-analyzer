import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AnalysisResult, LanguageView, RepoView } from '../models/analysis';
import { GithubService } from '../services/github.service';

@Component({
  selector: 'app-home',
  imports: [FormsModule],
  templateUrl: './home.html',
  styleUrl: './home.view.css',
})
export class Home implements OnDestroy {
  private readonly github = inject(GithubService);
  private request: Subscription | null = null;

  protected readonly profileUrl = signal('');
  protected readonly result = signal<AnalysisResult | null>(null);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly theme = signal<Theme>(readStoredTheme());

  constructor() {
    this.applyTheme(this.theme());
  }

  protected toggleTheme(): void {
    const next = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(next);
    this.applyTheme(next);
  }

  protected analyze(): void {
    if (this.loading()) {
      return;
    }

    const url = this.profileUrl().trim();
    this.cancelRequest();
    this.result.set(null);
    this.errorMessage.set(null);

    const userName = this.toGithubUsername(url);
    if (!url) {
      this.errorMessage.set('Enter a GitHub profile URL.');
      return;
    }

    if (!userName) {
      this.errorMessage.set(
        'Enter a valid GitHub profile URL, like https://github.com/username.',
      );
      return;
    }

    this.loading.set(true);
    this.request = this.github.analyze(userName).subscribe({
      next: (result) => {
        this.request = null;
        this.result.set(result);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.request = null;
        this.errorMessage.set(this.toErrorMessage(error));
        this.loading.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    this.cancelRequest();
  }

  protected initial(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }

  protected formatStat(value: number | null): string {
    return value === null ? '—' : new Intl.NumberFormat('en-US').format(value);
  }

  protected languageColor(name: string): string {
    return LANGUAGE_COLORS[name] ?? '#8b949e';
  }

  protected languageSummary(languages: LanguageView[]): string {
    return languages.map((language) => `${language.name} ${language.percent}%`).join(', ');
  }

  protected languageHint(data: AnalysisResult): string | null {
    const hasForks = data.repos.some((repo) => repo.fork);
    if (data.languageScope === 'all') {
      return 'Includes forks because no original repositories had detected languages.';
    }
    if (hasForks) {
      return 'Counted from original repositories only, so a large fork does not skew this breakdown.';
    }
    return null;
  }

  protected repoGroups(repos: RepoView[]): RepoGroup[] {
    const originals = repos.filter((repo) => !repo.fork);
    const forks = repos.filter((repo) => repo.fork);
    const groups: RepoGroup[] = [];

    if (originals.length) {
      groups.push({
        id: 'original-repos-heading',
        title: `Original repositories (${originals.length})`,
        hint: "Repositories this account created, not forks of someone else's work.",
        repos: originals,
      });
    }

    if (forks.length) {
      groups.push({
        id: 'forks-heading',
        title: `Forks (${forks.length})`,
        hint: originals.length
          ? 'Forked from other accounts. Left out of the language breakdown.'
          : 'No original repositories were found. These are forks of other accounts.',
        repos: forks,
      });
    }

    return groups;
  }

  private applyTheme(theme: Theme): void {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.dataset['theme'] = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Storage can be unavailable in private mode.
    }
  }

  private cancelRequest(): void {
    this.request?.unsubscribe();
    this.request = null;
  }

  private toErrorMessage(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Something went wrong while analyzing this profile.';
    }

    const message = readErrorMessage(error.error);
    if (message) {
      return message;
    }

    if (error.status === 0) {
      return 'Could not reach the analyzer API. Make sure the backend is running on port 3000.';
    }

    if (error.status === 404) {
      return 'The analyzer API was not found. Expected POST /api/analyze on port 3000.';
    }

    return `Analysis failed (${error.status}).`;
  }

  private toGithubUsername(value: string): string | null {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;

    let url: URL;
    try {
      url = new URL(withProtocol);
    } catch {
      return null;
    }

    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'github.com' || url.username || url.password) {
      return null;
    }

    const segments = url.pathname.split('/').filter(Boolean);
    const username = segments[0];
    if (
      segments.length !== 1 ||
      !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(username)
    ) {
      return null;
    }

    return username;
  }
}

type Theme = 'dark' | 'light';

const THEME_KEY = 'gpa-theme';

function readStoredTheme(): Theme {
  if (typeof localStorage === 'undefined') {
    return 'dark';
  }

  return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
}

const LANGUAGE_COLORS: Record<string, string> = {
  'Jupyter Notebook': '#ff7a18',
  TypeScript: '#3b82f6',
  JavaScript: '#eab308',
  Python: '#5b9fd8',
  HTML: '#ef4444',
  CSS: '#8b5cf6',
  SCSS: '#c6538c',
  Shell: '#22c55e',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Go: '#00ADD8',
  Rust: '#dea584',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  Vue: '#41b883',
  Dockerfile: '#384d54',
  Makefile: '#8fbc4a',
  Lua: '#6e8cff',
  Solidity: '#AA6746',
  PLpgSQL: '#336790',
  Perl: '#0298c3',
  R: '#198CE7',
  Scala: '#c22d40',
  Haskell: '#5e5086',
  Elixir: '#6e4a7e',
  Clojure: '#db5855',
  PowerShell: '#5ea4e0',
  'Objective-C': '#438eff',
  TeX: '#3D6117',
  Assembly: '#6E4C13',
  Other: '#6e7681',
};


interface RepoGroup {
  id: string;
  title: string;
  hint: string;
  repos: RepoView[];
}

function readErrorMessage(body: unknown): string | null {
  if (typeof body === 'string') {
    const trimmed = body.trim();
    return trimmed && !trimmed.startsWith('<') ? trimmed : null;
  }

  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const record = body as { message?: unknown; error?: unknown };
  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message.trim();
  }

  if (typeof record.error === 'string' && record.error.trim()) {
    return record.error.trim();
  }

  return null;
}

