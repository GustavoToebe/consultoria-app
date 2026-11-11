import type { Participante } from '../api/agendaTipos';
import {
  arranjoDoBloco, horarioNoRotuloDoCompromisso, LARGURA_PARA_SELO, LARGURA_PARA_SELO_AO_LADO, statusNoDiaInteiro, statusNoRotuloDoCompromisso, textoDoItemNoMes,
} from './agendaLegivel';

const p = (situacao: Participante['situacao'], n = 1): Participante => ({ id: `a${n}`, nome: `Aluno ${n}`, situacao });

describe('horarioNoRotuloDoCompromisso', () => {
  it('com fim: das X às Y, sem zero à esquerda e sem minutos zerados', () => {
    expect(horarioNoRotuloDoCompromisso('09:00', '10:00')).toBe('das 9h às 10h');
    expect(horarioNoRotuloDoCompromisso('09:30', '10:45')).toBe('das 9h30 às 10h45');
  });
  it('fim no dia seguinte: diz "do dia seguinte"', () => {
    expect(horarioNoRotuloDoCompromisso('15:00', '00:30')).toBe('das 15h à 0h30 do dia seguinte');
    expect(horarioNoRotuloDoCompromisso('23:00', '00:00')).toBe('das 23h à 0h do dia seguinte');
    expect(horarioNoRotuloDoCompromisso('22:00', '01:30')).toBe('das 22h à 1h30 do dia seguinte');
    expect(horarioNoRotuloDoCompromisso('23:30', '02:00')).toBe('das 23h30 às 2h do dia seguinte');
  });
  it('fim no mesmo dia, mesmo perto da meia-noite, não diz "do dia seguinte"', () => {
    expect(horarioNoRotuloDoCompromisso('23:00', '23:55')).toBe('das 23h às 23h55');
    expect(horarioNoRotuloDoCompromisso('00:00', '00:30')).toBe('da 0h à 0h30');
  });
  it('concorda com a 0h e a 1h (singular)', () => {
    expect(horarioNoRotuloDoCompromisso('01:00', '02:00')).toBe('da 1h às 2h');
    expect(horarioNoRotuloDoCompromisso('00:30', '01:00')).toBe('da 0h30 à 1h');
    expect(horarioNoRotuloDoCompromisso('11:00', '12:00')).toBe('das 11h às 12h');
  });
  it('sem fim: só o início, como veio', () => {
    expect(horarioNoRotuloDoCompromisso('09:00')).toBe('09:00');
    expect(horarioNoRotuloDoCompromisso('09:00', null)).toBe('09:00');
    expect(horarioNoRotuloDoCompromisso('09:00', '')).toBe('09:00');
  });
});

describe('textoDoItemNoMes', () => {
  const item = { titulo: 'Ana Fictícia', diaInteiro: false, origem: 'COMPROMISSO', cancelado: false, inicioCurto: '09:00' };
  it('escreve Cancelado no mês e deixa o item normal só com hora e título', () => {
    expect(textoDoItemNoMes(item)).toBe('09:00 Ana Fictícia');
    expect(textoDoItemNoMes({ ...item, cancelado: true })).toBe('09:00 Ana Fictícia · Cancelado');
    expect(textoDoItemNoMes({ ...item, diaInteiro: true, cancelado: true })).toBe('Ana Fictícia · Cancelado');
    expect(textoDoItemNoMes({ ...item, origem: 'ATUALIZACAO', titulo: 'Bruno', cancelado: true })).toBe('Bruno · Cancelado');
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
