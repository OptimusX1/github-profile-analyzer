import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ANALYZE_API_URL } from '../services/github.service';
import { Home } from './home';

describe('Home', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('should render the application title', async () => {
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('GitHub Profile Analyzer');
  });

  it('should show an empty results section', async () => {
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.results-empty')?.textContent).toContain('No results yet.');
  });

  it('should show an error when the URL is missing', async () => {
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    submit(fixture);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.results-error')?.textContent).toContain(
      'Enter a GitHub profile URL.',
    );
    expect(compiled.querySelector('.profile-card')).toBeNull();
    expect(compiled.querySelector('.results-loading')).toBeNull();
  });

  it('should show an error for an invalid GitHub URL', async () => {
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    setProfileUrl(fixture, 'https://example.com/not-github');
    submit(fixture);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.results-error')?.textContent).toContain(
      'Enter a valid GitHub profile URL',
    );
    expect(compiled.querySelector('.profile-card')).toBeNull();
  });

  it('should call the analyzer API and show the response', async () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    await fixture.whenStable();
    setProfileUrl(fixture, 'https://github.com/octocat');
    await fixture.whenStable();
    submit(fixture);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.results-loading')?.textContent).toContain('Analyzing profile');
    expect(compiled.querySelector('.analyze-btn')?.textContent).toContain('Analyzing');
    expect(compiled.querySelector('.profile-card')).toBeNull();

    const request = http.expectOne(ANALYZE_API_URL);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ userName: 'octocat' });
    request.flush({
      profile: {
        name: 'The Octocat',
        login: 'octocat',
        bio: 'GitHub mascot',
        company: '@github',
        location: 'San Francisco',
        followers: 10,
        following: 2,
        public_repos: 8,
        avatar_url: 'https://avatars.githubusercontent.com/u/583231',
      },
      languageScope: 'original',
      repos: [
        {
          name: 'Hello-World',
          fork: false,
          description: 'My first repository',
          html_url: 'https://github.com/octocat/Hello-World',
          language: 'JavaScript',
          stargazers_count: 5,
          summary:
            'My first repository on GitHub. Written mainly in JavaScript (80%), with Ruby (20%).',
          languages: { JavaScript: 80, Ruby: 20 },
        },
        {
          name: 'Spoon-Knife',
          fork: true,
          description: 'This repo is for demonstration purposes only.',
          html_url: 'https://github.com/octocat/Spoon-Knife',
          language: 'HTML',
          stargazers_count: 1,
          summary: 'Fork. This repo is for demonstration purposes only. Written in HTML.',
          languages: { HTML: 100 },
        },
      ],
      languages: { JavaScript: 80, Ruby: 20, Lua: 0 },
      summary: 'A well-known GitHub mascot.',
    });
    fixture.detectChanges();

    expect(compiled.querySelector('.profile-card')?.textContent).toContain('The Octocat');
    expect(compiled.querySelector('.profile-card')?.textContent).toContain('@octocat');
    expect(compiled.querySelector('.summary')?.textContent).toContain('A well-known GitHub mascot.');
    expect(compiled.querySelector('.repo-summary')?.textContent).toContain(
      'My first repository on GitHub',
    );
    expect(compiled.querySelector('.repo-summary')?.textContent).toContain('JavaScript (80%)');
    expect(compiled.querySelector('.repo-list')?.textContent).toContain('Hello-World');
    expect(compiled.querySelector('#original-repos-heading')?.textContent).toContain(
      'Original repositories (1)',
    );
    expect(compiled.querySelector('#forks-heading')?.textContent).toContain('Forks (1)');
    expect(compiled.querySelector('.badge--original')?.textContent).toContain('Original');
    expect(compiled.querySelector('.badge--fork')?.textContent).toContain('Fork');
    expect(compiled.textContent).toContain('Spoon-Knife');
    expect(compiled.querySelector('.language-hint')?.textContent).toContain(
      'original repositories only',
    );
    expect(compiled.querySelector('.language-bar')).not.toBeNull();
    expect(compiled.querySelector('.language-list')?.textContent).toContain('JavaScript');
    expect(compiled.querySelector('.language-list')?.textContent).toContain('80%');
    expect(compiled.querySelector('.language-list')?.textContent).not.toContain('Lua');
    expect(compiled.querySelector('.results-loading')).toBeNull();
    expect(compiled.querySelector('.results-error')).toBeNull();
  });

  it('should show a backend error in the results section', async () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    await fixture.whenStable();
    setProfileUrl(fixture, 'github.com/missing');
    await fixture.whenStable();
    submit(fixture);

    http.expectOne(ANALYZE_API_URL).flush(
      { message: 'Profile not found.' },
      { status: 404, statusText: 'Not Found' },
    );
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.results-error')?.textContent).toContain('Profile not found.');
    expect(compiled.querySelector('.profile-card')).toBeNull();
  });
});

function setProfileUrl(fixture: ComponentFixture<Home>, value: string): void {
  const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

function submit(fixture: ComponentFixture<Home>): void {
  fixture.nativeElement.querySelector('.analyze-btn')?.click();
  fixture.detectChanges();
}
