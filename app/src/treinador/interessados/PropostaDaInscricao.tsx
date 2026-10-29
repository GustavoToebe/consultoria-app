import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { InscricaoDetalhe, Modalidade, Periodicidade, PlanoDeReferencia } from '../../api/inscricoesTipos';
import { planosDeReferencia, propostaDaInscricao } from '../../api/rotas';
import { centavosParaCampo, centavosParaTela, dataHoraParaTela, SEM_DADO } from '../../dominio/formatos';
import {
  descontoDaProposta,
  LIMITES_INSCRICAO,
  MODALIDADES,
  OPCOES_MODALIDADE,
  OPCOES_PERIODICIDADE,
  PERIODICIDADES,
  temProposta,
  valorDaProposta,
} from '../../dominio/inscricoes';
import { espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoLeitura } from '../../ui/CampoLeitura';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Texto } from '../../ui/Texto';
import { useCarregar } from '../../ui/useCarregar';
import type { Executar } from './executar';

const AVISO = 'A proposta não gera cobrança nem confirma pagamento.';
const PLANO_LIVRE = '';

/**
 * Proposta negociada: o que foi oferecido à pessoa, para outro membro da equipe entender o atendimento. É uma cópia dos
 * termos (mudar o plano no Financeiro não muda a proposta) e não cria cobrança. Plano do Financeiro (só com ele ligado)
 * preenche nome, periodicidade e valor de referência, que ficam só leitura.
 */
export function PropostaDaInscricao({ dados, podeEditar, executar, ocupado }: {
  dados: InscricaoDetalhe;
  podeEditar: boolean;
  executar: Executar;
  ocupado: string | null;
}) {
  const [editando, setEditando] = useState(false);
  const p = dados.proposta;
  const desconto = descontoDaProposta(p);
  return (
    <Cartao titulo="Proposta" descricao={AVISO}>
      {editando ? (
        <FormularioDaProposta dados={dados} executar={executar} ocupado={ocupado} aoFechar={() => setEditando(false)} />
      ) : (
        <>
          {temProposta(p) ? (
            <>
              <CampoLeitura rotulo="Plano" valor={p.planoNome} />
              <CampoLeitura rotulo="Modalidade" valor={p.modalidade ? MODALIDADES[p.modalidade] : null} />
              <CampoLeitura rotulo="Periodicidade" valor={p.periodicidade ? PERIODICIDADES[p.periodicidade] : null} />
              <CampoLeitura rotulo="Valor de referência" valor={centavosParaTela(p.valorReferenciaCentavos)} />
              <CampoLeitura rotulo="Valor proposto"
                valor={`${centavosParaTela(p.valorCentavos)}${desconto !== null ? ` (${desconto}% de desconto)` : ''}`} />
              <CampoLeitura rotulo="Condições" valor={p.condicoes} />
              {p.atualizadaEm ? (
                <Texto variante="pequeno">Atualizada por {p.atualizadaPorNome ?? SEM_DADO} em {dataHoraParaTela(p.atualizadaEm)}.</Texto>
              ) : null}
            </>
          ) : (
            <Texto variante="suave">Sem proposta ainda.</Texto>
          )}
          {podeEditar ? (
            <LinhaDeAcoes>
              <Botao rotulo={temProposta(p) ? 'Editar proposta' : 'Registrar proposta'} tipo="secundario" aoTocar={() => setEditando(true)} />
            </LinhaDeAcoes>
          ) : null}
        </>
      )}
    </Cartao>
  );
}

