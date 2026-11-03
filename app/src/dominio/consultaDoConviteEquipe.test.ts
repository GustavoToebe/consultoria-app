import { ErroApi } from '@plataforma/web';

import { AVISO_CONSULTA_DO_CONVITE, consultaDoConviteFalhou } from './consultaDoConviteEquipe';

describe('consultaDoConviteFalhou', () => {
  it('rede, servidor, tempo esgotado e limite avisam', () => {
    expect(consultaDoConviteFalhou(new ErroApi(0, 'SEM_CONEXAO', 'Sem conexão.'))).toBe(true);
    expect(consultaDoConviteFalhou(new ErroApi(500, 'ERRO_INTERNO', 'Erro.'))).toBe(true);
    expect(consultaDoConviteFalhou(new ErroApi(503, 'INDISPONIVEL', 'Fora.'))).toBe(true);
    expect(consultaDoConviteFalhou(new ErroApi(408, 'TEMPO', 'Tempo.'))).toBe(true);
    expect(consultaDoConviteFalhou(new ErroApi(429, 'LIMITE', 'Limite.'))).toBe(true);
    expect(consultaDoConviteFalhou(new TypeError('Failed to fetch'))).toBe(true);
  });
  it('convite inválido, vencido ou já aceito (404) e outras recusas não avisam', () => {
    expect(consultaDoConviteFalhou(new ErroApi(404, 'NAO_ENCONTRADO', 'Convite inválido.'))).toBe(false);
    expect(consultaDoConviteFalhou(new ErroApi(400, 'REQUISICAO_INVALIDA', 'Inválido.'))).toBe(false);
  });
  it('o texto do aviso diz que ainda dá para aceitar', () => {
    expect(AVISO_CONSULTA_DO_CONVITE).toBe('Não deu para carregar os dados da consultoria agora. Você ainda pode aceitar o convite.');
  });
});
