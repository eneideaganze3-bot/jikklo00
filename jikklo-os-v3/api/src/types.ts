export type Env = {
  DB: D1Database;
  JWT_SECRET: string;
  WHATSAPP_API_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  ENVIRONMENT: string;
};

export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  roleId: string;
  roleName: string;
  permissions: string[];
};

export type Variables = {
  user: AuthUser;
};
