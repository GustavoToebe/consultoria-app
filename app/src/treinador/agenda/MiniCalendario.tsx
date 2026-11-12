import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { dataComDiaDaSemana, miniCalendario, type VisaoDoCalendario } from '../../dominio/agendaCalendario';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes } from '../../tema/tokens';
import { IconeBotao } from '../../ui/IconeBotao';
import { coresDaSelecao } from '../../ui/selecao';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

interface Props {
  visao: VisaoDoCalendario;
  data: string;
  hoje: string;
  /** Leva a visão aberta para o dia tocado (sem trocar de visão). */
  aoEscolher: (data: string) => void;
}

/**
 * Mini calendário da lateral do PC, nas proporções do Google Agenda (F20 de 12/11): sem moldura nem faixa, o mês num título
 * discreto e as setas leves (alvo de 44, desenho compacto), semanas baixas (dias de 34 px de altura na largura da lateral,
 * acima dos 32 px pedidos para o PC). As setas trocam só o mês mostrado; o dia tocado leva a visão aberta para ele. A data
 * aberta é a seleção neutra, hoje é o número na cor da marca, o período da visão (a semana, o mês) fica com o fundo do item.
 * Mudar a data por fora (setas da barra, "Hoje") traz o mini junto (a `key` é o mês da data).
 */
export function MiniCalendario(props: Props) {
  return <MiniDoMes key={props.data.slice(0, 7)} {...props} />;
}

function MiniDoMes({ visao, data, hoje, aoEscolher }: Props) {
  const { cores, marcaTexto } = useTema();
  const [mes, setMes] = useState(data);
  const m = miniCalendario(mes, visao, data, hoje);
  // Como o `ui/Calendario`: o escolhido é o mais forte (superficie3 com contorno, sem inverter); hoje é só o número na
  // cor da marca.
  const selecao = coresDaSelecao(cores, true);
  return (
    <View style={estilos.mini}>
      <View style={estilos.topo}>
        <Texto variante="subtitulo" nivel={2} style={estilos.titulo}>{m.titulo.charAt(0).toUpperCase() + m.titulo.slice(1)}</Texto>
        <View style={estilos.setas}>
          <IconeBotao Icone={ChevronLeft} rotulo="Mês anterior no mini calendário" aoTocar={() => setMes(m.anterior)} compacto />
          <IconeBotao Icone={ChevronRight} rotulo="Próximo mês no mini calendário" aoTocar={() => setMes(m.proximo)} compacto />
        </View>
      </View>
      <View style={estilos.semana} aria-hidden>
        {m.cabecalho.map((d) => <View key={d} style={estilos.letra}><Texto variante="pequeno" cor={cores.textoSuave}>{d.slice(0, 1).toUpperCase()}</Texto></View>)}
      </View>
      {m.semanas.map((semana) => (
        <View key={semana[0].data} style={estilos.semana}>
          {semana.map((c) => {
            const marcado = c.selecionado;
            return (
              <Pressable key={c.data} accessibilityRole="button" accessibilityState={{ selected: marcado }} aria-current={marcado ? 'date' : undefined}
                accessibilityLabel={`${dataComDiaDaSemana(c.data)}${c.hoje ? ', hoje' : ''}`} onPress={() => aoEscolher(c.data)}
                style={[estilos.dia, c.destaque && { backgroundColor: cores.superficie2 }]}>
                {(e) => (
                  <View style={[estilos.numero, marcado ? { backgroundColor: selecao.fundo, borderWidth: 1, borderColor: selecao.borda }
                    : sobre(e) && { backgroundColor: cores.superficie3 }]}>
                    <Texto variante="pequeno" numerico style={c.hoje || marcado ? estilos.forte : undefined}
                      cor={marcado ? selecao.texto : c.hoje ? marcaTexto : c.doMes ? cores.texto : cores.textoSuave}>{String(c.dia)}</Texto>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/**
 * Largura da lateral da agenda no PC (F20: 240 a 280 px; 272 = 7 dias de ~39 px e o filtro "Compromissos: 2 selecionados" inteiro). Fixa: sem moldura no mini, as bordas
 * reforçadas não a alargam; o que sobra vai para a grade.
 */
export const LARGURA_DA_LATERAL = 272;

const estilos = StyleSheet.create({
  mini: { alignSelf: 'stretch' },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), minHeight: ALVO_TOQUE, paddingLeft: espaco(1) },
  titulo: { flexShrink: 1 },
  // As setas encostam: o desenho de 32 fica dentro do alvo de 44.
  setas: { flexDirection: 'row', marginRight: -espaco(0.75) },
  semana: { flexDirection: 'row' },
  letra: { flex: 1, height: 24, alignItems: 'center', justifyContent: 'center' },
  dia: { flex: 1, height: 34, alignItems: 'center', justifyContent: 'center' },
  numero: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  forte: { fontFamily: fontes.semi },
});
