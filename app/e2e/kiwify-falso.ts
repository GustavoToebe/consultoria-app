import type { Route } from '@playwright/test';

import type { KiwifyConfiguracao, KiwifyRequest } from '../src/api/financeiroKiwify';
import { erroApi, json, type RespostasApi } from './api-falsa';

/**
 * Kiwify de mentira para os testes de tela (D20: nunca a real): a credencial por consultoria em memória, no contrato de
 * `src/api/financeiroKiwify.ts`. Os segredos recebidos ficam só aqui (`recebidos`), para o teste conferir o corpo; nenhuma
 * resposta os devolve. Só valores fictícios; a URL é de um domínio `.invalid`, que nunca resolve.
 */

export const URL_DO_WEBHOOK = 'https://api.exemplo.invalid/publico/pagamentos/kiwify/tok3n-da-consultoria-de-teste';

/** Credenciais fictícias que o teste digita (nenhuma é de verdade). */
export const CREDENCIAIS_FALSAS = {
  tokenDoWebhook: 'token-ficticio-do-webhook-123456',
  clientId: 'cliente-ficticio-a1b2',
  clientSecret: 'segredo-ficticio-xyz-987',
  accountId: 'conta-ficticia-42',
};

export interface EstadoKiwify {
  config: KiwifyConfiguracao;
  /** Os corpos recebidos pelo `PUT` (inclusive os recusados). */
  recebidos: KiwifyRequest[];
  /** As versões recebidas pelo `DELETE`. */
  remocoes: (string | null)[];
  /** Preenchida: o próximo `PUT` responde 422 `KIWIFY_INVALIDA` com estes campos (uma vez), como o servidor faria. */
  recusa: { field: string; message: string }[] | null;
  /** O `GET` responde 503 `KIWIFY_INDISPONIVEL` (a chave desligada no servidor com o `/eu` antigo dizendo ligada). */
  indisponivel: boolean;
  /** A URL vem só para quem tem `FINANCEIRO_ALTERAR` (a API decide; o teste de leitura a desliga). */
  comUrl: boolean;
}

export const KIWIFY_NAO_CONFIGURADA: KiwifyConfiguracao = { configurada: false, webhookUrl: null, clientIdFinal: null, versao: null };
export const KIWIFY_CONFIGURADA: KiwifyConfiguracao = { configurada: true, webhookUrl: URL_DO_WEBHOOK, clientIdFinal: 'a1b2', versao: 0 };

export function estadoKiwify(parcial: Partial<EstadoKiwify> = {}): EstadoKiwify {
  return { config: { ...KIWIFY_NAO_CONFIGURADA }, recebidos: [], remocoes: [], recusa: null, indisponivel: false, comUrl: true, ...parcial };
}

const conflito = (route: Route) => json(route, erroApi(409, 'Alguém alterou este registro.', 'CONFLITO_EDICAO').corpo, 409);
const indisponivel = (route: Route) => json(route, erroApi(503, 'A Kiwify não está disponível.', 'KIWIFY_INDISPONIVEL').corpo, 503);

export function rotasDaKiwify(estado: EstadoKiwify): RespostasApi {
  const resposta = () => ({ ...estado.config, webhookUrl: estado.comUrl ? estado.config.webhookUrl : null });
  return {
    'GET /financeiro/kiwify': (_p, route) => (estado.indisponivel ? indisponivel(route) : json(route, resposta())),
    'PUT /financeiro/kiwify': (p, route) => {
      const c = p.corpo as KiwifyRequest;
      estado.recebidos.push(c);
      if (estado.indisponivel) return indisponivel(route);
      const atual = estado.config;
      if (atual.configurada ? c.versao !== atual.versao : c.versao != null) return conflito(route);
      if (estado.recusa) {
        const fieldErrors = estado.recusa;
        estado.recusa = null;
        return json(route, erroApi(422, 'Confira a credencial da Kiwify.', 'KIWIFY_INVALIDA', fieldErrors).corpo, 422);
      }
      const faltando = (['tokenDoWebhook', 'clientId', 'clientSecret', 'accountId'] as const).filter((k) => !atual.configurada && !c[k]);
      if (faltando.length) {
        return json(route, erroApi(422, 'Confira a credencial da Kiwify.', 'KIWIFY_INVALIDA', faltando.map((field) => ({ field, message: 'Obrigatório.' }))).corpo, 422);
      }
      estado.config = {
        configurada: true, webhookUrl: URL_DO_WEBHOOK, clientIdFinal: c.clientId ? c.clientId.slice(-4) : atual.clientIdFinal,
        versao: atual.versao == null ? 0 : atual.versao + 1,
      };
      return json(route, resposta());
    },
    'DELETE /financeiro/kiwify': (p, route) => {
      const versao = p.busca.get('versao');
      estado.remocoes.push(versao);
      if (estado.config.configurada && Number(versao) !== estado.config.versao) return conflito(route);
      estado.config = { ...KIWIFY_NAO_CONFIGURADA };
      return route.fulfill({ status: 204 });
    },
  };
}
