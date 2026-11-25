import { PALETAS, contraste } from '../tema/tokens';
import { linkParaAbrir } from './links';
import {
  CONTRASTE_DO_BRILHO, corDoBrilho, corpoDasRedes, erroDaRede, erroDoUsuarioDaRede, formDasRedes, linkDoPerfilDoAluno, REDES_DA_CONSULTORIA,
  redeParaEnvio, redesAlteradas, redesDoAluno, redesPreenchidas, usuarioDaRede,
} from './redesSociais';

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
  it('abre com os links gravados, acusa mudança e manda as cinco aparadas', () => {
    const salvas = formDasRedes({ instagram: 'https://www.instagram.com/exemplo', tiktok: null, youtube: null, x: null, site: null });
    expect(salvas.instagram).toBe('https://www.instagram.com/exemplo');
    expect(salvas.site).toBe('');
    expect(redesAlteradas(salvas, salvas)).toBe(false);
    const form = { ...salvas, tiktok: ' @exemplo ' };
    expect(redesAlteradas(form, salvas)).toBe(true);
    expect(corpoDasRedes(form)).toEqual({ instagram: 'https://www.instagram.com/exemplo', tiktok: '@exemplo', youtube: '', x: '', site: '' });
    expect(Object.keys(corpoDasRedes(form))).toEqual([...REDES_DA_CONSULTORIA]);
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

  it('envio: no cadastro só o preenchido; na edição só o que mudou (em branco apaga)', () => {
    expect(redeParaEnvio(' @x ', undefined, false)).toBe('@x');
    expect(redeParaEnvio('', undefined, false)).toBeUndefined();
    expect(redeParaEnvio('fulano', 'fulano', true)).toBeUndefined();
    expect(redeParaEnvio('', 'fulano', true)).toBe('');
    expect(redeParaEnvio('', undefined, true)).toBeUndefined();
    expect(redeParaEnvio('@outro', 'fulano', true)).toBe('@outro');
  });
});

describe('corDoBrilho', () => {
  it(`fica a pelo menos ${CONTRASTE_DO_BRILHO}:1 da superfície em todas as paletas`, () => {
    for (const { cores } of Object.values(PALETAS)) {
      for (const rede of REDES_DA_CONSULTORIA) {
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
