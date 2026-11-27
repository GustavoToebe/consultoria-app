import type { PerguntaAtualizacao, RespostaAtualizacao } from '../api/tipos';
import {
  alternarItem, comNomesDaLista, ERRO_DIAS_MUDARAM, erroDoEnvioNoCampo, filtrarItens, foraDaLista, mudarMotivo, noLimite,
  rotuloDoCampoDoMotivo, textoDaContagem, textoDaListaVazia,
} from './campoItensDoPlano';
import { conferirItens, respostaDeItens } from './respostasAtualizacao';

const pergunta = (extra: Partial<PerguntaAtualizacao> = {}): PerguntaAtualizacao =>
  ({ id: 'q', tipo: 'ITENS_DO_PLANO', rotulo: 'Quais?', obrigatoria: false, fonte: 'EXERCICIOS_DO_TREINO', max: 2, motivo: 'OPCIONAL', ...extra });
const LISTA = [{ id: 'a', nome: 'Supino reto' }, { id: 'b', nome: 'Remada baixa' }, { id: 'c', nome: 'Agachamento' }];

describe('alternarItem', () => {
  it('marca, desmarca e volta a null quando fica vazio', () => {
    const p = pergunta();
    const um = alternarItem(p, null, 'a');
    expect(um).toEqual([{ id: 'a' }]);
    expect(alternarItem(p, um, 'a')).toBeNull();
  });
  it('no limite não marca mais e a contagem diz', () => {
    const p = pergunta();
    const dois = alternarItem(p, alternarItem(p, null, 'a'), 'b');
    expect(alternarItem(p, dois, 'c')).toBe(dois);
    expect(noLimite(p, dois)).toBe(true);
    expect(textoDaContagem(p, dois)).toBe('2 de 2 escolhidos');
  });
  it('escolha única troca o marcado e não tem contagem nem limite', () => {
    const p = pergunta({ max: 1 });
    expect(alternarItem(p, alternarItem(p, null, 'a'), 'b')).toEqual([{ id: 'b' }]);
    expect(alternarItem(p, mudarMotivo(alternarItem(p, null, 'a'), 'a', 'pernas'), 'b')).toEqual([{ id: 'b', motivo: 'pernas' }]);
    expect(noLimite(p, [{ id: 'a' }] as unknown as RespostaAtualizacao)).toBe(false);
    expect(textoDaContagem(p, null)).toBeNull();
  });
});

it('o motivo fica no item e a resposta passa na conferência (só id e motivo, sem nome)', () => {
  const p = pergunta({ motivo: 'OBRIGATORIO' });
  const valor = mudarMotivo(alternarItem(p, null, 'a'), 'a', '  dor no ombro ');
  expect(valor).toEqual([{ id: 'a', motivo: '  dor no ombro ' }]);
  expect(conferirItens(p, valor, { EXERCICIOS_DO_TREINO: LISTA })).toEqual({ limpa: [{ id: 'a', nome: 'Supino reto', motivo: 'dor no ombro' }] });
});

it('marcado que saiu da lista aparece para remover', () => {
  expect(foraDaLista(respostaDeItens([{ id: 'a' }, { id: '3' }]), LISTA)).toEqual([{ id: '3' }]);
});

it('busca sem acento e sem caixa', () => {
  expect(filtrarItens([{ id: 'x', nome: 'Feijão preto' }, { id: 'y', nome: 'Arroz' }], 'FEIJAO')).toEqual([{ id: 'x', nome: 'Feijão preto' }]);
  expect(filtrarItens(LISTA, '  ')).toBe(LISTA);
});

it('rótulo do motivo, texto da lista vazia e nomes para a leitura', () => {
  expect(rotuloDoCampoDoMotivo({ motivo: 'OPCIONAL', rotuloMotivo: 'Onde e como doeu?' })).toBe('Onde e como doeu? (opcional)');
  expect(rotuloDoCampoDoMotivo({ motivo: 'OBRIGATORIO' })).toBe('Motivo *');
  expect(textoDaListaVazia('ALIMENTOS_DA_DIETA')).toMatch(/^Sua dieta não tem alimentos/);
  expect(textoDaListaVazia(undefined)).toMatch(/mal configurada/);
  expect(comNomesDaLista(respostaDeItens([{ id: 'b', motivo: 'x' }]), LISTA)).toEqual([{ id: 'b', motivo: 'x', nome: 'Remada baixa' }]);
});

it('o 422 de dia que o servidor não reconhece vira a explicação; o resto fica', () => {
  const dias = pergunta({ fonte: 'DIAS_TREINADOS' });
  expect(erroDoEnvioNoCampo(dias, 'Item que não está na lista.')).toBe(ERRO_DIAS_MUDARAM);
  expect(erroDoEnvioNoCampo(pergunta(), 'Item que não está na lista.')).toBe('Item que não está na lista.');
  expect(erroDoEnvioNoCampo(dias, 'Informe o motivo de cada item.')).toBe('Informe o motivo de cada item.');
  expect(erroDoEnvioNoCampo(undefined, 'Preencha.')).toBe('Preencha.');
});
