import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AJUDA_MOSTRAR_FASES, diferencaEmDias, faseNaData, hojeDoCiclo, podeTerminarHoje, registroEmAndamento, ROTULO_DA_COLICA, ROTULO_DO_FLUXO,
  ROTULO_DO_SINTOMA, SINTOMAS, textoDaLeitura, textoDaPrevisao, VERSAO_CONSENTIMENTO, type ConfigDoCiclo, type FaseDoCiclo,
} from '../../dominio/cicloMenstrual';
import { dataDaTela, dataParaTela } from '../../dominio/formatos';
import { novoUid } from '../../dominio/uid';
import { useTema } from '../../tema/TemaProvider';
import { ALVO_TOQUE, espaco } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { Cabecalho } from '../../ui/Cabecalho';
import { CalendarioDoCiclo, mesSeguinte, rotuloDoMes } from '../../ui/CalendarioDoCiclo';
import { Campo } from '../../ui/Campo';
import { CampoData, CampoNumerico, Interruptor } from '../../ui/Campos';
import { Cartao } from '../../ui/Cartao';
import { Escolha } from '../../ui/Escolha';
import { Carregando, MensagemErro } from '../../ui/Estados';
import { textoDoErro } from '../../ui/erros';
import { Folha } from '../../ui/Folha';
import { PainelConfirmacao } from '../../ui/PainelConfirmacao';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { TextoFormatado } from '../../ui/TextoFormatado';
import { useAviso } from '../../ui/Aviso';
import {
  alterarRegistroDeCiclo, apagarCiclo, apagarDiaDeCiclo, apagarRegistroDeCiclo, ativarCiclo, configurarCiclo,
  desativarCiclo, gravarDiaDeCiclo, gravarRegistroDeCiclo,
} from '../../api/rotas';
import type { DiaDeCicloApi, RegistroDeCicloApi, TextosDasFases } from '../../api/tipos';
import { useCicloDaAluna } from '../../aluno/useCicloDaAluna';

const FLUXOS = Object.entries(ROTULO_DO_FLUXO).map(([valor, rotulo]) => ({ valor, rotulo }));
const COLICAS = Object.entries(ROTULO_DA_COLICA).map(([valor, rotulo]) => ({ valor, rotulo }));
const CHAVE: Record<FaseDoCiclo, keyof TextosDasFases> = {
  MENSTRUAL: 'menstrual', FOLICULAR: 'folicular', OVULATORIA: 'ovulatoria', LUTEA: 'lutea',
};

export default function CicloDaAluna() {
  const ciclo = useCicloDaAluna();
  const { avisar } = useAviso();
  const hoje = hojeDoCiclo();
  const [mes, setMes] = useState(`${hoje.slice(0, 8)}01`);
  const dados = ciclo.dados;
  const config: ConfigDoCiclo | null = dados?.ativo ? {
    duracaoHabitual: dados.duracaoHabitual ?? null,
    mostrarFases: dados.mostrarFases !== false,
    hoje,
  } : null;
  return (
    <Tela bordas={['top']} largura={720}>
      <Cabecalho titulo="Ciclo menstrual" voltar="/aluno/conta" />
      {!ciclo.online ? <Texto>Precisa de conexão.</Texto> : null}
      {ciclo.online && !dados && ciclo.erro ? <MensagemErro texto={textoDoErro(ciclo.erro)} tentarDeNovo={ciclo.recarregar} /> : null}
      {ciclo.online && !dados && !ciclo.erro ? <Carregando texto="Carregando" /> : null}
      {ciclo.online && dados && !dados.disponivel ? <Texto>O acompanhamento fica disponível quando o sexo do cadastro é Feminino.</Texto> : null}
      {ciclo.online && dados?.disponivel && !dados.ativo ? <Ativar aoAtivar={ciclo.definir} /> : null}
      {ciclo.online && dados?.ativo && config ? (
        <Conteudo
          registros={dados.registros ?? []}
          dias={dados.dias ?? []}
          config={config}
          textos={dados.textosDasFases}
          mes={mes}
          aoMes={setMes}
          aoRecarregar={ciclo.recarregar}
          avisar={avisar}
        />
      ) : null}
    </Tela>
  );
}

