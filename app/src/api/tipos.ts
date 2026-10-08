/**
 * Tipos dos contratos da API (espelho dos records Java). Mudou um DTO na API, muda aqui junto.
 */

export type Papel = 'TREINADOR' | 'ALUNO';
export type Fonte = 'PADRAO' | 'METAL';
export type Tema = 'ESCURO' | 'CLARO';

export interface Marca {
  id: string;
  nome: string;
  lema: string | null;
  corPrimaria: string;
  fonteTitulo: Fonte;
  temaPadrao: Tema;
  /** Relativo à API (o app junta com a URL base). */
  logoUrl: string | null;
}

export interface UsuarioResumo {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
}

export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  /** Só no cliente nativo; a web recebe cookie HttpOnly. */
  refreshToken?: string;
  usuario: UsuarioResumo;
  marca: Marca;
}

export interface EuResponse {
  usuario: UsuarioResumo;
  marca: Marca;
  aluno?: { id: string; nome: string };
}

export interface ConvitePublico {
  consultoria: Marca;
  primeiroNomeAluno: string;
}

export interface CampoComErro {
  field: string;
  message: string;
}

/** Corpo de erro padrão da API (ApiError). */
export interface ApiErrorBody {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  codigo: string | null;
  path: string;
  requestId: string | null;
  fieldErrors: CampoComErro[] | null;
}
