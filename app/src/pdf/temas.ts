import { MODELOS_PDF, modeloValido, type ModeloPdf } from '../dominio/configuracaoPdf';

/**
 * Temas dos PDFs = os modelos de `dominio/configuracaoPdf.ts` (plano `docs/planos/documentos-pdf-motor.md`, "Nova direção"):
 * lista fechada de seis. O CSS vem só do código (`pdf/html.ts` e `pdf/cssDasOpcoes.ts`); a consultoria escolhe um id e
 * nunca escreve CSS, classe nem cor livre. O nome "tema" fica por compatibilidade com `marca.temaPdf` e a tela.
 */
export type TemaPdf = ModeloPdf;

export const TEMAS_PDF = MODELOS_PDF;

/** Valor desconhecido, nulo ou ausente cai em `CLASSICO` (o que a API manda é conferido contra a lista, nunca confiado). */
export const temaValido = modeloValido;
