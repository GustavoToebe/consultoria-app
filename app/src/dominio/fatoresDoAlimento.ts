/**
 * Fator de correção (FC = peso bruto ÷ peso líquido) e fator de cocção (FCc = peso pronto ÷ peso cru).
 * A lista de compras faz o caminho inverso: peso cru limpo = peso da dieta ÷ FCc; compra = cru limpo × FC.
 * Espelho de `biblioteca/FatoresDeRendimento`. Faixas iguais às do servidor e ao CHECK da V011.
 */

export const FC_MINIMO = 1;
export const FC_MAXIMO = 20;
export const FCC_MINIMO = 0.1;
export const FCC_MAXIMO = 10;

export const AJUDA_FC = 'Peso bruto ÷ peso limpo. O chip sugere pelo nome; você pode trocar o número.';
export const AJUDA_FCC = 'Peso pronto ÷ peso cru. Acima de 1 o alimento hidrata; abaixo de 1, encolhe.';

export const NOTA_DA_ESTIMATIVA = 'Apenas um cálculo estimado: as quantidades convertem automaticamente o peso da dieta para peso aproximado de compra no mercado (considerando descarte de limpeza/casca e absorção ou perda de água no preparo).';

export type CodigoFc = 'SEM_PERDA' | 'LIMPEZA_LEVE' | 'DESCASCADO_MEDIO' | 'DESCASCADO_ALTO';
export type CodigoFcc =
  | 'CRU_OU_PRONTO'
  | 'GRAO_COZIDO'
  | 'MASSA_COZIDA'
  | 'LEGUMINOSA_COZIDA'
  | 'CARNE_GRELHADA_ASSADA'
  | 'CARNE_COZIDA_ENSOPADA'
  | 'LEGUME_TUBERCULO_COZIDO'
  | 'LEGUME_TUBERCULO_ASSADO_REFOGADO'
  | 'OVO_PREPARADO';

export interface PerfilDeFator<T extends string> {
  codigo: T;
  rotulo: string;
  valor: number;
}

export const PERFIS_FC: readonly PerfilDeFator<CodigoFc>[] = [
  { codigo: 'SEM_PERDA', rotulo: 'Sem perda (1,00)', valor: 1 },
  { codigo: 'LIMPEZA_LEVE', rotulo: 'Limpeza leve (1,12)', valor: 1.12 },
  { codigo: 'DESCASCADO_MEDIO', rotulo: 'Casca/talos médios (1,25)', valor: 1.25 },
  { codigo: 'DESCASCADO_ALTO', rotulo: 'Casca grossa/osso (1,45)', valor: 1.45 },
];

export const PERFIS_FCC: readonly PerfilDeFator<CodigoFcc>[] = [
  { codigo: 'CRU_OU_PRONTO', rotulo: 'Cru / Pronto (1,00)', valor: 1 },
  { codigo: 'GRAO_COZIDO', rotulo: 'Arroz/grão cozido (2,60)', valor: 2.6 },
  { codigo: 'MASSA_COZIDA', rotulo: 'Massa cozida (2,50)', valor: 2.5 },
  { codigo: 'LEGUMINOSA_COZIDA', rotulo: 'Feijão/leguminosa cozida (1,85)', valor: 1.85 },
  { codigo: 'CARNE_GRELHADA_ASSADA', rotulo: 'Carne/peixe grelhado ou assado (0,78)', valor: 0.78 },
  { codigo: 'CARNE_COZIDA_ENSOPADA', rotulo: 'Carne/peixe cozido (0,88)', valor: 0.88 },
  { codigo: 'LEGUME_TUBERCULO_COZIDO', rotulo: 'Tubérculo/legume cozido (0,95)', valor: 0.95 },
  { codigo: 'LEGUME_TUBERCULO_ASSADO_REFOGADO', rotulo: 'Tubérculo/legume assado/refogado (0,82)', valor: 0.82 },
  { codigo: 'OVO_PREPARADO', rotulo: 'Ovo preparado (0,90)', valor: 0.9 },
];

export interface FatoresEstimados {
  perfilFc: CodigoFc;
  perfilFcc: CodigoFcc;
  fatorCorrecao: number;
  fatorCoccao: number;
}

