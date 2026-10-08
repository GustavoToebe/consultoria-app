import { aluno as buscarAluno, consultoria, pesosDoAluno, versaoPlano } from '../api/rotas';
import type { ConteudoDieta, ConteudoTreino, PlanoResumo, TipoPlano } from '../api/tipos';
import { normalizarDieta } from '../dominio/dieta';
import { normalizarTreino } from '../dominio/editorTreino';
import { imprimir } from '../pdf/imprimir';
import { logoComoDataUri } from '../pdf/logo';
import { documentoDieta } from '../pdf/pdfDieta';
import { documentoTreino } from '../pdf/pdfTreino';

/**
 * PDF de um plano para o treinador: a versão publicada mais recente (o que o aluno vê). Plano nunca publicado sai
 * do rascunho, marcado como RASCUNHO.
 */
export async function gerarPdfDoPlano(tipo: TipoPlano, plano: PlanoResumo, rascunho?: unknown): Promise<void> {
  const [c, a] = await Promise.all([consultoria(), buscarAluno(plano.alunoId)]);
  const publicado = plano.versaoPublicada > 0;
  const versao = publicado ? await versaoPlano<unknown>(tipo, plano.id, plano.versaoPublicada) : null;
  const conteudo = versao ? versao.conteudo : rascunho;
  const comum = {
    marca: c.marca,
    logoDataUri: await logoComoDataUri(c.marca),
    aluno: a.nome,
    titulo: versao?.titulo ?? plano.titulo,
    versao: versao?.numero ?? null,
    rodapePdf: c.configuracao.rodapePdf,
    emitidoEm: new Date(),
  };
  if (tipo === 'treino') {
    await imprimir(
      documentoTreino({
        ...comum,
        inicio: versao?.inicio ?? plano.inicio,
        fim: versao?.fim ?? plano.fim,
        conteudo: normalizarTreino(conteudo) as ConteudoTreino,
        tipoTrabalho: c.configuracao.tipoTrabalho,
        instrucoesTreino: c.configuracao.instrucoesTreino,
      }),
    );
  } else {
    const pesos = await pesosDoAluno(plano.alunoId).catch(() => []);
    await imprimir(documentoDieta({ ...comum, conteudo: normalizarDieta(conteudo) as ConteudoDieta, pesos }));
  }
}
