/* Prévia "visual vendável" (alvo de 11/11/2026). Dados fictícios (D8). Nada aqui fala com a API.
   Sem dependência externa. Carregar no <head> DEPOIS do base.css e SEM defer (pinta a marca antes do primeiro quadro):
     <link rel="stylesheet" href="base.css"><script src="base.js"></script>
   O <body> diz a casca: data-casca="treinador|aluno" e data-ativo="<id do item do menu>" (lista em MENU_* abaixo).
   O conteúdo da página fica em <main id="conteudo" class="pagina">; o base.js põe o menu em volta dele.
   Endereço aceita ?paleta=OCEANO&marca=C2410C&bordas=reforcadas&nome=metal (validados; valem sobre o gravado e são gravados).
   API para as páginas: window.VV (cores, papeisDaMarca, selecionarAba, desenharComposicoes, icone) e, para mudança de
   estado animada (com prefers-reduced-motion: reduce tudo troca seco, sem animação nenhuma):
     VV.sair(el)               → Promise. Item que sai da lista: some e recolhe a altura; termina com el.hidden = true.
     VV.voltar(el)             → Promise. O contrário (Desfazer): tira o hidden e abre a altura.
     VV.trocarNumero(el, v)    el contém só o número (ex.: .aba-contagem, .numero-valor sem <small>, .contagem-num).
                               O antigo sobe e some, o novo entra de baixo (~210 ms); nunca conta de 0 até N.
     VV.avisar(msg, acao?)     acao = { rotulo: 'Desfazer', fazer: fn }. Aviso embaixo (região viva, role=status);
                               some em 6 s (10 s com ação), pausa com o mouse ou o foco nele; devolve { fechar }.
     VV.fecharFolha(d, foco)   fecha a Folha mandando o foco para `foco` (em vez de voltar à origem, que pode ter saído).
     VV.contagemDoMenu(id, n)  contagem do item do menu lateral (ex.: 'atualizacoes'); 0 esconde.
     VV.vibrar('leve'|'firme') navigator.vibrate quando existe (Android/Chrome); nada no PC, no iPhone ou com reduce.
     VV.reduzir                o MediaQueryList de prefers-reduced-motion: reduce. */
