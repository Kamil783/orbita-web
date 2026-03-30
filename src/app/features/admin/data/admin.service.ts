import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import {
  AdminUser,
  CreateUserRequest,
  AdminBacklogTask,
  Team,
  CreateTeamRequest,
  AddTeamMemberRequest,
} from '../models/admin.models';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly apiUrl = environment.apiUrl;
  private readonly http = inject(HttpClient);

  readonly users = signal<AdminUser[]>([]);
  readonly backlogTasks = signal<AdminBacklogTask[]>([]);
  readonly teams = signal<Team[]>([]);

  loadUsers(): void {
    this.http.get<AdminUser[]>(`${this.apiUrl}/api/Admin/users`).subscribe(users => {
      this.users.set(users);
    });
  }

  createUser(request: CreateUserRequest): void {
    this.http.post<AdminUser>(`${this.apiUrl}/api/Auth/registration`, request).subscribe(user => {
      this.users.update(list => [...list, user]);
    });
  }

  loadBacklogTasks(): void {
    this.http.get<AdminBacklogTask[]>(`${this.apiUrl}/api/Admin/backlog`).subscribe(tasks => {
      this.backlogTasks.set(tasks);
    });
  }

  // ─── Teams ───

  loadTeams(): void {
    this.http.get<Team[]>(`${this.apiUrl}/api/Team`).subscribe(teams => {
      this.teams.set(teams);
    });
  }

  createTeam(name: string): void {
    this.http.post<Team>(`${this.apiUrl}/api/Team`, { name } as CreateTeamRequest)
      .subscribe(created => {
        this.teams.update(list => [...list, { ...created, members: [] }]);
      });
  }

  addTeamMember(teamId: string, userId: string): void {
    this.http.post(`${this.apiUrl}/api/Team/members`, { teamId, userId } as AddTeamMemberRequest)
      .subscribe(() => {
        this.loadTeams();
      });
  }
}
