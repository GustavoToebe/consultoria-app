import type { Configuracao, Intensidade, Tecnica, TipoDeSerie } from '../api/tipos';
import { blocosValidos } from './blocos';
import { TIPOS_DE_TECNICA } from './metodologia';
import { chaveDeTipo, mensagemTipoETecnica, nomeDeTecnica } from './tiposDeSerie';

type FaixaEmEdicao = { min: number | null; max: number | null };
export type TipoEmEdicao = Omit<TipoDeSerie, 'repeticoes' | 'regraPercentuais'> & {
  repeticoes: FaixaEmEdicao | null;
  regraPercentuais: Record<string, FaixaEmEdicao[]> | null;
};
export type MetodologiaEmEdicao = Omit<Configuracao, 'tipos'> & { tipos: TipoEmEdicao[] };

const dentro = (v: number | null | undefined, min: number, max: number, inteiro = true) =>
  v != null && Number.isFinite(v) && v >= min && v <= max && (!inteiro || Number.isInteger(v));

/** Valores de intensidade, iguais aos limites da API. RIR vale em qualquer modo. */
export function problemaDaIntensidade(i: Intensidade | null): string | null {
  if (!i) return null;
  if (i.rir != null && !dentro(i.rir, 0, 5)) return 'RIR: de 0 a 5; 0 significa até a falha.';
  if (i.modo === 'PERCENTUAL_WS' || i.modo === 'ACIMA_DA_ANTERIOR') {
    const limite = i.modo === 'PERCENTUAL_WS' ? 200 : 100;
    if (!dentro(i.percentualMin, 1, limite, false) || (i.percentualMax != null && (!dentro(i.percentualMax, i.percentualMin!, limite, false)))) return `Percentual: preencha o mínimo de 1 a ${limite} e o máximo maior ou igual ao mínimo.`;
  }
  if (i.modo === 'RPE' && (!dentro(i.rpe, 1, 10, false) || !Number.isInteger(i.rpe! * 2))) return 'RPE: de 1 a 10, de meio em meio.';
  return null;
}

/** O padrão da metodologia pode ser parcial; a série pronta precisa da pausa e dos blocos/pausas/quedas. */
export function problemaDaTecnica(t: Tecnica | null, parcial = false): string | null {
  if (!t) return null;
  if (t.tipo !== 'DROP_SET') {
    if (t.pausaSegundos != null && !dentro(t.pausaSegundos, 5, 600)) return 'Pausa: de 5 a 600 segundos.';
    if (t.pausaRespiracoes != null && !dentro(t.pausaRespiracoes, 1, 30)) return 'Pausa: de 1 a 30 respirações.';
    if (!parcial && t.pausaSegundos == null && t.pausaRespiracoes == null) return 'Informe uma pausa em segundos ou respirações.';
  }
  if (t.tipo === 'CLUSTER' && ((!parcial || t.blocos != null) && !blocosValidos(t.blocos))) return 'Cluster: de 2 a 10 blocos, cada um com 1 a 50 repetições.';
  if (t.tipo === 'REST_PAUSE' && ((!parcial || t.pausas != null) && !dentro(t.pausas, 1, 5))) return 'Rest pause: de 1 a 5 pausas.';
  if (t.tipo === 'DROP_SET') {
    if ((!parcial || t.quedas != null) && !dentro(t.quedas, 1, 5)) return 'Drop-set: de 1 a 5 quedas.';
    if (t.reducaoPercentual != null && !dentro(t.reducaoPercentual, 5, 50)) return 'Redução: de 5 a 50%.';
    if (t.repsPorQueda != null && !dentro(t.repsPorQueda, 1, 50)) return 'Repetições por queda: de 1 a 50.';
  }
  return null;
}

