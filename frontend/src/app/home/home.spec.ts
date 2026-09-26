import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Home } from './home';

describe('Home', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
    }).compileComponents();
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

  it('should show a loading state, then a dummy profile card', async () => {
    vi.useFakeTimers();
    try {
      const fixture = TestBed.createComponent(Home);
      fixture.detectChanges();
      setProfileUrl(fixture, 'https://github.com/alexrivera');
      submit(fixture);

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.results-loading')?.textContent).toContain('Analyzing profile');
      expect(compiled.querySelector('.analyze-btn')?.textContent).toContain('Analyzing');
      expect(compiled.querySelector('.profile-card')).toBeNull();

      await vi.advanceTimersByTimeAsync(700);
      fixture.detectChanges();

      expect(compiled.querySelector('.profile-card')?.textContent).toContain('Alex Rivera');
      expect(compiled.querySelector('.results-loading')).toBeNull();
      expect(compiled.querySelector('.results-error')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
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
