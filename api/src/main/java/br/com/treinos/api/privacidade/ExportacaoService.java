package br.com.treinos.api.privacidade;

import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.atualizacoes.Atualizacao;
import br.com.treinos.api.atualizacoes.AtualizacaoRepository;
import br.com.treinos.api.auditoria.Auditar;
import br.com.treinos.api.dieta.PlanoDietaService;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.execucao.HistoricoService;
import br.com.treinos.api.execucao.PesoService;
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
    private final PesoService pesos;
    private final LesaoService lesoes;
    private final AtualizacaoRepository atualizacoes;
    private final JsonMapper json;

    public ExportacaoService(AlunoService alunos, PastaRepository pastas, PlanoTreinoService treinos,
                             PlanoDietaService dietas, PlanoMobilidadeService mobilidades, HistoricoService historico,
                             PesoService pesos, LesaoService lesoes, AtualizacaoRepository atualizacoes,
                             JsonMapper json) {
        this.alunos = alunos;
        this.pastas = pastas;
        this.treinos = treinos;
        this.dietas = dietas;
        this.mobilidades = mobilidades;
        this.historico = historico;
        this.pesos = pesos;
        this.lesoes = lesoes;
        this.atualizacoes = atualizacoes;
        this.json = json;
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
        var peso = secao(AcessoAtual.pode("ALUNO_SENSIVEL_LER"), "pesos", omitidas, () -> pesos.listar(alunoId));
        var lesao = secao(AcessoAtual.pode("ALUNO_SENSIVEL_LER"), "lesoes", omitidas, () -> lesoes.listar(alunoId));
        var atualizacao = secao(AcessoAtual.pode("ATUALIZACAO_LER") && AcessoAtual.pode("ALUNO_SENSIVEL_LER"),
                "atualizacoes", omitidas, () -> atualizacoes.findByAlunoIdOrderByDataAtualizacaoDesc(alunoId).stream()
                        .map(this::atualizacao).toList());
        return new Exportacao(Instant.now(), List.copyOf(omitidas), cadastro, pastasDoAluno, treino, dieta, mobilidade,
                registros, peso, lesao, atualizacao);
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

    private AtualizacaoExportada atualizacao(Atualizacao a) {
        return new AtualizacaoExportada(a.getId(), a.getPastaId(), a.getDataAtualizacao(), a.getEstado(),
                a.getQuestionarioVersaoId(), json.readTree(a.getRespostas()), a.getEnviadaEm(), a.getAtrasoAte(),
                a.getAtrasoMotivo(), a.getFeedback(), a.getFeedbackEm());
    }
}
