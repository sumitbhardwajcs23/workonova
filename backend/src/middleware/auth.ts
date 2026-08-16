import { verify } from 'hono/jwt';
import { JWT_SECRET } from '../routes/auth.js';

export async function authGuard(c: any, next: any) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized. Bearer token required.' }, 401);
  }
  
  const token = authHeader.split(' ')[1];
  try {
    const payload = await verify(token, JWT_SECRET, 'HS256');
    c.set('user', payload);
    await next();
  } catch (e) {
    return c.json({ error: 'Unauthorized. Invalid or expired token.' }, 401);
  }
}

export function roleGuard(allowedRoles: string[]) {
  return async (c: any, next: any) => {
    const user = c.get('user');
    if (!user || !allowedRoles.includes(user.role)) {
      return c.json({ error: 'Forbidden. Access denied.' }, 403);
    }
    await next();
  };
}
