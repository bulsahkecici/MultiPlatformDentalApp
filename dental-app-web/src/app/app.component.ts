import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet],
    template: `
    <div style="text-align:center; padding: 20px;">
      <h1>Welcome to DentalAppWeb!</h1>
      <p>Application is running.</p>
    </div>
    <router-outlet />
  `,
    styles: []
})
export class AppComponent {
    title = 'dental-app-web';
}
