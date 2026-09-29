import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AnalysisResult } from '../models/analysis';
import { GithubService } from '../services/github.service';

@Component({
  selector: 'app-home',
  imports: [FormsModule],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnDestroy {
  private readonly github = inject(GithubService);
  private request: Subscription | null = null;

  protected readonly profileUrl = signal('');
  protected readonly result = signal<AnalysisResult | null>(null);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

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

