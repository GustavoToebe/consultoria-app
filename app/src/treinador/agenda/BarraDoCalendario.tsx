import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ROTULOS_DAS_VISOES, tituloDoCalendario, VISOES_DO_CALENDARIO, type VisaoDoCalendario } from '../../dominio/agendaCalendario';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Escolha } from '../../ui/Escolha';
import { IconeBotao } from '../../ui/IconeBotao';
import { Texto } from '../../ui/Texto';

const ANTERIOR: Record<VisaoDoCalendario, string> = { dia: 'Dia anterior', semana: 'Semana anterior', mes: 'Mês anterior', ano: 'Ano anterior' };
const PROXIMO: Record<VisaoDoCalendario, string> = { dia: 'Próximo dia', semana: 'Próxima semana', mes: 'Próximo mês', ano: 'Próximo ano' };

const OPCOES_DA_VISAO = VISOES_DO_CALENDARIO.map((v) => ({ valor: v, rotulo: ROTULOS_DAS_VISOES[v] }));

/**
 * O lado esquerdo da barra única da Agenda (agenda: criar unificado, 23/11): "Hoje", setas e o título do período (h2,
 * anunciado ao mudar, na fonte do texto: título não leva fonte numérica). O "Hoje" fica sempre habilitado (tocar já estando
 * no período não muda nada). As setas e o "Hoje" trocam a data sem empilhar passos. O título cabe numa linha em 1280 px
 * (agenda: retoques, 23/11); só a semana entre anos e o celular estreito chegam a duas, com os botões na mesma linha.
 */
export function PeriodoDoCalendario({ visao, data, aoDeslocar, aoHoje }: {
  visao: VisaoDoCalendario; data: string; aoDeslocar: (sentido: 1 | -1) => void; aoHoje: () => void;
}) {
  const bruto = tituloDoCalendario(visao, data);
  // "outubro de 2026" vira "Outubro de 2026" (só a primeira letra: o "de" fica minúsculo).
  const titulo = bruto.charAt(0).toUpperCase() + bruto.slice(1);
  return (
    <View style={estilos.periodo}>
      <Botao rotulo="Hoje" tipo="secundario" aoTocar={aoHoje} style={estilos.centro} />
      <View style={estilos.setas}>
        <IconeBotao Icone={ChevronLeft} rotulo={ANTERIOR[visao]} aoTocar={() => aoDeslocar(-1)} moldura />
        <IconeBotao Icone={ChevronRight} rotulo={PROXIMO[visao]} aoTocar={() => aoDeslocar(1)} moldura />
      </View>
      <View style={estilos.titulo} accessibilityLiveRegion="polite" aria-live="polite">
        {/* `bloco` (16): com o menu aberto, em 1280 px sobram ~160 px; o título da semana, curto, cabe numa linha (o `titulo`, 26, quebrava). */}
        <Texto variante="bloco" nivel={2} numberOfLines={2}>{titulo}</Texto>
      </View>
    </View>
  );
}

/**
 * A visão do calendário como segmento (Dia | Semana | Mês | Ano), à direita da barra, no lugar do antigo "Semana ▾". Os
 * atalhos D, W, M e Y continuam (a tela os escuta). Trocar a visão empilha um passo (quem chama decide).
 */
export function SegmentoDaVisao({ visao, aoMudar }: { visao: VisaoDoCalendario; aoMudar: (v: VisaoDoCalendario) => void }) {
  return <Escolha<VisaoDoCalendario> descricao="Visão do calendário" valor={visao} opcoes={OPCOES_DA_VISAO} aoMudar={aoMudar} />;
}

const estilos = StyleSheet.create({
  periodo: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), minWidth: 0 },
  setas: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  titulo: { flexShrink: 1, minWidth: 0 },
  // O `Botao` nasce com `alignSelf: flex-start`; aqui ele acompanha o centro das setas e do título.
  centro: { alignSelf: 'center' },
});
