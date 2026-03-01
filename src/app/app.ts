import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from './features/notifications/ui/toast-container/toast-container.component';
import { ThemeService } from './shared/data/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainerComponent],
  templateUrl: './app.html',
})
export class App {
  constructor(private readonly _themeService: ThemeService) {}
}
