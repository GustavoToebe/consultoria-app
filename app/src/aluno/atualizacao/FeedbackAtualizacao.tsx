import type { Atualizacao } from '../../api/tipos';
import { dataHoraParaTela } from '../../dominio/formatos';
import { Cartao } from '../../ui/Cartao';
import { Texto } from '../../ui/Texto';

export function FeedbackAtualizacao({feedback}: {feedback:Atualizacao['feedback']}) {
  if (!feedback) return null;
  return <Cartao titulo="Feedback do treinador">
    <Texto>{feedback.texto}</Texto>
    <Texto variante="pequeno">Enviado em {dataHoraParaTela(feedback.em)}</Texto>
    {feedback.editadoEm?<Texto variante="pequeno">Editado em {dataHoraParaTela(feedback.editadoEm)}</Texto>:null}
  </Cartao>;
}
