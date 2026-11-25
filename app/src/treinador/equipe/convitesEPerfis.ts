import type { MembroEquipe, PerfilEquipe } from '../../api/equipeTipos';
import { dataRelativa } from '../../dominio/datasRelativas';
import { hojeIso, SEM_DADO } from '../../dominio/formatos';

/**
 * Regras da coluna ao lado dos Membros (tela larga, 24/11): convites pendentes e a contagem por perfil. Funções puras.
 *
 * shortcut: a API não manda quando o convite foi enviado; ele vale 7 dias desde o envio (`EquipeService.convidar`, também
 * no Renovar), então o envio é `conviteExpiraEm − 7 dias`. Trocar quando a lista trouxer a data de criação do convite.
 */
export const VALIDADE_DO_CONVITE_EM_DIAS = 7;
const DIA = 86_400_000;

/** "Enviado hoje", "Enviado há 3 dias", "Enviado em 12/10"; o vencido (a lista também traz) ganha "· vencido". */
export function textoDoEnvio(expiraEm: string | null, agora: Date = new Date()): string {
  const expira = expiraEm ? new Date(expiraEm) : null;
  if (!expira || Number.isNaN(expira.getTime())) return SEM_DADO;
  const enviado = new Date(expira.getTime() - VALIDADE_DO_CONVITE_EM_DIAS * DIA);
  const relativo = dataRelativa(hojeIso(enviado), hojeIso(agora));
  const envio = /^(hoje|ontem|há )/.test(relativo) ? `Enviado ${relativo}` : `Enviado em ${relativo}`;
  return expira.getTime() <= agora.getTime() ? `${envio} · vencido` : envio;
}

/** Os membros de verdade (sem os convites pendentes): a base da tabela e da contagem por perfil na tela larga. */
export const semConvites = <T extends Pick<MembroEquipe, 'convitePendente'>>(membros: readonly T[]): T[] => membros.filter((m) => !m.convitePendente);

/** Cada perfil com quantos membros (sem convites) o usam: o mesmo número que a tabela mostra ao filtrar por ele. */
export function contagemPorPerfil(perfis: readonly PerfilEquipe[], membros: readonly Pick<MembroEquipe, 'perfilId' | 'convitePendente'>[]): { perfil: PerfilEquipe; total: number }[] {
  const base = semConvites(membros);
  return perfis.map((perfil) => ({ perfil, total: base.filter((m) => m.perfilId === perfil.id).length }));
}
