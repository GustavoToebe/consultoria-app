import type { RedeDaConsultoria } from '../api/tipos';
import { PALETAS, contraste } from '../tema/tokens';
import { linkParaAbrir } from './links';
import {
  COR_DA_REDE, CONTRASTE_DO_BRILHO, CONTRASTE_DO_GLIFO, corDoBrilho, corDoGlifo, corpoDasRedes, erroDaRede, erroDaRedeDigitada, erroDoUsuarioDaRede,
  formDasRedes, FUNDO_DO_BOTAO_DE_REDE, FUNDO_DO_BOTAO_DE_REDE_AO_PASSAR, GLIFO_NEUTRO_DA_REDE, linkDoPerfilDoAluno, NOME_DA_REDE, REDES_DA_CONSULTORIA,
  REDES_SOCIAIS_DO_ALUNO, redeParaEnvio, redesAdicionadas, redesAlteradas, redesDisponiveisParaAdicionar, redesDoAluno, redesDoAlunoParaEnvio,
  redesPreenchidas, rotuloCurto, usuarioDaRede, valoresDasRedesDaConsultoria, valoresDasRedesDoAluno, type MarcaDoBotao,
} from './redesSociais';

describe('ordem e nomes', () => {
  it('consultoria com oito, aluno com seis (sem X e site), nomes da marca', () => {
    expect(REDES_DA_CONSULTORIA).toEqual(['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'telegram', 'x', 'site']);
    expect(REDES_SOCIAIS_DO_ALUNO).toEqual(['instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'telegram']);
    expect(REDES_DA_CONSULTORIA.map((r) => NOME_DA_REDE[r])).toEqual(['Instagram', 'TikTok', 'YouTube', 'Facebook', 'LinkedIn', 'Telegram', 'X', 'Site']);
  });
});

describe('redesPreenchidas', () => {
  it('só as preenchidas, na ordem fixa, e só https', () => {
    expect(redesPreenchidas({ site: 'https://exemplo.test', instagram: 'https://www.instagram.com/exemplo', youtube: null, x: '', tiktok: 'http://tiktok.com/@x' }))
      .toEqual([{ rede: 'instagram', url: 'https://www.instagram.com/exemplo' }, { rede: 'site', url: 'https://exemplo.test' }]);
    expect(redesPreenchidas(undefined)).toEqual([]);
    expect(redesPreenchidas(null)).toEqual([]);
  });

  it('o link do TikTok com @ no caminho e um site qualquer passam pela regra de link externo', () => {
    expect(linkParaAbrir('https://www.tiktok.com/@usuario_1')).toBe('https://www.tiktok.com/@usuario_1');
    expect(linkParaAbrir('https://consultoria-ficticia.test/sobre')).toBe('https://consultoria-ficticia.test/sobre');
  });
});

describe('formulário das redes da consultoria', () => {
  it('abre com os links gravados, acusa mudança e manda as oito aparadas', () => {
    const salvas = formDasRedes({ instagram: 'https://www.instagram.com/exemplo', tiktok: null, youtube: null, x: null, site: null });
    expect(salvas.instagram).toBe('https://www.instagram.com/exemplo');
    expect(salvas.site).toBe('');
    expect(redesAlteradas(salvas, salvas)).toBe(false);
    const form = { ...salvas, tiktok: ' @exemplo ' };
    expect(redesAlteradas(form, salvas)).toBe(true);
    expect(corpoDasRedes(form)).toEqual({ instagram: 'https://www.instagram.com/exemplo', tiktok: '@exemplo', youtube: '', facebook: '', linkedin: '', telegram: '', x: '', site: '' });
    expect(Object.keys(corpoDasRedes(form))).toEqual([...REDES_DA_CONSULTORIA]);
  });

  it('com os valores da peça (só as adicionadas): a removida vai em branco e conta como mudança', () => {
    const salvas = valoresDasRedesDaConsultoria({ instagram: 'https://www.instagram.com/exemplo', tiktok: null, youtube: ' ', x: null, site: null, telegram: 'https://t.me/exemplo' });
    expect(salvas).toEqual({ instagram: 'https://www.instagram.com/exemplo', telegram: 'https://t.me/exemplo' });
    const semTelegram = { instagram: salvas.instagram };
    expect(redesAlteradas(salvas, salvas)).toBe(false);
    expect(redesAlteradas(semTelegram, salvas)).toBe(true);
    expect(corpoDasRedes(semTelegram).telegram).toBe('');
  });

  it('o erro do 422 vem de redesSociais.<rede> ou de <rede>', () => {
    expect(erroDaRede({ 'redesSociais.x': 'Link inválido.' }, 'x')).toBe('Link inválido.');
    expect(erroDaRede({ site: 'Use https.' }, 'site')).toBe('Use https.');
    expect(erroDaRede({}, 'youtube')).toBeUndefined();
  });
});

describe('usuarioDaRede', () => {
  it.each([
    ['instagram', '@fulano.silva', 'fulano.silva'],
    ['instagram', 'joao.comercial', 'joao.comercial'],
    ['instagram', 'https://www.instagram.com/fulano_1/', 'fulano_1'],
    ['instagram', 'instagram.com/fulano?igsh=abc', 'fulano'],
    ['tiktok', '@fulano', 'fulano'],
    ['tiktok', 'https://www.tiktok.com/@fulano?lang=pt', 'fulano'],
    ['tiktok', 'tiktok.com/@fulano', 'fulano'],
  ] as const)('%s %s → %s', (rede, texto, usuario) => {
    expect(usuarioDaRede(rede, texto)).toBe(usuario);
  });

  it('vazio é null; o que não dá para entender é undefined, com a mensagem', () => {
    expect(usuarioDaRede('instagram', '  ')).toBeNull();
    expect(usuarioDaRede('instagram', 'nome com espaço')).toBeUndefined();
    expect(usuarioDaRede('instagram', 'https://facebook.com/fulano')).toBeUndefined();
    expect(usuarioDaRede('tiktok', 'https://www.tiktok.com/fulano')).toBeUndefined();
    expect(usuarioDaRede('instagram', 'https://instagram.com/')).toBeUndefined();
    expect(erroDoUsuarioDaRede('tiktok', 'a b')).toBe('Use @usuario ou o link do perfil no TikTok.');
    expect(erroDoUsuarioDaRede('tiktok', '')).toBeUndefined();
  });
});

describe('perfil do aluno', () => {
  it('monta o link do Instagram e do TikTok só com usuário no formato', () => {
    expect(linkDoPerfilDoAluno('instagram', 'fulano')).toBe('https://www.instagram.com/fulano');
    expect(linkDoPerfilDoAluno('tiktok', '@fulano')).toBe('https://www.tiktok.com/@fulano');
    expect(linkDoPerfilDoAluno('instagram', 'a/b?x')).toBeNull();
    expect(linkDoPerfilDoAluno('tiktok', null)).toBeNull();
  });

  it('os links e o texto da linha da ficha; sem nenhum, nada', () => {
    expect(redesDoAluno({ instagram: 'fulano', tiktok: 'fulano.tt' })).toEqual({
      links: [{ rede: 'instagram', url: 'https://www.instagram.com/fulano' }, { rede: 'tiktok', url: 'https://www.tiktok.com/@fulano.tt' }],
      texto: '@fulano (Instagram) · @fulano.tt (TikTok)',
    });
    expect(redesDoAluno({ instagram: null })).toEqual({ links: [], texto: null });
  });

  it('as quatro de link entram como vieram (só https), na ordem fixa', () => {
    const { links, texto } = redesDoAluno({
      telegram: 'https://t.me/fulano', youtube: 'https://www.youtube.com/@canal', linkedin: 'https://www.linkedin.com/in/fulano-silva',
      facebook: 'http://facebook.com/inseguro', tiktok: null,
    });
    expect(links.map((l) => l.rede)).toEqual(['youtube', 'linkedin', 'telegram']);
    expect(texto).toBe('@canal (YouTube) · @fulano-silva (LinkedIn) · @fulano (Telegram)');
  });

  it('envio: no cadastro só o preenchido; na edição só o que mudou (em branco apaga)', () => {
    expect(redeParaEnvio(' @x ', undefined, false)).toBe('@x');
    expect(redeParaEnvio('', undefined, false)).toBeUndefined();
    expect(redeParaEnvio('fulano', 'fulano', true)).toBeUndefined();
    expect(redeParaEnvio('', 'fulano', true)).toBe('');
    expect(redeParaEnvio('', undefined, true)).toBeUndefined();
    expect(redeParaEnvio('@outro', 'fulano', true)).toBe('@outro');
  });
});

describe('rotuloCurto', () => {
  it.each([
    ['instagram', 'https://www.instagram.com/fulano', '@fulano'],
    ['tiktok', 'https://www.tiktok.com/@fulano.tt', '@fulano.tt'],
    ['youtube', 'https://www.youtube.com/@canal', '@canal'],
    ['youtube', 'https://www.youtube.com/channel/UC123', 'youtube.com/channel/UC123'],
    ['facebook', 'https://www.facebook.com/fulano', '@fulano'],
    ['facebook', 'https://www.facebook.com/profile.php?id=1', 'facebook.com/profile.php'],
    ['linkedin', 'https://www.linkedin.com/in/fulano/', '@fulano'],
    ['linkedin', 'https://www.linkedin.com/company/consultoria-ficticia', '@consultoria-ficticia'],
    ['telegram', 'https://t.me/fulano', '@fulano'],
    ['x', 'https://x.com/fulano', '@fulano'],
    ['site', 'https://www.consultoria-ficticia.test/sobre/', 'consultoria-ficticia.test/sobre'],
    ['site', 'https://consultoria-ficticia.test', 'consultoria-ficticia.test'],
    ['instagram', 'texto solto', 'texto solto'],
  ] as const)('%s %s → %s', (rede, url, rotulo) => {
    expect(rotuloCurto(rede, url)).toBe(rotulo);
  });
});

describe('edição da peça', () => {
  it('adicionada = chave presente (também vazia); as disponíveis são as que faltam, na ordem', () => {
    const valores = { telegram: '', instagram: '@fulano' };
    expect(redesAdicionadas(valores, REDES_SOCIAIS_DO_ALUNO)).toEqual(['instagram', 'telegram']);
    expect(redesDisponiveisParaAdicionar(valores, REDES_SOCIAIS_DO_ALUNO)).toEqual(['tiktok', 'youtube', 'facebook', 'linkedin']);
    // X e site não são do aluno: nunca aparecem, nem se vierem nos valores.
    expect(redesAdicionadas<RedeDaConsultoria>({ x: 'https://x.com/a' }, REDES_SOCIAIS_DO_ALUNO)).toEqual([]);
    const todas = Object.fromEntries(REDES_DA_CONSULTORIA.map((r) => [r, 'a']));
    expect(redesDisponiveisParaAdicionar(todas, REDES_DA_CONSULTORIA)).toEqual([]);
  });

  it('abre o aluno só com as redes que ele tem, Instagram e TikTok com @', () => {
    expect(valoresDasRedesDoAluno({ instagram: 'fulano', tiktok: ' ', youtube: 'https://www.youtube.com/@canal', telegram: null }))
      .toEqual({ instagram: '@fulano', youtube: 'https://www.youtube.com/@canal' });
  });

  it('envio do aluno: só o que mudou; removida vai em branco (apaga); no cadastro, só o preenchido', () => {
    const iniciais = valoresDasRedesDoAluno({ instagram: 'fulano', youtube: 'https://www.youtube.com/@canal' });
    expect(redesDoAlunoParaEnvio(iniciais, iniciais, true)).toEqual({});
    expect(redesDoAlunoParaEnvio({ instagram: '@fulano', telegram: 't.me/novo' }, iniciais, true)).toEqual({ youtube: '', telegram: 't.me/novo' });
    expect(redesDoAlunoParaEnvio({ facebook: ' fulano ', linkedin: '' }, {}, false)).toEqual({ facebook: 'fulano' });
  });

  it('pré-validação leve: Instagram e TikTok com as regras de sempre; as outras só recusam espaço; vazio não é erro', () => {
    expect(erroDaRedeDigitada('instagram', 'a b')).toBe('Use @usuario ou o link do perfil no Instagram.');
    expect(erroDaRedeDigitada('youtube', 'youtube.com/@canal')).toBeUndefined();
    expect(erroDaRedeDigitada('telegram', '@fulano')).toBeUndefined();
    expect(erroDaRedeDigitada('linkedin', 'fulano silva')).toBe('Use @usuario ou o link do perfil no LinkedIn.');
    expect(erroDaRedeDigitada('site', 'meu site.com')).toBe('Use o link do site, sem espaços.');
    expect(erroDaRedeDigitada('facebook', '   ')).toBeUndefined();
  });
});

describe('corDoGlifo', () => {
  const MARCAS = [...REDES_DA_CONSULTORIA, 'whatsapp'] as MarcaDoBotao[];

  it(`o glifo passa ${CONTRASTE_DO_GLIFO}:1 sobre o fundo escuro, parado e com o mouse em cima`, () => {
    for (const marca of MARCAS) {
      expect(contraste(corDoGlifo(marca), FUNDO_DO_BOTAO_DE_REDE)).toBeGreaterThanOrEqual(CONTRASTE_DO_GLIFO);
      expect(contraste(corDoGlifo(marca), FUNDO_DO_BOTAO_DE_REDE_AO_PASSAR)).toBeGreaterThanOrEqual(CONTRASTE_DO_GLIFO);
    }
  });

  it('a cor da rede fica como é quando já passa; X e site usam o neutro claro', () => {
    expect(corDoGlifo('instagram')).toBe('#E1306C');
    expect(corDoGlifo('whatsapp')).toBe('#25D366');
    expect(COR_DA_REDE.instagram).toBe('#E1306C');
    expect(corDoGlifo('x')).toBe(GLIFO_NEUTRO_DA_REDE);
    expect(corDoGlifo('site')).toBe(GLIFO_NEUTRO_DA_REDE);
  });
});

describe('corDoBrilho', () => {
  it(`fica a pelo menos ${CONTRASTE_DO_BRILHO}:1 da superfície em todas as paletas`, () => {
    for (const { cores } of Object.values(PALETAS)) {
      for (const rede of [...REDES_DA_CONSULTORIA, 'whatsapp'] as MarcaDoBotao[]) {
        expect(contraste(corDoBrilho(rede, cores), cores.superficie)).toBeGreaterThanOrEqual(CONTRASTE_DO_BRILHO);
      }
    }
  });

  it('X e site usam a cor do texto', () => {
    const cores = { superficie: '#FFFFFF', texto: '#18181B' };
    expect(corDoBrilho('x', cores)).toBe('#18181B');
    expect(corDoBrilho('site', cores)).toBe('#18181B');
  });
});
