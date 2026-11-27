import { arranjoPrincipalComApoio, larguraDoApoioPorArea } from './arranjoPrincipalComApoio';

/**
 * Arranjo da aba Dieta do aluno pela largura da área dela (`docs/planos/aluno-web-layout.md` seção 5): `lado` = refeições numa
 * coluna e o apoio (total, água, complementos, ações) ao lado, pela regra da `ui/PrincipalComApoio`; senão o desenho do
 * celular, que não muda. O apoio segue as faixas (`larguraDoApoioPorArea`: 380, 420 na larga e 440 na ultralarga).
 */
export function arranjoDaDieta(area: number | null): { lado: boolean; larguraDoApoio: number } {
  const larguraDoApoio = larguraDoApoioPorArea(area);
  return { lado: arranjoPrincipalComApoio(area, true, larguraDoApoio) === 'lado', larguraDoApoio };
}
