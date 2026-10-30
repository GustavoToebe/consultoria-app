package br.com.treinos.api.privacidade;

import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.atualizacoes.Atualizacao;
import br.com.treinos.api.atualizacoes.AtualizacaoRepository;
import br.com.treinos.api.auditoria.Auditar;
import br.com.treinos.api.dieta.PlanoDietaService;
import br.com.treinos.api.inscricoes.InscricaoDoAluno;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.execucao.HistoricoService;
import br.com.treinos.api.execucao.PesoService;
import br.com.treinos.api.alunos.FotoPerfilService;
import br.com.treinos.api.fotos.FotoService;
import br.com.treinos.api.lesoes.LesaoService;
import br.com.treinos.api.mobilidade.PlanoMobilidadeService;
import br.com.treinos.api.pastas.PastaRepository;
import br.com.treinos.api.privacidade.PrivacidadeDtos.AtualizacaoExportada;
import br.com.treinos.api.privacidade.PrivacidadeDtos.Exportacao;
import br.com.treinos.api.privacidade.PrivacidadeDtos.PastaExportada;
import br.com.treinos.api.privacidade.PrivacidadeDtos.Secao;
import br.com.treinos.api.treino.PlanoTreinoService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Exportação dos dados de um aluno (LGPD). Cada seção segue a permissão da rota que já a mostra ao treinador: o que a
 * pessoa não pode ler não sai no arquivo. Aluno de outra consultoria responde 404. O conteúdo nunca vai a log nem à
 * auditoria (que grava só um resumo fixo).
 */
@Service
public class ExportacaoService {

    /** Teto por lista; passou disso a seção sai com {@code truncado = true}. */
    static final int LIMITE_POR_LISTA = 5000;

    private final AlunoService alunos;
    private final PastaRepository pastas;
    private final PlanoTreinoService treinos;
    private final PlanoDietaService dietas;
    private final PlanoMobilidadeService mobilidades;
    private final HistoricoService historico;
    private final br.com.treinos.api.mobilidade.MobilidadeRegistroService mobilidadeRegistros;
    private final br.com.treinos.api.sessoesconcluidas.SessaoConcluidaService sessoesConcluidas;
    private final PesoService pesos;
    private final LesaoService lesoes;
    private final AtualizacaoRepository atualizacoes;
    private final FotoService fotos;
    private final FotoPerfilService fotoPerfil;
    private final br.com.treinos.api.anamneses.AnamneseService anamneses;
    private final InscricaoDoAluno inscricao;
    private final br.com.treinos.api.pagamentos.PagamentosDoAluno pagamentos;
    private final JsonMapper json;
    private final br.com.treinos.api.ciclo.CicloMenstrualService ciclo;
    private final br.com.treinos.api.agenda.AgendaService agenda;
    private final br.com.treinos.api.agenda.AvisosDeCompromissoService avisosDeCompromisso;
    private final br.com.treinos.api.avaliacoes.AvaliacaoFisicaService avaliacoesFisicas;
    private final br.com.treinos.api.agua.AguaDoDiaService agua;

    public ExportacaoService(AlunoService alunos, PastaRepository pastas, PlanoTreinoService treinos,
                             PlanoDietaService dietas, PlanoMobilidadeService mobilidades, HistoricoService historico,
                             br.com.treinos.api.mobilidade.MobilidadeRegistroService mobilidadeRegistros,
                             br.com.treinos.api.sessoesconcluidas.SessaoConcluidaService sessoesConcluidas,
                             PesoService pesos, LesaoService lesoes, AtualizacaoRepository atualizacoes,
                             FotoService fotos, FotoPerfilService fotoPerfil,
                             br.com.treinos.api.anamneses.AnamneseService anamneses, InscricaoDoAluno inscricao,
                             br.com.treinos.api.pagamentos.PagamentosDoAluno pagamentos, JsonMapper json,
                             br.com.treinos.api.ciclo.CicloMenstrualService ciclo,
                             br.com.treinos.api.agenda.AgendaService agenda,
                             br.com.treinos.api.agenda.AvisosDeCompromissoService avisosDeCompromisso,
                             br.com.treinos.api.avaliacoes.AvaliacaoFisicaService avaliacoesFisicas,
                             br.com.treinos.api.agua.AguaDoDiaService agua) {
        this.agua = agua;
        this.agenda = agenda;
        this.avisosDeCompromisso = avisosDeCompromisso;
        this.avaliacoesFisicas = avaliacoesFisicas;
        this.anamneses = anamneses;
        this.inscricao = inscricao;
        this.pagamentos = pagamentos;
        this.alunos = alunos;
        this.pastas = pastas;
        this.treinos = treinos;
        this.dietas = dietas;
        this.mobilidades = mobilidades;
        this.historico = historico;
        this.mobilidadeRegistros = mobilidadeRegistros;
        this.sessoesConcluidas = sessoesConcluidas;
        this.pesos = pesos;
        this.lesoes = lesoes;
        this.atualizacoes = atualizacoes;
        this.fotos = fotos;
        this.fotoPerfil = fotoPerfil;
        this.json = json;
        this.ciclo = ciclo;
    }

