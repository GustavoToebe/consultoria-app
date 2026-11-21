import type { TipoDeAvisoWhatsApp } from '../servicos/whatsapp';
import { codigoApi } from '../ui/erros';

export const ROTULOS_TIPO_AVISO: Readonly<Record<TipoDeAvisoWhatsApp, string>> = {
  ANTES: 'Lembrete antes do vencimento',
  NO_DIA: 'Lembrete no dia do vencimento',
  DEPOIS: 'Lembrete após o vencimento',
  COMPROMISSO_NOVO: 'Compromisso marcado',
  COMPROMISSO_REMARCADO: 'Compromisso remarcado',
  COMPROMISSO_CANCELADO: 'Compromisso cancelado',
};

export type TipoSeloModelo = 'sucesso' | 'atencao' | 'perigo' | 'neutro';

/** Traduz a situação devolvida pela Meta para um selo legível no app. */
export function seloDaSituacaoModelo(
  situacao: string | null | undefined,
  configurado: boolean,
): { texto: string; tipo: TipoSeloModelo } {
  if (!configurado) {
    return { texto: 'Não configurado', tipo: 'neutro' };
  }
  switch (situacao) {
    case 'APPROVED':
      return { texto: 'Aprovado', tipo: 'sucesso' };
    case 'PENDING':
      return { texto: 'Em análise', tipo: 'atencao' };
    case 'REJECTED':
    case 'DISABLED':
    case 'PAUSED':
      return { texto: 'Recusado na Meta', tipo: 'perigo' };
    case 'NAO_ENCONTRADO':
      return { texto: 'Não encontrado na Meta', tipo: 'perigo' };
    case 'INDISPONIVEL':
      return { texto: 'Não conferido', tipo: 'neutro' };
    default:
      return { texto: 'Configurado', tipo: 'neutro' };
  }
}

export interface ErrosConexaoWhatsApp {
  phoneNumberId?: string;
  wabaId?: string;
  accessToken?: string;
}

/** Valida os campos da conexão Meta antes de enviar à API. */
export function validarConexaoWhatsApp(dados: {
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  configurada: boolean;
}): ErrosConexaoWhatsApp {
  const erros: ErrosConexaoWhatsApp = {};
  const phone = dados.phoneNumberId.trim();
  const waba = dados.wabaId.trim();
  const token = dados.accessToken.trim();

  if (!phone) {
    erros.phoneNumberId = 'Informe o ID do número de telefone (Phone Number ID).';
  } else if (phone.length > 40) {
    erros.phoneNumberId = 'O ID do número de telefone deve ter até 40 caracteres.';
  }

  if (!waba) {
    erros.wabaId = 'Informe o ID da conta comercial (WABA ID).';
  } else if (waba.length > 40) {
    erros.wabaId = 'O WABA ID deve ter até 40 caracteres.';
  }

  if (!dados.configurada && !token) {
    erros.accessToken = 'Informe o token de acesso da Meta para conectar.';
  } else if (token.length > 1024) {
    erros.accessToken = 'O token de acesso deve ter até 1024 caracteres.';
  }

  return erros;
}

export interface ErrosModeloWhatsApp {
  nome?: string;
  idioma?: string;
}

/** Valida os campos do modelo de aviso antes de enviar à API. */
export function validarModeloWhatsApp(dados: { nome: string; idioma: string }): ErrosModeloWhatsApp {
  const erros: ErrosModeloWhatsApp = {};
  const nome = dados.nome.trim();
  const idioma = dados.idioma.trim();

  if (!nome) {
    erros.nome = 'Informe o nome exato do modelo cadastrado na Meta.';
  } else if (nome.length > 512) {
    erros.nome = 'O nome do modelo deve ter até 512 caracteres.';
  }

  if (!idioma) {
    erros.idioma = 'Informe o código do idioma (ex.: pt_BR).';
  } else if (idioma.length > 10) {
    erros.idioma = 'O idioma deve ter até 10 caracteres.';
  }

  return erros;
}

/** Indica que a chave do WhatsApp oficial está desligada no servidor (503 WHATSAPP_INDISPONIVEL). */
export function ehWhatsAppIndisponivel(erro: unknown): boolean {
  return codigoApi(erro) === 'WHATSAPP_INDISPONIVEL';
}
