import { Redirect } from 'expo-router';

import { useCartoesDoPerfil, useDuasColunas } from '../../treinador/configuracoes/comum';
import { TelaRegrasDeAtencao } from '../../treinador/regras/TelaRegrasDeAtencao';

/**
 * Rota inteira das regras de atenção: no celular (e abaixo de 1024 px de janela) é a tela, com a seta e a trilha; no PC
 * (a mesma `useDuasColunas` do `TelaDoItem`, para os dois nunca discordarem) devolve ao item dentro de Configurações, que
 * é onde a tela mora desde 28/11. Com a chave desligada o item não existe lá: fica aqui, dizendo que não está ativo.
 */
export default function RegrasDeAtencaoTreinador() {
  const duas = useDuasColunas();
  const noMenu = useCartoesDoPerfil().some((c) => c.id === 'regras-de-atencao');
  if (duas && noMenu) return <Redirect href="/treinador/configuracoes/regras-de-atencao" />;
  return <TelaRegrasDeAtencao />;
}
