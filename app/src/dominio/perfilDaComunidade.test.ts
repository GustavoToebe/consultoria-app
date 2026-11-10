import {
  alternarDestaque, contadorDeDestaques, CORES_DO_PERFIL, corDoPerfil, corpoDoManterVisivel, corpoDoPerfil, MAXIMO_DE_DESTAQUES,
  molduraDoPerfil, MOLDURAS_DO_PERFIL, mostrarAvisoDoPerfil, notaDoReservar, perfilMudou, reservadoNaTela, type PreferenciasLidas,
} from './perfilDaComunidade';

const lido = (p: Partial<PreferenciasLidas> = {}): PreferenciasLidas => ({
  perfilReservado: null, reservadoEfetivo: false, destaques: ['PRIMEIRO_TREINO'], cor: 'AZUL', moldura: 'SIMPLES', ...p,
});

describe('perfil da comunidade', () => {
  it('as listas espelham CorDoPerfil e MolduraDoPerfil da API, cada uma com nome escrito', () => {
    expect(CORES_DO_PERFIL.map((c) => c.valor)).toEqual(['AZUL', 'VERDE', 'ROXO', 'LARANJA', 'ROSA']);
    expect(MOLDURAS_DO_PERFIL.map((m) => m.valor)).toEqual(['SIMPLES', 'DUPLA', 'TRACEJADA', 'GROSSA']);
    expect(CORES_DO_PERFIL.every((c) => c.nome.length > 0)).toBe(true);
    expect(new Set(CORES_DO_PERFIL.map((c) => c.tom)).size).toBe(5);
    expect(corDoPerfil('DESCONHECIDA').valor).toBe('AZUL');
    expect(molduraDoPerfil(null).valor).toBe('SIMPLES');
  });

  it('o reservado que o aluno não tocou volta null, nunca o efetivo (salvar só a cor não vira escolha)', () => {
    const l = lido({ perfilReservado: null, reservadoEfetivo: true });
    expect(corpoDoPerfil(l, { cor: 'ROSA' })).toEqual({ perfilReservado: null, destaques: ['PRIMEIRO_TREINO'], cor: 'ROSA', moldura: 'SIMPLES' });
    expect(reservadoNaTela(l, {})).toBe(true);
    expect(corpoDoPerfil(l, { reservado: false }).perfilReservado).toBe(false);
  });

  it('"Entendi" manda false com o resto como está salvo', () => {
    expect(corpoDoManterVisivel(lido({ destaques: ['A', 'B'], cor: 'ROXO', moldura: 'DUPLA' })))
      .toEqual({ perfilReservado: false, destaques: ['A', 'B'], cor: 'ROXO', moldura: 'DUPLA' });
  });

  it('mudou: compara o corpo com o gravado, inclusive a ordem dos destaques', () => {
    const l = lido({ destaques: ['A', 'B'] });
    expect(perfilMudou(l, {})).toBe(false);
    expect(perfilMudou(l, { cor: 'AZUL' })).toBe(false);
    expect(perfilMudou(l, { destaques: ['B', 'A'] })).toBe(true);
    expect(perfilMudou(l, { reservado: false })).toBe(true);
    expect(perfilMudou(lido({ perfilReservado: false }), { reservado: false })).toBe(false);
  });

  it('destaques: o tipo da conquista, na ordem marcada, até 4; o 5º é recusado e nada muda', () => {
    let d: string[] = [];
    for (const t of ['A', 'B', 'C', 'D']) d = alternarDestaque(d, t, true).destaques;
    expect(d).toEqual(['A', 'B', 'C', 'D']);
    expect(alternarDestaque(d, 'E', true)).toEqual({ destaques: ['A', 'B', 'C', 'D'], recusado: true });
    expect(alternarDestaque(d, 'B', false).destaques).toEqual(['A', 'C', 'D']);
    expect(alternarDestaque(['A'], 'A', true).destaques).toEqual(['A']);
    expect(MAXIMO_DE_DESTAQUES).toBe(4);
  });

  it('contador "N de 4"', () => {
    expect(contadorDeDestaques(0, false)).toBe('0 de 4');
    expect(contadorDeDestaques(4, false)).toBe('4 de 4. Para trocar, desmarque um.');
    expect(contadorDeDestaques(4, true)).toBe('4 de 4. Você já escolheu 4: desmarque um para trocar.');
  });

  it('aviso único só para quem está visível sem ter escolhido', () => {
    expect(mostrarAvisoDoPerfil({ perfilReservado: null, reservadoEfetivo: false })).toBe(true);
    expect(mostrarAvisoDoPerfil({ perfilReservado: null, reservadoEfetivo: true })).toBe(false);
    expect(mostrarAvisoDoPerfil({ perfilReservado: false, reservadoEfetivo: false })).toBe(false);
    expect(mostrarAvisoDoPerfil({ perfilReservado: true, reservadoEfetivo: true })).toBe(false);
  });

  it('nota do reservado por padrão só sem escolha', () => {
    expect(notaDoReservar(lido({ reservadoEfetivo: true }), {})).toMatch(/começa reservado/);
    expect(notaDoReservar(lido({ reservadoEfetivo: true }), { reservado: true })).toBeNull();
    expect(notaDoReservar(lido({ perfilReservado: true, reservadoEfetivo: true }), {})).toBeNull();
    expect(notaDoReservar(lido(), {})).toBeNull();
  });
});
