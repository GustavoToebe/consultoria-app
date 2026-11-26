import { useState } from 'react';

import { useAviso } from '../ui/Aviso';
import { erroDeConexao, textoDoErro } from '../ui/erros';
import { abrirPdf } from './abrirPdf';
import { ErroDoPdf } from './erroDoPdf';

/**
 * "Abrir o PDF" (celular) ou "Baixar o PDF" (web) do contrato, equipe e aluno. Erro vira aviso; nada fica guardado além do temporário do celular.
 */
export function useAbrirPdf(baixar: () => Promise<Blob>) {
  const { avisar } = useAviso();
  const [abrindo, setAbrindo] = useState(false);
  const abrir = () => {
    if (abrindo) return;
    setAbrindo(true);
    abrirPdf(baixar).then(
      () => setAbrindo(false),
      (e: unknown) => {
        setAbrindo(false);
        avisar(e instanceof ErroDoPdf ? e.message : erroDeConexao(e) ? 'Confira a internet e tente de novo.' : textoDoErro(e), 'perigo');
      },
    );
  };
  return { abrir, abrindo };
}
