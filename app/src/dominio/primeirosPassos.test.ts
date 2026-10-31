import {
  chavePrimeirosPassos,
  CONFIRMACAO_DE_DISPENSAR,
  conferir,
  deixarLinkParaDepois,
  desfazerLinkParaDepois,
  dispensar,
  ESTADO_INICIAL,
  estadoDaLeitura,
  fecharConcluidos,
  lerEstado,
  montarPrimeirosPassos,
  mostrarDeNovo,
  oQueMostrarNoInicio,
  serializarEstado,
  type EntradaDosPrimeirosPassos,
  type EstadoGuardado,
  type IdDoItem,
  type PrimeirosPassos,
} from './primeirosPassos';

const TODAS = ['MODELO_ALTERAR', 'ALUNO_ALTERAR', 'ALUNO_CONVITE', 'INSCRICAO_ALTERAR', 'PAINEL_VER'];

/** Administrador, consultoria recém-criada: nada feito, todas as consultas responderam. */
function entrada(sobre: Partial<EntradaDosPrimeirosPassos> = {}): EntradaDosPrimeirosPassos {
  return {
    pode: (c) => TODAS.includes(c),
    administrador: true,
    temLogo: false,
    alunosAtivos: 0,
    alunosSemAcesso: 0,
    alunosInativos: 0,
    linkAberto: false,
    estado: ESTADO_INICIAL,
    ...sobre,
  };
}
function montar(sobre: Partial<EntradaDosPrimeirosPassos> = {}): PrimeirosPassos {
  const r = montarPrimeirosPassos(entrada(sobre));
  if (!r) throw new Error('esperava o bloco');
  return r;
}
const item = (r: PrimeirosPassos, id: IdDoItem) => {
  const i = r.itens.find((x) => x.id === id);
  if (!i) throw new Error(`sem item ${id}`);
  return i;
};
const tudoFeito = (sobre: Partial<EntradaDosPrimeirosPassos> = {}) =>
  entrada({
    temLogo: true, alunosAtivos: 4, alunosSemAcesso: 1, alunosInativos: 0, linkAberto: true,
    estado: { ...ESTADO_INICIAL, conferidos: ['metodologia', 'modelos'] }, ...sobre,
  });

describe('guardado no aparelho', () => {
  it('a chave é por usuário', () => {
    expect(chavePrimeirosPassos('u1')).toBe('treinos:u1:primeirosPassos');
    expect(chavePrimeirosPassos('u1')).not.toBe(chavePrimeirosPassos('u2'));
  });

  it('ida e volta preserva o estado', () => {
    const e: EstadoGuardado = { conferidos: ['metodologia', 'modelos'], linkDepois: true, dispensado: true, fechado: true };
    expect(lerEstado(serializarEstado(e))).toEqual(e);
  });

  it('leitura tolerante: valor ausente, vazio, inválido ou do tipo errado volta ao estado inicial', () => {
    for (const bruto of [null, undefined, '', 'isso não é json', '{', '[]', '[1,2]', '"x"', '12', 'true', 'null']) {
      expect(lerEstado(bruto)).toEqual(ESTADO_INICIAL);
    }
  });

  it('leitura tolerante campo a campo: o que está certo fica, o que está errado volta ao padrão', () => {
    expect(lerEstado('{"conferidos":"metodologia","linkDepois":"sim","dispensado":1,"fechado":true}')).toEqual({
      conferidos: [], linkDepois: false, dispensado: false, fechado: true,
    });
    expect(lerEstado('{"conferidos":["modelos","modelos","marca",3,null],"linkDepois":true}')).toEqual({
      conferidos: ['modelos'], linkDepois: true, dispensado: false, fechado: false,
    });
    expect(lerEstado('{"extra":1}')).toEqual(ESTADO_INICIAL);
  });

  it('a leitura do aparelho: lendo espera, falhou vira estado inicial, valor é interpretado', () => {
    expect(estadoDaLeitura('lendo')).toBeNull();
    expect(estadoDaLeitura('falhou')).toEqual(ESTADO_INICIAL);
    expect(estadoDaLeitura({ valor: null })).toEqual(ESTADO_INICIAL);
    expect(estadoDaLeitura({ valor: '{"dispensado":true}' })?.dispensado).toBe(true);
  });

  it('transformadores são imutáveis e idempotentes', () => {
    const base = ESTADO_INICIAL;
    const a = conferir(conferir(base, 'modelos'), 'metodologia');
    expect(a.conferidos).toEqual(['metodologia', 'modelos']);
    expect(conferir(a, 'modelos')).toBe(a);
    expect(base.conferidos).toEqual([]);
    expect(deixarLinkParaDepois(base).linkDepois).toBe(true);
    expect(desfazerLinkParaDepois(deixarLinkParaDepois(base)).linkDepois).toBe(false);
    expect(dispensar(base).dispensado).toBe(true);
    expect(fecharConcluidos(base).fechado).toBe(true);
    expect(base).toEqual({ conferidos: [], linkDepois: false, dispensado: false, fechado: false });
  });

  it('mostrar de novo (Ajuda) zera dispensado e fechado e mantém o resto', () => {
    const e: EstadoGuardado = { conferidos: ['modelos'], linkDepois: true, dispensado: true, fechado: true };
    expect(mostrarDeNovo(e)).toEqual({ conferidos: ['modelos'], linkDepois: true, dispensado: false, fechado: false });
  });
});

