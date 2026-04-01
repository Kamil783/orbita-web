import { Component, input, output } from '@angular/core';
import { ModalOverlayComponent } from '../modal-overlay/modal-overlay.component';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [ModalOverlayComponent],
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
}
