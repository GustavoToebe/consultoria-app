package br.com.treinos.api.conta;

import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.auth.Papel;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.equipe.UsuarioConviteRepository;
import br.com.treinos.api.tenant.TenantContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.LongSupplier;
import java.util.stream.Collectors;

/**
 * Aplica o plano da Central (limites e funcionalidades de {@code direitos_locais}) a quem cria algo novo. Regras:
 * <ul>
 *   <li>chave {@code TREINOS_PLANO_APLICAR} desligada (padrão) ou consultoria sem linha em {@code direitos_locais}
 *       (integração desligada, demo): nada é barrado;</li>
 *   <li>limite ausente = sem limite (nunca zero); funcionalidade fora da lista = desligada;</li>
 *   <li>só bloqueia o que é novo: nada é apagado nem desativado quando o plano cai;</li>
 *   <li>os direitos são lidos do banco a cada operação, nunca do token; a consultoria vem do {@link TenantContext}.</li>
 * </ul>
 * A contagem de alunos ativos e de membros é a mesma da Minha conta ({@link ContaService#consumo()}).
 */
@Service
public class PlanoDaConsultoria {

    private final boolean aplicar;
    private final ContaLocalRepositorio contas;
    private final AlunoRepository alunos;
    private final UsuarioRepository usuarios;
    private final UsuarioConviteRepository convites;
    private final ConsultoriaRepository consultorias;

    public PlanoDaConsultoria(@Value("${treinos.plano.aplicar:false}") boolean aplicar, ContaLocalRepositorio contas,
                              AlunoRepository alunos, UsuarioRepository usuarios, UsuarioConviteRepository convites,
                              ConsultoriaRepository consultorias) {
        this.aplicar = aplicar;
        this.contas = contas;
        this.alunos = alunos;
        this.usuarios = usuarios;
        this.convites = convites;
        this.consultorias = consultorias;
    }

    public boolean aplicando() {
        return aplicar;
    }

    /** Alunos ativos da consultoria da sessão ({@code @TenantId}). */
    public long alunosAtivos() {
        return alunos.countByAtivoTrue();
    }

    /**
     * Vagas de aluno ativo ainda livres. {@code null} = sem limite (chave desligada, consultoria sem direitos ou limite
     * ausente). A importação reserva uma vaga por linha nova ativa nesta conta, e na gravação chama
     * {@link #exigirVagaDeAluno()} de novo.
     */
    public Long vagasDeAluno() {
        Long limite = limiteAplicado(RecursosDoApp.LIMITE_ALUNOS_ATIVOS);
        if (limite == null) {
            return null;
        }
        return Math.max(0, limite - alunosAtivos());
    }

    /** Treinadores ativos mais convites ainda válidos. */
    public long membrosDaEquipe(UUID consultoria) {
        return usuarios.countByConsultoriaIdAndPapelAndAtivoTrue(consultoria, Papel.TREINADOR)
                + convites.countByUsadoEmIsNullAndExpiraEmAfter(Instant.now());
    }

    /** Antes de cadastrar ou reativar um aluno. Dentro da transação da operação. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void exigirVagaDeAluno() {
        exigirVaga(RecursosDoApp.LIMITE_ALUNOS_ATIVOS, this::alunosAtivos,
                limite -> "Seu plano permite até " + limite + (limite == 1 ? " aluno ativo." : " alunos ativos."));
    }

    /** Antes de convidar ou reativar um membro. Dentro da transação da operação. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void exigirVagaDeMembro() {
        UUID consultoria = TenantContext.get();
        exigirVaga(RecursosDoApp.LIMITE_MEMBROS_EQUIPE, () -> membrosDaEquipe(consultoria),
                limite -> "Seu plano permite até " + limite + (limite == 1 ? " membro" : " membros")
                        + " na equipe, contando os convites pendentes.");
    }

    private void exigirVaga(String recurso, LongSupplier usado, java.util.function.LongFunction<String> mensagem) {
        Long limite = limiteAplicado(recurso);
        if (limite == null) {
            return;
        }
        // Serializa quem cria na mesma consultoria (a mesma trava da equipe): duas criações simultâneas não passam do limite.
        consultorias.travar(TenantContext.get());
        if (usado.getAsLong() >= limite) {
            throw PlanoException.limite(recurso, mensagem.apply(limite));
        }
    }

    private Long limiteAplicado(String recurso) {
        return direitosAplicados().map(d -> d.limites().get(recurso)).orElse(null);
    }

    /** 403 {@code FUNCIONALIDADE_FORA_DO_PLANO} se o plano da consultoria da sessão não inclui a funcionalidade. */
    public void exigirFuncionalidade(String codigo) {
        if (!funcionalidadeLiberada(codigo)) {
            throw PlanoException.funcionalidade(codigo);
        }
    }

    public boolean funcionalidadeLiberada(String codigo) {
        return direitosAplicados().map(d -> ligadas(d).contains(codigo.toUpperCase(Locale.ROOT))).orElse(true);
    }

    /** Funcionalidades ligadas da consultoria dada (para o app esconder o resto); sem plano aplicado, todas. */
    public List<String> funcionalidadesLiberadas(UUID consultoria) {
        if (!aplicar) {
            return RecursosDoApp.FUNCIONALIDADES;
        }
        return contas.direitos(consultoria).map(d -> {
            Set<String> ligadas = ligadas(d);
            return RecursosDoApp.FUNCIONALIDADES.stream().filter(ligadas::contains).toList();
        }).orElse(RecursosDoApp.FUNCIONALIDADES);
    }

    private static Set<String> ligadas(DireitosLocais d) {
        return d.funcionalidades().stream().map(f -> f.toUpperCase(Locale.ROOT)).collect(Collectors.toSet());
    }

    private Optional<DireitosLocais> direitosAplicados() {
        UUID consultoria = TenantContext.get();
        if (!aplicar || consultoria == null) {
            return Optional.empty();
        }
        return contas.direitos(consultoria);
    }
}
