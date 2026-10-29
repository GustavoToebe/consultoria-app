import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ResponsavelEquipe } from '../../api/equipeTipos';
import type { InscricaoDetalhe, RetornoInscricao } from '../../api/inscricoesTipos';
import { alterarRetorno, concluirRetorno, marcarRetorno } from '../../api/rotas';
import { hojeEmBrasilia } from '../../dominio/agendaPresencial';
import { dataDaTela, dataHoraParaTela, dataParaTela, SEM_DADO } from '../../dominio/formatos';
import { estaAberta, LIMITES_INSCRICAO, seloDoRetorno } from '../../dominio/inscricoes';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Campo } from '../../ui/Campo';
import { CampoData } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { EscolhaEmFolha } from '../../ui/EscolhaEmFolha';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import type { Executar } from './executar';

const SEM_RESPONSAVEL = '';

/**
 * Retornos (próxima ação): o que fazer, quando e quem faz. Fica só na tela (sem notificação); atrasado em vermelho,
 * hoje em âmbar. Concluir guarda quem e quando; reagendar muda data, texto ou responsável.
 */
export function RetornosDaInscricao({ dados, podeAlterar, responsaveis, executar, ocupado }: {
  dados: InscricaoDetalhe;
  podeAlterar: boolean;
  responsaveis: readonly ResponsavelEquipe[];
  executar: Executar;
  ocupado: string | null;
}) {
  const [editando, setEditando] = useState<RetornoInscricao | 'novo' | null>(null);
  const [verConcluidos, setVerConcluidos] = useState(false);
  const hoje = hojeEmBrasilia();
  const pendentes = dados.retornos.filter((r) => !r.concluidoEm).sort((a, b) => a.data.localeCompare(b.data));
  const concluidos = dados.retornos.filter((r) => r.concluidoEm);
  const pode = podeAlterar && estaAberta(dados.situacao);
  return (
    <Cartao titulo="Retornos" descricao="Próximas ações combinadas. Ficam só aqui: o app não manda lembrete.">
      {pendentes.length === 0 && !editando ? <Texto variante="suave">Nenhum retorno marcado.</Texto> : null}
      {pendentes.map((r) => (editando !== 'novo' && editando?.id === r.id ? (
        <FormularioDoRetorno key={r.id} inicial={r} responsaveis={responsaveis} ocupado={ocupado === 'retorno'}
          aoCancelar={() => setEditando(null)}
          aoSalvar={(corpo) => executar('retorno', () => alterarRetorno(r.id, { ...corpo, versao: r.versao }), 'Retorno reagendado.', () => setEditando(null))} />
      ) : (
        <ItemDoRetorno key={r.id} retorno={r} hoje={hoje}>
          {pode ? (
            <LinhaDeAcoes>
              <Botao rotulo="Concluir" tipo="secundario" carregando={ocupado === `concluir:${r.id}`}
                aoTocar={() => executar(`concluir:${r.id}`, () => concluirRetorno(r.id, r.versao), 'Retorno concluído.')} />
              <Botao rotulo="Reagendar" tipo="secundario" aoTocar={() => setEditando(r)} />
            </LinhaDeAcoes>
          ) : null}
        </ItemDoRetorno>
      )))}
      {editando === 'novo' ? (
        <FormularioDoRetorno inicial={null} padraoResponsavel={dados.responsavelId} responsaveis={responsaveis} ocupado={ocupado === 'retorno'}
          aoCancelar={() => setEditando(null)}
          aoSalvar={(corpo) => executar('retorno', () => marcarRetorno(dados.id, corpo), 'Retorno marcado.', () => setEditando(null))} />
      ) : null}
      {pode && editando === null ? (
        <LinhaDeAcoes><Botao rotulo="Marcar retorno" tipo="secundario" aoTocar={() => setEditando('novo')} /></LinhaDeAcoes>
      ) : null}
      {concluidos.length > 0 ? (
        <LinhaDeAcoes>
          <Botao rotulo={verConcluidos ? 'Esconder concluídos' : `Ver concluídos (${concluidos.length})`} tipo="fantasma"
            aoTocar={() => setVerConcluidos(!verConcluidos)} />
        </LinhaDeAcoes>
      ) : null}
      {verConcluidos ? concluidos.map((r) => (
        <ItemDoRetorno key={r.id} retorno={r} hoje={hoje}>
          <Texto variante="pequeno">Concluído por {r.concluidoPorNome ?? SEM_DADO} em {dataHoraParaTela(r.concluidoEm)}.</Texto>
        </ItemDoRetorno>
      )) : null}
    </Cartao>
  );
}

