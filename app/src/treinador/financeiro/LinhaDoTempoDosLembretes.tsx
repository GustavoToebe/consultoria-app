import { StyleSheet, View } from 'react-native';

import type { TipoDeLembrete } from '../../api/financeiroTipos';
import { pontosDaLinhaDoTempo, textoDaLinhaDoTempo, type Lembrete } from '../../dominio/lembretesDeCobranca';
import { useTema } from '../../tema/TemaProvider';
import { espaco } from '../../tema/tokens';
import { Texto } from '../../ui/Texto';

const ORDEM: readonly TipoDeLembrete[] = ['ANTES', 'NO_DIA', 'DEPOIS'];
const PONTO = 12;

/**
 * Prévia dos lembretes num eixo: antes, no vencimento e depois, com os valores da tela; o ponto que não manda some e as três
 * posições ficam fixas (nada pula ao mudar um valor). Sem "no dia", o meio guarda só a marca neutra do vencimento, que é a
 * referência do eixo. O eixo é decorativo para o leitor de tela: o texto embaixo diz o mesmo.
 */
export function LinhaDoTempoDosLembretes(l: Omit<Lembrete, 'ligado'>) {
  const { cores } = useTema();
  const pontos = pontosDaLinhaDoTempo(l);
  return (
    <View style={estilos.bloco}>
      {pontos.length > 0 ? (
        <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={estilos.eixo}>
          <View style={[estilos.trilho, { backgroundColor: cores.bordaCampo }]} />
          {ORDEM.map((tipo) => {
            const ponto = pontos.find((p) => p.tipo === tipo);
            return (
              <View key={tipo} style={estilos.posicao}>
                {ponto ? (
                  <>
                    <View style={[estilos.ponto, { backgroundColor: cores.texto, borderColor: cores.superficie }]} />
                    <Texto variante="pequeno" cor={cores.texto} style={estilos.rotulo}>{ponto.rotulo}</Texto>
                  </>
                ) : tipo === 'NO_DIA' ? (
                  <>
                    <View style={[estilos.marca, { backgroundColor: cores.bordaCampo }]} />
                    <Texto variante="pequeno" style={estilos.rotulo}>Vencimento</Texto>
                  </>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
      <Texto variante="suave">{textoDaLinhaDoTempo(l)}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1.5) },
  eixo: { flexDirection: 'row', position: 'relative', paddingTop: 2 },
  // Do centro da primeira posição ao da última (cada posição é um terço da largura).
  trilho: { position: 'absolute', top: 2 + PONTO / 2 - 1, height: 2, left: '16.66%', right: '16.66%', borderRadius: 1 },
  posicao: { flex: 1, alignItems: 'center', gap: espaco(0.75), minHeight: PONTO },
  ponto: { width: PONTO, height: PONTO, borderRadius: PONTO / 2, borderWidth: 2 },
  marca: { width: 2, height: PONTO },
  rotulo: { textAlign: 'center' },
});
