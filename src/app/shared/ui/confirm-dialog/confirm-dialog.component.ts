import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  readonly icon = input('warning');
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly cancelText = input('Отмена');
  readonly confirmText = input('Удалить');
  readonly danger = input(true);

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  onBackdropClick(): void {
    this.cancel.emit();
  }

  onDialogClick(event: MouseEvent): void {
    event.stopPropagation();
  }
}
