import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { AnalysisResult, normalizeAnalysis } from '../models/analysis';

export const ANALYZE_API_URL = 'http://localhost:3000/api/analyze';

@Injectable({ providedIn: 'root' })
export class GithubService {
  private readonly http = inject(HttpClient);

  analyze(userName: string): Observable<AnalysisResult> {
    return this.http
      .post<unknown>(ANALYZE_API_URL, { userName })
      .pipe(map((body) => normalizeAnalysis(body)));
  }
}
