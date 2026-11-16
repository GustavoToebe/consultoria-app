import { linkParaFalarComOTreinador, problemasDoContato } from './contatoDaConsultoria';

const vazio = { whatsapp: '', emailRemetenteNome: '', emailResponderPara: '' };

describe('problemasDoContato', () => {
  it('os três campos são opcionais', () => {
    expect(problemasDoContato(vazio)).toEqual({});
    expect(problemasDoContato({ whatsapp: '  ', emailRemetenteNome: ' ', emailResponderPara: ' ' })).toEqual({});
  });

  it('aceita contato bem preenchido', () => {
    expect(
      problemasDoContato({ whatsapp: '(45) 99999-8888', emailRemetenteNome: 'Equipe Exemplo', emailResponderPara: 'contato@exemplo.com.br' }),
    ).toEqual({});
  });

  it('acusa cada campo pela chave da API, sem repetir o valor', () => {
    const erros = problemasDoContato({ whatsapp: '123', emailRemetenteNome: 'Equipe <Exemplo>', emailResponderPara: 'sem-arroba' });
    expect(Object.keys(erros).sort()).toEqual(['emailRemetenteNome', 'emailResponderPara', 'whatsapp']);
    expect(Object.values(erros).join(' ')).not.toMatch(/123|Exemplo>|sem-arroba/);
  });

  it('nome do remetente: até 60 caracteres, sem aspas nem quebra de linha', () => {
    const com = (emailRemetenteNome: string) => problemasDoContato({ ...vazio, emailRemetenteNome });
    expect(com('a'.repeat(60))).toEqual({});
    expect(com('a'.repeat(61)).emailRemetenteNome).toBeTruthy();
    expect(com('Equipe "Exemplo"').emailRemetenteNome).toBeTruthy();
    expect(com('Equipe\nExemplo').emailRemetenteNome).toBeTruthy();
    expect(com(`Equipe${String.fromCharCode(0x2028)}Exemplo`).emailRemetenteNome).toBeTruthy();
  });

  it('nome do remetente: recusa barra invertida e formatação do Unicode (bidi, largura zero, BOM), como a biblioteca', () => {
    const com = (emailRemetenteNome: string) => problemasDoContato({ ...vazio, emailRemetenteNome });
    expect(com('Equipe\\Exemplo').emailRemetenteNome).toBeTruthy();
    // Montados por código: o Error Prone, do lado Java, recusa bidi escapado no fonte; aqui o mesmo cuidado, sem caractere cru.
    for (const ponto of [0x202e, 0x2066, 0x200b, 0x200f, 0xfeff]) {
      expect(com(`Equipe${String.fromCodePoint(ponto)}Exemplo`).emailRemetenteNome).toBeTruthy();
    }
    expect(com('Academia São José, Treino: A@B (1)')).toEqual({});
  });
});

describe('linkParaFalarComOTreinador', () => {
  it('monta o wa.me com o 55, sem texto', () => {
    expect(linkParaFalarComOTreinador('45999998888')).toBe('https://wa.me/5545999998888');
    expect(linkParaFalarComOTreinador('4533334444')).toBe('https://wa.me/554533334444');
  });

  it('sem número válido não há link', () => {
    expect(linkParaFalarComOTreinador(null)).toBeNull();
    expect(linkParaFalarComOTreinador(undefined)).toBeNull();
    expect(linkParaFalarComOTreinador('')).toBeNull();
    expect(linkParaFalarComOTreinador('123')).toBeNull();
  });
});
