import { blocosDoTexto, linhaDaVersao, secoesDoDocumento, trechosDaLinha } from './termos';

test('seções numeradas viram o índice, na ordem, com id prefixado pelo documento', () => {
  const texto = '## 1. O que é este aplicativo\nTexto.\n\n## 2. Sua conta\n- Item\n\n## 8. Contato\n- **Consultoria:** X';
  expect(secoesDoDocumento('TERMO_USO', texto)).toEqual([
    { id: 'termo_uso-secao-1', rotulo: '1. O que é este aplicativo' },
    { id: 'termo_uso-secao-2', rotulo: '2. Sua conta' },
    { id: 'termo_uso-secao-3', rotulo: '8. Contato' },
  ]);
  expect(secoesDoDocumento('AVISO_PRIVACIDADE', 'Só parágrafo.')).toEqual([]);
});

test('linha da versão: com o aceite diz a data de Brasília; sem ele, só a versão', () => {
  expect(linhaDaVersao('2026-10-26', '2026-11-28T14:00:00Z')).toBe('Versão de 26/10/2026 · aceita por você em 28/11/2026');
  // 01h UTC do dia 29 ainda é dia 28 em Brasília.
  expect(linhaDaVersao('2026-10-26', '2026-11-29T01:00:00Z')).toBe('Versão de 26/10/2026 · aceita por você em 28/11/2026');
  expect(linhaDaVersao('2026-10-26', null)).toBe('Versão de 26/10/2026');
  expect(linhaDaVersao('2026-10-26', 'lixo')).toBe('Versão de 26/10/2026');
});

test('negrito entre ** vira trecho separado', () => {
  expect(trechosDaLinha('Dados no **Canadá** hoje')).toEqual([
    { texto: 'Dados no ', negrito: false },
    { texto: 'Canadá', negrito: true },
    { texto: ' hoje', negrito: false },
  ]);
  expect(trechosDaLinha('')).toEqual([]);
});

test('divide em seções, itens e parágrafos, juntando linhas seguidas', () => {
  const blocos = blocosDoTexto('RASCUNHO\nainda sem revisão\n\n## 1. Quem\n- **Controladora:** a consultoria\n- Operadora\n\nFim.');
  expect(blocos.map((b) => b.tipo)).toEqual(['paragrafo', 'secao', 'item', 'item', 'paragrafo']);
  expect(blocos[0]).toEqual({ tipo: 'paragrafo', trechos: [{ texto: 'RASCUNHO ainda sem revisão', negrito: false }] });
  expect(blocos[2]).toEqual({
    tipo: 'item',
    trechos: [{ texto: 'Controladora:', negrito: true }, { texto: ' a consultoria', negrito: false }],
  });
});

test('texto vazio não gera blocos', () => {
  expect(blocosDoTexto('')).toEqual([]);
});

test('linha recuada depois de um item continua o item', () => {
  const blocos = blocosDoTexto('- Você é responsável. Se achar que alguém usou a conta, avise e\n  troque a senha.\n- Outro item\nParágrafo.');
  expect(blocos.map((b) => b.tipo)).toEqual(['item', 'item', 'paragrafo']);
  expect(blocos[0].trechos[0].texto).toBe('Você é responsável. Se achar que alguém usou a conta, avise e troque a senha.');
});
