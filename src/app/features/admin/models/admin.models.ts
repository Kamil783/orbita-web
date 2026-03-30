export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  createdAt?: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: string;
}

export interface AdminBacklogTask {
  id: string;
  title: string;
  description?: string;
  priority: string;
  isCompleted: boolean;
  inWeek: boolean;
  creatorId: string;
  creatorName?: string;
  assigneeIds?: string[];
  dueDate?: string;
  createdAt?: string;
}

// ─── Teams ───

export interface TeamMember {
  id: string;
  name: string;
  avatar?: string;
}

export interface Team {
  id: string;
  name: string;
  members: TeamMember[];
}

export interface CreateTeamRequest {
  name: string;
}

export interface AddTeamMemberRequest {
  teamId: string;
  userId: string;
}
