import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { SlimSidebarComponent } from '../slim-sidebar/slim-sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';

const LOCK_CLASS = 'app-shell-locked';

@Component({
  selector: 'app-app-shell',
  standalone: true,
  imports: [SlimSidebarComponent, TopbarComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);

  // The shell is a fixed-height layout with its own inner scroll containers, so
  // the document must never scroll. On iOS a document scroll makes Safari hide
  // its URL bar, which resizes the viewport out from under the fixed top/bottom
  // bars and leaves them overlapping the content.
  ngOnInit(): void {
    this.document.documentElement.classList.add(LOCK_CLASS);
    this.document.body.classList.add(LOCK_CLASS);
  }

  ngOnDestroy(): void {
    this.document.documentElement.classList.remove(LOCK_CLASS);
    this.document.body.classList.remove(LOCK_CLASS);
  }
}
