import { Component, signal } from '@angular/core';
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
export class Home {
  protected readonly profileUrl = signal('');
  protected readonly profile = signal<DummyProfile | null>(null);

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
    this.profile.set(this.dummyProfile);
  }
}
