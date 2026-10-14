import { StyleSheet, View } from 'react-native';

import { execucoesDoAluno, pastaVigenteDoAluno } from '../api/rotas';
import { dataCurta, hojeIso } from '../dominio/formatos';
import { frequenciaDe, planejarFrequencia, textoDaContagem } from '../dominio/frequencia';
import { espaco } from '../tema/tokens';
import { Cartao } from '../ui/Cartao';
import { CampoLeitura } from '../ui/CampoLeitura';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { useCarregar } from '../ui/useCarregar';

/**
 * Frequência na ficha: só a contagem de treinos com registro (não compara com meta nem interpreta). A semana é a corrente
 * (segunda até hoje); a pasta é a vigente do aluno, do início até hoje. Sem pasta com período, "—". Quem renderiza já
 * checou `REGISTRO_LER` (a rota de execuções exige).
 */
export function CartaoFrequencia({ alunoId }: { alunoId: string }) {
  const hoje = hojeIso();
  const { dados, erro, recarregar } = useCarregar(`frequencia:${alunoId}:${hoje}`, async () => {
    const { pasta } = await pastaVigenteDoAluno(alunoId);
    const plano = planejarFrequencia(hoje, pasta);
    const dias = await execucoesDoAluno(alunoId, plano.consulta.de, plano.consulta.ate);
    return { alunoId, frequencia: frequenciaDe(dias, plano) };
  });
  // A busca anterior continua na tela até a nova chegar: só vale a do aluno em tela.
  const f = dados?.alunoId === alunoId ? dados.frequencia : undefined;
  const pasta = f?.pasta ?? null;
  return (
    <Cartao titulo="Frequência" descricao="Treinos com registro do aluno. Só contagem.">
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!f && !erro ? <Esqueleto /> : null}
      {f ? (
        <View style={estilos.linha}>
          <CampoLeitura rotulo="Esta semana" valor={textoDaContagem(f.semana)} numerico />
          <CampoLeitura
            rotulo={pasta ? `Na pasta ${pasta.titulo} (${dataCurta(pasta.de)} a ${dataCurta(pasta.ate)}${pasta.limitada ? ', últimos 12 meses' : ''})` : 'Na pasta vigente'}
            valor={textoDaContagem(pasta ? pasta.treinos : null)}
            numerico
          />
        </View>
      ) : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({ linha: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(3) } });
