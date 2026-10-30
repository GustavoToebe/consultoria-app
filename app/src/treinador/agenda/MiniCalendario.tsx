import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { dataComDiaDaSemana, miniCalendario, type VisaoDoCalendario } from '../../dominio/agendaCalendario';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LINHA_DA_FAIXA, RAIO } from '../../tema/tokens';
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
 * Mini calendário do painel do PC, num bloco como o `Cartao` (borda do bloco, faixa do título com o mês e as setas em
 * moldura), mas sem o recuo do cartão: os 7 dias de 44 px ocupam a largura toda. As setas trocam só o mês mostrado; o dia
 * tocado leva a visão aberta para ele. A data aberta é invertida (seleção), hoje tem o anel, o período da visão (a semana,
 * o mês) fica com o fundo do item. Mudar a data por fora (setas da barra, "Hoje") traz o mini junto (a `key` é o mês da data).
 */
export function MiniCalendario(props: Props) {
  return <MiniDoMes key={props.data.slice(0, 7)} {...props} />;
}

function MiniDoMes({ visao, data, hoje, aoEscolher }: Props) {
  const { cores, bordas } = useTema();
  const [mes, setMes] = useState(data);
  const m = miniCalendario(mes, visao, data, hoje);
  return (
    <View style={[estilos.mini, { borderWidth: bordas.bloco, borderColor: cores.borda, backgroundColor: cores.superficie }]}>
      <View style={[estilos.topo, { backgroundColor: cores.superficie3, borderBottomColor: cores.bordaCampo }]}>
        <Texto variante="bloco" nivel={2} style={estilos.titulo}>{m.titulo.charAt(0).toUpperCase() + m.titulo.slice(1)}</Texto>
        <View style={estilos.setas}>
          <IconeBotao Icone={ChevronLeft} rotulo="Mês anterior no mini calendário" aoTocar={() => setMes(m.anterior)} moldura />
          <IconeBotao Icone={ChevronRight} rotulo="Próximo mês no mini calendário" aoTocar={() => setMes(m.proximo)} moldura />
        </View>
      </View>
      <View style={[estilos.semana, estilos.cabecalho]} aria-hidden>
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

/** Largura dos dias do mini calendário (7 de 44 px); o bloco soma a borda dos dois lados (`larguraDoMini`). */
export const LARGURA_DO_MINI = ALVO_TOQUE * 7;
/** Largura do bloco do mini calendário com a borda do bloco (2 px, ou 3 com as bordas reforçadas) dos dois lados. */
export const larguraDoMini = (bordaDoBloco: number) => LARGURA_DO_MINI + 2 * bordaDoBloco;

const estilos = StyleSheet.create({
  mini: { alignSelf: 'flex-start', borderRadius: RAIO, overflow: 'hidden', paddingBottom: espaco(0.5) },
  topo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco(1), borderBottomWidth: LINHA_DA_FAIXA,
    paddingLeft: espaco(2), paddingRight: espaco(1), paddingVertical: espaco(1),
  },
  titulo: { flexShrink: 1 },
  setas: { flexDirection: 'row', gap: espaco(0.75) },
  cabecalho: { marginTop: espaco(0.5) },
  semana: { flexDirection: 'row' },
  dia: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center', borderRadius: RAIO },
  numero: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  forte: { fontFamily: fontes.semi },
});
