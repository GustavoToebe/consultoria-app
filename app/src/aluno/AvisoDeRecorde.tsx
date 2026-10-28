import { Medal, X } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DemonstracaoDoAluno } from '../api/tipos';
import { textoDoRecorde, type Recorde } from '../dominio/recordesPessoais';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO } from '../tema/tokens';
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
 * Some sozinho em 5 s; o leitor de tela o anuncia (região viva educada). Cor de status (sucesso), nunca a da marca.
 */
export function AvisoDeRecorde({ aviso, aoFechar }: { aviso: RecordeParaAvisar | null; aoFechar: () => void }) {
  const { cores } = useTema();
  const margem = useSafeAreaInsets();
  const reduzido = useMovimentoReduzido();
  const chave = aviso?.chave;
  useEffect(() => {
    if (chave === undefined) return;
    const relogio = setTimeout(aoFechar, DURACAO_DO_AVISO_DE_RECORDE_MS);
    return () => clearTimeout(relogio);
  }, [chave, aoFechar]);
  if (!aviso) return null;
  const linhas = aviso.recordes.map(textoDoRecorde);
  return (
    <View pointerEvents="box-none" style={[estilos.camada, { top: margem.top + espaco(1) }]}>
      <Animated.View
        key={aviso.chave}
        entering={reduzido ? undefined : FadeInUp.duration(200).reduceMotion(ReduceMotion.System)}
        exiting={reduzido ? undefined : FadeOutUp.duration(150).reduceMotion(ReduceMotion.System)}
        role="status"
        accessibilityLiveRegion="polite"
        accessibilityLabel={`Recorde pessoal em ${aviso.nome}, série ${aviso.numeroDaSerie}: ${linhas.join('; ')}`}
        style={[estilos.aviso, { backgroundColor: cores.superficie2, borderColor: cores.sucesso }]}>
        {aviso.demonstracao ? (
          <DemonstracaoDoExercicio exercicioId={aviso.exercicioId} nome={aviso.nome} imagens={aviso.demonstracao.imagens}
            imagemPropriaEm={aviso.demonstracao.imagemPropriaEm} papel="ALUNO" largura={44} altura={44} preencher />
        ) : (
          <View style={[estilos.icone, { borderColor: cores.sucesso }]}>
            <Medal size={22} color={cores.sucesso} />
          </View>
        )}
        <View style={estilos.textos}>
          <Texto variante="pequeno" style={[estilos.titulo, { color: cores.sucesso }]}>Recorde pessoal · {aviso.nome}</Texto>
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
  textos: { flex: 1, minWidth: 0, gap: 2 },
  titulo: { fontFamily: fontes.semi },
  linha: { fontFamily: fontes.semi, fontSize: 16 },
  fechar: { width: ALVO_TOQUE, height: ALVO_TOQUE, alignItems: 'center', justifyContent: 'center' },
});
