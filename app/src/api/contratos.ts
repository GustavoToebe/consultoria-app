import { requisicao } from './cliente';

/**
 * Contrato digital (`docs/planos/contrato-digital.md`, passo 2): espelho à mão de `ContratoDtos.java` e uma função por rota
 * dos três controllers (`ContratoModeloController`, `ContratoController` e `ContratoAlunoController`). Só o signatário ALUNO e só
 * a origem MODELO são usados pelas telas. Instantes são ISO (`Instant`). Texto, CPF, IP, aparelho e nome do assinante são
 * dado pessoal: nunca em log nem em nome de arquivo. O app NUNCA calcula o código de verificação (`sha256`): usa o que a API
 * devolve. Erros: 503 `CONTRATOS_INDISPONIVEL` (chave desligada), 422 `CONTRATO_MODELO_INVALIDO`, `CONTRATO_INCOMPLETO`,
 * `CONTRATO_INVALIDO` e `ASSINATURA_INVALIDA` (com `fieldErrors`), 409 `CONTRATO_MODELO_NOME_EM_USO`, `CONTRATO_MODELO_ARQUIVADO`,
 * `CONFLITO_EDICAO`, `PEDIDO_JA_USADO`, `CONTRATO_ASSINADO`, `CONTRATO_SEM_PRAZO`, `CONTRATO_NAO_PENDENTE`, `CONTRATO_ALTERADO` e
 * `CONTRATO_SIGNATARIO`.
 */

export type OrigemDoContrato = 'MODELO' | 'PDF';
export type SignatarioDoContrato = 'ALUNO' | 'RESPONSAVEL';
export type SituacaoDoContrato = 'PENDENTE' | 'ASSINADO' | 'CANCELADO';

/** Limites do servidor (`ContratoModeloService`, `ContratoService`, `ContratoDoAlunoService`). */
export const LIMITES_DO_CONTRATO = {
  nomeDoModelo: 80,
  textoDoModelo: 50_000,
  titulo: 120,
  motivoDoCancelamento: 300,
  nomeDoAssinante: 200,
  prorrogarDias: 60,
} as const;

// ---- modelos ----

export interface ModeloDeContrato {
  id: string;
  nome: string;
  texto: string;
  /** Nulo = ativo. Não há como desarquivar. */
  arquivadoEm: string | null;
  versao: number;
  atualizadoEm: string;
}

/** `versao` ausente = criar; presente = alterar (409 `CONFLITO_EDICAO` se for outra). */
export interface ModeloDeContratoRequest {
  nome: string;
  texto: string;
  versao?: number | null;
}

/** O modelo salvo com dados fictícios, só para o treinador ver como fica (`CONTRATO_ALTERAR`). */
export interface PreviaDoModelo {
  titulo: string;
  texto: string;
}

// ---- gerar ----

/** `signatario` ausente = `ALUNO`. `titulo` ausente = o nome do modelo. */
export interface GerarContratoRequest {
  pedidoId: string;
  modeloId: string;
  contratacaoId?: string | null;
  titulo?: string | null;
  signatario?: SignatarioDoContrato;
}

/** O que falta para gerar: o código do campo do modelo e a frase fixa para a tela. */
export interface FaltaDoContrato {
  campo: string;
  mensagem: string;
}

export interface PreviaDoContrato {
  titulo: string;
  texto: string;
  faltas: FaltaDoContrato[];
  podeGerar: boolean;
}

// ---- equipe ----

export interface ContratoResumo {
  id: string;
  alunoId: string;
  titulo: string;
  origem: OrigemDoContrato;
  signatario: SignatarioDoContrato;
  situacao: SituacaoDoContrato;
  /** Nulo = sem prazo (o prazo só existe a partir do passo 5). */
  prazoAte: string | null;
  vencido: boolean;
  contratacaoId: string | null;
  geradoEm: string;
  assinadoEm: string | null;
  canceladoEm: string | null;
  versao: number;
}

/**
 * As evidências do aceite, para a equipe com `CONTRATO_LER`. `ip` e `agente` podem vir `""` (não registrado); `cpf` só existe
 * no responsável.
 */
export interface AssinaturaDoContrato {
  assinadoEm: string;
  nome: string;
  cpf: string | null;
  ip: string;
  agente: string;
}

export interface ContratoDetalhe {
  id: string;
  alunoId: string;
  titulo: string;
  origem: OrigemDoContrato;
  signatario: SignatarioDoContrato;
  situacao: SituacaoDoContrato;
  prazoAte: string | null;
  vencido: boolean;
  contratacaoId: string | null;
  geradoEm: string;
  canceladoEm: string | null;
  motivoCancelamento: string | null;
  texto: string;
  sha256: string;
  geradoPorNome: string | null;
  assinatura: AssinaturaDoContrato | null;
  versao: number;
}

