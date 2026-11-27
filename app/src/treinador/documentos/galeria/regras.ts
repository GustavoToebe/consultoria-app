import { LARGURA_FAIXA_NORMAL, LARGURA_MENU_EXPANDIDO, LARGURA_MENU_LATERAL } from '../../../tema/tokens';

/**
 * Regras da galeria de modelos dos PDFs: o que escolher faz e o endereço do editor. Puras, testadas em `regras.test.ts`; as
 * colunas da grade (seção 3.1 de `docs/planos/orientacoes-de-design-26-11.md`) são `dominio/configuracaoPdf.colunasDaGaleria`.
 */

/** Menu do treinador na web (o de `ui/Navegacao`): aberto 240 a partir de 1024 de janela, trilho de 88 entre 768 e 1023. */
const MENU_ABERTO = 240;
const MENU_TRILHO = 88;

/**
 * Escolher um modelo abre o editor (`editor`) ou só confirma e grava aqui (`confirmar`, D-F2/D24). O editor pede a faixa
 * `normal` (≥ 1024 px de área ao lado do menu). Em Configurações a `Tela` mede só a coluna da direita, então vale também a
 * janela menos o menu aberto.
 * shortcut: o estado "minimizado" do menu não chega ao conteúdo, então a estimativa supõe o menu aberto (1100 a 1263 px de janela com o menu minimizado, em Configurações, confirmam em vez de abrir o editor); troque se o menu expuser a largura.
 */
export function modoDaEscolha({ web, janela, faixaDaTela }: { web: boolean; janela: number; faixaDaTela: string }): 'editor' | 'confirmar' {
  if (!web) return 'confirmar';
  if (faixaDaTela !== 'compacta') return 'editor';
  const menu = janela >= LARGURA_MENU_EXPANDIDO ? MENU_ABERTO : janela >= LARGURA_MENU_LATERAL ? MENU_TRILHO : 0;
  return janela - menu >= LARGURA_FAIXA_NORMAL ? 'editor' : 'confirmar';
}

/** Endereço do editor. Sem `modelo` abre a configuração gravada (o modelo em uso com as personalizações). */
export function enderecoDoEditor(modelo?: string): string {
  return modelo ? `/treinador/documentos/personalizar?modelo=${encodeURIComponent(modelo)}` : '/treinador/documentos/personalizar';
}
