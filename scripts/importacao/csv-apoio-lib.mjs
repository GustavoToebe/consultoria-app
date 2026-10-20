/**
 * Apoio comum dos CSV de conferência que o conversor de planos grava para o treinador preencher no Excel
 * (`correspondencias-exercicios.csv`, `classificacao-suplementos.csv`): escrita (UTF-8 com BOM, `;`, apóstrofo contra
 * fórmula) e leitura (BOM, CRLF e windows-1252 quando o Excel salva como "CSV" comum). Nada aqui lê ou grava arquivo.
 */

/** Campo CSV com `;`. Texto que começaria uma fórmula no Excel (`=`, `+`, `-`, `@`) ganha um apóstrofo, tirado na leitura. */
export const campoCsv = (v) => {
  let t = String(v ?? '').replace(/[\r\n]+/g, ' ');
  if (/^[=+\-@\t]/.test(t)) t = `'${t}`;
  return /[;"]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** O arquivo, em UTF-8 com BOM (o Excel reconhece os acentos) e `;`. `corpo` = linhas já em lista de valores. */
export const textoDeCsv = (cabecalho, corpo) => `﻿${[cabecalho, ...corpo].map((l) => l.map(campoCsv).join(';')).join('\n')}\n`;

/** Desfaz o apóstrofo que {@link campoCsv} põe antes de `=`, `+`, `-` e `@`. */
export const semApostrofoDeFormula = (v) => v.replace(/^'(?=[=+\-@])/, '');

/**
 * Texto de um CSV: UTF-8 estrito e, se os bytes não forem UTF-8 válido, windows-1252 (o "CSV" comum do Excel salva assim,
 * e sem isso os nomes com acento deixariam de casar).
 */
export function decodificarCsv(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}
