import { atrasoEmTexto } from './atualizacao';
import { comMaiuscula, dataRelativa } from './datasRelativas';
import { dataCurta } from './formatos';

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

/** `acesso` leva à aba Ficha do aluno, no bloco Acesso ao app: é atalho, nunca gera nem envia o convite. */
export type AcaoDoResumo = 'revisar' | 'renovar' | 'acesso' | null;

/**
 * Como chegou cada fonte que o próximo passo consulta: `carregando` (primeira busca), `erro` (falhou e não há dado) ou
 * `sem-permissao` (o perfil não vê; só a atualização tem esse caso, as pastas abrem com a ficha).
 */
export type SituacaoDaFonte = 'ok' | 'carregando' | 'erro' | 'sem-permissao';

export interface ProximoPasso {
  texto: string;
  acao: AcaoDoResumo;
  /** `atencao` quando há algo a fazer; `neutro` quando está tudo em dia, ainda carrega ou o aluno saiu. */
  tipo: 'atencao' | 'perigo' | 'neutro';
  /** Ainda falta uma fonte de que o passo depende: a tela mostra o carregamento, não uma conclusão. */
  carregando?: boolean;
}

const CARREGANDO: ProximoPasso = { texto: 'Conferindo a situação do aluno…', acao: null, tipo: 'neutro', carregando: true };

/**
 * O que a ficha sugere primeiro, numa frase, na ordem do dia a dia do treinador: revisar a atualização enviada, falar
 * com quem atrasou, renovar a pasta que acaba, criar a primeira pasta, convidar quem ainda não entra no app. Só
 * informação: nada é feito sozinho. A ordem não muda com as fontes (guia de 11/11, pág. 32): se a fonte de um passo ainda
 * carrega, o resultado é "conferindo", para um passo de baixo não aparecer e ser trocado em seguida; fonte que falhou é
 * pulada, e no fim, em vez de "Tudo em dia", o texto diz o que não deu para conferir.
 */
export function proximoPassoDoAluno(entrada: {
  aluno: { ativo: boolean; anonimizado: boolean; temAcesso: boolean };
  /** Fase da atualização vigente; nula sem atualização (ou sem a fonte: ver `fontes`). */
  atualizacao: { fase: string; diasDeAtraso: number } | null;
  /** Pasta vigente; nula = nenhuma (ou sem a fonte: ver `fontes`). */
  pasta: PastaDoResumo | null;
  pastas: readonly PastaDoResumo[];
  hoje: string;
  fontes: { atualizacao: SituacaoDaFonte; pastas: Exclude<SituacaoDaFonte, 'sem-permissao'> };
}): ProximoPasso {
  const { aluno, atualizacao, pasta, pastas, hoje, fontes } = entrada;
  if (aluno.anonimizado) return { texto: 'Aluno anonimizado: ficam só as contagens de treino.', acao: null, tipo: 'neutro' };
  if (!aluno.ativo) return { texto: 'Aluno inativo. Para voltar a acompanhar, reative pelo menu ⋯.', acao: null, tipo: 'neutro' };
  if (fontes.atualizacao === 'carregando') return CARREGANDO;
  if (fontes.atualizacao === 'ok' && atualizacao?.fase === 'ENVIADA') {
    return { texto: 'A atualização chegou. Revise as respostas e mande o feedback.', acao: 'revisar', tipo: 'atencao' };
  }
  if (fontes.atualizacao === 'ok' && atualizacao?.fase === 'ATRASADA') {
    return { texto: `A atualização está atrasada ${atrasoEmTexto(atualizacao.diasDeAtraso, hoje)}. Vale falar com o aluno.`, acao: null, tipo: 'perigo' };
  }
  if (fontes.pastas === 'carregando') return CARREGANDO;
  if (fontes.pastas === 'ok' && pasta && precisaRenovar(pasta, pastas, hoje)) {
    const quando = pasta.fim && pasta.fim < hoje ? `terminou ${dataRelativa(pasta.fim, hoje)}` : `termina ${dataRelativa(pasta.fim, hoje)}`;
    return { texto: `A pasta ${pasta.titulo} ${quando}. Renove para o próximo ciclo.`, acao: 'renovar', tipo: 'atencao' };
  }
  if (fontes.pastas === 'ok' && pasta === null && pastas.length === 0) {
    return { texto: 'Sem pasta ainda. Crie a primeira com o treino e a dieta.', acao: null, tipo: 'atencao' };
  }
  if (!aluno.temAcesso) return { texto: 'O aluno ainda não entra no app. Abra o acesso e escolha como convidar.', acao: 'acesso', tipo: 'atencao' };
  const falhas = [fontes.atualizacao === 'erro' ? 'a atualização' : null, fontes.pastas === 'erro' ? 'as pastas' : null].filter(Boolean);
  if (falhas.length) return { texto: `Não foi possível conferir ${falhas.join(' e ')}. O resto não pede ação agora.`, acao: null, tipo: 'neutro' };
  // Sem ver as atualizações, "Tudo em dia" afirmaria o que este perfil não enxerga.
  if (fontes.atualizacao === 'sem-permissao') return { texto: 'Nada pendente no que o seu perfil mostra.', acao: null, tipo: 'neutro' };
  return { texto: 'Tudo em dia.', acao: null, tipo: 'neutro' };
}

