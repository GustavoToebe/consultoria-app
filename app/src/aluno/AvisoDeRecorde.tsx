import { Medal, X } from 'lucide-react-native';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DemonstracaoDoAluno } from '../api/tipos';
import { textoDoRecorde, type Recorde } from '../dominio/recordesPessoais';
import { useUnidadeDeCarga } from '../ui/unidadeDeCargaEmUso';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO, TOKENS_STNDRD_ESCURO } from '../tema/tokens';
import { DemonstracaoDoExercicio } from '../ui/DemonstracaoDoExercicio';
import { Texto } from '../ui/Texto';
import { useMovimentoReduzido } from '../ui/useMovimentoReduzido';

/** Quanto tempo o aviso fica no topo (o aluno pode fechar antes). */
export const DURACAO_DO_AVISO_DE_RECORDE_MS = 5000;

export interface RecordeParaAvisar {
  /** Muda a cada marcação: duas marcações seguidas reiniciam o tempo do aviso. */
  chave: number;
  exercicioId: string | null;
  nome: string;
  numeroDaSerie: number;
  recordes: Recorde[];
  demonstracao: DemonstracaoDoAluno | null;
}

/**
 * Aviso de recorde pessoal no topo da tela do exercício (Engajamento 0.2, referência do Hevy): aparece na hora em que a
 * série é marcada, sem internet, com a miniatura e o nome do exercício e uma linha por recorde ("Maior carga · 70 kg").
 * Some sozinho em 5 s; o leitor de tela o anuncia (região viva educada). Cor de conquista (D9, 17/11) no ícone e no selo,
 * nunca a da marca; o nome do exercício e as linhas ficam em `texto`.
 */
export function AvisoDeRecorde({ aviso, aoFechar }: { aviso: RecordeParaAvisar | null; aoFechar: () => void }) {
  const { cores, stndrd: stndrdTema } = useTema();
  const stndrd = stndrdTema ?? TOKENS_STNDRD_ESCURO;
  const unidade = useUnidadeDeCarga();
  const margem = useSafeAreaInsets();
  const reduzido = useMovimentoReduzido();
  const chave = aviso?.chave;
  useEffect(() => {
    if (chave === undefined) return;
    const relogio = setTimeout(aoFechar, DURACAO_DO_AVISO_DE_RECORDE_MS);
    return () => clearTimeout(relogio);
  }, [chave, aoFechar]);
  if (!aviso) return null;
  const linhas = aviso.recordes.map((r) => textoDoRecorde(r, unidade));
  return (
    <View pointerEvents="box-none" style={[estilos.camada, { top: margem.top + espaco(1) }]}>
      <Animated.View
        key={aviso.chave}
        entering={reduzido ? undefined : FadeInUp.duration(200).reduceMotion(ReduceMotion.System)}
        exiting={reduzido ? undefined : FadeOutUp.duration(150).reduceMotion(ReduceMotion.System)}
        role="status"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`Recorde pessoal em ${aviso.nome}, série ${aviso.numeroDaSerie}: ${linhas.join('; ')}`}
        style={[
          estilos.aviso,
          { backgroundColor: stndrd.glass.bg, borderColor: cores.divisor },
          Platform.OS === 'web' ? ({ backdropFilter: `blur(${stndrd.glass.blur}px)` } as object) : null,
        ]}>
        {aviso.demonstracao ? (
          <DemonstracaoDoExercicio exercicioId={aviso.exercicioId} nome={aviso.nome} imagens={aviso.demonstracao.imagens}
            imagemPropriaEm={aviso.demonstracao.imagemPropriaEm} papel="ALUNO" largura={44} altura={44} preencher />
        ) : (
          <View style={[estilos.icone, { backgroundColor: cores.conquistaSuave, borderColor: cores.divisor }]}>
            <Medal size={22} color={cores.conquista} />
          </View>
        )}
        <View style={estilos.textos}>
          <View style={estilos.cabecalhoPr}>
            <View style={[estilos.seloPr, { backgroundColor: cores.conquistaSuave }]}>
              <Texto style={[estilos.seloPrTexto, { color: cores.conquista }]}>Recorde</Texto>
            </View>
            <Texto variante="pequeno" numberOfLines={1} cor={cores.texto} style={estilos.titulo}>{aviso.nome}</Texto>
          </View>
          {linhas.map((l) => (
            <Texto key={l} numerico style={estilos.linha}>{l}</Texto>
          ))}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar aviso de recorde" onPress={aoFechar} style={estilos.fechar}>
          <X size={18} color={cores.textoSuave} strokeWidth={2} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const estilos = StyleSheet.create({
  camada: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: espaco(2), zIndex: 20 },
  aviso: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco(1.25),
    borderWidth: 1,
    borderRadius: RAIO,
    padding: espaco(1.25),
  },
  icone: { width: 44, height: 44, borderRadius: RAIO, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1, minWidth: 0, gap: 3 },
  cabecalhoPr: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  seloPr: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  seloPrTexto: { fontFamily: fontes.negrito, fontSize: 10, lineHeight: 14, letterSpacing: 0.6 },
  titulo: { flex: 1, minWidth: 0, fontFamily: fontes.semi },
  linha: { fontFamily: fontes.semi, fontSize: 16 },
  fechar: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center' },
});
