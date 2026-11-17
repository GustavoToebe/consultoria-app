import { PALETAS as CORES_DA_MARCA } from '../dominio/paletas';
import { coresComBordasReforcadas, coresComContraste } from '../dominio/preferencias';
import {
  CHAVES_DA_AGENDA,
  CHAVES_DE_IDENTIFICACAO,
  CLARO,
  ESCURO,
  PALETA_DA_AGENDA,
  PALETA_SO_DO_PERFIL,
  PALETAS,
  corDoTomDoPerfil,
  PALETA_DE_IDENTIFICACAO,
  contraste,
  corDaAgenda,
  coresDeDestaque,
  coresDeIdentificacao,
  luminancia,
  marcaAoPassar,
  marcaParaPeca,
  marcaParaTexto,
  marcaParaTitulo,
  textoSobre,
  tingido,
  type Cores,
  type VarianteDoTema,
} from './tokens';
import { variaveisDoTema } from './variaveis';
import { FUNCOES_DE_DESTAQUE } from '../dominio/destaque';

/** Todas as paletas da marca (decisão 1 do plano `paletas-da-marca`): cada teste de contraste percorre a lista inteira. */
const TODAS: [string, Cores, boolean, VarianteDoTema][] = Object.entries(PALETAS).map(([codigo, p]) => [codigo, p.cores, p.modo === 'ESCURO', p.variante]);

// ---- Escada do visual-ponytail (17/11, canvas "Overtraining · proposta visual") ----

/**
 * Página quase da cor do cartão; quem separa o cartão é a sombra (`sombra`) e o contorno sutil (`divisor`), não um cinza
 * mais escuro na página. Faixa (`superficie3`) e poço (`superficie2`) continuam distintos do cartão e da página.
 */
