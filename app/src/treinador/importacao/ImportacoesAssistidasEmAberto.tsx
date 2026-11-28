import { useEffect, useState } from 'react';

import { dataHoraParaTela } from '../../dominio/formatos';
import { sessaoRetomavel, textoDoErroDaImportacao } from '../../dominio/importacaoAssistida';
import { cancelarSessao, listarSessoes, type SessaoListaItem } from '../../servicos/importacaoAssistida';
import { Cartao } from '../../ui/Cartao';
import { MensagemErro } from '../../ui/Estados';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { ImportacoesEmAberto } from './LinhaDeImportacaoEmAberto';

/**
 * "Importações em aberto" da assistida (na própria tela e na tela Importação, 2.6): busca a lista, mostra só as que têm o
 * que retomar e descarta com confirmação. Sem nenhuma (ou com a assistida desligada, 503), o cartão não aparece: é escolha,
 * não pendência. `recarregar` muda quando quem usa sabe que a lista mudou (gravou, cancelou).
 */
export function ImportacoesAssistidasEmAberto({ aoRetomar, recarregar = 0 }: {
  aoRetomar: (id: string) => Promise<void> | void;
  recarregar?: number;
}) {
  const [sessoes, setSessoes] = useState<SessaoListaItem[]>([]);
  const [lidas, setLidas] = useState(0);
  const [retomando, setRetomando] = useState<string | null>(null);
  const [descartar, setDescartar] = useState<SessaoListaItem | null>(null);
  const [erro, setErro] = useState<unknown>(null);

  useEffect(() => {
    let ativo = true;
    listarSessoes().then(
      (lista) => { if (ativo) setSessoes(lista.filter(sessaoRetomavel)); },
      () => { if (ativo) setSessoes([]); },
    );
    return () => { ativo = false; };
  }, [recarregar, lidas]);

  const retomar = async (id: string) => {
    setRetomando(id);
    setErro(null);
    try {
      await aoRetomar(id);
    } catch (e: unknown) {
      setErro(e);
    } finally {
      setRetomando(null);
    }
  };

  const confirmarDescarte = async () => {
    const alvo = descartar;
    setDescartar(null);
    if (!alvo) return;
    setErro(null);
    try {
      await cancelarSessao(alvo.id);
    } catch (e: unknown) {
      setErro(e);
    }
    setLidas((n) => n + 1);
  };

  if (sessoes.length === 0 && !erro) return null;
  return (
    <>
      <Cartao titulo="Importações em aberto" descricao="Retome uma importação antes que ela expire.">
        {erro ? <MensagemErro texto={textoDoErroDaImportacao(erro)} erro={erro} /> : null}
        <ImportacoesEmAberto sessoes={sessoes} retomando={retomando} aoRetomar={(id) => void retomar(id)} aoDescartar={setDescartar} />
      </Cartao>
      <PainelConfirmacao
        visivel={!!descartar}
        titulo={`Descartar a importação de ${descartar ? dataHoraParaTela(descartar.criadoEm) : ''}?`}
        mensagem="A sessão será cancelada e os arquivos temporários serão descartados. O que já foi gravado permanece."
        rotuloConfirmar="Descartar importação"
        perigo
        aoConfirmar={() => void confirmarDescarte()}
        aoCancelar={() => setDescartar(null)}
      />
    </>
  );
}
