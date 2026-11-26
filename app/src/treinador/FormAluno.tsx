import { useSessao } from '../sessao/SessaoProvider';
import { useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import type { AlunoDetalhe, AlunoRequest } from '../api/tipos';
import { responsaveisEquipe } from '../api/rotas';
import {
  CAMPOS_DO_ENDERECO, CPF_EM_USO, ENDERECO_VAZIO, MENSAGEM_CPF_EM_USO, enderecoParaEnvio, enderecoParaForm, erroDoCpf, erroDoTelefone, errosDoEndereco,
  mascaraCpf, mascaraTelefone, nascimentoParaEnvio, SECOES_DO_ALUNO,
} from '../dominio/cadastroDoAluno';
import type { MedidaDaColuna } from '../dominio/colunasDaFicha';
import { dataParaTela } from '../dominio/formatos';
import { CamposDeEndereco } from '../ui/CamposDeEndereco';
import { Escolha } from '../ui/Escolha';
import { useCarregar } from '../ui/useCarregar';
import {
  erroDaRedeDigitada, redesAdicionadas, redesDoAlunoParaEnvio, REDES_SOCIAIS_DO_ALUNO, valoresDasRedesDoAluno, type RedeSocialDoAluno, type ValoresDasRedes,
} from '../dominio/redesSociais';
import { OPCOES_DE_SEXO, sexoDoCampo } from '../dominio/sexo';
import { metaParaEnvio, OPCOES_DA_META_DO_ALUNO, opcaoDaMeta, type OpcaoDaMeta } from '../dominio/metaDoPesoNaFicha';
import { useTema } from '../tema/TemaProvider';
import { espaco, LARGURA_MENU_LATERAL } from '../tema/tokens';
import { Botao } from '../ui/Botao';
import { Cartao } from '../ui/Cartao';
import { EscolhaEmFolha } from '../ui/EscolhaEmFolha';
import { RodapeDeAcoes } from '../ui/LinhaDeAcoes';
import { Campo } from '../ui/Campo';
import { CampoData } from '../ui/Campos';
import { MensagemErro } from '../ui/Estados';
import { codigoApi, errosPorCampo, textoDoErro } from '../ui/erros';
import { RedesSociais } from '../ui/RedesSociais';
import { Texto } from '../ui/Texto';
import { useAvisoDoPlano } from '../ui/useAvisoDoPlano';
import { useGuardaDeSaida } from '../ui/GuardaDeSaida';

interface Props {
  inicial?: AlunoDetalhe;
  rotuloSalvar: string;
  aoSalvar: (dados: AlunoRequest) => Promise<void>;
  aoCancelar?: () => void;
  /** Ciclo padrão da consultoria: aparece na ajuda do campo ("Padrão: 30 dias."), para o vazio não parecer "sem prazo". */
  diasPadrao?: number | null;
  /** Controle extra na seção "Configuração do acompanhamento", depois do responsável (na ficha, o questionário, que grava na hora). */
  noAcompanhamento?: ReactNode;
  /** Nível dos títulos das seções: 2 no Novo aluno (logo abaixo do h1), 3 na ficha (abaixo de "Dados do aluno"). */
  nivel?: 2 | 3;
  /**
   * As duas colunas na medida das da leitura (ficha em colunas, `colunasDoFormulario`): lado a lado, sem quebrar, com o vão no
   * mesmo x. Sem ela (Novo aluno, faixa compacta), as colunas dividem a largura e descem quando não cabem.
   */
  colunas?: readonly [MedidaDaColuna, MedidaDaColuna];
}

/** Texto do campo em número de 1 a 365; vazio = sem prazo (undefined → null no envio) e inválido = null. */
/** Objetivo e observações são dados sensíveis (LGPD): a nota é a mesma nos dois campos. */
const SENSIVEL = 'Dado sensível: só membros com permissão de dados sensíveis veem.';

/** O cartão próprio das redes do aluno (26/11), logo abaixo do Contato, aqui e na leitura (`DadosDoAluno`). */
export const TITULO_DAS_REDES = 'Redes sociais';

function diasDoCampo(texto: string): number | null {
  const n = Number(texto.trim());
  return Number.isInteger(n) && n >= 1 && n <= 365 ? n : null;
}

/**
 * Dados do aluno nas quatro seções da ficha (`SECOES_DO_ALUNO`, a mesma ordem da leitura): Identificação (nome,
 * nascimento, sexo, CPF), Contato e endereço (com o cartão "Redes sociais" logo abaixo, `ui/RedesSociais` em edição, 26/11), Configuração do acompanhamento (responsável, questionário na ficha, dias) e
 * Objetivo e observações (objetivo, meta, observações). CPF, endereço e a seção 4 inteira só com permissão de alterar
 * dado sensível; seção sem campo não aparece. O e-mail é opcional (o aluno escolhe o dele ao aceitar o convite).
 * Objetivo, observações, CPF e endereço são dado sensível: ficam só no banco, nunca em log.
 */
export function FormAluno({ inicial, rotuloSalvar, aoSalvar, aoCancelar, diasPadrao = null, noAcompanhamento, nivel = 2, colunas }: Props) {
  const {pode,usuario}=useSessao();
  const { cores } = useTema();
  const { width } = useWindowDimensions();
  // Na edição, vazio continua vazio: salvar sem mexer não grava quem está editando. No aluno novo, começa com quem cadastra.
  const [responsavelId,setResponsavelId]=useState(inicial ? (inicial.responsavelId ?? '') : (usuario?.id ?? ''));
  const {dados:responsaveis,erro:erroResponsaveis,recarregar}=useCarregar('responsaveis-form',()=>responsaveisEquipe());
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [sexo, setSexo] = useState(inicial?.sexo ?? '');
  const [nascimento, setNascimento] = useState(dataParaTela(inicial?.dataNascimento ?? null));
  const [email, setEmail] = useState(inicial?.email ?? '');
  const [telefone, setTelefone] = useState(inicial?.telefone ?? '');
  // As seis redes (26/11): só as que têm valor abrem adicionadas (Instagram e TikTok com o `@`); as iniciais ficam como abriram,
  // para o envio mandar só o que mudou.
  const [redes, setRedes] = useState<ValoresDasRedes<RedeSocialDoAluno>>(() => valoresDasRedesDoAluno(inicial ?? {}));
  const [redesIniciais] = useState(redes);
  const [objetivo, setObjetivo] = useState(inicial?.objetivo ?? '');
  const [cpf, setCpf] = useState(inicial?.cpf ?? '');
  const [endereco, setEndereco] = useState(() => (inicial ? enderecoParaForm(inicial.endereco) : ENDERECO_VAZIO));
  const [observacoes, setObservacoes] = useState(inicial?.observacoes ?? '');
  const [meta, setMeta] = useState<OpcaoDaMeta>(opcaoDaMeta(inicial?.metaDoPeso));
  const [dias, setDias] = useState(inicial?.diasAtualizacao ? String(inicial.diasAtualizacao) : '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<unknown>(null);
  const avisarDoPlano = useAvisoDoPlano();
  const campos = errosPorCampo(erro);
  const diasInvalidos = dias.trim() !== '' && diasDoCampo(dias) === null;
  // Sem acesso, o telefone fica no cadastro e passa ao usuário quando o aluno entrar; CPF e endereço seguem a permissão de dados sensíveis.
  const comTelefone = !inicial?.anonimizado;
  const comSensivel = pode('ALUNO_SENSIVEL_ALTERAR');
  // Só com a leitura também: sem ela a meta lida não vem e o campo abriria em "Padrão" por engano.
  const comMeta = comSensivel && pode('ALUNO_SENSIVEL_LER');
  const erroTelefone = comTelefone ? erroDoTelefone(telefone) : undefined;
  // O erro local vence o da API (422 `ALUNO_INVALIDO` no campo da rede), que vale até o próximo Salvar, como nos outros campos.
  const adicionadas = comTelefone ? redesAdicionadas(redes, REDES_SOCIAIS_DO_ALUNO) : [];
  const redeComErroLocal = adicionadas.some((r) => erroDaRedeDigitada(r, redes[r] ?? ''));
  const errosRedes = Object.fromEntries(adicionadas.map((r) => [r, erroDaRedeDigitada(r, redes[r] ?? '') ?? campos[r]]));
  const erroCpf = comSensivel ? erroDoCpf(cpf) : undefined;
  const errosEndereco = comSensivel ? errosDoEndereco(endereco) : {};
  const nascimentoEnvio = nascimentoParaEnvio(nascimento, !!inicial?.dataNascimento);
  // O campo de data já avisa a data impossível ou fora da faixa; a incompleta é avisada aqui, para o botão não travar sem motivo à vista.
  const nascimentoIncompleto = nascimento.trim().length > 0 && nascimento.trim().length < 10;
  const dadosInvalidos = !!erroTelefone || redeComErroLocal || !!erroCpf || Object.keys(errosEndereco).length > 0 || nascimentoEnvio === undefined;
  const cpfEmUso = codigoApi(erro) === CPF_EM_USO ? MENSAGEM_CPF_EM_USO : undefined;
  // C7: qualquer campo diferente do que abriu deixa a saída guardada ("Sair sem salvar?"). O retrato é o da primeira
  // renderização; o questionário da ficha grava na hora e não entra. Quem salva e sai usa `useSairSemPerguntar`.
  // As redes pelo valor de cada uma (rede vazia = sem rede): remover e adicionar de novo, ou adicionar sem escrever, não muda nada.
  const retrato = JSON.stringify([nome, sexo, nascimento, email, telefone, REDES_SOCIAIS_DO_ALUNO.map((r) => (redes[r] ?? '').trim()), objetivo, cpf, endereco, observacoes, meta, dias, responsavelId]);
  const [retratoInicial] = useState(retrato);
  useGuardaDeSaida(retrato !== retratoInicial);

  const salvar = () => {
    if (!nome.trim() || diasInvalidos || dadosInvalidos) {
      setErro(null);
      return;
    }
    setSalvando(true);
    setErro(null);
    aoSalvar({
      nome: nome.trim(),
      email: email.trim() || null,
      ...(comTelefone ? { telefone: telefone.trim() ? mascaraTelefone(telefone) : '' } : {}),
      // Só o que mudou (ausente não mexe; removida ou em branco apaga); no cadastro novo, só o preenchido.
      ...(comTelefone ? redesDoAlunoParaEnvio(redes, redesIniciais, !!inicial) : {}),
      ...(comSensivel ? {
        objetivo: objetivo.trim() || null, observacoes: observacoes.trim() || null,
        cpf: cpf.trim() ? mascaraCpf(cpf) : null, endereco: enderecoParaEnvio(endereco),
      } : {}),
      // Na edição vai sempre o escolhido ("Padrão" = PADRAO_DA_CONSULTORIA); no cadastro novo, "Padrão" não vai (nasce nulo).
      ...(comMeta && (inicial || meta !== 'PADRAO') ? { metaDoPeso: metaParaEnvio(meta) } : {}),
      versao: inicial?.versao ?? null,
      sexo: sexoDoCampo(sexo),
      dataNascimento: nascimentoEnvio ?? null,
      diasAtualizacao: diasDoCampo(dias),
      responsavelId:responsavelId||null,
    }).then(
      () => setSalvando(false),
      (e: unknown) => {
        setSalvando(false);
        // Limite do plano: o aviso explica (com "Ver assinatura e faturas") e o formulário fica como está, sem erro de campo.
        if (!avisarDoPlano(e)) setErro(e);
      },
    );
  };

  const motivo = !nome.trim() ? 'Informe o nome do aluno.' : diasInvalidos ? 'Os dias de atualização vão de 1 a 365.' : 'Corrija os campos marcados.';
  // Duas colunas (1 e 2 à esquerda, 3 e 4 à direita) que descem uma embaixo da outra quando não cabem, pelo `flexWrap`, ou
  // nas medidas da leitura (`colunas`): a ordem de leitura e de foco é 1, 2, 3, 4 em qualquer largura, e mudar a janela
  // não remonta nenhum campo (só o estilo muda).
  const coluna = (i: 0 | 1) => (colunas ? [estilos.colunaMedida, 'largura' in colunas[i] ? { width: colunas[i].largura } : { flex: colunas[i].flex }] : estilos.coluna);
  return (
    <View style={estilos.form}>
      <View style={colunas ? estilos.colunasMedidas : estilos.colunas}>
        <View style={coluna(0)}>
          <Cartao titulo={SECOES_DO_ALUNO.identificacao} nivel={nivel}>
            <View style={estilos.linha}>
              <View style={estilos.inteiro}>
                <Campo rotulo="Nome" valor={nome} aoMudar={setNome} erro={campos.nome} autoComplete="off" maxLength={120} />
              </View>
              <View style={[estilos.curto, estilos.comAjuda]}>
                <CampoData rotulo="Data de nascimento (opcional)" nome="Data de nascimento" regra="REGISTRO" valor={nascimento} aoMudar={setNascimento}
                  erro={campos.dataNascimento ?? (nascimentoIncompleto ? 'Complete a data: DD/MM/AAAA.' : null)} />
                <Texto variante="pequeno">Ajuda a definir o perfil do aluno na comunidade. Só a equipe vê.</Texto>
              </View>
              <View style={estilos.conteudo}>
                <Escolha rotulo="Sexo" valor={sexo} aoMudar={setSexo} opcoes={[{ valor: '', rotulo: 'Não informado' }, ...OPCOES_DE_SEXO]} />
              </View>
              {comSensivel ? (
                <View style={estilos.curto}>
                  <Campo rotulo="CPF (opcional)" valor={cpf} aoMudar={(t) => setCpf(mascaraCpf(t))} erro={erroCpf ?? cpfEmUso ?? campos.cpf} keyboardType="number-pad"
                    inputMode="numeric" maxLength={14} ajuda={SENSIVEL} />
                </View>
              ) : null}
            </View>
          </Cartao>
          <Cartao titulo={SECOES_DO_ALUNO.contato} nivel={nivel}>
            <View style={estilos.linha}>
              <View style={estilos.medio}>
                <Campo rotulo="E-mail (opcional)" valor={email} aoMudar={setEmail} erro={campos.email} keyboardType="email-address" autoCapitalize="none"
                  autoComplete="off" maxLength={254} />
              </View>
              {comTelefone ? (
                <View style={estilos.curto}>
                  <Campo rotulo="Telefone (opcional)" valor={telefone} aoMudar={(t) => setTelefone(mascaraTelefone(t))} erro={erroTelefone ?? campos.telefone}
                    keyboardType="phone-pad" autoComplete="tel" maxLength={15} />
                </View>
              ) : null}
            </View>
            {comSensivel ? (
              <View style={estilos.endereco}>
                <CamposDeEndereco valor={endereco} aoMudar={setEndereco}
                  erros={Object.fromEntries(CAMPOS_DO_ENDERECO.map((c) => [c, errosEndereco[c] ?? campos[`endereco.${c}`]]))} />
              </View>
            ) : null}
          </Cartao>
          {/* Logo abaixo do Contato, na mesma coluna, como na leitura: uma linha por rede adicionada e o "Adicionar rede". */}
          {comTelefone ? (
            <Cartao titulo={TITULO_DAS_REDES} nivel={nivel}>
              <View style={estilos.redes}>
                <RedesSociais modo="edicao" redesPermitidas={REDES_SOCIAIS_DO_ALUNO} valores={redes} aoMudar={setRedes} erros={errosRedes} />
              </View>
            </Cartao>
          ) : null}
        </View>
        <View style={coluna(1)}>
          <Cartao titulo={SECOES_DO_ALUNO.acompanhamento} nivel={nivel}>
            {responsaveis ? (
              <EscolhaEmFolha rotulo="Treinador responsável" valor={responsavelId} aoMudar={setResponsavelId} rotuloDoValor="Membro inativo"
                opcoes={[{ valor: '', rotulo: 'Sem responsável' }, ...responsaveis.map((r) => ({ valor: r.id, rotulo: r.nome }))]} />
            ) : null}
            {erroResponsaveis ? <MensagemErro texto={textoDoErro(erroResponsaveis)} tentarDeNovo={recarregar} /> : null}
            {noAcompanhamento}
            <View style={estilos.linha}><View style={estilos.curto}>
              <Campo
                numerico
                rotulo="Dias para nova atualização (opcional)"
                valor={dias}
                aoMudar={(t) => setDias(t.replace(/\D/g, '').slice(0, 3))}
                erro={diasInvalidos ? 'Use de 1 a 365 dias.' : campos.diasAtualizacao}
                // O padrão vai na ajuda, embaixo do campo, e não como placeholder: o texto some ao digitar e parece valor preenchido.
                ajuda={`Vazio usa o padrão da consultoria${diasPadrao ? ` (${diasPadrao} dias)` : ''}. Sugere o fim da próxima pasta de plano.`}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={3}
              />
            </View></View>
          </Cartao>
          {comSensivel ? (
            <Cartao titulo={SECOES_DO_ALUNO.objetivo} nivel={nivel}>
              <View style={estilos.linha}><View style={estilos.medio}>
                <Campo rotulo="Objetivo (opcional)" valor={objetivo} aoMudar={setObjetivo} erro={campos.objetivo} maxLength={200} ajuda={SENSIVEL} />
              </View></View>
              {comMeta ? (
                <View style={estilos.meta}>
                  <Escolha rotulo="Meta do peso" valor={meta} aoMudar={setMeta} opcoes={OPCOES_DA_META_DO_ALUNO} />
                  <Texto variante="pequeno">Pinta a variação do peso: verde na direção da meta, vermelho contra. O padrão é o de Marca › Acompanhamento.</Texto>
                </View>
              ) : null}
              <View style={estilos.leitura}>
                <Campo rotulo="Observações (opcional)" valor={observacoes} aoMudar={setObservacoes} erro={campos.observacoes} linhas={4} maxLength={4000} ajuda={SENSIVEL} />
              </View>
            </Cartao>
          ) : null}
        </View>
      </View>
      {/* Barra no fim do formulário, no fluxo (não fixa): nunca cobre o último campo e não disputa o canto com o
          "Voltar ao início" da rolagem. Erro geral à esquerda; no celular em cima, com os botões em coluna. */}
      <View style={[estilos.barra, { borderTopColor: cores.divisor }]}>
        <RodapeDeAcoes empilhar={width < LARGURA_MENU_LATERAL}
          status={erro && Object.keys(campos).length === 0 && !cpfEmUso ? <MensagemErro texto={textoDoErro(erro)} /> : null}>
          {aoCancelar ? <Botao rotulo="Cancelar" tipo="secundario" aoTocar={aoCancelar} /> : null}
          <Botao rotulo={rotuloSalvar} aoTocar={salvar} carregando={salvando} desabilitado={!nome.trim() || diasInvalidos || dadosInvalidos} motivo={motivo} />
        </RodapeDeAcoes>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  form: { gap: espaco(3) },
  // 24 px entre as seções, como as do "Editar alimento"; 420 é o mínimo de uma coluna (cabe o endereço com número e
  // complemento lado a lado): abaixo de ~864 px úteis as colunas descem.
  colunas: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: espaco(3) },
  coluna: { flexGrow: 1, flexShrink: 1, flexBasis: 420, minWidth: 0, gap: espaco(3) },
  // Nas medidas da leitura: o mesmo vão do `ColunasDaFicha` (`espaco(3)`) e sem quebra (a direita estreita não desce).
  colunasMedidas: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco(3) },
  colunaMedida: { minWidth: 0, gap: espaco(3) },
  // Campos de uma seção: largura pelo tamanho da resposta, lado a lado quando cabem, topos alinhados. `medio` e `curto`
  // só valem dentro de uma `linha` (fora dela o `flexBasis` vira altura, no corpo em coluna do cartão).
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: espaco(2) },
  inteiro: { flexBasis: '100%', maxWidth: 560 },
  medio: { flexGrow: 1, flexShrink: 1, flexBasis: 260, minWidth: 0, maxWidth: 420 },
  curto: { flexGrow: 1, flexShrink: 1, flexBasis: 180, minWidth: 0, maxWidth: 240 },
  conteudo: { flexShrink: 1, maxWidth: '100%' },
  comAjuda: { gap: espaco(0.5) },
  endereco: { maxWidth: 560 },
  // A largura do endereço: o campo do @ não estica pela coluna larga.
  redes: { maxWidth: 560 },
  leitura: { maxWidth: 640 },
  meta: { gap: espaco(0.5) },
  barra: { borderTopWidth: 1, paddingTop: espaco(2) },
});
