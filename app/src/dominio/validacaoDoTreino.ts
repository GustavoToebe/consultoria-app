import type { Configuracao, ExercicioPlano, Problema, ResultadoValidacao, Serie, Sessao, TecnicaDeGrupo } from '../api/tipos';
import { DESCANSO_MAXIMO_DO_GRUPO, grupoEmSequencia, MAXIMO_DE_VOLTAS, MAXIMO_POR_GRUPO, MINIMO_POR_GRUPO } from './combinacoes';
import { TIPOS_DE_GRUPO, tipoPorCodigo } from './metodologia';
import { problemasDaSerie } from './validacaoDeSerie';
import { videoValido } from './video';

/**
 * Validação do treino no editor, para as telas mostrarem o erro no próprio campo ANTES de publicar. Espelha o
 * `ValidadorTreino` da API (mesmas regras, severidades, caminhos, faixas e mensagens) e devolve o mesmo `ResultadoValidacao` (`erros` e `avisos`
 * com `caminho` + `mensagem`, caminhos como `sessoes[0].exercicios[1].series[2].carga.percentualMin`), então os helpers de
 * `caminhos` (`localizar`, `uidsComProblema`) servem aos dois. Quem decide ao publicar é o servidor; aqui nada é mais
 * rígido que ele. Avisos não impedem publicar. Como no servidor, sem metodologia vinculada ao conteúdo não há aviso de tipo.
 * Os caminhos são relativos ao item validado (`series[0].tipo` para um exercício, `exercicios[0].series[0].tipo` para uma
 * sessão); `validarTreino` os devolve completos. A unicidade dos uids vale por chamada: no plano todo (sessões, exercícios,
 * séries e grupos) em `validarTreino`. O fim do período antes do início precisa das datas do plano, que não estão no
 * conteúdo: `validarTreino` só a confere quando recebe o `periodo`; sem ele, quem avisa é o servidor.
 */

const CADENCIA = /^[0-9X](-[0-9X]){3}$/;
const TIPOS_DE_SESSAO: readonly string[] = ['TREINO', 'DESCANSO_ATIVO', 'DESCANSO', 'ACESSORIOS'];

/** Junta um caminho base (possivelmente vazio) com o resto. */
const junta = (base: string, resto: string) => (base ? `${base}.${resto}` : resto);

class Coletor {
  readonly erros: Problema[] = [];
  readonly avisos: Problema[] = [];
  /** Uids vistos (sessões, exercícios, séries e grupos): o mesmo identificador não pode se repetir. */
  private readonly uids = new Set<string>();
  /** Sessões por dia da semana (para avisar de duas no mesmo dia) e se o plano tem dia de descanso. */
  readonly sessoesPorDia = new Map<number, number>();
  temDescanso = false;
  uid(uid: string | null | undefined, caminho: string) {
    if (!uid) this.erro(junta(caminho, 'uid'), 'Item sem identificador.');
    else if (this.uids.has(uid)) this.erro(junta(caminho, 'uid'), 'Identificador repetido.');
    else this.uids.add(uid);
  }
  erro(caminho: string, mensagem: string) {
    this.erros.push({ caminho, mensagem });
  }
  aviso(caminho: string, mensagem: string) {
    this.avisos.push({ caminho, mensagem });
  }
  resultado(): ResultadoValidacao {
    return { erros: this.erros, avisos: this.avisos };
  }
}

const vazio = (t: string | null | undefined) => !t || !t.trim();
const modoDe = (s: Serie) => s.carga?.modo ?? 'NENHUMA';
/** Série de trabalho: a referência da carga do dia. A mesma regra de `Serie.deTrabalho()` da API. */
export const serieDeTrabalho = (s: Serie): boolean => modoDe(s) === 'CARGA_TRABALHO';

function avisosDoTipo(c: Coletor, s: Serie, caminho: string, metodologia: Configuracao, tiposAvisados: Set<string>) {
  if (vazio(s.tipo)) return;
  const codigo = s.tipo!.trim();
  const definicao = tipoPorCodigo(metodologia, codigo);
  if (!definicao) {
    if (!tiposAvisados.has(codigo)) {
      tiposAvisados.add(codigo);
      c.aviso(junta(caminho, 'tipo'), `O tipo "${codigo}" não está na metodologia do plano (${metodologia.tipos.map((t) => t.codigo).join(', ')}). A série continua válida.`);
    }
    return;
  }
  if (s.esforco?.rir === 0 && (definicao.papel === 'AQUECIMENTO' || definicao.papel === 'PREPARACAO')) {
    c.aviso(junta(caminho, 'esforco.rir'), 'RIR 0 (até a falha) em série de aquecimento ou preparação: confira se é isso mesmo.');
  }
}

