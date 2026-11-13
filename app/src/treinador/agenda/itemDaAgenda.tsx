import { router } from 'expo-router';
import { Ban, CalendarClock, CircleAlert, CircleCheck, type LucideIcon, TriangleAlert, UserX } from 'lucide-react-native';
import { type GestureResponderEvent, Platform, StyleSheet, View } from 'react-native';

import type { CorDaAgenda, SituacaoCompromisso } from '../../api/agendaTipos';
import type { ItemDoCalendario } from '../../dominio/agendaCalendario';
import { horarioNoRotuloDoCompromisso, LARGURA_DA_FAIXA, statusNoRotuloDoCompromisso } from '../../dominio/agendaLegivel';
import { nomesPorExtenso, seloDaSituacao, seloDoCompromisso, situacaoDoCompromisso } from '../../dominio/agendaPresencial';
import { caminhoAtualizacaoTreinador, statusAtualizacaoTreinador } from '../../dominio/atualizacao';
import { dataSemAnoCorrente } from '../../dominio/datasRelativas';
import { useTema } from '../../tema/TemaProvider';
import { corDaAgenda } from '../../tema/tokens';
import { propsDeLink } from '../../ui/propsDeLink';
import type { TipoSelo } from '../../ui/Selo';

/**
 * O que a tela faz ao tocar num item: o resumo do compromisso ou a folha do evento (a atualização é link e vai à ficha).
 * `origem` é o elemento tocado (só na web): o resumo se ancora nele e o foco volta para ele.
 */
export type AoAbrirItem = (item: ItemDoCalendario, origem?: HTMLElement | null) => void;

/**
 * O elemento do item tocado, na web. No clique o `currentTarget` é o próprio item; no Enter/Espaço o react-native-web
 * entrega o evento do documento, e o item é o que está com o foco.
 */
export function elementoDoToque(e: GestureResponderEvent | undefined): HTMLElement | null {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  const alvo = (e as unknown as { currentTarget?: unknown } | undefined)?.currentTarget;
  if (alvo instanceof HTMLElement) return alvo;
  return document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
}

/** "09:00–10:00", "Dia inteiro" ou, na atualização, "Atualização". */
export function horarioDoItem(item: ItemDoCalendario): string {
  const f = item.fonte;
  if (f.origem === 'ATUALIZACAO') return 'Atualização';
  if (item.diaInteiro) return 'Dia inteiro';
  if (f.origem === 'COMPROMISSO') return `${f.compromisso.hora}–${f.compromisso.horaFim}`;
  return `${f.ocorrencia.hora ?? ''}–${f.ocorrencia.horaFim ?? ''}`;
}

/**
 * Nome do item para o leitor de tela. O do compromisso diz o início e o fim ("Abrir compromisso de Ana, das 15h às 16h"), em
 * qualquer visão, com o status no fim quando não é "todos agendados" (", cancelado", ", realizado", ", 1 faltou"): no bloco
 * curto o status é só ícone e o nome é quem o diz. O evento diz o título e a hora; a atualização, o aluno, o dia e o selo
 * quando ele diz algo a mais.
 */
export function rotuloDoItem(item: ItemDoCalendario, hoje: string): string {
  const f = item.fonte;
  if (f.origem === 'COMPROMISSO') {
    const c = f.compromisso;
    return `Abrir compromisso de ${nomesPorExtenso(c)}, ${horarioNoRotuloDoCompromisso(c.hora, c.horaFim)}${statusNoRotuloDoCompromisso(c)}`;
  }
  if (f.origem === 'EVENTO') return `Abrir evento ${item.titulo}, ${item.diaInteiro ? 'dia inteiro' : f.ocorrencia.hora ?? ''}${item.cancelado ? ', cancelado' : ''}`;
  const selo = seloDaAtualizacaoNaAgenda(f.atualizacao, hoje);
  return `Abrir atualização de ${item.titulo}, ${dataSemAnoCorrente(item.data, hoje)}${selo ? `, ${selo.curto}` : ''}`;
}

/**
 * Selo da atualização na agenda, ou `null` quando não diz nada além do dia ("Hoje", "Em 3 dias": o dia já está no item).
 * "Adiada para 21/10" é neutro desde a auditoria das cores (#70), mas diz algo a mais e continua aparecendo.
 */
export function seloDaAtualizacaoNaAgenda(a: Parameters<typeof statusAtualizacaoTreinador>[0], hoje: string) {
  const s = statusAtualizacaoTreinador(a, hoje);
  // "Revisada" é neutra (informativa) desde 11/11, mas diz algo além do dia: continua aparecendo, com o ✓.
  if (a.fase === 'REVISADA') return { ...s, Icone: CircleCheck };
  return s.tipo === 'neutro' && !a.atrasoAte ? null : { ...s, Icone: ICONE_DO_TOM[s.tipo] };
}

/** Selo da agenda: o texto e o tom de sempre, com o ícone (status sempre com texto e ícone; a cor nunca fala sozinha). */
export interface SeloDaAgenda { texto: string; tipo: TipoSelo; Icone: LucideIcon }

/** Ícone de cada situação do compromisso (o mesmo em todas as visões e na folha). */
const ICONE_DA_SITUACAO: Record<SituacaoCompromisso, LucideIcon> = {
  AGENDADO: CalendarClock, REALIZADO: CircleCheck, FALTOU: UserX, CANCELADO: Ban,
};
/** Ícone pelo tom, para o selo da atualização (o mesmo da lista de alunos). */
const ICONE_DO_TOM: Record<TipoSelo, LucideIcon> = { sucesso: CircleCheck, atencao: TriangleAlert, perigo: CircleAlert, neutro: CalendarClock };

