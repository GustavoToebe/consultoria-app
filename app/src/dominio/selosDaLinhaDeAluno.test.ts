import type { TagDeAluno } from '../api/tipos';
import { dicaDoMaisTags, rotuloDoMaisTags, selosDeExcecaoDoAluno, tagsEscondidasDaLinha, TEXTO_DA_COBRANCA_VENCIDA } from './selosDaLinhaDeAluno';

const tag = (n: number, nome = `Tag ${n}`): TagDeAluno => ({ id: `t0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, nome, cor: 'AZUL' });
const varias = (n: number) => Array.from({ length: n }, (_, i) => tag(i + 1));

describe('selosDeExcecaoDoAluno', () => {
  it('o atraso diz o que venceu: "Cobrança vencida", nunca "Vencida" sozinho, e vem primeiro', () => {
    const selos = selosDeExcecaoDoAluno({ ativo: false, temAcesso: false, emAtraso: true });
    expect(selos).toEqual([{ texto: 'Cobrança vencida', tipo: 'perigo' }, { texto: 'Inativo', tipo: 'neutro' }]);
    expect(TEXTO_DA_COBRANCA_VENCIDA).toBe('Cobrança vencida');
  });

  it('"Sem acesso" só para quem está ativo; aluno em dia e com acesso não tem selo', () => {
    expect(selosDeExcecaoDoAluno({ ativo: true, temAcesso: false, emAtraso: false })).toEqual([{ texto: 'Sem acesso', tipo: 'neutro' }]);
    expect(selosDeExcecaoDoAluno({ ativo: true, temAcesso: true, emAtraso: false })).toEqual([]);
  });

  it('"Acesso pausado" aparece em âmbar só para aluno ativo, preservando "Cobrança vencida"', () => {
    expect(selosDeExcecaoDoAluno({ ativo: true, temAcesso: true, emAtraso: true, acessoPausado: true })).toEqual([
      { texto: 'Cobrança vencida', tipo: 'perigo' },
      { texto: 'Acesso pausado', tipo: 'atencao' },
    ]);
    expect(selosDeExcecaoDoAluno({ ativo: false, temAcesso: true, emAtraso: false, acessoPausado: true })).toEqual([
      { texto: 'Inativo', tipo: 'neutro' },
    ]);
  });
});

describe('tags que não cabem na linha', () => {
  it('até duas tags: nada escondido, sem rótulo nem dica', () => {
    expect(tagsEscondidasDaLinha(varias(2))).toEqual([]);
    expect(rotuloDoMaisTags(varias(2))).toBeNull();
    expect(dicaDoMaisTags([])).toBeNull();
  });

  it('com quatro, as duas últimas vão para o "+N": o rótulo e a dica as listam', () => {
    const tags = [tag(1, 'Online'), tag(2, 'Retorno'), tag(3, 'Presencial'), tag(4, 'Avançado')];
    expect(tagsEscondidasDaLinha(tags).map((t) => t.nome)).toEqual(['Presencial', 'Avançado']);
    expect(rotuloDoMaisTags(tags)).toBe('Mais 2 tags: Presencial, Avançado');
    expect(dicaDoMaisTags(tags)).toBe('Presencial\nAvançado');
  });

  it('uma só escondida diz "tag" no singular', () => {
    expect(rotuloDoMaisTags(varias(3))).toBe('Mais 1 tag: Tag 3');
  });
});
