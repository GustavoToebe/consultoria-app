import type { Href } from 'expo-router';
import { CircleAlert, CircleCheck, Info, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react-native';
import { useState, type ComponentProps, type ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ExemploDoCatalogo } from '../dominio/catalogoDeComponentes';
import type { EnderecoNoForm } from '../dominio/cadastroDoAluno';
import { espaco } from '../tema/tokens';
import { Abas } from '../ui/Abas';
import { AjusteDeCarga } from '../ui/AjusteDeCarga';
import { AnelProgresso } from '../ui/AnelProgresso';
import { useAviso } from '../ui/Aviso';
import { BarraDeFiltros } from '../ui/BarraDeFiltros';
import { BarraProgresso } from '../ui/BarraProgresso';
import { Botao } from '../ui/Botao';
import { BotaoMarcar } from '../ui/BotaoMarcar';
import { CabecalhoDeGrupo } from '../ui/CabecalhoDeGrupo';
import { CaixaSelecao } from '../ui/CaixaSelecao';
import { Campo } from '../ui/Campo';
import { CampoDeCarga } from '../ui/CampoDeCarga';
import { CampoLeitura } from '../ui/CampoLeitura';
import { CampoData, CampoNumerico, CampoNumericoGrande, Interruptor } from '../ui/Campos';
import { CamposDeEndereco } from '../ui/CamposDeEndereco';
import { CamposEmLinha } from '../ui/CamposEmLinha';
import { CampoSenha } from '../ui/CampoSenha';
import { Cartao } from '../ui/Cartao';
import { CodigoQr } from '../ui/CodigoQr';
import { EscalaDeNota } from '../ui/EscalaDeNota';
import { Escolha } from '../ui/Escolha';
import { EscolhaEmFolha } from '../ui/EscolhaEmFolha';
import { EscolhaSuspensa } from '../ui/EscolhaSuspensa';
import { Esqueleto } from '../ui/Esqueleto';
import { Alerta, Bloqueado, Carregando, Incompleto, MensagemErro, ModuloDesligado, SemPermissao, Vazio } from '../ui/Estados';
import { FaixaDeChips } from '../ui/FaixaDeChips';
import { Folha } from '../ui/Folha';
import { IniciaisDePerfil } from '../ui/FotoDePerfil';
import { GradeDeOpcoes } from '../ui/GradeDeOpcoes';
import { GraficoBarras } from '../ui/GraficoBarras';
import { GraficoLinha } from '../ui/GraficoLinha';
import { IconeBotao } from '../ui/IconeBotao';
import { ItemDeLista } from '../ui/ItemDeLista';
import { CaixaDaLinha, LinhaDaLista, ListaDeLinhas } from '../ui/LinhaDaLista';
import { LinhaDeAcoes } from '../ui/LinhaDeAcoes';
import { LinkTexto } from '../ui/LinkTexto';
import { OpcaoCartao } from '../ui/OpcaoCartao';
import { PainelConfirmacao } from '../ui/PainelConfirmacao';
import { SelecaoMultipla } from '../ui/SelecaoMultipla';
import { SelecaoMultiplaSuspensa } from '../ui/SelecaoMultiplaSuspensa';
import { SeletorDeNota } from '../ui/SeletorDeNota';
import { Selo } from '../ui/Selo';
import { Tabela, type ColunaDaTabela } from '../ui/Tabela';
import { Texto } from '../ui/Texto';
import { TextoFormatado } from '../ui/TextoFormatado';

/** Exemplo do catálogo: os dados da busca mais o componente que desenha o estado. */
export interface ExemploComDesenho extends ExemploDoCatalogo {
  Desenho: ComponentType;
}

/** Endereço de volta para a própria aba: link e linha de lista não levam para fora do catálogo. */
const AQUI = '/montador?aba=catalogo' as Href;

// ── Campos de texto ──────────────────────────────────────────────────────────────────────────────────────────────

function CampoDemo({ inicial, ...props }: { inicial: string } & Omit<ComponentProps<typeof Campo>, 'valor' | 'aoMudar'>) {
  const [valor, setValor] = useState(inicial);
  return <Campo {...props} valor={valor} aoMudar={setValor} />;
}

function CampoSenhaDemo() {
  const [valor, setValor] = useState('senha-ficticia');
  return <CampoSenha rotulo="Senha" valor={valor} aoMudar={setValor} autoComplete="off" />;
}

function CampoNumericoGrandeDemo() {
  const [valor, setValor] = useState<number | null>(60);
  return <CampoNumericoGrande rotulo="Peso" valor={valor} aoMudar={setValor} sufixo="kg" ajuda="Sugestão: 60 kg" />;
}

function CampoNumericoDemo() {
  const [valor, setValor] = useState<number | null>(12);
  return <CampoNumerico rotulo="Repetições" valor={valor} aoMudar={setValor} inteiro />;
}

function CampoDeCargaDemo() {
  const [valor, setValor] = useState<number | null>(null);
  return <CampoDeCarga rotulo="Carga de trabalho do dia" valorKg={valor} aoMudarKg={setValor} destaque />;
}

function CampoDataDemo() {
  const [valor, setValor] = useState('15/03/2026');
  return <CampoData rotulo="Início da pasta" valor={valor} aoMudar={setValor} />;
}

const ENDERECO_FICTICIO: EnderecoNoForm = {
  cep: '00000-000',
  logradouro: 'Rua Exemplo',
  numero: '100',
  complemento: 'Sala 2',
  bairro: 'Centro',
  cidade: 'Cidade Fictícia',
  uf: 'PR',
};

function CamposDeEnderecoDemo() {
  const [valor, setValor] = useState(ENDERECO_FICTICIO);
  // Desabilitado: um CEP novo digitado dispararia a busca de CEP da API, e o catálogo não chama a API.
  return <CamposDeEndereco valor={valor} aoMudar={setValor} desabilitado />;
}

function CamposEmLinhaDemo() {
  const [nome, setNome] = useState('Ana');
  const [sobrenome, setSobrenome] = useState('Exemplo');
  return (
    <CamposEmLinha>
      <Campo rotulo="Nome" valor={nome} aoMudar={setNome} />
      <Campo rotulo="Sobrenome" valor={sobrenome} aoMudar={setSobrenome} />
    </CamposEmLinha>
  );
}

// ── Escolhas ─────────────────────────────────────────────────────────────────────────────────────────────────────

const OBJETIVOS = [
  { valor: 'forca', rotulo: 'Força' },
  { valor: 'hipertrofia', rotulo: 'Hipertrofia' },
  { valor: 'condicionamento', rotulo: 'Condicionamento' },
];

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map(
  (m) => ({ valor: m.toLowerCase(), rotulo: m }),
);

function EscolhaDemo({ compacta }: { compacta?: boolean }) {
  const [valor, setValor] = useState('hipertrofia');
  return <Escolha rotulo={compacta ? undefined : 'Objetivo'} descricao="Objetivo" opcoes={OBJETIVOS} valor={valor} aoMudar={setValor} compacta={compacta} />;
}

function EscolhaEmFolhaDemo({ muitas }: { muitas?: boolean }) {
  const opcoes = muitas ? MESES : OBJETIVOS;
  const [valor, setValor] = useState(opcoes[1].valor);
  return <EscolhaEmFolha rotulo={muitas ? 'Mês' : 'Objetivo'} valor={valor} opcoes={opcoes} aoMudar={setValor} />;
}

function EscolhaSuspensaDemo() {
  const [valor, setValor] = useState<string | null>('email');
  return (
    <EscolhaSuspensa<string | null>
      rotulo="Coluna da planilha"
      valor={valor}
      aoMudar={setValor}
      opcoes={[
        { valor: null, rotulo: 'Ignorar coluna' },
        { valor: 'nome', rotulo: 'Nome', detalhe: 'Obrigatório' },
        { valor: 'email', rotulo: 'E-mail' },
        { valor: 'telefone', rotulo: 'Telefone' },
      ]}
    />
  );
}

const SITUACOES = [
  { valor: 'revisar', rotulo: 'Para revisar' },
  { valor: 'atrasada', rotulo: 'Atrasada' },
  { valor: 'em-dia', rotulo: 'Em dia' },
  { valor: 'sem-pasta', rotulo: 'Sem pasta' },
];

function SelecaoMultiplaSuspensaDemo() {
  const [marcados, setMarcados] = useState<Set<string>>(new Set(['revisar', 'atrasada']));
  return <SelecaoMultiplaSuspensa rotulo="Situação" opcoes={SITUACOES} marcados={marcados} aoMudar={setMarcados} />;
}

function SelecaoMultiplaDemo() {
  const [marcados, setMarcados] = useState<Set<string>>(new Set(['em-dia']));
  return <SelecaoMultipla rotulo="Situações" opcoes={SITUACOES} marcados={marcados} aoMudar={setMarcados} />;
}

function InterruptorDemo({ ligado }: { ligado: boolean }) {
  const [valor, setValor] = useState(ligado);
  return <Interruptor rotulo="Avisar no celular" ajuda="Quando um compromisso mudar." valor={valor} aoMudar={setValor} />;
}

function CaixaSelecaoDemo() {
  const [marcado, setMarcado] = useState(true);
  return <CaixaSelecao rotulo="Enviar por e-mail" ajuda="Para ana@exemplo.com" marcado={marcado} aoMudar={setMarcado} />;
}

function BotaoMarcarDemo({ feitoInicial }: { feitoInicial: boolean }) {
  const [feito, setFeito] = useState(feitoInicial);
  return <BotaoMarcar feito={feito} aoTocar={() => setFeito((v) => !v)} rotulo="Série 1 feita" semVibrar />;
}

function CaixaDaLinhaDemo() {
  const [marcado, setMarcado] = useState(false);
  return <CaixaDaLinha rotulo="Selecionar Ana Exemplo" marcado={marcado} aoMudar={() => setMarcado((v) => !v)} />;
}

function FaixaDeChipsDemo() {
  const [valor, setValor] = useState('a');
  const opcoes = ['A', 'B', 'C', 'D', 'E', 'F'].map((l) => ({ valor: l.toLowerCase(), rotulo: `Treino ${l}` }));
  return (
    <FaixaDeChips quebrar>
      <Escolha compacta descricao="Sessão" opcoes={opcoes} valor={valor} aoMudar={setValor} />
    </FaixaDeChips>
  );
}

function SeletorDeNotaDemo() {
  const [valor, setValor] = useState<number | null>(7);
  return <SeletorDeNota rotulo="Disposição na semana" valor={valor} aoMudar={setValor} rotuloMinimo="Nada" rotuloMaximo="Muito" limpavel />;
}

function EscalaDeNotaDemo() {
  const [valor, setValor] = useState<number | null>(null);
  return <EscalaDeNota rotulo="Qualidade do sono" valor={valor} aoMudar={setValor} />;
}

function AjusteDeCargaDemo() {
  const [kg, setKg] = useState(40);
  return (
    <View style={estilos.linha}>
      <Texto variante="subtitulo" numerico>{`${kg.toLocaleString('pt-BR')} kg`}</Texto>
      <AjusteDeCarga passo={2.5} rotulo="carga da série 1" aoAjustar={(s) => setKg((v) => Math.max(0, v + s * 2.5))} />
    </View>
  );
}

function OpcaoCartaoDemo() {
  const [valor, setValor] = useState('claro');
  return (
    <GradeDeOpcoes rotulo="Tema do app">
      <OpcaoCartao titulo="Claro" descricao="Fundo branco" selecionada={valor === 'claro'} aoEscolher={() => setValor('claro')} />
      <OpcaoCartao titulo="Escuro" descricao="Fundo escuro" selecionada={valor === 'escuro'} aoEscolher={() => setValor('escuro')} />
    </GradeDeOpcoes>
  );
}

// ── Botões ───────────────────────────────────────────────────────────────────────────────────────────────────────

function BotaoComAviso({ tipo, rotulo, Icone }: { tipo: 'primario' | 'secundario' | 'perigo' | 'perigoTexto' | 'fantasma'; rotulo: string; Icone?: typeof Plus }) {
  const { avisar } = useAviso();
  return <Botao rotulo={rotulo} tipo={tipo} Icone={Icone} aoTocar={() => avisar(`Tocou em "${rotulo}".`)} />;
}

function BotaoCarregandoDemo() {
  const [carregando, setCarregando] = useState(true);
  return (
    <LinhaDeAcoes>
      <Botao rotulo="Salvar" carregando={carregando} aoTocar={() => undefined} />
      <Botao rotulo={carregando ? 'Parar de carregar' : 'Carregar de novo'} tipo="fantasma" aoTocar={() => setCarregando((v) => !v)} />
    </LinhaDeAcoes>
  );
}

function IconeBotaoDemo() {
  const { avisar } = useAviso();
  return (
    <LinhaDeAcoes>
      <IconeBotao Icone={Pencil} rotulo="Editar" moldura aoTocar={() => avisar('Editar')} />
      <IconeBotao Icone={Trash2} rotulo="Remover" moldura aoTocar={() => avisar('Remover')} />
      <IconeBotao Icone={Plus} rotulo="Adicionar" compacto aoTocar={() => avisar('Adicionar')} />
      <IconeBotao Icone={Pencil} rotulo="Editar (desabilitado)" moldura desabilitado aoTocar={() => undefined} />
    </LinhaDeAcoes>
  );
}

// ── Avisos e estados ─────────────────────────────────────────────────────────────────────────────────────────────

function AvisosDemo() {
  const { avisar } = useAviso();
  return (
    <LinhaDeAcoes>
      <Botao rotulo="Mostrar aviso de sucesso" tipo="secundario" aoTocar={() => avisar('Aluno salvo.', 'sucesso')} />
      <Botao rotulo="Mostrar aviso de atenção" tipo="secundario" aoTocar={() => avisar('Há séries sem carga.', 'atencao')} />
      <Botao rotulo="Mostrar aviso de erro" tipo="secundario" aoTocar={() => avisar('Não foi possível salvar.', 'perigo')} />
      <Botao rotulo="Mostrar aviso neutro" tipo="secundario" aoTocar={() => avisar('Copiado.', 'neutro')} />
      <Botao
        rotulo="Mostrar aviso com ação"
        tipo="secundario"
        aoTocar={() => avisar('Plano copiado para Bruno Fictício.', 'sucesso', { rotulo: 'Abrir ficha', aoTocar: () => undefined })}
      />
    </LinhaDeAcoes>
  );
}

// ── Listas e tabelas ─────────────────────────────────────────────────────────────────────────────────────────────

interface LinhaDeAluno {
  id: string;
  nome: string;
  plano: string;
  registro: string;
}

const ALUNOS: LinhaDeAluno[] = [
  { id: '1', nome: 'Ana Exemplo', plano: 'Hipertrofia A/B', registro: 'Hoje' },
  { id: '2', nome: 'Bruno Fictício', plano: 'Força 3x', registro: 'Há 9 dias' },
  { id: '3', nome: 'Carla Modelo', plano: '', registro: 'Nunca registrou' },
];

const COLUNAS_ALUNOS: ColunaDaTabela<LinhaDeAluno>[] = [
  { chave: 'nome', titulo: 'Aluno', principal: true, flex: 2, render: (l) => <Texto>{l.nome}</Texto> },
  { chave: 'plano', titulo: 'Plano em uso', flex: 2, render: (l) => <Texto>{l.plano || '—'}</Texto> },
  { chave: 'registro', titulo: 'Último registro', render: (l) => <Texto variante="suave">{l.registro}</Texto> },
];

function TabelaDemo({ estreita }: { estreita?: boolean }) {
  return (
    <View style={estreita ? estilos.estreita : null}>
      <Tabela colunas={COLUNAS_ALUNOS} linhas={ALUNOS} chave={(l) => l.id} rotulo="Alunos fictícios" />
    </View>
  );
}

function LinhasComLinkDemo() {
  const { avisar } = useAviso();
  return (
    <ListaDeLinhas>
      <LinhaDaLista
        titulo="Ana Exemplo"
        metadados="Hipertrofia · enviado hoje"
        selos={[{ texto: 'Para revisar', tipo: 'atencao' }]}
        href={AQUI}
        aoAbrir={() => avisar('Abriria a ficha de Ana Exemplo.')}
      />
      <LinhaDaLista
        titulo="Bruno Fictício"
        metadados="Força · 3 dias de atraso"
        selos={[{ texto: 'Atrasada', tipo: 'perigo', Icone: CircleAlert }]}
        href={AQUI}
        aoAbrir={() => avisar('Abriria a ficha de Bruno Fictício.')}
      />
    </ListaDeLinhas>
  );
}

function LinhasComAcoesDemo() {
  const { avisar } = useAviso();
  return (
    <ListaDeLinhas>
      <LinhaDaLista
        titulo="Treino A — Peito e tríceps"
        metadados="6 exercícios · 24 séries"
        descricao="Modelo de exemplo para a semana de adaptação."
        acoes={
          <LinhaDeAcoes>
            <Botao rotulo="Aplicar ao aluno" tipo="secundario" aoTocar={() => avisar('Aplicar ao aluno')} />
            <IconeBotao Icone={Pencil} rotulo="Editar Treino A" moldura aoTocar={() => avisar('Editar')} />
          </LinhaDeAcoes>
        }
      />
    </ListaDeLinhas>
  );
}

function LinhaDeMarcarDemo() {
  const [marcado, setMarcado] = useState(true);
  return (
    <ListaDeLinhas>
      <LinhaDaLista titulo="Carla Modelo" rotulo="Carla Modelo" metadados="Sem plano em uso" marcar={{ marcado, aoMudar: () => setMarcado((v) => !v) }} />
    </ListaDeLinhas>
  );
}

function ItemDeListaDemo() {
  const { avisar } = useAviso();
  return (
    <View style={estilos.pilha}>
      <ItemDeLista titulo="Atualizações" detalhe="3 para revisar" selo={{ texto: '3 novas', tipo: 'atencao' }} href={'/montador' as Href} aoTocar={() => avisar('Abriria Atualizações.')} />
      <ItemDeLista titulo="Sair" perigo aoTocar={() => avisar('Sairia da conta.', 'atencao')} />
    </View>
  );
}

interface FiltrosDemo {
  situacoes: string[];
}

function BarraDeFiltrosDemo() {
  const [busca, setBusca] = useState('');
  const [filtros, setFiltros] = useState<FiltrosDemo>({ situacoes: ['atrasada'] });
  const rotuloDe = (v: string) => SITUACOES.find((s) => s.valor === v)?.rotulo ?? v;
  return (
    <BarraDeFiltros<FiltrosDemo>
      busca={{ valor: busca, aoMudar: setBusca, rotulo: 'Buscar aluno', placeholder: 'Nome do aluno' }}
      valor={filtros}
      aoAplicar={setFiltros}
      limpo={{ situacoes: [] }}
      chips={filtros.situacoes.map((s) => ({ chave: s, texto: `Situação: ${rotuloDe(s)}` }))}
      aoTirar={(chave) => setFiltros((f) => ({ situacoes: f.situacoes.filter((s) => s !== chave) }))}
      seletores={(f, mudar) => (
        <SelecaoMultiplaSuspensa rotulo="Situação" opcoes={SITUACOES} marcados={new Set(f.situacoes)} aoMudar={(m) => mudar({ situacoes: [...m] })} />
      )}
    />
  );
}

// ── Estrutura ────────────────────────────────────────────────────────────────────────────────────────────────────

function AbasDemo() {
  const [aba, setAba] = useState<'revisar' | 'atrasadas' | 'todas'>('revisar');
  return (
    <Abas
      abas={[
        { valor: 'revisar', rotulo: 'Para revisar', contagem: 3 },
        { valor: 'atrasadas', rotulo: 'Atrasadas', contagem: 1 },
        { valor: 'todas', rotulo: 'Todas' },
      ]}
      ativa={aba}
      aoMudar={setAba}
    />
  );
}

function FolhaDemo() {
  const [aberta, setAberta] = useState(false);
  const [nome, setNome] = useState('Ana Exemplo');
  return (
    <>
      <Botao rotulo="Abrir folha" tipo="secundario" aoTocar={() => setAberta(true)} />
      <Folha
        visivel={aberta}
        titulo="Editar aluno"
        aoFechar={() => setAberta(false)}
        rodape={
          <LinhaDeAcoes alinhar="fim">
            <Botao rotulo="Cancelar" tipo="secundario" aoTocar={() => setAberta(false)} />
            <Botao rotulo="Salvar" aoTocar={() => setAberta(false)} />
          </LinhaDeAcoes>
        }>
        <Campo rotulo="Nome" valor={nome} aoMudar={setNome} />
        <CampoLeitura rotulo="E-mail" valor="ana@exemplo.com" />
      </Folha>
    </>
  );
}

function PainelConfirmacaoDemo() {
  const [aberto, setAberto] = useState(false);
  const { avisar } = useAviso();
  return (
    <>
      <Botao rotulo="Abrir confirmação" tipo="perigoTexto" aoTocar={() => setAberto(true)} />
      <PainelConfirmacao
        visivel={aberto}
        titulo="Remover exercício?"
        mensagem="O exercício sai do rascunho deste treino. O plano publicado não muda."
        rotuloConfirmar="Remover"
        perigo
        aoConfirmar={() => {
          setAberto(false);
          avisar('Exercício removido (de mentira).', 'sucesso');
        }}
        aoCancelar={() => setAberto(false)}
      />
    </>
  );
}

// ── Números e gráficos ───────────────────────────────────────────────────────────────────────────────────────────

const PONTOS_DE_PESO = [
  { rotulo: '01/09', valor: 82.4, data: '2026-09-01' },
  { rotulo: '15/09', valor: 81.6, data: '2026-09-15' },
  { rotulo: '01/10', valor: 81.9, data: '2026-10-01' },
  { rotulo: '15/10', valor: 80.7, data: '2026-10-15' },
  { rotulo: '01/11', valor: 80.1, data: '2026-11-01' },
];

const BARRAS = [
  { rotulo: 'ago', realizado: 120000, previsto: 150000 },
  { rotulo: 'set', realizado: 140000, previsto: 150000 },
  { rotulo: 'out', realizado: 150000, previsto: 150000 },
  { rotulo: 'nov', realizado: null, previsto: 160000 },
];

// ── Lista ────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Cada estado de cada componente de `ui/`, com dados fictícios e sem chamar a API. A ordem aqui é a ordem dentro da seção.
 * O que não renderiza fora de uma tela real (precisa de sessão, de plano do aluno ou chama a API) fica de fora: ver
 * `docs/planos/montador-de-telas.md`.
 */
export const EXEMPLOS_DO_CATALOGO: readonly ExemploComDesenho[] = [
  // Campos de texto
  { id: 'campo-vazio', componente: 'Campo', estado: 'vazio', secao: 'camposDeTexto', caminho: 'ui/Campo', props: 'rotulo="Nome" · valor="" · placeholder',
    Desenho: () => <CampoDemo rotulo="Nome" inicial="" placeholder="Ex.: Ana Exemplo" /> },
  { id: 'campo-preenchido', componente: 'Campo', estado: 'preenchido', secao: 'camposDeTexto', caminho: 'ui/Campo', props: 'rotulo="E-mail" · valor',
    Desenho: () => <CampoDemo rotulo="E-mail" inicial="ana@exemplo.com" keyboardType="email-address" autoCapitalize="none" /> },
  { id: 'campo-ajuda', componente: 'Campo', estado: 'com ajuda', secao: 'camposDeTexto', caminho: 'ui/Campo', props: 'rotulo · valor · ajuda',
    Desenho: () => <CampoDemo rotulo="Nome da consultoria" inicial="Equipe Exemplo" ajuda="Aparece no app dos alunos." /> },
  { id: 'campo-erro', componente: 'Campo', estado: 'com erro', secao: 'camposDeTexto', caminho: 'ui/Campo', props: 'rotulo · valor · erro="Informe um e-mail válido."',
    Desenho: () => <CampoDemo rotulo="E-mail" inicial="ana@exemplo" erro="Informe um e-mail válido." /> },
  { id: 'campo-desabilitado', componente: 'Campo', estado: 'desabilitado', secao: 'camposDeTexto', caminho: 'ui/Campo', props: 'rotulo · valor · editable={false}',
    Desenho: () => <CampoDemo rotulo="CPF" inicial="000.000.000-00" editable={false} ajuda="Só o treinador altera." /> },
  { id: 'campo-linhas', componente: 'Campo', estado: 'várias linhas', secao: 'camposDeTexto', caminho: 'ui/Campo', props: 'rotulo · valor · linhas={4}',
    Desenho: () => <CampoDemo rotulo="Observações" inicial={'Treinar pela manhã.\nEvitar impacto no joelho.'} linhas={4} /> },
  { id: 'campo-sufixo', componente: 'Campo', estado: 'com unidade', secao: 'camposDeTexto', caminho: 'ui/Campo', props: 'rotulo · valor · numerico · sufixo="%"',
    Desenho: () => <CampoDemo rotulo="Percentual da carga" inicial="75" numerico sufixo="%" keyboardType="decimal-pad" /> },
  { id: 'campo-senha', componente: 'CampoSenha', estado: 'com o olho', secao: 'camposDeTexto', caminho: 'ui/CampoSenha', props: 'rotulo="Senha" · valor · aoMudar',
    Desenho: CampoSenhaDemo },
  { id: 'campo-leitura-valor', componente: 'CampoLeitura', estado: 'com valor', secao: 'camposDeTexto', caminho: 'ui/CampoLeitura', props: 'rotulo="E-mail" · valor',
    Desenho: () => <CampoLeitura rotulo="E-mail" valor="ana@exemplo.com" /> },
  { id: 'campo-leitura-vazio', componente: 'CampoLeitura', estado: 'sem valor', secao: 'camposDeTexto', caminho: 'ui/CampoLeitura', props: 'rotulo="Telefone" · valor={null} (mostra "—")',
    Desenho: () => <CampoLeitura rotulo="Telefone" valor={null} /> },
  { id: 'campo-numerico', componente: 'CampoNumerico', estado: 'inteiro', secao: 'camposDeTexto', caminho: 'ui/Campos', props: 'rotulo · valor={12} · inteiro',
    Desenho: CampoNumericoDemo },
  { id: 'campo-numerico-grande', componente: 'CampoNumericoGrande', estado: 'com unidade e ajuda', secao: 'camposDeTexto', caminho: 'ui/Campos', props: 'rotulo="Peso" · valor={60} · sufixo="kg" · ajuda',
    Desenho: CampoNumericoGrandeDemo },
  { id: 'campo-de-carga', componente: 'CampoDeCarga', estado: 'vazio, em destaque', secao: 'camposDeTexto', caminho: 'ui/CampoDeCarga', props: 'rotulo · valorKg={null} · destaque',
    Desenho: CampoDeCargaDemo },
  { id: 'campo-data', componente: 'CampoData', estado: 'com calendário', secao: 'camposDeTexto', caminho: 'ui/Campos', props: 'rotulo · valor="15/03/2026"',
    Desenho: CampoDataDemo },
  { id: 'campos-endereco', componente: 'CamposDeEndereco', estado: 'preenchido, sem buscar CEP', secao: 'camposDeTexto', caminho: 'ui/CamposDeEndereco', props: 'valor (fictício) · desabilitado',
    Desenho: CamposDeEnderecoDemo },
  { id: 'campos-em-linha', componente: 'CamposEmLinha', estado: 'dois campos', secao: 'camposDeTexto', caminho: 'ui/CamposEmLinha', props: 'children (2 Campo) · minimo={150}',
    Desenho: CamposEmLinhaDemo },
  { id: 'texto-formatado', componente: 'TextoFormatado', estado: 'negrito e sublinhado', secao: 'camposDeTexto', caminho: 'ui/TextoFormatado', props: 'texto com **negrito** e __sublinhado__',
    Desenho: () => <TextoFormatado texto={'Responda com **calma**.\nAs fotos são __opcionais__.'} /> },

  // Escolhas
  { id: 'escolha', componente: 'Escolha', estado: 'com rótulo', secao: 'escolhas', caminho: 'ui/Escolha', props: 'rotulo · opcoes (3) · valor',
    Desenho: () => <EscolhaDemo /> },
  { id: 'escolha-compacta', componente: 'Escolha', estado: 'compacta', secao: 'escolhas', caminho: 'ui/Escolha', props: 'descricao · opcoes (3) · compacta',
    Desenho: () => <EscolhaDemo compacta /> },
  { id: 'escolha-folha-poucas', componente: 'EscolhaEmFolha', estado: 'até 8 opções', secao: 'escolhas', caminho: 'ui/EscolhaEmFolha', props: 'rotulo · opcoes (3) · valor',
    Desenho: () => <EscolhaEmFolhaDemo /> },
  { id: 'escolha-folha-muitas', componente: 'EscolhaEmFolha', estado: 'mais de 8 opções, com busca', secao: 'escolhas', caminho: 'ui/EscolhaEmFolha', props: 'rotulo · opcoes (12) · valor',
    Desenho: () => <EscolhaEmFolhaDemo muitas /> },
  { id: 'escolha-suspensa', componente: 'EscolhaSuspensa', estado: 'com busca', secao: 'escolhas', caminho: 'ui/EscolhaSuspensa', props: 'rotulo · opcoes (4, uma com detalhe) · valor',
    Desenho: EscolhaSuspensaDemo },
  { id: 'selecao-multipla-suspensa', componente: 'SelecaoMultiplaSuspensa', estado: 'dois marcados', secao: 'escolhas', caminho: 'ui/SelecaoMultiplaSuspensa', props: 'rotulo · opcoes (4) · marcados (2)',
    Desenho: SelecaoMultiplaSuspensaDemo },
  { id: 'selecao-multipla', componente: 'SelecaoMultipla', estado: 'lista com caixas', secao: 'escolhas', caminho: 'ui/SelecaoMultipla', props: 'rotulo · opcoes (4) · marcados (1)',
    Desenho: SelecaoMultiplaDemo },
  { id: 'interruptor-ligado', componente: 'Interruptor', estado: 'ligado', secao: 'escolhas', caminho: 'ui/Campos', props: 'rotulo · ajuda · valor={true}',
    Desenho: () => <InterruptorDemo ligado /> },
  { id: 'interruptor-desligado', componente: 'Interruptor', estado: 'desligado', secao: 'escolhas', caminho: 'ui/Campos', props: 'rotulo · ajuda · valor={false}',
    Desenho: () => <InterruptorDemo ligado={false} /> },
  { id: 'caixa-selecao', componente: 'CaixaSelecao', estado: 'marcada', secao: 'escolhas', caminho: 'ui/CaixaSelecao', props: 'rotulo · ajuda · marcado',
    Desenho: CaixaSelecaoDemo },
  { id: 'botao-marcar-vazio', componente: 'BotaoMarcar', estado: 'série a fazer', secao: 'escolhas', caminho: 'ui/BotaoMarcar', props: 'feito={false} · rotulo · semVibrar',
    Desenho: () => <BotaoMarcarDemo feitoInicial={false} /> },
  { id: 'botao-marcar-feito', componente: 'BotaoMarcar', estado: 'série feita', secao: 'escolhas', caminho: 'ui/BotaoMarcar', props: 'feito={true} · rotulo · semVibrar',
    Desenho: () => <BotaoMarcarDemo feitoInicial /> },
  { id: 'caixa-da-linha', componente: 'CaixaDaLinha', estado: 'desmarcada', secao: 'escolhas', caminho: 'ui/LinhaDaLista', props: 'rotulo · marcado={false}',
    Desenho: CaixaDaLinhaDemo },
  { id: 'faixa-de-chips', componente: 'FaixaDeChips', estado: 'com Escolha compacta', secao: 'escolhas', caminho: 'ui/FaixaDeChips', props: 'quebrar · children (Escolha compacta, 6 opções)',
    Desenho: FaixaDeChipsDemo },
  { id: 'seletor-de-nota', componente: 'SeletorDeNota', estado: 'nota 7 de 10', secao: 'escolhas', caminho: 'ui/SeletorDeNota', props: 'rotulo · valor={7} · rotuloMinimo · rotuloMaximo · limpavel',
    Desenho: SeletorDeNotaDemo },
  { id: 'escala-de-nota', componente: 'EscalaDeNota', estado: 'sem resposta', secao: 'escolhas', caminho: 'ui/EscalaDeNota', props: 'rotulo · valor={null}',
    Desenho: EscalaDeNotaDemo },
  { id: 'ajuste-de-carga', componente: 'AjusteDeCarga', estado: '−/+ de 2,5 kg', secao: 'escolhas', caminho: 'ui/AjusteDeCarga', props: 'passo={2.5} · rotulo · aoAjustar',
    Desenho: AjusteDeCargaDemo },
  { id: 'opcao-cartao', componente: 'OpcaoCartao', estado: 'em GradeDeOpcoes', secao: 'escolhas', caminho: 'ui/OpcaoCartao e ui/GradeDeOpcoes', props: 'titulo · descricao · selecionada',
    Desenho: OpcaoCartaoDemo },

  // Botões
  { id: 'botao-primario', componente: 'Botao', estado: 'primário', secao: 'botoes', caminho: 'ui/Botao', props: 'rotulo · tipo="primario"',
    Desenho: () => <BotaoComAviso tipo="primario" rotulo="Novo aluno" /> },
  { id: 'botao-secundario', componente: 'Botao', estado: 'secundário', secao: 'botoes', caminho: 'ui/Botao', props: 'rotulo · tipo="secundario"',
    Desenho: () => <BotaoComAviso tipo="secundario" rotulo="Aplicar ao aluno" /> },
  { id: 'botao-perigo', componente: 'Botao', estado: 'perigo', secao: 'botoes', caminho: 'ui/Botao', props: 'rotulo · tipo="perigo" (só no painel de confirmação)',
    Desenho: () => <BotaoComAviso tipo="perigo" rotulo="Excluir" /> },
  { id: 'botao-perigo-texto', componente: 'Botao', estado: 'perigo em texto', secao: 'botoes', caminho: 'ui/Botao', props: 'rotulo · tipo="perigoTexto"',
    Desenho: () => <BotaoComAviso tipo="perigoTexto" rotulo="Inativar aluno" /> },
  { id: 'botao-fantasma', componente: 'Botao', estado: 'fantasma com ícone', secao: 'botoes', caminho: 'ui/Botao', props: 'rotulo · tipo="fantasma" · Icone={Plus}',
    Desenho: () => <BotaoComAviso tipo="fantasma" rotulo="Adicionar série" Icone={Plus} /> },
  { id: 'botao-desabilitado', componente: 'Botao', estado: 'desabilitado com motivo', secao: 'botoes', caminho: 'ui/Botao', props: 'rotulo · desabilitado · motivo="Escolha um aluno"',
    Desenho: () => <Botao rotulo="Publicar" desabilitado motivo="Escolha um aluno" aoTocar={() => undefined} /> },
  { id: 'botao-carregando', componente: 'Botao', estado: 'carregando', secao: 'botoes', caminho: 'ui/Botao', props: 'rotulo · carregando',
    Desenho: BotaoCarregandoDemo },
  { id: 'icone-botao', componente: 'IconeBotao', estado: 'com moldura, compacto e desabilitado', secao: 'botoes', caminho: 'ui/IconeBotao', props: 'Icone · rotulo · moldura | compacto | desabilitado',
    Desenho: IconeBotaoDemo },
  { id: 'link-texto', componente: 'LinkTexto', estado: 'link', secao: 'botoes', caminho: 'ui/LinkTexto', props: 'href · texto',
    Desenho: () => <LinkTexto href={AQUI} texto="Ver termos de uso" /> },

  // Avisos e estados
  { id: 'selo-sem-icone', componente: 'Selo', estado: 'cada tom, sem ícone', secao: 'avisosEEstados', caminho: 'ui/Selo', props: 'texto · tipo="sucesso" | "atencao" | "perigo" | "neutro"',
    Desenho: () => (
      <View style={estilos.linha}>
        <Selo texto="Em dia" tipo="sucesso" />
        <Selo texto="Para revisar" tipo="atencao" />
        <Selo texto="Atrasada" tipo="perigo" />
        <Selo texto="Inativo" tipo="neutro" />
      </View>
    ) },
  { id: 'selo-com-icone', componente: 'Selo', estado: 'cada tom, com ícone', secao: 'avisosEEstados', caminho: 'ui/Selo', props: 'texto · tipo · Icone',
    Desenho: () => (
      <View style={estilos.linha}>
        <Selo texto="Em dia" tipo="sucesso" Icone={CircleCheck} />
        <Selo texto="Para revisar" tipo="atencao" Icone={TriangleAlert} />
        <Selo texto="Atrasada" tipo="perigo" Icone={CircleAlert} />
        <Selo texto="Inativo" tipo="neutro" Icone={Info} />
      </View>
    ) },
  { id: 'alerta-perigo', componente: 'Alerta', estado: 'perigo', secao: 'avisosEEstados', caminho: 'ui/Estados', props: 'tom="perigo" · titulo · texto',
    Desenho: () => <Alerta tom="perigo" titulo="Não foi possível publicar" texto="Há 2 séries sem repetições." /> },
  { id: 'alerta-atencao', componente: 'Alerta', estado: 'atenção', secao: 'avisosEEstados', caminho: 'ui/Estados', props: 'tom="atencao" · texto',
    Desenho: () => <Alerta tom="atencao" texto="Bruno Fictício já tem um compromisso neste horário." /> },
  { id: 'alerta-sucesso', componente: 'Alerta', estado: 'sucesso', secao: 'avisosEEstados', caminho: 'ui/Estados', props: 'tom="sucesso" · texto',
    Desenho: () => <Alerta tom="sucesso" texto="Plano publicado. O aluno já vê a versão nova." /> },
  { id: 'mensagem-erro', componente: 'MensagemErro', estado: 'com "Tentar de novo"', secao: 'avisosEEstados', caminho: 'ui/Estados', props: 'texto · tentarDeNovo',
    Desenho: () => <MensagemErro texto="Sem conexão com o servidor." tentarDeNovo={() => undefined} /> },
  { id: 'use-aviso', componente: 'useAviso', estado: 'cada tipo', secao: 'avisosEEstados', caminho: 'ui/Aviso', props: 'avisar(mensagem, tipo, acao?)',
    Desenho: AvisosDemo },
  { id: 'sem-permissao', componente: 'SemPermissao', estado: 'tela sem acesso', secao: 'avisosEEstados', caminho: 'ui/Estados', props: 'acao? (título é h1 da tela)',
    Desenho: () => <SemPermissao /> },
  { id: 'modulo-desligado', componente: 'ModuloDesligado', estado: 'módulo fora', secao: 'avisosEEstados', caminho: 'ui/Estados', props: 'titulo · texto (título é h1 da tela)',
    Desenho: () => <ModuloDesligado titulo="Financeiro desligado" texto="Este módulo não está ligado nesta instalação." /> },
  { id: 'bloqueado', componente: 'Bloqueado', estado: 'com ação', secao: 'avisosEEstados', caminho: 'ui/Estados', props: 'titulo · texto · acao',
    Desenho: () => (
      <Bloqueado titulo="Plano publicado" texto="Para mudar, edite o rascunho." acao={<Botao rotulo="Editar rascunho" tipo="secundario" aoTocar={() => undefined} />} />
    ) },
  { id: 'incompleto', componente: 'Incompleto', estado: 'padrão', secao: 'avisosEEstados', caminho: 'ui/Estados', props: 'texto (padrão)',
    Desenho: () => <Incompleto /> },
  { id: 'vazio', componente: 'Vazio', estado: 'com ação', secao: 'avisosEEstados', caminho: 'ui/Estados', props: 'titulo · texto · acao',
    Desenho: () => <Vazio titulo="Nenhum aluno ainda" texto="Cadastre o primeiro aluno para começar." acao={{ rotulo: 'Cadastrar aluno', aoTocar: () => undefined }} /> },
  { id: 'esqueleto', componente: 'Esqueleto', estado: 'dois cartões', secao: 'avisosEEstados', caminho: 'ui/Esqueleto', props: 'cartoes={2}',
    Desenho: () => <Esqueleto cartoes={2} /> },
  { id: 'carregando', componente: 'Carregando', estado: 'com texto', secao: 'avisosEEstados', caminho: 'ui/Estados', props: 'texto="Carregando alunos…"',
    Desenho: () => <Carregando texto="Carregando alunos…" /> },

  // Listas e tabelas
  { id: 'tabela-larga', componente: 'Tabela', estado: 'largura grande (colunas)', secao: 'listasETabelas', caminho: 'ui/Tabela', props: 'colunas (3) · linhas (3) · chave · rotulo',
    Desenho: () => <TabelaDemo /> },
  { id: 'tabela-estreita', componente: 'Tabela', estado: 'largura pequena (cartões)', secao: 'listasETabelas', caminho: 'ui/Tabela', props: 'as mesmas, numa caixa de 360 px (abaixo de 520 vira cartões)',
    Desenho: () => <TabelaDemo estreita /> },
  { id: 'linha-com-href', componente: 'ListaDeLinhas + LinhaDaLista', estado: 'com href', secao: 'listasETabelas', caminho: 'ui/LinhaDaLista', props: 'titulo · metadados · selos · href · aoAbrir',
    Desenho: LinhasComLinkDemo },
  { id: 'linha-com-acoes', componente: 'ListaDeLinhas + LinhaDaLista', estado: 'com ações', secao: 'listasETabelas', caminho: 'ui/LinhaDaLista', props: 'titulo · metadados · descricao · acoes',
    Desenho: LinhasComAcoesDemo },
  { id: 'linha-de-marcar', componente: 'ListaDeLinhas + LinhaDaLista', estado: 'de marcar', secao: 'listasETabelas', caminho: 'ui/LinhaDaLista', props: 'titulo · rotulo · metadados · marcar',
    Desenho: LinhaDeMarcarDemo },
  { id: 'item-de-lista', componente: 'ItemDeLista', estado: 'com selo e de perigo', secao: 'listasETabelas', caminho: 'ui/ItemDeLista', props: 'titulo · detalhe · selo · href | perigo · aoTocar',
    Desenho: ItemDeListaDemo },
  { id: 'barra-de-filtros', componente: 'BarraDeFiltros', estado: 'com busca e um filtro', secao: 'listasETabelas', caminho: 'ui/BarraDeFiltros', props: 'busca · valor · limpo · chips · aoTirar · seletores',
    Desenho: BarraDeFiltrosDemo },

  // Estrutura
  { id: 'cartao-com-faixa', componente: 'Cartao', estado: 'com faixa', secao: 'estrutura', caminho: 'ui/Cartao', props: 'titulo · descricao · acoes · nivel={3}',
    Desenho: () => (
      <Cartao titulo="Pasta de outubro" descricao="01/10 a 31/10" nivel={3} acoes={<IconeBotao Icone={Pencil} rotulo="Editar pasta" moldura aoTocar={() => undefined} />}>
        <Texto>Treino A, Treino B e dieta.</Texto>
      </Cartao>
    ) },
  { id: 'cartao-sem-faixa', componente: 'Cartao', estado: 'sem faixa', secao: 'estrutura', caminho: 'ui/Cartao', props: 'titulo · faixa={false} · nivel={3}',
    Desenho: () => (
      <Cartao titulo="Destaque" faixa={false} nivel={3}>
        <Texto>Cartão sem a faixa do título.</Texto>
      </Cartao>
    ) },
  { id: 'cartao-recolhivel', componente: 'Cartao', estado: 'recolhível', secao: 'estrutura', caminho: 'ui/Cartao', props: 'titulo · recolhivel · nivel={3}',
    Desenho: () => (
      <Cartao titulo="Observações" recolhivel nivel={3}>
        <Texto>Toque no título para recolher.</Texto>
      </Cartao>
    ) },
  { id: 'cabecalho-de-grupo', componente: 'CabecalhoDeGrupo', estado: 'linha forte', secao: 'estrutura', caminho: 'ui/CabecalhoDeGrupo', props: 'titulo · resumo · selo',
    Desenho: () => <CabecalhoDeGrupo titulo="Segunda-feira" resumo="Treino A · 5 exercícios" selo={{ texto: 'Hoje', tipo: 'neutro' }} /> },
  { id: 'cabecalho-de-grupo-fina', componente: 'CabecalhoDeGrupo', estado: 'linha fina', secao: 'estrutura', caminho: 'ui/CabecalhoDeGrupo', props: 'titulo · resumo · linha="fina"',
    Desenho: () => <CabecalhoDeGrupo titulo="Série 1" resumo="12 repetições · 60 s" linha="fina" /> },
  { id: 'abas', componente: 'Abas', estado: 'com contagem', secao: 'estrutura', caminho: 'ui/Abas', props: 'abas (2 com contagem) · ativa · aoMudar',
    Desenho: AbasDemo },
  { id: 'folha', componente: 'Folha', estado: 'aberta pelo botão', secao: 'estrutura', caminho: 'ui/Folha', props: 'visivel · titulo · aoFechar · rodape',
    Desenho: FolhaDemo },
  { id: 'painel-confirmacao', componente: 'PainelConfirmacao', estado: 'de perigo', secao: 'estrutura', caminho: 'ui/PainelConfirmacao', props: 'visivel · titulo · mensagem · rotuloConfirmar · perigo',
    Desenho: PainelConfirmacaoDemo },
  { id: 'linha-de-acoes', componente: 'LinhaDeAcoes', estado: 'alinhada ao fim', secao: 'estrutura', caminho: 'ui/LinhaDeAcoes', props: 'alinhar="fim" · children (2 Botao)',
    Desenho: () => (
      <LinhaDeAcoes alinhar="fim">
        <Botao rotulo="Cancelar" tipo="secundario" aoTocar={() => undefined} />
        <Botao rotulo="Salvar" aoTocar={() => undefined} />
      </LinhaDeAcoes>
    ) },

  // Números e gráficos
  { id: 'barra-progresso', componente: 'BarraProgresso', estado: '3 de 5', secao: 'numerosEGraficos', caminho: 'ui/BarraProgresso', props: 'feitas={3} · total={5}',
    Desenho: () => (
      <View style={estilos.pilha}>
        <Texto variante="suave" numerico>3 de 5 séries</Texto>
        <BarraProgresso feitas={3} total={5} />
      </View>
    ) },
  { id: 'anel-progresso', componente: 'AnelProgresso', estado: '60%', secao: 'numerosEGraficos', caminho: 'ui/AnelProgresso', props: 'proporcao={0.6} · rotulo',
    Desenho: () => <AnelProgresso proporcao={0.6} rotulo="60% do treino feito" /> },
  { id: 'grafico-linha', componente: 'GraficoLinha', estado: 'peso em kg', secao: 'numerosEGraficos', caminho: 'ui/GraficoLinha', props: 'pontos (5) · unidade="kg" · descricao',
    Desenho: () => <GraficoLinha pontos={PONTOS_DE_PESO} unidade="kg" descricao="Peso fictício de setembro a novembro" /> },
  { id: 'grafico-barras', componente: 'GraficoBarras', estado: 'recebido e previsto', secao: 'numerosEGraficos', caminho: 'ui/GraficoBarras', props: 'barras (4, a última sem realizado)',
    Desenho: () => <GraficoBarras barras={BARRAS} /> },
  { id: 'foto-de-perfil', componente: 'FotoDePerfil', estado: 'só iniciais', secao: 'numerosEGraficos', caminho: 'ui/FotoDePerfil (IniciaisDePerfil)', props: 'nome · tamanho={48} e {32}',
    Desenho: () => (
      <View style={estilos.linha}>
        <IniciaisDePerfil nome="Ana Exemplo" />
        <IniciaisDePerfil nome="Bruno Fictício" tamanho={32} />
      </View>
    ) },
  { id: 'codigo-qr', componente: 'CodigoQr', estado: 'link fictício', secao: 'numerosEGraficos', caminho: 'ui/CodigoQr', props: 'conteudo · tamanho={120} · descricao',
    Desenho: () => <CodigoQr conteudo="https://exemplo.com/inscricao" tamanho={120} descricao="Código QR de um link fictício" /> },
];

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espaco(1) },
  pilha: { gap: espaco(1) },
  estreita: { maxWidth: 360, width: '100%' },
});
