import { Component, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-column-create-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './column-create-dialog.component.html',
  styleUrl: './column-create-dialog.component.scss',
})
export class ColumnCreateDialogComponent {
  readonly save = output<string>();
  readonly cancel = output<void>();

  readonly columnName = signal('');

  onSave(): void {
    const name = this.columnName().trim();
    if (name) {
      this.save.emit(name);
    }
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onBackdropClick(): void {
    this.cancel.emit();
  }

  onDialogClick(event: MouseEvent): void {
    event.stopPropagation();
  }
}
