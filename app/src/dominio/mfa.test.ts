import { caminhoDoQr, codigoPreenchido, codigosParaCopiar, normalizarCodigo, pedeCodigoMfa, segredoEmBlocos } from './mfa';

describe('verificação em duas etapas', () => {
  it('só o erro MFA_NECESSARIO pede o código na tela de entrar', () => {
    expect(pedeCodigoMfa({ codigo: 'MFA_NECESSARIO', status: 401 })).toBe(true);
    expect(pedeCodigoMfa({ codigo: 'MFA_CODIGO_INVALIDO' })).toBe(false);
    expect(pedeCodigoMfa({ codigo: 'CREDENCIAIS_INVALIDAS' })).toBe(false);
    expect(pedeCodigoMfa(new Error('x'))).toBe(false);
    expect(pedeCodigoMfa(null)).toBe(false);
    expect(pedeCodigoMfa('MFA_NECESSARIO')).toBe(false);
  });

  it('o código digitado perde espaços e hífens; o de recuperação vai em minúsculas', () => {
    expect(normalizarCodigo(' 123 456 ')).toBe('123456');
    expect(normalizarCodigo('123-456')).toBe('123456');
    expect(normalizarCodigo('0123456789ABCDEF 0123456789abcdef')).toBe('0123456789abcdef0123456789abcdef');
    expect(normalizarCodigo('abc')).toBe('abc');
  });

  it('habilita o botão só com 6 dígitos ou um código de recuperação inteiro', () => {
    expect(codigoPreenchido('123 456')).toBe(true);
    expect(codigoPreenchido('12345')).toBe(false);
    expect(codigoPreenchido('1234567')).toBe(false);
    expect(codigoPreenchido('0123456789abcdef0123456789abcdef')).toBe(true);
    expect(codigoPreenchido('0123456789abcdef0123456789abcde')).toBe(false);
    expect(codigoPreenchido('')).toBe(false);
  });

  it('mostra o segredo em blocos de 4 letras, sem espaço sobrando no fim', () => {
    expect(segredoEmBlocos('ABCDEFGHIJKLMNOP')).toBe('ABCD EFGH IJKL MNOP');
    expect(segredoEmBlocos('ABCDEFGHIJ')).toBe('ABCD EFGH IJ');
    expect(segredoEmBlocos('ABCD EFGH')).toBe('ABCD EFGH');
  });

  it('copia os códigos de recuperação um por linha', () => {
    expect(codigosParaCopiar(['a', 'b', 'c'])).toBe('a\nb\nc');
  });
});

describe('desenho do QR code', () => {
  it('junta módulos vizinhos da mesma linha e soma a margem', () => {
    // 3x3: linha 0 = ## . ; linha 1 = . . # ; linha 2 = # # #
    const modulos = Uint8Array.from([1, 1, 0, 0, 0, 1, 1, 1, 1]);
    const { caminho, lado } = caminhoDoQr(modulos, 1);
    expect(lado).toBe(5);
    expect(caminho).toBe('M1 1h2v1h-2zM3 2h1v1h-1zM1 3h3v1h-3z');
  });

  it('matriz sem lado inteiro é recusada', () => {
    expect(() => caminhoDoQr(Uint8Array.from([1, 0, 1]))).toThrow();
  });

  it('usa a margem de 4 módulos por padrão', () => {
    expect(caminhoDoQr(Uint8Array.from([1])).lado).toBe(9);
  });
});
