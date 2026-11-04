export type AppRole = 'administrator' | 'agency_editor'

export type AuthStatus =
  | 'loading'
  | 'anonymous'
  | 'authenticated'
  | 'error'
  | 'unconfigured'

export interface AuthUser {
  id: string
  email: string | null
}

export interface AuthSession {
  user: AuthUser
}

export interface AccessIdentity {
  displayName: string | null
  role: AppRole | null
  agencyIds: readonly string[]
}

export interface AuthFailure {
  code?: string
  message: string
}

export interface AuthResult {
  session: AuthSession | null
  error: AuthFailure | null
}

export interface AuthGateway {
  getSession(): Promise<AuthResult>
  signIn(email: string, password: string): Promise<AuthResult>
  signOut(): Promise<AuthFailure | null>
  loadAccess(userId: string): Promise<AccessIdentity>
  loadDisplayName?(userId: string): Promise<string | null>
  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void
}
