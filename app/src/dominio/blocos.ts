/**
 * Blocos do cluster como o treinador escreve na planilha: "4+2" (blocos desiguais) ou "3×4" (3 blocos de 4). No plano
 * ficam como lista de repetições (`Tecnica.blocos`: `[4, 2]`, `[4, 4, 4]`); as repetições da série são a soma. Os
 * limites são os do servidor (`ConteudoTreino.Tecnica`): de 2 a 10 blocos, cada um com 1 a 50 repetições.
 */

export const MINIMO_DE_BLOCOS = 2;
export const MAXIMO_DE_BLOCOS = 10;
export const MAXIMO_REPS_POR_BLOCO = 50;

/**
 * Lê o texto digitado: "4+2" ou "5-5-5" (hífen ou meia-risca) → lista; "3×4", "3x4" ou "3 x 4" → `[4, 4, 4]`; "6" →
 * `[6]` (um bloco só, que `blocosValidos` recusa). Vazio ou sem forma conhecida → `null`.
 */
export function lerBlocos(texto: string): number[] | null {
  const t = texto.replace(/\s+/g, '').replace(/[×X*]/g, 'x').replace(/[-–]/g, '+');
  if (!t) return null;
  const multiplicacao = /^(\d{1,2})x(\d{1,3})$/.exec(t);
  if (multiplicacao) {
    const quantidade = Number(multiplicacao[1]);
    const reps = Number(multiplicacao[2]);
    if (quantidade < 1) return null;
    return Array.from({ length: quantidade }, () => reps);
  }
  if (!/^\d{1,3}(\+\d{1,3})*$/.test(t)) return null;
  return t.split('+').map(Number);
}

/** Texto curto dos blocos: todos iguais → "3×4"; diferentes → "4+2"; sem blocos → vazio. */
export function textoDeBlocos(blocos: readonly number[] | null | undefined): string {
  if (!blocos || blocos.length === 0) return '';
  if (blocos.length >= 2 && blocos.every((b) => b === blocos[0])) return `${blocos.length}×${blocos[0]}`;
  return blocos.join('+');
}

/** O texto do "Digitar como texto": sempre um bloco por número, "5-5-5-5-5" (o "5×5" fica para o PDF e a técnica). */
export function textoDosBlocosParaDigitar(blocos: readonly number[] | null | undefined): string {
  return blocos?.join('-') ?? '';
}

/** Resumo abaixo dos blocos: "5 blocos · 25 reps por série"; `null` sem blocos que caibam no contrato. */
export function resumoDaLinhaDosBlocos(blocos: readonly (number | null)[] | null | undefined): string | null {
  const validos = blocosGravados(blocos);
  return validos ? `${validos.length} blocos · ${somaDosBlocos(validos)} reps por série` : null;
}

/** Reps da linha fechada da série: "5 × 5 (25)" com todos iguais, "4+4+2 (10)" com diferentes; sem blocos, vazio. */
export function textoDosBlocosNaLinha(blocos: readonly number[] | null | undefined): string {
  if (!blocos?.length) return '';
  const soma = somaDosBlocos(blocos);
  return blocosIguais(blocos) ? `${blocos.length} × ${blocos[0]} (${soma})` : `${blocos.join('+')} (${soma})`;
}

/** Todos os blocos com o mesmo número de repetições, e pelo menos dois. */
export function blocosIguais(blocos: readonly number[] | null | undefined): boolean {
  return !!blocos && blocos.length >= 2 && blocos.every((b) => b === blocos[0]);
}

/** Repetições da série de um cluster: a soma dos blocos; `null` sem blocos. */
export function somaDosBlocos(blocos: readonly number[] | null | undefined): number | null {
  if (!blocos || blocos.length === 0) return null;
  return blocos.reduce((soma, b) => soma + b, 0);
}

/**
 * O que pode ser gravado. Quantidade fora de 2 a 10, repetição fora de 1 a 50, vazio ou buraco devolvem `null`:
 * o campo inválido não reaproveita a lista anterior.
 */
