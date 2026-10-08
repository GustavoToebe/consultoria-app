import { requisicao } from './cliente';
import type { ConvitePublico, EuResponse, LoginResponse } from './tipos';

/** Uma função por rota da API. As telas não montam URL nem método. */

// ---- Sessão ----

export const entrar = (email: string, senha: string) =>
  requisicao<LoginResponse>('/auth/login', { metodo: 'POST', corpo: { email, senha }, semRenovar: true });

export const sairDaApi = (refreshToken: string | null) =>
  requisicao<void>('/auth/logout', {
    metodo: 'POST',
    corpo: refreshToken ? { refreshToken } : undefined,
    semRenovar: true,
  });

export const cadastrarTreinador = (dados: { nomeConsultoria: string; nome: string; email: string; senha: string }) =>
  requisicao<LoginResponse>('/auth/cadastro-treinador', { metodo: 'POST', corpo: dados, semRenovar: true });

export const eu = () => requisicao<EuResponse>('/eu');

export const trocarSenha = (senhaAtual: string, senhaNova: string) =>
  requisicao<LoginResponse>('/eu/senha', { metodo: 'PUT', corpo: { senhaAtual, senhaNova } });

// ---- Convite (público) ----

export const consultarConvite = (codigo: string) =>
  requisicao<ConvitePublico>(`/publico/convites/${encodeURIComponent(codigo)}`, { semRenovar: true });

export const aceitarConvite = (codigo: string, email: string, senha: string) =>
  requisicao<LoginResponse>(`/publico/convites/${encodeURIComponent(codigo)}/aceitar`, {
    metodo: 'POST',
    corpo: { email, senha },
    semRenovar: true,
  });
