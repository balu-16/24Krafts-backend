export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    phone: string;
    email?: string;
  };
  profile?: {
    id: string;
    role: string;
  };
}