export function blocosGravados(blocos: readonly (number | null)[] | null | undefined): number[] | null {
  if (!blocos || blocos.length === 0 || blocos.some((b) => b == null) || !blocosValidos(blocos as number[])) return null;
  return [...(blocos as number[])];
}

/**
 * Blocos iguais para gravar. Texto inválido (decimal, por exemplo) não pode reaproveitar o número que o campo
 * ainda guarda por baixo: enquanto um dos campos está inválido, a lista é `null`. Vazio deliberado também é `null`,
 * e continua sendo um padrão parcial válido.
 */
export function listaDeBlocosIguaisSeValidos(
  quantidade: number | null,
  reps: number | null,
  quantidadeInvalida: boolean,
  repsInvalidas: boolean,
): number[] | null {
  if (quantidadeInvalida || repsInvalidas) return null;
  return listaDeBlocosIguais(quantidade, reps);
}

/** Lista individual. Um bloco com texto inválido impede gravar, mesmo que os outros números estejam bons. */
export function blocosSeValidos(blocos: readonly (number | null)[] | null | undefined, algumInvalido: boolean): number[] | null {
  if (algumInvalido) return null;
  return blocosGravados(blocos);
}

/**
 * Ao entrar em "Blocos diferentes", os campos mostram a lista gravada. Sem lista válida, fica o rascunho da edição
 * (inclusive incompleto); uma conversão já gravada não reaparece como a distribuição anterior.
 */
export function rascunhoDoModoDiferente(
  valor: readonly number[] | null | undefined,
  rascunhoAtual: readonly (number | null)[],
): (number | null)[] {
  if (valor && blocosValidos(valor)) return [...valor];
  return [...rascunhoAtual];
}

/** Blocos iguais só quando os dois números cabem no contrato; senão `null`. */
export function listaDeBlocosIguais(quantidade: number | null, reps: number | null): number[] | null {
  if (quantidade == null || reps == null || !Number.isInteger(quantidade) || !Number.isInteger(reps)) return null;
  if (quantidade < MINIMO_DE_BLOCOS || quantidade > MAXIMO_DE_BLOCOS || reps < 1 || reps > MAXIMO_REPS_POR_BLOCO) return null;
  return Array.from({ length: quantidade }, () => reps);
}

/** De 2 a 10 blocos, cada um com 1 a 50 repetições inteiras (os limites do servidor). */
export function blocosValidos(blocos: readonly number[] | null | undefined): boolean {
  return (
    !!blocos &&
    blocos.length >= MINIMO_DE_BLOCOS &&
    blocos.length <= MAXIMO_DE_BLOCOS &&
    blocos.every((b) => Number.isInteger(b) && b >= 1 && b <= MAXIMO_REPS_POR_BLOCO)
  );
}

// ---- Edição dos blocos no editor (27/11) ----

/** Como os blocos aparecem: um campo só (todos com as mesmas repetições) ou um campo por bloco. */
export type ModoDosBlocos = 'iguais' | 'diferentes';

/** "Adicionar um bloco": entra no fim, com as repetições do último (a lista segue gravável); no máximo 10. */
export function maisUmBloco(blocos: readonly (number | null)[]): (number | null)[] {
  if (blocos.length >= MAXIMO_DE_BLOCOS) return [...blocos];
  return [...blocos, blocos.length ? blocos[blocos.length - 1] : null];
}

/** "Remover um bloco": sai o último; no mínimo 2. */
export function menosUmBloco(blocos: readonly (number | null)[]): (number | null)[] {
  return blocos.length <= MINIMO_DE_BLOCOS ? [...blocos] : blocos.slice(0, -1);
}

/** "Blocos iguais": as repetições do campo único valem para todos os blocos (a quantidade fica). */
export function comRepsIguais(blocos: readonly (number | null)[], reps: number | null): (number | null)[] {
  return blocos.map(() => reps);
}

/** Os campos dos blocos ao abrir: a lista gravada, ou dois blocos vazios (o mínimo) quando não há. */
export function rascunhoInicialDosBlocos(valor: readonly number[] | null | undefined): (number | null)[] {
  const lista: (number | null)[] = valor ? [...valor] : [];
  while (lista.length < MINIMO_DE_BLOCOS) lista.push(null);
  return lista;
}

