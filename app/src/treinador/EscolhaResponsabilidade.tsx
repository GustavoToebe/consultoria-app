import { Escolha } from '../ui/Escolha';

export type Responsabilidade = 'todos' | 'meus';

/** Ordem e rótulos únicos do filtro de responsabilidade (padrão das telas: "Todos / Meus", nessa ordem). */
export const OPCOES_RESPONSABILIDADE: { valor: Responsabilidade; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'meus', rotulo: 'Meus' },
];

/**
 * Filtro "Todos / Meus" das listas do dia a dia (Início, Alunos, Atualizações, Interessados): o mesmo controle, a
 * mesma ordem e os mesmos rótulos em todas. "Meus" = os alunos (ou inscrições) com você como responsável; é só
 * preferência de listagem, não restringe acesso.
 */
export function EscolhaResponsabilidade({ valor, aoMudar }: { valor: Responsabilidade; aoMudar: (v: Responsabilidade) => void }) {
  return <Escolha rotulo="Responsável" opcoes={OPCOES_RESPONSABILIDADE} valor={valor} aoMudar={aoMudar} />;
}
