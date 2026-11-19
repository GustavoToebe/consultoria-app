import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { resumoDasOrientacoes } from '../../dominio/mobilidade';
import { espaco } from '../../tema/tokens';
import { Campo } from '../../ui/Campo';
import { Cartao } from '../../ui/Cartao';
import { Texto } from '../../ui/Texto';
import { BotaoDeAbrir } from '../treino/BotaoDeAbrir';

/** Limite das orientações (o `@Size(max = 2000)` de `receitas/ConteudoMobilidade` na API). */
const ORIENTACOES_MAXIMO = 2000;

/**
 * Orientações do plano ou do modelo de mobilidade, recolhidas dentro do cartão do topo (mobilidade no padrão do editor,
 * 19/11): nascem fechadas (regra de 18/11) e, fechadas, dizem "(vazio)" ou o começo do texto ao lado do botão, para a
 * pessoa saber o que há ali sem abrir. Abertas, o campo de sempre (até 2.000 caracteres).
 */
export function OrientacoesDaMobilidade({ valor, aoMudar }: { valor: string; aoMudar: (orientacoes: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const resumo = resumoDasOrientacoes(valor);
  return (
    <View style={estilos.orientacoes}>
      <View style={estilos.linhaDoBotao}>
        <BotaoDeAbrir texto="Orientações" rotuloAcessivel={aberto ? 'Orientações' : `Orientações: ${resumo}`} aberto={aberto} aoAlternar={() => setAberto((a) => !a)} />
        {aberto ? null : <Texto variante="suave" numberOfLines={1} aria-hidden style={estilos.resumo}>{resumo}</Texto>}
      </View>
      {aberto ? (
        <Campo rotulo="Orientações" rotuloOculto rotuloAcessivel="Orientações (opcional)" valor={valor} linhas={4} maxLength={ORIENTACOES_MAXIMO}
          ajuda="O aluno lê antes das seções (opcional)." aoMudar={aoMudar} />
      ) : null}
    </View>
  );
}

/**
 * Topo do editor do modelo de mobilidade: um cartão só, "Sobre o modelo", com Nome e Descrição (lado a lado quando cabem,
 * a descrição maior) e as Orientações recolhidas embaixo. Os dois campos vêm do `EditorModelo`, que guarda nome e
 * descrição da receita; as orientações são do conteúdo.
 */
export function SobreOModelo({ nome, descricao, orientacoes }: { nome: ReactNode; descricao: ReactNode; orientacoes: ReactNode }) {
  return (
    <Cartao titulo="Sobre o modelo">
      <View style={estilos.campos}>
        <View style={estilos.nome}>{nome}</View>
        <View style={estilos.descricao}>{descricao}</View>
      </View>
      {orientacoes}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  orientacoes: { gap: espaco(1) },
  linhaDoBotao: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), minWidth: 0 },
  resumo: { flex: 1, minWidth: 0 },
  campos: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: espaco(2), rowGap: espaco(2) },
  // Lado a lado a partir de ~600 px de cartão; a descrição é a maior.
  nome: { flexGrow: 1, flexShrink: 1, flexBasis: 240, minWidth: 0 },
  descricao: { flexGrow: 2, flexShrink: 1, flexBasis: 340, minWidth: 0 },
});