/** O modo com que os blocos abrem: iguais com a lista toda igual (ou vazia), diferentes com repetições distintas. */
export function modoInicialDosBlocos(valor: readonly number[] | null | undefined): ModoDosBlocos {
  return !valor?.length || blocosIguais(valor) ? 'iguais' : 'diferentes';
}

/**
 * A lista que chegou de fora (desfazer, receita, notação digitada) no modo em que a pessoa está. A causa do defeito de
 * 27/11 era refazer o modo pelo formato da lista a cada mudança, inclusive as que o próprio campo gravou: "Adicionar um
 * bloco" em "Blocos diferentes" com 5+5+5+5 dava 5×5, o campo voltava para "Blocos iguais" e os blocos sumiam. Agora o
 * eco do que o campo gravou não mexe em nada (`publicado`), e lista de fora só sai de "iguais" quando não cabe nele.
 */
export function blocosQueChegaram(
  valor: readonly number[] | null | undefined,
  publicado: readonly number[] | null | undefined,
  modo: ModoDosBlocos,
): { mudou: false } | { mudou: true; rascunho: (number | null)[]; modo: ModoDosBlocos } {
  if (JSON.stringify(valor ?? null) === JSON.stringify(publicado ?? null)) return { mudou: false };
  // Lista vazia ou inválida vinda de fora não apaga o que a pessoa está digitando.
  if (!valor || !blocosValidos(valor)) return { mudou: false };
  return { mudou: true, rascunho: [...valor], modo: modo === 'iguais' && !blocosIguais(valor) ? 'diferentes' : modo };
}

// ---- Estado do campo dos blocos (redesenho da série aberta, 27/11) ----

/**
 * Tudo o que o campo dos blocos guarda. `invalidos` = índices com texto que não é número inteiro (o campo ainda mostra o
 * número antigo por baixo); `publicado` = o último que o campo mandou ao pai (para reconhecer o eco); `focar` = índice
 * do bloco que acabou de entrar, só até a ação seguinte (senão o autofoco dispara de novo ao trocar de modo).
 */
export interface EstadoDosBlocos {
  rascunho: (number | null)[];
  modo: ModoDosBlocos;
  invalidos: ReadonlySet<number>;
  publicado: number[] | null;
  texto: string;
  notacaoAberta: boolean;
  confirmar: boolean;
  focar: number | null;
}

export type AcaoDosBlocos =
  | { tipo: 'mais' }
  | { tipo: 'menos' }
  /** Nos iguais o campo é um só e o valor vale para todos (o índice é ignorado). */
  | { tipo: 'editar'; indice: number; valor: number | null }
  /** `aoValidade` do campo: `ok` falso marca o bloco inválido e publica `null`. */
  | { tipo: 'invalidar'; indice: number; ok: boolean }
  | { tipo: 'modo'; modo: ModoDosBlocos }
  /** Respostas do pedido de confirmação ao passar para "iguais" com blocos desiguais. */
  | { tipo: 'converterParaIguais' }
  | { tipo: 'manterDiferentes' }
  | { tipo: 'texto'; texto: string }
  | { tipo: 'alternarNotacao' }
  | { tipo: 'chegou'; valor: readonly number[] | null | undefined };

/** `gravar` ausente = nada a mandar ao pai; `null` = o campo ficou sem lista gravável. */
export interface ResultadoDosBlocos {
  estado: EstadoDosBlocos;
  gravar?: number[] | null;
}

export function estadoInicialDosBlocos(valor: readonly number[] | null | undefined): EstadoDosBlocos {
  return {
    rascunho: rascunhoInicialDosBlocos(valor),
    modo: modoInicialDosBlocos(valor),
    invalidos: new Set(),
    publicado: valor ? [...valor] : null,
    texto: textoDosBlocosParaDigitar(valor),
    notacaoAberta: false,
    confirmar: false,
    focar: null,
  };
}

