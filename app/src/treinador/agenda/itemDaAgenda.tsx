import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { CorDaAgenda } from '../../api/agendaTipos';
import type { ItemDoCalendario } from '../../dominio/agendaCalendario';
import { nomesPorExtenso, seloDoCompromisso } from '../../dominio/agendaPresencial';
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

/** O selo de status do item: a situação do compromisso, ou o da atualização quando não é neutro. Evento não tem. */
export function seloDoItem(item: ItemDoCalendario, hoje: string): { texto: string; tipo: TipoSelo } | null {
  const f = item.fonte;
  if (f.origem === 'COMPROMISSO') return seloDoCompromisso(f.compromisso);
  if (f.origem === 'ATUALIZACAO') {
    const s = statusAtualizacaoTreinador(f.atualizacao, hoje);
    return s.tipo === 'neutro' ? null : { texto: s.curto, tipo: s.tipo };
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
