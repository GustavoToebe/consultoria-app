import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ROTULOS_DAS_VISOES, tituloDoCalendario, VISOES_DO_CALENDARIO, type VisaoDoCalendario } from '../../dominio/agendaCalendario';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Escolha } from '../../ui/Escolha';
import { IconeBotao } from '../../ui/IconeBotao';
import { Texto } from '../../ui/Texto';

const ANTERIOR: Record<VisaoDoCalendario, string> = { dia: 'Dia anterior', semana: 'Semana anterior', mes: 'Mês anterior', ano: 'Ano anterior' };
const PROXIMO: Record<VisaoDoCalendario, string> = { dia: 'Próximo dia', semana: 'Próxima semana', mes: 'Próximo mês', ano: 'Próximo ano' };

interface Props {
  visao: VisaoDoCalendario;
  data: string;
  /** A data aberta já está no período de hoje: o "Hoje" fica desabilitado, com o motivo. */
  noPeriodoDeHoje: boolean;
  aoMudarVisao: (v: VisaoDoCalendario) => void;
  aoDeslocar: (sentido: 1 | -1) => void;
  aoHoje: () => void;
  /** À direita da linha das visões (o "Agendas e filtros" do celular). */
  extra?: ReactNode;
}

/**
 * Barra do topo do calendário, como no Google Agenda: "Hoje", setas e o título do período (h2, anunciado ao mudar) numa
 * linha; o seletor Dia/Semana/Mês/Ano em botões (seleção invertida) na outra. As setas e o "Hoje" trocam a data sem
 * empilhar passos; trocar a visão empilha (quem chama decide).
 */
export function BarraDoCalendario({ visao, data, noPeriodoDeHoje, aoMudarVisao, aoDeslocar, aoHoje, extra }: Props) {
  const bruto = tituloDoCalendario(visao, data);
  // "outubro de 2026" vira "Outubro de 2026" (só a primeira letra: o "de" fica minúsculo).
  const titulo = bruto.charAt(0).toUpperCase() + bruto.slice(1);
  return (
    <View style={estilos.barra}>
      <View style={estilos.periodo}>
        <Botao rotulo="Hoje" tipo="secundario" aoTocar={aoHoje} desabilitado={noPeriodoDeHoje} motivo="Hoje já está na tela." />
        <View style={estilos.setas}>
          <IconeBotao Icone={ChevronLeft} rotulo={ANTERIOR[visao]} aoTocar={() => aoDeslocar(-1)} />
          <IconeBotao Icone={ChevronRight} rotulo={PROXIMO[visao]} aoTocar={() => aoDeslocar(1)} />
        </View>
        <View style={estilos.titulo} accessibilityLiveRegion="polite" aria-live="polite">
          <Texto variante="titulo" nivel={2} numerico>{titulo}</Texto>
        </View>
      </View>
      <View style={estilos.visoes}>
        <Escolha<VisaoDoCalendario> descricao="Visão do calendário" valor={visao} compacta
          opcoes={VISOES_DO_CALENDARIO.map((v) => ({ valor: v, rotulo: ROTULOS_DAS_VISOES[v] }))}
          aoMudar={(v) => { if (v !== visao) aoMudarVisao(v); }} />
        {extra}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1.5) },
  periodo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1), flexShrink: 1, minWidth: 0 },
  setas: { flexDirection: 'row', alignItems: 'center' },
  titulo: { flexShrink: 1, minWidth: 0 },
  visoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1), flexShrink: 1, minWidth: 0, maxWidth: '100%' },
});