const CRU = padrao('cru(?:a|as|s)?|fresco|fresca|frescos|frescas|in natura|seca?s?|po|flocos|farinha');
const COZIDO = padrao('cozid[a-z]*|vapor');
const GRELHADO = padrao('grelhad[a-z]*|assad[a-z]*|frit[a-z]*|refogad[a-z]*|chapa|airfryer|air fryer|bife');
const ENSOPADO = padrao('cozid[a-z]*|desfiad[a-z]*|ensopad[a-z]*|panela|moid[a-z]*');
const OVO_FEITO = padrao('cozid[a-z]*|mexid[a-z]*|frit[a-z]*|poche|omelete');
const ASSADO_LEGUME = padrao('assad[a-z]*|refogad[a-z]*|grelhad[a-z]*|frit[a-z]*|chips');
const OVO = padrao('ovos?|claras?|gemas?');
const ARROZ = padrao('arroz');
const MASSA = padrao('macarrao|espaguete|penne|parafuso|talharim|lasanha|nhoque');
const LEGUMINOSA = padrao('feijao|lentilha|grao de bico|soja');
const GRAO_QUANDO_COZIDO = padrao('quinoa|milho|canjica|aveia');
const PRONTO = padrao('leite|queijo|iogurte|requeijao|whey|oleo|azeite|manteiga|pao|suco');
const PROCESSADO = padrao('bacon|calabresa|presunto|salsicha|linguica|apresuntado');
const OSSO = padrao('coxa|sobrecoxa|costela|acem|asa|com osso');
const CASCA_GROSSA = padrao('banana|manga|abacaxi|abacate|maracuja|melancia|coco');
const FOLHA = padrao('alface|rucula|agriao|couve|espinafre|brocolis|repolho|acelga');
const CASCA_MEDIA = padrao('batata|mandioca|aipim|inhame|mandioquinha|cenoura|beterraba|abobrinha|chuchu|berinjela|abobora|cebola|alho|pimentao|laranja|mexerica|tangerina|mamao|melao|kiwi|goiaba|legumes');
const CASCA_FINA = padrao('maca|pera|morango|uva|ameixa|pessego|tomate|pepino');
const SEM_DESCARTE = padrao('arroz|macarrao|espaguete|penne|parafuso|talharim|lasanha|nhoque|aveia|farinha|feijao|lentilha|grao de bico|soja|leite|queijo|iogurte|whey|oleo|azeite|manteiga|pao|castanha|nozes|noz|amendoa|amendoim|ovos?|claras?|gemas?|chia|linhaca|semente|quinoa');
const CARNE = padrao('carne|bovin[a-z]*|suin[a-z]*|frango|peru|peixe|file|bife|moid[a-z]*|patinho|alcatra|picanha|tilapia|salmao|atum|camarao|lombo|figado|bacon|calabresa|presunto|salsicha|linguica');
const TUBERCULO = padrao('batata|mandioca|aipim|inhame|mandioquinha|cenoura|beterraba|abobrinha|chuchu|berinjela|abobora|brocolis|couve flor|vagem|legumes');

const duasCasas = (n: number) => Math.abs(Math.round(n * 100) - n * 100) < 1e-9;
const tela = (n: number) => String(n).replace('.', ',');

function erroDaFaixa(valor: number | null, minimo: number, maximo: number): string | null {
  if (valor === null) return null;
  if (valor < minimo || valor > maximo) return `Use um valor de ${tela(minimo)} a ${tela(maximo)}.`;
  if (!duasCasas(valor)) return 'Use no máximo duas casas decimais.';
  return null;
}

/** Mensagem do campo "Fator de correção"; `null` quando vazio ou válido. */
export function erroDoFatorCorrecao(valor: number | null): string | null {
  return erroDaFaixa(valor, FC_MINIMO, FC_MAXIMO);
}

/** Mensagem do campo "Fator de cocção"; `null` quando vazio ou válido. */
export function erroDoFatorCoccao(valor: number | null): string | null {
  return erroDaFaixa(valor, FCC_MINIMO, FCC_MAXIMO);
}

