/**
 * Boas-vindas do aluno: 3 telas curtas no primeiro acesso, que podem ser puladas. A regra de quando mostrar e de como
 * andar entre as telas fica aqui; a tela só desenha.
 */

/** Chave local por usuário; `aoSair` a apaga junto com o resto do que é do aparelho. */
export const chaveBoasVindas = (usuarioId: string) => `treinos:${usuarioId}:boasVindasVistas`;

/**
 * Mostra só depois de ler a marca "já vistas" (sem piscar para quem já viu) e se ela não existe. Falha na leitura conta
 * como "já vistas": melhor não mostrar do que prender a pessoa numa tela que ela não consegue dispensar.
 */
export function deveMostrarBoasVindas(leitura: 'lendo' | 'falhou' | { valor: string | null }, passos: number): boolean {
  if (passos <= 0 || leitura === 'lendo' || leitura === 'falhou') return false;
  return !leitura.valor;
}

export interface PassoDasBoasVindas { indice: number; ultimo: boolean; rotuloProximo: 'Próximo' | 'Começar'; progresso: string }

/** Onde a pessoa está: "1 de 3", e o botão principal vira "Começar" na última tela. */
export function passoDasBoasVindas(indice: number, total: number): PassoDasBoasVindas {
  const i = Math.min(Math.max(indice, 0), Math.max(total - 1, 0));
  const ultimo = i >= total - 1;
  return { indice: i, ultimo, rotuloProximo: ultimo ? 'Começar' : 'Próximo', progresso: `${i + 1} de ${total}` };
}
