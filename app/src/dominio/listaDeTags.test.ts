import {
  contadorDoNome, maisUsadas, mostrarBuscaDasTags, ordenarTags, tagsDaLista, textoDeExcluirTag, textoDosAlunosDaTag,
} from './listaDeTags';

const t = (nome: string, totalAlunos = 0) => ({ nome, totalAlunos });
const nomes = (l: { nome: string }[]) => l.map((x) => x.nome);

describe('listaDeTags', () => {
  it('ordena em português, sem diferença de acento nem de caixa', () => {
    expect(nomes(ordenarTags([t('Retorno'), t('água'), t('Avançado'), t('Online'), t('Agua')]))).toEqual(['Agua', 'água', 'Avançado', 'Online', 'Retorno']);
  });

  it('a busca só aparece com mais de 12 tags', () => {
    expect(mostrarBuscaDasTags(12)).toBe(false);
    expect(mostrarBuscaDasTags(13)).toBe(true);
  });

  it('filtra sem acento nem caixa só com a busca à vista; com 12 ou menos ignora o texto', () => {
    const muitas = [t('Avançado'), t('Online'), ...Array.from({ length: 11 }, (_, i) => t(`Grupo ${i + 1}`))];
    expect(nomes(tagsDaLista(muitas, 'AVANC'))).toEqual(['Avançado']);
    expect(nomes(tagsDaLista(muitas, '  '))).toHaveLength(13);
    expect(nomes(tagsDaLista(muitas.slice(0, 12), 'avanc'))).toHaveLength(12);
  });

  it('mais usadas: mais alunos primeiro, empate pelo nome, sem as de nenhum aluno, até 5', () => {
    const l = [t('Zeta', 2), t('Alfa', 2), t('Beta', 9), t('Vazia', 0), t('C', 1), t('D', 1), t('E', 1)];
    expect(nomes(maisUsadas(l))).toEqual(['Beta', 'Alfa', 'Zeta', 'C', 'D']);
    expect(maisUsadas([t('Vazia')])).toEqual([]);
  });

  it('textos da contagem e da exclusão', () => {
    expect(textoDosAlunosDaTag(0)).toBe('Nenhum aluno');
    expect(textoDosAlunosDaTag(1)).toBe('1 aluno');
    expect(textoDosAlunosDaTag(3)).toBe('3 alunos');
    expect(textoDeExcluirTag(2)).toBe('A tag sai de 2 alunos; os alunos continuam como estão. Não dá para desfazer.');
    expect(textoDeExcluirTag(1)).toBe('A tag sai de 1 aluno; os alunos continuam como estão. Não dá para desfazer.');
    expect(textoDeExcluirTag(0)).toBe('Nenhum aluno tem esta tag. Não dá para desfazer.');
    expect(contadorDoNome('Online', 30)).toBe('6/30');
  });
});