/** "FC 1,75 · FCc 2,5" na lista da biblioteca; sem nenhum fator, `null` e nada aparece. */
export function textoDosFatores(a: { fatorCorrecao: number | null; fatorCoccao: number | null }): string | null {
  const partes = [a.fatorCorrecao !== null ? `FC ${tela(a.fatorCorrecao)}` : null, a.fatorCoccao !== null ? `FCc ${tela(a.fatorCoccao)}` : null];
  const texto = partes.filter(Boolean).join(' · ');
  return texto || null;
}

/** Perfil do número, ou `PERSONALIZADO` quando não é um dos valores da tabela. */
export function perfilFcDoValor(valor: number | null): CodigoFc | 'PERSONALIZADO' {
  return PERFIS_FC.find((p) => valor !== null && Math.abs(p.valor - valor) < 1e-9)?.codigo ?? 'PERSONALIZADO';
}

/** Perfil do número, ou `PERSONALIZADO` quando não é um dos valores da tabela. */
export function perfilFccDoValor(valor: number | null): CodigoFcc | 'PERSONALIZADO' {
  return PERFIS_FCC.find((p) => valor !== null && Math.abs(p.valor - valor) < 1e-9)?.codigo ?? 'PERSONALIZADO';
}

/**
 * Estima FC e FCc pelo nome, pelo grupo e, quando a base é em gramas, pela caloria por 100 g.
 * `kcal` é o da base (`baseQuantidade` + `baseUnidade`).
 */
export function estimarFatoresDoAlimento(
  nome: string,
  grupo?: string | null,
  kcal?: number | null,
  baseQuantidade?: number | null,
  baseUnidade?: string | null,
): FatoresEstimados {
  const texto = `${normalizar(nome)} ${normalizar(grupo)}`.trim();
  const perfilFc = escolherFc(texto);
  const perfilFcc = escolherFcc(texto, kcalPor100g(kcal, baseQuantidade, baseUnidade));
  return {
    perfilFc,
    perfilFcc,
    fatorCorrecao: PERFIS_FC.find((p) => p.codigo === perfilFc)!.valor,
    fatorCoccao: PERFIS_FCC.find((p) => p.codigo === perfilFcc)!.valor,
  };
}

/** Preenche só o fator que veio nulo. */
export function completarFatores(
  fatorCorrecao: number | null,
  fatorCoccao: number | null,
  nome: string,
  grupo?: string | null,
  kcal?: number | null,
  baseQuantidade?: number | null,
  baseUnidade?: string | null,
): { fatorCorrecao: number; fatorCoccao: number } {
  if (fatorCorrecao !== null && fatorCoccao !== null) return { fatorCorrecao, fatorCoccao };
  const e = estimarFatoresDoAlimento(nome, grupo, kcal, baseQuantidade, baseUnidade);
  return {
    fatorCorrecao: fatorCorrecao ?? e.fatorCorrecao,
    fatorCoccao: fatorCoccao ?? e.fatorCoccao,
  };
}

/** Grupo e resumo da conversão na linha da biblioteca. */
export function descricaoDosFatores(a: { grupo?: string | null; fatorCorrecao: number | null; fatorCoccao: number | null }): string | null {
  const grupo = a.grupo?.trim() || '';
  const fc = a.fatorCorrecao;
  const fcc = a.fatorCoccao;
  if (fc === null || fcc === null) return [grupo || null, textoDosFatores(a)].filter(Boolean).join(' · ') || null;
  const prefixo = grupo ? `${grupo} · ` : '';
  if (Math.abs(fc - 1) < 1e-9 && Math.abs(fcc - 1) < 1e-9) return `${prefixo}Peso direto (sem perda na limpeza/cocção)`;
  const comprar = (100 / fcc) * fc;
  return `${prefixo}FC ${tela(fc)} · FCc ${tela(fcc)} (100 g na dieta → ${numeroPt(comprar)} g a comprar)`;
}

/** Frase debaixo dos campos do alimento, para 100 g na dieta. */
export function previaDeConversao(fatorCorrecao: number, fatorCoccao: number): string {
  const cru = 100 / fatorCoccao;
  const comprar = cru * fatorCorrecao;
  return `Estimativa na lista de compras: para 100 g na dieta → separar ${numeroPt(cru)} g cru limpo → comprar ${numeroPt(comprar)} g no mercado (1,00 kg na dieta = ${numeroPt(comprar / 100)} kg a comprar).`;
}

