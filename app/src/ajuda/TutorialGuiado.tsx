import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { espaco } from '../tema/tokens';
import { BarraProgresso } from '../ui/BarraProgresso';
import { Botao } from '../ui/Botao';
import { Folha } from '../ui/Folha';
import { Texto } from '../ui/Texto';
import type { PassoGuia } from './conteudo';

interface Props {
  passos: PassoGuia[];
  aoFechar: () => void;
}

/** Tutorial passo a passo numa folha: Anterior/Próximo e, quando o passo tem tela, "Abrir esta tela". */
export function TutorialGuiado({ passos, aoFechar }: Props) {
  const [indice, setIndice] = useState(0);
  const passo = passos[indice];
  if (!passo) return null;
  const ultimo = indice === passos.length - 1;
  return (
    <Folha
      visivel
      titulo="Tutorial passo a passo"
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao rotulo="Anterior" tipo="secundario" desabilitado={indice === 0} aoTocar={() => setIndice((i) => i - 1)} />
          {ultimo ? <Botao rotulo="Concluir" aoTocar={aoFechar} /> : <Botao rotulo="Próximo" aoTocar={() => setIndice((i) => i + 1)} />}
        </>
      }>
      <Texto numerico variante="suave">Passo {indice + 1} de {passos.length}</Texto>
      <BarraProgresso feitas={indice + 1} total={passos.length} />
      <View style={estilos.passo}>
        <Texto variante="bloco">{passo.titulo}</Texto>
        <Texto>{passo.texto}</Texto>
        {passo.rota ? (
          <View style={estilos.acao}>
            <Botao rotulo="Abrir esta tela" tipo="secundario" aoTocar={() => { aoFechar(); router.navigate(passo.rota as Href); }} />
          </View>
        ) : null}
      </View>
    </Folha>
  );
}

const estilos = StyleSheet.create({
  passo: { gap: espaco(1.25) },
  acao: { flexDirection: 'row' },
});
