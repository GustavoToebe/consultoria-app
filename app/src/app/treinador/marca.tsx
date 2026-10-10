import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { consultoria } from '../../api/rotas';
import { espaco, LARGURA_EDITOR } from '../../tema/tokens';
import { FormMarca } from '../../treinador/marca/FormMarca';
import { Cabecalho } from '../../ui/Cabecalho';
import { Esqueleto } from '../../ui/Esqueleto';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

/** Marca (nome, cor, fonte, tema, logo) com prévia ao vivo, e a metodologia da consultoria (seção 10.4, item 8). */
export default function Marca() {
  const { dados, erro, carregando, recarregar, definir } = useCarregar('consultoria', () => consultoria());
  // Conflito (outra aba salvou): recarrega e recria o formulário com os valores atuais.
  const [conflitos, setConflitos] = useState(0);
  return (
    <Tela bordas={['top']} largura={LARGURA_EDITOR}>
      <Cabecalho titulo="Marca" mostrarMarca="celular" />
      <Texto variante="suave">Nome, logo, cor e tema que os seus alunos veem no app.</Texto>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados ? (
        <View style={estilos.coluna}>
          <FormMarca
            key={conflitos ? `${conflitos}:${dados.versao}` : 0}
            consultoria={dados}
            aoSalvar={definir}
            aoConflito={() => {
              recarregar();
              setConflitos((n) => n + 1);
            }}
          />
        </View>
      ) : null}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2) },
});