/** Atalho do Planejamento no Resumo: abre a pasta (uma) ou a aba Planos (várias). Nunca publica nem renova. */
export type AtalhoDoPlanejamento = { rotulo: string; pastaId: string } | { rotulo: string; aba: 'planos' };

export interface PlanejamentoDoResumo {
  /** "Pasta vigente", "Nenhuma pasta vigente" ou "Nenhuma pasta ainda". */
  titulo: string;
  /** A pasta vigente, quando há (a tela mostra o título, o período e se venceu). */
  vigente: PastaDoResumo | null;
  /** O que existe sem pasta vigente: "1 pasta em rascunho · Sem período definido", "3 pastas abertas". */
  linha: string | null;
  atalho: AtalhoDoPlanejamento | null;
}

/**
 * O bloco Planejamento do Resumo (guia de 11/11, págs. 30 e 31): sem pasta vigente não quer dizer sem planejamento. A
 * pasta aberta (não finalizada) aparece com o que se sabe dela. `rascunhos` traz os ids das pastas que a tela sabe, pelas
 * listas de planos, que só têm rascunho (`pastaSoComRascunho`): só essas dizem "em rascunho"; sem essa certeza o texto é
 * "aberta" (a pasta sem fim e com plano publicado também fica fora da vigente, `PastaVigente`). Várias: a contagem e a
 * aba Planos, sem escolher uma por conta própria.
 */
export function planejamentoDoResumo(pasta: PastaDoResumo | null, pastas: readonly PastaDoResumo[], rascunhos: ReadonlySet<string> = new Set()): PlanejamentoDoResumo {
  if (pasta) return { titulo: 'Pasta vigente', vigente: pasta, linha: null, atalho: { rotulo: 'Abrir pasta', pastaId: pasta.id } };
  const abertas = pastas.filter((p) => !p.concluidaEm);
  const emRascunho = abertas.filter((p) => rascunhos.has(p.id)).length;
  if (abertas.length === 1) {
    const [unica] = abertas;
    const periodo = !unica.inicio || !unica.fim ? ' · Sem período definido' : '';
    return emRascunho
      ? { titulo: 'Nenhuma pasta vigente', vigente: null, linha: `1 pasta em rascunho${periodo}`, atalho: { rotulo: 'Abrir rascunho', pastaId: unica.id } }
      : { titulo: 'Nenhuma pasta vigente', vigente: null, linha: `1 pasta aberta${periodo}`, atalho: { rotulo: 'Abrir pasta', pastaId: unica.id } };
  }
  if (abertas.length > 1) {
    const n = abertas.length;
    if (emRascunho === n) return { titulo: 'Nenhuma pasta vigente', vigente: null, linha: `${n} pastas em rascunho`, atalho: { rotulo: 'Ver rascunhos', aba: 'planos' } };
    const linha = emRascunho ? `${n} pastas abertas · ${emRascunho} em rascunho` : `${n} pastas abertas`;
    return { titulo: 'Nenhuma pasta vigente', vigente: null, linha, atalho: { rotulo: `Ver as ${n} pastas`, aba: 'planos' } };
  }
  if (pastas.length > 0) {
    const n = pastas.length;
    return { titulo: 'Nenhuma pasta vigente', vigente: null, linha: n === 1 ? '1 pasta finalizada' : `${n} pastas finalizadas`, atalho: { rotulo: 'Ver pastas', aba: 'planos' } };
  }
  return { titulo: 'Nenhuma pasta ainda', vigente: null, linha: null, atalho: null };
}

/**
 * Treinos no Resumo, com o período explícito (guia de 11/11, pág. 32): a contagem é da semana corrente e o último
 * registro vale para o que a frequência consulta (a semana e, com pasta vigente contável, desde o início dela). Sem
 * nenhum registro nesse período, os dois viram uma linha de apoio só.
 */
export function treinosDoResumo(f: { semana: number; ultimo: string | null; pasta: { de: string } | null }, inicioDaSemana: string, hoje: string):
  { apoio: string } | { contagem: string; ultimo: string } {
  const desde = f.pasta && f.pasta.de < inicioDaSemana ? f.pasta.de : null;
  const escopo = desde ? `desde ${dataCurta(desde)}` : 'nesta semana';
  if (!f.ultimo) return { apoio: `Treinos: ainda sem registros ${escopo}.` };
  return {
    contagem: f.semana === 0 ? 'Nenhum nesta semana' : `${f.semana} nesta semana`,
    ultimo: `${comMaiuscula(dataRelativa(f.ultimo, hoje))} · ${escopo}`,
  };
}
