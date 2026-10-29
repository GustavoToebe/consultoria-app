import { CalendarDays, ClipboardList, FileText, Wallet } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { mostrarCartaoAnamnese } from '../dominio/anamnese';
import { mostrarCartaoAtualizacao } from '../dominio/atualizacao';
import { contagem } from '../dominio/contagens';
import { hojeEmBrasilia } from '../dominio/financeiro';
import { avisosDoInicio, ITEM_ANAMNESE, itemDaAtualizacao, itemDoPagamento } from '../dominio/paraFazer';
import { useTema } from '../tema/TemaProvider';
import { espaco, fontes, RAIO } from '../tema/tokens';
import { Grade } from '../ui/Grade';
import { ItemDeLista } from '../ui/ItemDeLista';
import { LinkTexto } from '../ui/LinkTexto';
import { useRolagem } from '../ui/RolagemComTopo';
import { Texto } from '../ui/Texto';
import { useAnamnese } from './anamnese/useAnamnese';
import { PermissaoLembrete } from './atualizacao/PermissaoLembrete';
import { useAtualizacao } from './atualizacao/useAtualizacao';
import { CHAVE_DOS_COMPROMISSOS } from './CartaoCompromissos';
import { useCompromissosDoAluno } from './compromissos/CompromissosDoAlunoProvider';
import { useFinanceiroDoAluno, useRecarregarFinanceiroAoFocar } from './financeiro/FinanceiroDoAlunoProvider';
import { SecaoDoInicio } from './SecaoDoInicio';

/**
 * "Suas pendências" no início do aluno, abaixo do Hoje: anamnese inicial, atualização do período e pagamento em aberto
 * (só com o módulo de pagamentos ligado; o item leva à Conta, onde fica o "Pagar", se a plataforma o tem), cada uma um item
 * inteiro tocável (`ItemDeLista`: ícone, uma linha de contexto, selo curto e seta). Só a atualização atrasada é vermelha;
 * o resto é neutro, para a lista não gritar. Os avisos de compromisso (D12) vêm por último: informam, não pedem nada;
 * tocar num aviso o marca como visto e rola até o cartão "Seus compromissos" do mesmo Início. A contagem fica à direita
 * do título. Sem nada pendente, o bloco some.
 */
export function ParaFazer() {
  const anamnese = useAnamnese().dados;
  const atualizacao = useAtualizacao().dados;
  const comAnamnese = !!anamnese && mostrarCartaoAnamnese(anamnese);
  const comAtualizacao = !!atualizacao && mostrarCartaoAtualizacao(atualizacao);
  const financeiro = useFinanceiroDoAluno();
  useRecarregarFinanceiroAoFocar();
  const pagamento = financeiro.habilitado ? itemDoPagamento(financeiro.dados?.abertas, hojeEmBrasilia(), financeiro.modoDePagamento) : null;
  const { avisos, marcarVisto } = useCompromissosDoAluno();
  const { rolarAte } = useRolagem();
  const { itens: avisosVisiveis, ocultos, total: totalDeAvisos } = avisosDoInicio(avisos, hojeEmBrasilia());
  if (!comAnamnese && !comAtualizacao && !pagamento && totalDeAvisos === 0) return null;
  const item = comAtualizacao ? itemDaAtualizacao(atualizacao) : null;
  const total = (comAnamnese ? 1 : 0) + (item ? 1 : 0) + (pagamento ? 1 : 0) + totalDeAvisos;
  return (
    <SecaoDoInicio titulo="Suas pendências" direita={<Contador total={total} />}>
      <Grade>
        {comAnamnese ? (
          <ItemDeLista
            titulo={ITEM_ANAMNESE.titulo}
            detalhe={ITEM_ANAMNESE.detalhe}
            Icone={ClipboardList}
            selo={ITEM_ANAMNESE.selo ?? undefined}
            href="/aluno/anamnese"
          />
        ) : null}
        {item ? <ItemDeLista titulo={item.titulo} detalhe={item.detalhe} Icone={FileText} selo={item.selo ?? undefined} href="/aluno/atualizacao" /> : null}
        {pagamento ? <ItemDeLista titulo={pagamento.titulo} detalhe={pagamento.detalhe} Icone={Wallet} selo={pagamento.selo ?? undefined} href="/aluno/conta" /> : null}
        {avisosVisiveis.map((aviso) => (
          <ItemDeLista
            key={aviso.id}
            titulo={aviso.titulo}
            detalhe={aviso.detalhe}
            Icone={CalendarDays}
            selo={aviso.selo ?? undefined}
            aoTocar={() => { marcarVisto(aviso.id); rolarAte([CHAVE_DOS_COMPROMISSOS]); }}
          />
        ))}
      </Grade>
      {ocultos > 0 ? <Texto variante="suave">{`Mais ${contagem(ocultos, 'aviso', 'avisos')} de compromisso depois destes.`}</Texto> : null}
      {item?.responder ? <LinkTexto texto="Vou atrasar" href="/aluno/atualizacao?atraso=sim" /> : null}
      {atualizacao && item ? <PermissaoLembrete atualizacao={atualizacao} /> : null}
    </SecaoDoInicio>
  );
}

function Contador({ total }: { total: number }) {
  const { cores } = useTema();
  return (
    <View
      accessibilityLabel={contagem(total, 'pendência', 'pendências')}
      style={[estilos.contador, { backgroundColor: cores.superficie2, borderColor: cores.borda }]}>
      <Texto numerico style={estilos.numero}>{total}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  contador: { minWidth: 28, height: 28, paddingHorizontal: espaco(0.75), borderRadius: RAIO, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  numero: { fontFamily: fontes.semi, fontSize: 14, lineHeight: 20 },
});
