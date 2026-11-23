import { Ellipsis, Plus } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { CabecalhoDaColecao, VAO_DO_CABECALHO } from '../../comunidade/CabecalhoDaColecao';
import { useFecharComAviso } from '../../comunidade/useFecharComAviso';
import type { TextosDoCabecalho } from '../../dominio/cabecalhoDaColecao';
import { PLAYLIST_NOME_MAXIMO } from '../../dominio/comunidade';
import { espaco, LARGURA_FORMULARIO } from '../../tema/tokens';
import { AlcaDeArraste, type ArrasteDaLista, ItemArrastavel } from '../../ui/ArrasteDaLista';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { rotuloDoMenuDaColecao } from './useColecoesDaEquipe';

export const AJUDA_DO_NOME_DA_COLECAO = `Até ${PLAYLIST_NOME_MAXIMO} caracteres.`;

/** Renomear no próprio título (D2): o campo toma o lugar do nome até salvar ou cancelar. */
export interface RenomearNoTitulo {
  valor: string;
  erro: string | null;
  salvando: boolean;
  aoMudar: (nome: string) => void;
  aoSalvar: () => void;
  aoCancelar: () => void;
}

/**
 * Uma coleção na aba Vídeos (D2, 19/11; cabeçalho de coleção, 23/11): seção sem cartão em volta (os vídeos já são cartões),
 * com o `CabecalhoDaColecao` (alça, "COLEÇÃO N", nome, pílula "N vídeos", "Adicionar vídeo" e o ⋯) e a grade 16 px abaixo.
 * "Sem coleção" usa a mesma seção sem ⋯, alça nem "Adicionar vídeo" (não tem ordem nem dá para escolhê-la ao publicar). No
 * arraste da seção só o cabeçalho se move; a seção inteira continua sendo o alvo, para a linha guia cair entre as seções.
 */
export function SecaoDaColecao({ nome, textos, renomear, aoAdicionar, aoMenu, alca, children }: {
  /** O nome da coleção ("Sem coleção" na que não é coleção), nos rótulos do ⋯, do "Adicionar vídeo" e do campo. */
  nome: string;
  textos: TextosDoCabecalho;
  renomear?: RenomearNoTitulo;
  /** "Adicionar vídeo" do cabeçalho (com a coleção escolhida); ausente sem permissão, na "Sem coleção" e na coleção vazia. */
  aoAdicionar?: () => void;
  aoMenu?: () => void;
  alca?: { lista: ArrasteDaLista; indice: number };
  children: ReactNode;
}) {
  // Cancelar com outro nome digitado pergunta "Sair sem salvar?" (D1, como na antiga folha das coleções).
  const { fechar, aviso } = useFecharComAviso(!!renomear, !!renomear && renomear.valor !== nome, () => renomear?.aoCancelar());
  const cabecalho = renomear ? (
    <View style={estilos.renomear}>
      <Campo rotulo={`Nome da coleção ${nome}`} valor={renomear.valor} maxLength={PLAYLIST_NOME_MAXIMO} ajuda={AJUDA_DO_NOME_DA_COLECAO}
        erro={renomear.erro} autoFocus onSubmitEditing={renomear.aoSalvar} aoMudar={renomear.aoMudar} />
      <LinhaDeAcoes>
        <Botao rotulo="Cancelar" tipo="secundario" aoTocar={fechar} />
        <Botao rotulo="Salvar nome" tipo="primario" carregando={renomear.salvando} aoTocar={renomear.aoSalvar} />
      </LinhaDeAcoes>
      {aviso}
    </View>
  ) : (
    <CabecalhoDaColecao textos={textos}
      inicio={alca ? <AlcaDeArraste arraste={alca.lista} indice={alca.indice} /> : null}
      acoes={aoAdicionar || aoMenu ? (
        <>
          {aoAdicionar ? <Botao rotulo="Adicionar vídeo" rotuloAcessivel={`Adicionar vídeo à coleção ${nome}`} tipo="acao" Icone={Plus} aoTocar={aoAdicionar} /> : null}
          {aoMenu ? <IconeBotao Icone={Ellipsis} rotulo={rotuloDoMenuDaColecao(nome)} aoTocar={aoMenu} /> : null}
        </>
      ) : null} />
  );
  return (
    // shortcut: o `ItemArrastavel` do cabeçalho registra o cabeçalho como alvo, e este `ref` (do pai, ligado depois do filho
    // no commit) troca o alvo pela seção inteira; trocar por um `alvo` separado no `ui/ArrasteDaLista` se a peça ganhar um.
    <View ref={alca ? alca.lista.alvo(alca.indice) : undefined} collapsable={false} style={estilos.secao}>
      {alca ? <ItemArrastavel arraste={alca.lista} indice={alca.indice}>{cabecalho}</ItemArrastavel> : cabecalho}
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  secao: { gap: VAO_DO_CABECALHO },
  renomear: { gap: espaco(1.5), maxWidth: LARGURA_FORMULARIO },
});
