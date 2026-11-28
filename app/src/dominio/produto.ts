/** Nome do produto (decisão do Gustavo em 03/11): aparece onde ainda não há consultoria (telas públicas, aba do navegador, menu sem marca). */
export const NOME_DO_PRODUTO = 'Overtraining';

/**
 * Nome, em texto de tela, da lista pública que reúne os itens digitais de várias consultorias (F3 de `docs/planos/vitrine-e-loja.md`; o
 * plano a chama de "marketplace" só por dentro). Provisório, a confirmar pelo Gustavo: trocar aqui troca a rota `/consultorias`
 * (título da página), os textos do treinador e o rótulo da auditoria.
 */
export const NOME_DA_VITRINE_DE_CONSULTORIAS = 'Vitrine de consultorias';

/**
 * E-mail do suporte do produto (Gustavo, 28/11), única fonte: o "Fale com o suporte" de Meus dados abre o e-mail com este
 * endereço fixo (`ui/abrirEmailDoSuporte`). `null` = sem contato, e o botão some.
 * shortcut: endereço novo, ainda sem confirmação de que recebe; se o Gustavo não confirmar até 30/11, trocar por `null`.
 */
export const CONTATO_DO_SUPORTE: string | null = 'suporte@overtraining.app';
