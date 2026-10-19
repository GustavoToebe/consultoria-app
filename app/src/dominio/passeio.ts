/**
 * Passeio pelo menu: no primeiro acesso (treinador e aluno) o app destaca os itens do menu um por um, com um balão
 * explicando cada um; dá para pular e rever na Ajuda. A regra de quando mostrar, de quais passos valem e de onde o
 * balão fica mora aqui; a tela só desenha.
 */

/** Chave local por usuário. Sobrevive a sair da conta (`SOBREVIVEM_AO_SAIR`): o passeio aparece uma vez por aparelho. */
export const chavePasseio = (usuarioId: string) => `treinos:${usuarioId}:passeioVisto`;

/** Leitura da marca "já visto": ainda lendo, falhou, ou o valor guardado (nulo = nunca visto). */
export type LeituraDoPasseio = 'lendo' | 'falhou' | { valor: string | null };

/**
 * Mostra só depois de ler a marca (sem piscar para quem já viu) e se ela não existe. Falha na leitura conta como "já
 * visto": melhor não mostrar do que prender a pessoa numa tela que ela não consegue dispensar.
 */
export function deveMostrarPasseio(leitura: LeituraDoPasseio, passos: number): boolean {
  if (passos <= 0 || leitura === 'lendo' || leitura === 'falhou') return false;
  return !leitura.valor;
}

/** Onde o passeio está: lendo a marca, na tela, ou já resolvido (visto antes, falha na leitura, ou dispensado). */
export type SituacaoDoPasseio = 'lendo' | 'aberta' | 'encerrada';

/** `reaberto` = a pessoa pediu na Ajuda; vale mesmo com a marca e mesmo se a leitura falhou. */
export function situacaoDoPasseio(leitura: LeituraDoPasseio, dispensado: boolean, passos: number, reaberto = false): SituacaoDoPasseio {
  if (reaberto && passos > 0) return 'aberta';
  if (leitura === 'lendo') return 'lendo';
  return !dispensado && deveMostrarPasseio(leitura, passos) ? 'aberta' : 'encerrada';
}

/** Uma pergunta de cada vez: o lembrete da atualização só abre quando o passeio já não está nem para abrir. */
export const lembretePodeAbrir = (passeio: SituacaoDoPasseio): boolean => passeio === 'encerrada';

export interface PassoDoPasseio {
  titulo: string;
  texto: string;
  /** Item destacado (`menu:<caminho>`); sem alvo, o balão fica no meio da tela. */
  alvo?: string;
}

/**
 * Só valem os passos cujo alvo está na tela: item que o perfil não vê (Equipe sem permissão) ou que mora em outro lugar
 * nesta largura (Marca fica só no menu lateral) não vira um balão apontando para o nada.
 */
export function passosVisiveis<P extends PassoDoPasseio>(passos: readonly P[], alvos: ReadonlySet<string>): P[] {
  return passos.filter((p) => !p.alvo || alvos.has(p.alvo));
}

export interface Andamento { indice: number; primeiro: boolean; ultimo: boolean; rotuloProximo: 'Próximo' | 'Começar'; progresso: string }

/** Onde a pessoa está: "1 de 5", e o botão principal vira "Começar" no último passo. */
export function andamentoDoPasseio(indice: number, total: number): Andamento {
  const i = Math.min(Math.max(indice, 0), Math.max(total - 1, 0));
  const ultimo = i >= total - 1;
  return { indice: i, primeiro: i === 0, ultimo, rotuloProximo: ultimo ? 'Começar' : 'Próximo', progresso: `${i + 1} de ${total}` };
}

export interface Retangulo { x: number; y: number; largura: number; altura: number }
export interface Tamanho { largura: number; altura: number }
export type Lado = 'direita' | 'acima' | 'abaixo' | 'centro';

/** Espaço entre o destaque e o balão, e entre o balão e a borda da tela. */
export const MARGEM_DO_BALAO = 12;
export const LARGURA_MAXIMA_DO_BALAO = 340;

/** O balão nunca passa da tela: no máximo 340 px, e menos no celular estreito. */
export const larguraDoBalao = (area: Tamanho): number =>
  Math.max(0, Math.min(LARGURA_MAXIMA_DO_BALAO, area.largura - 2 * MARGEM_DO_BALAO));

const limitar = (valor: number, minimo: number, maximo: number) => Math.min(Math.max(valor, minimo), Math.max(minimo, maximo));

/**
 * Onde o balão fica. Item do menu lateral (alto e à esquerda): à direita dele. Barra de baixo: acima. Sem espaço
 * acima: abaixo. Sem alvo: no meio. Sempre dentro da tela, com margem.
 */
export function posicaoDoBalao(alvo: Retangulo | null, area: Tamanho, balao: Tamanho): { x: number; y: number; lado: Lado } {
  const m = MARGEM_DO_BALAO;
  const maxX = area.largura - balao.largura - m;
  const maxY = area.altura - balao.altura - m;
  if (!alvo) return { x: limitar((area.largura - balao.largura) / 2, m, maxX), y: limitar((area.altura - balao.altura) / 2, m, maxY), lado: 'centro' };
  const direita = alvo.x + alvo.largura + m;
  if (alvo.x + alvo.largura < area.largura / 2 && direita + balao.largura + m <= area.largura) {
    return { x: direita, y: limitar(alvo.y + alvo.altura / 2 - balao.altura / 2, m, maxY), lado: 'direita' };
  }
  const x = limitar(alvo.x + alvo.largura / 2 - balao.largura / 2, m, maxX);
  if (alvo.y - m - balao.altura >= m) return { x, y: alvo.y - m - balao.altura, lado: 'acima' };
  return { x, y: limitar(alvo.y + alvo.altura + m, m, maxY), lado: 'abaixo' };
}

/** Folga em volta do item destacado, para o anel não colar no ícone. */
export const FOLGA_DO_DESTAQUE = 4;

/** O recorte do destaque, com a folga e sem sair da tela. */
export function recorteDoDestaque(alvo: Retangulo, area: Tamanho): Retangulo {
  const x = Math.max(0, alvo.x - FOLGA_DO_DESTAQUE);
  const y = Math.max(0, alvo.y - FOLGA_DO_DESTAQUE);
  return {
    x,
    y,
    largura: Math.min(area.largura, alvo.x + alvo.largura + FOLGA_DO_DESTAQUE) - x,
    altura: Math.min(area.altura, alvo.y + alvo.altura + FOLGA_DO_DESTAQUE) - y,
  };
}
