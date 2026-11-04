import type { ComponentProps } from 'react';

import { kgParaTela, mascaraDaCarga, nomeDaUnidade, telaParaKg, type UnidadeDeCarga } from '../dominio/unidadeDeCarga';
import { CampoNumericoGrande } from './Campos';
import { useUnidadeDeCarga } from './unidadeDeCargaEmUso';

type Props = Omit<ComponentProps<typeof CampoNumericoGrande>, 'valor' | 'aoMudar' | 'sufixo' | 'inteiro' | 'mascara'> & {
  /** A carga guardada, sempre em kg. */
  valorKg: number | null;
  /** Recebe kg: o que a pessoa digitou na unidade dela já convertido (em kg, o mesmo número). */
  aoMudarKg: (kg: number | null) => void;
};

function rotuloDaCarga(rotulo: string, rotuloAcessivel: string | undefined, unidade: UnidadeDeCarga): string {
  // Com rótulo acessível próprio a unidade sempre entrou ("Peso da série 2, em quilos", como antes da libra). Sem ele, o
  // leitor lê o rótulo visível ("Carga de trabalho do dia"), que só ganha a unidade em libra: em kg, e com a chave
  // desligada, fica igual ao de antes.
  if (rotuloAcessivel !== undefined) return `${rotuloAcessivel}, em ${nomeDaUnidade(unidade)}`;
  return unidade === 'lb' ? `${rotulo}, em ${nomeDaUnidade(unidade)}` : rotulo;
}

/**
 * Campo de carga do aluno: mostra e recebe na unidade dele (kg ou lb) e fala kg com o resto do app. O texto do campo é o
 * mesmo número arredondado que a tela mostra (`kgParaTela`), então digitar 100 lb e ler de volta dá 100 sem o campo
 * reescrever o que a pessoa digita. `rotuloAcessivel` leva só o nome ("Peso da série 2"); a unidade por extenso entra aqui.
 */
export function CampoDeCarga({ valorKg, aoMudarKg, rotuloAcessivel, rotulo, ...resto }: Props) {
  const unidade = useUnidadeDeCarga();
  return (
    <CampoNumericoGrande
      {...resto}
      rotulo={rotulo}
      rotuloAcessivel={rotuloDaCarga(rotulo, rotuloAcessivel, unidade)}
      sufixo={unidade}
      mascara={mascaraDaCarga(unidade)}
      valor={kgParaTela(valorKg, unidade)}
      aoMudar={(v) => aoMudarKg(telaParaKg(v, unidade))}
    />
  );
}
