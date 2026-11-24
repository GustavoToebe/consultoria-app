import { useState } from 'react';

import { definirUsoDeImagem } from '../api/rotas';
import { ErroApi } from '../api/cliente';
import { dataParaTela } from '../dominio/formatos';
import { useTema } from '../tema/TemaProvider';
import { fontes } from '../tema/tokens';
import { Interruptor } from '../ui/Campos';
import { MensagemErro } from '../ui/Estados';
import { Texto } from '../ui/Texto';
import { textoDoErro } from '../ui/erros';
import { BlocoDaConta } from './conta/SecaoDaConta';
import type { Carga } from './conta/tipos';

const TEXTO = 'Autorizo a consultoria a usar minhas fotos de evolução em comparações para divulgação (por exemplo, Instagram). Posso desligar quando quiser.';

/** A linha só existe com a leitura feita (ou com erro que não é falta de conexão): sem internet ela some, como antes. */
export const usoDeImagemAparece = (carga: Pick<Carga<unknown>, 'dados' | 'erro'>) =>
  !(carga.erro instanceof ErroApi && carga.erro.semConexao) && !!(carga.dados || carga.erro);

/**
 * "Uso das suas fotos", na seção Privacidade da Conta (23/11; antes um cartão): a autorização de uso de imagem, só do aluno,
 * com o estado ("Autorizado em …" / "Não autorizado"). O interruptor salva na hora.
 */
export function CartaoUsoDeImagem({ carga }: { carga: Carga<{ autorizadoEm: string | null }> }) {
  const { cores } = useTema();
  const [salvando, setSalvando] = useState(false);
  const [falha, setFalha] = useState<unknown>(null);
  const { dados, erro, recarregar } = carga;
  const autorizadoEm = dados?.autorizadoEm ?? null;
  const mudar = (ligado: boolean) => {
    setSalvando(true);
    setFalha(null);
    definirUsoDeImagem(ligado).then(recarregar, (e: unknown) => setFalha(e)).finally(() => setSalvando(false));
  };
  return (
    <BlocoDaConta>
      <Texto style={{ fontFamily: fontes.semi, color: cores.texto }}>Uso das suas fotos</Texto>
      {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} tentarDeNovo={recarregar} /> : null}
      {dados ? (
        <>
          <Interruptor rotulo={TEXTO} valor={autorizadoEm !== null} aoMudar={mudar} />
          <Texto variante="suave">{salvando ? 'Salvando…' : autorizadoEm ? `Autorizado em ${dataParaTela(autorizadoEm)}` : 'Não autorizado'}</Texto>
        </>
      ) : null}
      {falha ? <MensagemErro texto={textoDoErro(falha)} erro={falha} /> : null}
    </BlocoDaConta>
  );
}
