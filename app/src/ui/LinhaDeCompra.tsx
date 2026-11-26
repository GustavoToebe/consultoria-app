import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type PointerEvent, type StyleProp, type TextStyle } from 'react-native';

import { useTema } from '../tema/TemaProvider';
import { espaco, fontes } from '../tema/tokens';
import { Selo } from './Selo';
import { Texto } from './Texto';

/**
 * Uma linha de item da lista de compras, a mesma no aluno e na prévia do treinador (26/11): nome e, sempre embaixo, de onde
 * veio o número ("Na dieta: 1,26 kg pronto → ~1,33 kg cru limpo") em secundário; a quantidade à direita (no máximo 45% da
 * linha, quebrando dentro dela) ou, com `quantidadeAbaixo`, logo abaixo do nome. Quem usa desenha a quantidade (o aluno
 * risca o comprado; a prévia põe "cru" e as dúzias) e o que vai nas pontas: `inicio` (a caixa do aluno) e `fim` (lápis e
 * lixeira). Com `aoTocar`, tocar no miolo também age (fora do foco e do leitor de tela, que ficam na caixa) e a linha
 * acende com o mouse; sem ele, a linha é só leitura. Vai dentro de `ListaDeLinhas divisorias`.
 */
export function LinhaDeCompra({ nome, estiloDoNome, linhasDoNome, detalhe, selo, quantidade, quantidadeAbaixo, inicio, fim, aoTocar }: {
  nome: string;
  /** O riscado do comprado. */
  estiloDoNome?: StyleProp<TextStyle>;
  /** Corta o nome com reticências (a prévia: até 2 linhas); sem isto, o nome quebra quanto precisar (o avulso do aluno). */
  linhasDoNome?: number;
  detalhe?: string | null;
  selo?: string | null;
  quantidade: ReactNode;
  quantidadeAbaixo?: boolean;
  inicio?: ReactNode;
  fim?: ReactNode;
  aoTocar?: () => void;
}) {
  const { cores } = useTema();
  const [aceso, setAceso] = useState(false);
  // Realce só com o mouse e só quando a linha age: com o dedo, a linha piscaria ao rolar.
  const realce = aoTocar ? {
    onPointerEnter: (e: PointerEvent) => { if (e.nativeEvent.pointerType === 'mouse') setAceso(true); },
    onPointerLeave: () => setAceso(false),
  } : null;
  const caixaDaQuantidade = <View style={quantidadeAbaixo ? null : estilos.quantidade}>{quantidade}</View>;
  return (
    <View {...realce} style={[estilos.linha, { backgroundColor: aceso && aoTocar ? cores.sobre : 'transparent' }]}>
      {inicio}
      <Pressable focusable={false} accessible={false} disabled={!aoTocar} onPress={aoTocar} style={estilos.miolo}>
        <View style={estilos.textos}>
          <Texto style={[estilos.nome, estiloDoNome]} numberOfLines={linhasDoNome}>{nome}</Texto>
          {quantidadeAbaixo ? caixaDaQuantidade : null}
          {detalhe ? <Texto variante="suave" numberOfLines={2}>{detalhe}</Texto> : null}
          {selo ? <View style={estilos.selos}><Selo texto={selo} tipo="neutro" /></View> : null}
        </View>
        {quantidadeAbaixo ? null : caixaDaQuantidade}
      </Pressable>
      {fim ? <View style={estilos.fim}>{fim}</View> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), minHeight: 56, paddingHorizontal: espaco(0.5) },
  miolo: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: espaco(2), paddingVertical: espaco(1), minHeight: 48 },
  textos: { flex: 1, minWidth: 0, gap: espaco(0.5) },
  nome: { fontFamily: fontes.semi },
  // A quantidade não encolhe até sumir: no máximo 45% da linha, quebrando dentro dela ("1 pacote de 1 kg").
  quantidade: { flexShrink: 0, maxWidth: '45%', alignItems: 'flex-end' },
  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(0.75) },
  fim: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
});
