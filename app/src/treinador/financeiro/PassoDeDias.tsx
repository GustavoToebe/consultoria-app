import { Minus, Plus, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ajustarDias, textoDosDias } from '../../dominio/lembretesDeCobranca';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco, fontes, RAIO_CONTROLE } from '../../tema/tokens';
import { MensagemDeErro } from '../../ui/Campo';
import { sobre } from '../../ui/sobre';
import { Texto } from '../../ui/Texto';

/**
 * Passo de dias (− número +) dos lembretes. Não há passo em `ui/`: o `AjusteDeCarga` é da carga, com rótulo e passo próprios.
 * O número não se digita: os botões param em 0 e no máximo, então a tela não tem valor inválido (o 422 do servidor ainda
 * aparece embaixo). Teclado pelo padrão `spinbutton` da WAI-ARIA APG: setas ±1, Page Up/Down ±5, Home/End; o foco é só o
 * número (os botões ficam fora do Tab na web e servem ao toque e ao leitor de tela). No celular o leitor de tela ajusta pelas
 * ações de aumentar e diminuir. Desabilitado: fora do Tab, sem ação.
 */
export function PassoDeDias({ rotulo, valor, maximo, aoMudar, desabilitado, erro }: {
  rotulo: string;
  valor: number;
  maximo: number;
  aoMudar: (n: number) => void;
  desabilitado?: boolean;
  erro?: string | null;
}) {
  const { cores } = useTema();
  const [foco, setFoco] = useState(false);
  const mudar = (passo: number) => {
    if (desabilitado) return;
    const novo = ajustarDias(valor, passo, maximo);
    if (novo !== valor) aoMudar(novo);
  };
  const teclas: Record<string, () => void> = {
    ArrowUp: () => mudar(1), ArrowRight: () => mudar(1), ArrowDown: () => mudar(-1), ArrowLeft: () => mudar(-1),
    PageUp: () => mudar(5), PageDown: () => mudar(-5), Home: () => mudar(-maximo), End: () => mudar(maximo),
  };
  const aoTeclar = (e: { key: string; preventDefault: () => void }) => {
    const acao = teclas[e.key];
    if (!acao) return;
    e.preventDefault();
    acao();
  };
  const textoDoValor = textoDosDias(valor);
  const borda = erro ? cores.perigo : foco ? cores.anelFoco : cores.bordaCampo;
  return (
    <View style={estilos.campo}>
      <Texto variante="rotulo" cor={cores.texto}>{rotulo}</Texto>
      <View style={estilos.linha}>
        <BotaoDoPasso Icone={Minus} rotulo={`Diminuir ${rotulo.toLowerCase()}`} desabilitado={desabilitado || valor <= 0} aoTocar={() => mudar(-1)} />
        <View
          role="spinbutton"
          aria-label={rotulo}
          aria-valuemin={0}
          aria-valuemax={maximo}
          aria-valuenow={valor}
          aria-valuetext={textoDoValor}
          aria-disabled={desabilitado}
          aria-invalid={!!erro}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => mudar(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
          focusable={!desabilitado}
          {...(Platform.OS === 'web' ? ({ tabIndex: desabilitado ? -1 : 0, onKeyDown: aoTeclar } as object) : null)}
          onFocus={() => setFoco(true)}
          onBlur={() => setFoco(false)}
          style={[estilos.valor, { backgroundColor: cores.campo, borderColor: borda, borderWidth: foco || erro ? 2 : 1 }, semContornoNaWeb]}>
          <Texto cor={valor === 0 ? cores.textoSuave : cores.texto} style={estilos.numero}>{textoDoValor}</Texto>
        </View>
        <BotaoDoPasso Icone={Plus} rotulo={`Aumentar ${rotulo.toLowerCase()}`} desabilitado={desabilitado || valor >= maximo} aoTocar={() => mudar(1)} />
      </View>
      {erro ? <MensagemDeErro erro={erro} /> : <Texto variante="pequeno">{`De 0 a ${maximo}. 0 = não manda.`}</Texto>}
    </View>
  );
}

function BotaoDoPasso({ Icone, rotulo, desabilitado, aoTocar }: { Icone: LucideIcon; rotulo: string; desabilitado: boolean; aoTocar: () => void }) {
  const { cores } = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: desabilitado }}
      disabled={desabilitado}
      onPress={aoTocar}
      // Fora do Tab na web: o teclado ajusta pelas setas no número (APG spinbutton).
      {...(Platform.OS === 'web' ? ({ tabIndex: -1 } as object) : null)}
      style={(estado) => [estilos.botao, { borderColor: desabilitado ? cores.borda : cores.bordaCampo, backgroundColor: !desabilitado && sobre(estado) ? cores.sobre : cores.superficie }]}>
      <Icone size={18} color={desabilitado ? cores.textoSuave : cores.texto} aria-hidden />
    </Pressable>
  );
}

/** Na web quem mostra o foco é a borda da caixa (`anelFoco`, 2 px), não o contorno do navegador por dentro. */
const semContornoNaWeb = Platform.OS === 'web' ? { outlineWidth: 0 } : null;

const estilos = StyleSheet.create({
  campo: { gap: espaco(0.75), flexShrink: 1 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1) },
  botao: { width: ALVO_TOQUE, height: ALVO_TOQUE, borderRadius: RAIO_CONTROLE, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  valor: { minWidth: 112, height: ALVO_TOQUE, borderRadius: RAIO_CONTROLE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: espaco(1.5) },
  // Texto e número juntos ("3 dias", "não manda"): a fonte do texto com dígitos tabulares, não a mono dos números soltos.
  numero: { textAlign: 'center', fontFamily: fontes.semi, fontVariant: ['tabular-nums'] },
});
