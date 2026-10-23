import type { Carga, Configuracao, Esforco, PapelDaSerie, PadraoPorModalidade, TipoDeSerie } from '../api/tipos';
import { PAPEIS, tecnicaDescritiva, TIPOS_DE_GRUPO, TIPOS_DE_TECNICA } from './metodologia';
import { chaveDeTipo, codigoDoNovoTipo, codigoValido, MAXIMO_DO_NOME, mensagemTipoECombinacao, mensagemTipoETecnica, nomeDeCombinacao, nomeDeTecnica, NOMES_DE_COMBINACAO, NOMES_DE_TECNICA } from './tiposDeSerie';
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
  const chavesConfiguradasDeTecnica = new Set(c.tecnicas.map((t) => chaveDeTipo(t.nome)));
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
    else if (nomeDeTecnica(nome) || chavesConfiguradasDeTecnica.has(chave)) p[`${em}.nome`] = mensagemTipoETecnica(nome);
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

  if (c.tecnicas.length > TIPOS_DE_TECNICA.length) p.tecnicas = `Técnicas: no máximo ${TIPOS_DE_TECNICA.length}.`;
  const tiposDeTecnica = new Set<string>();
  const chavesDeTecnica = new Set<string>();
  c.tecnicas.forEach((t, i) => {
    const em = `tecnicas[${i}]`;
    if (!(TIPOS_DE_TECNICA as readonly string[]).includes(t.tipo)) p[`${em}.tipo`] = 'Técnica desconhecida.';
    else if (tiposDeTecnica.has(t.tipo)) p.tecnicas = 'Técnicas: sem repetir.';
    tiposDeTecnica.add(t.tipo);
    const nome = t.nome.trim();
    const chave = chaveDeTipo(nome);
    const nomeRepetido = !!chave && chavesDeTecnica.has(chave);
    if (chave) chavesDeTecnica.add(chave);
    if (!nome || t.nome.length > MAXIMO_DO_NOME) p[`${em}.nome`] = `Nome da técnica: de 1 a ${MAXIMO_DO_NOME} letras.`;
    else if (nomeRepetido || nomes.has(chave) || (NOMES_DE_COMBINACAO as readonly string[]).includes(chave)) {
      p[`${em}.nome`] = `Nome da técnica "${nome}" já é de um tipo, de outra técnica ou de uma combinação.`;
    }
    if ((t.explicacao?.length ?? 0) > 500) p[`${em}.explicacao`] = 'Explicação com no máximo 500 caracteres.';
    if (tecnicaDescritiva(t.tipo)) {
      if (t.padrao) p[`${em}.padrao`] = `Padrão da técnica ${t.tipo}: técnica descritiva não tem padrão.`;
      return;
    }
    if (t.padrao && t.padrao.tipo !== t.tipo) p[`${em}.padrao`] = 'O padrão precisa ser da própria técnica.';
    else comPrefixo(p, `${em}.padrao`, problemasDaTecnica(t.padrao, false));
  });

  const combinacoes = c.combinacoes ?? [];
  if (combinacoes.length > TIPOS_DE_GRUPO.length) p.combinacoes = `Combinações: no máximo ${TIPOS_DE_GRUPO.length}.`;
  const tiposDeCombinacao = new Set<string>();
  const chavesDeCombinacao = new Set<string>();
  const nomesDeTecnica = new Set<string>([...NOMES_DE_TECNICA, ...c.tecnicas.map((t) => chaveDeTipo(t.nome))]);
  combinacoes.forEach((k, i) => {
    const em = `combinacoes[${i}]`;
    if (!(TIPOS_DE_GRUPO as readonly string[]).includes(k.tipo)) {
      p.combinacoes = 'Combinações: uma de cada do catálogo (superset, agonista-antagonista, tri-set, giant set, circuito, pré-exaustão e pós-exaustão), sem tipo desconhecido.';
    } else if (tiposDeCombinacao.has(k.tipo)) p.combinacoes = 'Combinações: sem repetir.';
    tiposDeCombinacao.add(k.tipo);
    const nome = k.nome.trim();
    const chave = chaveDeTipo(nome);
    const nomeRepetido = !!chave && chavesDeCombinacao.has(chave);
    if (chave) chavesDeCombinacao.add(chave);
    if (!nome || k.nome.length > MAXIMO_DO_NOME) p[`${em}.nome`] = `Nome da combinação: de 1 a ${MAXIMO_DO_NOME} letras.`;
    else if (nomeRepetido || nomes.has(chave) || nomesDeTecnica.has(chave)) {
      p[`${em}.nome`] = `Nome da combinação "${nome}" já é de um tipo, de uma técnica ou de outra combinação.`;
    }
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
    tecnicas: c.tecnicas.map((t) => ({ ...t, nome: t.nome.trim(), explicacao: t.explicacao?.trim() || null, padrao: tecnicaDescritiva(t.tipo) ? null : t.padrao })),
    combinacoes: (c.combinacoes ?? []).map((k) => ({ ...k, nome: k.nome.trim(), explicacao: k.explicacao?.trim() || null })),
  };
}
