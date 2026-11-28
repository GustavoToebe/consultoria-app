import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import type { TipoDeLembrete } from '../../../api/financeiroTipos';
import type { PontoDaLinhaDoTempo } from '../../../dominio/telaDosLembretes';
import { useTema } from '../../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO_CONTROLE } from '../../../tema/tokens';
import { coresDoDesabilitado } from '../../../ui/desabilitado';
import { sobre } from '../../../ui/sobre';
import { Texto } from '../../../ui/Texto';

const PONTO = 22;

/**
 * A linha do tempo dos lembretes, grande e clicável (28/11): "3 dias antes · No vencimento · 3 dias depois" num eixo, cada
 * ponto um botão de alternar (WAI-ARIA APG: `aria-pressed`, num `group` com nome) que liga ou desliga aquele envio. Os três
 * ficam sempre no mesmo lugar (nada pula ao desligar um). Ligado: ponto cheio com ✓ e "Ligado"; desligado: ponto vazado e
 * "Desligado" (o estado nunca está só no preenchimento). `desabilitado` (lembretes desligados ou sem `FINANCEIRO_ALTERAR`):
 * o cinza único do desabilitado, fora do Tab, com o motivo no `accessibilityHint` (o texto visível fica na aba).
 */
export function LinhaDoTempoClicavel({ pontos, aoAlternar, desabilitado, motivo }: {
  pontos: PontoDaLinhaDoTempo[];
  aoAlternar: (tipo: TipoDeLembrete) => void;
  desabilitado: boolean;
  motivo?: string;
}) {
  const { cores } = useTema();
  const inativo = coresDoDesabilitado(cores);
  return (
    <View role="group" aria-label="Quando mandar o lembrete" style={estilos.eixo}>
      {/* Do centro do primeiro ponto ao do último (cada posição é um terço da largura); decorativo. */}
      <View aria-hidden style={[estilos.trilho, { backgroundColor: desabilitado ? inativo.borda : cores.bordaCampo }]} />
      {pontos.map((p) => {
        const corDoPonto = desabilitado ? inativo.texto : cores.texto;
        return (
          <Pressable key={p.tipo} accessibilityRole="button" aria-pressed={p.ligado} accessibilityLabel={p.nome}
            accessibilityState={{ disabled: desabilitado }} accessibilityHint={desabilitado ? motivo : undefined}
            disabled={desabilitado} onPress={() => aoAlternar(p.tipo)}
            style={(estado) => [estilos.posicao, { backgroundColor: !desabilitado && sobre(estado) ? cores.sobre : 'transparent' }]}>
            <View style={[estilos.ponto, {
              backgroundColor: p.ligado ? corDoPonto : desabilitado ? inativo.fundo : cores.superficie,
              borderColor: p.ligado ? corDoPonto : desabilitado ? inativo.borda : cores.bordaCampo,
            }]}>
              {p.ligado ? <Check size={14} color={desabilitado ? inativo.fundo : cores.superficie} strokeWidth={3} aria-hidden /> : null}
            </View>
            <Texto cor={desabilitado ? inativo.texto : cores.texto} style={estilos.rotulo}>{p.rotulo}</Texto>
            <Texto variante="pequeno" cor={desabilitado || !p.ligado ? cores.textoSuave : cores.texto} style={estilos.estado}>
              {p.ligado ? 'Ligado' : 'Desligado'}
            </Texto>
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  eixo: { flexDirection: 'row', position: 'relative', gap: espaco(0.5) },
  trilho: { position: 'absolute', top: espaco(1) + PONTO / 2 - 1, height: 2, left: '16.66%', right: '16.66%', borderRadius: 1 },
  posicao: {
    flex: 1, minWidth: 0, minHeight: ALVO_TOQUE, alignItems: 'center', gap: espaco(0.75), paddingVertical: espaco(1),
    paddingHorizontal: espaco(0.5), borderRadius: RAIO_CONTROLE,
  },
  ponto: { width: PONTO, height: PONTO, borderRadius: PONTO / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  rotulo: { textAlign: 'center', fontFamily: fontes.semi },
  estado: { textAlign: 'center' },
});
