import type { Carga, Configuracao, Esforco, PapelDaSerie, PadraoPorModalidade, TipoDeSerie } from '../api/tipos';
import { TIPOS_DE_GRUPO, TIPOS_DE_TECNICA, PAPEIS } from './metodologia';
import { chaveDeTipo, codigoDoNovoTipo, codigoValido, MAXIMO_DO_NOME, mensagemTipoECombinacao, mensagemTipoETecnica, nomeDeCombinacao, nomeDeTecnica } from './tiposDeSerie';
import { esforcoVazio, problemasDaCarga, problemasDaTecnica, problemasDoEsforco, type Problemas } from './validacaoDeSerie';

type FaixaEmEdicao = { min: number | null; max: number | null };
export type TipoEmEdicao = Omit<TipoDeSerie, 'repeticoes' | 'regraPercentuais'> & {
  repeticoes: FaixaEmEdicao | null;
  regraPercentuais: Record<string, FaixaEmEdicao[]> | null;
};
export type MetodologiaEmEdicao = Omit<Configuracao, 'tipos'> & { tipos: TipoEmEdicao[] };

const dentro = (v: number | null | undefined, min: number, max: number, inteiro = true) =>
  v != null && Number.isFinite(v) && v >= min && v <= max && (!inteiro || Number.isInteger(v));

const ARREDONDAMENTOS = [0.25, 0.5, 1, 2.5];
const MODALIDADES_COM_PADRAO = ['LIVRE', 'MAQUINA'];
const PAPEIS_VALIDOS: readonly string[] = PAPEIS.map((p) => p.valor);

/**
 * Tipo novo da lista, com o código gerado do nome AGORA (na criação) e único entre `existentes`; depois o código não muda,
 * nem se o nome mudar. Nasce sem padrões (a tela os preenche).
 */
export function novoTipoDeSerie(nome: string, existentes: readonly Pick<TipoDeSerie, 'codigo'>[], papel: PapelDaSerie = 'OUTRO'): TipoEmEdicao {
  return {
    codigo: codigoDoNovoTipo(nome, existentes.map((t) => t.codigo)),
    nome,
    papel,
    repeticoes: null,
    cargaPadrao: null,
    esforcoPadrao: null,
    porModalidade: null,
    regraPercentuais: null,
    explicacao: null,
  };
}

function comPrefixo(destino: Problemas, prefixo: string, problemas: Problemas) {
  for (const [campo, mensagem] of Object.entries(problemas)) destino[`${prefixo}.${campo}`] = mensagem;
}

/** Carga e esforço padrão de um tipo (ou da variação por modalidade): faixas da API; a referência do back off não é exigida. */
function problemasDoPadrao(destino: Problemas, prefixo: string, carga: Carga | null | undefined, esforco: Esforco | null | undefined) {
  comPrefixo(destino, `${prefixo}.carga`, problemasDaCarga(carga, false));
  // Esforço sem RIR nem RPE equivale a "sem esforço": `metodologiaParaSalvar` o tira, então não trava o salvar.
  if (!esforcoVazio(esforco)) comPrefixo(destino, `${prefixo}.esforco`, problemasDoEsforco(esforco));
}

/**
 * TODOS os problemas da metodologia em edição, por campo (vazio = pode salvar). Chaves: `tipos`, `tipos[i].nome`,
 * `tipos[i].codigo`, `tipos[i].papel`, `tipos[i].repeticoes`, `tipos[i].cargaPadrao.percentualMin`,
 * `tipos[i].esforcoPadrao.rpe`, `tipos[i].porModalidade.LIVRE.carga.modo`, `tipos[i].regraPercentuais[.n]`,
 * `tipos[i].explicacao`, `tecnicas`, `tecnicas[i].nome|explicacao|padrao[.campo]`, `combinacoes`,
 * `combinacoes[i].nome|explicacao`, `arredondamentoKg`, `instrucoesTreino`, `rodapePdf`. As mesmas regras da API
 * (`ConfiguracaoConsultoria.validarComoMetodologia`), com a mensagem do campo em vez de só a primeira falha.
 */