/** Um exercício: as regras dele e de cada série, com a posição da série (mesma carga, acima da anterior, referência). */
function validarExercicioNoColetor(c: Coletor, e: ExercicioPlano, caminho: string, metodologia: Configuracao | null) {
  c.uid(e.uid, caminho);
  if (vazio(e.nome)) c.erro(junta(caminho, 'nome'), 'Exercício sem nome.');
  if (!vazio(e.videoUrl) && !videoValido(e.videoUrl)) c.erro(junta(caminho, 'videoUrl'), 'Link de vídeo não aceito (só https do YouTube).');
  if (e.unidade != null && e.unidade !== 'kg' && e.unidade !== 'nenhuma') c.erro(junta(caminho, 'unidade'), 'Unidade precisa ser kg ou nenhuma.');
  if (!vazio(e.cadencia) && !CADENCIA.test(e.cadencia!)) c.erro(junta(caminho, 'cadencia'), 'Cadência em 4 partes separadas por hífen, cada uma de 0 a 9 ou X (ex.: 3-1-1-0).');
  if (e.isometriaSegundos != null && !(Number.isInteger(e.isometriaSegundos) && e.isometriaSegundos >= 1 && e.isometriaSegundos <= 120)) {
    c.erro(junta(caminho, 'isometriaSegundos'), 'Isometria de 1 a 120 segundos.');
  }
  const series = e.series ?? [];
  if (series.length === 0) c.erro(junta(caminho, 'series'), 'Exercício sem série.');
  const cardio = e.modalidade === 'CARDIO';
  const temTrabalho = series.some(serieDeTrabalho);
  let temPercentual = false;
  let trabalhoAntes = false;
  const tiposAvisados = new Set<string>();
  const tecnicasAvisadas = new Set<string>();
  const anteriores = new Set<string>();
  series.forEach((s, k) => {
    const cs = junta(caminho, `series[${k}]`);
    c.uid(s.uid, cs);
    for (const [campo, mensagem] of Object.entries(problemasDaSerie(s, cardio))) c.erro(junta(cs, campo), mensagem);
    if (!cardio) {
      if (metodologia) avisosDoTipo(c, s, cs, metodologia, tiposAvisados);
      const modo = modoDe(s);
      if (modo === 'PERCENTUAL_WS') temPercentual = true;
      if (modo === 'MESMA_CARGA' && !trabalhoAntes) c.erro(junta(cs, 'carga.modo'), 'Mesma carga da WS: precisa de uma série de trabalho antes, no mesmo exercício.');
      if (modo === 'ACIMA_DA_ANTERIOR' && k === 0) c.aviso(junta(cs, 'carga.modo'), 'Acima da anterior na primeira série do exercício: o aluno não terá carga anterior de referência.');
      const referencia = s.carga?.referenciaUid;
      if (modo === 'ABAIXO_DA_REFERENCIA' && referencia && !anteriores.has(referencia)) {
        c.erro(junta(cs, 'carga.referenciaUid'), 'A referência precisa ser uma série anterior, no mesmo exercício.');
      }
      if (s.tecnica?.tipo === 'FORCED_REPS') c.aviso(junta(cs, 'tecnica'), 'Forced reps precisa de um parceiro para ajudar nas repetições.');
      avisoDaTecnica(c, s, cs, metodologia, tecnicasAvisadas);
    }
    if (serieDeTrabalho(s)) trabalhoAntes = true;
    if (s.uid) anteriores.add(s.uid);
  });
  if (temPercentual && !temTrabalho) {
    c.aviso(junta(caminho, 'series'), 'Há série em % da WS sem série de trabalho: a referência será a carga de trabalho que o aluno digitar.');
  }
  if (e.progressao === false && temTrabalho) c.aviso(junta(caminho, 'progressao'), 'Exercício sem progressão de carga, mas com série de trabalho.');
}

/** Aviso (não erro) quando a técnica da série não está na metodologia do plano. Uma vez por código, no exercício. */
function avisoDaTecnica(c: Coletor, s: Serie, caminho: string, metodologia: Configuracao | null, avisadas: Set<string>) {
  const tipo = s.tecnica?.tipo;
  if (!metodologia || !tipo) return;
  if (metodologia.tecnicas?.some((t) => t.tipo === tipo) || avisadas.has(tipo)) return;
  avisadas.add(tipo);
  const codigos = (metodologia.tecnicas ?? []).map((t) => t.tipo).join(', ');
  c.aviso(junta(caminho, 'tecnica'), `A técnica "${tipo}" não está na metodologia do plano (${codigos}). A série continua válida.`);
}

