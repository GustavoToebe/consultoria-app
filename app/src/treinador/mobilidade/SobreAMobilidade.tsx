import { StyleSheet, View } from 'react-native';

import { espaco, LARGURA_EDITOR, LARGURA_TEXTO_CORRIDO } from '../../tema/tokens';
import { Campo } from '../../ui/Campo';
import { CampoQueCresce } from '../../ui/CampoQueCresce';
import { Cartao } from '../../ui/Cartao';

/** Limite das orientações (o `@Size(max = 2000)` de `receitas/ConteudoMobilidade` na API). */
const ORIENTACOES_MAXIMO = 2000;

/**
 * Orientações do plano ou do modelo de mobilidade (26/11): um campo normal, na largura de leitura, que nasce com 2 linhas e
 * cresce com o texto (até 2.000 caracteres). Antes ficavam recolhidas atrás de um "Orientações ⌄" com o começo do texto.
 */
export function OrientacoesDaMobilidade({ valor, aoMudar }: { valor: string; aoMudar: (orientacoes: string) => void }) {
  return (
    <View style={estilos.orientacoes}>
      <CampoQueCresce rotulo="Orientações (opcional)" valor={valor} linhas={2} maximoDeLinhas={12} maxLength={ORIENTACOES_MAXIMO}
        ajuda="O aluno lê antes das seções." aoMudar={aoMudar} />
    </View>
  );
}

/**
 * Topo do editor do modelo de mobilidade: um cartão só, "Sobre o modelo". Linha 1: Nome (~40%) e Descrição (~60%) lado a
 * lado, alinhados pelo topo (empilhados quando não cabem); a Descrição nasce com 1 linha, da altura do Nome, e cresce até 4.
 * Linha 2: as Orientações, na largura de leitura. Nome e descrição são da receita (o `EditorModelo` os guarda); as
 * orientações, do conteúdo.
 */
export function SobreOModelo({ nome, descricao, maximoDaDescricao, erroDoNome, orientacoes, aoMudarNome, aoMudarDescricao, aoMudarOrientacoes }: {
  nome: string;
  descricao: string;
  maximoDaDescricao: number;
  erroDoNome: string | null;
  orientacoes: string;
  aoMudarNome: (nome: string) => void;
  aoMudarDescricao: (descricao: string) => void;
  aoMudarOrientacoes: (orientacoes: string) => void;
}) {
  return (
    <Cartao titulo="Sobre o modelo">
      <View style={estilos.campos}>
        <View style={estilos.nome}>
          <Campo rotulo="Nome do modelo" valor={nome} aoMudar={aoMudarNome} maxLength={120} erro={erroDoNome} />
        </View>
        <View style={estilos.descricao}>
          <CampoQueCresce rotulo="Descrição (opcional)" valor={descricao} linhas={1} maximoDeLinhas={4} maxLength={maximoDaDescricao} aoMudar={aoMudarDescricao} />
        </View>
      </View>
      <OrientacoesDaMobilidade valor={orientacoes} aoMudar={aoMudarOrientacoes} />
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  orientacoes: { maxWidth: LARGURA_TEXTO_CORRIDO },
  // Tela larga (24/11): Nome e Descrição param no teto do nome do modelo de treino (`NomeDoModeloDeTreino`), sem esticar.
  campos: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: espaco(2), rowGap: espaco(2), maxWidth: LARGURA_EDITOR },
  // 40% e 60% da linha (o vão sai das duas); abaixo de ~600 px de cartão a Descrição desce para baixo do Nome.
  nome: { flexGrow: 2, flexShrink: 1, flexBasis: 220, minWidth: 0 },
  descricao: { flexGrow: 3, flexShrink: 1, flexBasis: 330, minWidth: 0 },
});
