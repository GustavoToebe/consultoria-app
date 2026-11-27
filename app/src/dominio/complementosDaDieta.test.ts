import type { ItemErgogenico, Suplemento } from '../api/tipos';
import {
  abertaDepoisDeMover,
  abertaDepoisDeRemover,
  arranjoDosComplementos,
  avisoDoTitulo,
  comecoDoTexto,
  contagemDaAba,
  faltaNoSuplemento,
  linhasDoNome,
  nomeSemQuebra,
  orientacoesNaPrevia,
  previaVazia,
  problemaDaOrientacao,
  problemaDoErgogenico,
  problemaDoSuplemento,
  problemasDosComplementos,
  selecionadaDepoisDeRemover,
  selecionadaValida,
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

  it('orientação sem título não marca a aba nem a linha (o aviso fica no campo); texto acima de 2000 é perigo', () => {
    expect(problemasDosComplementos({ ...base, orientacoes: [{ titulo: '', texto: 'Beba água.' }] })).toEqual({});
    expect(problemaDaOrientacao({ titulo: '', texto: 'Beba água.' })).toBeUndefined();
    expect(avisoDoTitulo({ titulo: ' ', texto: 'Beba água.' })).toBe('Sem título: o aluno lê o texto sem um nome em cima.');
    expect(avisoDoTitulo({ titulo: 'Água', texto: '' })).toBeNull();
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

describe('orientações lado a lado (27/11)', () => {
  it('arranjo pela largura medida: lista, lado (larga) e prévia ao lado (ultralarga); sem medida, lista', () => {
    expect(arranjoDosComplementos(null, 1568, 2304)).toBe('lista');
    expect(arranjoDosComplementos(0, 1568, 2304)).toBe('lista');
    expect(arranjoDosComplementos(1567, 1568, 2304)).toBe('lista');
    expect(arranjoDosComplementos(1568, 1568, 2304)).toBe('lado');
    expect(arranjoDosComplementos(2304, 1568, 2304)).toBe('ladoComPrevia');
  });

  it('a selecionada vale enquanto existe; lado a lado, sem escolha é a primeira e fora da lista é a última', () => {
    expect(selecionadaValida(null, 0, true)).toBeNull();
    expect(selecionadaValida(null, 3, true)).toBe(0);
    expect(selecionadaValida(2, 3, true)).toBe(2);
    expect(selecionadaValida(5, 3, true)).toBe(2);
    expect(selecionadaValida(null, 3, false)).toBeNull();
    expect(selecionadaValida(5, 3, false)).toBeNull();
    expect(selecionadaValida(1, 3, false)).toBe(1);
  });

  it('remover a selecionada seleciona a vizinha; as outras seguem o item', () => {
    const lista = ['a', 'b', 'c'];
    expect(selecionadaDepoisDeRemover(1, 1, 3)).toBe(1); // b sai, c toma o lugar
    expect(selecionadaDepoisDeRemover(2, 2, 3)).toBe(1); // a última sai, a anterior
    expect(selecionadaDepoisDeRemover(0, 0, 1)).toBeNull(); // esvaziou
    for (let removido = 0; removido < 3; removido++) {
      for (let sel = 0; sel < 3; sel++) {
        if (sel === removido) continue;
        const depois = lista.filter((_, i) => i !== removido);
        expect(depois[selecionadaDepoisDeRemover(sel, removido, 3)!]).toBe(lista[sel]);
      }
    }
    expect(selecionadaDepoisDeRemover(null, 0, 3)).toBeNull();
  });

  it('a prévia mostra só o que tem algo escrito, com a posição; vazio é "nada para mostrar"', () => {
    const r = orientacoesNaPrevia([{ titulo: '', texto: ' ' }, { titulo: 'Água', texto: '' }, { titulo: '', texto: 'Texto' }]);
    expect(r.map((x) => x.indice)).toEqual([1, 2]);
    expect(previaVazia(null)).toBe(true);
    expect(previaVazia(' \n ')).toBe(true);
    expect(previaVazia('Evite frituras.')).toBe(false);
    expect(comecoDoTexto('Beba **3 litros**.\nAo __acordar__.\n\nDepois, mais.')).toBe('Beba 3 litros. Ao acordar. Depois, mais.');
    expect(comecoDoTexto('  ')).toBe('');
  });
});

it('aba sem item não tem contagem e o nome não guarda quebra de linha', () => {
  expect(contagemDaAba(0)).toBeUndefined();
  expect(contagemDaAba(3)).toBe(3);
  expect(nomeSemQuebra('Whey\nfictício\r\n300 g')).toBe('Whey fictício 300 g');
});
