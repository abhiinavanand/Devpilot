export interface User {
    id: string;
    username: string;
    email: string;
    passwordHash: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Project {
    id: string;
    name: string;
    description: string;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface Notification {
    id: string;
    userId: string;
    message: string;
    type: 'info' | 'warning' | 'error';
    createdAt: Date;
}

export interface AnalyticsData {
    projectId: string;
    metrics: Record<string, number>;
    timestamp: Date;
}

export interface AuthToken {
    userId: string;
    token: string;
    expiresAt: Date;
}