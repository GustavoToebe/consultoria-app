import type { EuResponse, Marca, PerfilDaEquipe, UsuarioResumo } from '../api/tipos';

/**
 * Perfil guardado na sessão (e no aparelho, para abrir sem internet): o que o `GET /eu` diz de quem entrou e das chaves
 * da plataforma. As chaves ausentes (perfil antigo ou offline) valem como desligadas, menos `funcionalidadesDoPlano`
 * (ausente = tudo liberado).
 */
export interface PerfilDaSessao {
  perfil?: PerfilDaEquipe;
  permissoes?: string[];
  funcionalidadesDoPlano?: string[];
  pagamentosHabilitados?: boolean;
  recebimentoOnlineHabilitado?: boolean;
  pagarNoIos?: boolean;
  pagarNoAndroid?: boolean;
  cicloHabilitado?: boolean;
  retornoHabilitado?: boolean;
  usuario: UsuarioResumo;
  marca: Marca;
  termosPendentes?: boolean;
}

export function perfilDoEu(eu: EuResponse): PerfilDaSessao {
  return {
    usuario: eu.usuario,
    marca: eu.marca,
    perfil: eu.perfil,
    permissoes: eu.permissoes,
    funcionalidadesDoPlano: eu.funcionalidadesDoPlano,
    pagamentosHabilitados: eu.pagamentosHabilitados,
    recebimentoOnlineHabilitado: eu.recebimentoOnlineHabilitado,
    pagarNoIos: eu.pagarNoIos,
    pagarNoAndroid: eu.pagarNoAndroid,
    cicloHabilitado: eu.cicloHabilitado,
    retornoHabilitado: eu.retornoHabilitado,
    termosPendentes: eu.termosPendentes,
  };
}

const igual = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * O perfil depois de um `/eu` novo, ou nulo se nada mudou (a sessão não troca o estado, então nenhuma tela redesenha nem
 * pisca). Quando algo mudou, as partes iguais mantêm o mesmo objeto (`usuario`, `marca`, `perfil`, listas), para quem
 * depende delas não reagir à toa.
 */
export function perfilAtualizado(atual: PerfilDaSessao, novo: PerfilDaSessao): PerfilDaSessao | null {
  if (igual(atual, novo)) return null;
  const manter = <T,>(a: T, b: T): T => (igual(a, b) ? a : b);
  return {
    ...novo,
    usuario: manter(atual.usuario, novo.usuario),
    marca: manter(atual.marca, novo.marca),
    perfil: manter(atual.perfil, novo.perfil),
    permissoes: manter(atual.permissoes, novo.permissoes),
    funcionalidadesDoPlano: manter(atual.funcionalidadesDoPlano, novo.funcionalidadesDoPlano),
  };
}

/** Intervalo mínimo entre duas buscas automáticas do `/eu` (app de volta à tela ou internet de volta). */
export const INTERVALO_RECARGA_DO_PERFIL_MS = 5 * 60_000;

/**
 * Busca automática do perfil, no máximo uma por {@link INTERVALO_RECARGA_DO_PERFIL_MS} e uma por vez. O prazo conta da
 * última tentativa, com sucesso ou não: falha sem conexão não vira uma busca a cada volta do app. Erro é engolido (o
 * perfil que já estava fica).
 */
export function criarRecargaDoPerfil(recarregar: () => Promise<void>, agora: () => number = Date.now, intervaloMs = INTERVALO_RECARGA_DO_PERFIL_MS) {
  let ultima: number | null = null;
  let emAndamento: Promise<void> | null = null;
  return {
    /** Começa a contar a partir de agora (o perfil acabou de vir do servidor, na abertura da sessão). */
    marcar(): void {
      ultima = agora();
    },
    /** Busca se já passou o intervalo; devolve se buscou. */
    talvez(): Promise<boolean> {
      if (emAndamento) return emAndamento.then(() => false);
      const t = agora();
      if (ultima !== null && t - ultima < intervaloMs) return Promise.resolve(false);
      ultima = t;
      emAndamento = recarregar().catch(() => undefined).finally(() => {
        emAndamento = null;
      });
      return emAndamento.then(() => true);
    },
  };
}
