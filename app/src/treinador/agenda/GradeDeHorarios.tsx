import { useEffect, useRef, useState } from 'react';
import { type GestureResponderEvent, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
  alturaDaGrade, colunasDaGrade, DIAS_DA_SEMANA_CURTOS, dataComDiaDaSemana, horaDoPontoDaGrade, type ItemDoCalendario, minutoDoDiaEmBrasilia,
  minutoInicialDaGrade, posicaoDoMinuto, ROTULOS_DAS_HORAS, type SegmentoNaGrade,
} from '../../dominio/agendaCalendario';
import { diaDaSemanaIso } from '../../dominio/formatos';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../../tema/tokens';
import { Selo } from '../../ui/Selo';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';
import { type AoAbrirItem, horarioDoItem, rotuloDoItem, seloDoItem, toqueDoItem, useCorDaAgenda } from './itemDaAgenda';

/** Altura de uma hora: 48 px, como no Google Agenda. O item tem no mínimo o alvo de toque (44 px). */
const ALTURA_DA_HORA = 48;
const LARGURA_DAS_HORAS = 52;
/** Quantos itens de dia inteiro cada dia mostra na faixa do topo da Semana antes do "+N". */
const DIA_INTEIRO_NA_SEMANA = 2;

interface Props {
  dias: readonly string[];
  itens: readonly ItemDoCalendario[];
  hoje: string;
  meus: boolean;
  /** A chave do período aberto: a rolagem inicial acontece uma vez por período, não a cada recarga. */
  chaveDoPeriodo: string;
  aoAbrir: AoAbrirItem;
  /** Tocar no cabeçalho do dia (na Semana) abre o Dia. */
  aoAbrirDia?: (data: string) => void;
  /** Clique num horário vazio (só no PC, com `AGENDA_ALTERAR`): abre o evento novo já com o dia e a hora. */
  aoCriarNoHorario?: (data: string, hora: string) => void;
}

/**
 * Dia e Semana no PC: uma coluna por dia, uma linha por hora, a faixa de "dia inteiro" no topo (as atualizações entram
 * aqui), os itens sobrepostos lado a lado (`colunasDaGrade`), a rolagem inicial em `minutoInicialDaGrade` (uma vez por
 * período) e a linha do "agora" no dia de hoje. O cabeçalho e a faixa ficam fora da rolagem.
 */
