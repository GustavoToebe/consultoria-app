import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { tituloDoCalendario, type VisaoDoCalendario } from '../../dominio/agendaCalendario';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { IconeBotao } from '../../ui/IconeBotao';
import { Texto } from '../../ui/Texto';
import { MenuDaVisao } from './MenuDaVisao';

const ANTERIOR: Record<VisaoDoCalendario, string> = { dia: 'Dia anterior', semana: 'Semana anterior', mes: 'Mês anterior', ano: 'Ano anterior' };
const PROXIMO: Record<VisaoDoCalendario, string> = { dia: 'Próximo dia', semana: 'Próxima semana', mes: 'Próximo mês', ano: 'Próximo ano' };

interface Props {
  visao: VisaoDoCalendario;
  data: string;
  aoMudarVisao: (v: VisaoDoCalendario) => void;
  aoDeslocar: (sentido: 1 | -1) => void;
  aoHoje: () => void;
  /** Avisa a tela que o menu da visão está aberto (os atalhos de teclado esperam ele fechar). */
  aoMudarMenuAberto?: (aberto: boolean) => void;
  /** À direita, depois do "Mês ▾" (o "Agendas e filtros" do celular). */
  extra?: ReactNode;
}

/**
 * Barra do topo do calendário, como no Google Agenda, numa linha reta: "Hoje", setas e o título do período (h2, anunciado
 * ao mudar) à esquerda; o botão da visão ("Mês ▾", com menu) à direita. O "Hoje" fica sempre habilitado (tocar já estando no
 * período não muda nada), para a linha não ganhar texto embaixo. No celular estreito a direita desce para outra linha, e o
 * grupo da esquerda continua alinhado pelo centro. As setas e o "Hoje" trocam a data sem empilhar passos; trocar a visão
 * empilha (quem chama decide).
 */
export function BarraDoCalendario({ visao, data, aoMudarVisao, aoDeslocar, aoHoje, aoMudarMenuAberto, extra }: Props) {
  const bruto = tituloDoCalendario(visao, data);
  // "outubro de 2026" vira "Outubro de 2026" (só a primeira letra: o "de" fica minúsculo).
  const titulo = bruto.charAt(0).toUpperCase() + bruto.slice(1);
  return (
    <View style={estilos.barra}>
      <View style={estilos.periodo}>
        <Botao rotulo="Hoje" tipo="secundario" aoTocar={aoHoje} style={estilos.centro} />
        <View style={estilos.setas}>
          <IconeBotao Icone={ChevronLeft} rotulo={ANTERIOR[visao]} aoTocar={() => aoDeslocar(-1)} moldura />
          <IconeBotao Icone={ChevronRight} rotulo={PROXIMO[visao]} aoTocar={() => aoDeslocar(1)} moldura />
        </View>
        <View style={estilos.titulo} accessibilityLiveRegion="polite" aria-live="polite">
          <Texto variante="titulo" nivel={2} numerico numberOfLines={2}>{titulo}</Texto>
        </View>
      </View>
      <View style={estilos.direita}>
        <MenuDaVisao visao={visao} aoMudar={aoMudarVisao} aoMudarAberto={aoMudarMenuAberto} />
        {extra}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: espaco(2), rowGap: espaco(1.5) },
  // O grupo não quebra por dentro: o título encolhe (até duas linhas) e os botões ficam na mesma linha que ele.
  periodo: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexGrow: 1, flexShrink: 1, flexBasis: 280, minWidth: 0 },
  setas: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  titulo: { flexShrink: 1, minWidth: 0 },
  // O `Botao` nasce com `alignSelf: flex-start`; aqui ele acompanha o centro das setas e do título.
  centro: { alignSelf: 'center' },
  direita: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1), marginLeft: 'auto' },
});
