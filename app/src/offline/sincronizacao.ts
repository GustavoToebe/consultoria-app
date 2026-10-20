import { ErroApi } from '../api/cliente';
import type { LoteResponse, RegistroEnvio, RegistroMobilidadeEnvio } from '../api/tipos';
import { paraEnvio, paraEnvioMobilidade, type RepositorioLocal } from './repositorioLocal';

export type ResultadoSincronizacao =
  | { tipo: 'ok'; enviados: number }
  /** Sem rede, servidor fora ou erro 5xx: tudo continua LOCAL para a próxima tentativa. */
  | { tipo: 'semConexao' }
  /** O servidor recusou o lote inteiro (4xx): marca para o aluno ver e tentar de novo. */
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'emAndamento' };

/** Espera entre tentativas depois de falha de rede: 5 s, 15 s, 60 s e depois 5 min. */
export const ESPERAS_MS = [5_000, 15_000, 60_000, 300_000];

const LOTE = 300;

/** Código que a API devolve (403) quando o plano da consultoria não inclui a mobilidade. */
const FORA_DO_PLANO = 'FUNCIONALIDADE_FORA_DO_PLANO';
export const MOTIVO_MOBILIDADE_FORA_DO_PLANO = 'A mobilidade não está no plano da consultoria.';

/**
 * Envia os registros LOCAL em lotes de até 300, os mais antigos primeiro, e aplica a resposta: ACEITO e
 * IGNORADO_ANTIGO viram ENVIADO; RECUSADO vira FALHOU com o motivo. Uma sincronização por vez.
 *
 * A fila é uma só: no mesmo ciclo vão primeiro as séries de treino e depois os itens de mobilidade marcados (cada um
 * na sua rota, com o mesmo formato de resposta). Mobilidade fora do plano (403 `FUNCIONALIDADE_FORA_DO_PLANO`) não
 * derruba o ciclo: os itens viram FALHOU com o motivo, em vez de tentar de novo em laço.
 */
export class Sincronizador {
  private rodando: Promise<ResultadoSincronizacao> | null = null;

  constructor(
    private readonly repositorio: RepositorioLocal,
    private readonly enviar: (registros: RegistroEnvio[]) => Promise<LoteResponse>,
    private readonly enviarMobilidade: (registros: RegistroMobilidadeEnvio[]) => Promise<LoteResponse>,
  ) {}

  sincronizar(): Promise<ResultadoSincronizacao> {
    if (this.rodando) return this.rodando;
    this.rodando = this.executar().finally(() => {
      this.rodando = null;
    });
    return this.rodando;
  }

  private async executar(): Promise<ResultadoSincronizacao> {
    const series = await this.enviarEmLotes(
      (limite) => this.repositorio.pendentes(limite),
      (lote) => this.enviar(lote.map(paraEnvio)),
      (lote, resposta) => this.repositorio.aplicarResultados(lote, resposta.resultados),
    );
    if (series.tipo !== 'ok') return series;
    const mobilidade = await this.enviarEmLotes(
      (limite) => this.repositorio.pendentesMobilidade(limite),
      (lote) => this.enviarMobilidade(lote.map(paraEnvioMobilidade)),
      (lote, resposta) => this.repositorio.aplicarResultadosMobilidade(lote, resposta.resultados),
      () => this.repositorio.recusarPendentesDaMobilidade(MOTIVO_MOBILIDADE_FORA_DO_PLANO),
    );
    if (mobilidade.tipo !== 'ok') return mobilidade;
    return { tipo: 'ok', enviados: series.enviados + mobilidade.enviados };
  }

  /**
   * Cada volta pega os mais antigos; para quando não sobra nada ou nada mais anda (evita laço infinito).
   * `foraDoPlano` (só a mobilidade) trata o 403 da funcionalidade: marca o que ficou e encerra a fila sem erro.
   */
  private async enviarEmLotes<T extends { id: string; alteradoEm: string }>(
    pendentes: (limite: number) => Promise<T[]>,
    enviar: (lote: T[]) => Promise<LoteResponse>,
    aplicar: (lote: T[], resposta: LoteResponse) => Promise<void>,
    foraDoPlano?: () => Promise<void>,
  ): Promise<ResultadoSincronizacao> {
    let enviados = 0;
    for (let volta = 0; volta < 20; volta++) {
      const lote = await pendentes(LOTE);
      if (lote.length === 0) break;
      let resposta: LoteResponse;
      try {
        resposta = await enviar(lote);
      } catch (erro) {
        if (foraDoPlano && erro instanceof ErroApi && erro.status === 403 && erro.codigo === FORA_DO_PLANO) {
          await foraDoPlano();
          break;
        }
        if (erro instanceof ErroApi && (erro.semConexao || erro.status >= 500 || erro.status === 401)) {
          return { tipo: 'semConexao' };
        }
        return { tipo: 'erro', mensagem: erro instanceof Error ? erro.message : 'Não foi possível enviar.' };
      }
      await aplicar(lote, resposta);
      enviados += lote.length;
      if (lote.length < LOTE) break;
    }
    return { tipo: 'ok', enviados };
  }
}