export interface CancelarContratoRequest {
  motivo: string;
  versao: number;
}

export interface ProrrogarContratoRequest {
  /** 1 a 60 (a tela oferece 7, 15 e 30). */
  dias: number;
  versao: number;
}

// ---- aluno ----

/** Nome digitado e `sha256` do detalhe que o aluno leu (409 `CONTRATO_ALTERADO` se o texto mudou); `aceite` é sempre `true`. */
export interface AssinarContratoRequest {
  sha256: string;
  nome: string;
  aceite: boolean;
}

export interface ContratoDoAlunoResumo {
  id: string;
  titulo: string;
  origem: OrigemDoContrato;
  signatario: SignatarioDoContrato;
  situacao: SituacaoDoContrato;
  prazoAte: string | null;
  vencido: boolean;
  geradoEm: string;
  assinadoEm: string | null;
}

/** O que o aluno vê da própria assinatura: quando e o nome que digitou. Nunca IP nem aparelho. */
export interface AssinaturaDoAluno {
  assinadoEm: string;
  nome: string;
}

export interface ContratoDoAlunoDetalhe {
  id: string;
  titulo: string;
  origem: OrigemDoContrato;
  signatario: SignatarioDoContrato;
  situacao: SituacaoDoContrato;
  prazoAte: string | null;
  vencido: boolean;
  geradoEm: string;
  texto: string;
  sha256: string;
  assinatura: AssinaturaDoAluno | null;
}

const seg = (valor: string) => encodeURIComponent(valor);

// ---- rotas: modelos (ler `CONTRATO_LER`; o resto `CONTRATO_ALTERAR`) ----

export const listarModelosDeContrato = () => requisicao<ModeloDeContrato[]>('/contratos/modelos');
export const criarModeloDeContrato = (corpo: ModeloDeContratoRequest) =>
  requisicao<ModeloDeContrato>('/contratos/modelos', { metodo: 'POST', corpo });
export const alterarModeloDeContrato = (id: string, corpo: ModeloDeContratoRequest) =>
  requisicao<ModeloDeContrato>(`/contratos/modelos/${seg(id)}`, { metodo: 'PUT', corpo });
export const arquivarModeloDeContrato = (id: string, versao: number) =>
  requisicao<ModeloDeContrato>(`/contratos/modelos/${seg(id)}/arquivar`, { metodo: 'POST', corpo: { versao } });
export const previaDoModeloDeContrato = (id: string) =>
  requisicao<PreviaDoModelo>(`/contratos/modelos/${seg(id)}/previa`, { metodo: 'POST' });

// ---- rotas: contratos do aluno, lado da equipe ----

export const listarContratosDoAluno = (alunoId: string) => requisicao<ContratoResumo[]>(`/alunos/${seg(alunoId)}/contratos`);
export const obterContrato = (id: string) => requisicao<ContratoDetalhe>(`/contratos/${seg(id)}`);
export const previaDoContratoDoAluno = (alunoId: string, corpo: GerarContratoRequest) =>
  requisicao<PreviaDoContrato>(`/alunos/${seg(alunoId)}/contratos/previa`, { metodo: 'POST', corpo });
/** 201 na primeira vez; o mesmo `pedidoId` de novo devolve o contrato já gerado, em 200. */
export const gerarContrato = (alunoId: string, corpo: GerarContratoRequest) =>
  requisicao<ContratoDetalhe>(`/alunos/${seg(alunoId)}/contratos`, { metodo: 'POST', corpo });
export const cancelarContrato = (id: string, corpo: CancelarContratoRequest) =>
  requisicao<ContratoDetalhe>(`/contratos/${seg(id)}/cancelar`, { metodo: 'POST', corpo });
export const prorrogarContrato = (id: string, corpo: ProrrogarContratoRequest) =>
  requisicao<ContratoDetalhe>(`/contratos/${seg(id)}/prorrogar`, { metodo: 'POST', corpo });

// ---- rotas: o próprio aluno (sempre o da sessão) ----

export const listarMeusContratos = () => requisicao<ContratoDoAlunoResumo[]>('/aluno/contratos');
export const obterMeuContrato = (id: string) => requisicao<ContratoDoAlunoDetalhe>(`/aluno/contratos/${seg(id)}`);
export const assinarContrato = (id: string, corpo: AssinarContratoRequest) =>
  requisicao<ContratoDoAlunoDetalhe>(`/aluno/contratos/${seg(id)}/assinar`, { metodo: 'POST', corpo });
