export interface Env {
  USERS_KV: KVNamespace;
  SESSIONS_KV: KVNamespace;
  JWT_SECRET: string;
  ACCESS_TOKEN_EXPIRES: string;
  REFRESH_TOKEN_EXPIRES: string;
}

export interface User {
  username: string;
  password: string;
  role: 'user' | 'admin';
  createdAt: string;
}

export interface Session {
  userId: string;
  userAgent: string;
  createdAt: string;
}

export interface JWTPayload {
  sub: string;
  sessionId: string;
  role: string;
  exp: number;
  iat: number;
}

export type Handler = (
  request: Request,
  env: Env,
  ctx: ExecutionContext
) => Promise<Response>;

export type Middleware = (handler: Handler) => Handler;
