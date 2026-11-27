import { Fragment, useState, type ReactNode } from 'react';

import { consultoria } from '../../../api/rotas';
import type { ConsultoriaResponse } from '../../../api/tipos';
import { Cabecalho } from '../../../ui/Cabecalho';
import { Esqueleto } from '../../../ui/Esqueleto';
import { MensagemErro } from '../../../ui/Estados';
import { textoDoErro } from '../../../ui/erros';
import { Tela } from '../../../ui/Tela';
import { useCarregar } from '../../../ui/useCarregar';

export interface PropsDoFormulario {
  consultoria: ConsultoriaResponse;
  aoSalvar: (c: ConsultoriaResponse) => void;
  aoConflito: () => void;
}

/**
 * Casca das três telas que leem `GET /consultoria` e gravam o mesmo `PUT /consultoria/marca` (Marca, Contato e Padrões do
 * acompanhamento): cabeçalho, esqueleto na primeira carga, erro com "Tentar de novo" e o formulário. No conflito (outra aba
 * ou outra destas telas gravou antes) recarrega e recria o formulário com os valores atuais.
 */
export function TelaDaConsultoria({ titulo, descricao, formulario }: {
  titulo: string;
  descricao: string;
  formulario: (props: PropsDoFormulario) => ReactNode;
}) {
  const { dados, erro, carregando, recarregar, definir } = useCarregar('consultoria', () => consultoria());
  const [conflitos, setConflitos] = useState(0);
  return (
    <Tela bordas={['top']}>
      <Cabecalho titulo={titulo} descricao={descricao} />
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {!dados && carregando ? <Esqueleto /> : null}
      {dados ? (
        <Fragment key={conflitos ? `${conflitos}:${dados.versao}` : 0}>
          {formulario({
            consultoria: dados,
            aoSalvar: definir,
            aoConflito: () => {
              recarregar();
              setConflitos((n) => n + 1);
            },
          })}
        </Fragment>
      ) : null}
    </Tela>
  );
}