function conferirEscada(cores: Cores) {
  for (const pagina of [cores.fundo, cores.painel]) expect(cores.superficie3).not.toBe(pagina);
  expect(cores.superficie3).not.toBe(cores.superficie);
  expect(cores.superficie2).not.toBe(cores.superficie);
  expect(contraste(cores.divisor, cores.superficie)).toBeGreaterThanOrEqual(1.15);
  expect(contraste(cores.texto, cores.superficie)).toBeGreaterThanOrEqual(7);
  expect(cores.sombra).toMatch(/rgba\(/);
}

it('Claro: menu branco, página #F5F6F8 e cartão branco (canvas)', () => {
  expect(PALETAS.CLARO.cores).toMatchObject({ fundo: '#FFFFFF', painel: '#F5F6F8', superficie: '#FFFFFF', superficie2: '#F1F3F6' });
  conferirEscada(PALETAS.CLARO.cores);
});

it('Areia: tons quentes, página #EDE7DB e cartão #FFFCF6 (canvas)', () => {
  expect(PALETAS.AREIA.cores).toMatchObject({ fundo: '#F3EEE5', painel: '#EDE7DB', superficie: '#FFFCF6', superficie2: '#F4EEE3' });
  conferirEscada(PALETAS.AREIA.cores);
});

it('Escuro: página #070707, cartão #0F0F0F e poço #161614 (canvas, estilo ponytail)', () => {
  expect(PALETAS.ESCURO.cores).toMatchObject({ fundo: '#070707', painel: '#070707', superficie: '#0F0F0F', superficie2: '#161614' });
  conferirEscada(PALETAS.ESCURO.cores);
});

it.each(TODAS.filter(([codigo]) => !['CLARO', 'AREIA', 'ESCURO'].includes(codigo)))('%s: a mesma escada', (_codigo, cores) => {
  conferirEscada(cores);
});

it.each(TODAS)('%s: cor de ação legível no botão de ação, no cartão e com texto por cima', (_codigo, cores) => {
  expect(contraste(cores.acao, cores.acaoSuave)).toBeGreaterThanOrEqual(4.5);
  expect(contraste(cores.acao, cores.superficie)).toBeGreaterThanOrEqual(4.5);
  expect(contraste(cores.sobreAcao, cores.acao)).toBeGreaterThanOrEqual(4.5);
});

it.each(TODAS)('%s: preserva contraste AA nos detalhes de todas as superfícies', (_codigo, cores) => {
  for (const superficie of [cores.superficie, cores.superficie2, cores.superficie3]) {
    expect(contraste(cores.textoSuave, superficie)).toBeGreaterThanOrEqual(4.5);
  }
});

it.each(TODAS)('%s: status e neutro servem de texto em todas as superfícies', (_codigo, cores) => {
  for (const cor of [cores.sucesso, cores.atencao, cores.perigo, cores.neutro]) {
    for (const superficie of [cores.superficie, cores.superficie2, cores.superficie3, cores.sobre]) {
      expect(contraste(cor, superficie)).toBeGreaterThanOrEqual(4.5);
    }
  }
  expect(contraste('#FFFFFF', cores.perigoFundo)).toBeGreaterThanOrEqual(4.5);
  expect(cores.anelFoco).toBe(cores.texto);
  for (const fase of [cores.fase1, cores.fase2, cores.fase3, cores.fase4]) {
    expect(contraste(fase, cores.superficie)).toBeGreaterThanOrEqual(3);
    expect(contraste(fase, cores.perigo)).toBeGreaterThan(1.4);
    expect(contraste('#FFFFFF', fase) >= 4.5 || contraste('#111114', fase) >= 4.5).toBe(true);
  }
});

describe('marcaParaTexto', () => {
  it('mantém a cor que já contrasta e clareia ou escurece a que não contrasta', () => {
    expect(marcaParaTexto('#FACC15', ESCURO.fundo)).toBe('#FACC15');
    expect(marcaParaTexto('#C62828', CLARO.superficie)).toBe('#C62828');
    for (const marca of ['#C62828', '#2563EB', '#52525B', '#7C3AED', '#E5484D']) {
      expect(contraste(marcaParaTexto(marca, ESCURO.superficie), ESCURO.superficie)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(marcaParaTexto(marca, CLARO.superficie), CLARO.superficie)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('devolve o texto como veio quando não é #RRGGBB', () => {
    expect(marcaParaTexto('vermelho', ESCURO.fundo)).toBe('vermelho');
  });
});

it.each(TODAS.filter(([, , escuro]) => escuro))('%s: o item (superficie2) se distingue do cartão, para o trilho das barras de progresso aparecer dentro dele', (_codigo, cores) => {
  expect(cores.superficie2).not.toBe(cores.superficie);
  expect(contraste(cores.superficie2, cores.superficie)).toBeGreaterThanOrEqual(1.05);
});

it.each(TODAS)('%s: campo, borda e cartão se distinguem', (_codigo, cores) => {
  expect(contraste(cores.bordaCampo, cores.campo)).toBeGreaterThanOrEqual(3);
  // Contorno sutil de propósito (visual-ponytail, 17/11): o cartão se separa pela sombra; `borda` é a dos controles.
  expect(contraste(cores.borda, cores.superficie)).toBeGreaterThanOrEqual(1.4);
  expect(contraste(cores.faixaForte, cores.superficie)).toBeGreaterThan(contraste(cores.superficie3, cores.superficie));
});

// ---- Visual de 11/11 (guia em PDF, págs. 4, 5, 6, 12 e 13) ----

describe('pares medidos do guia na paleta de partida (Escuro)', () => {
  it('texto, texto secundário e borda de campo mantêm alto contraste na hierarquia do tema escuro', () => {
    expect(contraste(ESCURO.texto, ESCURO.superficie)).toBeGreaterThanOrEqual(15);
    expect(contraste(ESCURO.textoSuave, ESCURO.superficie2)).toBeGreaterThanOrEqual(7);
    expect(contraste(ESCURO.bordaCampo, ESCURO.superficie)).toBeGreaterThanOrEqual(3);
    expect(contraste(ESCURO.sucesso, ESCURO.sucessoSuave)).toBeGreaterThanOrEqual(7.5);
    expect(contraste(ESCURO.atencao, ESCURO.atencaoSuave)).toBeGreaterThanOrEqual(7.2);
    expect(contraste('#FFFFFF', '#C62828')).toBeCloseTo(5.62, 1);
  });
});

it.each(TODAS)('%s: menu (fundo) e página (painel)', (_codigo, cores, escuro) => {
  // Escuras: menu e página no mesmo quase-preto (ponytail). Claras: menu claro, página um tom abaixo.
  if (escuro) expect(cores.painel).toBe(cores.fundo);
  else expect(luminancia(cores.painel)).toBeLessThanOrEqual(luminancia(cores.fundo));
});

it.each(TODAS.filter(([, , escuro]) => !escuro))('%s: cartão claro sobre a página tingida, poço abaixo do cartão, campo com contorno forte', (_codigo, cores) => {
  expect(luminancia(cores.superficie)).toBeGreaterThan(luminancia(cores.painel));
  expect(contraste(cores.superficie, cores.painel)).toBeGreaterThanOrEqual(1.05);
  expect(luminancia(cores.superficie2)).toBeLessThan(luminancia(cores.superficie));
  expect(contraste(cores.bordaCampo, cores.superficie)).toBeGreaterThanOrEqual(2 * contraste(cores.divisor, cores.superficie));
});

/** Pág. 12: os pares reais de cada paleta, com contraste alto e com bordas reforçadas. */
const VARIANTES: [string, Cores, VarianteDoTema][] = TODAS.flatMap(([nome, base, escuro, variante]) => [
  [nome, base, variante],
  [`${nome} com contraste alto`, coresComContraste(base, 'ALTO', escuro), variante],
  [`${nome} com bordas reforçadas`, coresComBordasReforcadas(base, true), variante],
]) as [string, Cores, VarianteDoTema][];

describe.each(VARIANTES)('medidas do guia (%s)', (_nome, cores) => {
  const superficies = [cores.fundo, cores.painel, cores.superficie, cores.superficie2, cores.superficie3, cores.sobre, cores.sobreNaFaixa];

  it('texto e texto secundário ≥ 4,5:1 em toda superfície (inclusive hover e seleção)', () => {
    for (const fundo of superficies) {
      expect(contraste(cores.texto, fundo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(cores.textoSuave, fundo)).toBeGreaterThanOrEqual(4.5);
    }
  });

  // A6 (17/11): com a escada nova a faixa ficou a 1,03:1 do poço no Claro (1,04 na Areia, e mais escura que ele): o hover e
  // a seleção que iam do poço para a faixa sumiam. O realce precisa se ver contra o repouso (cartão ou poço).
  it('hover, apertado e seleção (`sobre`) ≥ 1,10:1 contra o cartão e o poço', () => {
    for (const repouso of [cores.superficie, cores.superficie2, cores.campo]) expect(contraste(cores.sobre, repouso)).toBeGreaterThanOrEqual(1.1);
  });

  // Faixa do título (ações do `Cartao`, `CabecalhoDeGrupo`, `FaixaDoPainel`) e `IconeBotao` em qualquer superfície. Nas
  // escuras não dá para ser o mesmo `sobre`: clarear a faixa até 1,10:1 derruba o `perigo` como texto abaixo de 4,5:1,
  // por isso o que fica nele é só texto, texto secundário e ícone (3:1).
  it('hover sobre a faixa e do ícone (`sobreNaFaixa`) ≥ 1,10:1 contra o cartão, o poço e a faixa; ícones ≥ 3:1 nele', () => {
    for (const repouso of [cores.superficie, cores.superficie2, cores.superficie3, cores.campo]) expect(contraste(cores.sobreNaFaixa, repouso)).toBeGreaterThanOrEqual(1.1);
    for (const icone of [cores.texto, cores.textoSuave, cores.bordaCampo, cores.sucesso, cores.atencao, cores.perigo, cores.informacao, cores.conquista]) {
      expect(contraste(icone, cores.sobreNaFaixa)).toBeGreaterThanOrEqual(3);
    }
  });

  it('borda de campo ≥ 3:1 contra o campo e o cartão vizinhos', () => {
    for (const fundo of [cores.campo, cores.superficie, cores.painel]) expect(contraste(cores.bordaCampo, fundo)).toBeGreaterThanOrEqual(3);
  });

  it('seleção neutra: o contorno do escolhido (bordaCampo) ≥ 3:1 contra a seleção e a trilha em volta', () => {
    for (const fundo of [cores.sobre, cores.superficie3, cores.superficie2, cores.superficie]) expect(contraste(cores.bordaCampo, fundo)).toBeGreaterThanOrEqual(3);
  });

  it('anel de foco ≥ 3:1 sobre toda superfície e sobre o campo', () => {
    for (const fundo of [...superficies, cores.campo]) expect(contraste(cores.anelFoco, fundo)).toBeGreaterThanOrEqual(3);
  });

  it('texto do selo (a própria cor) ≥ 4,5:1 sobre o fundo suave da situação', () => {
    expect(contraste(cores.sucesso, cores.sucessoSuave)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(cores.atencao, cores.atencaoSuave)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(cores.perigo, cores.perigoSuave)).toBeGreaterThanOrEqual(4.5);
  });

  it('ponto do selo e ícone de situação ≥ 3:1 sobre o cartão e o fundo suave', () => {
    for (const [cor, suave] of [[cores.sucesso, cores.sucessoSuave], [cores.atencao, cores.atencaoSuave], [cores.perigo, cores.perigoSuave]]) {
      for (const fundo of [cores.superficie, cores.superficie2, suave]) expect(contraste(cor, fundo)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe.each(TODAS)('as 12 cores da marca na paleta %s (pág. 6)', (_codigo, cores) => {
  it.each(CORES_DA_MARCA.map((p) => [p.nome, p.cor]))('%s: texto do botão, hover, peça e texto da marca', (_nome, marca) => {
    const sobre = textoSobre(marca);
    expect(contraste(sobre, marca)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(sobre, marcaAoPassar(marca))).toBeGreaterThanOrEqual(4.5);
    const peca = marcaParaPeca(marca, [cores.superficie3, cores.fundo, cores.painel, cores.superficie]);
    for (const fundo of [cores.superficie3, cores.fundo, cores.painel, cores.superficie]) expect(contraste(peca, fundo)).toBeGreaterThanOrEqual(3);
    expect(contraste(marcaParaTexto(marca, cores.superficie3), cores.superficie3)).toBeGreaterThanOrEqual(4.5);
    // Nome da marca no título: ≥ 4,5:1 no fundo real, e a cor de sempre fica quando já passa nele.
    for (const fundo of [cores.fundo, cores.painel]) {
      const titulo = marcaParaTitulo(marca, fundo, cores.superficie3);
      expect(contraste(titulo, fundo)).toBeGreaterThanOrEqual(4.5);
      const deSempre = marcaParaTexto(marca, cores.superficie3);
      if (contraste(deSempre, fundo) >= 4.5) expect(titulo).toBe(deSempre);
    }
  });
});

it('trocar a marca não muda nenhuma cor de situação nem de categoria (pág. 4)', () => {
  // A categoria (`coresDeIdentificacao`) nem recebe a marca: só a paleta e o modo.
  for (const { cores } of Object.values(PALETAS)) {
    const comNeutra = variaveisDoTema(cores, '#52525B');
    for (const { cor } of CORES_DA_MARCA) {
      const comMarca = variaveisDoTema(cores, cor);
      for (const chave of ['--color-sucesso', '--color-atencao', '--color-perigo', '--color-neutro', '--color-destructive'] as const) {
        expect(comMarca[chave]).toBe(comNeutra[chave]);
      }
    }
  }
});

// ---- Destaque do número de indicador (`docs/planos/cores-de-destaque.md`, D3 e D4) ----

describe.each(VARIANTES)('cores de destaque (%s)', (_nome, cores, variante) => {
  const destaque = coresDeDestaque(cores, variante);

  it('verde, âmbar e vermelho são os da situação (D13: o mesmo do selo)', () => {
    expect(destaque.verde.cor).toBe(cores.sucesso);
    expect(destaque.ambar.cor).toBe(cores.atencao);
    expect(destaque.vermelho.cor).toBe(cores.perigo);
  });

  // Medido na cor composta, sem arredondar (D4): `contraste` devolve a razão exata.
  it('o número na cor do destaque passa 4,5:1 sobre o fundo tonalizado, também no hover', () => {
    for (const f of FUNCOES_DE_DESTAQUE) {
      const { cor, fundo, fundoSobre } = destaque[f];
      expect(fundo).toMatch(/^#[0-9A-F]{6}$/);
      expect(contraste(cor, fundo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(cor, fundoSobre)).toBeGreaterThanOrEqual(4.5);
    }
  });

  // Aba Lançamentos: o valor e o tipo usam azul e vermelho de destaque como texto solto na linha, na tabela e no campo; os
  // recordes do aluno ("N recordes neste treino", título do aviso de recorde) usam o violeta como texto solto.
  it('azul (entrada), vermelho (saída) e violeta (recorde) passam 4,5:1 como texto fora do fundo tonalizado', () => {
    for (const f of ['azul', 'vermelho', 'violeta'] as const) {
      for (const fundo of [cores.fundo, cores.painel, cores.superficie, cores.superficie2, cores.campo]) {
        expect(contraste(destaque[f].cor, fundo)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  // Evolução (peso, respostas, medidas da avaliação): o valor medido vai em azul solto na linha da `Tabela`, que no toque
  // ou na seleção passa a `sobre`.
  it('azul (valor medido) passa 4,5:1 como texto também na linha ativa (sobre)', () => {
    for (const fundo of [cores.superficie3, cores.sobre]) expect(contraste(destaque.azul.cor, fundo)).toBeGreaterThanOrEqual(4.5);
  });

  it('rótulo (texto) e detalhe (textoSuave) seguem legíveis sobre o fundo tonalizado', () => {
    for (const f of FUNCOES_DE_DESTAQUE) {
      for (const fundo of [destaque[f].fundo, destaque[f].fundoSobre]) {
        expect(contraste(cores.texto, fundo)).toBeGreaterThanOrEqual(4.5);
        expect(contraste(cores.textoSuave, fundo)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  // Gráficos (cores-de-destaque, 13/11): barras recebido azul × previsto ciano (Visão geral) e recebido azul × entradas violeta
  // (Início); rosca verde, azul e cinza. Medido: azul × ciano 1,75 no escuro e 1,25 no claro; azul × violeta 1,38 e 1,06. A
  // luminosidade pouco as separa, então cada série passa 3:1 sobre o cartão (e a trilha da rosca) e a distinção vem da
  // legenda com texto e do vão entre as barras/fatias; o piso abaixo só trava uma troca de token que juntasse as duas.
  it('séries dos gráficos: cada cor passa 3:1 sobre o cartão e a trilha, e o par de barras não colapsa', () => {
    for (const f of ['azul', 'ciano', 'violeta', 'verde'] as const) {
      for (const fundo of [cores.superficie, cores.superficie2, cores.superficie3, cores.sobre]) expect(contraste(destaque[f].cor, fundo)).toBeGreaterThanOrEqual(3);
    }
    for (const fundo of [cores.superficie, cores.superficie2, cores.superficie3, cores.sobre]) expect(contraste(cores.neutro, fundo)).toBeGreaterThanOrEqual(3);
    expect(contraste(destaque.azul.cor, destaque.ciano.cor)).toBeGreaterThanOrEqual(1.2);
    expect(contraste(destaque.azul.cor, destaque.violeta.cor)).toBeGreaterThanOrEqual(1.05);
  });

  it('a faixa lateral passa 3:1 contra o fundo de dentro e as superfícies de fora', () => {
    for (const f of FUNCOES_DE_DESTAQUE) {
      const { cor, fundo, fundoSobre } = destaque[f];
      for (const vizinho of [fundo, fundoSobre, cores.superficie, cores.painel, cores.fundo]) {
        expect(contraste(cor, vizinho)).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