(function () {
  'use strict';

  /* ====== cores: porte literal de app/src/tema/tokens.ts ====== */
  function luminancia(hex) {
    var v = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!v) return 0;
    var n = parseInt(v[1], 16);
    var c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (x) {
      var s = x / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contraste(a, b) {
    var p = [luminancia(a), luminancia(b)].sort(function (x, y) { return y - x; });
    return (p[0] + 0.05) / (p[1] + 0.05);
  }
  function textoSobre(fundo) { return contraste(fundo, '#FFFFFF') >= contraste(fundo, '#000000') ? '#FFFFFF' : '#000000'; }
  function misturar(cor, alvo, t) {
    var a = parseInt(cor.slice(1), 16), b = parseInt(alvo.slice(1), 16);
    var canal = function (d) { return Math.round(((a >> d) & 255) * (1 - t) + ((b >> d) & 255) * t); };
    return '#' + [16, 8, 0].map(function (d) { return canal(d).toString(16).padStart(2, '0').toUpperCase(); }).join('');
  }
  var HEX = /^#[0-9a-f]{6}$/i;
  function tingido(cor, base) { return HEX.test(cor) && HEX.test(base) ? misturar(base, cor, 0x18 / 255) : base; }
  function marcaParaTexto(marca, fundo) {
    if (!HEX.test(marca.trim())) return marca;
    var alvo = luminancia(fundo) < 0.18 ? '#FFFFFF' : '#000000';
    for (var t = 0; t <= 1.0001; t += 0.04) {
      var cor = misturar(marca.trim(), alvo, Math.min(t, 1));
      if (contraste(cor, fundo) >= 4.5) return cor;
    }
    return alvo;
  }

  /* marcaParaTexto conferindo TODAS as superfícies onde a cor pode cair (mesmo passo de 0,04).
     minimo: 4,5 para texto (WCAG 1.4.3), 3 para peça que não é texto (indicador, progresso; WCAG 1.4.11). */
  function marcaParaTextoEm(marca, fundos, minimo) {
    var m = minimo || 4.5, alvo = luminancia(fundos[0]) < 0.18 ? '#FFFFFF' : '#000000';
    for (var t = 0; t <= 1.0001; t += 0.04) {
      var cor = misturar(marca, alvo, Math.min(t, 1));
      if (fundos.every(function (f) { return contraste(cor, f) >= m; })) return cor;
    }
    return alvo;
  }
  /* s = superfícies da paleta {fundo, sup, sup2, sup3}. Suave e borda saem do texto (não da cor crua): marca escura
     sobre paleta escura misturada crua sumiria. O texto é conferido de novo sobre o suave (item ativo, chip marcado). */
  function papeisDaMarca(marca, s) {
    var fundos = [s.fundo, s.sup, s.sup2, s.sup3];
    var t1 = marcaParaTextoEm(marca, fundos);
    var suave = misturar(s.sup, t1, 0.14);
    var texto = marcaParaTextoEm(t1, fundos.concat([suave]));
    var sobre = textoSobre(marca);
    return {
      marca: marca.toUpperCase(),
      sobreMarca: sobre,
      marcaHover: misturar(marca, sobre === '#FFFFFF' ? '#000000' : '#FFFFFF', 0.14),
      marcaTexto: texto,
      marcaPeca: marcaParaTextoEm(marca, fundos, 3),
      marcaSuave: suave,
      marcaBorda: misturar(s.sup, texto, 0.45),
    };
  }
  /* Fundo de selo: a cor a 16% sobre a superfície; desce de 2 em 2 pontos até o `tingido` (0x18) se o texto cair de 4,5. */
  function tinto(cor, base) {
    for (var t = 0.16; t > 0x18 / 255; t -= 0.02) {
      var f = misturar(base, cor, t);
      if (contraste(cor, f) >= 4.5) return f;
    }
    return tingido(cor, base);
  }

  /* ====== catálogos ====== */
  var MARCAS = [ // app/src/dominio/paletas.ts:16-27
    ['Vermelho intenso', '#C62828'], ['Laranja', '#C2410C'], ['Âmbar', '#A16207'], ['Verde', '#15803D'],
    ['Esmeralda', '#047857'], ['Turquesa', '#0F766E'], ['Ciano', '#0E7490'], ['Azul', '#2563EB'],
    ['Índigo', '#4F46E5'], ['Roxo', '#7C3AED'], ['Magenta', '#BE185D'], ['Bronze', '#9A5B13'],
  ].map(function (m) { return { nome: m[0], cor: m[1] }; });
  var PALETAS = [
    ['ESCURO', 'Escuro', 'escuro'], ['MEIA_NOITE', 'Meia-noite', 'escuro'], ['AMEIXA', 'Ameixa', 'escuro'],
    ['OCEANO', 'Oceano', 'escuro'], ['CAFE', 'Café', 'escuro'], ['CLARO', 'Claro', 'claro'], ['AREIA', 'Areia', 'claro'],
    ['LAVANDA', 'Lavanda', 'claro'], ['CEU', 'Céu', 'claro'], ['ROSA', 'Rosa', 'claro'],
  ].map(function (p) { return { codigo: p[0], nome: p[1], modo: p[2] }; });
  var STATUS = ['sucesso', 'atencao', 'perigo', 'neutro'];
  var IDENTIFICACAO = ['ciano', 'azul', 'indigo', 'violeta', 'magenta'];
  var TIPOS = { // tipo de série → cor de identificação (Frente G)
    aq: { nome: 'Aquecimento', curto: 'Aq', classe: 'tipo-aq' },
    fs: { nome: 'FS', curto: 'FS', classe: 'tipo-fs' },
    ws: { nome: 'WS', curto: 'WS', classe: 'tipo-ws' },
    top: { nome: 'Top set', curto: 'Top set', classe: 'tipo-top' },
    bo: { nome: 'Back off', curto: 'Back off', classe: 'tipo-bo' },
  };
  function paletaDe(codigo) { return PALETAS.filter(function (p) { return p.codigo === codigo; })[0] || PALETAS[0]; }
  function nomeDaMarca(cor) {
    var m = MARCAS.filter(function (x) { return x.cor.toLowerCase() === String(cor).toLowerCase(); })[0];
    return m ? m.nome : 'Cor personalizada ' + String(cor).toUpperCase();
  }

  /* ====== escolhas guardadas (valem entre as páginas) ====== */
  /* Prefixo "vv3:" (11/11): o padrão novo (Escuro + Laranja) vale sobre o que as rodadas anteriores gravaram. */
  var PADRAO = { marca: '#C2410C', paleta: 'ESCURO', bordas: 'normais', nome: 'padrao' };
  function ler(chave) {
    try { var v = window.localStorage.getItem('vv3:' + chave); return v === null ? PADRAO[chave] : v; } catch (e) { return PADRAO[chave]; }
  }
  function gravar(chave, valor) { try { window.localStorage.setItem('vv3:' + chave, valor); } catch (e) { /* sem armazenamento: vale só nesta página */ } }
  /* Validação de cada escolha (do endereço ou do armazenamento): valor fora da lista volta ao padrão. */
  var VALIDA = {
    marca: function (v) { var m = /^#?([0-9a-f]{6})$/i.exec(String(v || '').trim()); return m ? '#' + m[1].toUpperCase() : null; },
    paleta: function (v) { var c = String(v || '').toUpperCase(); return PALETAS.some(function (p) { return p.codigo === c; }) ? c : null; },
    bordas: function (v) { return v === 'reforcadas' || v === 'normais' ? v : null; },
    nome: function (v) { return v === 'metal' || v === 'padrao' ? v : null; },
  };
  var doEndereco = new URLSearchParams(window.location.search), estado = {};
  Object.keys(VALIDA).forEach(function (k) {
    var daUrl = VALIDA[k](doEndereco.get(k));
    if (daUrl) gravar(k, daUrl);
    estado[k] = daUrl || VALIDA[k](ler(k)) || PADRAO[k];
  });

  /* Superfícies de uma paleta lidas do base.css (fonte única dos valores). */
  function superficiesDe(codigo) {
    var p = paletaDe(codigo), el = document.createElement('div');
    el.setAttribute('data-paleta', p.codigo); el.setAttribute('data-modo', p.modo); el.hidden = true;
    document.documentElement.appendChild(el);
    var cs = getComputedStyle(el), r = {};
    ['fundo', 'sup', 'sup2', 'sup3', 'faixa-forte', 'divisor', 'borda', 'campo', 'borda-campo', 'texto', 'suave']
      .concat(STATUS).concat(IDENTIFICACAO.map(function (i) { return 'id-' + i; }))
      .forEach(function (k) { r[k] = cs.getPropertyValue('--' + k).trim().toUpperCase(); });
    el.remove();
    return r;
  }
  /* Todas as cores calculadas para uma marca numa paleta (as páginas e a conferência usam). */
  function coresDe(marca, codigo) {
    var s = superficiesDe(codigo);
    var r = { superficies: s, papeis: papeisDaMarca(marca, s), tintos: {} };
    STATUS.forEach(function (k) { r.tintos[k] = tinto(s[k], s.sup); });
    IDENTIFICACAO.forEach(function (k) { r.tintos['id-' + k] = tinto(s['id-' + k], s.sup); });
    return r;
  }
  function varsDaMarca(p) {
    return { '--marca': p.marca, '--sobre-marca': p.sobreMarca, '--marca-hover': p.marcaHover, '--marca-texto': p.marcaTexto,
      '--marca-peca': p.marcaPeca, '--marca-suave': p.marcaSuave, '--marca-borda': p.marcaBorda, '--foco': p.marcaTexto };
  }
  function aplicar() {
    var raiz = document.documentElement, p = paletaDe(estado.paleta);
    raiz.setAttribute('data-paleta', p.codigo);
    raiz.setAttribute('data-modo', p.modo);
    // fixos: editores.css, aluno.css e as páginas ainda escrevem os seletores com eles (a comparação Viva/Rampa saiu)
    raiz.setAttribute('data-cor', 'calma');
    raiz.setAttribute('data-selecao', 'neutra');
    raiz.setAttribute('data-bordas', estado.bordas);
    raiz.setAttribute('data-nome', estado.nome);
    var c = coresDe(estado.marca, p.codigo), v = varsDaMarca(c.papeis);
    Object.keys(c.tintos).forEach(function (k) { v['--' + k + '-tinto'] = c.tintos[k]; });
    Object.keys(v).forEach(function (k) { raiz.style.setProperty(k, v[k]); });
    var resumo = document.querySelector('.prot .resumo');
    if (resumo) resumo.textContent = nomeDaMarca(estado.marca) + ' · ' + p.nome + (estado.bordas === 'reforcadas' ? ' · bordas reforçadas' : '') + (estado.nome === 'metal' ? ' · nome em Metal' : '');
    document.dispatchEvent(new CustomEvent('vv:tema', { detail: { marca: estado.marca, paleta: p.codigo } }));
  }
  function mudar(chave, valor) {
    estado[chave] = valor;
    gravar(chave, valor);
    aplicar(); sincronizarBarra();
  }
  aplicar();

  /* ====== ícones (traço de 2 px, desenho próprio no espírito do Lucide que o app usa) ====== */
  var ICONES = {
    casa: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    alunos: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4.1a4 4 0 0 1 0 7.8M22 21a7 7 0 0 0-4.5-6.5"/>',
    prancheta: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 13l2 2 4-4"/>',
    calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    conversa: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    livro: '<path d="M4 19V5a2 2 0 0 1 2-2h14v15H6a2 2 0 0 0-2 2 1 1 0 0 0 1 1h15"/>',
    caderno: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h4"/>',
    caixa: '<path d="M3 13h5l1.5 3h5l1.5-3h5"/><path d="M5.5 5h13L21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6z"/>',
    carteira: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2"/>',
    grafico: '<path d="M5 20V11M11 20V5M17 20v-6M3 20h18"/>',
    usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    ajuda: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/>',
    mais: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    alerta: '<path d="M10.3 4.2 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"/><path d="M12 10v4M12 17.5v.01"/>',
    erro: '<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>',
    'seta-direita': '<path d="M5 12h14M13 6l6 6-6 6"/>',
    'seta-esquerda': '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    'chevron-baixo': '<path d="M6 9l6 6 6-6"/>',
    'chevron-direita': '<path d="M9 6l6 6-6 6"/>',
    busca: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    adicionar: '<path d="M12 5v14M5 12h14"/>',
    haltere: '<path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11"/>',
    prato: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/>',
    time: '<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M2 20a6 6 0 0 1 12 0M10 20a6 6 0 0 1 12 0"/>',
    historico: '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'sem-acesso': '<circle cx="10" cy="8" r="4"/><path d="M3 21a7 7 0 0 1 10.5-6M16.5 15.5l4 4M20.5 15.5l-4 4"/>',
    balanca: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10a5 5 0 0 1 8 0l-3.5 2.5"/>',
    foto: '<rect x="3" y="6" width="18" height="14" rx="2"/><circle cx="12" cy="13" r="3.5"/><path d="M9 6l1.5-2h3L15 6"/>',
    lapis: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
    olho: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    'olho-fechado': '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    pasta: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    raio: '<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>',
    importar: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
    painel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  };
  function icone(nome, classe) {
    return '<svg class="ic' + (classe ? ' ' + classe : '') + '" aria-hidden="true" focusable="false"><use href="#i-' + nome + '"/></svg>';
  }
  function injetarIcones() {
    var simbolos = Object.keys(ICONES).map(function (k) { return '<symbol id="i-' + k + '" viewBox="0 0 24 24">' + ICONES[k] + '</symbol>'; }).join('');
    var d = document.createElement('div');
    d.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">' + simbolos + '</svg>';
    document.body.insertBefore(d.firstChild, document.body.firstChild);
  }

  /* ====== barra do protótipo ====== */
  function montarBarra() {
    var amostras = MARCAS.map(function (m) {
      return '<button type="button" class="prot-amostra" style="--a:' + m.cor + '" data-marca="' + m.cor + '" aria-label="' + m.nome + ' (' + m.cor + ')" title="' + m.nome + ' ' + m.cor + '"></button>';
    }).join('');
    var opcoes = function (modo) {
      return PALETAS.filter(function (p) { return p.modo === modo; }).map(function (p) { return '<option value="' + p.codigo + '">' + p.nome + '</option>'; }).join('');
    };
    var el = document.createElement('details');
    el.className = 'prot';
    el.innerHTML =
      '<summary><span>Prévia</span><span class="resumo"></span><span class="prot-abrir" aria-hidden="true"><span class="so-fechada">Ajustar</span><span class="so-aberta">Fechar</span></span>' + icone('chevron-baixo', 'seta') + '</summary>' +
      '<div class="prot-corpo">' +
      '<div class="prot-grupo" role="group" aria-labelledby="prot-r-marca"><span class="prot-rot" id="prot-r-marca">Cor da marca</span>' +
      '<div class="prot-amostras">' + amostras + '</div>' +
      '<label title="Cor livre"><span class="sr-only">Cor personalizada</span><input type="color" id="prot-livre"></label></div>' +
      '<div class="prot-grupo"><label class="prot-rot" for="prot-paleta">Paleta</label><select id="prot-paleta">' +
      '<optgroup label="Escuras">' + opcoes('escuro') + '</optgroup><optgroup label="Claras">' + opcoes('claro') + '</optgroup></select></div>' +
      '<label class="prot-check"><input type="checkbox" id="prot-bordas"> Bordas reforçadas</label>' +
      '<div class="prot-grupo" role="group" aria-labelledby="prot-r-nome"><span class="prot-rot" id="prot-r-nome">Nome</span>' +
      '<div class="prot-segmento"><button type="button" data-nome="padrao">Padrão</button><button type="button" data-nome="metal">Metal</button></div></div>' +
      '<a href="index.html">Todas as telas</a></div>';
    // controles próprios da página (ex.: estados da tela de entrar): <template id="prot-extra"> entra antes do link
    var extra = document.getElementById('prot-extra');
    if (extra) el.querySelector('.prot-corpo > a[href="index.html"]').before(extra.content.cloneNode(true));
    el.open = ler('barra') === 'aberta'; // recolhida por padrão
    el.addEventListener('toggle', function () { gravar('barra', el.open ? 'aberta' : 'fechada'); });
    var depois = document.querySelector('.pular'); // o "Pular para o conteúdo" continua o primeiro do Tab
    if (depois) depois.after(el); else document.body.insertBefore(el, document.body.firstChild);
    el.addEventListener('click', function (ev) {
      // só os botões da barra: o <html> também carrega data-nome e não pode ser confundido com eles
      var b = ev.target.closest('.prot-amostras [data-marca]'); if (b) mudar('marca', b.getAttribute('data-marca'));
      var n = ev.target.closest('.prot-segmento [data-nome]'); if (n) mudar('nome', n.getAttribute('data-nome'));
    });
    el.querySelector('#prot-livre').addEventListener('input', function (ev) { mudar('marca', ev.target.value.toUpperCase()); });
    el.querySelector('#prot-paleta').addEventListener('change', function (ev) { mudar('paleta', ev.target.value); });
    el.querySelector('#prot-bordas').addEventListener('change', function (ev) { mudar('bordas', ev.target.checked ? 'reforcadas' : 'normais'); });
    sincronizarBarra();
    aplicar();
  }
  function sincronizarBarra() {
    var barra = document.querySelector('.prot'); if (!barra) return;
    barra.querySelectorAll('[data-marca]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-marca').toLowerCase() === estado.marca.toLowerCase())); });
    barra.querySelectorAll('.prot-segmento [data-nome]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-nome') === estado.nome)); });
    barra.querySelector('#prot-livre').value = estado.marca.toLowerCase();
    barra.querySelector('#prot-paleta').value = estado.paleta;
    barra.querySelector('#prot-bordas').checked = estado.bordas === 'reforcadas';
  }

  /* ====== casca ====== */
  var EM_BREVE = 'index.html';
  var MENU_TREINADOR = [ // ordem e grupos = app/src/dominio/gruposDoMenu.ts (MENU_DO_TREINADOR)
    { id: 'inicio', rotulo: 'Início', icone: 'casa', href: 'treinador-inicio.html', celular: true },
    { id: 'alunos', rotulo: 'Alunos', icone: 'alunos', href: 'treinador-alunos.html', grupo: 'Acompanhamento', celular: true },
    { id: 'atualizacoes', rotulo: 'Atualizações', icone: 'prancheta', grupo: 'Acompanhamento', contagem: 3 },
    { id: 'agenda', rotulo: 'Agenda', icone: 'calendario', grupo: 'Acompanhamento' },
    { id: 'comunidade', rotulo: 'Comunidade', icone: 'conversa', grupo: 'Acompanhamento' },
    { id: 'biblioteca', rotulo: 'Biblioteca', icone: 'livro', grupo: 'Conteúdo', celular: true },
    { id: 'planejamento', rotulo: 'Planejamento', curto: 'Planos', icone: 'caderno', grupo: 'Conteúdo', celular: true },
    { id: 'interessados', rotulo: 'Interessados', icone: 'caixa', grupo: 'Negócio' },
    { id: 'financeiro', rotulo: 'Financeiro', icone: 'carteira', grupo: 'Negócio' },
    { id: 'numeros', rotulo: 'Números', icone: 'grafico', grupo: 'Negócio' },
    { id: 'perfil', rotulo: 'Perfil', icone: 'usuario', grupo: 'Configurações', celular: true },
    { id: 'equipe', rotulo: 'Equipe', icone: 'alunos', grupo: 'Configurações' },
    { id: 'ajuda', rotulo: 'Ajuda', icone: 'ajuda', grupo: 'Configurações' },
  ];
  var MENU_ALUNO = [ // app/src/app/aluno/_layout.tsx (a mobilidade acende Treino)
    { id: 'inicio', rotulo: 'Início', icone: 'casa', href: 'aluno-inicio.html' },
    { id: 'treino', rotulo: 'Treino', icone: 'haltere', href: 'aluno-treino.html' },
    { id: 'dieta', rotulo: 'Dieta', icone: 'prato', href: 'aluno-dieta.html' },
    { id: 'time', rotulo: 'Time', icone: 'time' },
    { id: 'historico', rotulo: 'Histórico', icone: 'historico' },
    { id: 'conta', rotulo: 'Conta', icone: 'usuario' },
  ];
  function atual(item, ativo) { return item.id === ativo ? ' aria-current="page"' : ''; }
  function marcaConsultoria(apoio) {
    return '<a class="marca-consultoria" href="' + (document.body.getAttribute('data-casca') === 'aluno' ? 'aluno-inicio.html' : 'treinador-inicio.html') + '">' +
      '<span class="inicial" aria-hidden="true">SF</span><span><b class="nome-consultoria">Studio Forja</b><small>' + apoio + '</small></span></a>';
  }
  function itemLateral(item, ativo) {
    var cont = item.contagem ? '<span class="contagem" data-contagem="' + item.id + '"><span class="contagem-num">' + item.contagem + '</span><span class="sr-only"> para revisar</span></span>' : '';
    return '<a class="menu-item" href="' + (item.href || EM_BREVE) + '"' + atual(item, ativo) + '>' + icone(item.icone) + '<span>' + item.rotulo + '</span>' + cont + '</a>';
  }
  function barraInferior(itens, ativo) {
    return '<nav class="barra-inferior" aria-label="Menu principal"><ul>' + itens.map(function (item) {
      return '<li><a href="' + (item.href || EM_BREVE) + '"' + atual(item, ativo) + '><span class="pilula">' + icone(item.icone) + '</span><span>' + (item.curto || item.rotulo) + '</span></a></li>';
    }).join('') + '</ul></nav>';
  }
  function montarCasca() {
    var body = document.body, tipo = body.getAttribute('data-casca'), ativo = body.getAttribute('data-ativo');
    var main = document.getElementById('conteudo');
    if (!tipo || !main) return;
    main.setAttribute('tabindex', '-1');
    var casca = document.createElement('div');
    casca.className = 'casca casca--' + tipo;
    var html;
    if (tipo === 'treinador') {
      var grupos = [], porGrupo = {};
      MENU_TREINADOR.forEach(function (i) { var g = i.grupo || ''; if (!porGrupo[g]) { porGrupo[g] = []; grupos.push(g); } porGrupo[g].push(i); });
      var lateral = grupos.map(function (g) {
        var id = 'menu-g-' + (g || 'topo').normalize('NFD').replace(/[^a-z]/gi, '').toLowerCase();
        return '<div class="menu-grupo"' + (g ? ' role="group" aria-labelledby="' + id + '"' : '') + '>' + (g ? '<span class="t-secao" id="' + id + '">' + g + '</span>' : '') +
          porGrupo[g].map(function (i) { return itemLateral(i, ativo); }).join('') + '</div>';
      }).join('');
      var titulo = (MENU_TREINADOR.filter(function (i) { return i.id === ativo; })[0] || {}).rotulo || '';
      html = '<aside class="menu-lateral" id="menu-lateral">' + marcaConsultoria('Consultoria de treino') + '<nav aria-label="Menu principal">' + lateral + '</nav>' +
        '<div class="menu-rodape"><span class="avatar" aria-hidden="true">MC</span><span class="menu-rodape-nome"><b>Marina Couto</b><small>Administradora</small></span>' +
        '<button type="button" class="botao botao--fantasma botao--icone" data-menu="menu-conta" aria-label="Conta de Marina Couto">' + icone('mais') + '</button>' +
        '<div class="menu-flutuante menu-flutuante--acima" id="menu-conta" hidden><a class="menu-flutuante-item" href="' + EM_BREVE + '">' + icone('usuario') + 'Perfil</a>' +
        '<a class="menu-flutuante-item" href="' + EM_BREVE + '">' + icone('seta-esquerda') + 'Sair</a></div></div></aside>' +
        // cabeçalho fino do painel (só no PC): recolher o menu | nome da área
        '<div class="casca-area"><div class="painel-cab"><button type="button" class="botao botao--fantasma botao--icone" id="recolher-menu" aria-controls="menu-lateral" aria-expanded="true" aria-label="Recolher o menu">' + icone('painel') + '</button>' +
        '<span class="painel-cab-sep" aria-hidden="true"></span><span class="painel-cab-titulo">' + titulo + '</span></div>' +
        '<header class="topo-movel">' + marcaConsultoria('Marina Couto') + '</header></div>' +
        barraInferior(MENU_TREINADOR.filter(function (i) { return i.celular; }), ativo);
    } else {
      html = '<div class="casca-area"><header class="topo-movel">' + marcaConsultoria('Seu treino com Marina Couto') + '</header></div>' + barraInferior(MENU_ALUNO, ativo);
    }
    casca.innerHTML = html;
    main.parentNode.insertBefore(casca, main);
    casca.querySelector('.casca-area').appendChild(main);
    var pular = document.createElement('a');
    pular.className = 'pular'; pular.href = '#conteudo'; pular.textContent = 'Pular para o conteúdo';
    body.insertBefore(pular, casca);
    var recolher = casca.querySelector('#recolher-menu');
    if (recolher) {
      var aplicarRecolhido = function (sim) {
        casca.classList.toggle('casca--recolhida', sim);
        recolher.setAttribute('aria-expanded', String(!sim));
        recolher.setAttribute('aria-label', sim ? 'Abrir o menu' : 'Recolher o menu');
      };
      aplicarRecolhido(ler('lateral') === 'recolhido');
      recolher.addEventListener('click', function () {
        var sim = !casca.classList.contains('casca--recolhida');
        gravar('lateral', sim ? 'recolhido' : 'aberto'); aplicarRecolhido(sim);
      });
    }
  }

  /* ====== composição por tipo de série: data-composicao="aq:1 fs:3 ws:1 bo:2" ====== */
  function nomeCurto(t) {
    return t.curto !== t.nome ? '<span aria-hidden="true">' + t.curto + '</span><span class="sr-only">' + t.nome + '</span>' : t.nome;
  }
  function desenharComposicoes(raiz) {
    (raiz || document).querySelectorAll('[data-composicao]').forEach(function (el) {
      var partes = el.getAttribute('data-composicao').trim().split(/\s+/).map(function (p) {
        var kv = p.split(':'); return { tipo: TIPOS[kv[0]], n: parseInt(kv[1], 10) || 0 };
      }).filter(function (p) { return p.tipo && p.n > 0; });
      var total = partes.reduce(function (a, p) { return a + p.n; }, 0);
      el.classList.add('composicao');
      el.innerHTML = '<div class="composicao-barra" aria-hidden="true">' + partes.map(function (p) {
        return '<span class="' + p.tipo.classe + '" style="--n:' + p.n + '"></span>';
      }).join('') + '</div><ul class="composicao-legenda" aria-label="' + total + ' séries por tipo">' + partes.map(function (p) {
        return '<li class="' + p.tipo.classe + '"><span><b class="num">' + p.n + '</b> ' + nomeCurto(p.tipo) + '</span></li>';
      }).join('') + '</ul>' +
        // linha de texto neutra: só aparece no modo Calma em .composicao--linha (linhas de lista); a Viva a esconde
        '<p class="composicao-texto num">' + partes.map(function (p) { return p.n + ' ' + nomeCurto(p.tipo); }).join(' · ') + '</p>';
    });
  }

  /* ====== abas (WAI-ARIA APG: setas, Home e End; ativação automática, painéis leves) ====== */
  var reduzir = window.matchMedia('(prefers-reduced-motion: reduce)');
  /* Indicador da aba escolhida: superfície levantada que desliza (FLIP: largura final na hora, a transição é só transform). */
  function posicionarIndicador(lista, animar) {
    var ind = lista.querySelector(':scope > .abas-indicador'), aba = lista.querySelector('[role="tab"][aria-selected="true"]');
    if (!ind || !aba || !aba.offsetWidth) return;
    var x = aba.offsetLeft, w = aba.offsetWidth, antes = ind._pos;
    if (antes && antes.x === x && antes.w === w) return;
    ind._pos = { x: x, w: w };
    ind.style.width = w + 'px';
    ind.style.transform = 'translateX(' + x + 'px)';
    lista.classList.add('abas--pronta');
    if (animar && antes && !reduzir.matches) {
      ind.animate([{ transform: 'translateX(' + antes.x + 'px) scaleX(' + antes.w / w + ')' }, { transform: 'translateX(' + x + 'px)' }],
        { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
  }
  function selecionarAba(aba, focar) {
    var lista = aba.closest('[role="tablist"]'), alvo = aba.getAttribute('aria-controls');
    lista.querySelectorAll('[role="tab"]').forEach(function (t) {
      var sim = t === aba;
      t.setAttribute('aria-selected', String(sim));
      t.tabIndex = sim ? 0 : -1;
      // várias abas podem controlar o mesmo painel (filtro): esconde só os outros, depois mostra o alvo
      var id = t.getAttribute('aria-controls'), painel = id && id !== alvo && document.getElementById(id);
      if (painel) painel.hidden = true;
    });
    var painelAlvo = alvo && document.getElementById(alvo);
    if (painelAlvo) painelAlvo.hidden = false;
    if (focar) aba.focus();
    posicionarIndicador(lista, true);
    // faixa de abas rola no celular: a escolhida fica sempre à vista
    var dl = aba.getBoundingClientRect(), ll = lista.getBoundingClientRect();
    if (dl.left < ll.left) lista.scrollLeft -= ll.left - dl.left + 16;
    else if (dl.right > ll.right) lista.scrollLeft += dl.right - ll.right + 16;
    lista.dispatchEvent(new CustomEvent('aba', { detail: { id: aba.id } }));
  }
  function ligarAbas() {
    var observador = 'ResizeObserver' in window ? new ResizeObserver(function (itens) {
      itens.forEach(function (i) { var l = i.target.closest('.abas'); if (l) posicionarIndicador(l, false); });
    }) : null;
    document.querySelectorAll('[role="tablist"]').forEach(function (lista) {
      var abas = Array.prototype.slice.call(lista.querySelectorAll('[role="tab"]'));
      abas.forEach(function (t) { t.tabIndex = t.getAttribute('aria-selected') === 'true' ? 0 : -1; });
      if (lista.classList.contains('abas')) {
        var ind = document.createElement('span');
        ind.className = 'abas-indicador'; ind.setAttribute('aria-hidden', 'true');
        lista.insertBefore(ind, lista.firstChild);
        posicionarIndicador(lista, false);
        if (observador) { observador.observe(lista); abas.forEach(function (t) { observador.observe(t); }); }
        if (document.fonts) document.fonts.ready.then(function () { posicionarIndicador(lista, false); });
      }
      lista.addEventListener('click', function (ev) { var t = ev.target.closest('[role="tab"]'); if (t) selecionarAba(t); });
      lista.addEventListener('keydown', function (ev) {
        var i = abas.indexOf(document.activeElement); if (i < 0) return;
        var alvo = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: abas.length - 1 }[ev.key];
        if (alvo === undefined) return;
        ev.preventDefault();
        selecionarAba(abas[(alvo + abas.length) % abas.length], true);
      });
    });
  }

  /* ====== menu ⋯ (padrão "disclosure": botão com aria-expanded; Esc e clique fora fecham) ====== */
  function fecharMenus(exceto, devolverFoco) {
    document.querySelectorAll('[data-menu][aria-expanded="true"]').forEach(function (b) {
      if (b === exceto) return;
      b.setAttribute('aria-expanded', 'false');
      var m = document.getElementById(b.getAttribute('data-menu')); if (m) m.hidden = true;
      if (devolverFoco) b.focus();
    });
  }
  function ligarMenus() {
    document.querySelectorAll('[data-menu]').forEach(function (b) {
      b.setAttribute('aria-expanded', 'false');
      b.setAttribute('aria-controls', b.getAttribute('data-menu'));
    });
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-menu]');
      if (b) {
        var aberto = b.getAttribute('aria-expanded') === 'true';
        fecharMenus(b);
        b.setAttribute('aria-expanded', String(!aberto));
        var m = document.getElementById(b.getAttribute('data-menu'));
        if (m) { m.hidden = aberto; if (!aberto) { var p = m.querySelector('a,button'); if (p) p.focus(); } }
        return;
      }
      if (!ev.target.closest('.menu-flutuante') || ev.target.closest('.menu-flutuante-item')) fecharMenus();
    });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') fecharMenus(null, true); });
  }

  /* ====== chips: .grupo-chips[data-unico] (um só marcado) ou [data-multiplo]; evento "escolha" no grupo ====== */
  function ligarChips() {
    document.addEventListener('click', function (ev) {
      var chip = ev.target.closest('.grupo-chips .chip'); if (!chip) return;
      var grupo = chip.closest('.grupo-chips');
      if (grupo.hasAttribute('data-unico')) grupo.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-pressed', String(c === chip)); });
      else if (grupo.hasAttribute('data-multiplo')) chip.setAttribute('aria-pressed', String(chip.getAttribute('aria-pressed') !== 'true'));
      else return;
      grupo.dispatchEvent(new CustomEvent('escolha', { detail: { chip: chip } }));
    });
  }

  /* ====== folha (dialog modal): [data-folha="id"] abre; [data-fechar-folha], Esc (nativo) e clique fora fecham;
     o foco vai ao título da folha e volta a quem abriu ====== */
  function ligarFolhas() {
    document.addEventListener('click', function (ev) {
      var abre = ev.target.closest('[data-folha]');
      if (abre) {
        var d = document.getElementById(abre.getAttribute('data-folha'));
        if (d && !d.open) {
          d._origem = abre;
          d.showModal();
          var t = d.querySelector('[tabindex="-1"]'); if (t) t.focus();
        }
        return;
      }
      var fecha = ev.target.closest('[data-fechar-folha]');
      if (fecha) { fecha.closest('dialog').close(); return; }
      // clique no véu: o alvo é o próprio <dialog> (a caixa interna cobre todo o resto)
      if (ev.target.matches('dialog.folha[open]')) ev.target.close();
    });
    document.querySelectorAll('dialog.folha').forEach(function (d) {
      d.addEventListener('close', function () { if (d._origem && d._origem.isConnected) d._origem.focus(); });
    });
  }
  function fecharFolha(d, foco) { if (foco) d._origem = foco; d.close(); }

  /* ====== mudança de estado animada (documentada no cabeçalho) ====== */
  var CURVA = 'cubic-bezier(.2,.8,.2,1)';
  function cancelarAnimacoes(el) { if (el.getAnimations) el.getAnimations().forEach(function (a) { a.cancel(); }); }
  function caixaDe(el) {
    var cs = getComputedStyle(el);
    return { height: el.getBoundingClientRect().height + 'px', paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, borderTopWidth: cs.borderTopWidth };
  }
  var FECHADA = { height: '0px', paddingTop: '0px', paddingBottom: '0px', borderTopWidth: '0px' };
  function quadro(caixa, opacidade, extra) {
    var q = { height: caixa.height, paddingTop: caixa.paddingTop, paddingBottom: caixa.paddingBottom, borderTopWidth: caixa.borderTopWidth, minHeight: '0px', opacity: opacidade };
    if (extra) Object.keys(extra).forEach(function (k) { q[k] = extra[k]; });
    return q;
  }
  // Cada chamada leva uma marca própria: o fim de uma animação cancelada (Desfazer no meio da saída) não desfaz a seguinte.
  function animarAltura(el, quadros, duracao, fim) {
    var meu = el._mudanca = {};
    el.style.overflow = 'hidden';
    var a = el.animate(quadros, { duration: duracao, easing: CURVA });
    return new Promise(function (ok) {
      function terminou() { if (el._mudanca === meu) { el.style.overflow = ''; fim(); } ok(); }
      a.onfinish = terminou; a.oncancel = terminou;
    });
  }
  function sair(el) {
    cancelarAnimacoes(el);
    if (reduzir.matches || !el.animate || el.hidden) { el._mudanca = {}; el.hidden = true; return Promise.resolve(); }
    var c = caixaDe(el);
    return animarAltura(el, [quadro(c, 1), quadro(c, 0, { offset: .4 }), quadro(FECHADA, 0)], 220, function () { el.hidden = true; });
  }
  function voltar(el) {
    cancelarAnimacoes(el);
    el.hidden = false;
    if (reduzir.matches || !el.animate) { el._mudanca = {}; return Promise.resolve(); }
    var c = caixaDe(el);
    return animarAltura(el, [quadro(FECHADA, 0), quadro(c, 0, { offset: .55 }), quadro(c, 1)], 220, function () {});
  }
  function trocarNumero(el, valor) {
    var texto = String(valor), alvo = el.querySelector(':scope > .troca');
    if (!alvo) { alvo = document.createElement('span'); alvo.className = 'troca'; alvo.textContent = el.textContent; el.textContent = ''; el.appendChild(alvo); }
    cancelarAnimacoes(alvo);
    var meu = alvo._mudanca = {};
    if (alvo.textContent === texto) return;
    if (reduzir.matches || !alvo.animate) { alvo.textContent = texto; return; }
    var sai = alvo.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-60%)', opacity: 0 }], { duration: 80, easing: 'ease-in', fill: 'forwards' });
    // o valor final é gravado também se a saída for cancelada por outra troca (a outra grava o dela por cima)
    function grava() { if (alvo._mudanca === meu) alvo.textContent = texto; }
    sai.oncancel = grava;
    sai.onfinish = function () {
      if (alvo._mudanca !== meu) return;
      grava(); sai.cancel();
      alvo.animate([{ transform: 'translateY(60%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 110, easing: CURVA });
    };
  }
  function contagemDoMenu(id, n) {
    document.querySelectorAll('[data-contagem="' + id + '"]').forEach(function (c) {
      if (n > 0) { var era = c.hidden; c.hidden = false; var num = c.querySelector('.contagem-num'); if (era) { num.textContent = String(n); } else trocarNumero(num, n); }
      else c.hidden = true;
    });
  }
  var areaAviso = null, avisoAtual = null;
  function garantirAreaAviso() {
    if (!areaAviso) {
      areaAviso = document.createElement('div');
      areaAviso.className = 'aviso-area';
      areaAviso.setAttribute('role', 'status');
      areaAviso.setAttribute('aria-live', 'polite');
      document.body.appendChild(areaAviso);
    }
    return areaAviso;
  }
  function avisar(msg, acao) {
    var area = garantirAreaAviso();
    if (avisoAtual) avisoAtual.fechar(true);
    var caixa = document.createElement('div');
    caixa.className = 'aviso';
    caixa.innerHTML = '<span class="aviso-texto"></span>' +
      (acao ? '<button type="button" class="botao botao--fantasma aviso-acao"></button>' : '') +
      '<button type="button" class="botao botao--icone botao--fantasma" aria-label="Fechar aviso">' + icone('fechar') + '</button>';
    caixa.querySelector('.aviso-texto').textContent = msg;
    var resta = acao ? 10000 : 6000, inicio = 0, timer = null, parado = false, feito = false, focoAntes = null;
    function contar() { if (feito || !parado && timer) return; parado = false; inicio = Date.now(); timer = setTimeout(function () { fechar(); }, resta); }
    function pausar() { if (parado || feito) return; parado = true; clearTimeout(timer); resta = Math.max(2000, resta - (Date.now() - inicio)); }
    function fechar(imediato) {
      if (feito) return; feito = true; clearTimeout(timer);
      if (avisoAtual === api) avisoAtual = null;
      // o foco estava no aviso (Tab até o Desfazer): volta para onde estava antes, nunca para o <body>
      if (caixa.contains(document.activeElement) && focoAntes && focoAntes.isConnected) focoAntes.focus();
      function tirar() { caixa.remove(); if (!area.children.length) document.documentElement.classList.remove('com-aviso'); }
      if (imediato || reduzir.matches) tirar(); else { caixa.classList.add('aviso--saindo'); setTimeout(tirar, 220); }
    }
    caixa.addEventListener('mouseenter', pausar);
    caixa.addEventListener('mouseleave', function () { if (!caixa.contains(document.activeElement)) contar(); });
    caixa.addEventListener('focusin', function (ev) { if (!caixa.contains(ev.relatedTarget) && !focoAntes) focoAntes = ev.relatedTarget; pausar(); });
    caixa.addEventListener('focusout', function (ev) { if (!caixa.contains(ev.relatedTarget) && !caixa.matches(':hover')) contar(); });
    if (acao) caixa.querySelector('.aviso-acao').textContent = acao.rotulo;
    caixa.addEventListener('click', function (ev) {
      if (ev.target.closest('.aviso-acao')) { fechar(true); acao.fazer(); }
      else if (ev.target.closest('[aria-label="Fechar aviso"]')) fechar();
    });
    area.appendChild(caixa);
    document.documentElement.classList.add('com-aviso');
    var api = { fechar: fechar, elemento: caixa };
    avisoAtual = api;
    contar();
    return api;
  }
  function vibrar(tipo) {
    if (reduzir.matches || typeof navigator.vibrate !== 'function') return false;
    return navigator.vibrate(tipo === 'firme' ? [12, 40, 18] : 10);
  }

  window.VV = {
    luminancia: luminancia, contraste: contraste, textoSobre: textoSobre, misturar: misturar, tingido: tingido,
    marcaParaTexto: marcaParaTexto, marcaParaTextoEm: marcaParaTextoEm, papeisDaMarca: papeisDaMarca, tinto: tinto,
    coresDe: coresDe, varsDaMarca: varsDaMarca, superficiesDe: superficiesDe, MARCAS: MARCAS, PALETAS: PALETAS, TIPOS: TIPOS,
    estado: function () { return { marca: estado.marca, paleta: estado.paleta, bordas: estado.bordas, nome: estado.nome, cor: 'calma', selecao: 'neutra', anotacoes: 'nao' }; },
    icone: icone, selecionarAba: selecionarAba, desenharComposicoes: desenharComposicoes, nomeDaMarca: nomeDaMarca,
    sair: sair, voltar: voltar, trocarNumero: trocarNumero, avisar: avisar, fecharFolha: fecharFolha,
    contagemDoMenu: contagemDoMenu, vibrar: vibrar, reduzir: reduzir,
  };

  document.addEventListener('DOMContentLoaded', function () {
    injetarIcones();
    montarCasca();
    montarBarra();
    desenharComposicoes();
    ligarAbas();
    ligarMenus();
    ligarChips();
    ligarFolhas();
    // região viva criada vazia no carregamento: a que nasce já com o texto costuma não ser anunciada
    garantirAreaAviso();
  });
})();