function Ativar({ aoAtivar }: { aoAtivar: (dados: NonNullable<ReturnType<typeof useCicloDaAluna>['dados']>) => void }) {
  const { avisar } = useAviso();
  const [aberto, setAberto] = useState(false);
  const [duracao, setDuracao] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const invalida = duracao != null && (duracao < 21 || duracao > 45);
  return (
    <Cartao titulo="Acompanhamento desligado">
      <Texto>O acompanhamento é opcional. Você pode desligar e apagar quando quiser.</Texto>
      <Botao rotulo="Ativar acompanhamento" aoTocar={() => setAberto(true)} />
      <PainelConfirmacao visivel={aberto} titulo="Ativar acompanhamento?"
        mensagem="O acompanhamento é opcional. Quem vê: seu treinador e a equipe com acesso a dados sensíveis. Para quê: acompanhar seu treino e sua dieta. Você pode desligar e apagar quando quiser."
        rotuloConfirmar="Ativar" carregando={ocupado} desabilitado={invalida} aoCancelar={() => setAberto(false)}
        aoConfirmar={() => {
          setOcupado(true);
          ativarCiclo(VERSAO_CONSENTIMENTO, duracao).then(
            (d) => { setOcupado(false); setAberto(false); aoAtivar(d); },
            (e: unknown) => { setOcupado(false); avisar(textoDoErro(e), 'perigo'); },
          );
        }}>
        <CampoNumerico rotulo="Duração habitual do ciclo (opcional)" inteiro valor={duracao} aoMudar={setDuracao} sufixo="dias"
          erro={invalida ? 'Use de 21 a 45 dias.' : null} />
      </PainelConfirmacao>
    </Cartao>
  );
}

