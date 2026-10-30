import { router } from 'expo-router';
import { Ban, CalendarClock, CircleAlert, CircleCheck, type LucideIcon, TriangleAlert, UserX } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { CorDaAgenda, SituacaoCompromisso } from '../../api/agendaTipos';
import type { ItemDoCalendario } from '../../dominio/agendaCalendario';
import { nomesPorExtenso, seloDaSituacao, seloDoCompromisso, situacaoDoCompromisso } from '../../dominio/agendaPresencial';
import { caminhoAtualizacaoTreinador, statusAtualizacaoTreinador } from '../../dominio/atualizacao';
import { dataSemAnoCorrente } from '../../dominio/datasRelativas';
import { useTema } from '../../tema/TemaProvider';
import { corDaAgenda } from '../../tema/tokens';
import { propsDeLink } from '../../ui/propsDeLink';
import type { TipoSelo } from '../../ui/Selo';

/** O que a tela faz ao tocar num item: abre a folha do compromisso ou do evento (a atualização é link e vai à ficha). */
export type AoAbrirItem = (item: ItemDoCalendario) => void;

/** "09:00–10:00", "Dia inteiro" ou, na atualização, "Atualização". */
export function horarioDoItem(item: ItemDoCalendario): string {
  const f = item.fonte;
  if (f.origem === 'ATUALIZACAO') return 'Atualização';
  if (item.diaInteiro) return 'Dia inteiro';
  if (f.origem === 'COMPROMISSO') return `${f.compromisso.hora}–${f.compromisso.horaFim}`;
  return `${f.ocorrencia.hora ?? ''}–${f.ocorrencia.horaFim ?? ''}`;
}

/**
 * Nome do item para o leitor de tela. O do compromisso é o mesmo da lista de antes ("Abrir compromisso de Ana, 15:00"), em
 * qualquer visão; o evento diz o título e a hora; a atualização, o aluno, o dia e o selo quando ele diz algo a mais.
 */
export function rotuloDoItem(item: ItemDoCalendario, hoje: string): string {
  const f = item.fonte;
  if (f.origem === 'COMPROMISSO') {
    const c = f.compromisso;
    return `Abrir compromisso de ${nomesPorExtenso(c)}, ${c.hora}${item.cancelado ? ', cancelado' : ''}`;
  }
  if (f.origem === 'EVENTO') return `Abrir evento ${item.titulo}, ${item.diaInteiro ? 'dia inteiro' : f.ocorrencia.hora ?? ''}`;
  const selo = statusAtualizacaoTreinador(f.atualizacao, hoje);
  return `Abrir atualização de ${item.titulo}, ${dataSemAnoCorrente(item.data, hoje)}${selo.tipo === 'neutro' ? '' : `, ${selo.curto}`}`;
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

/** O selo de status do item: a situação do compromisso, ou o da atualização quando não é neutro. Evento não tem. */
export function seloDoItem(item: ItemDoCalendario, hoje: string): SeloDaAgenda | null {
  const f = item.fonte;
  if (f.origem === 'COMPROMISSO') return seloDoCompromissoComIcone(f.compromisso);
  if (f.origem === 'ATUALIZACAO') {
    const s = statusAtualizacaoTreinador(f.atualizacao, hoje);
    return s.tipo === 'neutro' ? null : { texto: s.curto, tipo: s.tipo, Icone: ICONE_DO_TOM[s.tipo] };
  }
  return null;
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
  return { accessibilityRole: 'button' as const, onPress: () => aoAbrir(item) };
}

/** A cor da agenda no tema em uso (o marcador; o texto do item fica na cor do texto). */
export function useCorDaAgenda() {
  const { modo } = useTema();
  return (cor: CorDaAgenda | string) => corDaAgenda(cor, modo === 'ESCURO');
}

/** Marcador de cor da agenda: ponto (lista, mês) ou barra (grade). Decorativo: a agenda vai no texto ou no rótulo. */
export function MarcadorDaAgenda({ cor, forma = 'ponto' }: { cor: CorDaAgenda | string; forma?: 'ponto' | 'barra' }) {
  const corDe = useCorDaAgenda();
  return <View aria-hidden importantForAccessibility="no-hide-descendants"
    style={[forma === 'ponto' ? estilos.ponto : estilos.barra, { backgroundColor: corDe(cor) }]} />;
}

const estilos = StyleSheet.create({
  ponto: { width: 10, height: 10, borderRadius: 5 },
  barra: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
});
