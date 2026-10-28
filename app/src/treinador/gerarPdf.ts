import { aluno as buscarAluno, consultoria, listarPlanos, pesosDoAluno, versaoPlano } from '../api/rotas';
import type { ConteudoDieta, ConteudoTreino, PlanoResumo, Sessao, TipoPlano } from '../api/tipos';
import { normalizarDieta } from '../dominio/dieta';
import { normalizarTreino } from '../dominio/editorTreino';
import { CONFIGURACAO_PADRAO } from '../dominio/metodologiaPadrao';
import { normalizarMobilidade } from '../dominio/mobilidade';
import type { DivisaoRelatorio } from '../dominio/relatorio';
import { imprimir } from '../pdf/imprimir';
import { logoComoDataUri } from '../pdf/logo';
import { documentoCargas } from '../pdf/pdfCargas';
import { documentoDieta, type DadosPdfDieta } from '../pdf/pdfDieta';
import { documentoMobilidade } from '../pdf/pdfMobilidade';
import { documentoTreino } from '../pdf/pdfTreino';

/**
 * PDF de um plano para o treinador: a versão publicada mais recente (o que o aluno vê). Plano nunca publicado sai
 * do rascunho, marcado como RASCUNHO.
 */
export async function gerarPdfDoPlano(tipo: TipoPlano, plano: PlanoResumo, rascunho?: unknown, lista?: DadosPdfDieta['lista']): Promise<void> {
  const publicado = plano.versaoPublicada > 0;
  // Tudo sai junto; a logo só espera a consultoria (de onde vem o `logoUrl`).
  const [{ c, logoDataUri }, a, versao, pesos] = await Promise.all([
    consultoria().then(async (c) => ({ c, logoDataUri: await logoComoDataUri(c.marca) })),
    buscarAluno(plano.alunoId),
    publicado ? versaoPlano<unknown>(tipo, plano.id, plano.versaoPublicada) : Promise.resolve(null),
    tipo === 'dieta' ? pesosDoAluno(plano.alunoId).catch(() => []) : Promise.resolve([]),
  ]);
  const conteudo = versao ? versao.conteudo : rascunho;
  const comum = {
    marca: c.marca,
    logoDataUri,
    aluno: a.nome,
    titulo: versao?.titulo ?? plano.titulo,
    versao: versao?.numero ?? null,
    rodapePdf: null,
    emitidoEm: new Date(),
  };
  if (tipo === 'treino') {
    await imprimir(
      documentoTreino({
        ...comum,
        inicio: versao?.inicio ?? plano.inicio,
        fim: versao?.fim ?? plano.fim,
        conteudo: normalizarTreino(conteudo) as ConteudoTreino,
        instrucoesTreino: CONFIGURACAO_PADRAO.instrucoesTreino,
      }),
    );
  } else if (tipo === 'mobilidade') {
    await imprimir(documentoMobilidade({ ...comum, conteudo: normalizarMobilidade(conteudo) }));
  } else {
    await imprimir(documentoDieta({ ...comum, conteudo: normalizarDieta(conteudo) as ConteudoDieta, pesos, lista }));
  }
}

/** Treinos publicados do aluno com as sessões de cada um (para filtrar o relatório por plano). */
export async function treinosDoAluno(alunoId: string): Promise<{ plano: PlanoResumo; sessoes: Sessao[] }[]> {
  const planos = (await listarPlanos('treino', alunoId)).filter((p) => p.versaoPublicada > 0);
  const versoes = await Promise.all(planos.map((p) => versaoPlano<unknown>('treino', p.id, p.versaoPublicada).catch(() => null)));
  return planos.map((plano, i) => ({ plano, sessoes: versoes[i] ? normalizarTreino(versoes[i].conteudo).sessoes : [] }));
}

/** Sessões dos treinos publicados do aluno (por uid), para o relatório mostrar "Quarta - Pernas" e a ordem da semana. */
export function sessoesPorUid(treinos: { sessoes: Sessao[] }[]): Map<string, Sessao> {
  const mapa = new Map<string, Sessao>();
  for (const t of treinos) for (const s of t.sessoes) mapa.set(s.uid, s);
  return mapa;
}

/** PDF das cargas do aluno no período (treinador), agrupadas por divisão. */
export async function gerarPdfDeCargas(aluno: { id: string; nome: string }, de: string, ate: string, divisoes: DivisaoRelatorio[]) {
  const c = await consultoria();
  await imprimir(
    documentoCargas({
      marca: c.marca,
      logoDataUri: await logoComoDataUri(c.marca),
      aluno: aluno.nome,
      de,
      ate,
      divisoes,
      rodapePdf: null,
      emitidoEm: new Date(),
    }),
  );
}
