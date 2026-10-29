import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { dataComDiaDaSemana, miniCalendario, type VisaoDoCalendario } from '../../dominio/agendaCalendario';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../../tema/tokens';
import { IconeBotao } from '../../ui/IconeBotao';
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
 * Mini calendário do painel do PC: as setas trocam só o mês mostrado; o dia tocado leva a visão aberta para ele. A data
 * aberta é invertida (seleção), hoje tem o anel, o período da visão (a semana, o mês) fica com o fundo da faixa. Mudar a
 * data por fora (setas da barra, "Hoje") traz o mini junto (a `key` é o mês da data).
 */
export function MiniCalendario(props: Props) {
  return <MiniDoMes key={props.data.slice(0, 7)} {...props} />;
}

function MiniDoMes({ visao, data, hoje, aoEscolher }: Props) {
  const { cores } = useTema();
  const [mes, setMes] = useState(data);
  const m = miniCalendario(mes, visao, data, hoje);
  return (
    <View style={estilos.mini}>
      <View style={estilos.topo}>
        <Texto variante="bloco" nivel={2} style={estilos.titulo}>{m.titulo.charAt(0).toUpperCase() + m.titulo.slice(1)}</Texto>
        <View style={estilos.setas}>
          <IconeBotao Icone={ChevronLeft} rotulo="Mês anterior no mini calendário" aoTocar={() => setMes(m.anterior)} />
          <IconeBotao Icone={ChevronRight} rotulo="Próximo mês no mini calendário" aoTocar={() => setMes(m.proximo)} />
        </View>
      </View>
      <View style={estilos.semana} aria-hidden>
        {m.cabecalho.map((d) => <View key={d} style={estilos.dia}><Texto variante="pequeno" cor={cores.textoSuave}>{d.slice(0, 1).toUpperCase()}</Texto></View>)}
      </View>
      {m.semanas.map((semana) => (
        <View key={semana[0].data} style={estilos.semana}>
          {semana.map((c) => {
            const marcado = c.selecionado;
            return (
              <Pressable key={c.data} accessibilityRole="button" accessibilityState={{ selected: marcado }} aria-current={marcado ? 'date' : undefined}
                accessibilityLabel={`${dataComDiaDaSemana(c.data)}${c.hoje ? ', hoje' : ''}`} onPress={() => aoEscolher(c.data)}
                style={(e) => [estilos.dia, c.destaque && { backgroundColor: cores.superficie2, borderRadius: 0 }, sobre(e) && !marcado && { backgroundColor: cores.superficie3 }]}>
                <View style={[estilos.numero, marcado && { backgroundColor: cores.texto }, c.hoje && !marcado && { borderWidth: 2, borderColor: cores.texto }]}>
                  <Texto variante="pequeno" numerico style={c.hoje || marcado ? estilos.forte : undefined}
                    cor={marcado ? cores.fundo : c.doMes ? cores.texto : cores.textoSuave}>{String(c.dia)}</Texto>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Largura do mini calendário (7 dias de 44 px). */
export const LARGURA_DO_MINI = ALVO_TOQUE * 7;

const estilos = StyleSheet.create({
  mini: { width: LARGURA_DO_MINI },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titulo: { flexShrink: 1, paddingLeft: espaco(1) },
  setas: { flexDirection: 'row' },
  semana: { flexDirection: 'row' },
  dia: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center', borderRadius: RAIO },
  numero: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  forte: { fontFamily: fontes.semi },
});