function Conteudo({ registros, dias, config, textos, mes, aoMes, aoRecarregar, avisar }: {
  registros: RegistroDeCicloApi[];
  dias: DiaDeCicloApi[];
  config: ConfigDoCiclo;
  textos?: TextosDasFases | null;
  mes: string;
  aoMes: (mes: string) => void;
  aoRecarregar: () => void;
  avisar: (texto: string, tipo: 'sucesso' | 'perigo') => void;
}) {
  const leitura = faseNaData(registros, config, config.hoje);
  const aberto = registroEmAndamento(registros);
  const [outraData, setOutraData] = useState(false);
  const [dia, setDia] = useState<string | null>(null);
  const [editando, setEditando] = useState<RegistroDeCicloApi | null>(null);
  const [apagar, setApagar] = useState<RegistroDeCicloApi | null>(null);
  const [desligar, setDesligar] = useState(false);
  const [apagarTudo, setApagarTudo] = useState(false);
  const [duracao, setDuracao] = useState<number | null>(config.duracaoHabitual);
  const textoFase = leitura.fase ? textos?.[CHAVE[leitura.fase]]?.trim() : '';
  const agir = (pedido: Promise<unknown>, ok: string) => pedido.then(
    () => { avisar(ok, 'sucesso'); aoRecarregar(); },
    (e: unknown) => avisar(textoDoErro(e), 'perigo'),
  );
  // Depois de 15 dias a API recusa o fim de hoje: a aluna informa o fim pela edição do período.
  const podeTerminar = aberto != null && podeTerminarHoje(aberto, config.hoje);
  const comecarOuTerminar = () => {
    if (aberto && !podeTerminar) {
      setEditando(registros.find((r) => r.id === aberto.id) ?? null);
      return;
    }
    if (aberto?.id) {
      void agir(alterarRegistroDeCiclo(aberto.id, aberto.inicio, config.hoje), 'Menstruação registrada.');
      return;
    }
    void agir(gravarRegistroDeCiclo(novoUid(), config.hoje, null), 'Menstruação registrada.');
  };
  return (
    <>
      <Cartao>
        <Texto variante="destaque">{textoDaLeitura(leitura)}</Texto>
        <Texto>{textoDaPrevisao(registros, config, dataParaTela)}</Texto>
        {textoFase ? <TextoFormatado texto={textoFase} /> : null}
        {aberto && !podeTerminar ? <Texto variante="suave">Esta menstruação ainda está sem data de fim. Informe quando terminou.</Texto> : null}
        <Botao rotulo={aberto ? (podeTerminar ? 'Minha menstruação terminou hoje' : 'Informar quando terminou') : 'Minha menstruação começou hoje'}
          aoTocar={comecarOuTerminar} />
        <Botao rotulo="Registrar outra data" tipo="secundario" aoTocar={() => setOutraData(true)} />
      </Cartao>
      <Cartao titulo={rotuloDoMes(mes)}>
        <View style={estilos.mes}>
          <Botao rotulo="Mês anterior" tipo="secundario" aoTocar={() => aoMes(mesSeguinte(mes, -1))} />
          <Botao rotulo="Próximo mês" tipo="secundario" aoTocar={() => aoMes(mesSeguinte(mes, 1))} />
        </View>
        <CalendarioDoCiclo mes={mes} registros={registros} dias={dias} config={config} aoTocarDia={setDia} />
      </Cartao>
      <Botao rotulo="Como estou hoje" tipo="secundario" aoTocar={() => setDia(config.hoje)} />
      <Cartao titulo="Histórico">
        {registros.length === 0 ? <Texto variante="suave">—</Texto> : registros.map((r) => (
          <View key={r.id} style={estilos.linha}>
            <Texto numerico style={estilos.flex}>{dataParaTela(r.inicio)} a {r.fim ? dataParaTela(r.fim) : 'em andamento'}
              {r.fim ? ` · ${diferencaEmDias(r.inicio, r.fim) + 1} dias` : ''}</Texto>
            <Botao rotulo="Editar" tipo="secundario" aoTocar={() => setEditando(r)} />
            <Botao rotulo="Excluir" tipo="secundario" aoTocar={() => setApagar(r)} />
          </View>
        ))}
      </Cartao>
      <Cartao titulo="Configurações" recolhivel recolhido>
        <CampoNumerico rotulo="Duração habitual do ciclo (opcional)" inteiro valor={duracao} aoMudar={setDuracao} sufixo="dias"
          ajuda={AJUDA_MOSTRAR_FASES} />
        <Interruptor rotulo="Mostrar fases estimadas" valor={config.mostrarFases} ajuda={AJUDA_MOSTRAR_FASES}
          aoMudar={(mostrarFases) => void agir(configurarCiclo(config.duracaoHabitual, mostrarFases), 'Configuração salva.')} />
        <Botao rotulo="Salvar duração" tipo="secundario" aoTocar={() => void agir(configurarCiclo(duracao, config.mostrarFases), 'Configuração salva.')} />
        <Botao rotulo="Desligar acompanhamento" tipo="secundario" aoTocar={() => setDesligar(true)} />
        <Botao rotulo="Apagar todos os registros" tipo="perigo" aoTocar={() => setApagarTudo(true)} />
      </Cartao>
      {outraData || editando ? (
        <FolhaRegistro
          registro={editando}
          aoFechar={() => { setOutraData(false); setEditando(null); }}
          aoSalvar={(inicio, fim, id) => {
            const pedido = id ? alterarRegistroDeCiclo(id, inicio, fim) : gravarRegistroDeCiclo(novoUid(), inicio, fim);
            pedido.then(
              () => { setOutraData(false); setEditando(null); avisar('Ciclo registrado.', 'sucesso'); aoRecarregar(); },
              (e: unknown) => avisar(textoDoErro(e), 'perigo'),
            );
          }}
        />
      ) : null}
      {dia ? (
        <FolhaDoDia data={dia} dia={dias.find((d) => d.data === dia) ?? null} aoFechar={() => setDia(null)}
          aoSalvar={() => { setDia(null); aoRecarregar(); }} avisar={avisar} />
      ) : null}
      <PainelConfirmacao visivel={apagar !== null} titulo="Excluir este ciclo?" rotuloConfirmar="Excluir" perigo
        aoCancelar={() => setApagar(null)} aoConfirmar={() => { const id = apagar?.id; setApagar(null); if (id) void agir(apagarRegistroDeCiclo(id), 'Ciclo excluído.'); }} />
      <PainelConfirmacao visivel={desligar} titulo="Desligar o acompanhamento?" mensagem="Os registros deixam de aparecer para o treinador. Eles continuam guardados até você apagar."
        rotuloConfirmar="Desligar" aoCancelar={() => setDesligar(false)}
        aoConfirmar={() => { setDesligar(false); void agir(desativarCiclo(), 'Acompanhamento desligado.'); }} />
      <PainelConfirmacao visivel={apagarTudo} titulo="Apagar todos os registros?" mensagem="Datas, sintomas e o acompanhamento saem. Esta ação não volta."
        rotuloConfirmar="Apagar tudo" perigo aoCancelar={() => setApagarTudo(false)}
        aoConfirmar={() => { setApagarTudo(false); void agir(apagarCiclo(), 'Registros apagados.'); }} />
    </>
  );
}