/** Grupos da sessão: técnica, descanso após o grupo, voltas, e os membros (existem, seguidos, quantidade da técnica). */
function validarGruposNoColetor(c: Coletor, s: Sessao, caminho: string, metodologia: Configuracao | null) {
  const grupos = s.grupos ?? [];
  const exercicios = s.exercicios ?? [];
  const posicaoDoGrupo = new Map<string, number>();
  grupos.forEach((g, i) => {
    const cg = junta(caminho, `grupos[${i}]`);
    c.uid(g.uid, cg);
    if (g.uid && !posicaoDoGrupo.has(g.uid)) posicaoDoGrupo.set(g.uid, i);
    if (!g.tecnica || !TIPOS_DE_GRUPO.includes(g.tecnica)) {
      c.erro(junta(cg, 'tecnica'), 'Técnica de grupo inválida: use superset, agonista-antagonista, tri-set, giant set, circuito, pré-exaustão ou pós-exaustão.');
    } else if (metodologia && !(metodologia.combinacoes ?? []).some((k) => k.tipo === g.tecnica)) {
      const codigos = (metodologia.combinacoes ?? []).map((k) => k.tipo).join(', ');
      c.aviso(junta(cg, 'tecnica'), `A combinação "${g.tecnica}" não está na metodologia do plano (${codigos}). O grupo continua válido.`);
    }
    if (g.descansoAposSegundos != null) {
      if (grupoEmSequencia(g.tecnica)) {
        c.erro(junta(cg, 'descansoAposSegundos'), 'Pré e pós-exaustão não têm descanso depois do grupo: cada série mantém o próprio.');
      } else if (!Number.isInteger(g.descansoAposSegundos) || g.descansoAposSegundos < 0 || g.descansoAposSegundos > DESCANSO_MAXIMO_DO_GRUPO) {
        c.erro(junta(cg, 'descansoAposSegundos'), `Descanso depois do grupo entre 0 e ${DESCANSO_MAXIMO_DO_GRUPO} segundos.`);
      }
    }
    if (g.tecnica === 'CIRCUITO' && (g.voltas == null || !Number.isInteger(g.voltas) || g.voltas < 1 || g.voltas > MAXIMO_DE_VOLTAS)) {
      c.erro(junta(cg, 'voltas'), `Circuito: de 1 a ${MAXIMO_DE_VOLTAS} voltas.`);
    }
  });
  const membros: number[][] = grupos.map(() => []);
  exercicios.forEach((e, j) => {
    if (!e.grupoUid) return;
    const posicao = posicaoDoGrupo.get(e.grupoUid);
    if (posicao === undefined) c.erro(junta(caminho, `exercicios[${j}].grupoUid`), 'O grupo do exercício não existe na sessão.');
    else membros[posicao].push(j);
  });
  grupos.forEach((g, i) => {
    const indices = membros[i];
    const cg = junta(caminho, `grupos[${i}]`);
    if (indices.length === 0) {
      c.erro(cg, 'Grupo sem exercícios.');
      return;
    }
    if (indices[indices.length - 1] - indices[0] + 1 !== indices.length) {
      c.erro(cg, 'Os exercícios de um grupo precisam ficar um ao lado do outro na sessão.');
    }
    if (g.tecnica === 'CIRCUITO' && Number.isInteger(g.voltas) && (g.voltas as number) >= 1) {
      const diferente = indices.map((j) => exercicios[j]).find((e) => (e.series ?? []).length !== g.voltas);
      if (diferente) {
        c.aviso(junta(cg, 'voltas'), `Circuito de ${g.voltas} ${g.voltas === 1 ? 'volta' : 'voltas'}: o aluno registra uma série por volta, então cada exercício precisa de ${g.voltas} ${g.voltas === 1 ? 'série' : 'séries'} (${diferente.nome?.trim() || 'um exercício'} tem ${(diferente.series ?? []).length}).`);
      }
    }
    const minimo = MINIMO_POR_GRUPO[g.tecnica as TecnicaDeGrupo] as number | undefined;
    if (minimo === undefined) return;
    if (grupoEmSequencia(g.tecnica) && indices.length !== 2) c.erro(cg, 'Pré e pós-exaustão têm exatamente 2 exercícios.');
    else if (!grupoEmSequencia(g.tecnica) && indices.length < minimo) c.erro(cg, `Esse grupo precisa de pelo menos ${minimo} exercícios.`);
    else if (indices.length > MAXIMO_POR_GRUPO) c.erro(cg, `Um grupo de exercícios feitos juntos vai até ${MAXIMO_POR_GRUPO} exercícios.`);
  });
}

/** Validação de um exercício (caminhos a partir do exercício: `series[0].tipo`, ou a partir de `prefixo`). */
export function validarExercicio(e: ExercicioPlano, metodologia: Configuracao | null | undefined, prefixo = ''): ResultadoValidacao {
  const c = new Coletor();
  validarExercicioNoColetor(c, e, prefixo, metodologia ?? null);
  return c.resultado();
}

