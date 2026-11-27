import type { ConteudoQuestionario } from '../api/tipos';
import { corpoDaInscricao, INSCRICAO_VAZIA, temSegundaParte } from './inscricoes';
import {
  escolhaEfetiva,
  ID_DA_PERGUNTA_DO_PLANO,
  perguntaDoPlano,
  PLANO_OUTRO,
  planoDoEnvio,
  precoDoPlano,
  respostasComPlano,
  semAPerguntaDoPlano,
  textoDoPeriodo,
} from './planosDaInscricao';

const FICHA: ConteudoQuestionario = {
  instrucoes: [],
  secoes: [{ titulo: 'Plano combinado', perguntas: [{ id: ID_DA_PERGUNTA_DO_PLANO, tipo: 'TEXTO', rotulo: 'Qual plano combinou?', obrigatoria: false }] }],
};
const COMPLETO: ConteudoQuestionario = {
  instrucoes: [],
  secoes: [
    { titulo: 'Rotina', perguntas: [{ id: 'treina', tipo: 'TEXTO', rotulo: 'Já treina?', obrigatoria: true }] },
    ...FICHA.secoes,
  ],
};
const A = { id: 'a' };
const B = { id: 'b' };

describe('planos na inscrição pública', () => {
  it('período por extenso e preço só com a opção ligada e com valor', () => {
    expect(textoDoPeriodo('TRIMESTRAL')).toBe('Trimestral · a cada 3 meses');
    expect(textoDoPeriodo('MENSAL')).toBe('Mensal · todo mês');
    expect(textoDoPeriodo('PARCELA_UNICA')).toMatch(/pagamento único$/);
    expect(precoDoPlano({ valorCentavos: 99700, periodicidade: 'TRIMESTRAL' }, true)).toBe('R$ 997,00 por trimestre');
    expect(precoDoPlano({ valorCentavos: 19900, periodicidade: 'MENSAL' }, true)).toBe('R$ 199,00 por mês');
    expect(precoDoPlano({ valorCentavos: 50000, periodicidade: 'SEMESTRAL' }, true)).toBe('R$ 500,00 por semestre');
    expect(precoDoPlano({ valorCentavos: 120000, periodicidade: 'ANUAL' }, true)).toBe('R$ 1.200,00 por ano');
    expect(precoDoPlano({ valorCentavos: 30000, periodicidade: 'PARCELA_UNICA' }, true)).toBe('R$ 300,00 à vista');
    // Nunca preço sem valor, nem "—", nem com a opção desligada.
    expect(precoDoPlano({ valorCentavos: null, periodicidade: 'MENSAL' }, true)).toBeNull();
    expect(precoDoPlano({ valorCentavos: 19900, periodicidade: 'MENSAL' }, false)).toBeNull();
  });

  it('acha a pergunta do plano e a tira do modelo (seção vazia sai)', () => {
    expect(perguntaDoPlano(FICHA)?.pergunta.rotulo).toBe('Qual plano combinou?');
    expect(perguntaDoPlano(FICHA)?.secao).toBe('Plano combinado');
    expect(perguntaDoPlano(null)).toBeNull();
    expect(semAPerguntaDoPlano(FICHA)).toBeNull();
    expect(semAPerguntaDoPlano(COMPLETO)?.secoes.map((s) => s.titulo)).toEqual(['Rotina']);
  });

  it('um plano só vem marcado; a escolha da pessoa vale enquanto o plano existir', () => {
    expect(escolhaEfetiva(null, [A])).toBe('a');
    expect(escolhaEfetiva(PLANO_OUTRO, [A])).toBe(PLANO_OUTRO);
    expect(escolhaEfetiva(null, [A, B])).toBeNull();
    expect(escolhaEfetiva('b', [A, B])).toBe('b');
    // Depois de recarregar, o plano escolhido saiu: volta ao padrão (um só = marcado; vários = nada).
    expect(escolhaEfetiva('sumiu', [A])).toBe('a');
    expect(escolhaEfetiva('sumiu', [A, B])).toBeNull();
    expect(escolhaEfetiva(PLANO_OUTRO, [])).toBeNull();
  });

  it('com plano escolhido vai o id e não o texto de "Outro"; com "Outro" vai o texto', () => {
    const respostas = { [ID_DA_PERGUNTA_DO_PLANO]: 'Plano do amigo', treina: 'Sim' };
    expect(planoDoEnvio('a')).toBe('a');
    expect(planoDoEnvio(PLANO_OUTRO)).toBeNull();
    expect(planoDoEnvio(null)).toBeNull();
    expect(respostasComPlano(respostas, 'a')).toEqual({ treina: 'Sim' });
    expect(respostasComPlano(respostas, PLANO_OUTRO)).toBe(respostas);
    expect(respostasComPlano(respostas, null)).toBe(respostas);
  });

  it('a Ficha rápida (contato + plano) fica numa parte só', () => {
    expect(temSegundaParte(['EMAIL'], FICHA)).toBe(false);
    expect(temSegundaParte(['EMAIL'], COMPLETO)).toBe(true);
  });

  it('o corpo leva planoComercialId só quando há plano escolhido', () => {
    const ok = { ...INSCRICAO_VAZIA, nome: 'Pessoa Fictícia', whatsapp: '(11) 98765-4321' };
    expect(corpoDaInscricao(ok, false, null, null, null, ['EMAIL'], null, null, 'a').planoComercialId).toBe('a');
    expect('planoComercialId' in corpoDaInscricao(ok, false, null, null, null, ['EMAIL'], null, null, null)).toBe(false);
  });
});
