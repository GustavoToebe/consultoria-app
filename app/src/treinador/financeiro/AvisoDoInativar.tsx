import { StyleSheet, View } from 'react-native';

import { resumoDaSaidaDoAluno } from '../../api/rotas';
import { linhasDoPainelDeInativar } from '../../dominio/saidaDoPlano';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco } from '../../tema/tokens';
import { Esqueleto } from '../../ui/Esqueleto';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';

/**
 * O que inativar faz com as cobranças do aluno, no painel de inativar da ficha. Monte só com o painel aberto (busca a
 * cada abertura). O resumo (`resumoDaSaidaDoAluno`) só é pedido com o financeiro ligado e `FINANCEIRO_LER`; sem isso, ou
 * se a busca falhar, fica o texto genérico, sem valores. Nada em aberto e sem mínimo = nenhuma linha. Não segura o
 * botão de inativar.
 */
export function AvisoDoInativar({ alunoId }: { alunoId: string }) {
  const { pode, pagamentosHabilitados } = useSessao();
  const podeLerFinanceiro = pode('FINANCEIRO_LER');
  const resumo = useCarregar(podeLerFinanceiro && pagamentosHabilitados ? `resumo-da-saida:${alunoId}` : null, () => resumoDaSaidaDoAluno(alunoId));
  if (resumo.carregando && !resumo.dados) return <Esqueleto />;
  const linhas = linhasDoPainelDeInativar(resumo.dados, { podeLerFinanceiro, financeiroLigado: pagamentosHabilitados });
  if (linhas.length === 0) return null;
  return (
    <View style={estilos.bloco}>
      {linhas.map((l) => <Texto key={l} variante="suave">{l}</Texto>)}
    </View>
  );
}

const estilos = StyleSheet.create({
  bloco: { gap: espaco(0.75) },
});
