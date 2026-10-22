import { semAcento } from './telas';

/**
 * Tipo da série (para que ela serve, segundo a metodologia: aquecimento, FS, WS, back off…) não é técnica (como executar:
 * cluster, rest pause, drop-set…, que mora em `Serie.tecnica`) nem combinação de exercícios (superset, circuito…, que
 * mora no grupo da sessão). Cada tipo tem um CÓDIGO estável, gerado do nome na criação e imutável. Espelho de
 * `ConfiguracaoConsultoria` na API: mudou lá, mude aqui.
 */
export const NOMES_DE_TECNICA: readonly string[] = [
  'cluster',
  'rest pause',
  'restpause',
  'drop set',
  'dropset',
  'myo reps',
  'myoreps',
  'partial reps',
  'partialreps',
  'forced reps',
  'forcedreps',
];

export const NOMES_DE_COMBINACAO: readonly string[] = [
  'superset',
  'super set',
  'agonista antagonista',
  'agonistaantagonista',
  'tri set',
  'triset',
  'giant set',
  'giantset',
  'circuito',
  'pre exaustao',
  'preexaustao',
  'pos exaustao',
  'posexaustao',
];

/** Tamanho máximo do nome de um tipo, de uma técnica ou de uma combinação. */
export const MAXIMO_DO_NOME = 30;

/** Código de um tipo: letras maiúsculas, dígitos e sublinhado, de 1 a 30 (o mesmo padrão da API). */
export const MAXIMO_DO_CODIGO = 30;
const PADRAO_DO_CODIGO = /^[A-Z0-9_]{1,30}$/;

export function codigoValido(codigo: string | null | undefined): boolean {
  return !!codigo && PADRAO_DO_CODIGO.test(codigo);
}

/**
 * Código a partir do nome, na criação do tipo: sem acento, maiúsculas, o que não é letra nem dígito vira sublinhado
 * (sem repetir nem nas pontas), até 30 letras. Nome sem nenhuma letra ou dígito dá `TIPO`.
 */
export function codigoDoNome(nome: string): string {
  const base = semAcento(nome)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAXIMO_DO_CODIGO)
    .replace(/_+$/g, '');
  return base || 'TIPO';
}

/**
 * Código novo e único entre os existentes: o do nome e, se já existir, com sufixo `_2`, `_3`... (o nome encurta para
 * caber em 30). É gerado uma vez, na criação; depois o código não muda, mesmo que o nome mude.
 */
export function codigoDoNovoTipo(nome: string, existentes: Iterable<string>): string {
  const usados = new Set(existentes);
  const base = codigoDoNome(nome);
  if (!usados.has(base)) return base;
  for (let n = 2; ; n++) {
    const sufixo = `_${n}`;
    const candidato = base.slice(0, MAXIMO_DO_CODIGO - sufixo.length).replace(/_+$/g, '') + sufixo;
    if (!usados.has(candidato)) return candidato;
  }
}

/** Chave de comparação de um nome de tipo: sem acento, minúsculas, hífen/travessão/NBSP viram espaço, espaços colapsados (igual à API). */
export function chaveDeTipo(nome: string): string {
  return semAcento(nome.replace(/[-–—  ]/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** "Cluster", "Rest-pause", "Myo reps"… são técnicas da série, não tipos. */
export function nomeDeTecnica(nome: string): boolean {
  return NOMES_DE_TECNICA.includes(chaveDeTipo(nome));
}

/** "Superset", "Circuito", "Pré-exaustão"… são combinações de exercícios, não tipos. */
export function nomeDeCombinacao(nome: string): boolean {
  return NOMES_DE_COMBINACAO.includes(chaveDeTipo(nome));
}

/** Mesmo texto da recusa da API (`ConfiguracaoConsultoria.validarComoMetodologia`). */
export function mensagemTipoETecnica(nome: string): string {
  return `"${nome.trim()}" é uma técnica, não um tipo de série: escolha a técnica na própria série.`;
}

/** Mesmo texto da recusa da API (`ConfiguracaoConsultoria.validarComoMetodologia`). */
export function mensagemTipoECombinacao(nome: string): string {
  return `"${nome.trim()}" é uma combinação de exercícios, não um tipo de série: use o grupo da sessão.`;
}
