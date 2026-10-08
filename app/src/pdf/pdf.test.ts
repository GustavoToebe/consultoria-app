import type { ConteudoDieta, ConteudoTreino, Marca, Serie } from '../api/tipos';
import { normalizarDieta } from '../dominio/dieta';
import { normalizarTreino } from '../dominio/editorTreino';
import { esc, link } from './html';
import { documentoDieta } from './pdfDieta';
import { documentoTreino } from './pdfTreino';

jest.mock('../dominio/uid', () => ({ novoUid: () => 'uid' }));

const marca: Marca = {
  id: 'm',
  nome: 'Consultoria <Teste>',
  lema: null,
  corPrimaria: '#C62828',
  fonteTitulo: 'METAL',
  temaPadrao: 'ESCURO',
  logoUrl: null,
};

const s = (tipo: string, min: number | null, max: number | null, intensidade: Serie['intensidade']): Partial<Serie> => ({
  tipo,
  repsMin: min,
  repsMax: max,
  intensidade,
});

const treino: ConteudoTreino = normalizarTreino({
  objetivo: 'Secar <script>alert(1)</script>',
  sessoes: [
    {
      nome: 'Segunda - Costas',
      diaSemana: 1,
      tipo: 'TREINO',
      exercicios: [
        {
          nome: 'Remada baixa',
          videoUrl: 'https://youtu.be/abc"onmouseover="x',
          observacao: 'Tronco inclinado',
          series: [
            s('FS', 3, 3, { modo: 'PERCENTUAL_WS', percentual: 50 }),
            s('FS', 3, 3, { modo: 'PERCENTUAL_WS', percentual: 70 }),
            s('FS', 3, 3, { modo: 'PERCENTUAL_WS', percentual: 85 }),
            s('WS', 3, 6, { modo: 'CARGA_TRABALHO' }),
            s('Back off', 6, 8, { modo: 'PERCENTUAL_WS', percentual: 85 }),
            s('Back off', 6, 8, { modo: 'PERCENTUAL_WS', percentual: 85 }),
          ],
        },
      ],
    },
    { nome: 'Quinta - Off ativo', diaSemana: 4, tipo: 'DESCANSO_ATIVO', cardio: 'Cardio 50 min', exercicios: [] },
  ],
});

const base = { marca, logoDataUri: null, aluno: 'Aluno Demonstração', titulo: 'Plano 16', rodapePdf: null, emitidoEm: new Date('2026-10-11T19:30:00Z') };

describe('PDF do treino', () => {
  const html = documentoTreino({
    ...base,
    inicio: '2026-10-05',
    fim: '2026-10-20',
    versao: 2,
    conteudo: treino,
    tipoTrabalho: 'WS',
    instrucoesTreino: 'Linha 1\nLinha 2',
  }).corpo;

  it('agrupa as séries como no PDF do Saraiva', () => {
    expect(html).toContain('3x3 - FS<br>1x3 a 6 - WS<br>2x6 a 8 - Back off');
  });

  it('escreve a intensidade na coluna OBS', () => {
    expect(html).toContain('FS - 50/70/85% da WS');
    expect(html).toContain('Back off - 85% da WS');
  });

  it('escapa todo texto do usuário, inclusive o link do vídeo', () => {
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Consultoria &lt;Teste&gt;');
    expect(html).not.toContain('"onmouseover="');
  });

  it('dia de descanso mostra o cardio; instruções no fim com as quebras de linha', () => {
    expect(html).toContain('Cardio 50 min');
    expect(html).toContain('Linha 1<br>Linha 2');
    expect(html.indexOf('Instruções')).toBeGreaterThan(html.indexOf('Remada baixa'));
  });

  it('rascunho sai marcado', () => {
    const rascunho = documentoTreino({ ...base, inicio: null, fim: null, versao: null, conteudo: treino, tipoTrabalho: 'WS', instrucoesTreino: null }).corpo;
    expect(rascunho).toContain('RASCUNHO');
  });
});

describe('PDF da dieta', () => {
  const dieta: ConteudoDieta = normalizarDieta({
    objetivo: 'Construção muscular',
    profissional: 'Saraiva Team',
    refeicoes: [
      {
        nome: 'Café da manhã',
        opcoes: [
          { rotulo: 'A', itens: [{ nome: 'Pão', quantidade: 50, unidade: 'g', kcal: 133, proteina: 4.2, carboidrato: 24.8, gordura: 1.6 }] },
          { rotulo: 'B', itens: [{ nome: 'Aveia', quantidade: 40, unidade: 'g', kcal: 999, proteina: 1, carboidrato: 1, gordura: 1 }] },
        ],
      },
    ],
    suplementacao: [{ nome: '', dose: '', horario: '', observacao: '' }],
  });
  const html = documentoDieta({ ...base, versao: 1, conteudo: dieta, pesos: [] }).corpo;

  it('total do dia só com a opção A', () => {
    expect(html).toContain('133 kcal');
    expect(html).toContain('Total do dia considerando a opção A de cada refeição.');
    expect(html).toContain('▸ OPÇÃO B');
  });

  it('suplementação vazia e peso sem registro não aparecem', () => {
    expect(html).not.toContain('Suplementação');
    expect(html).not.toContain('Acompanhamento de peso');
  });
});

describe('html', () => {
  it('esc e link', () => {
    expect(esc(`<a href="x">'&`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
    expect(link('javascript:alert(1)', 'Vídeo')).toBe('—');
  });
});
