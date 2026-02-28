import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'avatar', standalone: true })
export class AvatarPipe implements PipeTransform {
  transform(bytes: string | null | undefined): string | null {
    if (!bytes) return null;
    return `data:image/png;base64,${bytes}`;
  }
}