describe('itens e de onde sai o "feito"', () => {
  it('seis itens, na ordem do protótipo, numerados', () => {
    const r = montar();
    expect(r.itens.map((i) => i.id)).toEqual(['marca', 'metodologia', 'modelos', 'aluno', 'convite', 'link']);
    expect(r.itens.map((i) => i.numero)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(r.progresso.texto).toBe('0 de 6');
  });

  it('marca: logo na sessão = feito; sem logo = falta; marca desconhecida = Sem informação', () => {
    expect(item(montar({ temLogo: true }), 'marca').estado).toBe('feito');
    expect(item(montar({ temLogo: false }), 'marca').estado).toBe('falta');
    expect(item(montar({ temLogo: null }), 'marca').estado).toBe('sem_informacao');
  });

  it('metodologia e modelos só ficam feitos com o "Já conferi"', () => {
    const r = montar({ estado: conferir(ESTADO_INICIAL, 'metodologia') });
    expect(item(r, 'metodologia').estado).toBe('conferido');
    expect(item(r, 'metodologia').selo.rotulo).toBe('Feito');
    expect(item(r, 'modelos').estado).toBe('falta');
  });

  it('aluno: um ativo basta; só inativos também conta; nenhum = falta', () => {
    expect(item(montar({ alunosAtivos: 2 }), 'aluno').estado).toBe('feito');
    expect(item(montar({ alunosAtivos: 0, alunosInativos: 3 }), 'aluno').estado).toBe('feito');
    expect(item(montar({ alunosAtivos: 0, alunosInativos: 0 }), 'aluno').estado).toBe('falta');
  });

  it('aluno: falha na contagem é Sem informação, nunca Feito nem zero', () => {
    expect(item(montar({ alunosAtivos: null, alunosSemAcesso: null, alunosInativos: null }), 'aluno').estado).toBe('sem_informacao');
    // Zero ativos e inativos desconhecido: pode haver aluno inativo, então não dá para dizer que falta.
    expect(item(montar({ alunosAtivos: 0, alunosInativos: null }), 'aluno').estado).toBe('sem_informacao');
    // Com ativos, o inativo não faz diferença.
    expect(item(montar({ alunosAtivos: 1, alunosInativos: null }), 'aluno').estado).toBe('feito');
  });

  it('convite: feito quando algum aluno ativo já tem acesso (usuário); ativo sem acesso = falta', () => {
    expect(item(montar({ alunosAtivos: 3, alunosSemAcesso: 2 }), 'convite').estado).toBe('feito');
    const falta = item(montar({ alunosAtivos: 3, alunosSemAcesso: 3 }), 'convite');
    expect(falta.estado).toBe('falta');
    expect(falta.bloqueio).toBeNull();
  });

  it('convite: o texto diz o que o item mede (aluno com acesso), não "entrou no app"', () => {
    const i = item(montar(), 'convite');
    expect(i.titulo).toBe('Um aluno já tem acesso ao app');
    expect(i.descricao).toBe('Convite aceito ou e-mail e senha definidos na ficha.');
  });

  it('convite: bloqueado sem aluno ativo, com o motivo certo para cada caso', () => {
    const nenhum = item(montar({ alunosAtivos: 0, alunosInativos: 0 }), 'convite');
    expect(nenhum.bloqueio).toBe('Cadastre um aluno primeiro.');
    expect(nenhum.selo.rotulo).toBe('Depois do aluno');
    expect(item(montar({ alunosAtivos: 0, alunosInativos: 2 }), 'convite').bloqueio).toBe('Precisa de um aluno ativo.');
  });

  it('convite: contagem que falhou é Sem informação (não bloqueado, não feito)', () => {
    const i = item(montar({ alunosAtivos: 2, alunosSemAcesso: null }), 'convite');
    expect(i.estado).toBe('sem_informacao');
    expect(i.bloqueio).toBeNull();
    expect(item(montar({ alunosAtivos: 0, alunosSemAcesso: 0, alunosInativos: null }), 'convite').estado).toBe('sem_informacao');
  });

  it('convite: contagem incoerente (mais sem acesso que ativos) não vira feito', () => {
    expect(item(montar({ alunosAtivos: 1, alunosSemAcesso: 5 }), 'convite').estado).toBe('falta');
  });

  it('link: ligado = feito; desligado = falta; consulta que falhou = Sem informação, nunca Feito', () => {
    expect(item(montar({ linkAberto: true }), 'link').estado).toBe('feito');
    expect(item(montar({ linkAberto: false }), 'link').estado).toBe('falta');
    expect(item(montar({ linkAberto: null }), 'link').estado).toBe('sem_informacao');
  });

  it('link: "Agora não" é deixado para depois, vence a consulta que falhou e perde para o link ligado', () => {
    const depois = conferir(deixarLinkParaDepois(ESTADO_INICIAL), 'modelos');
    expect(item(montar({ estado: depois, linkAberto: false }), 'link').estado).toBe('deixado_para_depois');
    expect(item(montar({ estado: depois, linkAberto: null }), 'link').estado).toBe('deixado_para_depois');
    expect(item(montar({ estado: depois, linkAberto: true }), 'link').estado).toBe('feito');
  });

  it('link é opcional; os demais não', () => {
    const r = montar();
    expect(r.itens.filter((i) => i.opcional).map((i) => i.id)).toEqual(['link']);
  });
});

describe('perfil restrito', () => {
  it('só vê os itens que pode fazer', () => {
    const ids = (pode: string[], administrador = false) =>
      montar({ pode: (c) => pode.includes(c), administrador }).itens.map((i) => i.id);
    expect(ids([], false)).toEqual([]);
    expect(ids([], true)).toEqual(['marca']);
    expect(ids(['MODELO_ALTERAR'])).toEqual(['metodologia', 'modelos']);
    expect(ids(['ALUNO_ALTERAR', 'PAINEL_VER'])).toEqual(['aluno']);
    expect(ids(['ALUNO_CONVITE', 'PAINEL_VER'])).toEqual(['convite']);
    expect(ids(['INSCRICAO_ALTERAR'])).toEqual(['link']);
    expect(ids(TODAS, true)).toHaveLength(6);
  });

  it('sem ver o painel não há como saber das contagens: aluno e convite saem da lista', () => {
    expect(montar({ pode: (c) => ['ALUNO_ALTERAR', 'ALUNO_CONVITE'].includes(c), administrador: false }).itens).toEqual([]);
  });

  it('o progresso é sobre os itens visíveis', () => {
    const r = montar({ pode: (c) => c === 'MODELO_ALTERAR', administrador: false, estado: conferir(ESTADO_INICIAL, 'metodologia') });
    expect(r.progresso).toMatchObject({ resolvidos: 1, total: 2, texto: '1 de 2', porcentagem: 50 });
    expect(r.progresso.rotuloAcessivel).toBe('Primeiros passos: 1 de 2 feitos ou deixados para depois');
  });

  it('sem nenhum item para o perfil o bloco não aparece e o Próximo passo fica', () => {
    const r = montar({ pode: () => false, administrador: false });
    expect(r.situacao).toBe('fechado');
    expect(r.itemPrimario).toBeNull();
    expect(oQueMostrarNoInicio(r, 'proximo')).toMatchObject({ bloco: null, proximoPasso: 'proximo', primario: 'proximo-passo' });
  });
});

describe('progresso, feitos recolhidos e item aberto', () => {
  it('"Sem informação" não conta como resolvido, mas entra no total', () => {
    const r = montar({ temLogo: true, linkAberto: null, alunosAtivos: null, alunosSemAcesso: null, alunosInativos: null });
    expect(r.progresso).toMatchObject({ resolvidos: 1, total: 6, texto: '1 de 6' });
    expect(item(r, 'link').resolvido).toBe(false);
    expect(item(r, 'aluno').resolvido).toBe(false);
  });

  it('feitos, conferidos e deixados para depois contam; à vista só o que falta', () => {
    const estado = deixarLinkParaDepois(conferir(ESTADO_INICIAL, 'metodologia'));
    const r = montar({ temLogo: true, alunosAtivos: 1, alunosSemAcesso: 1, estado });
    expect(r.progresso.texto).toBe('4 de 6');
    expect(r.recolhidos.map((i) => i.id)).toEqual(['marca', 'metodologia', 'aluno', 'link']);
    expect(r.aVista.map((i) => i.id)).toEqual(['modelos', 'convite']);
    expect(r.resumoDosRecolhidos).toBe('3 feitos e 1 deixado para depois');
  });

  it('o resumo usa singular e plural certos e some sem recolhidos', () => {
    expect(montar().resumoDosRecolhidos).toBeNull();
    expect(montar({ temLogo: true }).resumoDosRecolhidos).toBe('1 feito');
    const dois = montar({ temLogo: true, estado: deixarLinkParaDepois(ESTADO_INICIAL) });
    expect(dois.resumoDosRecolhidos).toBe('1 feito e 1 deixado para depois');
    expect(montar({ estado: { ...deixarLinkParaDepois(ESTADO_INICIAL), conferidos: ['metodologia'] } }).resumoDosRecolhidos).toBe('1 feito e 1 deixado para depois');
  });

  it('o número do item é o da lista inteira, não muda quando um sai da vista', () => {
    const r = montar({ temLogo: true });
    expect(r.aVista[0]).toMatchObject({ id: 'metodologia', numero: 2 });
  });

  it('o item aberto é o primeiro que falta; passa por cima do que já está resolvido', () => {
    expect(montar().itemPrimario).toBe('marca');
    expect(montar({ temLogo: true }).itemPrimario).toBe('metodologia');
    expect(montar({ temLogo: true, estado: conferir(conferir(ESTADO_INICIAL, 'metodologia'), 'modelos') }).itemPrimario).toBe('aluno');
  });

  it('o item aberto pula o bloqueado e o "Sem informação" enquanto há outro livre', () => {
    // Marca com consulta falha, aluno ausente: a Marca (sem informação) cede a vez à metodologia.
    expect(montar({ temLogo: null }).itemPrimario).toBe('metodologia');
    // Sem aluno, o convite está bloqueado: depois do aluno vem o link.
    const base = { temLogo: true, estado: conferir(conferir(ESTADO_INICIAL, 'metodologia'), 'modelos') };
    expect(montar({ ...base, alunosAtivos: 1, alunosSemAcesso: 0 }).itemPrimario).toBe('link');
    expect(montar({ ...base }).itemPrimario).toBe('aluno');
  });

  it('só sobra "Sem informação": ele recebe o primário em vez de ninguém', () => {
    const r = montar({ temLogo: true, estado: conferir(conferir(ESTADO_INICIAL, 'metodologia'), 'modelos'), alunosAtivos: 1, alunosSemAcesso: 0, linkAberto: null });
    expect(r.itemPrimario).toBe('link');
    expect(item(r, 'link').estado).toBe('sem_informacao');
  });

  it('só o convite bloqueado: ninguém recebe o primário', () => {
    const r = montar({ pode: (c) => ['ALUNO_CONVITE', 'PAINEL_VER'].includes(c), administrador: false });
    expect(r.situacao).toBe('aberto');
    expect(r.itemPrimario).toBeNull();
  });
});

describe('estados e botões por item', () => {
  it('item aberto: um botão primário e o texto completo', () => {
    const r = montar();
    const marca = item(r, 'marca');
    expect(marca.recebePrimario).toBe(true);
    expect(marca.textoExibido).toBe(marca.descricao);
    expect(marca.botoes).toEqual([
      { acao: 'abrir', rotulo: 'Abrir Marca', rotuloAcessivel: 'Abrir Marca', destino: '/treinador/marca', primario: true, desabilitado: false },
    ]);
  });

  it('só um botão primário em todo o bloco', () => {
    for (const sobre of [{}, { temLogo: true }, { temLogo: null }, { alunosAtivos: 2, alunosSemAcesso: 2 }]) {
      const primarios = montar(sobre).itens.flatMap((i) => i.botoes).filter((b) => b.primario);
      expect(primarios).toHaveLength(1);
    }
  });

  it('metodologia e modelos ganham "Já conferi"; o link ganha "Agora não"; os outros não', () => {
    const rotulos = (id: IdDoItem, sobre: Partial<EntradaDosPrimeirosPassos>) => item(montar(sobre), id).botoes.map((b) => b.rotulo);
    expect(rotulos('metodologia', { temLogo: true })).toEqual(['Abrir Metodologias', 'Já conferi']);
    const depoisMetodologia = { temLogo: true, estado: conferir(ESTADO_INICIAL, 'metodologia') };
    expect(rotulos('modelos', depoisMetodologia)).toEqual(['Abrir Planejamento', 'Já conferi']);
    const quaseTudo = { ...tudoFeito(), linkAberto: false };
    expect(item(montarPrimeirosPassos(quaseTudo)!, 'link').botoes.map((b) => b.rotulo)).toEqual(['Abrir Interessados', 'Agora não']);
    expect(rotulos('marca', {})).toEqual(['Abrir Marca']);
  });

  it('o "Já conferi" e o "Agora não" só aparecem no item aberto; fora dele, um "Abrir" simples com nome acessível', () => {
    const r = montar();
    const modelos = item(r, 'modelos');
    expect(modelos.recebePrimario).toBe(false);
    expect(modelos.botoes).toEqual([
      { acao: 'abrir', rotulo: 'Abrir', rotuloAcessivel: 'Abrir Planejamento: Conferir os modelos de treino', destino: '/treinador/planejamento?aba=treino', primario: false, desabilitado: false },
    ]);
    expect(modelos.textoExibido).toBeNull();
  });

  it('item resolvido não tem botão', () => {
    const r = montar({ temLogo: true });
    expect(item(r, 'marca').botoes).toEqual([]);
  });

  it('convite bloqueado: botão desligado e motivo', () => {
    const convite = item(montar(), 'convite');
    expect(convite.botoes).toHaveLength(1);
    expect(convite.botoes[0]).toMatchObject({ acao: 'abrir', desabilitado: true, primario: false });
    expect(convite.bloqueio).toBe('Cadastre um aluno primeiro.');
  });

  it('deixado para depois: só "Desfazer", com a explicação', () => {
    const r = montar({ estado: deixarLinkParaDepois(ESTADO_INICIAL) });
    const link = item(r, 'link');
    expect(link.selo).toEqual({ rotulo: 'Deixado para depois', tom: 'neutro', icone: 'menos' });
    expect(link.botoes).toEqual([
      { acao: 'desfazer', rotulo: 'Desfazer', rotuloAcessivel: 'Desfazer: Ligar o link de inscrição', destino: null, primario: false, desabilitado: false },
    ]);
    expect(link.textoExibido).toBe('Conta como resolvido. Quando quiser, ligue em Interessados.');
  });

  it('"Sem informação": aviso próprio, selo próprio, e nunca o selo "Feito"', () => {
    const marca = item(montar({ temLogo: null }), 'marca');
    expect(marca.selo).toEqual({ rotulo: 'Sem informação', tom: 'neutro', icone: 'alerta' });
    expect(marca.textoExibido).toBe('Não foi possível conferir agora. Abra a tela para ver.');
    expect(marca.botoes.map((b) => b.acao)).toEqual(['abrir']);
  });

  it('selos: feito, a fazer e depois do aluno', () => {
    const r = montar({ temLogo: true });
    expect(item(r, 'marca').selo).toEqual({ rotulo: 'Feito', tom: 'sucesso', icone: 'check' });
    expect(item(r, 'modelos').selo).toEqual({ rotulo: 'A fazer', tom: 'neutro', icone: 'circulo' });
    expect(item(r, 'convite').selo.icone).toBe('cadeado');
  });
});

describe('situação do bloco', () => {
  it('estado ainda não lido: nada a montar', () => {
    expect(montarPrimeirosPassos(entrada({ estado: null }))).toBeNull();
  });

  it('com algo por fazer está aberto', () => {
    expect(montar().situacao).toBe('aberto');
  });

  it('tudo resolvido = concluído, com a linha "Concluídos"', () => {
    const r = montarPrimeirosPassos(tudoFeito())!;
    expect(r.situacao).toBe('concluido');
    expect(r.progresso.texto).toBe('6 de 6');
    expect(r.linhaConcluidos).toEqual({
      titulo: 'Primeiros passos', selo: 'Concluídos', resumo: '6 de 6 · também na Ajuda', rotuloFechar: 'Tirar os primeiros passos do Início',
    });
  });

  it('deixado para depois ajuda a concluir; "Sem informação" impede', () => {
    const base = tudoFeito({ linkAberto: false, estado: { ...ESTADO_INICIAL, conferidos: ['metodologia', 'modelos'], linkDepois: true } });
    expect(montarPrimeirosPassos(base)!.situacao).toBe('concluido');
    expect(montarPrimeirosPassos({ ...base, estado: { ...base.estado!, linkDepois: false }, linkAberto: null })!.situacao).toBe('aberto');
    expect(montarPrimeirosPassos({ ...base, temLogo: null })!.situacao).toBe('aberto');
  });

  it('o X da linha "Concluídos" fecha o bloco', () => {
    const e = tudoFeito();
    const fechado = montarPrimeirosPassos({ ...e, estado: fecharConcluidos(e.estado!) })!;
    expect(fechado.situacao).toBe('fechado');
  });

  it('dispensar vence tudo, inclusive o concluído', () => {
    expect(montar({ estado: dispensar(ESTADO_INICIAL) }).situacao).toBe('dispensado');
    const e = tudoFeito();
    expect(montarPrimeirosPassos({ ...e, estado: dispensar(e.estado!) })!.situacao).toBe('dispensado');
  });

  it('trazer de volta pela Ajuda reabre o bloco dispensado e o concluído fechado', () => {
    expect(montar({ estado: mostrarDeNovo(dispensar(ESTADO_INICIAL)) }).situacao).toBe('aberto');
    const e = tudoFeito();
    const fechado = fecharConcluidos(e.estado!);
    expect(montarPrimeirosPassos({ ...e, estado: mostrarDeNovo(fechado) })!.situacao).toBe('concluido');
  });

  it('item que volta a faltar depois de fechado reabre o bloco; falha de consulta não', () => {
    const e = tudoFeito();
    const estado = fecharConcluidos(e.estado!);
    expect(montarPrimeirosPassos({ ...e, estado, temLogo: false })!.situacao).toBe('aberto');
    expect(montarPrimeirosPassos({ ...e, estado, linkAberto: false })!.situacao).toBe('aberto');
    expect(montarPrimeirosPassos({ ...e, estado, temLogo: null })!.situacao).toBe('fechado');
    expect(montarPrimeirosPassos({ ...e, estado, alunosAtivos: null, alunosSemAcesso: null })!.situacao).toBe('fechado');
  });

  it('o texto da confirmação para dispensar está exposto', () => {
    expect(CONFIRMACAO_DE_DISPENSAR).toEqual({
      titulo: 'Dispensar os primeiros passos?',
      texto: 'Eles saem do Início e o Próximo passo volta. Continuam na Ajuda, em Primeiros passos, e dá para trazer de volta de lá.',
      confirmar: 'Dispensar',
      cancelar: 'Continuar com eles',
    });
  });
});

describe('lugar do Próximo passo no Início', () => {
  const proximo = { texto: 'Nenhum aluno ainda.', botao: 'Cadastrar aluno' };

  it('lendo o aparelho: nem o bloco nem o Próximo passo', () => {
    expect(oQueMostrarNoInicio(null, proximo)).toEqual({ aguardando: true, bloco: null, proximoPasso: null, primario: null, itemPrimario: null });
  });

  it('bloco aberto toma o lugar do Próximo passo e fica com o único primário', () => {
    const r = oQueMostrarNoInicio(montar(), proximo);
    expect(r).toEqual({ aguardando: false, bloco: 'aberto', proximoPasso: null, primario: 'primeiros-passos', itemPrimario: 'marca' });
  });

  it('bloco aberto sem item para o primário não esconde o Próximo passo', () => {
    const r = oQueMostrarNoInicio(montar({ pode: (c) => ['ALUNO_CONVITE', 'PAINEL_VER'].includes(c), administrador: false }), proximo);
    expect(r).toMatchObject({ bloco: 'aberto', proximoPasso: proximo, primario: 'proximo-passo', itemPrimario: null });
  });

  it('concluído: a linha aparece e o Próximo passo volta', () => {
    expect(oQueMostrarNoInicio(montarPrimeirosPassos(tudoFeito()), proximo)).toMatchObject({ bloco: 'concluido', proximoPasso: proximo, primario: 'proximo-passo' });
  });

  it('dispensado ou fechado: só o Próximo passo', () => {
    expect(oQueMostrarNoInicio(montar({ estado: dispensar(ESTADO_INICIAL) }), proximo)).toMatchObject({ bloco: null, proximoPasso: proximo });
    const e = tudoFeito();
    expect(oQueMostrarNoInicio(montarPrimeirosPassos({ ...e, estado: fecharConcluidos(e.estado!) }), proximo)).toMatchObject({ bloco: null, proximoPasso: proximo });
  });

  it('sem Próximo passo e sem bloco, ninguém tem o primário', () => {
    expect(oQueMostrarNoInicio(montar({ estado: dispensar(ESTADO_INICIAL) }), null).primario).toBeNull();
  });

  it('devolve o mesmo Próximo passo recebido, qualquer que seja o tipo', () => {
    const outro = { qualquer: 1 };
    expect(oQueMostrarNoInicio(montar({ estado: dispensar(ESTADO_INICIAL) }), outro).proximoPasso).toBe(outro);
  });
});
