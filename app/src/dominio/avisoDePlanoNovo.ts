/**
 * Aviso "Seu novo plano está disponível" no topo do Início do aluno (27/11). Sem dado novo da API: o app compara a versão
 * publicada que o aluno vê agora (o `versaoId` do treino no pacote e o `id` da versão da dieta) com a última vista, guardada
 * no aparelho por usuário (`treinos:<usuarioId>:planoVisto`, como as preferências). Comparar a versão (e não a data de
 * publicação) cobre a liberação agendada: a versão nova só chega ao aluno no dia em que é liberada.
 *
 * Versão atual: `string` = a versão em uso; `null` = não há plano daquele tipo; `undefined` = ainda não se sabe (carregando
 * ou sem conexão), e esse tipo não entra na conta nem sobrescreve o que estava gravado.
 */

export type TipoDoPlanoNovo = 'treino' | 'dieta';
export type VersaoAtual = string | null | undefined;
export interface VersoesAtuais { treino: VersaoAtual; dieta: VersaoAtual }
export interface VersoesVistas { treino: string | null; dieta: string | null }

export const chaveDoPlanoVisto = (usuarioId: string) => `treinos:${usuarioId}:planoVisto`;

const TIPOS: readonly TipoDoPlanoNovo[] = ['treino', 'dieta'];
const texto = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/** O que está gravado; `null` = nada gravado ainda (ou gravado num formato que não é este). */
export function lerVersoesVistas(valor: string | null | undefined): VersoesVistas | null {
  if (!valor) return null;
  try {
    const v: unknown = JSON.parse(valor);
    if (!v || typeof v !== 'object') return null;
    const o = v as Record<string, unknown>;
    return { treino: texto(o.treino), dieta: texto(o.dieta) };
  } catch {
    return null;
  }
}

/** Os tipos com versão em uso diferente da vista. Sem nada gravado, nenhum (ver `precisaDaBase`). */
export function planosNovos(atuais: VersoesAtuais, vistas: VersoesVistas | null): TipoDoPlanoNovo[] {
  if (!vistas) return [];
  return TIPOS.filter((t) => typeof atuais[t] === 'string' && atuais[t] !== vistas[t]);
}

/**
 * Primeira leitura neste aparelho, sem nada gravado, com as duas versões já conhecidas: grava as atuais como vistas e não
 * avisa. shortcut: um aparelho novo nunca anuncia o plano que já estava em uso (sem isso, todo aluno veria o aviso ao trocar
 * de aparelho ou limpar o navegador); um aluno que recebe o primeiro plano antes de abrir o app também não o vê. Trocar por
 * uma marca da API ("visto em") se o Gustavo quiser o aviso também no primeiro plano.
 */
export const precisaDaBase = (atuais: VersoesAtuais, vistas: VersoesVistas | null): boolean =>
  vistas === null && atuais.treino !== undefined && atuais.dieta !== undefined;

/** O que gravar ao ver (ou fechar) o aviso: as versões atuais, mantendo o gravado do tipo que ainda não se sabe. */
export function versoesParaGravar(atuais: VersoesAtuais, vistas: VersoesVistas | null): VersoesVistas {
  return {
    treino: atuais.treino === undefined ? vistas?.treino ?? null : atuais.treino,
    dieta: atuais.dieta === undefined ? vistas?.dieta ?? null : atuais.dieta,
  };
}

export const TITULO_DO_PLANO_NOVO = 'Seu novo plano está disponível';

export function textoDoPlanoNovo(novos: readonly TipoDoPlanoNovo[]): string {
  const treino = novos.includes('treino');
  const dieta = novos.includes('dieta');
  if (treino && dieta) return 'Seu treinador publicou um treino e uma dieta novos.';
  return treino ? 'Seu treinador publicou um treino novo.' : 'Seu treinador publicou uma dieta nova.';
}

/** "Ver o plano": o treino, se ele mudou; senão a dieta. */
export const destinoDoPlanoNovo = (novos: readonly TipoDoPlanoNovo[]): '/aluno/treino' | '/aluno/dieta' =>
  (novos.includes('treino') ? '/aluno/treino' : '/aluno/dieta');
