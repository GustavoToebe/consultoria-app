import { useState } from 'react';

import { ErroApi } from '../../api/cliente';
import { alterarMarca } from '../../api/rotas';
import type { ConsultoriaResponse } from '../../api/tipos';
import { useSessao } from '../../sessao/SessaoProvider';
import { useAviso } from '../../ui/Aviso';
import { errosPorCampo } from '../../ui/erros';
import { corpoDaConsultoria, type CorpoDaConsultoria } from './corpoDaConsultoria';

export const AVISO_DE_CONFLITO = 'Os dados da consultoria mudaram em outra aba. Recarregamos a versão atual.';

interface Opcoes {
  consultoria: ConsultoriaResponse;
  aoSalvar: (c: ConsultoriaResponse) => void;
  aoConflito: () => void;
  /** Aviso de sucesso da tela ("Marca salva…", "Contato salvo."). */
  sucesso: string;
}

/**
 * Salvar das três telas que gravam o `PUT /consultoria/marca` (Marca, Contato, Padrões do acompanhamento): o corpo inteiro
 * com os valores gravados e só os campos da tela por cima (`corpoDaConsultoria`), a `versao` lida e o 409
 * `CONFLITO_EDICAO` recarregando. Outros erros ficam em `erro` (os de campo em `campos`).
 */
export function useSalvarConsultoria({ consultoria, aoSalvar, aoConflito, sucesso }: Opcoes) {
  const { atualizarMarca } = useSessao();
  const { avisar } = useAviso();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);

  const salvar = (daTela: Partial<CorpoDaConsultoria>, depois?: (c: ConsultoriaResponse) => void) => {
    if (salvando) return;
    setSalvando(true);
    setErro(null);
    alterarMarca({ ...corpoDaConsultoria(consultoria), ...daTela, versao: consultoria.versao }).then(
      (c) => {
        setSalvando(false);
        depois?.(c);
        aoSalvar(c);
        atualizarMarca(c.marca);
        avisar(sucesso, 'sucesso');
      },
      (e: unknown) => {
        setSalvando(false);
        if (e instanceof ErroApi && e.codigo === 'CONFLITO_EDICAO') {
          avisar(AVISO_DE_CONFLITO, 'atencao');
          aoConflito();
          return;
        }
        setErro(e);
      },
    );
  };

  return { salvar, salvando, erro, campos: errosPorCampo(erro) };
}
