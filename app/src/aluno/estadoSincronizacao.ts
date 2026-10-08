import type { EstadoEnvio } from '../offline/AlunoProvider';
import type { TipoSelo } from '../ui/Selo';

export function estadoSincronizacao(p: { pendentes: number; falhas: number; envio: EstadoEnvio; online: boolean }): { texto: string; tipo: TipoSelo; pulsar: boolean; tentar: boolean } {
  if (p.falhas || p.envio === 'erro') return { texto: 'Falha ao enviar — tentar de novo', tipo: 'perigo', pulsar: false, tentar: true };
  if (!p.online || p.envio === 'semConexao') return { texto: p.pendentes ? `Sem conexão — ${p.pendentes} salvo(s) no aparelho` : 'Sem conexão — salvo no aparelho', tipo: 'neutro', pulsar: false, tentar: false };
  if (p.envio === 'enviando') return { texto: 'Enviando…', tipo: 'neutro', pulsar: true, tentar: false };
  if (p.pendentes) return { texto: `${p.pendentes} aguardando envio`, tipo: 'atencao', pulsar: false, tentar: false };
  return { texto: 'Sincronizado', tipo: 'sucesso', pulsar: false, tentar: false };
}
