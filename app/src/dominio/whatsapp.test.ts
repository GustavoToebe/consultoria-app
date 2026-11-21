import { ErroApi } from '@plataforma/web';

import {
  ehWhatsAppIndisponivel,
  ROTULOS_TIPO_AVISO,
  seloDaSituacaoModelo,
  validarConexaoWhatsApp,
  validarModeloWhatsApp,
} from './whatsapp';

describe('whatsapp dominio', () => {
  it('traduz situações do modelo para selos legíveis', () => {
    expect(seloDaSituacaoModelo(null, false)).toEqual({ texto: 'Não configurado', tipo: 'neutro' });
    expect(seloDaSituacaoModelo('APPROVED', true)).toEqual({ texto: 'Aprovado', tipo: 'sucesso' });
    expect(seloDaSituacaoModelo('PENDING', true)).toEqual({ texto: 'Em análise', tipo: 'atencao' });
    expect(seloDaSituacaoModelo('REJECTED', true)).toEqual({ texto: 'Recusado na Meta', tipo: 'perigo' });
    expect(seloDaSituacaoModelo('NAO_ENCONTRADO', true)).toEqual({ texto: 'Não encontrado na Meta', tipo: 'perigo' });
    expect(seloDaSituacaoModelo('INDISPONIVEL', true)).toEqual({ texto: 'Não conferido', tipo: 'neutro' });
  });

  it('exige token na criação da conexão e permite omitir na atualização', () => {
    const naCriacao = validarConexaoWhatsApp({
      phoneNumberId: '',
      wabaId: '',
      accessToken: '',
      configurada: false,
    });
    expect(naCriacao.phoneNumberId).toBeTruthy();
    expect(naCriacao.wabaId).toBeTruthy();
    expect(naCriacao.accessToken).toBeTruthy();

    const naAtualizacao = validarConexaoWhatsApp({
      phoneNumberId: '123456',
      wabaId: '654321',
      accessToken: '',
      configurada: true,
    });
    expect(naAtualizacao).toEqual({});
  });

  it('valida nome e idioma do modelo', () => {
    expect(validarModeloWhatsApp({ nome: '', idioma: '' })).toEqual({
      nome: expect.any(String),
      idioma: expect.any(String),
    });
    expect(validarModeloWhatsApp({ nome: 'lembrete_vencimento', idioma: 'pt_BR' })).toEqual({});
  });

  it('detecta erro WHATSAPP_INDISPONIVEL', () => {
    expect(ehWhatsAppIndisponivel(new ErroApi(503, 'WHATSAPP_INDISPONIVEL', 'Indisponível.'))).toBe(true);
    expect(ehWhatsAppIndisponivel(new ErroApi(503, 'OUTRO', 'Outro.'))).toBe(false);
    expect(Object.keys(ROTULOS_TIPO_AVISO)).toHaveLength(6);
  });
});
