import { useState } from 'react';
import { View } from 'react-native';

import type { Painel } from '../../api/financeiroTipos';
import { exportarFinanceiro } from '../../api/rotas';
import { ATALHOS_DE_PERIODO, avisoDaExportacao, hojeEmBrasilia, nomeDoCsv, periodoDoPainel, type AtalhoDePeriodo } from '../../dominio/financeiro';
import { dataParaTela } from '../../dominio/formatos';
import { espaco } from '../../tema/tokens';
import { useAviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Escolha } from '../../ui/Escolha';
import { Incompleto, MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { Texto } from '../../ui/Texto';
import { baixarCsv } from './baixarCsv';

/**
 * Exportar CSV (`FINANCEIRO_LER`): cobranças por vencimento e lançamentos por data do período. O arquivo tem nomes de
 * alunos e valores: o aparelho só guarda o temporário do compartilhar (apagado ao sair), nunca uma cópia do financeiro.
 * Passando de 5.000 linhas a API recusa (422) e a mensagem pede um período menor.
 */
export function FolhaDeExportacao({ visivel, aoFechar, painel }: {
  visivel: boolean;
  aoFechar: () => void;
  /** O painel do mês (só o `historicoFinanceiroParcial` importa): com o histórico parcial, a folha explica a coluna nova do CSV. */
  painel?: Pick<Painel, 'historicoFinanceiroParcial'>;
}) {
  const { avisar } = useAviso();
  const [atalho, setAtalho] = useState<AtalhoDePeriodo>('6m');
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  if (!visivel) return null;
  const periodo = periodoDoPainel(atalho, hojeEmBrasilia());

  const baixar = () => {
    setBaixando(true);
    setErro(null);
    exportarFinanceiro(periodo.de, periodo.ate)
      .then((texto) => baixarCsv(nomeDoCsv(periodo.de, periodo.ate), texto))
      .then(
        () => { setBaixando(false); avisar('Arquivo gerado.', 'sucesso'); aoFechar(); },
        (e: unknown) => { setBaixando(false); setErro(e); },
      );
  };

  return (
    <Folha visivel titulo="Exportar CSV" aoFechar={aoFechar}
      rodape={<Botao rotulo="Baixar CSV" aoTocar={baixar} carregando={baixando} />}>
      <View style={{ gap: espaco(1.5) }}>
        <Texto variante="suave">
          Cobranças (por vencimento) e lançamentos avulsos (por data) do período, para planilha. O arquivo tem nomes de alunos e
          valores: guarde com cuidado. A exportação fica registrada na auditoria.
        </Texto>
        {avisoDaExportacao(painel) ? <Incompleto texto={avisoDaExportacao(painel)!} /> : null}
        <Escolha rotulo="Período" opcoes={ATALHOS_DE_PERIODO} valor={atalho} aoMudar={setAtalho} />
        <Texto variante="pequeno">{dataParaTela(periodo.de)} a {dataParaTela(periodo.ate)}</Texto>
        {erro ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      </View>
    </Folha>
  );
}
