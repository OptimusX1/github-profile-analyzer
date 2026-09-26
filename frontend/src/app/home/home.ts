import { Component, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface DummyProfile {
  name: string;
  username: string;
  bio: string;
  location: string;
  company: string;
  followers: number;
  following: number;
  publicRepos: number;
}

@Component({
  selector: 'app-home',
  imports: [FormsModule],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnDestroy {
  protected readonly profileUrl = signal('');
  protected readonly profile = signal<DummyProfile | null>(null);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private loadTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly dummyProfile: DummyProfile = {
    name: 'Alex Rivera',
    username: 'alexrivera',
    bio: 'Full-stack engineer building developer tools and open-source libraries.',
    location: 'Austin, TX',
    company: '@octokit',
    followers: 1284,
    following: 87,
    publicRepos: 42,
  };

  protected analyze(): void {
    if (this.loading()) {
      return;
    }

    const url = this.profileUrl().trim();
    this.clearLoadTimer();
    this.profile.set(null);
    this.errorMessage.set(null);

    if (!url) {
      this.errorMessage.set('Enter a GitHub profile URL.');
      return;
    }

    if (!this.isGithubProfileUrl(url)) {
      this.errorMessage.set(
        'Enter a valid GitHub profile URL, like https://github.com/username.',
      );
      return;
    }

    this.loading.set(true);
    this.loadTimer = setTimeout(() => {
      this.loadTimer = null;
      this.profile.set(this.dummyProfile);
      this.loading.set(false);
    }, 700);
  }

  ngOnDestroy(): void {
    this.clearLoadTimer();
  }

  private clearLoadTimer(): void {
    if (this.loadTimer !== null) {
      clearTimeout(this.loadTimer);
      this.loadTimer = null;
    }
  }

  private isGithubProfileUrl(value: string): boolean {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;

    let url: URL;
    try {
      url = new URL(withProtocol);
    } catch {
      return false;
    }

    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'github.com' || url.username || url.password) {
      return false;
    }

    const segments = url.pathname.split('/').filter(Boolean);
    const username = segments[0];
    return (
      segments.length === 1 &&
      /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(username)
    );
  }
}
