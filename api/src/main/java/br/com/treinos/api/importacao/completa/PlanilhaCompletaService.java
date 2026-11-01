package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.biblioteca.Alimento;
import br.com.treinos.api.biblioteca.AlimentoRepository;
import br.com.treinos.api.biblioteca.Ergogenico;
import br.com.treinos.api.biblioteca.ErgogenicoRepository;
import br.com.treinos.api.biblioteca.Exercicio;
import br.com.treinos.api.biblioteca.ExercicioRepository;
import br.com.treinos.api.biblioteca.Suplemento;
import br.com.treinos.api.biblioteca.SuplementoRepository;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.importacao.completa.PlanilhaCompletaDtos.Analise;
import br.com.treinos.api.web.Fuso;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

/**
 * Análise da planilha completa (fase 1 da frente "Importar planilha completa"): só lê, nada é gravado nem auditado e o
 * arquivo não fica guardado. A planilha é lida e analisada fora de transação; a biblioteca da consultoria (exercícios e
 * alimentos ativos, já filtrados pelo {@code @TenantId}) é lida pelos repositórios, cada um na sua transação curta de
 * leitura.
 */
@Service
public class PlanilhaCompletaService {

    private final ExercicioRepository exercicios;
    private final AlimentoRepository alimentos;

    private final SuplementoRepository suplementos;
    private final ErgogenicoRepository ergogenicos;
    private final AlunoRepository alunos;

    public PlanilhaCompletaService(ExercicioRepository exercicios, AlimentoRepository alimentos,
                                   SuplementoRepository suplementos, ErgogenicoRepository ergogenicos,
                                   AlunoRepository alunos) {
        this.exercicios = exercicios;
        this.alimentos = alimentos;
        this.suplementos = suplementos;
        this.ergogenicos = ergogenicos;
        this.alunos = alunos;
    }

    public Analise analisar(String nomeDoArquivo, byte[] bytes) {
        LeituraDasAbas.Leitura leitura = LeituraDasAbas.ler(nomeDoArquivo, bytes);
        List<String> daBiblioteca = exercicios.buscarAtivos("%").stream().map(Exercicio::getNome).toList();
        List<String> alimentosDaBiblioteca = alimentos.buscarAtivos("%").stream().map(Alimento::getNome).toList();
        // Os nomes da aba de suplementos (que podem ser de medicação) só voltam a quem pode gravar a dieta.
        boolean dieta = AcessoAtual.pode("PASTA_ALTERAR") && AcessoAtual.pode("DIETA_ALTERAR");
        List<String> nomesDeSuplementos = dieta ? suplementos.findAll().stream().map(Suplemento::getNome).toList() : null;
        List<String> nomesDeErgogenicos = dieta ? ergogenicos.findAll().stream().map(Ergogenico::getNome).toList() : List.of();
        // Os nomes dos alunos só servem para dizer se o aluno da aba (ou do bloco) já existe; não voltam na resposta.
        List<String> nomesDeAlunos = alunos.findAll().stream().filter(a -> !a.isAnonimizado()).map(Aluno::getNome).toList();
        return AnaliseDaPlanilha.analisar(leitura, daBiblioteca, alimentosDaBiblioteca, nomesDeSuplementos, nomesDeErgogenicos,
                nomesDeAlunos, LocalDate.now(Fuso.BRASILIA));
    }
}
