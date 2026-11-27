import type { OrigemDoContrato } from './contratos';
import { requisicao } from './cliente';
import type { Marca } from './tipos';

/**
 * Rotas públicas do contrato do responsável (passo 4 de `docs/planos/contrato-digital.md`, "Passos 4 a 6", S3 a S5): sem
 * login e sem renovar a sessão (`semRenovar`). O código do link vai SEMPRE no corpo, nunca no caminho (log de acesso,
 * histórico, prévia de link), como o convite; CPF e nome também só no corpo. O link sozinho só mostra a marca e o título: o
 * texto (que leva CPF e endereço do aluno) só vem depois de conferir o CPF do responsável (S3). Código inexistente, vencido,
 * usado ou de contrato cancelado = o mesmo 404; 429 com `Retry-After`; 422 `CPF_NAO_CONFERE` (conta tentativa); 409
 * `CONTRATO_ALTERADO`; 422 `ASSINATURA_INVALIDA` com `fieldErrors`. O app nunca calcula o `sha256`: devolve o que leu.
 */

/** O que o link mostra antes do CPF: a marca da consultoria (a mesma `MarcaPublica` dos convites) e o título. */
export interface ContratoPublicoConsulta {
  consultoria: Marca;
  titulo: string;
}

/** Depois do CPF: o texto exato (nulo no PDF próprio, que vem por `arquivoDoContratoPublico`) e o código de verificação. */
export interface ContratoPublicoAberto {
  titulo: string;
  origem: OrigemDoContrato;
  texto: string | null;
  temArquivo: boolean;
  sha256: string;
}

export interface AssinarContratoPublicoRequest {
  codigo: string;
  cpf: string;
  sha256: string;
  nome: string;
  aceite: boolean;
  declaroResponsavelLegal: boolean;
}

/** A resposta do aceite: o que o comprovante imprime (sem IP nem aparelho, que só a equipe vê). */
export interface ContratoPublicoAssinado {
  titulo: string;
  texto: string | null;
  sha256: string;
  assinadoEm: string;
  assinanteNome: string;
}

export const consultarContratoPublico = (codigo: string) =>
  requisicao<ContratoPublicoConsulta>('/publico/contratos/consultar', { metodo: 'POST', corpo: { codigo }, semRenovar: true });

export const abrirContratoPublico = (codigo: string, cpf: string) =>
  requisicao<ContratoPublicoAberto>('/publico/contratos/abrir', { metodo: 'POST', corpo: { codigo, cpf }, semRenovar: true });

/** Os bytes do PDF próprio (`attachment`, `no-store`). */
export const arquivoDoContratoPublico = (codigo: string, cpf: string) =>
  requisicao<Blob>('/publico/contratos/arquivo', {
    metodo: 'POST', corpo: { codigo, cpf }, semRenovar: true, binario: true, aceita: 'application/pdf', limiteMs: 60000,
  });

export const assinarContratoPublico = (corpo: AssinarContratoPublicoRequest) =>
  requisicao<ContratoPublicoAssinado>('/publico/contratos/assinar', { metodo: 'POST', corpo, semRenovar: true });
