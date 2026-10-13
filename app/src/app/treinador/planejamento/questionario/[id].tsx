import { useLocalSearchParams } from 'expo-router';

import { EditorQuestionario } from '../../../../treinador/questionarios/EditorQuestionario';

export default function Questionario() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditorQuestionario key={id} id={id} />;
}
