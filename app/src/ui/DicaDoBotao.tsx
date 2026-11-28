import { useId, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, LARGURA_MENU_LATERAL, RAIO_CONTROLE } from '../tema/tokens';
import { Texto } from './Texto';
import { useTeclado } from './usoWeb';

interface Props {
  /** O rótulo do botão: vira o nome do envoltório focável (o botão de dentro sai da leitura para não haver dois). */
  rotulo: string;
  /** Por que o botão está desabilitado ("Salve o modelo antes."); sem motivo, o botão vai sozinho, sem envoltório nem dica. */
  motivo?: string;
  /**
   * Desenha o `Botao`. Recebe o motivo que o botão deve escrever embaixo (abaixo de 768 px ou no celular, como sempre) ou
   * `undefined` quando a dica cuida dele.
   */
  children: (motivoNoBotao: string | undefined) => ReactNode;
}

/**
 * Motivo de um botão desabilitado em dica (27/11, cabeçalho único do modelo de treino), onde o motivo escrito embaixo do
 * botão quebraria a faixa. O botão `disabled` sai do Tab, então quem recebe o foco é o envoltório: papel de botão,
 * `aria-disabled`, o rótulo do botão e o motivo como descrição (`aria-describedby`). A dica abre com o mouse em cima e no
 * foco; fecha ao sair, no blur e com o Esc sem tirar o foco (WCAG 1.4.13); fica dentro do envoltório, colada, para o mouse
 * passar do botão à dica sem fechá-la. Mesmo desenho da dica das redes (`RedesSociais`): fundo `texto`, letra `fundo`.
 * Só na web e com o menu lateral (768 px): abaixo disso não há mouse e o motivo continua escrito sob o botão. Sem animação.
 * shortcut: a dica nasce sempre à direita (abaixo, alinhada à borda direita do botão); passar a ancorar se alguém usar à esquerda.
 */
export function DicaDoBotao({ rotulo, motivo, children }: Props) {
  const { cores } = useTema();
  const id = useId();
  const { width } = useWindowDimensions();
  const comDica = !!motivo && Platform.OS === 'web' && width >= LARGURA_MENU_LATERAL;
  const [mouse, setMouse] = useState(false);
  const [foco, setFoco] = useState(false);
  const [dispensada, setDispensada] = useState(false);
  const aberta = comDica && (mouse || foco) && !dispensada;
  // Esc dispensa a dica sem tirar o foco; a tecla segue para quem mais a escuta (folha, menu).
  useTeclado(aberta, ({ key }) => {
    if (key === 'Escape') setDispensada(true);
  });

  if (!comDica) return <>{children(motivo)}</>;
  const doMouse = {
    onPointerEnter: (e: { nativeEvent: { pointerType?: string } }) => {
      if (e.nativeEvent.pointerType !== 'mouse') return;
      setDispensada(false);
      setMouse(true);
    },
    onPointerLeave: () => setMouse(false),
  };
  return (
    <View
      role="button"
      aria-label={rotulo}
      aria-disabled
      aria-describedby={id}
      accessibilityHint={motivo}
      tabIndex={0}
      onFocus={() => { setDispensada(false); setFoco(true); }}
      onBlur={() => setFoco(false)}
      style={[estilos.envolve, aberta ? estilos.porCima : null]}
      {...doMouse}>
      {/* O botão de dentro (desabilitado, fora do Tab) sai da leitura: o envoltório já é o botão com nome e motivo. */}
      <View aria-hidden importantForAccessibility="no-hide-descendants">{children(undefined)}</View>
      <View id={id} style={estilos.oculto}><Texto>{motivo}</Texto></View>
      {aberta ? (
        <View aria-hidden pointerEvents="box-none" style={estilos.lugarDaDica} testID="dica-do-botao">
          <View style={estilos.vao}>
            <View style={[estilos.dica, { backgroundColor: cores.texto }]}>
              <Texto style={[estilos.textoDaDica, { color: cores.fundo }]}>{motivo}</Texto>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  envolve: { position: 'relative', alignSelf: 'flex-start', maxWidth: '100%' },
  porCima: { zIndex: 10 },
  oculto: { display: 'none' },
  // A caixa larga só dá espaço ao texto (não pega o mouse); o vão é padding da dica, dentro do envoltório: o mouse desce
  // do botão até a dica sem ela fechar.
  lugarDaDica: { position: 'absolute', top: '100%', right: 0, alignItems: 'flex-end', width: 264 },
  vao: { paddingTop: espaco(0.5) },
  dica: { paddingHorizontal: espaco(1), paddingVertical: espaco(0.5), borderRadius: RAIO_CONTROLE, maxWidth: 264 },
  textoDaDica: { fontFamily: fontes.medio, fontSize: 13, lineHeight: 18 },
});
