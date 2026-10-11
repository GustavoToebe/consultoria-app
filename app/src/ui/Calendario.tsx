import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { mesDeIso, mudarMes, NOMES_DOS_DIAS, semanasDoMes } from '../dominio/calendario';
import { hojeIso } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
import { IconeBotao } from './IconeBotao';
import { Texto } from './Texto';

/** Posição do botão que abriu o calendário, em coordenadas da janela. */
export interface Ancora {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  ancora: Ancora;
  /** Data atual do campo (ISO) ou `null`. */
  valor: string | null;
  aoEscolher: (iso: string) => void;
  aoLimpar: () => void;
  aoFechar: () => void;
}

const LARGURA = 280;
const ALTURA = 344;
const FOLGA = 8;
const CELULA = 36;

/**
 * Calendário compacto que abre colado ao campo (embaixo, ou em cima se faltar espaço), sem escurecer a tela: mês
 * anterior/próximo, dias dos meses vizinhos esmaecidos, "Hoje" e "Limpar". Tocar fora fecha.
 */
export function Calendario({ ancora, valor, aoEscolher, aoLimpar, aoFechar }: Props) {
  const { cores, marcaTexto } = useTema();
  const { width, height } = useWindowDimensions();
  const hoje = hojeIso();
  const [visto, setVisto] = useState(() => mesDeIso(valor, hoje));
  const semanas = semanasDoMes(visto);

  const direita = ancora.x + ancora.w;
  const esquerda = Math.max(FOLGA, Math.min(direita - LARGURA, width - LARGURA - FOLGA));
  const abaixo = ancora.y + ancora.h + 4;
  const cabeEmbaixo = abaixo + ALTURA <= height - FOLGA;
  const topo = cabeEmbaixo ? abaixo : Math.max(FOLGA, ancora.y - ALTURA - 4);

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={aoFechar}>
      <Pressable style={StyleSheet.absoluteFill} onPress={aoFechar} accessibilityLabel="Fechar calendário" />
      <View
        accessibilityViewIsModal
        style={[estilos.painel, { left: esquerda, top: topo, backgroundColor: cores.superficie, borderColor: cores.borda }]}>
        <View style={estilos.cabecalho}>
          <IconeBotao Icone={ChevronLeft} rotulo="Mês anterior" aoTocar={() => setVisto((v) => mudarMes(v, -1))} />
          <Texto numerico style={estilos.titulo}>
            {String(visto.mes + 1).padStart(2, '0')}/{visto.ano}
          </Texto>
          <IconeBotao Icone={ChevronRight} rotulo="Próximo mês" aoTocar={() => setVisto((v) => mudarMes(v, 1))} />
        </View>
        <View style={estilos.linha}>
          {NOMES_DOS_DIAS.map((nome) => (
            <Texto key={nome} variante="pequeno" style={estilos.nomeDoDia}>{nome}</Texto>
          ))}
        </View>
        {semanas.map((semana, si) => (
          <View key={si} style={estilos.linha}>
            {semana.map((d) => {
              const escolhido = d.iso === valor;
              const cor = escolhido ? cores.fundo : d.doMes ? (d.iso === hoje ? marcaTexto : cores.texto) : cores.textoSuave;
              return (
                <Pressable
                  key={d.iso}
                  accessibilityRole="button"
                  accessibilityLabel={d.iso.split('-').reverse().join('/')}
                  accessibilityState={{ selected: escolhido }}
                  onPress={() => aoEscolher(d.iso)}
                  style={({ pressed }) => [estilos.dia, escolhido && { backgroundColor: cores.texto }, { opacity: pressed ? 0.7 : d.doMes ? 1 : 0.6 }]}>
                  <Texto numerico style={[estilos.numeroDia, { color: cor }]}>{d.dia}</Texto>
                </Pressable>
              );
            })}
          </View>
        ))}
        <View style={[estilos.rodape, { borderColor: cores.borda }]}>
          <Pressable accessibilityRole="button" onPress={() => aoEscolher(hoje)} style={({ pressed }) => [estilos.botaoRodape, pressed && { backgroundColor: cores.superficie3 }]}>
            <Texto style={[estilos.acao, { color: marcaTexto }]}>Hoje</Texto>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={aoLimpar} style={({ pressed }) => [estilos.botaoRodape, pressed && { backgroundColor: cores.superficie3 }]}>
            <Texto style={[estilos.acao, { color: marcaTexto }]}>Limpar</Texto>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** Ícone para abrir o calendário dentro do campo de data. */
export function BotaoCalendario({ aoTocar }: { aoTocar: () => void }) {
  const { cores } = useTema();
  return <IconeBotao Icone={CalendarDays} rotulo="Abrir calendário" aoTocar={aoTocar} cor={cores.textoSuave} />;
}

const estilos = StyleSheet.create({
  painel: {
    position: 'absolute',
    width: LARGURA,
    height: ALTURA,
    borderWidth: 1,
    borderRadius: RAIO,
    paddingHorizontal: espaco(1),
    paddingTop: espaco(0.5),
    ...Platform.select({ web: { boxShadow: '0 8px 24px rgba(0,0,0,0.45)' }, default: { elevation: 8 } }),
  },
  cabecalho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titulo: { fontFamily: fontes.semi, fontSize: 15 },
  linha: { flexDirection: 'row' },
  nomeDoDia: { flex: 1, textAlign: 'center', paddingVertical: espaco(0.5) },
  dia: { flex: 1, height: CELULA, alignItems: 'center', justifyContent: 'center', borderRadius: RAIO },
  numeroDia: { fontFamily: fontes.semi, fontSize: 15 },
  rodape: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 'auto', borderTopWidth: 1, paddingVertical: espaco(0.5) },
  botaoRodape: { minHeight: ALVO_TOQUE, justifyContent: 'center', paddingHorizontal: espaco(1.5), borderRadius: RAIO },
  acao: { fontFamily: fontes.semi, fontSize: 14 },
});