function ItemDoRetorno({ retorno, hoje, children }: { retorno: RetornoInscricao; hoje: string; children?: ReactNode }) {
  const { cores } = useTema();
  const selo = retorno.concluidoEm ? null : seloDoRetorno(retorno.data, hoje);
  return (
    <View style={[estilos.item, { borderColor: cores.borda, backgroundColor: cores.superficie2 }]}>
      <View style={estilos.linha}>
        <Texto variante="bloco" numerico>{dataParaTela(retorno.data)}</Texto>
        {selo ? <Selo texto={selo.texto} tipo={selo.tipo} /> : null}
        {retorno.concluidoEm ? <Selo texto="Concluído" tipo="sucesso" /> : null}
      </View>
      <Texto>{retorno.descricao}</Texto>
      <Texto variante="pequeno">{retorno.responsavelNome ?? (retorno.responsavelId ? 'Membro inativo' : 'Sem responsável')}</Texto>
      {children}
    </View>
  );
}

function FormularioDoRetorno({ inicial, padraoResponsavel, responsaveis, ocupado, aoCancelar, aoSalvar }: {
  inicial: RetornoInscricao | null;
  padraoResponsavel?: string | null;
  responsaveis: readonly ResponsavelEquipe[];
  ocupado: boolean;
  aoCancelar: () => void;
  aoSalvar: (corpo: { descricao: string; data: string; responsavelId: string | null }) => void;
}) {
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '');
  const [data, setData] = useState(inicial ? dataParaTela(inicial.data) : '');
  const [responsavelId, setResponsavelId] = useState(inicial?.responsavelId ?? padraoResponsavel ?? SEM_RESPONSAVEL);
  const [tentou, setTentou] = useState(false);
  const iso = dataDaTela(data);
  const erroDescricao = !descricao.trim() ? 'Escreva o que fazer.' : null;
  const erroData = !iso ? 'Informe a data.' : null;
  const salvar = () => {
    setTentou(true);
    if (erroDescricao || erroData || !iso) return;
    aoSalvar({ descricao: descricao.trim(), data: iso, responsavelId: responsavelId || null });
  };
  return (
    <View style={estilos.formulario}>
      <Campo rotulo="O que fazer" valor={descricao} aoMudar={setDescricao} maxLength={LIMITES_INSCRICAO.retorno}
        erro={tentou ? erroDescricao : null} placeholder="Ex.: ligar para falar do plano" />
      <CampoData rotulo="Data do retorno" valor={data} aoMudar={setData} erro={tentou ? erroData : null} />
      <EscolhaEmFolha rotulo="Responsável" valor={responsavelId} aoMudar={setResponsavelId}
        opcoes={[{ valor: SEM_RESPONSAVEL, rotulo: 'Sem responsável' }, ...responsaveis.map((r) => ({ valor: r.id, rotulo: r.nome }))]}
        rotuloDoValor="Membro inativo" />
      <LinhaDeAcoes>
        <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoCancelar} />
        <Botao rotulo={inicial ? 'Salvar retorno' : 'Marcar'} aoTocar={salvar} carregando={ocupado} />
      </LinhaDeAcoes>
    </View>
  );
}

const estilos = StyleSheet.create({
  item: { borderWidth: 1, borderRadius: RAIO, padding: espaco(1.5), gap: espaco(0.5) },
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(0.75) },
  formulario: { gap: espaco(1.5) },
});
