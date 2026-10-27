import { cicloDaAluna } from '../api/rotas';
import { useAluno } from '../offline/AlunoProvider';
import { useSessao } from '../sessao/SessaoProvider';
import { useCarregar } from '../ui/useCarregar';

/**
 * O ciclo não fica no aparelho. Sem internet a chave é nula e a tela diz que precisa de conexão. Com o módulo desligado na
 * plataforma (`cicloHabilitado` falso no `/eu`) nada é consultado e `habilitado` vem falso: quem usa o hook some.
 */
export function useCicloDaAluna() {
  const { online } = useAluno();
  const { cicloHabilitado } = useSessao();
  const carga = useCarregar(online && cicloHabilitado ? 'aluno-ciclo' : null, () => cicloDaAluna());
  return { ...carga, online, habilitado: cicloHabilitado };
}
