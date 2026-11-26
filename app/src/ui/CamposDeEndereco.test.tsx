/* eslint-disable @typescript-eslint/no-require-imports */
import { useState } from 'react';

import { ENDERECO_VAZIO, type EnderecoNoForm } from '../dominio/cadastroDoAluno';
import { CamposDeEndereco } from './CamposDeEndereco';

jest.mock('../api/rotas', () => ({ buscarCep: jest.fn() }));
jest.mock('./Texto', () => ({ Texto: () => null }));
jest.mock('./EscolhaEmFolha', () => ({ EscolhaEmFolha: () => null }));
// O campo de verdade fica no e2e; aqui basta saber quem chama `aoMudar` e `onBlur` com o quê.
jest.mock('./Campo', () => ({
  MensagemDeErro: () => null,
  Campo: (p: { rotulo: string; valor: string }) => require('react').createElement(require('react-native').View, { testID: p.rotulo, ...p }),
}));

const { buscarCep } = require('../api/rotas') as { buscarCep: jest.Mock };
const Renderer = require('react-test-renderer') as typeof import('react-test-renderer');

interface CampoMock { aoMudar: (t: string) => void; onBlur?: () => void; valor: string }
let ultimo: EnderecoNoForm;

function Pai({ inicial }: { inicial: EnderecoNoForm }) {
  const [valor, setValor] = useState(inicial);
  return <CamposDeEndereco valor={valor} aoMudar={(v) => { ultimo = v; setValor(v); }} />;
}

async function montar(inicial: EnderecoNoForm = ENDERECO_VAZIO) {
  let raiz!: import('react-test-renderer').ReactTestRenderer;
  await Renderer.act(async () => { raiz = Renderer.create(<Pai inicial={inicial} />); });
  const campo = (rotulo: string) => raiz.root.findByProps({ testID: rotulo }).props as CampoMock;
  return { campo, agir: (fn: () => void) => Renderer.act(async () => { fn(); await Promise.resolve(); }) };
}

beforeEach(() => buscarCep.mockReset());

describe('CamposDeEndereco', () => {
  it('várias mudanças no mesmo ciclo (autofill) partem do valor mais recente: nenhuma se perde', async () => {
    buscarCep.mockReturnValue(new Promise(() => undefined));
    const { campo, agir } = await montar();
    await agir(() => {
      // Sem renderizar entre as chamadas, como o Chrome faz: cada uma vê o `valor` do render anterior.
      campo('Complemento (opcional)').aoMudar('Casa ponto de referência');
      campo('Cidade *').aoMudar('Cidade Exemplo');
      campo('Bairro (opcional)').aoMudar('Bairro Exemplo');
      campo('Rua, avenida… *').aoMudar('Rua Exemplo');
      campo('CEP *').aoMudar('01310100');
    });
    expect(ultimo).toEqual({ ...ENDERECO_VAZIO, cep: '01310-100', logradouro: 'Rua Exemplo', complemento: 'Casa ponto de referência', bairro: 'Bairro Exemplo', cidade: 'Cidade Exemplo' });
  });

  it('o resultado da busca de CEP não apaga o que foi preenchido depois', async () => {
    let resolver!: (v: { logradouro: string; bairro: string; cidade: string; uf: string }) => void;
    buscarCep.mockReturnValue(new Promise((r) => { resolver = r; }));
    const { campo, agir } = await montar();
    await agir(() => campo('CEP *').aoMudar('01310100'));
    await agir(() => { campo('Complemento (opcional)').aoMudar('Sala 2'); campo('Número *').aoMudar('88'); });
    await agir(() => resolver({ logradouro: 'Rua Exemplo', bairro: 'Bairro Exemplo', cidade: 'Cidade Exemplo', uf: 'PR' }));
    expect(ultimo).toEqual({ cep: '01310-100', logradouro: 'Rua Exemplo', numero: '88', complemento: 'Sala 2', bairro: 'Bairro Exemplo', cidade: 'Cidade Exemplo', uf: 'PR' });
  });

  it('rua com número que chega de uma vez (autofill, colar) separa o número, se o campo Número está vazio', async () => {
    const { campo, agir } = await montar();
    await agir(() => campo('Rua, avenida… *').aoMudar('Rua Exemplo, 3420'));
    expect(ultimo).toMatchObject({ logradouro: 'Rua Exemplo', numero: '3420' });
  });

  it('rua com número que chega de uma vez não troca o número já digitado', async () => {
    const { campo, agir } = await montar({ ...ENDERECO_VAZIO, numero: '88' });
    await agir(() => campo('Rua, avenida… *').aoMudar('Rua Exemplo, 3420'));
    expect(ultimo).toMatchObject({ logradouro: 'Rua Exemplo, 3420', numero: '88' });
  });

  it('digitando a rua tecla a tecla o texto não muda; ao sair do campo o número é separado', async () => {
    const { campo, agir } = await montar();
    for (const texto of ['R', 'Ru', 'Rua', 'Rua ', 'Rua E', 'Rua Ex', 'Rua Exemplo', 'Rua Exemplo,', 'Rua Exemplo, ', 'Rua Exemplo, 1', 'Rua Exemplo, 12']) {
      await agir(() => campo('Rua, avenida… *').aoMudar(texto));
      expect(ultimo.logradouro).toBe(texto);
      expect(ultimo.numero).toBe('');
    }
    await agir(() => campo('Rua, avenida… *').onBlur?.());
    expect(ultimo).toMatchObject({ logradouro: 'Rua Exemplo', numero: '12' });
  });

  it('"Avenida 9 de Julho" não é separada', async () => {
    const { campo, agir } = await montar();
    await agir(() => campo('Rua, avenida… *').aoMudar('Avenida 9 de Julho'));
    await agir(() => campo('Rua, avenida… *').onBlur?.());
    expect(ultimo).toMatchObject({ logradouro: 'Avenida 9 de Julho', numero: '' });
  });
});