/** Ícone pelo tom do selo (atrasadas, atualização). */
export const iconeDoTom = (tipo: TipoSelo): LucideIcon => ICONE_DO_TOM[tipo];

/** Selo de um participante: a situação dele, com o ícone. */
export function seloDoParticipante(situacao: SituacaoCompromisso): SeloDaAgenda {
  return { ...seloDaSituacao(situacao), Icone: ICONE_DA_SITUACAO[situacao] ?? CalendarClock };
}

/** Selo do compromisso inteiro ("2 agendados · 1 de 3 realizados"), com o ícone da situação que manda no tom. */
export function seloDoCompromissoComIcone(c: Parameters<typeof seloDoCompromisso>[0]): SeloDaAgenda {
  return { ...seloDoCompromisso(c), Icone: ICONE_DA_SITUACAO[situacaoDoCompromisso(c)] ?? CalendarClock };
}

/** O selo de status do item: a situação do compromisso, ou o da atualização quando diz algo além do dia. Evento não tem. */
export function seloDoItem(item: ItemDoCalendario, hoje: string): SeloDaAgenda | null {
  const f = item.fonte;
  if (f.origem === 'COMPROMISSO') return seloDoCompromissoComIcone(f.compromisso);
  if (f.origem === 'ATUALIZACAO') {
    const s = seloDaAtualizacaoNaAgenda(f.atualizacao, hoje);
    return s ? { texto: s.curto, tipo: s.tipo, Icone: s.Icone } : null;
  }
  return null;
}

/**
 * O status curto do item na grade (bloco e dia inteiro): a palavra da situação do compromisso ("Cancelado", "Realizado";
 * o resumo por aluno, que pode ser longo, fica na lista, no nome acessível e na folha), o selo da atualização quando não é
 * neutro e "Cancelado" em qualquer item cancelado. Evento sem status: `null`.
 */
export function seloCurtoDoItem(item: ItemDoCalendario, hoje: string): SeloDaAgenda | null {
  const f = item.fonte;
  if (f.origem === 'COMPROMISSO') return seloDoParticipante(situacaoDoCompromisso(f.compromisso));
  if (item.cancelado) return seloDoParticipante('CANCELADO');
  return seloDoItem(item, hoje);
}

/**
 * Props de toque do item: a atualização vira link (na web, `<a href>` que abre em nova guia) para a ficha, na fila das
 * próximas; os outros chamam `aoAbrir` (folha).
 */
export function toqueDoItem(item: ItemDoCalendario, meus: boolean, aoAbrir: AoAbrirItem) {
  const f = item.fonte;
  if (f.origem === 'ATUALIZACAO') {
    const href = caminhoAtualizacaoTreinador(f.atualizacao, { situacao: 'PROXIMAS', meus });
    return { accessibilityRole: 'link' as const, ...propsDeLink(href, () => router.push(href)) };
  }
  return { accessibilityRole: 'button' as const, onPress: (e?: GestureResponderEvent) => aoAbrir(item, elementoDoToque(e)) };
}

/** A cor da agenda no tema em uso (o marcador; o texto do item fica na cor do texto). */
export function useCorDaAgenda() {
  const { modo } = useTema();
  return (cor: CorDaAgenda | string) => corDaAgenda(cor, modo === 'ESCURO');
}

/**
 * Fundo e contorno do item na grade (bloco e dia inteiro), sempre neutros: a cor da agenda fica só na faixa de 8 px
 * (guia de 11/11, "cor como sinal"). Hover = `superficie3`; o item aberto na folha ganha também o contorno forte
 * (`bordaCampo`), que o separa do hover. A faixa ≥ 3:1 sobre as duas superfícies está em `contrasteDaAgenda.test.ts`.
 */
export function useCoresDoItem() {
  const { cores } = useTema();
  return (aceso: boolean, escolhido: boolean) => ({
    backgroundColor: aceso || escolhido ? cores.superficie3 : cores.superficie2,
    borderColor: escolhido ? cores.bordaCampo : cores.borda,
  });
}

/** O status só em ícone (bloco curto ou coluna estreita): decorativo, porque o nome acessível do item já o diz. */
export function IconeDoStatus({ selo }: { selo: SeloDaAgenda }) {
  const { cores } = useTema();
  const { Icone } = selo;
  return <View aria-hidden importantForAccessibility="no-hide-descendants" style={estilos.icone}>
    <Icone size={14} color={cores[selo.tipo]} strokeWidth={2.5} />
  </View>;
}

/**
 * Marcador de cor da agenda: ponto (mês, folha do evento) ou faixa (a linha da lista, com a largura da faixa da grade).
 * Decorativo: a agenda vai no texto ou no rótulo.
 */
export function MarcadorDaAgenda({ cor, forma = 'ponto' }: { cor: CorDaAgenda | string; forma?: 'ponto' | 'faixa' }) {
  const corDe = useCorDaAgenda();
  return <View aria-hidden importantForAccessibility="no-hide-descendants"
    style={[forma === 'ponto' ? estilos.ponto : estilos.faixa, { backgroundColor: corDe(cor) }]} />;
}

const estilos = StyleSheet.create({
  ponto: { width: 10, height: 10, borderRadius: 5 },
  // Altura fixa: a linha da lista centraliza o `inicio`, então `stretch` deixaria a faixa sem altura.
  faixa: { width: LARGURA_DA_FAIXA, height: 40, borderRadius: 4 },
  icone: { flexShrink: 0 },
});
