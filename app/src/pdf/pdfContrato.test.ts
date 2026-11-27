import type { Marca } from '../api/tipos';
import { documentoCompleto } from './html';
import { documentoContrato, type DadosPdfContrato } from './pdfContrato';
import { TEMAS_PDF } from './temas';

const marca = { nome: 'Consultoria <Fictícia>', corPrimaria: '#123456' } as unknown as Marca;
const HASH = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';

const base: DadosPdfContrato = {
  marca, logoDataUri: null, titulo: 'Contrato de serviços', texto: '**Cláusula 1**\nO aluno __concorda__ com os termos.\n\nSegundo parágrafo.',
  sha256: HASH, aluno: 'Maria Aluna', assinadoEm: '2026-11-26T17:03:09Z', nome: 'Maria da Silva Aluna', emitidoEm: new Date('2026-11-27T12:00:00Z'),
};
const equipe = { ...base, ip: '203.0.113.7', agente: 'Mozilla/5.0 (Fictício)', geradoPorNome: 'Treinador Fictício' };

describe('comprovante do contrato', () => {
  it('cabeçalho comum, texto formatado e a página de evidências, sem depender de versão nem de PDF do plano', () => {
    const { corpo, titulo } = documentoContrato(base);
    expect(corpo).toContain('Comprovante do contrato');
    expect(corpo).toContain('Contrato de serviços');
    expect(corpo).toContain('<strong>Cláusula 1</strong><br>O aluno <u>concorda</u> com os termos.');
    expect(corpo).toContain('<p>Segundo parágrafo.</p>');
    expect(corpo.indexOf('Segundo parágrafo.')).toBeLessThan(corpo.indexOf('Evidências da assinatura'));
    expect(corpo).not.toMatch(/\(v\d|RASCUNHO/);
    // O nome do arquivo é fixo: nunca o título, o aluno nem o nome digitado.
    expect(titulo).toBe('Comprovante do contrato');
  });

  it('evidências: nome digitado, data e hora de Brasília com segundos e o código inteiro, como a API devolveu', () => {
    const { corpo } = documentoContrato(base);
    expect(corpo).toContain('<th>Assinado por</th><td>Maria da Silva Aluna</td>');
    expect(corpo).toContain('26/11/2026 às 14:03:09 (horário de Brasília)');
    expect(corpo).toContain(`<td class="codigo">${HASH}</td>`);
  });

  it('versão do responsável: a declaração de responsável legal, sem IP, aparelho nem nome do aluno', () => {
    const { corpo } = documentoContrato({ ...base, aluno: null, responsavelLegal: true });
    expect(corpo).toContain('<th>Declaração</th><td>Declarou ser o responsável legal do aluno.</td>');
    expect(corpo).not.toContain('<th>IP</th>');
    expect(corpo).not.toContain('Maria Aluna<');
  });

  it('versão do aluno não leva IP, aparelho nem quem gerou', () => {
    const { corpo } = documentoContrato(base);
    for (const rotulo of ['IP', 'Aparelho', 'Gerado por']) expect(corpo).not.toContain(`<th>${rotulo}</th>`);
    expect(corpo).not.toContain('203.0.113.7');
  });

  it('versão da equipe leva IP, aparelho e quem gerou; vazio diz "Não registrado"', () => {
    const { corpo } = documentoContrato(equipe);
    expect(corpo).toContain('<th>IP</th><td>203.0.113.7</td>');
    expect(corpo).toContain('<th>Aparelho</th><td>Mozilla/5.0 (Fictício)</td>');
    expect(corpo).toContain('<th>Gerado por</th><td>Treinador Fictício</td>');
    const vazio = documentoContrato({ ...equipe, ip: '', agente: '' }).corpo;
    expect(vazio).toContain('<th>IP</th><td>Não registrado</td>');
    expect(vazio).toContain('<th>Aparelho</th><td>Não registrado</td>');
  });

  it('as evidências começam em página nova', () => {
    expect(documentoContrato(base).css).toMatch(/\.evidencias \{[^}]*break-before: page/);
  });

  it('texto, nome, IP e aparelho saem escapados, também dentro do negrito', () => {
    const ataque = '<script>alert(1)</script>';
    const { corpo } = documentoContrato({ ...equipe, texto: `**${ataque}** & "x"`, nome: ataque, ip: ataque, agente: ataque, titulo: ataque });
    expect(corpo).not.toContain('<script');
    expect(corpo).toContain('<strong>&lt;script&gt;alert(1)&lt;/script&gt;</strong> &amp; &quot;x&quot;');
  });

  it('PDF próprio (texto nulo): "Documento em PDF anexo." e o código do arquivo', () => {
    const { corpo } = documentoContrato({ ...base, texto: null });
    expect(corpo).toContain('<p>Documento em PDF anexo.</p>');
    expect(corpo).toContain('identifica o arquivo PDF exato');
    expect(corpo).toContain(base.sha256);
  });

  it.each(TEMAS_PDF.map((t) => t.id))('gera em todos os temas (%s)', (tema) => {
    const html = documentoCompleto(documentoContrato({ ...equipe, marca: { ...marca, temaPdf: tema } as Marca }));
    expect(html).toContain('Evidências da assinatura');
  });
});
