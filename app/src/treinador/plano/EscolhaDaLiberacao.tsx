import type { Ref } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { AJUDA_DO_AVISO, OPCOES_DA_LIBERACAO, rotuloDoAviso, textoDaFaixa, type EscolhaDaLiberacao } from '../../dominio/liberacaoDePlano';
import { espaco } from '../../tema/tokens';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { CampoData } from '../../ui/Campos';
import { Escolha } from '../../ui/Escolha';
import { Texto } from '../../ui/Texto';

/**
 * Quando o aluno passa a ver o que vai ser publicado (bloco E): "Liberar agora" ou "Agendar para uma data", o campo da
 * data (de amanhã em Brasília; a faixa fica na ajuda) e "Avisar o aluno", marcado por padrão nos dois modos. Usado no
 * publicar do editor e no "Publicar tudo" da pasta. O estado fica com quem usa; `erro` é o do campo (regra local ou 422 `LIBERACAO_INVALIDA`).
 */
export function EscolhaDaLiberacaoDoPlano({ valor, aoMudar, erro, refData }: {
  valor: EscolhaDaLiberacao;
  aoMudar: (v: EscolhaDaLiberacao) => void;
  erro: string | null;
  refData?: Ref<TextInput>;
}) {
  const agendar = valor.modo === 'agendar';
  return (
    <View style={estilos.bloco}>
      <Escolha rotulo="Quando o aluno vê" opcoes={[...OPCOES_DA_LIBERACAO]} valor={valor.modo} aoMudar={(modo) => aoMudar({ ...valor, modo })} />
      {agendar ? (
        <View style={estilos.campo}>
          <CampoData ref={refData} rotulo="Liberar em" valor={valor.dataTexto} erro={erro} aoMudar={(dataTexto) => aoMudar({ ...valor, dataTexto })} />
          {/* Com erro, a mensagem do campo já diz a faixa: a ajuda não se repete. */}
          <Texto variante="pequeno">{erro ? 'Até lá, o aluno continua com o que já via.' : `${textoDaFaixa()} Até lá, o aluno continua com o que já via.`}</Texto>
        </View>
      ) : null}
      <CaixaSelecao rotulo={rotuloDoAviso(valor.modo)} ajuda={AJUDA_DO_AVISO} marcado={valor.avisar}
        aoMudar={(avisar) => aoMudar({ ...valor, avisar })} />
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(2) },
  campo: { gap: espaco(0.5) },
});
