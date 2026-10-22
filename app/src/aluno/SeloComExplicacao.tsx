import { useState } from 'react';
import { Pressable } from 'react-native';

import { ALVO_TOQUE } from '../tema/tokens';
import { Folha } from '../ui/Folha';
import { Selo } from '../ui/Selo';
import { Texto } from '../ui/Texto';

/**
 * Selo que abre a explicação ao toque (tipo da série, técnica ou combinação de exercícios). A explicação é a que o
 * treinador escreveu na metodologia; sem ela, a folha diz que não há.
 */
export function SeloComExplicacao({ nome, explicacao, rotuloAcessivel }: { nome: string; explicacao: string | null; rotuloAcessivel: string }) {
  const [aberto, abrir] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={rotuloAcessivel} onPress={() => abrir(true)} style={{ minHeight: ALVO_TOQUE, justifyContent: 'center' }}>
        <Selo texto={nome} tipo="neutro" />
      </Pressable>
      <Folha visivel={aberto} titulo={nome} aoFechar={() => abrir(false)}>
        {explicacao ? <Texto>{explicacao}</Texto> : <Texto variante="suave">Seu treinador não escreveu uma explicação para este item.</Texto>}
      </Folha>
    </>
  );
}