export function problemasDaMetodologia(c: MetodologiaEmEdicao): Problemas {
  const p: Problemas = {};
  if (!c.tipos.length || c.tipos.length > 20) p.tipos = 'Informe de 1 a 20 tipos de série.';
  const nomesDeTecnica = new Set(c.tecnicas.map((t) => chaveDeTipo(t.nome)));
  const nomesDeCombinacao = new Set((c.combinacoes ?? []).map((k) => chaveDeTipo(k.nome)));
  const nomes = new Set<string>();
  const codigos = new Set<string>();
  c.tipos.forEach((t, i) => {
    const em = `tipos[${i}]`;
    const nome = t.nome.trim();
    const chave = chaveDeTipo(nome);
    if (!nome) p[`${em}.nome`] = 'Dê um nome ao tipo.';
    else if (t.nome.length > MAXIMO_DO_NOME) p[`${em}.nome`] = `Nome com no máximo ${MAXIMO_DO_NOME} letras.`;
    else if (nomes.has(chave)) p[`${em}.nome`] = 'Já existe um tipo com esse nome (mesmo com outra caixa, acento ou hífen).';
    else if (nomeDeTecnica(nome) || nomesDeTecnica.has(chave)) p[`${em}.nome`] = mensagemTipoETecnica(nome);
    else if (nomeDeCombinacao(nome) || nomesDeCombinacao.has(chave)) p[`${em}.nome`] = mensagemTipoECombinacao(nome);
    nomes.add(chave);
    if (!codigoValido(t.codigo)) p[`${em}.codigo`] = 'O código precisa ter de 1 a 30 letras maiúsculas, números ou sublinhado.';
    else if (codigos.has(t.codigo)) p[`${em}.codigo`] = 'Já existe um tipo com esse código.';
    codigos.add(t.codigo);
    if (!PAPEIS_VALIDOS.includes(t.papel)) p[`${em}.papel`] = 'Escolha o papel do tipo: aquecimento, preparação, trabalho, pós-trabalho ou outro.';
    const r = t.repeticoes;
    if (r && (r.min != null || r.max != null) && (!dentro(r.min, 0, 500) || !dentro(r.max, r.min ?? 0, 500))) {
      p[`${em}.repeticoes`] = 'Repetições: mínima e máxima de 0 a 500, com a máxima maior ou igual à mínima.';
    }
    comPrefixo(p, `${em}.cargaPadrao`, problemasDaCarga(t.cargaPadrao, false));
    if (!esforcoVazio(t.esforcoPadrao)) comPrefixo(p, `${em}.esforcoPadrao`, problemasDoEsforco(t.esforcoPadrao));
    for (const [modalidade, padrao] of Object.entries(t.porModalidade ?? {}) as [string, PadraoPorModalidade | null][]) {
      if (!MODALIDADES_COM_PADRAO.includes(modalidade) || padrao == null) {
        p[`${em}.porModalidade`] = 'Padrão por modalidade: só peso livre e máquina, cada um com carga e/ou esforço.';
        continue;
      }
      problemasDoPadrao(p, `${em}.porModalidade.${modalidade}`, padrao.carga, padrao.esforco);
    }
    const regras = Object.entries(t.regraPercentuais ?? {});
    if (regras.length && t.papel !== 'PREPARACAO') p[`${em}.regraPercentuais`] = 'Regra de percentuais só em tipo de preparação.';
    for (const [n, faixas] of regras) {
      const invalida =
        !/^(10|[1-9])$/.test(n) || faixas.length !== Number(n) || faixas.some((f) => !dentro(f.min, 1, 200, false) || (f.max != null && !dentro(f.max, f.min!, 200, false)));
      if (invalida) p[`${em}.regraPercentuais.${n}`] = 'Preencha todas as faixas da regra: de 1 a 200%, com máximo maior ou igual ao mínimo.';
    }
    if ((t.explicacao?.length ?? 0) > 500) p[`${em}.explicacao`] = 'Explicação com no máximo 500 caracteres.';
  });
  if (!c.tipos.some((t) => t.papel === 'TRABALHO') && !p.tipos) p.tipos = 'A metodologia precisa de pelo menos um tipo de série de trabalho.';

  if (c.tecnicas.length !== TIPOS_DE_TECNICA.length || TIPOS_DE_TECNICA.some((tipo) => c.tecnicas.filter((t) => t.tipo === tipo).length !== 1)) {
    p.tecnicas = 'A metodologia precisa das seis técnicas (rest pause, cluster, drop-set, myo-reps, partial reps e forced reps), uma de cada.';
  }
  c.tecnicas.forEach((t, i) => {
    const em = `tecnicas[${i}]`;
    if (!t.nome.trim() || t.nome.length > MAXIMO_DO_NOME) p[`${em}.nome`] = `Nome da técnica: de 1 a ${MAXIMO_DO_NOME} letras.`;
    if ((t.explicacao?.length ?? 0) > 500) p[`${em}.explicacao`] = 'Explicação com no máximo 500 caracteres.';
    if (t.padrao && t.padrao.tipo !== t.tipo) p[`${em}.padrao`] = 'O padrão precisa ser da própria técnica.';
    else comPrefixo(p, `${em}.padrao`, problemasDaTecnica(t.padrao, false));
  });

  const combinacoes = c.combinacoes ?? [];
  if (combinacoes.length !== TIPOS_DE_GRUPO.length || TIPOS_DE_GRUPO.some((tipo) => combinacoes.filter((k) => k.tipo === tipo).length !== 1)) {
    p.combinacoes = 'A metodologia precisa das sete combinações (superset, agonista-antagonista, tri-set, giant set, circuito, pré-exaustão e pós-exaustão), uma de cada.';
  }
  combinacoes.forEach((k, i) => {
    const em = `combinacoes[${i}]`;
    if (!k.nome.trim() || k.nome.length > MAXIMO_DO_NOME) p[`${em}.nome`] = `Nome da combinação: de 1 a ${MAXIMO_DO_NOME} letras.`;
    if ((k.explicacao?.length ?? 0) > 500) p[`${em}.explicacao`] = 'Explicação com no máximo 500 caracteres.';
  });

  if (!ARREDONDAMENTOS.includes(c.arredondamentoKg)) p.arredondamentoKg = 'Escolha o arredondamento da carga: 0,25, 0,5, 1 ou 2,5 kg.';
  if ((c.instrucoesTreino?.length ?? 0) > 20000) p.instrucoesTreino = 'Instruções do treino com no máximo 20.000 caracteres.';
  if ((c.rodapePdf?.length ?? 0) > 500) p.rodapePdf = 'Rodapé do PDF com no máximo 500 caracteres.';
  return p;
}