    // Não é readOnly: a auditoria grava na mesma transação.
    @Transactional
    @Auditar(acao = "ALUNO_EXPORTADO", entidade = "ALUNO", resumo = "Exportou os dados de um aluno.")
    public Exportacao exportar(UUID alunoId) {
        var cadastro = alunos.detalhe(alunoId);
        List<String> omitidas = new ArrayList<>();
        var pastasDoAluno = secao(true, "pastas", omitidas, () -> pastas.findByAlunoIdOrderByCriadoEmDesc(alunoId).stream()
                .map(p -> new PastaExportada(p.getId(), p.getTitulo(), p.getInicio(), p.getFim(), p.getConcluidaEm(),
                        p.isArquivado(), p.getCriadoEm())).toList());
        var treino = secao(AcessoAtual.pode("TREINO_LER"), "treinos", omitidas, () -> treinos.publicadosDoAluno(alunoId));
        var dieta = secao(AcessoAtual.pode("DIETA_LER"), "dietas", omitidas, () -> dietas.publicadosDoAluno(alunoId));
        var mobilidade = secao(AcessoAtual.pode("TREINO_LER"), "mobilidades", omitidas,
                () -> mobilidades.publicadosDoAluno(alunoId));
        var registros = secao(AcessoAtual.pode("REGISTRO_LER"), "registros", omitidas,
                () -> historico.completoDoAluno(alunoId));
        var mobilidadeFeita = secao(AcessoAtual.pode("REGISTRO_LER"), "mobilidadeRegistros", omitidas,
                () -> mobilidadeRegistros.completoDoAluno(alunoId));
        // Sessões concluídas pelo aluno ("Concluir treino"): com REGISTRO_LER; o comentário só sai com ALUNO_SENSIVEL_LER
        // (o serviço o deixa nulo sem ela). Roda com a chave do retorno ligada ou não.
        var sessaoConcluida = secao(AcessoAtual.pode("REGISTRO_LER"), "sessoesConcluidas", omitidas,
                () -> sessoesConcluidas.completoDoAluno(alunoId));
        // Água marcada pelo aluno: dado de dieta, com a mesma permissão da rota da equipe (GET /alunos/{id}/agua).
        var aguaDoDia = secao(AcessoAtual.pode("REGISTRO_LER") && AcessoAtual.pode("ALUNO_SENSIVEL_LER"), "agua", omitidas,
                () -> agua.completoDoAluno(alunoId));
        var peso = secao(AcessoAtual.pode("ALUNO_SENSIVEL_LER"), "pesos", omitidas, () -> pesos.listar(alunoId));
        var lesao = secao(AcessoAtual.pode("ALUNO_SENSIVEL_LER"), "lesoes", omitidas, () -> lesoes.listar(alunoId));
        // Mesma permissão da rota que mostra as avaliações ao treinador (GET /alunos/{id}/avaliacoes-fisicas).
        var avaliacaoFisica = secao(AcessoAtual.pode("ALUNO_SENSIVEL_LER"), "avaliacoesFisicas", omitidas,
                () -> avaliacoesFisicas.listar(alunoId));
        var atualizacao = secao(AcessoAtual.pode("ATUALIZACAO_LER") && AcessoAtual.pode("ALUNO_SENSIVEL_LER"),
                "atualizacoes", omitidas, () -> atualizacoesExportadas(alunoId));
        var anamnese = secao(AcessoAtual.pode("ANAMNESE_LER") && AcessoAtual.pode("ALUNO_SENSIVEL_LER"),
                "anamneses", omitidas, () -> anamneses.exportar(alunoId));
        // A inscrição pelo link que virou o aluno, com quem atende a fila (INSCRICAO_LER).
        var inscricaoDoAluno = secao(AcessoAtual.pode("INSCRICAO_LER"), "inscricao", omitidas,
                () -> inscricao.exportar(alunoId));
        // Contratações e cobranças do aluno (sem os lançamentos avulsos, que são da consultoria). Roda com o módulo desligado.
        var financeiro = AcessoAtual.pode("FINANCEIRO_LER") ? pagamentos.exportar(alunoId) : null;
        if (financeiro == null) {
            omitidas.add("financeiro");
        }
        var fotoDePerfil = fotoPerfil.atualizadaEm(alunoId).map(PrivacidadeDtos.FotoPerfilExportada::new).orElse(null);
        var cicloMenstrual = AcessoAtual.pode("ALUNO_SENSIVEL_LER") ? ciclo.exportar(alunoId) : null;
        if (cicloMenstrual == null) {
            omitidas.add("cicloMenstrual");
        }
        // Compromissos da agenda presencial do aluno (situação dele, sem os nomes dos outros; observação só se ele é o
        // único participante), com quem lê a agenda (AGENDA_LER).
        var compromissos = secao(AcessoAtual.pode("AGENDA_LER"), "compromissos", omitidas, () -> agenda.exportar(alunoId));
        // Os avisos de compromisso dele (só tipo, data do compromisso e datas de criação e de visto), com a mesma permissão.
        var avisos = secao(AcessoAtual.pode("AGENDA_LER"), "avisosDeCompromisso", omitidas,
                () -> avisosDeCompromisso.exportar(alunoId));
        return new Exportacao(Instant.now(), List.copyOf(omitidas), cadastro, pastasDoAluno, treino, dieta, mobilidade,
                registros, mobilidadeFeita, sessaoConcluida, peso, lesao, atualizacao, anamnese, inscricaoDoAluno, financeiro, fotoDePerfil,
                cicloMenstrual, compromissos, avisos, avaliacaoFisica, aguaDoDia);
    }

