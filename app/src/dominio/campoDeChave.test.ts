import { chaveDoAvisoDaChave, chaveParaEnviar, mostrarAvisoDaChave, mudancaAceita, origemDoBeforeInput, origemDoEvento } from './campoDeChave';

describe('campoDeChave', () => {
  it('digitar, colar, soltar, IME, apagar e desfazer contam como da pessoa', () => {
    for (const t of ['insertText', 'insertFromPaste', 'insertFromDrop', 'insertCompositionText', 'deleteContentBackward', 'deleteByCut', 'historyUndo']) {
      expect(origemDoBeforeInput(t)).toBe('pessoa');
    }
  });

  it('a troca feita pelo navegador e o evento sem tipo não contam', () => {
    expect(origemDoBeforeInput('insertReplacementText')).toBe('desconhecida');
    expect(origemDoBeforeInput('')).toBe('desconhecida');
    expect(origemDoBeforeInput(undefined)).toBe('desconhecida');
    expect(origemDoBeforeInput('formatBold')).toBe('desconhecida');
  });

  it('colar e o fim da composição marcam; o input sozinho (preenchimento automático) e o keydown não', () => {
    expect(origemDoEvento({ type: 'paste' })).toBe('pessoa');
    expect(origemDoEvento({ type: 'compositionend' })).toBe('pessoa');
    expect(origemDoEvento({ type: 'beforeinput', inputType: 'insertText' })).toBe('pessoa');
    expect(origemDoEvento({ type: 'input' })).toBe('desconhecida');
    expect(origemDoEvento({ type: 'change' })).toBe('desconhecida');
    expect(origemDoEvento({ type: 'keydown' })).toBe('desconhecida');
  });

  it('a mudança só vale com o sinal da pessoa pendente', () => {
    expect(mudancaAceita('pessoa')).toBe(true);
    expect(mudancaAceita('desconhecida')).toBe(false);
    expect(mudancaAceita(null)).toBe(false);
  });

  it('o corpo leva só o que foi digitado, sem os espaços das pontas; vazio não vai', () => {
    expect(chaveParaEnviar('  chave-ficticia-123  ')).toBe('chave-ficticia-123');
    expect(chaveParaEnviar('   ')).toBeNull();
    expect(chaveParaEnviar('')).toBeNull();
  });

  it('o aviso da chave: só com chave gravada, permissão e a leitura do aparelho feita', () => {
    expect(chaveDoAvisoDaChave('u1', 'infinitepay')).toBe('treinos:u1:recebimento:chave-conferida:infinitepay');
    expect(mostrarAvisoDaChave(true, true, false)).toBe(true);
    expect(mostrarAvisoDaChave(true, true, null)).toBe(false);
    expect(mostrarAvisoDaChave(true, true, true)).toBe(false);
    expect(mostrarAvisoDaChave(false, true, false)).toBe(false);
    expect(mostrarAvisoDaChave(true, false, false)).toBe(false);
  });
});
