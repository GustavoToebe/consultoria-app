import { Check, Pencil, X } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { painelDoCheck, type EscolhaDoPainel } from '../dominio/painelDoCheck';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { Texto } from '../ui/Texto';
import { useMovimentoReduzido } from '../ui/useMovimentoReduzido';

const ICONES: Record<EscolhaDoPainel, typeof Check> = { SIM: Check, OUTRA_CARGA: Pencil, SEM_CARGA: X };

/**
 * Painel do ✓ (D2, 02/11): marcar a série com a carga vazia e com sugestão pergunta, dentro do próprio cartão da série,
 * "Fez com 60 kg?" com [Sim, 60 kg] [Outra carga] [Sem carga]. Fica na tela (nunca `alert`), sem rede: a escolha grava
 * no aparelho como qualquer ✓. Textos e efeito de cada escolha são do domínio (`dominio/painelDoCheck`).
 */
export function PainelDoCheck({ sugestaoKg, numero, aoEscolher }: { sugestaoKg: number; numero: number; aoEscolher: (escolha: EscolhaDoPainel) => void }) {
  const { cores } = useTema();
  const reduzido = useMovimentoReduzido();
  const { pergunta, opcoes } = painelDoCheck(sugestaoKg);
  return (
    <Animated.View
      entering={reduzido ? undefined : FadeIn.duration(150).reduceMotion(ReduceMotion.System)}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      aria-label={`Série ${numero}: ${pergunta}`}
      style={[estilos.painel, { backgroundColor: cores.superficie, borderColor: cores.bordaCampo }]}>
      <Texto numerico style={estilos.pergunta} cor={cores.texto}>{pergunta}</Texto>
      <LinhaDeAcoes>
        {opcoes.map((o) => (
          <Botao
            key={o.escolha}
            rotulo={o.rotulo}
            rotuloAcessivel={`${o.rotulo}, série ${numero}`}
            tipo="secundario"
            Icone={ICONES[o.escolha]}
            aoTocar={() => aoEscolher(o.escolha)}
          />
        ))}
      </LinhaDeAcoes>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  painel: { borderWidth: 2, borderRadius: RAIO, padding: espaco(1.25), gap: espaco(1) },
  pergunta: { fontFamily: fontes.semi, fontSize: 16, lineHeight: 22 },
});