export function GradeDeHorarios({ dias, itens, hoje, meus, chaveDoPeriodo, aoAbrir, aoAbrirDia, aoCriarNoHorario }: Props) {
  const { cores } = useTema();
  const { height } = useWindowDimensions();
  const colunas = colunasDaGrade(itens, dias, { alturaPorHora: ALTURA_DA_HORA, alturaMinima: ALVO_TOQUE });
  const altura = alturaDaGrade(ALTURA_DA_HORA);
  const alturaDaJanela = Math.max(360, Math.min(altura, height - 320));
  const rolagem = useRef<ScrollView>(null);
  const rolouPara = useRef<string | null>(null);
  const agora = useAgora();
  const minutoDeAgora = minutoDoDiaEmBrasilia(agora);
  const umDia = dias.length === 1;

  // Rolagem inicial: uma vez por período (voltar à tela recarrega os itens e não deve puxar a grade de volta).
  useEffect(() => {
    if (rolouPara.current === chaveDoPeriodo) return;
    rolouPara.current = chaveDoPeriodo;
    const minuto = dias.includes(hoje) && itens.length === 0 ? Math.max(0, minutoDeAgora - 60) : minutoInicialDaGrade(itens, dias);
    rolagem.current?.scrollTo({ y: posicaoDoMinuto(minuto, ALTURA_DA_HORA), animated: false });
  }, [chaveDoPeriodo, dias, hoje, itens, minutoDeAgora]);

  return (
    <View style={[estilos.moldura, { borderColor: cores.borda, backgroundColor: cores.superficie }]}>
      {/* Cabeçalho dos dias e faixa de dia inteiro. */}
      <View style={[estilos.linha, { borderBottomColor: cores.divisor }]}>
        <View style={estilos.calha} />
        {colunas.map((c) => {
          const ehHoje = c.data === hoje;
          const dia = Number(c.data.slice(8, 10));
          const conteudo = <>
            <Texto variante="pequeno" cor={cores.textoSuave}>{DIAS_DA_SEMANA_CURTOS[diaDaSemanaIso(c.data) - 1]}</Texto>
            <View style={[estilos.numero, ehHoje && { backgroundColor: cores.texto }]}>
              <Texto variante="bloco" numerico cor={ehHoje ? cores.fundo : cores.texto}>{String(dia)}</Texto>
            </View>
          </>;
          return (
            <View key={c.data} style={[estilos.cabecalhoDoDia, { borderLeftColor: cores.divisor }]}>
              {aoAbrirDia && !umDia ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Abrir o dia ${dataComDiaDaSemana(c.data)}${ehHoje ? ', hoje' : ''}`}
                  onPress={() => aoAbrirDia(c.data)}
                  style={(e) => [estilos.botaoDoDia, sobre(e) && { backgroundColor: cores.superficie3 }]}>{conteudo}</Pressable>
              ) : <View style={estilos.botaoDoDia} accessibilityLabel={`${dataComDiaDaSemana(c.data)}${ehHoje ? ', hoje' : ''}`}>{conteudo}</View>}
            </View>
          );
        })}
      </View>
      {colunas.some((c) => c.diaInteiro.length) ? (
        <View style={[estilos.linha, { borderBottomColor: cores.divisor }]}>
          <View style={[estilos.calha, estilos.rotuloDiaInteiro]}><Texto variante="pequeno" cor={cores.textoSuave}>Dia inteiro</Texto></View>
          {colunas.map((c) => {
            const limite = umDia ? c.diaInteiro.length : DIA_INTEIRO_NA_SEMANA;
            const visiveis = c.diaInteiro.length > limite ? c.diaInteiro.slice(0, limite - 1) : c.diaInteiro;
            const mais = c.diaInteiro.length - visiveis.length;
            return (
              <View key={c.data} style={[estilos.faixaDoDia, { borderLeftColor: cores.divisor }]}>
                {visiveis.map((item) => <ItemDeDiaInteiro key={item.chave} item={item} hoje={hoje} meus={meus} aoAbrir={aoAbrir} />)}
                {mais > 0 ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Mais ${mais} de dia inteiro em ${dataComDiaDaSemana(c.data)}. Abrir o dia`}
                    onPress={() => aoAbrirDia?.(c.data)} style={(e) => [estilos.mais, sobre(e) && { backgroundColor: cores.superficie3 }]}>
                    <Texto variante="pequeno" numerico>{`+${mais}`}</Texto>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      <ScrollView ref={rolagem} style={{ height: alturaDaJanela }} contentContainerStyle={estilos.corpo}>
        <View style={[estilos.calha, { height: altura }]} aria-hidden>
          {ROTULOS_DAS_HORAS.map((h, i) => i === 0 ? null : (
            <Texto key={h} variante="pequeno" numerico cor={cores.textoSuave}
              style={[estilos.hora, { top: i * ALTURA_DA_HORA - 9 }]}>{h}</Texto>
          ))}
        </View>
        {colunas.map((c) => (
          <View key={c.data} style={[estilos.coluna, { height: altura, borderLeftColor: cores.divisor }]}>
            {/* Linhas das horas (decorativas) e o fundo clicável do horário vazio. */}
            {ROTULOS_DAS_HORAS.map((h, i) => <View key={h} pointerEvents="none"
              style={[estilos.linhaDaHora, { top: i * ALTURA_DA_HORA, borderTopColor: cores.divisor }]} />)}
            {aoCriarNoHorario && Platform.OS === 'web' ? (
              <Pressable accessible={false} focusable={false} tabIndex={-1} style={StyleSheet.absoluteFill}
                onPress={(e) => aoCriarNoHorario(c.data, horaDoPontoDaGrade(pontoY(e), ALTURA_DA_HORA))} />
            ) : null}
            {c.segmentos.map((s) => <Bloco key={s.chave} segmento={s} hoje={hoje} meus={meus} aoAbrir={aoAbrir} />)}
            {c.data === hoje ? (
              <View pointerEvents="none" aria-hidden style={[estilos.agora, { top: posicaoDoMinuto(minutoDeAgora, ALTURA_DA_HORA) }]}>
                <View style={[estilos.pontoDoAgora, { backgroundColor: cores.texto }]} />
                <View style={[estilos.linhaDoAgora, { backgroundColor: cores.texto }]} />
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/** Y do clique dentro da coluna (o fundo não tem filhos: `offsetY` na web é relativo a ele). */
function pontoY(e: GestureResponderEvent): number {
  const n = e.nativeEvent as unknown as { locationY?: number; offsetY?: number };
  return n.offsetY ?? n.locationY ?? 0;
}

/** O instante de agora, atualizado a cada minuto (a linha do "agora" anda sozinha). */
function useAgora(): Date {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const relogio = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(relogio);
  }, []);
  return agora;
}

function Bloco({ segmento: s, hoje, meus, aoAbrir }: { segmento: SegmentoNaGrade; hoje: string; meus: boolean; aoAbrir: AoAbrirItem }) {
  const { cores } = useTema();
  const corDe = useCorDaAgenda();
  const item = s.item;
  const selo = seloDoItem(item, hoje);
  const cabeHora = s.altura >= 52;
  const cabeSelo = s.altura >= 84 && !!selo;
  return (
    <View pointerEvents="box-none" style={[estilos.lugar, { top: s.topo, height: s.altura, left: `${s.esquerda * 100}%`, width: `${s.largura * 100}%` }]}>
      <Pressable {...toqueDoItem(item, meus, aoAbrir)} accessibilityLabel={rotuloDoItem(item, hoje)}
        style={(e) => [estilos.bloco, {
          backgroundColor: sobre(e) ? cores.superficie3 : cores.superficie2, borderColor: cores.borda, borderLeftColor: corDe(item.cor),
        }, item.cancelado && estilos.esmaecido]}>
        <Texto variante="pequeno" numberOfLines={cabeHora ? 2 : 1} style={[estilos.tituloDoBloco, item.cancelado && estilos.riscado]}>
          {cabeHora ? item.titulo : `${horarioDoItem(item).split('–')[0]} ${item.titulo}`}
        </Texto>
        {cabeHora ? <Texto variante="pequeno" numerico cor={cores.textoSuave} numberOfLines={1}>{horarioDoItem(item)}</Texto> : null}
        {cabeSelo && selo ? <Selo texto={selo.texto} tipo={selo.tipo} /> : null}
      </Pressable>
    </View>
  );
}

function ItemDeDiaInteiro({ item, hoje, meus, aoAbrir }: { item: ItemDoCalendario; hoje: string; meus: boolean; aoAbrir: AoAbrirItem }) {
  const { cores } = useTema();
  const corDe = useCorDaAgenda();
  return (
    <Pressable {...toqueDoItem(item, meus, aoAbrir)} accessibilityLabel={rotuloDoItem(item, hoje)}
      style={(e) => [estilos.diaInteiro, {
        backgroundColor: sobre(e) ? cores.superficie3 : cores.superficie2, borderColor: cores.borda, borderLeftColor: corDe(item.cor),
      }]}>
      <Texto variante="pequeno" numberOfLines={1} style={estilos.tituloDoBloco}>{item.titulo}</Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  moldura: { borderWidth: 1, borderRadius: RAIO, overflow: 'hidden' },
  linha: { flexDirection: 'row', borderBottomWidth: 1 },
  calha: { width: LARGURA_DAS_HORAS, flexShrink: 0 },
  rotuloDiaInteiro: { justifyContent: 'center', paddingHorizontal: espaco(0.5) },
  cabecalhoDoDia: { flex: 1, minWidth: 0, borderLeftWidth: 1 },
  botaoDoDia: { minHeight: ALVO_TOQUE + espaco(2), alignItems: 'center', justifyContent: 'center', paddingVertical: espaco(0.5), gap: 2 },
  numero: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  faixaDoDia: { flex: 1, minWidth: 0, borderLeftWidth: 1, padding: 2, gap: 2 },
  diaInteiro: {
    minHeight: ALVO_TOQUE, justifyContent: 'center', paddingHorizontal: espaco(0.75), borderWidth: 1, borderLeftWidth: 4, borderRadius: 4,
  },
  mais: { minHeight: ALVO_TOQUE, justifyContent: 'center', paddingHorizontal: espaco(0.75), borderRadius: 4 },
  corpo: { flexDirection: 'row' },
  hora: { position: 'absolute', right: espaco(1), fontFamily: fontes.normal },
  coluna: { flex: 1, minWidth: 0, borderLeftWidth: 1, position: 'relative' },
  linhaDaHora: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1 },
  lugar: { position: 'absolute', padding: 1 },
  bloco: { flex: 1, borderWidth: 1, borderLeftWidth: 4, borderRadius: 4, paddingHorizontal: espaco(0.5), paddingVertical: 2, overflow: 'hidden', gap: 2 },
  tituloDoBloco: { fontFamily: fontes.semi },
  esmaecido: { opacity: 0.6 },
  riscado: { textDecorationLine: 'line-through' },
  agora: { position: 'absolute', left: 0, right: 0, height: 2, flexDirection: 'row', alignItems: 'center' },
  pontoDoAgora: { width: 10, height: 10, borderRadius: 5, marginLeft: -5 },
  linhaDoAgora: { flex: 1, height: 2 },
});
