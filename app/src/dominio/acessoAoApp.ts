import type { AlunoDetalhe } from '../api/tipos';
import { dataEmBrasilia, hojeEmBrasilia, horaEmBrasilia } from './agendaPresencial';
import { dataSemAnoCorrente } from './datasRelativas';
import { dataParaTela } from './formatos';

/**
 * Linha do último login no cartão Acesso ao app (24/11; plano `docs/planos/ficha-acesso-ao-app.md`). O rótulo segue a
 * regra da ficha: `LOGIN` é "Último login" e só `ACESSO` é "Último acesso ao app" (login nunca é chamado de acesso). O
 * texto é curto, no fuso de Brasília qualquer que seja o do aparelho: "Hoje, 18:38", "Ontem, 18:38", senão "17/10 18:38"
 * (com o ano só se for outro). A data completa vai na dica. Nunca entrou, instante malformado ou tipo desconhecido: rótulo
 * "Último login" e texto `null` (a linha mostra "—").
 */
export function ultimoLoginNaLinha(
  u: AlunoDetalhe['ultimoAcesso'], agora: Date = new Date(),
): { rotulo: string; texto: string | null; exata: string | null } {
  const rotulo = u?.tipo === 'ACESSO' ? 'Último acesso ao app' : 'Último login';
  if (!u?.em || Number.isNaN(Date.parse(u.em)) || (u.tipo !== 'LOGIN' && u.tipo !== 'ACESSO')) return { rotulo: 'Último login', texto: null, exata: null };
  const dia = dataEmBrasilia(u.em);
  const hoje = hojeEmBrasilia(agora);
  const hora = horaEmBrasilia(u.em);
  const dias = Math.round((Date.parse(dia) - Date.parse(hoje)) / 86_400_000);
  const texto = dias === 0 ? `Hoje, ${hora}` : dias === -1 ? `Ontem, ${hora}` : `${dataSemAnoCorrente(dia, hoje)} ${hora}`;
  return { rotulo, texto, exata: `${dataParaTela(dia)} às ${hora}` };
}
