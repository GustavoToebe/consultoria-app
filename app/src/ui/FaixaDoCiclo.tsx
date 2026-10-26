import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { TextosDasFases } from '../api/tipos';
import { diferencaEmDias, ROTULO_DA_FASE, segmentosDoPeriodo, type FaixaDeFase, type FaseDoCiclo } from '../dominio/cicloMenstrual';
import { useTema } from '../tema/TemaProvider';
import { ALVO_TOQUE, espaco, type Cores } from '../tema/tokens';
import { Texto } from './Texto';
import { TextoFormatado } from './TextoFormatado';

const CHAVE: Record<FaseDoCiclo, keyof TextosDasFases> = {
  MENSTRUAL: 'menstrual', FOLICULAR: 'folicular', OVULATORIA: 'ovulatoria', LUTEA: 'lutea',
};

export function corDaFase(cores: Cores, fase: FaseDoCiclo): string {
  if (fase === 'MENSTRUAL') return cores.fase1;
  if (fase === 'FOLICULAR') return cores.fase2;
  if (fase === 'OVULATORIA') return cores.fase3;
  return cores.fase4;
}

/**
 * Faixa do período com as fases estimadas e a legenda em texto. O toque numa fase mostra o texto do treinador,
 * quando houver. Os dias sem fase ocupam o lugar deles, em fundo neutro, para cada fase ficar na data certa.
 */
export function FaixaDoCiclo({ faixas, de, ate, textos, previsto }: {
  faixas: FaixaDeFase[];
  de: string;
  ate: string;
  textos?: TextosDasFases | null;
  previsto?: string | null;
}) {
  const { cores } = useTema();
  const [aberta, setAberta] = useState<FaseDoCiclo | null>(null);
  const total = Math.max(diferencaEmDias(de, ate) + 1, 1);
  const vistas = [...new Set(faixas.map((f) => f.fase))];
  const texto = aberta ? textos?.[CHAVE[aberta]]?.trim() : '';
  return (
    <View style={estilos.bloco}>
      <View style={[estilos.trilho, { backgroundColor: cores.superficie2 }]}>
        {segmentosDoPeriodo(faixas, de, ate).map((segmento) => {
          const largura = `${(segmento.dias / total) * 100}%` as const;
          const fase = segmento.fase;
          if (!fase) return <View key={`vazio:${segmento.de}`} accessibilityElementsHidden importantForAccessibility="no" style={{ width: largura, minHeight: ALVO_TOQUE }} />;
          return (
            <Pressable key={`${fase}:${segmento.de}`} accessibilityRole="button" accessibilityLabel={ROTULO_DA_FASE[fase]}
              onPress={() => setAberta((atual) => atual === fase ? null : fase)}
              style={{ width: largura, backgroundColor: corDaFase(cores, fase), minHeight: ALVO_TOQUE }} />
          );
        })}
      </View>
      <View style={estilos.legenda}>
        {vistas.map((fase) => (
          <View key={fase} style={estilos.item}>
            <View style={[estilos.amostra, { backgroundColor: corDaFase(cores, fase) }]} />
            <Texto variante="pequeno">{ROTULO_DA_FASE[fase]}{faixas.some((f) => f.fase === fase && f.estimada) ? ' (estimativa)' : ''}</Texto>
          </View>
        ))}
      </View>
      {texto ? <TextoFormatado texto={texto} /> : null}
      {previsto ? <Texto variante="pequeno">{previsto}</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1) },
  trilho: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', minHeight: ALVO_TOQUE },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1.5) },
  item: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5) },
  amostra: { width: 12, height: 12, borderRadius: 2 },
});
