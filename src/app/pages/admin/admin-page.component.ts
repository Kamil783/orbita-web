import { Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppShellComponent } from '../../shared/ui/app-shell/app-shell.component';
import { TopbarComponent } from '../../shared/ui/topbar/topbar.component';
import { AdminService } from '../../features/admin/data/admin.service';
import { UserService } from '../../features/user/data/user.service';
import { CreateUserRequest, Team } from '../../features/admin/models/admin.models';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [AppShellComponent, TopbarComponent, FormsModule],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.scss',
})
export class AdminPageComponent implements OnInit {
  readonly title = 'Администрирование';

  protected readonly adminService = inject(AdminService);
  protected readonly userService = inject(UserService);

  readonly activeTab = signal<'users' | 'tasks' | 'teams'>('users');
  readonly searchQuery = signal('');

  // Add user dialog
  readonly showAddUserDialog = signal(false);
  readonly addUserLoading = signal(false);
  readonly addUserError = signal('');
  readonly roleDropdownOpen = signal(false);
  readonly roleOptions = [
    { value: 'User', label: 'Пользователь', icon: 'person' },
    { value: 'Admin', label: 'Администратор', icon: 'shield_person' },
  ];
  newUserName = '';
  newUserEmail = '';
  newUserPassword = '';
  newUserRole = 'User';

  @HostListener('document:click')
  onDocumentClick(): void {
    this.roleDropdownOpen.set(false);
  }

  readonly filteredUsers = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const users = this.adminService.users();
    if (!q) return users;
    return users.filter(u =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  });

  readonly filteredTasks = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const tasks = this.adminService.backlogTasks();
    if (!q) return tasks;
    return tasks.filter(t => t.title.toLowerCase().includes(q));
  });

  readonly filteredTeams = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const teams = this.adminService.teams();
    if (!q) return teams;
    return teams.filter(t => t.name.toLowerCase().includes(q));
  });

  // Create team dialog
  readonly showCreateTeamDialog = signal(false);
  newTeamName = '';

  // Add member dialog
  readonly showAddMemberDialog = signal(false);
  addMemberTeamId = '';
  addMemberTeamName = '';
  addMemberUserId = '';

  readonly availableUsersForTeam = computed(() => {
    const teams = this.adminService.teams();
    const team = teams.find(t => t.id === this.addMemberTeamId);
    const memberIds = new Set(team?.members.map(m => m.id) ?? []);
    return this.adminService.users().filter(u => !memberIds.has(u.id));
  });

  ngOnInit(): void {
    this.adminService.loadUsers();
    this.adminService.loadBacklogTasks();
    this.adminService.loadTeams();
    this.userService.loadMembers();
  }

  setTab(tab: 'users' | 'tasks' | 'teams'): void {
    this.activeTab.set(tab);
    this.searchQuery.set('');
  }

  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  // ── Add user dialog ──

  openAddUser(): void {
    this.newUserName = '';
    this.newUserEmail = '';
    this.newUserPassword = '';
    this.newUserRole = 'User';
    this.addUserError.set('');
    this.roleDropdownOpen.set(false);
    this.showAddUserDialog.set(true);
  }

  cancelAddUser(): void {
    this.showAddUserDialog.set(false);
  }

  onAddUserBackdropClick(): void {
    if (!this.addUserLoading()) {
      this.showAddUserDialog.set(false);
    }
  }

  onAddUserDialogClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  saveNewUser(): void {
    this.addUserError.set('');

    if (!this.newUserName.trim() || !this.newUserEmail.trim() || !this.newUserPassword.trim()) {
      this.addUserError.set('Заполните все поля');
      return;
    }

    if (this.newUserPassword.length < 6) {
      this.addUserError.set('Пароль должен содержать минимум 6 символов');
      return;
    }

    const request: CreateUserRequest = {
      name: this.newUserName.trim(),
      email: this.newUserEmail.trim(),
      password: this.newUserPassword,
      role: this.newUserRole,
    };

    this.addUserLoading.set(true);
    this.adminService.createUser(request);
    this.addUserLoading.set(false);
    this.showAddUserDialog.set(false);
  }

  // ── Create team dialog ──

  openCreateTeam(): void {
    this.newTeamName = '';
    this.showCreateTeamDialog.set(true);
  }

  saveNewTeam(): void {
    const name = this.newTeamName.trim();
    if (!name) return;
    this.adminService.createTeam(name);
    this.showCreateTeamDialog.set(false);
  }

  // ── Add member dialog ──

  openAddMember(team: Team): void {
    this.addMemberTeamId = team.id;
    this.addMemberTeamName = team.name;
    this.addMemberUserId = '';
    this.showAddMemberDialog.set(true);
  }

  saveAddMember(): void {
    if (!this.addMemberUserId) return;
    this.adminService.addTeamMember(this.addMemberTeamId, this.addMemberUserId);
    this.showAddMemberDialog.set(false);
  }

  resolveUserName(userId: string): string {
    const map = this.userService.membersMap();
    return map.get(userId)?.name ?? userId;
  }

  resolveAssigneeNames(ids?: string[]): string {
    if (!ids?.length) return '—';
    return ids.map(id => this.resolveUserName(id)).join(', ');
  }

  priorityLabel(priority: string): string {
    const labels: Record<string, string> = {
      critical: 'Критичный',
      high: 'Высокий',
      medium: 'Средний',
      low: 'Низкий',
    };
    return labels[priority] ?? priority;
  }

  roleLabel(role: string): string {
    const labels: Record<string, string> = {
      Admin: 'Администратор',
      User: 'Пользователь',
    };
    return labels[role] ?? role;
  }

  userInitial(name: string): string {
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
