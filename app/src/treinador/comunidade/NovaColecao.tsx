import { Plus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useFecharComAviso } from '../../comunidade/useFecharComAviso';
import { PLAYLIST_NOME_MAXIMO } from '../../dominio/comunidade';
import { espaco, LARGURA_FORMULARIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { AJUDA_DO_NOME_DA_COLECAO } from './SecaoDaColecao';
import type { ColecoesDaEquipe } from './useColecoesDaEquipe';

/**
 * "+ Nova coleção" no fim da aba (D2 e D3, 19/11): o botão abre o campo ali mesmo, sem folha; a coleção nasce vazia e
 * entra por último. O erro do nome (vazio, longo, repetido) fica no campo. Cancelar com um nome digitado pergunta "Sair
 * sem salvar?" (D1, a mesma regra da antiga folha).
 */
export function NovaColecao({ c }: { c: ColecoesDaEquipe }) {
  const { fechar, aviso } = useFecharComAviso(c.nova !== null, !!c.nova?.trim(), c.fecharNova);
  if (c.nova === null) {
    return (
      <LinhaDeAcoes>
        <Botao rotulo="Nova coleção" tipo="acao" Icone={Plus} aoTocar={c.abrirNova} />
      </LinhaDeAcoes>
    );
  }
  return (
    <View style={estilos.bloco}>
      <Campo rotulo="Nome da nova coleção" valor={c.nova} maxLength={PLAYLIST_NOME_MAXIMO} ajuda={AJUDA_DO_NOME_DA_COLECAO} erro={c.erroDaNova}
        autoFocus aoMudar={c.mudarNova} onSubmitEditing={() => void c.criar()} />
      <LinhaDeAcoes>
        <Botao rotulo="Cancelar" tipo="secundario" aoTocar={fechar} />
        <Botao rotulo="Criar coleção" tipo="primario" carregando={c.criando} aoTocar={() => void c.criar()} />
      </LinhaDeAcoes>
      {aviso}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(1.5), maxWidth: LARGURA_FORMULARIO },
});
