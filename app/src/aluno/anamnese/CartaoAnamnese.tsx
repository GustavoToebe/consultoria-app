import { router } from 'expo-router';

import { mostrarCartaoAnamnese, seloDaAnamnese } from '../../dominio/anamnese';
import { Botao } from '../../ui/Botao';
import { Cartao } from '../../ui/Cartao';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { useAnamnese } from './useAnamnese';

/** No início do aluno, só com anamnese para responder. Some depois do envio. */
export function CartaoAnamnese() {
  const { dados } = useAnamnese();
  if (!dados || !mostrarCartaoAnamnese(dados)) return null;
  return <Cartao titulo="Responda sua anamnese">
    <Selo {...seloDaAnamnese(dados.situacao, true)} />
    <Texto variante="suave">Seu treinador pediu algumas informações para montar o seu acompanhamento. O rascunho fica salvo neste aparelho.</Texto>
    <Botao rotulo="Responder" aoTocar={() => router.push('/aluno/anamnese')} />
  </Cartao>;
}
