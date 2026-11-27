import { FormContato } from '../../marca/FormContato';
import { TelaDaConsultoria } from './TelaDaConsultoria';

/** Contato da consultoria: WhatsApp, e-mails do app e redes sociais (Configurações › Contato; saiu da Marca em 27/11). */
export function TelaContato() {
  return <TelaDaConsultoria titulo="Contato" descricao="Como o aluno fala com você, onde ele te segue e de quem os e-mails do app parecem vir." formulario={(p) => <FormContato {...p} />} />;
}
