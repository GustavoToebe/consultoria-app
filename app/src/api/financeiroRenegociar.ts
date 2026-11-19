import { requisicao } from './cliente';

/**
 * Contrato do "Renegociar" (D14 de `docs/planos/financeiro-em-fases.md`, frente F4, 18/11/2026). A API segue este arquivo;
 * o que o D14 não fixou foi escolhido aqui, no padrão do resto do Financeiro, e está marcado "(escolha)".
 *
 * Regras do D14: só cobranças ABERTAS (vencidas incluídas) do MESMO aluno, tipo MENSALIDADE ou AVULSA, de 1 a 100;
 * `FINANCEIRO_ALTERAR` para prévia, renegociar e desfazer (ver = `FINANCEIRO_LER` + `ALUNO_LER`, nas rotas de sempre);
 * total = soma dos originais LIDA NO SERVIDOR + acréscimo − desconto (terceira exceção à regra "o valor da cobrança é sempre
 * do servidor", ao lado da saída `OUTRO` e da avulsa); 1 a 12 parcelas iguais com a sobra dos centavos na ÚLTIMA; a parcela
 * k vence no mesmo dia do mês de `primeiroVencimento` + (k-1) meses (29, 30 e 31 = último dia do mês, como
 * `CalendarioDeCobranca`). As originais passam a `RENEGOCIADA` (fora de totais, vencido, inadimplentes, lembretes e "Pagar";
 * a competência continua COBERTA para o gerador) e nascem N cobranças `RENEGOCIACAO` (regras da avulsa: sem contratação nem
 * competência; o link do provedor leva a descrição fixa "Renegociação (MM/aaaa)"). Desfazer só se nenhuma parcela do acordo
 * foi paga, contestada ou estornada. Auditoria `COBRANCAS_RENEGOCIADAS` / `ACORDO_DESFEITO` com resumo fixo (sem valor, nome
 * nem motivo). Exportação LGPD leva os acordos; a anonimização limpa o motivo.
 *
 * O app NUNCA calcula valor, soma, parcela, sobra de centavos nem vencimento: tudo vem da prévia do servidor. Dinheiro em
 * centavos inteiros; datas `AAAA-MM-DD`.
 *
 * Rotas (escolha; mesmo prefixo dos lotes `/cobrancas/cancelar-em-lote` e `/cobrancas/link-em-lote`):
 * - `POST /cobrancas/renegociar/previa` → 200 `PreviaDaRenegociacao`. Só leitura, sem efeito, não audita. Corpo
 *   `PreviaDaRenegociacaoRequest`; faz TODAS as conferências do confirmar (mesmos códigos abaixo), menos o `pedidoId` e o motivo.
 * - `POST /cobrancas/renegociar` → 201 `RenegociacaoResponse`; 200 com o MESMO corpo se o `pedidoId` já foi usado nesta
 *   consultoria (idempotência no modelo da D11: nada novo é gravado, as conferências de situação e versão não rodam de novo).
 *   Tudo ou nada, numa transação; trava aluno → cobranças (ordem de `Travas`).
 * - `POST /cobrancas/acordos/{acordoId}/desfazer` → 200 `AcordoDesfeito`. As originais voltam a ABERTA (com versão nova) e
 *   as parcelas do acordo ainda abertas viram CANCELADA com o motivo; acordo de outra consultoria ou inexistente = 404.
 *
 * Erros (escolha dos nomes; mensagens em português, sem repetir valor nem texto digitado):
 * - 422 `RENEGOCIACAO_INVALIDA` com `fieldErrors` em `itens` (vazio, mais de 100, repetido), `itens[i]`, `acrescimoCentavos`,
 *   `descontoCentavos` (inclusive "o desconto não pode zerar o total": cada parcela tem de ficar com 1 centavo ou mais),
 *   `parcelas`, `primeiroVencimento` (faixa PLANEJAMENTO de `FaixaDeData`) e `motivo` (obrigatório, até 300 depois do strip).
 * - 404 `COBRANCA_NAO_ENCONTRADA`: alguma cobrança não existe ou é de outra consultoria.
 * - 409 `CONFLITO_EDICAO`: a `versao` de alguma original não é a atual.
 * - 409 `COBRANCA_NAO_ABERTA`: alguma original não está ABERTA (paga, cancelada, renegociada...).
 * - 409 `COBRANCAS_DE_ALUNOS_DIFERENTES`: os itens não são todos do mesmo aluno.
 * - 409 `COBRANCA_NAO_RENEGOCIAVEL`: algum item é `SAIDA` ou `RENEGOCIACAO` (parcela de acordo não se renegocia de novo).
 * - 409 `ALUNO_INATIVO` (escolha: "regras da avulsa"; decisão pendente do Gustavo, ver o relatório da F4) e
 *   `ALUNO_ANONIMIZADO`.
 * - 409 `ACORDO_NAO_DESFAZIVEL` (desfazer com parcela paga, contestada ou estornada) e `ACORDO_JA_DESFEITO`.
 * - 403 sem `FINANCEIRO_ALTERAR`; 503 `FINANCEIRO_INDISPONIVEL` com o financeiro desligado.
 *
 * `CobrancaResponse` (em `financeiroTipos.ts`) ganha `acordoId` (nas originais RENEGOCIADA e nas parcelas RENEGOCIACAO; nulo
 * nas demais e depois de desfeito, nas originais reabertas). A parcela tem `descricao` fixa do servidor: "Renegociação
 * (Parcela k/n)", ou "Renegociação" com uma parcela só; nunca texto do treinador. O motivo vai no `motivo` das ORIGINAIS
 * (como o do cancelamento: só a equipe vê; nunca vai ao aluno, a log, à auditoria nem ao provedor); as parcelas nascem com
 * `motivo` e `observacao` nulos. `GET /financeiro/cobrancas?situacao=RENEGOCIADA` filtra como as outras situações.
 */

