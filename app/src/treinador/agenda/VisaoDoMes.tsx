import { Pressable, StyleSheet, View } from 'react-native';

import {
  agruparPorDia, type CelulaDoDia, DIAS_DA_SEMANA_CURTOS, dataComDiaDaSemana, type ItemDoCalendario,
  itensDaCelula, semanasDoMes,
} from '../../dominio/agendaCalendario';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, LINHA_DA_FAIXA, RAIO } from '../../tema/tokens';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { horarioDoItem, useCorDaAgenda } from './itemDaAgenda';

/** Itens por célula no Mês do PC antes do "+N". */
const ITENS_NA_CELULA = 4;
/** Pontos por célula no Mês do celular (um por agenda que tem item no dia). */
const PONTOS_NA_CELULA = 3;

interface Props {
  data: string;
  hoje: string;
  itens: readonly ItemDoCalendario[];
  /** `compacta` = celular: pontos coloridos e a lista do dia tocado embaixo (quem chama a desenha). */
  compacta: boolean;
  /** PC: abre o Dia. Celular: escolhe o dia (a lista embaixo muda). */
  aoTocarDia: (data: string) => void;
}

const quantos = (n: number) => (n === 0 ? 'nada marcado' : n === 1 ? '1 item' : `${n} itens`);

/**
 * Mês em grade de 7 colunas (segunda a domingo, 6 semanas). No PC cada célula é um botão que abre o Dia, com até 4 itens
 * (marcador de cor + hora + título) e "+N"; no celular, o número do dia com até 3 pontos nas cores das agendas, e o toque
 * escolhe o dia. O nome do botão é a data por extenso com quantos itens há. O mês é um bloco (borda do bloco) e a linha dos
 * dias da semana é a faixa dele.
 */
export function VisaoDoMes({ data, hoje, itens, compacta, aoTocarDia }: Props) {
  const { cores, bordas } = useTema();
  const semanas = semanasDoMes(data, hoje, { data: compacta ? data : undefined });
  const de = semanas[0][0].data;
  const ate = semanas[5][6].data;
  const porDia = new Map(agruparPorDia(itens, de, ate).map((d) => [d.data, d.itens]));
  return (
    <View style={[estilos.moldura, { borderWidth: bordas.bloco, borderColor: cores.borda, backgroundColor: cores.superficie }]}>
      <View style={[estilos.semana, estilos.faixa, { backgroundColor: cores.superficie3, borderBottomColor: cores.bordaCampo }]}>
        {DIAS_DA_SEMANA_CURTOS.map((d) => (
          <View key={d} style={estilos.cabecalho} aria-hidden>
            <Texto variante="pequeno" style={estilos.forte}>{d}</Texto>
          </View>
        ))}
      </View>
      {semanas.map((semana) => (
        <View key={semana[0].data} style={[estilos.semana, { borderBottomColor: cores.divisor }]}>
          {semana.map((celula) => (
            <Celula key={celula.data} celula={celula} itens={porDia.get(celula.data) ?? []} compacta={compacta} aoTocar={() => aoTocarDia(celula.data)} />
          ))}
        </View>
      ))}
    </View>
  );
}

function Celula({ celula, itens, compacta, aoTocar }: { celula: CelulaDoDia; itens: readonly ItemDoCalendario[]; compacta: boolean; aoTocar: () => void }) {
  const { cores } = useTema();
  const corDe = useCorDaAgenda();
  const marcado = celula.selecionado;
  const rotulo = `${dataComDiaDaSemana(celula.data)}${celula.hoje ? ', hoje' : ''}, ${quantos(itens.length)}${compacta ? '' : '. Abrir o dia'}`;
  const numero = (
    <View style={[estilos.numero, celula.hoje && !marcado && { borderColor: cores.texto, borderWidth: 2 }, marcado && { backgroundColor: cores.texto }]}>
      <Texto variante="pequeno" numerico style={celula.hoje || marcado ? estilos.forte : undefined}
        cor={marcado ? cores.fundo : celula.doMes ? cores.texto : cores.textoSuave}>{String(celula.dia)}</Texto>
    </View>
  );
  if (compacta) {
    const coresDoDia = [...new Set(itens.map((i) => i.cor))].slice(0, PONTOS_NA_CELULA);
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={rotulo} accessibilityState={{ selected: marcado }} aria-selected={marcado}
        onPress={aoTocar} style={(e) => [estilos.celulaCompacta, sobre(e) && { backgroundColor: cores.superficie3 }]}>
        {numero}
        <View style={estilos.pontos} aria-hidden>
          {coresDoDia.map((c) => <View key={c} style={[estilos.ponto, { backgroundColor: corDe(c) }]} />)}
        </View>
      </Pressable>
    );
  }
  const { visiveis, mais } = itensDaCelula(itens, ITENS_NA_CELULA);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={rotulo} onPress={aoTocar}
      style={(e) => [estilos.celula, { borderLeftColor: cores.divisor }, sobre(e) && { backgroundColor: cores.superficie3 }]}>
      {numero}
      <View style={estilos.chips} aria-hidden>
        {visiveis.map((item) => (
          <View key={item.chave} style={[estilos.chip, item.cancelado && estilos.esmaecido]}>
            <View style={[estilos.ponto, { backgroundColor: corDe(item.cor) }]} />
            <Texto variante="pequeno" numberOfLines={1} style={[estilos.textoDoChip, item.cancelado && estilos.riscado]}>
              {item.diaInteiro || item.origem === 'ATUALIZACAO' ? item.titulo : `${horarioDoItem(item).split('–')[0]} ${item.titulo}`}
            </Texto>
          </View>
        ))}
        {mais > 0 ? <Texto variante="pequeno" numerico cor={cores.textoSuave} style={estilos.forte}>{`+${mais}`}</Texto> : null}
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  moldura: { borderRadius: RAIO, overflow: 'hidden' },
  semana: { flexDirection: 'row', borderBottomWidth: 1 },
  faixa: { borderBottomWidth: LINHA_DA_FAIXA },
  cabecalho: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: espaco(0.75) },
  celula: { flex: 1, minWidth: 0, minHeight: 124, padding: espaco(0.5), gap: 2, borderLeftWidth: 1 },
  celulaCompacta: { flex: 1, minWidth: 0, minHeight: ALVO_TOQUE + espaco(1.5), alignItems: 'center', justifyContent: 'center', paddingVertical: 2, gap: 2 },
  numero: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  forte: { fontFamily: fontes.semi },
  pontos: { flexDirection: 'row', gap: 3, height: 6 },
  ponto: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  chips: { gap: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
  textoDoChip: { flexShrink: 1, minWidth: 0 },
  esmaecido: { opacity: 0.6 },
  riscado: { textDecorationLine: 'line-through' },
});
