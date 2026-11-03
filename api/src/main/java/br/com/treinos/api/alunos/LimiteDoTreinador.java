package br.com.treinos.api.alunos;

import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * O limite de alunos por membro da equipe (supervisão da equipe, D2 a D15): o único ponto que confere se um membro pode
 * <b>receber</b> alunos ativos como responsável. Conta só alunos ativos e não anonimizados com ele como responsável (D6); quem
 * já passou do limite não perde ninguém (D4) e só o membro que recebe é conferido (D8): quem chama decide se há "novo" (D15).
 *
 * <p>Independente do limite do plano ({@code LIMITE_DO_PLANO}) e de {@code treinos.plano.aplicar}. A recusa é 409
 * {@link #CODIGO}, sem nome nem id de ninguém (D10). A conferência trava a consultoria antes de contar (D9: consultoria,
 * inscrição, alunos), então duas operações disputando a última vaga ficam em série e a segunda já vê o aluno da primeira.
 */
@Service
public class LimiteDoTreinador {

    public static final String CODIGO = "LIMITE_DO_TREINADOR";
    public static final String MENSAGEM = "Este responsável já atingiu o limite de alunos. Escolha outro responsável.";

    private final UsuarioRepository usuarios;
    private final AlunoRepository alunos;
    private final ConsultoriaRepository consultorias;

    public LimiteDoTreinador(UsuarioRepository usuarios, AlunoRepository alunos, ConsultoriaRepository consultorias) {
        this.usuarios = usuarios;
        this.alunos = alunos;
        this.consultorias = consultorias;
    }

    /**
     * 409 se o membro não comporta mais {@code novos} alunos ativos. Dentro da transação da operação: a recusa a desfaz inteira.
     * {@code exceto} = aluno que a operação está mexendo e que já pode estar gravado com o membro (nulo = nenhum).
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void exigirVaga(UUID membroId, long novos, UUID exceto) {
        if (membroId == null || novos <= 0) {
            return;
        }
        // Trava sempre, mesmo sem limite: ler o limite antes da trava deixa a troca de limite (que trava a consultoria) passar
        // entre a leitura e a gravação do aluno. O custo é a fila da consultoria: toda criação, troca de responsável e reativação
        // com membro de destino passa a travá-la (D9); editar mantendo o responsável não passa por aqui.
        consultorias.travar(TenantContext.get());
        Integer limite = limiteDe(membroId);
        if (limite == null) {
            return;
        }
        if (alunos.contarAtivosDoResponsavel(membroId, exceto) + novos > limite) {
            throw new ConflictException(MENSAGEM, CODIGO);
        }
    }

    /**
     * Quantos alunos ativos o membro ainda comporta; {@code null} = sem limite. Só lê, sem recusar nem travar: para as importações,
     * que deixam a linha de fora em vez de falhar, e que já travam a consultoria na confirmação. <b>Pode ser negativo</b> (membro
     * acima do limite, D4): quem desconta o que as linhas anteriores mudariam (a prévia) precisa do valor sem corte.
     */
    public Long vagas(UUID membroId, UUID exceto) {
        Integer limite = membroId == null ? null : limiteDe(membroId);
        if (limite == null) {
            return null;
        }
        return limite - alunos.contarAtivosDoResponsavel(membroId, exceto);
    }

    private Integer limiteDe(UUID membroId) {
        return usuarios.limiteDeAlunos(membroId, TenantContext.get()).orElse(null);
    }
}