function FolhaRegistro({ registro, aoFechar, aoSalvar }: {
  registro: RegistroDeCicloApi | null;
  aoFechar: () => void;
  aoSalvar: (inicio: string, fim: string | null, id: string | null) => void;
}) {
  const [inicio, setInicio] = useState(registro ? dataParaTela(registro.inicio) : '');
  const [fim, setFim] = useState(registro?.fim ? dataParaTela(registro.fim) : '');
  const ini = dataDaTela(inicio);
  const fi = fim.trim() ? dataDaTela(fim) ?? null : null;
  return (
    <Folha visivel titulo={registro ? 'Editar ciclo' : 'Registrar outra data'} aoFechar={aoFechar}
      rodape={<Botao rotulo="Salvar" desabilitado={!ini || (fim.trim() !== '' && !fi)} aoTocar={() => ini && aoSalvar(ini, fi, registro?.id ?? null)} />}>
      <CampoData rotulo="Início" valor={inicio} aoMudar={setInicio} />
      <CampoData rotulo="Fim (opcional)" valor={fim} aoMudar={setFim} />
    </Folha>
  );
}

function FolhaDoDia({ data, dia, aoFechar, aoSalvar, avisar }: {
  data: string;
  dia: DiaDeCicloApi | null;
  aoFechar: () => void;
  aoSalvar: () => void;
  avisar: (texto: string, tipo: 'sucesso' | 'perigo') => void;
}) {
  const { cores } = useTema();
  const [fluxo, setFluxo] = useState(dia?.fluxo ?? '');
  const [colica, setColica] = useState(dia?.colica ?? '');
  const [sintomas, setSintomas] = useState<Set<string>>(new Set(dia?.sintomas ?? []));
  const [observacao, setObservacao] = useState(dia?.observacao ?? '');
  const [limpar, setLimpar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const salvar = () => {
    setOcupado(true);
    gravarDiaDeCiclo(data, {
      id: dia?.id ?? novoUid(),
      fluxo: fluxo || null,
      colica: colica || null,
      sintomas: [...sintomas],
      observacao: observacao.trim() || null,
    }).then(
      () => { setOcupado(false); avisar('Dia salvo.', 'sucesso'); aoSalvar(); },
      (e: unknown) => { setOcupado(false); avisar(textoDoErro(e), 'perigo'); },
    );
  };
  return (
    <Folha visivel titulo={dataParaTela(data)} aoFechar={aoFechar}
      rodape={<Botao rotulo="Salvar" carregando={ocupado} aoTocar={salvar} />}>
      <Escolha rotulo="Fluxo" valor={fluxo} limpavel aoMudar={(v) => setFluxo(v ?? '')} opcoes={FLUXOS} />
      <Escolha rotulo="Cólica" valor={colica} limpavel aoMudar={(v) => setColica(v ?? '')} opcoes={COLICAS} />
      <Texto variante="rotulo">Sintomas</Texto>
      <View style={estilos.chips}>
        {SINTOMAS.map((s) => {
          const ativo = sintomas.has(s);
          return (
            <Pressable key={s} accessibilityRole="button" accessibilityState={{ selected: ativo }} accessibilityLabel={ROTULO_DO_SINTOMA[s]}
              onPress={() => setSintomas((atual) => {
                const proximo = new Set(atual);
                if (proximo.has(s)) proximo.delete(s); else proximo.add(s);
                return proximo;
              })}
              style={[estilos.chip, { backgroundColor: ativo ? cores.texto : cores.superficie2, minHeight: ALVO_TOQUE }]}>
              <Texto style={{ color: ativo ? cores.fundo : cores.texto }}>{ROTULO_DO_SINTOMA[s]}</Texto>
            </Pressable>
          );
        })}
      </View>
      <Campo rotulo="Observação (opcional)" valor={observacao} aoMudar={setObservacao} maxLength={300} linhas={3} />
      <Texto variante="pequeno" numerico>{observacao.length}/300</Texto>
      {dia ? <Botao rotulo="Limpar dia" tipo="perigo" aoTocar={() => setLimpar(true)} /> : null}
      <PainelConfirmacao visivel={limpar} titulo="Limpar este dia?" rotuloConfirmar="Limpar" perigo
        aoCancelar={() => setLimpar(false)}
        aoConfirmar={() => { setLimpar(false); apagarDiaDeCiclo(data).then(() => { avisar('Dia limpo.', 'sucesso'); aoSalvar(); }, (e: unknown) => avisar(textoDoErro(e), 'perigo')); }} />
    </Folha>
  );
}

const estilos = StyleSheet.create({
  mes: { flexDirection: 'row', gap: espaco(1), flexWrap: 'wrap' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco(1), flexWrap: 'wrap' },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco(1) },
  chip: { paddingHorizontal: espaco(1.5), borderRadius: 8, justifyContent: 'center' },
});