function FormularioDaProposta({ dados, executar, ocupado, aoFechar }: {
  dados: InscricaoDetalhe;
  executar: Executar;
  ocupado: string | null;
  aoFechar: () => void;
}) {
  const p = dados.proposta;
  const planos = useCarregar('inscricoes:planos-de-referencia', () => planosDeReferencia());
  const [planoId, setPlanoId] = useState<string>(p.planoId ?? PLANO_LIVRE);
  const [planoNome, setPlanoNome] = useState(p.planoNome ?? '');
  const [modalidade, setModalidade] = useState<Modalidade | null>(p.modalidade);
  const [periodicidade, setPeriodicidade] = useState<Periodicidade | null>(p.periodicidade);
  const [referencia, setReferencia] = useState(centavosParaCampo(p.valorReferenciaCentavos));
  const [valor, setValor] = useState(centavosParaCampo(p.valorCentavos));
  const [condicoes, setCondicoes] = useState(p.condicoes ?? '');
  const [tentou, setTentou] = useState(false);

  const lista: readonly PlanoDeReferencia[] = planos.dados ?? [];
  const plano = lista.find((x) => x.id === planoId) ?? null;
  const ref = plano ? { valor: plano.valorCentavos, erro: null } : valorDaProposta(referencia);
  const proposto = valorDaProposta(valor);
  const nome = plano ? plano.nome : planoNome.trim();

  const escolherPlano = (id: string) => {
    setPlanoId(id);
    const escolhido = lista.find((x) => x.id === id);
    if (escolhido) {
      setPlanoNome(escolhido.nome);
      setPeriodicidade(escolhido.periodicidade);
      setReferencia(centavosParaCampo(escolhido.valorCentavos));
    }
  };

  const salvar = () => {
    setTentou(true);
    if (ref.erro || proposto.erro || nome.length > LIMITES_INSCRICAO.planoNome || condicoes.trim().length > LIMITES_INSCRICAO.condicoes) return;
    executar('proposta', () => propostaDaInscricao(dados.id, {
      planoId: plano?.id ?? null,
      planoNome: nome || null,
      modalidade,
      periodicidade: plano ? plano.periodicidade : periodicidade,
      valorReferenciaCentavos: ref.valor,
      valorCentavos: proposto.valor,
      condicoes: condicoes.trim() || null,
      versao: dados.versao,
    }), 'Proposta salva.', aoFechar);
  };

  const limpar = () => executar('proposta', () => propostaDaInscricao(dados.id, {
    planoId: null, planoNome: null, modalidade: null, periodicidade: null, valorReferenciaCentavos: null, valorCentavos: null,
    condicoes: null, versao: dados.versao,
  }), 'Proposta apagada.', aoFechar);

  return (
    <View style={estilos.formulario}>
      {lista.length > 0 ? (
        <EscolhaEmFolha rotulo="Plano do Financeiro" valor={planoId} aoMudar={escolherPlano}
          opcoes={[{ valor: PLANO_LIVRE, rotulo: 'Nenhum (escrever o plano)' },
            ...lista.map((x) => ({ valor: x.id, rotulo: x.nome, detalhe: `${centavosParaTela(x.valorCentavos)} · ${PERIODICIDADES[x.periodicidade]}` }))]} />
      ) : null}
      {plano ? (
        <>
          <CampoLeitura rotulo="Plano" valor={plano.nome} />
          <CampoLeitura rotulo="Periodicidade" valor={PERIODICIDADES[plano.periodicidade]} />
          <CampoLeitura rotulo="Valor de referência" valor={centavosParaTela(plano.valorCentavos)} />
        </>
      ) : (
        <>
          <Campo rotulo="Plano" valor={planoNome} aoMudar={setPlanoNome} maxLength={LIMITES_INSCRICAO.planoNome} />
          <Escolha rotulo="Periodicidade" opcoes={OPCOES_PERIODICIDADE} valor={periodicidade} aoMudar={setPeriodicidade} limpavel />
          <Campo rotulo="Valor de referência (R$)" valor={referencia} aoMudar={setReferencia} inputMode="decimal"
            erro={tentou ? ref.erro : null} ajuda="O preço de tabela, se houver." />
        </>
      )}
      <Escolha rotulo="Modalidade" opcoes={OPCOES_MODALIDADE} valor={modalidade} aoMudar={setModalidade} limpavel />
      <Campo rotulo="Valor proposto (R$)" valor={valor} aoMudar={setValor} inputMode="decimal" erro={tentou ? proposto.erro : null} />
      <Campo rotulo="Condições combinadas" valor={condicoes} aoMudar={setCondicoes} linhas={3} maxLength={LIMITES_INSCRICAO.condicoes} />
      <Texto variante="pequeno">{AVISO}</Texto>
      <LinhaDeAcoes>
        <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoFechar} />
        {temProposta(p) ? <Botao rotulo="Limpar proposta" tipo="perigoTexto" aoTocar={limpar} desabilitado={ocupado === 'proposta'} /> : null}
        <Botao rotulo="Salvar proposta" aoTocar={salvar} carregando={ocupado === 'proposta'} />
      </LinhaDeAcoes>
    </View>
  );
}

const estilos = StyleSheet.create({
  formulario: { gap: espaco(1.5) },
});
