import { cicloDaAluna } from '../api/rotas';
import { ehCicloDesligado } from '../dominio/cicloDesligado';
import { useAluno } from '../offline/AlunoProvider';
import { useSessao } from '../sessao/SessaoProvider';
import { useCarregar } from '../ui/useCarregar';
import { useVersaoDoSexo } from './versaoDoSexo';

/**
 * O ciclo não fica no aparelho. Sem internet a chave é nula e a tela diz que precisa de conexão. Com o módulo desligado na
 * plataforma (`cicloHabilitado` falso no `/eu`) nada é consultado e `habilitado` vem falso: quem usa o hook some.
 * Se o perfil ainda dizia "ligado" e o servidor responde 503 `CICLO_INDISPONIVEL_NO_APP`, o cliente avisa a sessão (que
 * desliga a chave) e, no instante entre uma coisa e outra, o erro não aparece: `erro` fica indefinido.
 */
export function useCicloDaAluna() {
  const { online } = useAluno();
  const { cicloHabilitado } = useSessao();
  // O sexo salvo em "Meus dados" muda a disponibilidade (decidida no servidor): a versão na chave consulta de novo.
  const versaoDoSexo = useVersaoDoSexo();
  const carga = useCarregar(online && cicloHabilitado ? `aluno-ciclo:${versaoDoSexo}` : null, () => cicloDaAluna());
  return {
    ...carga,
    // Chave desligada: o que foi carregado antes não vale mais (o `useCarregar` guarda os dados da chave anterior).
    dados: cicloHabilitado ? carga.dados : undefined,
    erro: ehCicloDesligado(carga.erro) ? undefined : carga.erro,
    online,
    habilitado: cicloHabilitado,
  };
}
