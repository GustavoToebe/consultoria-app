import type { PacoteSalvo } from './repositorioLocal';
type Objeto = Record<string, unknown>;
const objeto = (v: unknown): v is Objeto => !!v && typeof v === 'object' && !Array.isArray(v);
const numero = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v));
const campos = (v: Objeto, permitidos: string[]) => Object.keys(v).every((k) => permitidos.includes(k));
const lista = (v: unknown, conferir: (x: unknown) => boolean) => Array.isArray(v) && v.every(conferir);
function intensidade(v: unknown): boolean {
  return v == null || (objeto(v) && campos(v, ['modo', 'percentualMin', 'percentualMax', 'rpe', 'rir']) &&
    ['CARGA_TRABALHO', 'PERCENTUAL_WS', 'ACIMA_DA_ANTERIOR', 'MESMA_CARGA', 'RPE', 'NENHUMA'].includes(String(v.modo)) &&
    ['percentualMin', 'percentualMax', 'rpe', 'rir'].every((k) => v[k] === undefined || numero(v[k])));
}
function tecnica(v: unknown): boolean {
  return v == null || (objeto(v) && campos(v, ['tipo', 'pausaSegundos', 'pausaRespiracoes', 'pausas', 'blocos', 'quedas', 'reducaoPercentual', 'repsPorQueda']) &&
    ['REST_PAUSE', 'CLUSTER', 'DROP_SET'].includes(String(v.tipo)) &&
    (v.blocos == null || lista(v.blocos, (b) => typeof b === 'number' && Number.isFinite(b))) &&
    ['pausaSegundos', 'pausaRespiracoes', 'pausas', 'quedas', 'reducaoPercentual', 'repsPorQueda'].every((k) => v[k] === undefined || numero(v[k])));
}
function metodologia(v: unknown): boolean {
  return objeto(v) && lista(v.tipos, (t) => objeto(t) && typeof t.nome === 'string' &&
    ['AQUECIMENTO', 'PREPARACAO', 'TRABALHO', 'POS_TRABALHO', 'OUTRO'].includes(String(t.papel)) && intensidade(t.intensidadePadrao)) &&
    lista(v.tecnicas, (t) => objeto(t) && typeof t.nome === 'string' && tecnica(t.padrao));
}
function serie(v: unknown): boolean {
  return objeto(v) && campos(v, ['uid', 'tipo', 'repsMin', 'repsMax', 'intensidade', 'descansoSegundos', 'tecnica']) &&
    typeof v.uid === 'string' && (v.tipo === null || typeof v.tipo === 'string') && numero(v.repsMin) && numero(v.repsMax) &&
    intensidade(v.intensidade) && tecnica(v.tecnica);
}
/** Aceita somente a estrutura atual. Pacote ilegível é descartado, sem conversão e sem apagar a fila. */
export function pacoteNoFormatoAtual(v: unknown): v is PacoteSalvo {
  if (!objeto(v) || typeof v.salvoEm !== 'string' || !objeto(v.pacote)) return false;
  const p = v.pacote;
  if (!objeto(p.configuracao) || typeof p.configuracao.tipoTrabalho !== 'string' || typeof p.configuracao.arredondamentoKg !== 'number') return false;
  if (p.treino === null) return true;
  if (!objeto(p.treino) || !objeto(p.treino.conteudo)) return false;
  const c = p.treino.conteudo;
  return (c.metodologia == null || (objeto(c.metodologia) && metodologia(c.metodologia.configuracao))) &&
    lista(c.sessoes, (s) => objeto(s) && lista(s.exercicios, (e) => objeto(e) && lista(e.series, serie)));
}
