/**
 * Itens de Configurações que abrem dentro da própria tela, na coluna da direita (`/treinador/configuracoes/<id>`, a partir
 * de 1024 px de janela), e a rota inteira de cada um, que continua valendo sozinha (celular, links antigos, specs). O id é o
 * do cartão em `dominio/configuracoes` e é o slug do endereço: não muda. Sem import de propósito: `permissoes`, `telas` e
 * `ajudaDaTela` traduzem o caminho embutido para a rota inteira por aqui, e `configuracoes` importa os dois.
 */
export const BASE_DAS_CONFIGURACOES = '/treinador/configuracoes';

export const ROTA_INTEIRA_DO_ITEM = {
  'meus-dados': '/treinador/meus-dados',
  seguranca: '/treinador/seguranca',
  ajustes: '/treinador/ajustes',
  'minha-conta': '/treinador/minha-conta',
  marca: '/treinador/marca',
  // Contato e Padrões do acompanhamento (27/11) são telas só de Configurações, sem rota inteira: o caminho aqui é a da Marca,
  // de quem herdam a guarda (gravam o mesmo `PUT /consultoria/marca`) e o "Saiba mais"; no celular abrem no próprio endereço.
  contato: '/treinador/marca',
  'padroes-do-acompanhamento': '/treinador/marca',
  'whatsapp-oficial': '/treinador/whatsapp',
  'documentos-pdf': '/treinador/documentos',
  'tags-dos-alunos': '/treinador/alunos/tags',
  contratos: '/treinador/contratos',
  termos: '/treinador/termos',
} as const satisfies Readonly<Record<string, string>>;

export type ItemEmbutido = keyof typeof ROTA_INTEIRA_DO_ITEM;

export function ehItemEmbutido(id: string): id is ItemEmbutido {
  return Object.prototype.hasOwnProperty.call(ROTA_INTEIRA_DO_ITEM, id);
}

/** Endereço do item dentro de Configurações. */
export const caminhoDoItem = (id: ItemEmbutido) => `${BASE_DAS_CONFIGURACOES}/${id}`;

/** O id depois de `/treinador/configuracoes/` (um segmento só), embutido ou não; fora disso, `null`. */
export function itemDoCaminho(caminho: string): string | null {
  if (!caminho.startsWith(`${BASE_DAS_CONFIGURACOES}/`)) return null;
  const id = caminho.slice(BASE_DAS_CONFIGURACOES.length + 1).split('?')[0];
  return id && !id.includes('/') ? id : null;
}

/** `/treinador/configuracoes/marca` → `/treinador/marca`; caminho que não é de item embutido → `null`. */
export function rotaInteiraDoCaminho(caminho: string): string | null {
  const id = itemDoCaminho(caminho);
  return id && ehItemEmbutido(id) ? ROTA_INTEIRA_DO_ITEM[id] : null;
}
