import { Utensils } from 'lucide-react-native';

import type { ConteudoDieta, VersaoDetalhe } from '../api/tipos';
import { normalizarDieta, resumoDaDietaNoInicio } from '../dominio/dieta';
import { ItemDeLista } from '../ui/ItemDeLista';

/**
 * Atalho para a dieta no início do aluno, com as refeições e a água por dia (pedido do Saraiva em 17/10: o aluno vê a
 * dieta e a água de cara, sem procurar a aba). Sem dieta publicada, não aparece.
 */
export function CartaoDietaDoInicio({ versao }: { versao: VersaoDetalhe<ConteudoDieta> | null | undefined }) {
  if (!versao) return null;
  return <ItemDeLista titulo="Dieta" detalhe={resumoDaDietaNoInicio(normalizarDieta(versao.conteudo))} Icone={Utensils} href="/aluno/dieta" />;
}
