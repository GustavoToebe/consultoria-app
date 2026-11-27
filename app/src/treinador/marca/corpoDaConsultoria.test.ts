import type { ConsultoriaResponse } from '../../api/tipos';
import { corpoDaConsultoria, textosDasFases } from './corpoDaConsultoria';

/** O corpo do PUT com os valores gravados: cada tela (Marca, Contato, Padrões) só sobrepõe os seus. Dados fictícios. */
const MARCA = { id: 'c1', nome: 'Consultoria Fictícia', corPrimaria: '#2563EB', fonteTitulo: 'PADRAO', temaPadrao: 'OCEANO', logoUrl: null } as ConsultoriaResponse['marca'];

describe('corpoDaConsultoria', () => {
  it('leva a marca, a versão lida, o acompanhamento e o contato gravados; as redes ficam de fora (ausente mantém)', () => {
    const c: ConsultoriaResponse = {
      marca: MARCA, versao: 7, diasAtualizacaoPadrao: 30, metaDoPeso: 'AUMENTAR',
      textosFasesCiclo: { menstrual: ' Descanse. ', folicular: '', ovulatoria: null, lutea: 'Foco.' },
      whatsapp: '(45) 99999-8888', emailRemetenteNome: 'Equipe Fictícia', emailResponderPara: 'contato@exemplo.test',
      redesSociais: { instagram: 'https://www.instagram.com/ficticia', tiktok: null, youtube: null, x: null, site: null },
    };
    expect(corpoDaConsultoria(c)).toEqual({
      nome: 'Consultoria Fictícia', corPrimaria: '#2563EB', fonteTitulo: 'PADRAO', temaPadrao: 'OCEANO', versao: 7,
      diasAtualizacaoPadrao: 30, metaDoPeso: 'AUMENTAR',
      textosFasesCiclo: { menstrual: 'Descanse.', folicular: null, ovulatoria: null, lutea: 'Foco.' },
      whatsapp: '(45) 99999-8888', emailRemetenteNome: 'Equipe Fictícia', emailResponderPara: 'contato@exemplo.test',
    });
  });

  it('sem contato, prazo nem textos: vazios e nulos (nada inventado); sem meta devolvida, a meta não vai', () => {
    const corpo = corpoDaConsultoria({ marca: MARCA, versao: 1, diasAtualizacaoPadrao: null } as unknown as ConsultoriaResponse);
    expect(corpo).toMatchObject({ diasAtualizacaoPadrao: null, whatsapp: '', emailRemetenteNome: '', emailResponderPara: '' });
    expect(corpo.textosFasesCiclo).toEqual({ menstrual: null, folicular: null, ovulatoria: null, lutea: null });
    expect('metaDoPeso' in corpo).toBe(false);
    expect('redesSociais' in corpo).toBe(false);
  });

  it('textosDasFases apara e troca vazio por nulo', () => {
    expect(textosDasFases({ menstrual: '  ', folicular: 'a ', ovulatoria: undefined, lutea: null })).toEqual({ menstrual: null, folicular: 'a', ovulatoria: null, lutea: null });
    expect(textosDasFases(null)).toEqual({ menstrual: null, folicular: null, ovulatoria: null, lutea: null });
  });
});
