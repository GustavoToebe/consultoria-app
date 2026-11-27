import type { ContratoDetalhe, ContratoDoAlunoDetalhe } from '../api/contratos';
import type { ContratoPublicoAssinado } from '../api/contratosPublicos';
import type { Marca } from '../api/tipos';
import { imprimir } from '../pdf/imprimir';
import { logoComoDataUri } from '../pdf/logo';
import { documentoContrato } from '../pdf/pdfContrato';

/**
 * Comprovante do contrato assinado (`docs/planos/contrato-digital-telas.md`), pelo mesmo caminho dos outros PDFs (`imprimir`):
 * bloco de impressão na web, arquivo e compartilhar no celular. Não depende da funcionalidade `PDF` do plano (T1). A marca é a
 * da sessão (a equipe e o aluno a têm; o aluno não pode ler `/consultoria`). O título do arquivo é fixo ("Comprovante do
 * contrato"), sem nome nem dado do aluno. O código de verificação é o que a API devolveu: o app nunca calcula hash.
 */

/** Versão da equipe: leva IP, aparelho e quem gerou. `detalhe` já buscado (`GET /contratos/{id}`) e assinado. */
export async function baixarComprovanteDaEquipe(detalhe: ContratoDetalhe, marca: Marca, alunoNome: string | null): Promise<void> {
  const a = detalhe.assinatura;
  if (!a) return;
  await imprimir(documentoContrato({
    marca, logoDataUri: await logoComoDataUri(marca), titulo: detalhe.titulo, texto: detalhe.texto, sha256: detalhe.sha256, aluno: alunoNome,
    assinadoEm: a.assinadoEm, nome: a.nome, ip: a.ip, agente: a.agente, geradoPorNome: detalhe.geradoPorNome ?? '',
    responsavelLegal: a.declarouResponsavel === true, emitidoEm: new Date(),
  }));
}

/** Versão do aluno: só o nome digitado, a data e o código (nunca IP nem aparelho). */
export async function baixarComprovanteDoAluno(detalhe: ContratoDoAlunoDetalhe, marca: Marca, alunoNome: string | null): Promise<void> {
  const a = detalhe.assinatura;
  if (!a) return;
  await imprimir(documentoContrato({
    marca, logoDataUri: await logoComoDataUri(marca), titulo: detalhe.titulo, texto: detalhe.texto, sha256: detalhe.sha256, aluno: alunoNome,
    assinadoEm: a.assinadoEm, nome: a.nome, emitidoEm: new Date(),
  }));
}

/**
 * Versão do responsável, na página pública: o que a API devolveu ao assinar (nome digitado, data e código) e a declaração de
 * responsável legal. Sem IP, aparelho nem CPF; sem o nome do aluno (a página não o conhece). A marca é a da consulta do link.
 */
export async function baixarComprovanteDoResponsavel(assinado: ContratoPublicoAssinado, marca: Marca): Promise<void> {
  await imprimir(documentoContrato({
    marca, logoDataUri: await logoComoDataUri(marca), titulo: assinado.titulo, texto: assinado.texto, sha256: assinado.sha256, aluno: null,
    assinadoEm: assinado.assinadoEm, nome: assinado.assinanteNome, responsavelLegal: true, emitidoEm: new Date(),
  }));
}
