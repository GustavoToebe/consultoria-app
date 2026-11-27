/** @jest-environment jsdom */
import type { Marca } from '../api/tipos';
import { documentoDeExemploDeDieta, documentoDeExemploDeTreino } from './exemplos';
import { cssDaPrevia, documentoCompleto } from './html';
import { montarCorpo } from './imprimir.web';
import { TEMAS_PDF } from './temas';

jest.mock('../dominio/uid', () => ({ novoUid: () => 'uid' }));

const emitidoEm = new Date('2026-10-11T19:30:00Z');
const marcaDe = (temaPdf: string): Marca => ({ id: 'm', nome: 'Consultoria de Exemplo', corPrimaria: '#C62828', fonteTitulo: 'METAL', temaPadrao: 'ESCURO', logoUrl: null, temaPdf });
const EXEMPLOS = { treino: documentoDeExemploDeTreino, dieta: documentoDeExemploDeDieta };

describe.each(TEMAS_PDF.map((t) => t.id))('documentos de exemplo no tema %s', (tema) => {
  describe.each(Object.entries(EXEMPLOS))('%s', (_nome, gerar) => {
    const doc = gerar(marcaDe(tema), emitidoEm);

    it('passa por montarCorpo sem perder conteúdo, link nem nó ativo', () => {
      const raiz = document.createElement('div');
      raiz.append(montarCorpo(doc.corpo));
      const referencia = document.createElement('div');
      referencia.innerHTML = doc.corpo; // só o teste usa: é o comportamento antigo a preservar
      expect(raiz.innerHTML).toBe(referencia.innerHTML);
      expect(raiz.querySelectorAll('a').length).toBe(referencia.querySelectorAll('a').length);
      expect(raiz.textContent?.length ?? 0).toBeGreaterThan(200);
      expect(raiz.querySelectorAll('script, style, iframe, object, embed, form, svg').length).toBe(0);
    });

    it('só tem dados fictícios: aluno de exemplo, links reservados, nada que pareça e-mail, CPF ou telefone', () => {
      const texto = doc.corpo.replace(/<[^>]*>/g, ' ');
      expect(texto).toContain('Aluno de Exemplo');
      expect(texto).not.toMatch(/@/);
      expect(texto).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
      expect(texto).not.toMatch(/\(?\d{2}\)?\s?9?\d{4}-?\d{4}/);
      for (const [, href] of doc.corpo.matchAll(/href="([^"]*)"/g)) expect(href).toMatch(/^https:\/\/(youtu\.be\/exemplo|loja\.example\/)/);
    });

    it('a prévia da web leva só regras do .doc e do papel: nada global que pinte a página do app', () => {
      const css = cssDaPrevia(doc.css, 'k1').replace(/\/\*[\s\S]*?\*\//g, '');
      const seletores = [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].flatMap(([, s]) => s.split(',').map((x) => x.trim()));
      expect(seletores.length).toBeGreaterThan(20);
      // Toda regra presa a ESTA prévia: nenhuma pega o `.doc` do bloco de impressão nem o de outra prévia da página.
      expect(seletores.filter((s) => !s.startsWith('.previa-pdf[data-previa="k1"]'))).toEqual([]);
      expect(css).not.toContain('@page');
      expect(cssDaPrevia(doc.css, 'k1')).toContain(doc.css.slice(doc.css.indexOf('.doc {')).replace(/\.doc(?![\w-])/g, '.previa-pdf[data-previa="k1"] .doc'));
    });

    it('é determinístico e o documento completo carrega o CSS do tema', () => {
      expect(gerar(marcaDe(tema), emitidoEm)).toEqual(doc);
      expect(documentoCompleto(doc)).toContain(`<style>${doc.css}</style>`);
    });
  });

  it('o tema muda só o CSS do treino (o HTML é o mesmo do CLASSICO)', () => {
    expect(documentoDeExemploDeTreino(marcaDe(tema), emitidoEm).corpo).toBe(documentoDeExemploDeTreino(marcaDe('CLASSICO'), emitidoEm).corpo);
  });
});

describe('duas prévias de modelos diferentes na mesma página (galeria)', () => {
  /** Monta o que `PreviaDoDocumento.web.tsx` monta: papel com `data-previa`, o `<style>` da instância e o corpo pelo `montarCorpo`. */
  function montarPrevia(chave: string, doc: { css: string; corpo: string }): HTMLElement {
    const papel = document.createElement('div');
    papel.className = 'previa-pdf';
    papel.setAttribute('data-previa', chave);
    const estilo = document.createElement('style');
    estilo.textContent = cssDaPrevia(doc.css, chave);
    const conteudo = document.createElement('div');
    conteudo.className = 'doc';
    conteudo.append(montarCorpo(doc.corpo));
    papel.replaceChildren(estilo, conteudo);
    return papel;
  }
  const seletoresDe = (css: string) =>
    [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{[^{}]*\}/g)].flatMap(([, s]) => s.split(',').map((x) => x.trim()));

  afterEach(() => {
    document.body.replaceChildren();
  });

  it.each([
    ['CLASSICO', 'MARCANTE'],
    ['MINIMALISTA', 'ESPORTIVO'],
    ['COMPACTO', 'ELEGANTE'],
  ])('%s e %s: nenhuma regra de uma prévia alcança elemento da outra', (a, b) => {
    const docA = documentoDeExemploDeTreino(marcaDe(a), emitidoEm);
    const docB = documentoDeExemploDeDieta(marcaDe(b), emitidoEm);
    const papelA = montarPrevia('modelo-a', docA);
    const papelB = montarPrevia('modelo-b', docB);
    document.body.append(papelA, papelB);
    for (const [papel, doc, chave] of [[papelA, docA, 'modelo-a'], [papelB, docB, 'modelo-b']] as const) {
      const seletores = seletoresDe(cssDaPrevia(doc.css, chave));
      expect(seletores.length).toBeGreaterThan(20);
      for (const seletor of seletores) {
        for (const alvo of document.querySelectorAll(seletor)) expect(alvo.closest('[data-previa]')).toBe(papel);
      }
    }
  });

  it('o estilo de cada prévia vale só nela: a segunda não muda o que a primeira mostra (nem a ordem importa)', () => {
    const docA = documentoDeExemploDeTreino(marcaDe('CLASSICO'), emitidoEm);
    const docB = documentoDeExemploDeTreino(marcaDe('ESPORTIVO'), emitidoEm);
    const medir = (papel: HTMLElement) =>
      ['.doc', '.topo', 'h1', 'h2', 'th', 'td', '.faixa-marca'].map((q) => {
        const e = papel.querySelector(q);
        if (!e) return [q, 'sem elemento'];
        const c = getComputedStyle(e);
        return [q, c.fontFamily, c.fontSize, c.backgroundColor, c.color, c.borderBottomWidth, c.padding];
      });
    const sozinha = (chave: string, doc: { css: string; corpo: string }) => {
      const p = montarPrevia(chave, doc);
      document.body.replaceChildren(p);
      return medir(p);
    };
    const soA = sozinha('modelo-a', docA);
    const soB = sozinha('modelo-b', docB);
    expect(soA).not.toEqual(soB); // os modelos se distinguem em alguma dessas propriedades

    for (const ordem of [['a', 'b'], ['b', 'a']]) {
      const papeis = { a: montarPrevia('modelo-a', docA), b: montarPrevia('modelo-b', docB) };
      document.body.replaceChildren(...ordem.map((k) => papeis[k as 'a' | 'b']));
      expect(medir(papeis.a)).toEqual(soA);
      expect(medir(papeis.b)).toEqual(soB);
    }
  });

  it('chave fora de [a-z0-9-] é recusada (nunca texto livre no seletor)', () => {
    for (const chave of ['', 'A', 'a b', 'a"] .doc { display:none } x[y="', 'a\\', 'a]', 'a:b', 'é']) {
      expect(() => cssDaPrevia('.doc { color: red; }', chave)).toThrow();
    }
  });
});
