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
      const css = cssDaPrevia(doc.css).replace(/\/\*[\s\S]*?\*\//g, '');
      const seletores = [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].flatMap(([, s]) => s.split(',').map((x) => x.trim()));
      expect(seletores.length).toBeGreaterThan(20);
      expect(seletores.filter((s) => !/^\.(doc|previa-pdf)\b/.test(s))).toEqual([]);
      expect(css).not.toContain('@page');
      expect(cssDaPrevia(doc.css)).toContain(doc.css.slice(doc.css.indexOf('.doc {')));
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
