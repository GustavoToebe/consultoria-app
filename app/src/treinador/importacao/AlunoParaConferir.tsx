import { Merge } from 'lucide-react-native';
import { useState, type ReactNode, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';

import { mascaraTelefone } from '../../dominio/cadastroDoAluno';
import { normalizarDieta } from '../../dominio/dieta';
import { normalizarTreino } from '../../dominio/editorTreino';
import { dataParaTela, numeroParaTela, SEM_DADO } from '../../dominio/formatos';
import {
  avisoDoNome,
  cadastroDoGrupo,
  errosDoCadastro,
  MOTIVO_DO_NOME_TRAVADO,
  nomeNoCampo,
  nomeTravado,
  linhasDoGrupo,
  motivoDoErroDoGrupo,
  mudancasDoCadastro,
  opcoesDoDestino,
  precisaEscolherAluno,
  seloDoGrupo,
  tituloDoGrupoResumido,
  valorDoDestino,
  type CadastroEditavel,
  type ValorDoDestino,
} from '../../dominio/importacaoAssistida';
import type { GrupoImportavel } from '../../servicos/importacaoAssistida';
import { useTema } from '../../tema/TemaProvider';
import { espaco, RAIO } from '../../tema/tokens';
import { Botao } from '../../ui/Botao';
import { CaixaSelecao } from '../../ui/CaixaSelecao';
import { Campo } from '../../ui/Campo';
import { Escolha } from '../../ui/Escolha';
import { Alerta } from '../../ui/Estados';
import { LinhaDeAcoes } from '../../ui/LinhaDeAcoes';
import { SecaoRecolhivel } from '../../ui/SecaoRecolhivel';
import { Selo } from '../../ui/Selo';
import { Texto } from '../../ui/Texto';
import { FolhaVerComoAluno, type PreviaDoPlano } from '../plano/FolhaVerComoAluno';
import type { Focavel } from './useFocoAoEntrar';
import { Dieta, Treino } from './planilhaCompleta/EtapaDaAmostra';

type Pode = (codigo: string) => boolean;

/** Aluno gravado ou ignorado no fim: uma linha com o selo, sem ações. */
export function LinhaResumida({ grupo }: { grupo: GrupoImportavel }) {
  const { cores } = useTema();
  const selo = seloDoGrupo(grupo.estado);
  return (
    <View style={[estilos.resumida, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
      <View style={estilos.cabecalho}>
        <Texto style={estilos.encolher}>{tituloDoGrupoResumido(grupo)}</Texto>
        <Selo texto={selo.texto} tipo={selo.tipo} />
      </View>
    </View>
  );
}

/**
 * Aluno ainda não gravado (também o que deu erro na gravação, 2.3, com o motivo no topo): o resumo do que foi lido, o
 * "O que foi lido" recolhível (treino e dieta só leitura, 2.2), o cadastro que dá para corrigir, "Juntar com…" quando
 * pode ser o mesmo aluno de outro arquivo, o destino e a caixa da gravação. O cadastro editado fica aqui até salvar.
 */
export function AlunoParaConferir({ grupo, numero, pode, conferidos, selecionado, aoSelecionar, aoMudarDestino, aoSalvarCadastro, aoJuntar, partes, aoJuntarPartes, juntandoPartes, ocupado, salvando, juntando, erro, refDoDestino }: {
  grupo: GrupoImportavel;
  /** Posição na lista: identifica a prévia do "Ver como o aluno". */
  numero: number;
  pode: Pode;
  conferidos: ReadonlySet<string>;
  selecionado: boolean;
  aoSelecionar?: (marcado: boolean) => void;
  aoMudarDestino: (valor: ValorDoDestino | null) => void;
  /** `true` = gravado na sessão. */
  aoSalvarCadastro: (mudancas: Partial<CadastroEditavel>) => Promise<boolean>;
  aoJuntar: (comGrupoId: string) => void;
  /** Só na primeira parte de um arquivo sem nome lido: as outras partes, para o "Juntar as N partes". */
  partes?: string[];
  aoJuntarPartes?: () => void;
  juntandoPartes?: boolean;
  /** Outra ação em andamento: os botões daqui esperam. */
  ocupado: boolean;
  salvando: boolean;
  juntando: string | null;
  /** Erro da última ação neste aluno (destino, cadastro, juntar), perto dela. */
  erro?: ReactNode;
  /** Só no aluno parecido que recebe o foco ao entrar na tela (T-206). */
  refDoDestino?: Ref<Focavel | null>;
}) {
  const { cores } = useTema();
  const selo = seloDoGrupo(grupo.estado);
  const lido = { ...cadastroDoGrupo(grupo), nome: nomeNoCampo(grupo) };
  const aviso = avisoDoNome(grupo);
  const travado = nomeTravado(grupo);
  const [editado, setEditado] = useState<CadastroEditavel | null>(null);
  const [tentou, setTentou] = useState(false);
  const [previa, setPrevia] = useState<PreviaDoPlano | null>(null);
  const valores = editado ?? lido;
  const mudancas = editado ? mudancasDoCadastro(lido, editado) : null;
  const erros = tentou ? errosDoCadastro(valores) : {};
  const editaCadastro = grupo.destino === 'CRIAR_ALUNO' || grupo.destino === 'VINCULAR_EXISTENTE';
  const nome = grupo.nomeDetectado || 'Aluno do arquivo';
  const parceiros = grupo.possivelMesmoAluno ? grupo.possiveisParceiros ?? [] : [];

  const mudar = (campo: keyof CadastroEditavel, texto: string) => setEditado({ ...valores, [campo]: texto });
  const salvar = async () => {
    setTentou(true);
    if (!mudancas || Object.keys(errosDoCadastro(valores)).length) return;
    if (await aoSalvarCadastro(mudancas)) {
      setEditado(null);
      setTentou(false);
    }
  };

  const treino = pode('TREINO_LER') && grupo.treino ? normalizarTreino(grupo.treino) : null;
  const dieta = pode('DIETA_LER') && grupo.dieta ? normalizarDieta(grupo.dieta) : null;
  const pesos = pode('ALUNO_SENSIVEL_LER') ? grupo.pesos ?? [] : [];

  return (
    <View style={[estilos.item, { backgroundColor: cores.superficie2, borderColor: cores.divisor }]}>
      <View style={estilos.cabecalho}>
        <Texto variante="bloco" nivel={3} style={estilos.encolher}>{nome}</Texto>
        <Selo texto={selo.texto} tipo={selo.tipo} />
      </View>
      {grupo.estado === 'ERRO' ? <Alerta tom="perigo" texto={`Não foi gravado: ${motivoDoErroDoGrupo(grupo.erroCodigo)}`} /> : null}
      {aviso ? <Alerta tom="atencao" texto={aviso.texto ? `${aviso.titulo}. ${aviso.texto}` : `${aviso.titulo}.`} /> : null}
      {partes?.length && aoJuntarPartes ? (
        <View style={estilos.lista}>
          <Texto variante="suave">{`Este arquivo foi lido em ${partes.length + 1} partes sem o nome do aluno. Se for um aluno só, junte as partes: as divisões e refeições de todas ficam neste.`}</Texto>
          <LinhaDeAcoes>
            <Botao rotulo={`Juntar as ${partes.length + 1} partes`} tipo="secundario" Icone={Merge} carregando={juntandoPartes}
              desabilitado={ocupado && !juntandoPartes} motivo="Aguarde a ação em andamento terminar." aoTocar={aoJuntarPartes} />
          </LinhaDeAcoes>
        </View>
      ) : null}

      <Texto variante="suave">Origem: {grupo.arquivosOrigem.join(', ') || SEM_DADO}</Texto>
      <View style={estilos.lista}>
        {linhasDoGrupo(grupo, pode).map((l) => <Texto key={l.rotulo} numerico>{l.rotulo}: {l.valor}</Texto>)}
      </View>

      {treino || dieta || pesos.length ? (
        <SecaoRecolhivel titulo="O que foi lido" nivel={4}>
          <View style={estilos.lista}>
            {pesos.length ? (
              <View style={estilos.bloco}>
                <Texto variante="bloco">Pesos</Texto>
                <View role="list" aria-label={`Pesos de ${nome}`}>
                  {pesos.map((p, i) => (
                    <Texto key={`${i}-${p.data}`} role="listitem" numerico>
                      {`${p.data ? dataParaTela(p.data) : 'Sem data'} · ${numeroParaTela(Number(p.kg), 1)} kg`}
                    </Texto>
                  ))}
                </View>
              </View>
            ) : null}
            {treino ? <View style={estilos.bloco}><Texto variante="bloco">Treino</Texto><Treino treino={treino} nome={nome} numero={numero} aoVer={setPrevia} /></View> : null}
            {dieta ? <View style={estilos.bloco}><Texto variante="bloco">Dieta</Texto><Dieta dieta={dieta} nome={nome} numero={numero} aoVer={setPrevia} /></View> : null}
          </View>
        </SecaoRecolhivel>
      ) : null}

      {editaCadastro ? (
        <View style={estilos.lista}>
          <View style={estilos.grade}>
            <View style={estilos.campo}>
              <Campo rotulo="Nome" valor={valores.nome} aoMudar={(t) => mudar('nome', t)} erro={erros.nome} rotuloAcessivel={`Nome de ${nome}`} autoCapitalize="words" />
            </View>
            <View style={estilos.campo}>
              <Campo rotulo="E-mail (opcional)" valor={valores.email} aoMudar={(t) => mudar('email', t)} erro={erros.email} rotuloAcessivel={`E-mail de ${nome}`}
                keyboardType="email-address" autoCapitalize="none" autoComplete="off" spellCheck={false} />
            </View>
            <View style={estilos.campo}>
              <Campo rotulo="WhatsApp (opcional)" valor={valores.telefone} aoMudar={(t) => mudar('telefone', mascaraTelefone(t))} erro={erros.telefone}
                rotuloAcessivel={`WhatsApp de ${nome}`} keyboardType="phone-pad" />
            </View>
          </View>
          {travado && grupo.origemDoNome === 'NOME_DO_ARQUIVO' && !mudancas ? (
            <LinhaDeAcoes>
              <Botao rotulo="Usar este nome" rotuloAcessivel={`Usar ${valores.nome} como nome do aluno`} tipo="secundario" carregando={salvando}
                desabilitado={ocupado && !salvando} motivo="Aguarde a ação em andamento terminar." aoTocar={() => void aoSalvarCadastro({ nome: valores.nome })} />
            </LinhaDeAcoes>
          ) : null}
          {mudancas ? (
            <LinhaDeAcoes>
              <Botao rotulo="Salvar cadastro" rotuloAcessivel={`Salvar o cadastro de ${nome}`} tipo="secundario" carregando={salvando}
                desabilitado={ocupado && !salvando} motivo="Aguarde a ação em andamento terminar." aoTocar={() => void salvar()} />
              <Botao rotulo="Desfazer" rotuloAcessivel={`Desfazer as mudanças no cadastro de ${nome}`} tipo="fantasma" desabilitado={salvando}
                motivo="Salvando o cadastro…" aoTocar={() => { setEditado(null); setTentou(false); }} />
            </LinhaDeAcoes>
          ) : null}
        </View>
      ) : null}

      {(grupo.avisos ?? []).map((aviso) => <Alerta key={aviso} tom="atencao" texto={aviso} />)}

      {parceiros.length ? (
        <View style={estilos.lista}>
          <Alerta tom="atencao" texto="Pode ser o mesmo aluno de outro arquivo, com dados diferentes. Se for a mesma pessoa, junte os dois." />
          <LinhaDeAcoes>
            {parceiros.map((p) => (
              <Botao key={p.grupoId} rotulo={`Juntar com ${p.nome}`} rotuloAcessivel={`Juntar ${nome} com ${p.nome}`} tipo="secundario" Icone={Merge}
                carregando={juntando === p.grupoId} desabilitado={ocupado && juntando !== p.grupoId} motivo="Aguarde a ação em andamento terminar."
                aoTocar={() => aoJuntar(p.grupoId)} />
            ))}
          </LinhaDeAcoes>
        </View>
      ) : null}

      {precisaEscolherAluno(grupo, conferidos) ? (
        <Alerta tom="atencao" texto="Já existe aluno cadastrado parecido com este. Escolha se é a mesma pessoa ou crie um aluno novo." />
      ) : null}

      <Escolha<ValorDoDestino | null>
        ref={refDoDestino}
        rotulo="Destino"
        valor={valorDoDestino(grupo, conferidos)}
        aoMudar={aoMudarDestino}
        opcoes={opcoesDoDestino(grupo, pode)}
      />
      {erro}

      {aoSelecionar ? (
        <CaixaSelecao rotulo="Incluir na gravação" marcado={selecionado && !travado} aoMudar={aoSelecionar} desabilitado={travado}
          ajuda={travado ? MOTIVO_DO_NOME_TRAVADO : undefined} />
      ) : null}
      {previa ? <FolhaVerComoAluno previa={previa} aoFechar={() => setPrevia(null)} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco(1) },
  bloco: { gap: espaco(0.5) },
  item: { borderWidth: 1, borderRadius: RAIO, padding: espaco(2), gap: espaco(2) },
  resumida: { borderWidth: 1, borderRadius: RAIO, paddingVertical: espaco(1.5), paddingHorizontal: espaco(2), gap: espaco(0.5) },
  cabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: espaco(1) },
  encolher: { flex: 1, minWidth: 0 },
  grade: { flexDirection: 'row', flexWrap: 'wrap', columnGap: espaco(2), rowGap: espaco(1.5) },
  campo: { flexGrow: 1, flexBasis: 220, minWidth: 0 },
});
