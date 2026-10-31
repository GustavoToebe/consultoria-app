import type { Participante } from '../api/agendaTipos';
import { CLARO, contraste, ESCURO } from '../tema/tokens';
import {
  arranjoDoBloco, CONTRASTE_DO_GRAFICO, CONTRASTE_DO_TEXTO, fundoDoItemDaAgenda, LARGURA_PARA_SELO, LARGURA_PARA_SELO_AO_LADO, misturarCores,
  PROPORCAO_DO_TINGIDO, statusNoDiaInteiro, statusNoRotuloDoCompromisso,
} from './agendaLegivel';

const p = (situacao: Participante['situacao'], n = 1): Participante => ({ id: `a${n}`, nome: `Aluno ${n}`, situacao });

describe('misturarCores', () => {
  it('0 é a base, 1 é a cor, meio a meio arredonda por canal', () => {
    expect(misturarCores('#FFFFFF', '#000000', 0)).toBe('#FFFFFF');
    expect(misturarCores('#FFFFFF', '#000000', 1)).toBe('#000000');
    expect(misturarCores('#FFFFFF', '#000000', 0.5)).toBe('#808080');
    expect(misturarCores('#102030', '#305070', 0.5)).toBe('#203850');
  });
});

describe('fundoDoItemDaAgenda', () => {
  it('tinge na proporção padrão quando o contraste permite', () => {
    const fundo = fundoDoItemDaAgenda({ cor: '#1B6FD6', base: CLARO.superficie2, textos: [CLARO.texto] });
    expect(fundo).toBe(misturarCores(CLARO.superficie2, '#1B6FD6', PROPORCAO_DO_TINGIDO));
    expect(fundo).not.toBe(CLARO.superficie2);
  });

  it('baixa a proporção até o texto voltar a 4,5:1 (texto suave sobre um tingido forte)', () => {
    const pedido = { cor: '#000000', base: CLARO.superficie2, textos: [CLARO.textoSuave], proporcao: 0.6 };
    const fundo = fundoDoItemDaAgenda(pedido);
    expect(contraste(CLARO.textoSuave, fundo)).toBeGreaterThanOrEqual(CONTRASTE_DO_TEXTO);
    // E é a maior proporção que passa: um passo a mais já não passaria.
    const passo = [...Array(61).keys()].reverse().find((i) => misturarCores(CLARO.superficie2, '#000000', i / 100) === fundo)!;
    expect(contraste(CLARO.textoSuave, misturarCores(CLARO.superficie2, '#000000', (passo + 1) / 100))).toBeLessThan(CONTRASTE_DO_TEXTO);
  });

  it('segura a faixa em 3:1 contra o fundo tingido, mesmo com o texto sobrando', () => {
    const cor = '#6E7F1E';
    const fundo = fundoDoItemDaAgenda({ cor, base: CLARO.superficie3, textos: [CLARO.texto], proporcao: 0.5 });
    expect(contraste(cor, fundo)).toBeGreaterThanOrEqual(CONTRASTE_DO_GRAFICO);
  });

  it('confere também os gráficos pedidos (ícone de status) a 3:1', () => {
    const fundo = fundoDoItemDaAgenda({ cor: '#C0306F', base: CLARO.superficie2, textos: [CLARO.texto], graficos: [CLARO.perigo], proporcao: 0.6 });
    expect(contraste(CLARO.perigo, fundo)).toBeGreaterThanOrEqual(CONTRASTE_DO_GRAFICO);
  });

  it('cor que já não passava na base não trava o tingido, e nenhum passo que sirva devolve a base', () => {
    // Amarelo claro no tema claro: a faixa já não tinha 3:1; o texto segue mandando.
    const amarelo = fundoDoItemDaAgenda({ cor: '#FFF2A8', base: CLARO.superficie2, textos: [CLARO.texto] });
    expect(amarelo).not.toBe(CLARO.superficie2);
    expect(contraste(CLARO.texto, amarelo)).toBeGreaterThanOrEqual(CONTRASTE_DO_TEXTO);
    // Texto que não passa nem na base: fica a base.
    expect(fundoDoItemDaAgenda({ cor: '#1B6FD6', base: ESCURO.superficie2, textos: ['#333333'] })).toBe(ESCURO.superficie2);
  });

  it('cor inválida devolve a base', () => {
    expect(fundoDoItemDaAgenda({ cor: 'AZUL', base: CLARO.superficie2, textos: [CLARO.texto] })).toBe(CLARO.superficie2);
    expect(fundoDoItemDaAgenda({ cor: '#12', base: CLARO.superficie2, textos: [CLARO.texto] })).toBe(CLARO.superficie2);
  });
});