/** Uma original e a versão que a tela viu (409 `CONFLITO_EDICAO` se mudou), como nos lotes. */
export interface ItemDaRenegociacao {
  cobrancaId: string;
  versao: number;
}

/**
 * O que a prévia confere e calcula. `acrescimoCentavos` e `descontoCentavos` de 0 a 1.000.000.000 (0 = sem acréscimo ou
 * sem desconto; a tela manda sempre os dois). `parcelas` de 1 a 12.
 */
export interface PreviaDaRenegociacaoRequest {
  itens: ItemDaRenegociacao[];
  acrescimoCentavos: number;
  descontoCentavos: number;
  parcelas: number;
  primeiroVencimento: string;
}

/**
 * O confirmar: o mesmo corpo da prévia que a tela mostrou, mais o `pedidoId` (UUID criado ao abrir a Folha: repetir depois
 * de uma falha de rede manda o mesmo, e o servidor devolve o que já fez) e o `motivo` (obrigatório, só a equipe vê).
 */
export interface RenegociarRequest extends PreviaDaRenegociacaoRequest {
  pedidoId: string;
  motivo: string;
}

/** Uma parcela como o servidor vai gravar: valor com a sobra na última e o vencimento já preso ao fim do mês. */
export interface ParcelaDaPreviaDaRenegociacao {
  /** De 1 a `parcelas.length`. */
  numero: number;
  vencimento: string;
  valorCentavos: number;
  /** A descrição fixa que a parcela vai ter ("Renegociação (Parcela 1/3)"). */
  descricao: string;
}

/**
 * A prévia, toda do servidor: a soma das originais lida no banco, o ajuste e o total (soma + acréscimo − desconto) e as
 * parcelas, em ordem. A tela só desenha estes números.
 */
export interface PreviaDaRenegociacao {
  alunoId: string;
  quantidadeDeOriginais: number;
  somaDosOriginaisCentavos: number;
  acrescimoCentavos: number;
  descontoCentavos: number;
  totalCentavos: number;
  parcelas: ParcelaDaPreviaDaRenegociacao[];
}

/** 201 (ou 200 na repetição do mesmo `pedidoId`): só contagens e o total gravado. */
export interface RenegociacaoResponse {
  acordoId: string;
  /** Quantas originais viraram RENEGOCIADA. */
  renegociadas: number;
  /** Quantas cobranças RENEGOCIACAO nasceram. */
  parcelas: number;
  totalCentavos: number;
}

/** `POST /cobrancas/acordos/{acordoId}/desfazer`: o motivo é obrigatório (até 300) e vai às parcelas canceladas. */
export interface DesfazerAcordoRequest {
  motivo: string;
}

export interface AcordoDesfeito {
  acordoId: string;
  /** Originais que voltaram a ABERTA. */
  reabertas: number;
  /** Parcelas do acordo canceladas. */
  canceladas: number;
}

export const previaDaRenegociacao = (corpo: PreviaDaRenegociacaoRequest) =>
  requisicao<PreviaDaRenegociacao>('/cobrancas/renegociar/previa', { metodo: 'POST', corpo });

export const renegociarCobrancas = (corpo: RenegociarRequest) =>
  requisicao<RenegociacaoResponse>('/cobrancas/renegociar', { metodo: 'POST', corpo });

export const desfazerAcordo = (acordoId: string, corpo: DesfazerAcordoRequest) =>
  requisicao<AcordoDesfeito>(`/cobrancas/acordos/${encodeURIComponent(acordoId)}/desfazer`, { metodo: 'POST', corpo });