/** A mesma semântica do `CampoBlocos` de 27/11, sem React: cada ação devolve o estado novo e o que publicar. */
export function reduzirBlocos(anterior: EstadoDosBlocos, acao: AcaoDosBlocos): ResultadoDosBlocos {
  // O eco do pai chega a cada render: devolve o mesmo objeto, inclusive o foco do bloco que ainda vai montar.
  if (acao.tipo === 'chegou') {
    const chegou = blocosQueChegaram(acao.valor, anterior.publicado, anterior.modo);
    if (!chegou.mudou) return { estado: anterior };
    const valor = [...acao.valor!];
    const texto = JSON.stringify(lerBlocos(anterior.texto)) === JSON.stringify(valor) ? anterior.texto : textoDosBlocosParaDigitar(valor);
    return { estado: { ...anterior, publicado: valor, rascunho: chegou.rascunho, modo: chegou.modo, invalidos: new Set(), confirmar: false, texto, focar: null } };
  }
  const estado = anterior.focar == null ? anterior : { ...anterior, focar: null };
  const publicar = (rascunho: (number | null)[], invalidos: ReadonlySet<number>, mudar: Partial<EstadoDosBlocos> = {}): ResultadoDosBlocos => {
    const gravar = blocosSeValidos(rascunho, invalidos.size > 0);
    return { estado: { ...estado, ...mudar, rascunho, invalidos, publicado: gravar, texto: gravar ? textoDosBlocosParaDigitar(gravar) : estado.texto }, gravar };
  };
  const semOIndice = (indice: number) => {
    const ainda = new Set(estado.invalidos);
    ainda.delete(indice);
    return ainda;
  };
  switch (acao.tipo) {
    case 'mais': {
      if (estado.invalidos.size > 0 || estado.rascunho.length >= MAXIMO_DE_BLOCOS) return { estado };
      const proximo = maisUmBloco(estado.rascunho);
      return publicar(proximo, estado.invalidos, { focar: estado.modo === 'diferentes' ? proximo.length - 1 : null });
    }
    case 'menos':
      if (estado.rascunho.length <= MINIMO_DE_BLOCOS) return { estado };
      return publicar(menosUmBloco(estado.rascunho), semOIndice(estado.rascunho.length - 1));
    case 'editar':
      if (estado.modo === 'iguais') return publicar(comRepsIguais(estado.rascunho, acao.valor), new Set());
      return publicar(estado.rascunho.map((r, i) => (i === acao.indice ? acao.valor : r)), semOIndice(acao.indice));
    case 'invalidar':
      if (acao.ok) return { estado };
      return { estado: { ...estado, invalidos: new Set(estado.invalidos).add(acao.indice), publicado: null }, gravar: null };
    case 'modo': {
      if (acao.modo === estado.modo) return { estado };
      const preenchidos = estado.rascunho.filter((r): r is number => r != null);
      if (acao.modo === 'iguais' && preenchidos.length > 0 && !blocosIguais(preenchidos)) return { estado: { ...estado, confirmar: true } };
      // O texto inválido é do campo do modo que sai: trocar o limpa e volta a gravar o rascunho (o + não fica travado).
      if (estado.invalidos.size > 0) return publicar(estado.rascunho, new Set(), { modo: acao.modo, confirmar: false });
      return { estado: { ...estado, modo: acao.modo, confirmar: false } };
    }
    case 'converterParaIguais':
      return publicar(comRepsIguais(estado.rascunho, estado.rascunho.find((r) => r != null) ?? null), new Set(), { modo: 'iguais', confirmar: false });
    case 'manterDiferentes':
      return { estado: { ...estado, confirmar: false } };
    case 'texto': {
      const lidos = lerBlocos(acao.texto);
      const gravar = blocosSeValidos(lidos, false);
      const cabe = !!lidos && lidos.length >= MINIMO_DE_BLOCOS && lidos.length <= MAXIMO_DE_BLOCOS;
      const campos: Partial<EstadoDosBlocos> = cabe
        ? { rascunho: lidos, invalidos: new Set(), confirmar: false, modo: blocosIguais(lidos) ? estado.modo : 'diferentes' }
        : {};
      return { estado: { ...estado, ...campos, texto: acao.texto, publicado: gravar }, gravar };
    }
    case 'alternarNotacao':
      return { estado: { ...estado, notacaoAberta: !estado.notacaoAberta } };
  }
}
