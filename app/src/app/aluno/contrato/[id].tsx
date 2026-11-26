import { useLocalSearchParams } from 'expo-router';

import { TelaDoContrato } from '../../../aluno/contratos/TelaDoContrato';

export default function ContratoDoAluno() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // A chave remonta a tela ao trocar de contrato: nome e aceite digitados nunca passam de um para outro.
  return <TelaDoContrato key={id} id={id ?? ''} />;
}