function escolherFc(texto: string): CodigoFc {
  if (casa(PROCESSADO, texto)) return 'SEM_PERDA';
  if (casa(OSSO, texto)) return 'DESCASCADO_ALTO';
  if (casa(CASCA_GROSSA, texto)) return 'DESCASCADO_ALTO';
  if (casa(FOLHA, texto)) return 'DESCASCADO_ALTO';
  if (casa(CASCA_MEDIA, texto)) return 'DESCASCADO_MEDIO';
  if (casa(CASCA_FINA, texto)) return 'LIMPEZA_LEVE';
  if (casa(SEM_DESCARTE, texto) || casa(OVO, texto) || casa(PRONTO, texto)) return 'SEM_PERDA';
  if (casa(CARNE, texto) || texto.includes(' carne') || texto.includes('pescado')) return 'LIMPEZA_LEVE';
  if (texto.includes('fruta')) return 'LIMPEZA_LEVE';
  if (texto.includes('verdura') || texto.includes('hortalica')) return 'DESCASCADO_MEDIO';
  return 'SEM_PERDA';
}

function escolherFcc(texto: string, kcal100: number | null): CodigoFcc {
  if (casa(CRU, texto)) return 'CRU_OU_PRONTO';
  if (casa(OVO, texto)) return casa(OVO_FEITO, texto) ? 'OVO_PREPARADO' : 'CRU_OU_PRONTO';
  if (casa(TUBERCULO, texto)) {
    if (casa(ASSADO_LEGUME, texto)) return 'LEGUME_TUBERCULO_ASSADO_REFOGADO';
    if (casa(COZIDO, texto)) return 'LEGUME_TUBERCULO_COZIDO';
    return 'CRU_OU_PRONTO';
  }
  if (casa(CARNE, texto) || texto.includes(' carne') || texto.includes('pescado')) {
    if (casa(GRELHADO, texto)) return 'CARNE_GRELHADA_ASSADA';
    if (casa(ENSOPADO, texto)) return 'CARNE_COZIDA_ENSOPADA';
    return 'CRU_OU_PRONTO';
  }
  if (casa(PRONTO, texto)) return 'CRU_OU_PRONTO';
  if (casa(LEGUMINOSA, texto) || (texto.includes('leguminosa') && !texto.includes(' legumes '))) {
    if (!casa(COZIDO, texto) && kcal100 !== null && kcal100 >= 250) return 'CRU_OU_PRONTO';
    return 'LEGUMINOSA_COZIDA';
  }
  if (casa(MASSA, texto)) {
    if (!casa(COZIDO, texto) && kcal100 !== null && kcal100 >= 300) return 'CRU_OU_PRONTO';
    return 'MASSA_COZIDA';
  }
  if (casa(ARROZ, texto)) {
    if (casa(COZIDO, texto)) return 'GRAO_COZIDO';
    if (kcal100 !== null && kcal100 >= 250) return 'CRU_OU_PRONTO';
    return 'GRAO_COZIDO';
  }
  if (casa(GRAO_QUANDO_COZIDO, texto) && casa(COZIDO, texto)) return 'GRAO_COZIDO';
  return 'CRU_OU_PRONTO';
}

function kcalPor100g(kcal?: number | null, base?: number | null, unidade?: string | null): number | null {
  if (kcal == null || base == null || !Number.isFinite(kcal) || !Number.isFinite(base) || base <= 0) return null;
  if (unidade && unidade.toLowerCase() !== 'g') return null;
  return (kcal * 100) / base;
}

function normalizar(texto?: string | null): string {
  return (texto ?? '').normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase();
}

function padrao(alternativas: string): RegExp {
  return new RegExp(`(?<![a-z0-9])(?:${alternativas})(?![a-z0-9])`);
}

function casa(padrao: RegExp, texto: string): boolean {
  return padrao.test(texto);
}

function numeroPt(n: number): string {
  const arred = Math.round(n * 100) / 100;
  return arred.toFixed(2).replace('.', ',');
}
