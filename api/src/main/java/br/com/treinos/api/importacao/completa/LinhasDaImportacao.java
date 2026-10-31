package br.com.treinos.api.importacao.completa;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.biblioteca.Exercicio;
import br.com.treinos.api.dieta.PlanoDieta;
import br.com.treinos.api.execucao.RegistroPeso;
import br.com.treinos.api.importacao.Importacao;
import br.com.treinos.api.pastas.PastaPlano;
import br.com.treinos.api.treino.PlanoTreino;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Consultas do "Desfazer" da planilha completa, em JPQL (sem SQL nativo): as linhas que a importação criou (pela coluna
 * {@code importacao_id} da V049) e o que hoje depende delas. Tudo já filtrado pela consultoria ({@code @TenantId}).
 */
public interface LinhasDaImportacao extends Repository<Importacao, UUID> {

    @Query("select a from Aluno a where a.importacaoId = :importacao")
    List<Aluno> alunos(UUID importacao);

    @Query("select p from RegistroPeso p where p.importacaoId = :importacao")
    List<RegistroPeso> pesos(UUID importacao);

    @Query("select e from Exercicio e where e.importacaoId = :importacao")
    List<Exercicio> exercicios(UUID importacao);

    @Query("select p from PastaPlano p where p.importacaoId = :importacao")
    List<PastaPlano> pastas(UUID importacao);

    @Query("select p from PlanoTreino p where p.importacaoId = :importacao")
    List<PlanoTreino> treinos(UUID importacao);

    @Query("select p from PlanoDieta p where p.importacaoId = :importacao")
    List<PlanoDieta> dietas(UUID importacao);

    /** Planos de qualquer tipo ainda na pasta (inclusive arquivados e os que não vieram da importação). */
    @Query("select count(t) from PlanoTreino t where t.pastaId = :pasta")
    long treinosNaPasta(UUID pasta);

    @Query("select count(d) from PlanoDieta d where d.pastaId = :pasta")
    long dietasNaPasta(UUID pasta);

    @Query("select count(m) from PlanoMobilidade m where m.pastaId = :pasta")
    long mobilidadesNaPasta(UUID pasta);

    @Query("select count(e) > 0 from ExecucaoSerie e where e.alunoId = :aluno")
    boolean alunoTemExecucao(UUID aluno);

    @Query("select count(c) > 0 from CompromissoAluno c where c.alunoId = :aluno")
    boolean alunoTemCompromisso(UUID aluno);

    /** Pastas, planos e pesos que ainda são do aluno (os da importação já apagados não contam mais). */
    @Query("select count(p) from PastaPlano p where p.alunoId = :aluno")
    long pastasDoAluno(UUID aluno);

    @Query("select count(t) from PlanoTreino t where t.alunoId = :aluno")
    long treinosDoAluno(UUID aluno);

    @Query("select count(d) from PlanoDieta d where d.alunoId = :aluno")
    long dietasDoAluno(UUID aluno);

    @Query("select count(m) from PlanoMobilidade m where m.alunoId = :aluno")
    long mobilidadesDoAluno(UUID aluno);

    @Query("select count(r) from RegistroPeso r where r.alunoId = :aluno")
    long pesosDoAluno(UUID aluno);

    @Query("select distinct e.exercicioId from ExecucaoSerie e where e.exercicioId in :ids")
    List<UUID> exerciciosComExecucao(Collection<UUID> ids);

    @Query("select i.exercicioId from ExercicioImagem i where i.exercicioId in :ids")
    List<UUID> exerciciosComImagem(Collection<UUID> ids);

    /** Conteúdos (JSON) onde um exercício pode aparecer: rascunhos de treino, versões publicadas e modelos. */
    @Query("select p.rascunho from PlanoTreino p")
    List<String> rascunhosDeTreino();

    @Query("select v.conteudo from PlanoTreinoVersao v")
    List<String> versoesDeTreino();

    @Query("select r.conteudo from Receita r")
    List<String> modelos();
}
