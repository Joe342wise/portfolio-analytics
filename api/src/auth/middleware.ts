import { Request } from 'express';

interface User {
  id: string;
  email: string;
  tenantId: string;
  createdAt: Date;
}

export async function authMiddleware(req: Request): Promise<User | null> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  // In development mode, accept mock tokens
  if (process.env.NODE_ENV === 'development' && token === 'dev-token') {
    return {
      id: '550e8400-e29b-41d4-a716-446655440001',
      email: 'dev@example.com',
      tenantId: 'tenant-1',
      createdAt: new Date(),
    };
  }

  try {
    // TODO: Integrate with Clerk for production
    // const { userId } = await clerkClient.verifyToken(token);
    // const user = await clerkClient.users.getUser(userId);

    // For now, return mock user with proper UUID
    return {
      id: '550e8400-e29b-41d4-a716-446655440001',
      email: 'dev@example.com',
      tenantId: 'tenant-1',
      createdAt: new Date(),
    };
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}
