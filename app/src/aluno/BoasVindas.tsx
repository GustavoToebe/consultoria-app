import { useState } from 'react';

import { passoDasBoasVindas } from '../dominio/boasVindas';
import { Botao } from '../ui/Botao';
import { Folha } from '../ui/Folha';
import { Texto } from '../ui/Texto';
import { PASSOS_DAS_BOAS_VINDAS as PASSOS, useBoasVindas } from './SituacaoDasBoasVindas';

/**
 * Três telas curtas no primeiro acesso do aluno (Treino de hoje, Dieta, Atualização), com o texto do guia. Pular,
 * fechar ou chegar ao fim conta como visto (`dispensar` do `ProvedorDasBoasVindas`, que também guarda a marca e diz
 * quando abrir). A `Folha` não anima a entrada nem a troca de tela, então o movimento reduzido já é respeitado. Quem
 * monta já checou o aceite dos termos (o aluno só chega aqui depois dele).
 */
export function BoasVindas() {
  const { situacao, dispensar } = useBoasVindas();
  const [indice, setIndice] = useState(0);

  if (situacao !== 'aberta') return null;
  const passo = passoDasBoasVindas(indice, PASSOS.length);
  const atual = PASSOS[passo.indice];
  return (
    <Folha
      visivel
      titulo={atual.titulo}
      aoFechar={dispensar}
      rodape={
        <>
          {passo.ultimo ? null : <Botao rotulo="Pular" tipo="fantasma" aoTocar={dispensar} />}
          <Botao rotulo={passo.rotuloProximo} aoTocar={passo.ultimo ? dispensar : () => setIndice(passo.indice + 1)} />
        </>
      }>
      <Texto variante="pequeno">{`Boas-vindas · ${passo.progresso}`}</Texto>
      <Texto>{atual.texto}</Texto>
    </Folha>
  );
}
