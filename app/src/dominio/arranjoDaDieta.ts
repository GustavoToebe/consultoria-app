import { arranjoPrincipalComApoio, larguraDoApoioPorArea } from './arranjoPrincipalComApoio';

/**
 * Arranjo da aba Dieta do aluno pela largura da área dela (`docs/planos/aluno-web-layout.md` seção 5): `lado` = refeições numa
 * coluna e o apoio (total, água, complementos, ações) ao lado, pela regra da `ui/PrincipalComApoio`; senão o desenho do
 * celular, que não muda. No teto (1312) o apoio tem 400 e as refeições fecham em 880; abaixo, o apoio tem 360.
 */
export function arranjoDaDieta(area: number | null): { lado: boolean; larguraDoApoio: number } {
  const larguraDoApoio = larguraDoApoioPorArea(area);
  return { lado: arranjoPrincipalComApoio(area, true, larguraDoApoio) === 'lado', larguraDoApoio };
}
