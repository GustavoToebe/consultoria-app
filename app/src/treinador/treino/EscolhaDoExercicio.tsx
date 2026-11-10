import type { Configuracao, Sessao } from '../../api/tipos';
import { linhaDoExercicio } from '../../dominio/inspetorDoTreino';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { useRolagem } from '../../ui/RolagemComTopo';
import { ESPERA_DA_SELECAO } from './ContadoresDoTreino';

/**
 * Celular (uma coluna), sessão com 3 ou mais exercícios: "Exercício aberto" no topo da lista abre a folha com todos
 * (número, nome e a linha das séries). Escolher abre só aquele cartão e rola até ele, sem descer a lista inteira (10/11).
 */
export function EscolhaDoExercicio({ sessao, config, escolhido, aoEscolher }: {
  sessao: Sessao;
  config: Configuracao | null;
  escolhido: string | null;
  aoEscolher: (uid: string) => void;
}) {
  const { rolarAte } = useRolagem();
  const opcoes = sessao.exercicios.map((e, i) => ({ valor: e.uid, rotulo: `${i + 1}. ${e.nome || 'Exercício sem nome'}`, detalhe: linhaDoExercicio(e, config) }));
  return (
    <EscolhaEmFolha<string | null> rotulo="Exercício aberto" titulo="Abrir exercício" valor={escolhido} rotuloDoValor="Nenhum aberto" opcoes={opcoes}
      aoMudar={(uid) => {
        if (!uid) return;
        aoEscolher(uid);
        // Depois de o cartão abrir: o alvo de rolagem é o próprio cartão (`AlvoDeRolagem chave={uid}`).
        setTimeout(() => rolarAte([uid]), ESPERA_DA_SELECAO);
      }} />
  );
}
