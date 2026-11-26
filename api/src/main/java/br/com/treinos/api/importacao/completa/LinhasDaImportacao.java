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

    /**
     * Qualquer outra tabela que aponta para o aluno (V092 responsável financeiro, V093 tags, V097 WhatsApp, conquistas, avisos,
     * trocas vistas e as demais). As de {@code ON DELETE CASCADE} sumiriam junto com o aluno e as outras o banco já recusa;
     * conferir aqui dá o motivo certo em vez de depender da recusa. Fica de fora o que o "Desfazer" já conta acima
     * (execução, compromisso, pastas, planos e pesos). A inscrição entra pelas duas ligações (a do aceite e a de quem indicou).
     */
    @Query("""
            select case when (
                    exists (select 1 from ResponsavelFinanceiro x where x.alunoId = :aluno)
                    or exists (select 1 from AlunoTag x where x.alunoId = :aluno)
                    or exists (select 1 from WhatsAppEnvio x where x.alunoId = :aluno)
                    or exists (select 1 from ConquistaAluno x where x.alunoId = :aluno)
                    or exists (select 1 from AvisoCompromisso x where x.alunoId = :aluno)
                    or exists (select 1 from TrocaExercicioVisto x where x.alunoId = :aluno)
                    or exists (select 1 from Atualizacao x where x.alunoId = :aluno)
                    or exists (select 1 from AtualizacaoFoto x where x.alunoId = :aluno)
                    or exists (select 1 from FotoPerfil x where x.alunoId = :aluno)
                    or exists (select 1 from Anamnese x where x.alunoId = :aluno)
                    or exists (select 1 from AnamnesePendencia x where x.alunoId = :aluno)
                    or exists (select 1 from AvaliacaoFisica x where x.alunoId = :aluno)
                    or exists (select 1 from LesaoAluno x where x.alunoId = :aluno)
                    or exists (select 1 from AguaDoDia x where x.alunoId = :aluno)
                    or exists (select 1 from CicloDia x where x.alunoId = :aluno)
                    or exists (select 1 from CicloRegistro x where x.alunoId = :aluno)
                    or exists (select 1 from MobilidadeRegistro x where x.alunoId = :aluno)
                    or exists (select 1 from SessaoConcluida x where x.alunoId = :aluno)
                    or exists (select 1 from SessaoConcluidaVisto x where x.alunoId = :aluno)
                    or exists (select 1 from ContratacaoAluno x where x.alunoId = :aluno)
                    or exists (select 1 from CobrancaAluno x where x.alunoId = :aluno)
                    or exists (select 1 from AcordoDeCobranca x where x.alunoId = :aluno)
                    or exists (select 1 from Inscricao i where i.alunoId = :aluno or i.indicadoPorAlunoId = :aluno)
                ) then true else false end
            from Aluno a where a.id = :aluno""")
    boolean alunoTemOutraLigacao(UUID aluno);

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
