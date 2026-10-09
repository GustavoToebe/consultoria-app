import type { AtorEquipe } from '../../dominio/perfilEquipe';
import { useSessao } from '../../sessao/SessaoProvider';

/** Quem está usando a tela, para esconder o que a API recusaria. A API continua decidindo pelo banco. */
export function useAtorEquipe(): AtorEquipe {
  const {perfilEquipe,usuario,pode}=useSessao();
  return {administrador:!!perfilEquipe?.acessoTotal,perfilId:perfilEquipe?.id??null,usuarioId:usuario?.id??null,tem:pode};
}
