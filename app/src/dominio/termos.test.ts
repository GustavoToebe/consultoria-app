import { blocosDoTexto, trechosDaLinha } from './termos';

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