/** Uma sessão: ela mesma (nome, tipo, dia, frequência, exercícios), os exercícios com as séries e os grupos. */
function validarSessaoNoColetor(c: Coletor, s: Sessao, caminho: string, metodologia: Configuracao | null) {
  c.uid(s.uid, caminho);
  if (vazio(s.nome)) c.erro(junta(caminho, 'nome'), 'Sessão sem nome.');
  if (!TIPOS_DE_SESSAO.includes(s.tipo)) c.erro(junta(caminho, 'tipo'), 'Tipo de sessão inválido.');
  if (s.tipo === 'DESCANSO' || s.tipo === 'DESCANSO_ATIVO') c.temDescanso = true;
  if (s.diaSemana != null) {
    if (!Number.isInteger(s.diaSemana) || s.diaSemana < 1 || s.diaSemana > 7) {
      c.erro(junta(caminho, 'diaSemana'), 'Dia da semana precisa ser de 1 (segunda) a 7 (domingo).');
    } else {
      const total = (c.sessoesPorDia.get(s.diaSemana) ?? 0) + 1;
      c.sessoesPorDia.set(s.diaSemana, total);
      if (total === 2) c.aviso(junta(caminho, 'diaSemana'), 'Duas sessões no mesmo dia da semana.');
    }
  }
  if (s.frequenciaSemanal != null && (!Number.isInteger(s.frequenciaSemanal) || s.frequenciaSemanal < 1 || s.frequenciaSemanal > 7)) {
    c.erro(junta(caminho, 'frequenciaSemanal'), 'Frequência semanal precisa ser de 1 a 7.');
  }
  const exercicios = s.exercicios ?? [];
  if (s.tipo === 'TREINO' && exercicios.length === 0) c.erro(junta(caminho, 'exercicios'), 'Sessão de treino sem exercício.');
  exercicios.forEach((e, j) => validarExercicioNoColetor(c, e, junta(caminho, `exercicios[${j}]`), metodologia));
  validarGruposNoColetor(c, s, caminho, metodologia);
}

/** Validação de uma sessão, com os exercícios, as séries e os grupos. Caminhos como `exercicios[1].series[0].tipo`. */
export function validarSessao(s: Sessao, metodologia: Configuracao | null | undefined, prefixo = ''): ResultadoValidacao {
  const c = new Coletor();
  validarSessaoNoColetor(c, s, prefixo, metodologia ?? null);
  return c.resultado();
}

/** Datas do plano (AAAA-MM-DD), que não fazem parte do conteúdo do treino. */
export interface PeriodoDoPlano {
  inicio?: string | null;
  fim?: string | null;
}

/**
 * Validação do treino todo do editor (sessões `sessoes[i]...`), com a metodologia que acompanha o conteúdo. O plano sem
 * sessão é erro; sem dia de descanso e o fim do período antes do início (só com `periodo`) são avisos. Os uids valem no
 * plano inteiro: sessão, exercício, série e grupo não repetem identificador.
 */
export function validarTreino(
  conteudo: { sessoes: Sessao[]; metodologia?: { configuracao: Configuracao } | null },
  periodo?: PeriodoDoPlano | null,
): ResultadoValidacao {
  const metodologia = conteudo.metodologia?.configuracao ?? null;
  const c = new Coletor();
  const sessoes = conteudo.sessoes ?? [];
  if (sessoes.length === 0) c.erro('sessoes', 'O plano não tem nenhuma sessão.');
  sessoes.forEach((s, i) => validarSessaoNoColetor(c, s, `sessoes[${i}]`, metodologia));
  if (sessoes.length > 0 && !c.temDescanso) c.aviso('sessoes', 'O plano não tem dia de descanso.');
  if (periodo?.inicio && periodo.fim && periodo.fim < periodo.inicio) c.aviso('fim', 'O fim do período é antes do início.');
  return c.resultado();
}

/** Erros e avisos de UMA série do exercício, por campo (chaves relativas à série: `carga.modo`, `tipo`, `esforco.rpe`...). */
export function problemasDaSerieNoExercicio(
  e: ExercicioPlano,
  indice: number,
  metodologia: Configuracao | null | undefined,
): { erros: Record<string, string>; avisos: Record<string, string> } {
  const r = validarExercicio(e, metodologia);
  const prefixo = `series[${indice}].`;
  const filtrar = (lista: Problema[]) => Object.fromEntries(lista.filter((p) => p.caminho.startsWith(prefixo)).map((p) => [p.caminho.slice(prefixo.length), p.mensagem]));
  return { erros: filtrar(r.erros), avisos: filtrar(r.avisos) };
}
