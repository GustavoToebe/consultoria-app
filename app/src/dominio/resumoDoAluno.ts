import { dataRelativa } from './datasRelativas';

/** Quantos dias antes do fim a pasta já pede renovação (o ciclo seguinte precisa estar pronto antes). */
export const DIAS_PARA_RENOVAR = 7;

interface PastaDoResumo {
  id: string;
  titulo: string;
  inicio: string | null;
  fim: string | null;
  concluidaEm: string | null;
}

const diasEntre = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / 86_400_000);

/**
 * A pasta pede "Renovar" quando está aberta, termina em até 7 dias (ou já terminou) e ainda não existe a pasta do ciclo
 * seguinte (outra que começa depois do fim desta). Sem fim, nunca: não há ciclo para emendar.
 */
export function precisaRenovar(pasta: PastaDoResumo, todas: readonly PastaDoResumo[], hoje: string): boolean {
  if (pasta.concluidaEm || !pasta.fim) return false;
  if (diasEntre(hoje, pasta.fim) > DIAS_PARA_RENOVAR) return false;
  const fim = pasta.fim;
  return !todas.some((p) => p.id !== pasta.id && !!p.inicio && p.inicio > fim);
}

export type AcaoDoResumo = 'revisar' | 'renovar' | null;

export interface ProximoPasso {
  texto: string;
  acao: AcaoDoResumo;
  /** `atencao` quando há algo a fazer; `neutro` quando está tudo em dia ou o aluno saiu. */
  tipo: 'atencao' | 'perigo' | 'neutro';
}

/**
 * O que a ficha sugere primeiro, numa frase, na ordem do dia a dia do treinador: revisar a atualização enviada, falar
 * com quem atrasou, renovar a pasta que acaba, criar a primeira pasta, convidar quem ainda não entra no app. Só
 * informação: nada é feito sozinho.
 */
export function proximoPassoDoAluno(entrada: {
  aluno: { ativo: boolean; anonimizado: boolean; temAcesso: boolean };
  /** Fase da atualização vigente; nula sem permissão ou sem atualização. */
  atualizacao: { fase: string; diasDeAtraso: number } | null;
  /** Pasta vigente; `undefined` = ainda carregando (não sugere criar). */
  pasta: PastaDoResumo | null | undefined;
  pastas: readonly PastaDoResumo[];
  hoje: string;
}): ProximoPasso {
  const { aluno, atualizacao, pasta, pastas, hoje } = entrada;
  if (aluno.anonimizado) return { texto: 'Aluno anonimizado: ficam só as contagens de treino.', acao: null, tipo: 'neutro' };
  if (!aluno.ativo) return { texto: 'Aluno inativo. Para voltar a acompanhar, reative pelo menu ⋯.', acao: null, tipo: 'neutro' };
  if (atualizacao?.fase === 'ENVIADA') return { texto: 'A atualização chegou. Revise as respostas e mande o feedback.', acao: 'revisar', tipo: 'atencao' };
  if (atualizacao?.fase === 'ATRASADA') {
    const d = atualizacao.diasDeAtraso;
    return { texto: `A atualização está atrasada há ${d} ${d === 1 ? 'dia' : 'dias'}. Vale falar com o aluno.`, acao: null, tipo: 'perigo' };
  }
  if (pasta && precisaRenovar(pasta, pastas, hoje)) {
    const quando = pasta.fim && pasta.fim < hoje ? `terminou ${dataRelativa(pasta.fim, hoje)}` : `termina ${dataRelativa(pasta.fim, hoje)}`;
    return { texto: `A pasta ${pasta.titulo} ${quando}. Renove para o próximo ciclo.`, acao: 'renovar', tipo: 'atencao' };
  }
  if (pasta === null && pastas.length === 0) return { texto: 'Sem pasta ainda. Crie a primeira com o treino e a dieta.', acao: null, tipo: 'atencao' };
  if (!aluno.temAcesso) return { texto: 'O aluno ainda não entra no app. Envie o convite em Acesso ao app.', acao: null, tipo: 'atencao' };
  return { texto: 'Tudo em dia.', acao: null, tipo: 'neutro' };
}
