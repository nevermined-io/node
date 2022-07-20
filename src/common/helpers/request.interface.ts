import { AuthRoles } from '../type';

interface AuthUser {
  userId: string;
  address: string;
  roles: AuthRoles[];
}

interface AuthData {
  client_id: string;
  did: string;
  sub: string;
}

export interface Request<G> {
  hostname: string;
  body?: G;
  query?: G;
  params?: G;
  client: { localPort: number };
  protocol: string;
  url: string;
  user?: AuthUser;
  authData?: AuthData
}