describe('statusNoRotuloDoCompromisso', () => {
  it('todos agendados: nada (o nome continua o de antes)', () => {
    expect(statusNoRotuloDoCompromisso({ cancelado: false, participantes: [p('AGENDADO')] })).toBe('');
    expect(statusNoRotuloDoCompromisso({ cancelado: false, participantes: [p('AGENDADO', 1), p('AGENDADO', 2)] })).toBe('');
  });

  it('cancelado, realizado e falta saem escritos, em minúscula', () => {
    expect(statusNoRotuloDoCompromisso({ cancelado: true, participantes: [p('CANCELADO')] })).toBe(', cancelado');
    expect(statusNoRotuloDoCompromisso({ cancelado: false, participantes: [p('REALIZADO')] })).toBe(', realizado');
    expect(statusNoRotuloDoCompromisso({ cancelado: false, participantes: [p('FALTOU')] })).toBe(', faltou');
  });

  it('com vários alunos, o resumo da situação de cada um', () => {
    const c = { cancelado: false, participantes: [p('AGENDADO', 1), p('REALIZADO', 2), p('FALTOU', 3)] };
    expect(statusNoRotuloDoCompromisso(c)).toBe(', 1 agendado · 1 de 3 realizados · 1 faltou');
    expect(statusNoRotuloDoCompromisso({ cancelado: true, participantes: [p('AGENDADO', 1), p('AGENDADO', 2)] })).toBe(', cancelado');
  });
});

describe('arranjoDoBloco', () => {
  it('bloco mínimo (44 px, 15 a 30 min): título e horário em duas linhas, status em ícone', () => {
    expect(arranjoDoBloco(44, 200, true)).toEqual({ horarioSeparado: true, linhasDoTitulo: 1, status: 'icone' });
    expect(arranjoDoBloco(44, 200, false)).toEqual({ horarioSeparado: true, linhasDoTitulo: 1, status: null });
  });

  it('texto maior que não cabe em duas linhas vira uma linha só, com o ícone', () => {
    expect(arranjoDoBloco(44, 200, true, 20)).toEqual({ horarioSeparado: false, linhasDoTitulo: 1, status: 'icone' });
  });

  it('com altura e largura, o selo escrito; estreito (sobrepostos) fica no ícone', () => {
    expect(arranjoDoBloco(72, LARGURA_PARA_SELO, true).status).toBe('selo');
    expect(arranjoDoBloco(72, LARGURA_PARA_SELO - 1, true).status).toBe('icone');
    expect(arranjoDoBloco(72, 0, true).status).toBe('icone');
    expect(arranjoDoBloco(48, 300, true).status).toBe('icone');
  });

  it('o título ganha a segunda linha só quando sobra altura depois do horário e do selo', () => {
    expect(arranjoDoBloco(60, 300, false).linhasDoTitulo).toBe(2);
    expect(arranjoDoBloco(72, 300, true).linhasDoTitulo).toBe(1);
    expect(arranjoDoBloco(96, 300, true)).toEqual({ horarioSeparado: true, linhasDoTitulo: 2, status: 'selo' });
  });

  it('texto maior pede mais largura para o selo', () => {
    expect(arranjoDoBloco(120, LARGURA_PARA_SELO, true, 16).status).toBe('selo');
    expect(arranjoDoBloco(120, LARGURA_PARA_SELO, true, 20).status).toBe('icone');
  });

  it('nunca pede mais altura do que o bloco tem', () => {
    for (const linha of [16, 18, 20, 24]) {
      for (let altura = 44; altura <= 200; altura += 1) {
        for (const largura of [0, 60, 200]) {
          const a = arranjoDoBloco(altura, largura, true, linha);
          const linhas = a.linhasDoTitulo + (a.horarioSeparado ? 1 : 0);
          const usado = linhas * linha + (linhas - 1) * 2 + (a.status === 'selo' ? linha + 6 + 2 : 0);
          if (a.horarioSeparado) expect(usado).toBeLessThanOrEqual(altura - 8);
        }
      }
    }
  });
});

describe('statusNoDiaInteiro', () => {
  it('sem status, nada; largo, o selo ao lado; estreito ou sem medida, o ícone', () => {
    expect(statusNoDiaInteiro(900, false)).toBeNull();
    expect(statusNoDiaInteiro(LARGURA_PARA_SELO_AO_LADO, true)).toBe('selo');
    expect(statusNoDiaInteiro(LARGURA_PARA_SELO_AO_LADO - 1, true)).toBe('icone');
    expect(statusNoDiaInteiro(0, true)).toBe('icone');
    expect(statusNoDiaInteiro(LARGURA_PARA_SELO_AO_LADO, true, 20)).toBe('icone');
  });
});