export function problemaDaMetodologia(c: MetodologiaEmEdicao): string | null {
  if (!c.tipos.length || c.tipos.length > 20) return 'Informe de 1 a 20 tipos de série.';
  const nomes = new Set<string>();
  const tecnicas = new Set(c.tecnicas.map((t) => chaveDeTipo(t.nome)));
  for (const t of c.tipos) {
    const nome = t.nome.trim();
    const chave = chaveDeTipo(nome);
    if (!nome || t.nome.length > 30 || nomes.has(chave)) return 'Tipos de série: preencha nomes únicos de até 30 letras (sem repetir caixa, acento ou hífen).';
    nomes.add(chave);
    if (nomeDeTecnica(nome) || tecnicas.has(chave)) return mensagemTipoETecnica(nome);
    const r = t.repeticoes;
    if (r && (r.min != null || r.max != null) && (!dentro(r.min, 0, 500) || !dentro(r.max, r.min!, 500))) return `Confira as repetições de ${nome}: mínima e máxima de 0 a 500.`;
    const problema = problemaDaIntensidade(t.intensidadePadrao);
    if (problema) return `${nome}: ${problema}`;
    for (const [modalidade, i] of Object.entries(t.intensidadePorModalidade ?? {})) {
      if (!['LIVRE', 'MAQUINA'].includes(modalidade) || i == null) return 'Intensidade por modalidade: só peso livre e máquina.';
      const p = problemaDaIntensidade(i);
      if (p) return `${nome}: ${p}`;
    }
    const regras = Object.entries(t.regraPercentuais ?? {});
    if (regras.length && t.papel !== 'PREPARACAO') return 'Regra de percentuais só em tipo de preparação.';
    for (const [n, faixas] of regras) {
      if (!/^(10|[1-9])$/.test(n) || faixas.length !== Number(n) || faixas.some((f) => !dentro(f.min, 1, 200) || (f.max != null && !dentro(f.max, f.min!, 200)))) return `Preencha todas as faixas da regra de ${nome}: de 1 a 200%, com máximo maior ou igual ao mínimo.`;
    }
    if ((t.explicacao?.length ?? 0) > 500) return 'Explicação com no máximo 500 caracteres.';
  }
  if (!c.tipos.some((t) => t.papel === 'TRABALHO')) return 'A metodologia precisa de pelo menos um tipo de trabalho.';
  if (c.tecnicas.length !== 3 || TIPOS_DE_TECNICA.some((tipo) => c.tecnicas.filter((t) => t.tipo === tipo).length !== 1)) return 'Informe as três técnicas, uma de cada, sem repetir.';
  for (const t of c.tecnicas) {
    if (!t.nome.trim() || t.nome.length > 30) return 'Nome da técnica: de 1 a 30 letras.';
    if ((t.explicacao?.length ?? 0) > 500) return 'Explicação com no máximo 500 caracteres.';
    if (t.padrao && t.padrao.tipo !== t.tipo) return 'O padrão precisa ser da própria técnica.';
    const problema = problemaDaTecnica(t.padrao, true);
    if (problema) return problema;
  }
  if (![0.25, 0.5, 1, 2.5].includes(c.arredondamentoKg)) return 'Escolha o arredondamento da carga.';
  if ((c.instrucoesTreino?.length ?? 0) > 20000 || (c.rodapePdf?.length ?? 0) > 500) return 'Confira o limite das instruções e do rodapé.';
  return null;
}

/** Só o formato atual: tira faixas vazias e espaços nas pontas, sem converter dados antigos. */
export function metodologiaParaSalvar(c: MetodologiaEmEdicao): Configuracao {
  return {
    ...c,
    tipos: c.tipos.map((t) => ({ ...t, nome: t.nome.trim(), repeticoes: t.repeticoes?.min != null && t.repeticoes.max != null ? { min: t.repeticoes.min, max: t.repeticoes.max } : null,
      regraPercentuais: t.regraPercentuais as TipoDeSerie['regraPercentuais'], explicacao: t.explicacao?.trim() || null })),
    tecnicas: c.tecnicas.map((t) => ({ ...t, nome: t.nome.trim(), explicacao: t.explicacao?.trim() || null })),
  };
}
