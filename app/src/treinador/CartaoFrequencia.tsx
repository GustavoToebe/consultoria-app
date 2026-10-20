import { StyleSheet, View } from 'react-native';

import { execucoesDoAluno, listarPastas, pastaVigenteDoAluno } from '../api/rotas';
import type { PastaResumo } from '../api/tipos';
import { dataCurta, hojeIso } from '../dominio/formatos';
import { frequenciaDe, planejarFrequencia, textoDaContagem, type Frequencia } from '../dominio/frequencia';
import { useSessao } from '../sessao/SessaoProvider';
import { espaco } from '../tema/tokens';
import { Cartao } from '../ui/Cartao';
import { CampoLeitura } from '../ui/CampoLeitura';
import { Esqueleto } from '../ui/Esqueleto';
import { MensagemErro } from '../ui/Estados';
import { textoDoErro } from '../ui/erros';
import { useCarregar } from '../ui/useCarregar';

export interface AcompanhamentoDoAluno {
  alunoId: string;
  /** Pasta vigente (a do treino ativo, senão a da dieta ativa); nula = nenhuma. */
  pasta: PastaResumo | null;
  /** Todas as pastas do aluno (o resumo só sugere renovar quando a do próximo ciclo ainda não existe). */
  pastas: PastaResumo[];
  /** Nula sem `REGISTRO_LER` (a rota de execuções exige). */
  frequencia: Frequencia | null;
}

/**
 * Uma busca só para o resumo do topo da ficha e o cartão Frequência: a pasta vigente e, com `REGISTRO_LER`, os treinos
 * da semana e da pasta (e o último registro entre eles), mais a lista de pastas. `geracao` muda quando a ficha altera as pastas.
 */
export function useAcompanhamentoDoAluno(alunoId: string, geracao = 0) {
  const { pode } = useSessao();
  const lerRegistros = pode('REGISTRO_LER');
  const hoje = hojeIso();
  const carga = useCarregar(`acompanhamento:${alunoId}:${hoje}:${lerRegistros}:${geracao}`, async (): Promise<AcompanhamentoDoAluno> => {
    const [{ pasta }, pastas] = await Promise.all([pastaVigenteDoAluno(alunoId), listarPastas(alunoId)]);
    if (!lerRegistros) return { alunoId, pasta, pastas, frequencia: null };
    const plano = planejarFrequencia(hoje, pasta);
    const dias = await execucoesDoAluno(alunoId, plano.consulta.de, plano.consulta.ate);
    return { alunoId, pasta, pastas, frequencia: frequenciaDe(dias, plano) };
  });
  // A busca anterior continua na tela até a nova chegar: só vale a do aluno em tela.
  return { ...carga, dados: carga.dados?.alunoId === alunoId ? carga.dados : undefined };
}

/**
 * Frequência na ficha: só a contagem de treinos com registro (não compara com meta nem interpreta). A semana é a corrente
 * (segunda até hoje); a pasta é a vigente do aluno, do início até hoje. Sem pasta com período, "—". Quem renderiza já
 * checou `REGISTRO_LER` e passa o resultado de `useAcompanhamentoDoAluno`.
 */
export function CartaoFrequencia({ acompanhamento }: { acompanhamento: ReturnType<typeof useAcompanhamentoDoAluno> }) {
  const { dados, erro, recarregar } = acompanhamento;
  const f = dados?.frequencia ?? null;
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
