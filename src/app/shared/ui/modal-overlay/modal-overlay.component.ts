import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-modal-overlay',
  standalone: true,
  template: `
    <div
      class="overlay"
      [class.overlay--panel]="mode() === 'panel'"
      (click)="close.emit()"
    >
      <div
        [class]="containerClass()"
        [class.dialog__scroll]="mode() === 'dialog'"
        (click)="$event.stopPropagation()"
      >
        <ng-content />
      </div>
    </div>
  `,
  styleUrl: './modal-overlay.component.scss',
})
export class ModalOverlayComponent {
  readonly mode = input<'dialog' | 'panel'>('dialog');
  readonly size = input<'sm' | 'md' | 'lg'>('sm');
  readonly close = output<void>();

  readonly containerClass = computed(() => {
    if (this.mode() === 'panel') return 'panel';
    const sizeClass = this.size() !== 'sm' ? ` dialog--${this.size()}` : '';
    return `dialog${sizeClass}`;
  });
}