    private static <T> Secao<T> secao(boolean pode, String nome, List<String> omitidas, Supplier<List<T>> busca) {
        if (!pode) {
            omitidas.add(nome);
            return null;
        }
        List<T> itens = busca.get();
        return itens.size() > LIMITE_POR_LISTA ? new Secao<>(List.copyOf(itens.subList(0, LIMITE_POR_LISTA)), true)
                : new Secao<>(itens, false);
    }

    /** As fotos saem só como metadados (pergunta e data de envio); os bytes não vão no arquivo. */
    private List<AtualizacaoExportada> atualizacoesExportadas(UUID alunoId) {
        List<Atualizacao> todas = atualizacoes.findByAlunoIdOrderByDataAtualizacaoDesc(alunoId);
        var fotosPorAtualizacao = fotos.metadados(todas.stream().map(Atualizacao::getId).toList());
        return todas.stream().map(a -> atualizacao(a, fotosPorAtualizacao.getOrDefault(a.getId(), List.of()))).toList();
    }

    private AtualizacaoExportada atualizacao(Atualizacao a, List<FotoService.FotoExportada> fotosDela) {
        return new AtualizacaoExportada(a.getId(), a.getPastaId(), a.getDataAtualizacao(), a.getEstado(),
                a.getQuestionarioVersaoId(), json.readTree(a.getRespostas()), a.getEnviadaEm(), a.getAtrasoAte(),
                a.getAtrasoMotivo(), a.getFeedback(), a.getFeedbackEm(), fotosDela);
    }
}
