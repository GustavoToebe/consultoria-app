/**
 * Campo de chave ou token de integração (InfinitePay, Kiwify): a regra que decide se uma mudança no campo veio da pessoa.
 *
 * O defeito de 28/11: com `type="password"`, o Chrome tratava a API Key como a senha do login e a preenchia sozinho (e a
 * InfiniteTag, logo antes, como o e-mail). O campo agora é de texto (`ui/CampoDeChave`) e, na web, só aceita o que veio de um
 * evento de entrada real: o navegador dispara `beforeinput` para tecla, colar, soltar, IME e apagar, e NÃO dispara para o
 * preenchimento automático, que só põe o valor e avisa com `input`. Mudança sem esse sinal é ignorada: o campo volta ao que
 * estava (vazio no começo) e nada dela chega ao corpo do `PUT`.
 */

/** O que mudou o campo: um evento da pessoa ou algo que não sabemos (preenchimento automático, script de extensão). */
export type OrigemDaMudanca = 'pessoa' | 'desconhecida';

/**
 * `inputType` do `beforeinput` que conta como da pessoa: digitar, colar, soltar, IME e apagar, desfazer e refazer. Fica de fora
 * `insertReplacementText` (troca feita pelo corretor ou pelo navegador, não pela pessoa) e o evento sem `inputType`.
 */
export function origemDoBeforeInput(inputType: string | null | undefined): OrigemDaMudanca {
  if (!inputType || inputType === 'insertReplacementText') return 'desconhecida';
  return /^(insert|delete|history)/.test(inputType) ? 'pessoa' : 'desconhecida';
}

/**
 * O sinal pendente: o último evento de entrada da pessoa, consumido pela mudança seguinte (uma vez só). `colar` e o fim da
 * composição (IME) também marcam, porque nem todo navegador manda `beforeinput` nesses casos.
 */
export function origemDoEvento(evento: { type: string; inputType?: string | null }): OrigemDaMudanca {
  if (evento.type === 'beforeinput') return origemDoBeforeInput(evento.inputType);
  if (evento.type === 'paste' || evento.type === 'drop' || evento.type === 'compositionend') return 'pessoa';
  return 'desconhecida';
}

/** A mudança vale? Só com um sinal da pessoa pendente. */
export const mudancaAceita = (pendente: OrigemDaMudanca | null): boolean => pendente === 'pessoa';

/**
 * O que vai no corpo: a chave digitada ou colada nesta tela, sem espaços nas pontas, ou `null` (o corpo não leva o campo e a
 * API mantém a gravada). Como o campo só aceita mudança da pessoa e nasce vazio, um valor aqui sempre veio dela.
 */
export function chaveParaEnviar(valor: string): string | null {
  const t = valor.trim();
  return t ? t : null;
}

// ---- Aviso da chave gravada (plano B do defeito de 28/11) ----

export type IntegracaoComChave = 'infinitepay' | 'kiwify';

/**
 * A chave é cifrada no servidor e não há como saber se o que foi gravado era a senha do login que o navegador preencheu. Enquanto
 * houver chave gravada, a tela pede para conferir, até a pessoa tocar "Já conferi" ou salvar uma chave nova. O "conferido" fica só
 * neste aparelho, por usuário (o treinador é de uma consultoria só), e nunca guarda nada da chave.
 */
export const chaveDoAvisoDaChave = (usuarioId: string, integracao: IntegracaoComChave): string => `treinos:${usuarioId}:recebimento:chave-conferida:${integracao}`;

export const TEXTO_DO_AVISO_DA_CHAVE: Readonly<Record<IntegracaoComChave, string>> = {
  infinitepay: 'Confira se a API Key é a da InfinitePay. Em versões anteriores o navegador pode ter gravado outro valor. Digite a chave de novo e salve.',
  kiwify: 'Confira se o token do webhook e o Client secret são os da Kiwify. Em versões anteriores o navegador pode ter gravado outro valor. Digite os dois de novo e salve.',
};

/** `conferido` nulo = ainda lendo o aparelho: não mostra (senão o aviso piscaria para quem já conferiu). */
export const mostrarAvisoDaChave = (podeAlterar: boolean, chaveGravada: boolean, conferido: boolean | null): boolean => podeAlterar && chaveGravada && conferido === false;