const semReferencia = (c: Carga | null | undefined): Carga | null => (c ? { ...c, referenciaUid: null } : null);
const esforcoOuNulo = (e: Esforco | null | undefined): Esforco | null => (esforcoVazio(e) ? null : { ...e });

/**
 * A metodologia no formato que a API recebe: tira faixas vazias e espaços nas pontas; esforço sem RIR nem RPE vira nenhum
 * (a API recusaria um esforço padrão vazio, e é isso que impedia salvar quando se escolhia RPE e não se digitava o valor);
 * variação por modalidade sem carga nem esforço sai; a referência do back off não existe em padrão (nasce na série).
 */
export function metodologiaParaSalvar(c: MetodologiaEmEdicao): Configuracao {
  return {
    ...c,
    tipos: c.tipos.map((t) => {
      const porModalidade = Object.fromEntries(
        (Object.entries(t.porModalidade ?? {}) as [string, PadraoPorModalidade | null][])
          .filter((e): e is [string, PadraoPorModalidade] => e[1] != null)
          .map(([m, v]) => [m, { carga: semReferencia(v.carga), esforco: esforcoOuNulo(v.esforco) }] as const)
          .filter(([, v]) => v.carga != null || v.esforco != null),
      );
      return {
        ...t,
        nome: t.nome.trim(),
        repeticoes: t.repeticoes?.min != null && t.repeticoes.max != null ? { min: t.repeticoes.min, max: t.repeticoes.max } : null,
        cargaPadrao: semReferencia(t.cargaPadrao),
        esforcoPadrao: esforcoOuNulo(t.esforcoPadrao),
        porModalidade: Object.keys(porModalidade).length ? porModalidade : null,
        regraPercentuais: t.regraPercentuais as TipoDeSerie['regraPercentuais'],
        explicacao: t.explicacao?.trim() || null,
      };
    }),
    tecnicas: c.tecnicas.map((t) => ({ ...t, nome: t.nome.trim(), explicacao: t.explicacao?.trim() || null })),
    combinacoes: (c.combinacoes ?? []).map((k) => ({ ...k, nome: k.nome.trim(), explicacao: k.explicacao?.trim() || null })),
  };
}
