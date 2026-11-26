import type { ItemErgogenico, Suplemento } from '../api/tipos';
import {
  abertaDepoisDeMover,
  abertaDepoisDeRemover,
  contagemDaAba,
  faltaNoSuplemento,
  linhasDoNome,
  nomeSemQuebra,
  problemaDoErgogenico,
  problemaDoSuplemento,
  problemasDosComplementos,
} from './complementosDaDieta';
import { moverPara } from './reordenar';

const sup = (p: Partial<Suplemento> = {}): Suplemento => ({ uid: 's', nome: 'Creatina fictícia', dose: '3 g', horario: '', observacao: '', link: null, cupom: null, ...p });
const erg = (p: Partial<ItemErgogenico> = {}): ItemErgogenico =>
  ({ uid: 'e', nome: '', principioAtivo: '', concentracao: '', dose: '', horario: '', observacao: '', prescricao: '', ...p });
const base = { orientacoes: [], observacoes: null, suplementacao: [], ergogenicos: null };

describe('problemasDosComplementos', () => {
  it('sem nada, nenhuma aba tem problema', () => {
    expect(problemasDosComplementos(base)).toEqual({});
  });

  it('orientação sem título avisa; texto acima de 2000 é perigo e vence o aviso', () => {
    expect(problemasDosComplementos({ ...base, orientacoes: [{ titulo: '', texto: 'Beba água.' }] })).toEqual({ orientacoes: 'atencao' });
    expect(problemasDosComplementos({ ...base, orientacoes: [{ titulo: '', texto: '' }, { titulo: 'Água', texto: 'x'.repeat(2001) }] }))
      .toEqual({ orientacoes: 'perigo' });
    expect(problemasDosComplementos({ ...base, orientacoes: [{ titulo: 'x'.repeat(80), texto: 'x'.repeat(2000) }] })).toEqual({});
  });

  it('observações acima de 8000 caracteres é perigo; no limite, nada', () => {
    expect(problemasDosComplementos({ ...base, observacoes: 'x'.repeat(8001) })).toEqual({ observacoes: 'perigo' });
    expect(problemasDosComplementos({ ...base, observacoes: 'x'.repeat(8000) })).toEqual({});
  });

  it('suplemento: link fora do https e cupom acima de 40 são perigo; sem dose ou sem nome, aviso', () => {
    expect(problemaDoSuplemento(sup())).toBeUndefined();
    expect(problemaDoSuplemento(sup({ link: 'http://exemplo.com' }))).toBe('perigo');
    expect(problemaDoSuplemento(sup({ link: 'https://exemplo.com/p' }))).toBeUndefined();
    expect(problemaDoSuplemento(sup({ cupom: 'x'.repeat(41) }))).toBe('perigo');
    expect(problemaDoSuplemento(sup({ cupom: ` ${'x'.repeat(40)} ` }))).toBeUndefined();
    expect(problemaDoSuplemento(sup({ observacao: 'x'.repeat(501) }))).toBe('perigo');
    expect(problemaDoSuplemento(sup({ dose: '' }))).toBe('atencao');
    expect(problemaDoSuplemento(sup({ nome: ' ' }))).toBe('atencao');
    expect(problemasDosComplementos({ ...base, suplementacao: [sup({ dose: '' }), sup({ link: 'javascript:alert(1)' })] })).toEqual({ suplementacao: 'perigo' });
  });

  it('o aviso da linha diz o que falta, nome antes da dose', () => {
    expect(faltaNoSuplemento(sup({ nome: '', dose: '' }))).toBe('Falta o nome');
    expect(faltaNoSuplemento(sup({ dose: '' }))).toBe('Falta a dose');
    expect(faltaNoSuplemento(sup())).toBeNull();
  });

  it('item de Outros: em branco é ignorado (como na API); com algo escrito e sem nome, perigo', () => {
    expect(problemaDoErgogenico(erg())).toBeUndefined();
    expect(problemaDoErgogenico(erg({ dose: '1 cápsula' }))).toBe('perigo');
    expect(problemaDoErgogenico(erg({ nome: 'Item fictício', concentracao: 'x'.repeat(41) }))).toBe('perigo');
    expect(problemaDoErgogenico(erg({ nome: 'Item fictício' }))).toBeUndefined();
    expect(problemasDosComplementos({ ...base, ergogenicos: [erg(), erg({ horario: 'Noite' })] })).toEqual({ outros: 'perigo' });
  });
});

describe('item aberto ao reordenar e remover', () => {
  it('segue o item que estava aberto, conferido contra o próprio moverPara', () => {
    const lista = ['a', 'b', 'c', 'd'];
    for (let de = 0; de < 4; de++) {
      for (let para = 0; para < 4; para++) {
        for (let aberta = 0; aberta < 4; aberta++) {
          const depois = moverPara(lista, de, para);
          expect(depois[abertaDepoisDeMover(aberta, de, para)!]).toBe(lista[aberta]);
        }
      }
    }
    expect(abertaDepoisDeMover(null, 0, 2)).toBeNull();
  });

  it('remover fecha o removido e ajusta os de baixo', () => {
    expect(abertaDepoisDeRemover(2, 2)).toBeNull();
    expect(abertaDepoisDeRemover(3, 1)).toBe(2);
    expect(abertaDepoisDeRemover(0, 1)).toBe(0);
    expect(abertaDepoisDeRemover(null, 0)).toBeNull();
  });
});

it('o campo do nome tem duas linhas e cresce quando o nome não cabe', () => {
  expect(linhasDoNome('Whey fictício', 300)).toBe(2);
  expect(linhasDoNome('x'.repeat(66), 300)).toBe(3); // 30 por linha
  expect(linhasDoNome('x'.repeat(120), 300)).toBe(4);
  expect(linhasDoNome('x'.repeat(60), 300, 1.25)).toBe(3); // texto maior, menos por linha
  expect(linhasDoNome('x'.repeat(120), 0)).toBe(2);
});

it('aba sem item não tem contagem e o nome não guarda quebra de linha', () => {
  expect(contagemDaAba(0)).toBeUndefined();
  expect(contagemDaAba(3)).toBe(3);
  expect(nomeSemQuebra('Whey\nfictício\r\n300 g')).toBe('Whey fictício 300 g');
});
