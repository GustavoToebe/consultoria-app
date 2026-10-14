import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { GUIAS } from '../ajuda/conteudo';
import { chaveBoasVindas, deveMostrarBoasVindas, passoDasBoasVindas } from '../dominio/boasVindas';
import { useSessao } from '../sessao/SessaoProvider';
import { Botao } from '../ui/Botao';
import { Folha } from '../ui/Folha';
import { Texto } from '../ui/Texto';

const PASSOS = GUIAS.aluno.boasVindas ?? [];

/**
 * Três telas curtas no primeiro acesso do aluno (Treino de hoje, Dieta, Atualização), com o texto do guia. Pular, fechar
 * ou chegar ao fim conta como visto, e a marca fica no aparelho por usuário; `aoSair` a apaga, então ela volta depois
 * de sair e entrar. Nada aparece antes de ler a marca. A `Folha` não anima a entrada nem a troca de tela, então o
 * movimento reduzido já é respeitado. Quem monta já checou o aceite dos termos (o aluno só chega aqui depois dele).
 */
export function BoasVindas({ usuarioId }: { usuarioId: string }) {
  const { aoSair } = useSessao();
  const [leitura, setLeitura] = useState<'lendo' | 'falhou' | { valor: string | null }>('lendo');
  const [dispensada, setDispensada] = useState(false);
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    let ativo = true;
    AsyncStorage.getItem(chaveBoasVindas(usuarioId))
      .then((valor) => ativo && setLeitura({ valor }))
      .catch(() => ativo && setLeitura('falhou'));
    return () => { ativo = false; };
  }, [usuarioId]);

  useEffect(() => aoSair((id) => AsyncStorage.removeItem(chaveBoasVindas(id)).catch(() => undefined)), [aoSair]);

  if (dispensada || !deveMostrarBoasVindas(leitura, PASSOS.length)) return null;
  const passo = passoDasBoasVindas(indice, PASSOS.length);
  const atual = PASSOS[passo.indice];
  const concluir = () => {
    setDispensada(true);
    AsyncStorage.setItem(chaveBoasVindas(usuarioId), '1').catch(() => undefined);
  };
  return (
    <Folha
      visivel
      titulo={atual.titulo}
      aoFechar={concluir}
      rodape={
        <>
          {passo.ultimo ? null : <Botao rotulo="Pular" tipo="fantasma" aoTocar={concluir} />}
          <Botao rotulo={passo.rotuloProximo} aoTocar={passo.ultimo ? concluir : () => setIndice(passo.indice + 1)} />
        </>
      }>
      <Texto variante="pequeno">{`Boas-vindas · ${passo.progresso}`}</Texto>
      <Texto>{atual.texto}</Texto>
    </Folha>
  );
}
