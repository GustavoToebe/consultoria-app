import { StyleSheet, View } from 'react-native';

import { espaco } from '../../../tema/tokens';
import { MeuPerfilEquipe } from '../../../treinador/equipe/MeuPerfilEquipe';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Tela } from '../../../ui/Tela';
import { TrocarSenha } from '../../../ui/TrocarSenha';

/**
 * Largura máxima de cada cartão (Gustavo, 28/11: ~560 px). Dois lado a lado pedem 2 × 560 + o vão = 1144 px de área; abaixo
 * disso eles empilham sozinhos pelo `flexWrap`, sem medir. Os campos nunca esticam além do cartão.
 */
const LARGURA_DO_CARTAO = 560;
const VAO = espaco(3);

/**
 * Meus dados (28/11): dois cartões, "Seus dados" (o e-mail de entrada só leitura na primeira linha, nome, telefone e o
 * perfil da equipe como selo) e "Trocar senha" (some sem conexão). Lado a lado e alinhados à esquerda; a sobra da área
 * fica à direita, vazia. Na mesma linha os dois têm a mesma altura e os botões, no rodapé, ficam na mesma base.
 * Aberta pelo cartão do usuário e por Configurações › Meus dados.
 */
export function TelaMeusDados() {
  return (
    <Tela bordas={['top']}>
      <Cabecalho titulo="Meus dados" descricao="Seu e-mail de entrada, seu nome na equipe e sua senha." />
      <View style={estilos.cartoes}>
        <MeuPerfilEquipe style={estilos.cartao} />
        <TrocarSenha style={estilos.cartao} />
      </View>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  cartoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: VAO },
  cartao: { width: '100%', maxWidth: LARGURA_DO_CARTAO },
});
