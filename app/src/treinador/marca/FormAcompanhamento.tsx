import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ConsultoriaResponse, MetaDoPeso } from '../../api/tipos';
import { OPCOES_DA_META } from '../../dominio/metaDoPesoNaFicha';
import { useSessao } from '../../sessao/SessaoProvider';
import { espaco, LARGURA_FORMULARIO } from '../../tema/tokens';
import { Campo } from '../../ui/Campo';
import { CampoNumerico } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Texto } from '../../ui/Texto';
import { textosDasFases } from './corpoDaConsultoria';
import { RodapeDeSalvar } from './RodapeDeSalvar';
import { useSalvarConsultoria } from './useSalvarConsultoria';

const FASES = [
  { chave: 'menstrual', rotulo: 'Menstrual' },
  { chave: 'folicular', rotulo: 'Folicular' },
  { chave: 'ovulatoria', rotulo: 'Ovulatória' },
  { chave: 'lutea', rotulo: 'Lútea' },
] as const;

interface Props {
  consultoria: ConsultoriaResponse;
  aoSalvar: (c: ConsultoriaResponse) => void;
  aoConflito: () => void;
}

/**
 * Padrões do acompanhamento (Configurações › Alunos e atendimento, 27/11; saiu da Marca): o prazo da nova atualização, a
 * meta do peso e, com o ciclo ligado, os textos das fases. Valem para o aluno sem valor próprio no cadastro. Grava no mesmo
 * `PUT /consultoria/marca`, com o resto como está gravado.
 */
export function FormAcompanhamento({ consultoria, aoSalvar, aoConflito }: Props) {
  const { cicloHabilitado } = useSessao();
  const [dias, setDias] = useState<number | null>(consultoria.diasAtualizacaoPadrao ?? null);
  const metaSalva: MetaDoPeso = consultoria.metaDoPeso ?? 'REDUZIR';
  const [meta, setMeta] = useState<MetaDoPeso>(metaSalva);
  const salvas = textosDasFases(consultoria.textosFasesCiclo);
  const [fases, setFases] = useState(() => ({
    menstrual: salvas.menstrual ?? '', folicular: salvas.folicular ?? '', ovulatoria: salvas.ovulatoria ?? '', lutea: salvas.lutea ?? '',
  }));
  const atuais = textosDasFases(fases);
  const { salvar, salvando, erro, campos } = useSalvarConsultoria({ consultoria, aoSalvar, aoConflito, sucesso: 'Padrões do acompanhamento salvos.' });
  const diasValidos = dias === null || (Number.isInteger(dias) && dias >= 1 && dias <= 365);
  const alterado = dias !== (consultoria.diasAtualizacaoPadrao ?? null) || meta !== metaSalva || FASES.some(({ chave }) => atuais[chave] !== salvas[chave]);

  return (
    <View style={estilos.coluna}>
      <Cartao titulo="Atualização" descricao="Vale para o aluno sem prazo próprio no cadastro.">
        <View style={estilos.campoCurto}>
          <CampoNumerico
            rotulo="Nova atualização a cada (dias)"
            inteiro
            valor={dias}
            aoMudar={setDias}
            erro={campos.diasAtualizacaoPadrao ?? (diasValidos ? null : 'Use de 1 a 365 dias.')}
            ajuda="Preenche o início e o fim de cada pasta nova. Vazio = sem padrão."
          />
        </View>
      </Cartao>
      <Cartao titulo="Peso" descricao="Vale para o aluno sem meta própria no cadastro.">
        <View style={estilos.meta}>
          <Escolha rotulo="Meta do peso dos alunos" valor={meta} aoMudar={setMeta} opcoes={OPCOES_DA_META} />
          <Texto variante="pequeno">Pinta a variação do peso: verde na direção da meta, vermelho contra; sem meta, sem cor. Na ficha de cada aluno dá para trocar.</Texto>
        </View>
      </Cartao>
      {cicloHabilitado ? (
        <Cartao titulo="Ciclo menstrual: textos das fases" recolhivel recolhido
          descricao="Aparece para a aluna e para a equipe junto da fase. O app não recomenda nada por conta própria: escreva só o que você orienta.">
          {FASES.map(({ chave, rotulo }) => (
            <Campo key={chave} rotulo={rotulo} valor={fases[chave]} aoMudar={(valor) => setFases((a) => ({ ...a, [chave]: valor }))} maxLength={1000} linhas={3} />
          ))}
        </Cartao>
      ) : null}
      {erro && Object.keys(campos).length === 0 ? <MensagemErro texto={textoDoErro(erro)} erro={erro} /> : null}
      <RodapeDeSalvar alterado={alterado} rotulo="Salvar padrões" salvando={salvando}
        motivo={diasValidos ? null : 'O prazo da atualização vai de 1 a 365 dias.'}
        aoSalvar={() => salvar({ diasAtualizacaoPadrao: dias, metaDoPeso: meta, textosFasesCiclo: atuais })} />
    </View>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: espaco(2), maxWidth: LARGURA_FORMULARIO },
  campoCurto: { maxWidth: 280 },
  meta: { gap: espaco(0.5) },
});
