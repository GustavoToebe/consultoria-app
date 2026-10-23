import { useState } from 'react';

import { definirUsoDeImagem, usoDeImagem } from '../api/rotas';
import { ErroApi } from '../api/cliente';
import { dataParaTela } from '../dominio/formatos';
import { Interruptor } from '../ui/Campos';
import { Cartao } from '../ui/Cartao';
import { MensagemErro } from '../ui/Estados';
import { Texto } from '../ui/Texto';
import { textoDoErro } from '../ui/erros';
import { useCarregar } from '../ui/useCarregar';

const TEXTO = 'Autorizo a consultoria a usar minhas fotos de evolução em comparações para divulgação (por exemplo, Instagram). Posso desligar quando quiser.';

/** Autorização de uso de imagem, só do aluno. Sem internet o cartão some. */
export function CartaoUsoDeImagem() {
  const { dados, erro, recarregar } = useCarregar('uso-de-imagem', usoDeImagem);
  const [salvando, setSalvando] = useState(false);
  const [falha, setFalha] = useState<unknown>(null);
  if (erro instanceof ErroApi && erro.semConexao) return null;
  if (!dados && !erro) return null;
  const autorizadoEm = dados?.autorizadoEm ?? null;
  const mudar = (ligado: boolean) => {
    setSalvando(true);
    setFalha(null);
    definirUsoDeImagem(ligado).then(recarregar, (e: unknown) => setFalha(e)).finally(() => setSalvando(false));
  };
  return (
    <Cartao titulo="Uso das suas fotos">
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {dados ? (
        <>
          <Interruptor rotulo={TEXTO} valor={autorizadoEm !== null} aoMudar={mudar} />
          <Texto variante="suave">{autorizadoEm ? `Autorizado em ${dataParaTela(autorizadoEm)}` : 'Não autorizado'}</Texto>
          {salvando ? <Texto variante="pequeno">Salvando…</Texto> : null}
        </>
      ) : null}
      {falha ? <MensagemErro texto={textoDoErro(falha)} erro={falha} /> : null}
    </Cartao>
  );
}
