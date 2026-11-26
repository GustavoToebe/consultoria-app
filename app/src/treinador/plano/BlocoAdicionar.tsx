import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Texto } from '../../ui/Texto';

/**
 * Fim da lista de um editor (protótipo de 30/10): bloco tracejado, para ler como "lugar de mais um", com título, uma linha
 * do que dá para fazer e os botões de acrescentar. "Adicionar próximo exercício" no treino, "Adicionar próxima refeição" na dieta.
 * Desde 26/11 os botões ficam um embaixo do outro, na largura toda do cartão, com a mesma largura e altura (`BotaoDoBloco`).
 */
export function BlocoAdicionar({ titulo, descricao, children }: { titulo: string; descricao: string; children: ReactNode }) {
  const { cores } = useTema();
  return (
    <View style={[estilos.bloco, { borderColor: cores.bordaCampo }]}>
      <View style={estilos.textos}>
        <Texto variante="bloco" nivel={3}>{titulo}</Texto>
        <Texto variante="suave">{descricao}</Texto>
      </View>
      <View style={estilos.botoes}>{children}</View>
    </View>
  );
}

/** Botão do `BlocoAdicionar`: largura toda e ícone com rótulo alinhados à esquerda (um `acao` por bloco, o resto `secundario`). */
export function BotaoDoBloco(p: Omit<ComponentProps<typeof Botao>, 'cheio'>) {
  return <Botao {...p} cheio style={[estilos.alinhadoAEsquerda, p.style]} />;
}

const estilos = StyleSheet.create({
  bloco: { borderWidth: 1, borderStyle: 'dashed', borderRadius: RAIO, padding: espaco(2), gap: espaco(1.5) },
  textos: { gap: 2 },
  botoes: { gap: espaco(1), alignItems: 'stretch' },
  // O `Botao` é uma linha: o eixo principal é o horizontal, então é o `justifyContent` que leva ícone e rótulo à esquerda.
  alinhadoAEsquerda: { justifyContent: 'flex-start' },
});
