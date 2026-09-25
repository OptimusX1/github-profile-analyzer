import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-home',
  imports: [FormsModule],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  protected readonly profileUrl = signal('');

  protected analyze(): void {
    // Frontend-only for now; results stay empty until a backend is added.
  }
}
