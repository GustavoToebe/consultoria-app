import { useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { semanasParaCelular, textoDaCelula, type CelulaDoMapa, type MapaDeTreinos as Mapa } from '../dominio/mapaDeTreinos';
import { useTema } from '../tema/TemaProvider';
import { espaco } from '../tema/tokens';
import { Cartao } from '../ui/Cartao';
import { Esqueleto } from '../ui/Esqueleto';
import { Texto } from '../ui/Texto';
import { useMapaDeTreinos } from './useMapaDeTreinos';

/** Celular: as últimas 26 semanas (seis meses), célula de 22 px com 4 de folga (alvo de 24 px pelo espaçamento, WCAG 2.5.8). */
const SEMANAS_NO_CELULAR = 26;
const CELULA_NO_CELULAR = 22;
const FOLGA_NO_CELULAR = 4;
/** O ano inteiro (53 colunas) só quando cabe com pelo menos 11 px por coluna; abaixo disso, o modo do celular. */
const PASSO_MINIMO_DO_ANO = 11;
const FOLGA_NO_ANO = 2;
const COLUNA_DOS_DIAS = 30;
const ALTURA_DOS_MESES = 18;
const DIAS_COM_ROTULO: Record<number, string> = { 0: 'seg', 2: 'qua', 4: 'sex' };
const DICA = 'Toque num dia para ver a data, o treino e o resultado.';

/**
 * Mapa de treinos do aluno (M1 a M4, plano `comunidade-organizada-e-mapa`): uma coluna por semana (segunda a domingo,
 * como o "Sua semana"), o mês em cima. Sem treino = célula vazia (`superficie3`); "Fiz em parte" = anel na cor da marca;
 * "Fiz tudo" = célula cheia na cor da marca, nunca o verde de situação. O anel e o cheio usam `marcaPeca`, que passa 3:1
 * sobre o cartão e sobre o vazio em toda paleta e cor da marca (`tema/tokens.test.ts`): um tom médio misturado não passaria
 * 3:1 contra os dois vizinhos, então o "médio" é a forma (anel), com a legenda escrita.
 *
 * Tocar num dia (ou andar pelas setas com a grade em foco, na web) mostra data, treino e resultado na linha fixa abaixo:
 * nada depende de hover. A grade é uma parada só do Tab; cada dia tem o rótulo `textoDaCelula` para o leitor de tela.
 * Sem props: usa o hook por dentro e some com o retorno desligado (também no topo do perfil do aluno).
 */
export function MapaDeTreinos() {
  const { visivel, carregando, mapa } = useMapaDeTreinos();
  if (!visivel) return null;
  if (carregando) return <Esqueleto texto="Carregando seu mapa de treinos" cartoes={1} />;
  return <GradeDoMapa mapa={mapa} />;
}

function GradeDoMapa({ mapa }: { mapa: Mapa }) {
  const { cores, marcaPeca } = useTema();
  const [largura, setLargura] = useState(0);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [focada, setFocada] = useState(false);
  const rolagem = useRef<ScrollView>(null);

  const espacoDaGrade = Math.max(0, largura - COLUNA_DOS_DIAS);
  const passoDoAno = Math.floor(espacoDaGrade / mapa.semanas.length);
  const anoInteiro = passoDoAno >= PASSO_MINIMO_DO_ANO;
  const semanas = anoInteiro ? mapa.semanas : semanasParaCelular(mapa, SEMANAS_NO_CELULAR);
  const folga = anoInteiro ? FOLGA_NO_ANO : FOLGA_NO_CELULAR;
  const celula = anoInteiro ? Math.min(passoDoAno, 18) - folga : CELULA_NO_CELULAR;
  const passo = celula + folga;

  const dias = semanas.flatMap((s) => s.dias);
  const passados = dias.filter((d) => !d.futuro);
  const selecionada = dias.find((d) => d.data === escolhida && !d.futuro) ?? null;
  const n = mapa.diasTreinados;
  const titulo = n === 0 ? 'Seu ano de treinos' : `${n} ${n === 1 ? 'dia' : 'dias'} de treino no último ano`;

  // Setas na web: ↑ ↓ andam um dia, ← → uma semana, Home e End vão ao primeiro e ao último dia. Não passa de hoje.
  const andar = (evento: { key: string; preventDefault?: () => void }) => {
    const atual = selecionada ? passados.indexOf(selecionada) : passados.length - 1;
    const salto = { ArrowDown: 1, ArrowUp: -1, ArrowRight: 7, ArrowLeft: -7 }[evento.key];
    const proximo = salto !== undefined ? atual + salto : evento.key === 'Home' ? 0 : evento.key === 'End' ? passados.length - 1 : null;
    if (proximo === null) return;
    evento.preventDefault?.();
    const alvo = passados[Math.min(passados.length - 1, Math.max(0, proximo))];
    if (alvo) setEscolhida(alvo.data);
  };
  const teclado = Platform.OS === 'web'
    ? {
        tabIndex: 0 as const,
        onKeyDown: andar,
        onFocus: () => { setFocada(true); if (!selecionada && passados.length) setEscolhida(passados[passados.length - 1].data); },
        onBlur: () => setFocada(false),
      }
    : {};

  return (
    <Cartao titulo={titulo}>
      <View style={estilos.area} onLayout={(e) => setLargura(e.nativeEvent.layout.width)}>
        <View style={[estilos.dias, { paddingTop: ALTURA_DOS_MESES, gap: folga }]} aria-hidden>
          {Array.from({ length: 7 }, (_, i) => (
            <View key={i} style={{ height: celula, justifyContent: 'center' }}>
              {DIAS_COM_ROTULO[i] ? <Texto variante="pequeno" style={estilos.rotuloPequeno}>{DIAS_COM_ROTULO[i]}</Texto> : null}
            </View>
          ))}
        </View>
        <ScrollView horizontal ref={rolagem} style={estilos.rolagem} showsHorizontalScrollIndicator={!anoInteiro}
          onContentSizeChange={() => rolagem.current?.scrollToEnd({ animated: false })}>
          <View
            {...teclado}
            accessibilityLabel={`Mapa de treinos: ${titulo}`}
            accessibilityHint={Platform.OS === 'web' ? 'Use as setas para andar pelos dias.' : undefined}
            style={[estilos.grade, { outlineColor: cores.anelFoco, outlineStyle: 'solid', outlineWidth: focada ? 2 : 0, outlineOffset: 2 }]}>
            <View style={{ height: ALTURA_DOS_MESES, width: semanas.length * passo - folga }} aria-hidden>
              {semanas.map((s, i) => (s.mes ? (
                <Texto key={s.dias[0].data} variante="pequeno" numberOfLines={1} style={[estilos.mes, { left: i * passo }]}>{s.mes}</Texto>
              ) : null))}
            </View>
            <View style={[estilos.linha, { gap: folga }]}>
              {semanas.map((s) => (
                <View key={s.dias[0].data} style={{ gap: folga }}>
                  {s.dias.map((d) => (
                    <Dia key={d.data} dia={d} tamanho={celula} selecionado={selecionada?.data === d.data}
                      cores={{ vazio: cores.superficie3, marca: marcaPeca, anel: cores.anelFoco }}
                      aoTocar={() => setEscolhida(d.data)} />
                  ))}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
      <Texto numerico style={estilos.leitura} cor={selecionada ? cores.texto : cores.textoSuave} accessibilityLiveRegion="polite">
        {selecionada ? textoDaCelula(selecionada) : n === 0 ? 'Seus treinos concluídos aparecem aqui, um quadrado por dia.' : DICA}
      </Texto>
      <View style={estilos.legenda}>
        {([[0, 'Sem treino'], [1, 'Fiz em parte'], [2, 'Fiz tudo']] as const).map(([nivel, texto]) => (
          <View key={nivel} style={estilos.itemDaLegenda}>
            <View aria-hidden style={[estilos.amostra, estiloDoNivel(nivel, { vazio: cores.superficie3, marca: marcaPeca }, 14)]} />
            <Texto variante="pequeno">{texto}</Texto>
          </View>
        ))}
      </View>
    </Cartao>
  );
}

function Dia({ dia, tamanho, selecionado, cores, aoTocar }: {
  dia: CelulaDoMapa; tamanho: number; selecionado: boolean;
  cores: { vazio: string; marca: string; anel: string }; aoTocar: () => void;
}) {
  const forma = { width: tamanho, height: tamanho, borderRadius: tamanho >= 16 ? 4 : 2 };
  // Dia que ainda não chegou: só o lugar na grade, sem toque.
  if (dia.futuro) return <View style={forma} accessibilityLabel={textoDaCelula(dia)} />;
  const marcado = selecionado ? { outlineColor: cores.anel, outlineStyle: 'solid' as const, outlineWidth: 2, outlineOffset: 1 } : null;
  return (
    <Pressable focusable={false} accessibilityRole="button" accessibilityLabel={textoDaCelula(dia)} accessibilityState={{ selected: selecionado }}
      onPress={aoTocar} style={[forma, estiloDoNivel(dia.nivel, cores, tamanho), marcado]} />
  );
}

/** Vazio = superfície de seleção; parcial = anel da marca sobre o vazio; tudo = cheio da marca. */
function estiloDoNivel(nivel: 0 | 1 | 2, cores: { vazio: string; marca: string }, tamanho: number) {
  if (nivel === 2) return { backgroundColor: cores.marca };
  if (nivel === 1) return { backgroundColor: cores.vazio, borderWidth: tamanho >= 16 ? 3 : 2, borderColor: cores.marca };
  return { backgroundColor: cores.vazio };
}

const estilos = StyleSheet.create({
  area: { flexDirection: 'row' },
  dias: { width: COLUNA_DOS_DIAS },
  rotuloPequeno: { fontSize: 11, lineHeight: 14 },
  rolagem: { flex: 1 },
  grade: { paddingBottom: espaco(0.5), borderRadius: 4 },
  mes: { position: 'absolute', top: 0, fontSize: 11, lineHeight: 14, width: 40 },
  linha: { flexDirection: 'row' },
  leitura: { minHeight: 42 },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(2), rowGap: espaco(0.5) },
  itemDaLegenda: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.75) },
  amostra: { width: 14, height: 14, borderRadius: 3 },
});
