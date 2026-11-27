import { PALETAS as CORES_DA_MARCA } from '../../dominio/paletas';
import { contraste, marcaParaPeca, PALETAS, textoSobre } from '../../tema/tokens';
import { superficiePintada } from '../../ui/superficiePintada';

// Painel da consultoria (`LayoutDaInscricao`): o texto corrido fica em `texto` sobre a tinta de 14% da marca; a peça da
// marca (passo atual, cartão do plano escolhido) passa 3:1 e o número/✓ por cima dela, 4,5:1. Nas nove paletas × doze marcas.
describe('painel e peças da marca na inscrição pública', () => {
  for (const [codigo, { cores, variante }] of Object.entries(PALETAS)) {
    it.each(CORES_DA_MARCA.map((m) => [m.nome, m.cor]))(`${codigo}: %s`, (_nome, marca) => {
      const p = superficiePintada(marca, cores.superficie, variante, cores);
      expect(contraste(cores.texto, p.forte)).toBeGreaterThanOrEqual(4.5);
      const peca = marcaParaPeca(marca, [cores.superficie, cores.sobre]);
      expect(contraste(peca, cores.superficie)).toBeGreaterThanOrEqual(3);
      expect(contraste(peca, cores.sobre)).toBeGreaterThanOrEqual(3);
      expect(contraste(textoSobre(peca), peca)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
