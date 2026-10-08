import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { AnalysisResult, normalizeAnalysis } from '../models/analysis';

const LOCAL_API_URL = 'http://localhost:3000/api/analyze';
const RENDER_API_URL = 'https://github-profile-analyzer-jnse.onrender.com/api/analyze';

export const ANALYZE_API_URL = isLocalHost() ? LOCAL_API_URL : RENDER_API_URL;

function isLocalHost(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

@Injectable({ providedIn: 'root' })
export class GithubService {
  private readonly http = inject(HttpClient);

  analyze(userName: string): Observable<AnalysisResult> {
    return this.http
      .post<unknown>(ANALYZE_API_URL, { userName })
      .pipe(map((body) => normalizeAnalysis(body)));
  }
}
