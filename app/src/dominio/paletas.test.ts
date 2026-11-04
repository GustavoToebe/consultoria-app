import type { Tema } from '../api/tipos';
import { PALETAS as PALETAS_DO_TEMA } from '../tema/tokens';
import { avaliarMarca, avisoDeMarcaPertoDeStatus, paletaDaCor, PALETAS } from './paletas';

const TEMAS = Object.keys(PALETAS_DO_TEMA) as Tema[];

describe('paletas da marca', () => {
  it.each(PALETAS)('$nome nunca bloqueia e passa no Claro e na Areia', (p) => {
    for (const tema of TEMAS) expect(avaliarMarca(p.cor, tema).bloqueia).toBeNull();
    expect(avaliarMarca(p.cor, 'CLARO')).toEqual({ bloqueia: null, aviso: null });
    expect(avaliarMarca(p.cor, 'AREIA')).toEqual({ bloqueia: null, aviso: null });
  });

  it('ids e cores não se repetem e todas são #RRGGBB', () => {
    expect(new Set(PALETAS.map((p) => p.id)).size).toBe(PALETAS.length);
    expect(new Set(PALETAS.map((p) => p.cor)).size).toBe(PALETAS.length);
    for (const p of PALETAS) expect(p.cor).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('acha a paleta pela cor, sem diferenciar maiúsculas', () => {
    expect(paletaDaCor('#2563eb')?.id).toBe('azul');
    expect(paletaDaCor('#123456')).toBeUndefined();
  });

  it('amarelo vivo não segura texto branco: bloqueia o salvar e avisa no tema claro', () => {
    const r = avaliarMarca('#FFFF00', 'ESCURO');
    expect(r.bloqueia).toBe('Esta cor deixa o texto dos botões difícil de ler.');
    expect(r.aviso).toMatch(/tema claro/);
  });

  it('cor escura demais some no tema escuro: só avisa', () => {
    const r = avaliarMarca('#1F2937', 'CLARO');
    expect(r.bloqueia).toBeNull();
    expect(r.aviso).toBe('No tema escuro, ícones e o menu ativo ficam apagados.');
  });

  it('tema desconhecido (marca de uma API mais nova) mede contra o Escuro, sem estourar', () => {
    expect(() => avaliarMarca('#386CB8', 'FUTURA' as Tema)).not.toThrow();
    expect(avaliarMarca('#386CB8', 'FUTURA' as Tema).bloqueia).toBeNull();
    expect(avaliarMarca('#FFFF00', 'FUTURA' as Tema).bloqueia).not.toBeNull();
  });

  describe('mede contra a paleta escolhida (decisão 4)', () => {
    it('a mesma cor passa no Escuro e some no cartão do Oceano; trocar de paleta reavalia', () => {
      expect(avaliarMarca('#386CB8', 'ESCURO').aviso).toBeNull();
      expect(avaliarMarca('#386CB8', 'CLARO').aviso).toBeNull();
      expect(avaliarMarca('#386CB8', 'OCEANO').aviso).toBe('Na paleta Oceano, ícones e o menu ativo ficam apagados.');
    });

    it('junta a paleta escolhida com o tema neutro onde a cor também some', () => {
      expect(avaliarMarca('#1F2937', 'AMEIXA').aviso).toBe('Na paleta Ameixa e no tema escuro, ícones e o menu ativo ficam apagados.');
    });

    it('a paleta Escuro conta o cartão: Índigo e Magenta avisam, Azul não', () => {
      expect(avaliarMarca('#4F46E5', 'ESCURO').aviso).toBe('Na paleta Escuro, ícones e o menu ativo ficam apagados.');
      expect(avaliarMarca('#BE185D', 'ESCURO').aviso).not.toBeNull();
      expect(avaliarMarca('#2563EB', 'ESCURO').aviso).toBeNull();
    });

    it('nas claras nenhuma das Cores prontas avisa; nas escuras, as que somem são estas', () => {
      for (const tema of TEMAS.filter((t) => PALETAS_DO_TEMA[t].modo === 'CLARO')) {
        expect(PALETAS.filter((p) => avaliarMarca(p.cor, tema).aviso)).toEqual([]);
      }
      expect(PALETAS.filter((p) => avaliarMarca(p.cor, 'OCEANO').aviso).map((p) => p.id)).toEqual(
        ['vermelho', 'esmeralda', 'turquesa', 'ciano', 'indigo', 'roxo', 'magenta', 'bronze'],
      );
    });
  });

  it('cor inválida ou incompleta não avalia nada', () => {
    expect(avaliarMarca('#12', 'ESCURO')).toEqual({ bloqueia: null, aviso: null });
    expect(avisoDeMarcaPertoDeStatus('#12')).toBeNull();
  });

  describe('marca parecida com uma cor de status (D10)', () => {
    it('o vermelho intenso lembra o erro; verde e âmbar não avisam', () => {
      expect(avisoDeMarcaPertoDeStatus('#C62828')).toMatch(/erro \(vermelho\)/);
      expect(avisoDeMarcaPertoDeStatus('#15803D')).toBeNull();
      expect(avisoDeMarcaPertoDeStatus('#A16207')).toBeNull();
      expect(avisoDeMarcaPertoDeStatus('#c62828')).not.toBeNull();
    });

    it('azul e roxo ficam longe de todas: sem aviso', () => {
      expect(avisoDeMarcaPertoDeStatus('#2563EB')).toBeNull();
      expect(avisoDeMarcaPertoDeStatus('#7C3AED')).toBeNull();
    });

    it('das doze Cores prontas só o Vermelho intenso e o Laranja avisam', () => {
      const avisam = PALETAS.filter((p) => avisoDeMarcaPertoDeStatus(p.cor)).map((p) => p.id);
      expect(avisam).toEqual(['vermelho', 'laranja']);
    });

    it('só avisa: a avaliação que bloqueia o Salvar não muda', () => {
      expect(avaliarMarca('#C62828', 'CLARO')).toEqual({ bloqueia: null, aviso: null });
    });
  });
});
