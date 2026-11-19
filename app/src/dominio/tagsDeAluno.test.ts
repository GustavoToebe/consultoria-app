import { ErroApi } from '@plataforma/web';

import type { TagDeAluno } from '../api/tipos';
import { CHAVES_DE_IDENTIFICACAO } from '../tema/tokens';
import {
  chaveDaTag, COR_DAS_TAGS, erroDoNomeDaTag, idsDasTags, LIMITE_DE_TAGS, lerTagsDoEndereco, nomeDaTagParaEnviar,
  podeAdicionarTag, proximasTags, resumoDasTagsNaLinha, tagPeloNome, tagsParaEndereco, textoDeApagarTag, textoDeRenomear,
  traduzirErroDeTag,
} from './tagsDeAluno';

const tag = (n: number, nome = `Tag ${n}`): TagDeAluno => ({ id: `t0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, nome, cor: 'AZUL' });
const varias = (n: number) => Array.from({ length: n }, (_, i) => tag(i + 1));

describe('nome e chave', () => {
  it('envia sem espaços nas pontas e em NFC', () => {
    expect(nomeDaTagParaEnviar('  Café  ')).toBe('Café');
  });

  it('a chave ignora acento, caixa e espaços repetidos', () => {
    expect(chaveDaTag('  Avaliação   Física ')).toBe('avaliacao fisica');
    expect(chaveDaTag('Avaliacao Fisica')).toBe(chaveDaTag('AVALIAÇÃO  FÍSICA'));
    expect(chaveDaTag('Café')).toBe(chaveDaTag('Café'));
  });

  it('erro fixo para vazio e para mais de 30 caracteres, sem repetir o que foi digitado', () => {
    expect(erroDoNomeDaTag('   ')).toBe('Informe o nome da tag.');
    expect(erroDoNomeDaTag('a'.repeat(30))).toBeNull();
    const longo = erroDoNomeDaTag(`${'x'.repeat(30)}y`);
    expect(longo).toBe('O nome da tag pode ter até 30 caracteres.');
    expect(longo).not.toContain('xxx');
  });

  it('o tamanho conta depois do strip', () => {
    expect(erroDoNomeDaTag(` ${'a'.repeat(30)} `)).toBeNull();
  });
});

describe('limite e escolha', () => {
  it('só adiciona até 10', () => {
    expect(LIMITE_DE_TAGS).toBe(10);
    expect(podeAdicionarTag(varias(9))).toBe(true);
    expect(podeAdicionarTag(varias(10))).toBe(false);
  });

  it('acha a existente pela chave, nunca pelo texto cru', () => {
    const lista = [tag(1, 'Avaliação'), tag(2, 'VIP')];
    expect(tagPeloNome(lista, ' avaliacao ')?.id).toBe(lista[0].id);
    expect(tagPeloNome(lista, 'vip')?.id).toBe(lista[1].id);
    expect(tagPeloNome(lista, 'outra')).toBeUndefined();
    expect(tagPeloNome(lista, '   ')).toBeUndefined();
  });

  it('próximas tags: adiciona no fim, ignora repetida e além do limite, remove pelo id', () => {
    const atuais = varias(2);
    expect(proximasTags(atuais, { adicionar: tag(3) }).map((t) => t.nome)).toEqual(['Tag 1', 'Tag 2', 'Tag 3']);
    expect(proximasTags(atuais, { adicionar: atuais[0] })).toEqual(atuais);
    expect(proximasTags(varias(10), { adicionar: tag(11) })).toHaveLength(10);
    expect(proximasTags(atuais, { remover: atuais[0].id })).toEqual([atuais[1]]);
    expect(proximasTags(atuais, { remover: 'nao-esta' })).toEqual(atuais);
    expect(atuais).toHaveLength(2);
    expect(idsDasTags(atuais)).toEqual(atuais.map((t) => t.id));
  });

  it('adicionar leva só id, nome e cor (a tag da consultoria traz totalAlunos e versão)', () => {
    const daConsultoria = { ...tag(5), totalAlunos: 3, versao: 2 };
    expect(proximasTags([], { adicionar: daConsultoria })).toEqual([tag(5)]);
  });
});

describe('cores', () => {
  it('são as de identificação do tema, na mesma ordem, cada uma com rótulo em português', () => {
    expect(COR_DAS_TAGS.map((c) => c.valor)).toEqual([...CHAVES_DE_IDENTIFICACAO]);
    expect(COR_DAS_TAGS.map((c) => c.rotulo)).toEqual(['Ciano', 'Azul', 'Índigo', 'Violeta', 'Magenta']);
  });
});

describe('resumo na linha', () => {
  it('até 2 tags e o resto vira +N', () => {
    expect(resumoDasTagsNaLinha([])).toEqual({ visiveis: [], restantes: 0, texto: '' });
    expect(resumoDasTagsNaLinha(varias(2))).toMatchObject({ restantes: 0, texto: '' });
    const r = resumoDasTagsNaLinha(varias(5));
    expect(r.visiveis.map((t) => t.nome)).toEqual(['Tag 1', 'Tag 2']);
    expect(r).toMatchObject({ restantes: 3, texto: '+3' });
    expect(resumoDasTagsNaLinha(varias(5), 3)).toMatchObject({ restantes: 2, texto: '+2' });
  });
});

describe('textos dos painéis', () => {
  it('apagar diz em quantos alunos a tag está', () => {
    expect(textoDeApagarTag({ totalAlunos: 4 })).toBe('A tag está em 4 alunos; ao apagar, sai de todos.');
    expect(textoDeApagarTag({ totalAlunos: 1 })).toBe('A tag está em 1 aluno; ao apagar, sai dele.');
    expect(textoDeApagarTag({ totalAlunos: 0 })).toBe('Nenhum aluno usa esta tag.');
  });

  it('renomear diz onde a mudança vale', () => {
    expect(textoDeRenomear({ totalAlunos: 4 })).toBe('A tag está em 4 alunos; a mudança vale em todos.');
    expect(textoDeRenomear({ totalAlunos: 1 })).toBe('A tag está em 1 aluno; a mudança vale nele.');
    expect(textoDeRenomear({ totalAlunos: 0 })).toBe('Nenhum aluno usa esta tag.');
  });
});

describe('filtro no endereço', () => {
  const A = tag(1).id;
  const B = tag(2).id;

  it('lê repetido ou com vírgula, sem vazios, repetidos nem o que não é id', () => {
    expect(lerTagsDoEndereco([A, `${B},${A}`, '', ' '])).toEqual([A, B]);
    expect(lerTagsDoEndereco(`${A},,x`)).toEqual([A]);
    expect(lerTagsDoEndereco(undefined)).toEqual([]);
  });

  it('escreve sem vazios nem repetidos, na ordem dada', () => {
    expect(tagsParaEndereco([B, '', A, B, ' '])).toEqual([B, A]);
    expect(tagsParaEndereco([])).toEqual([]);
  });
});

describe('traduzirErroDeTag', () => {
  const campos = (...nomes: string[]) => nomes.map((field) => ({ field, message: 'texto do servidor' }));

  it('409 TAG_NOME_EM_USO: mensagem no campo nome e recarrega a lista', () => {
    expect(traduzirErroDeTag(new ErroApi(409, 'TAG_NOME_EM_USO', 'x'))).toEqual({ mensagem: 'Já existe uma tag com esse nome.', noCampo: 'nome', recarregar: true });
  });

  it('422 TAG_INVALIDA: o campo vem de fieldErrors, a frase é fixa', () => {
    expect(traduzirErroDeTag(new ErroApi(422, 'TAG_INVALIDA', 'x', campos('nome')))).toMatchObject({ noCampo: 'nome', recarregar: false });
    const cor = traduzirErroDeTag(new ErroApi(422, 'TAG_INVALIDA', 'x', campos('cor')));
    expect(cor).toMatchObject({ noCampo: 'cor', recarregar: false });
    expect(cor.mensagem).not.toContain('servidor');
    expect(traduzirErroDeTag(new ErroApi(422, 'TAG_INVALIDA', 'x')).noCampo).toBeUndefined();
  });

  it('409 CONFLITO_EDICAO e 404 recarregam; limite e anonimizado têm frase própria', () => {
    expect(traduzirErroDeTag(new ErroApi(409, 'CONFLITO_EDICAO', 'x'))).toMatchObject({ recarregar: true });
    expect(traduzirErroDeTag(new ErroApi(404, 'NAO_ENCONTRADO', 'x'))).toMatchObject({ recarregar: true });
    expect(traduzirErroDeTag(new ErroApi(422, 'TAGS_LIMITE', 'x'))).toEqual({ mensagem: 'O aluno pode ter até 10 tags.', recarregar: false });
    expect(traduzirErroDeTag(new ErroApi(409, 'ALUNO_ANONIMIZADO', 'x'))).toMatchObject({ recarregar: true });
  });

  it('o resto é frase fixa, menos 403 e sem conexão, que mostram o texto da API', () => {
    expect(traduzirErroDeTag(new ErroApi(500, 'ERRO', 'segredo interno')).mensagem).toBe('Não foi possível salvar a tag. Tente de novo.');
    expect(traduzirErroDeTag(new Error('boom')).mensagem).toBe('Não foi possível salvar a tag. Tente de novo.');
    expect(traduzirErroDeTag(new ErroApi(403, 'PERMISSAO_NEGADA', 'Sem permissão.')).mensagem).toBe('Sem permissão.');
  });
});
