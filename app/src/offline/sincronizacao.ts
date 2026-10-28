import { ErroApi } from '../api/cliente';
import type { LoteResponse, RegistroEnvio, RegistroMobilidadeEnvio, RegistroSessaoConcluidaEnvio } from '../api/tipos';
import { paraEnvio, paraEnvioMobilidade, paraEnvioSessaoConcluida, type RepositorioLocal } from './repositorioLocal';

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
/** O que o aluno lê: neutro, sem falar de plano nem de código de erro. */
export const MOTIVO_MOBILIDADE_FORA_DO_PLANO = 'Não foi possível enviar esta marcação agora. Fale com o seu treinador.';

/** Código que a API devolve (503) quando "Concluir treino" está desligado na plataforma. */
const RETORNO_INDISPONIVEL = 'RETORNO_INDISPONIVEL';
/** O que o aluno lê: neutro, sem falar de chave, plano nem código de erro. */
export const MOTIVO_CONCLUSAO_INDISPONIVEL = 'Não foi possível enviar esta conclusão agora. Fale com o seu treinador.';

/**
 * Envia os registros LOCAL em lotes de até 300, os mais antigos primeiro, e aplica a resposta: ACEITO e
 * IGNORADO_ANTIGO viram ENVIADO; RECUSADO vira FALHOU com o motivo. Uma sincronização por vez.
 *
 * A fila é uma só: no mesmo ciclo vão primeiro as séries de treino, depois os itens de mobilidade marcados e por
 * último os treinos concluídos (cada um na sua rota, com o mesmo formato de resposta). Mobilidade fora do plano (403
 * `FUNCIONALIDADE_FORA_DO_PLANO`) e conclusão com o recurso desligado (503 `RETORNO_INDISPONIVEL`) não derrubam o
 * ciclo: os itens viram FALHOU com o motivo, em vez de tentar de novo em laço. Esses dois códigos nunca encerram a sessão.
 */
export class Sincronizador {
  private rodando: Promise<ResultadoSincronizacao> | null = null;

  constructor(
    private readonly repositorio: RepositorioLocal,
    private readonly enviar: (registros: RegistroEnvio[]) => Promise<LoteResponse>,
    private readonly enviarMobilidade: (registros: RegistroMobilidadeEnvio[]) => Promise<LoteResponse>,
    /** Sem ela as conclusões ficam na fila (os testes das séries e da mobilidade não a usam). */
    private readonly enviarConclusoes?: (registros: RegistroSessaoConcluidaEnvio[]) => Promise<LoteResponse>,
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
      (erro) =>
        erro.status === 403 && erro.codigo === FORA_DO_PLANO
          ? this.repositorio.recusarPendentesDaMobilidade(MOTIVO_MOBILIDADE_FORA_DO_PLANO).then(() => true)
          : Promise.resolve(false),
    );
    if (mobilidade.tipo !== 'ok') return mobilidade;
    const enviarConclusoes = this.enviarConclusoes;
    let conclusoes: ResultadoSincronizacao = { tipo: 'ok', enviados: 0 };
    if (enviarConclusoes) {
      conclusoes = await this.enviarEmLotes(
        (limite) => this.repositorio.pendentesSessoesConcluidas(limite),
        (lote) => enviarConclusoes(lote.map(paraEnvioSessaoConcluida)),
        (lote, resposta) => this.repositorio.aplicarResultadosSessoesConcluidas(lote, resposta.resultados),
        // Antes do "5xx = sem conexão": este 503 é uma resposta de verdade (recurso desligado), não falta de rede.
        (erro) =>
          erro.status === 503 && erro.codigo === RETORNO_INDISPONIVEL
            ? this.repositorio.recusarPendentesDasSessoesConcluidas(MOTIVO_CONCLUSAO_INDISPONIVEL).then(() => true)
            : Promise.resolve(false),
      );
      if (conclusoes.tipo !== 'ok') return conclusoes;
    }
    return { tipo: 'ok', enviados: series.enviados + mobilidade.enviados + conclusoes.enviados };
  }

  /**
   * Cada volta pega os mais antigos; para quando não sobra nada ou nada mais anda (evita laço infinito).
   * `tratarRecusa` (mobilidade e conclusões) trata a resposta que desliga o recurso: devolve `true` depois de marcar o
   * que ficou, e a fila daquele depósito encerra sem erro.
   */
  private async enviarEmLotes<T extends { id: string; alteradoEm: string }>(
    pendentes: (limite: number) => Promise<T[]>,
    enviar: (lote: T[]) => Promise<LoteResponse>,
    aplicar: (lote: T[], resposta: LoteResponse) => Promise<void>,
    tratarRecusa?: (erro: ErroApi) => Promise<boolean>,
  ): Promise<ResultadoSincronizacao> {
    let enviados = 0;
    for (let volta = 0; volta < 20; volta++) {
      const lote = await pendentes(LOTE);
      if (lote.length === 0) break;
      let resposta: LoteResponse;
      try {
        resposta = await enviar(lote);
      } catch (erro) {
        if (tratarRecusa && erro instanceof ErroApi && (await tratarRecusa(erro))) break;
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
