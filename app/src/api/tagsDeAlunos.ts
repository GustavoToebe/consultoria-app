import { requisicao } from './cliente';
import type { CorDaTag, TagDaConsultoria, TagDeAluno } from './tipos';

/**
 * Chamadas das tags de aluno (`docs/planos/tags-de-aluno.md`). Moram aqui, e não em `rotas.ts`, para não disputar arquivo
 * com outra frente. `ALUNO_LER` lê; `ALUNO_ALTERAR` grava. Nome e erros: `dominio/tagsDeAluno`.
 */
const seg = (valor: string) => encodeURIComponent(valor);

/** `GET /tags-de-alunos`: as tags da consultoria, com quantos alunos usam cada uma. */
export const listarTagsDeAlunos = () => requisicao<TagDaConsultoria[]>('/tags-de-alunos');

/** `POST /tags-de-alunos`: cria (409 `TAG_NOME_EM_USO`, 422 `TAG_INVALIDA`). */
export const criarTagDeAluno = (corpo: { nome: string; cor: CorDaTag }) =>
  requisicao<TagDaConsultoria>('/tags-de-alunos', { metodo: 'POST', corpo });

/** `PUT /tags-de-alunos/{id}`: renomeia e/ou troca a cor (`versao` velha = 409 `CONFLITO_EDICAO`). */
export const renomearTagDeAluno = (id: string, corpo: { nome: string; cor: CorDaTag; versao: number }) =>
  requisicao<TagDaConsultoria>(`/tags-de-alunos/${seg(id)}`, { metodo: 'PUT', corpo });

/** `DELETE /tags-de-alunos/{id}?versao=`: apaga e tira a tag de todos os alunos (204). */
export const apagarTagDeAluno = (id: string, versao: number) =>
  requisicao<void>(`/tags-de-alunos/${seg(id)}?versao=${versao}`, { metodo: 'DELETE' });

/** `PUT /alunos/{id}/tags`: SUBSTITUI as tags do aluno (até 10; 422 `TAGS_LIMITE`, 409 `ALUNO_ANONIMIZADO`). */
export const definirTagsDoAluno = (alunoId: string, tagIds: readonly string[]) =>
  requisicao<TagDeAluno[]>(`/alunos/${seg(alunoId)}/tags`, { metodo: 'PUT', corpo: { tagIds } });
