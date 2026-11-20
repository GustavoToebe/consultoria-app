import { Ellipsis, Plus } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useFecharComAviso } from '../../comunidade/useFecharComAviso';
import { PLAYLIST_NOME_MAXIMO } from '../../dominio/comunidade';
import { espaco, LARGURA_FORMULARIO } from '../../tema/tokens';
import { AlcaDeArraste, type ArrasteDaLista } from '../../ui/ArrasteDaLista';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { IconeBotao } from '../../ui/IconeBotao';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';
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
 * Uma coleção na aba Vídeos (D2, 19/11): seção sem cartão em volta (os vídeos já são cartões), com o cabeçalho (alça de
 * arrastar, nome em h2, "N vídeos", "Adicionar vídeo" e o ⋯) e a grade embaixo. "Sem coleção" usa a mesma seção sem
 * ⋯, alça nem "Adicionar vídeo" (não tem ordem nem dá para escolhê-la ao publicar).
 */
export function SecaoDaColecao({ nome, resumo, renomear, aoAdicionar, aoMenu, alca, children }: {
  nome: string;
  resumo: string;
  renomear?: RenomearNoTitulo;
  /** "Adicionar vídeo" do cabeçalho (com a coleção escolhida); ausente sem permissão, na "Sem coleção" e na coleção vazia. */
  aoAdicionar?: () => void;
  aoMenu?: () => void;
  alca?: { lista: ArrasteDaLista; indice: number };
  children: ReactNode;
}) {
  // Cancelar com outro nome digitado pergunta "Sair sem salvar?" (D1, como na antiga folha das coleções).
  const { fechar, aviso } = useFecharComAviso(!!renomear, !!renomear && renomear.valor !== nome, () => renomear?.aoCancelar());
  return (
    <View style={estilos.secao}>
      {renomear ? (
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
        <View style={estilos.cabecalho}>
          <View style={estilos.titulo}>
            {alca ? <AlcaDeArraste arraste={alca.lista} indice={alca.indice} /> : null}
            <View style={estilos.nome}>
              {/* 18/24: o título da seção fica acima do título do cartão (16), como manda a escala da 4.3. */}
              <Texto variante="bloco" nivel={2} style={estilos.texto}>{nome}</Texto>
              <Texto variante="suave">{resumo}</Texto>
            </View>
          </View>
          {aoAdicionar || aoMenu ? (
            <View style={estilos.acoes}>
              {aoAdicionar ? <Botao rotulo="Adicionar vídeo" rotuloAcessivel={`Adicionar vídeo à coleção ${nome}`} tipo="acao" Icone={Plus} aoTocar={aoAdicionar} /> : null}
              {aoMenu ? <IconeBotao Icone={Ellipsis} rotulo={rotuloDoMenuDaColecao(nome)} aoTocar={aoMenu} /> : null}
            </View>
          ) : null}
        </View>
      )}
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  // 8 px entre o cabeçalho e a grade; entre as seções a lista põe 24 (o triplo).
  secao: { gap: espaco(1) },
  cabecalho: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: espaco(2), rowGap: espaco(1) },
  titulo: { flexDirection: 'row', alignItems: 'center', gap: espaco(0.5), flexShrink: 1, minWidth: 0 },
  nome: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: espaco(1.5), flexShrink: 1, minWidth: 0 },
  texto: { fontSize: 18, lineHeight: 24 },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), marginLeft: 'auto' },
  renomear: { gap: espaco(1.5), maxWidth: LARGURA_FORMULARIO },
});
