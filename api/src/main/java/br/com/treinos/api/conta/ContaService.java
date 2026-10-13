package br.com.treinos.api.conta;

import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.auth.Papel;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.conta.ConsumoPlanoDto.Item;
import br.com.treinos.api.equipe.UsuarioConviteRepository;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.ProibidoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Minha conta e consumo do plano da consultoria da requisição. Só leitura; não bloqueia nada nem entra na auditoria.
 * A consultoria vem do {@link TenantContext} (preenchido do banco), nunca do corpo ou de parâmetro.
 */
@Service
public class ContaService {

    private final FonteDaConta fonte;
    private final ContaLocalRepositorio contas;
    private final AlunoRepository alunos;
    private final UsuarioRepository usuarios;
    private final UsuarioConviteRepository convites;

    public ContaService(FonteDaConta fonte, ContaLocalRepositorio contas, AlunoRepository alunos,
                        UsuarioRepository usuarios, UsuarioConviteRepository convites) {
        this.fonte = fonte;
        this.contas = contas;
        this.alunos = alunos;
        this.usuarios = usuarios;
        this.convites = convites;
    }

    /**
     * Sem transação de propósito: com a integração ligada a fonte faz HTTP à Central (até 15 s) e não pode segurar uma
     * conexão do pool nesse tempo. A fonte local lê com {@code JdbcTemplate}, cada consulta numa conexão curta; não há gravação.
     */
    public MinhaContaResposta minhaConta() {
        return fonte.minhaConta(consultoria()).map(dto -> MinhaContaResposta.de(dto, fonte.previa()))
                .orElseThrow(ContaNaoEncontradaException::new);
    }

    /** Uso real contado agora, na consultoria da sessão, contra os limites de {@code direitos_locais}. */
    @Transactional(readOnly = true)
    public ConsumoPlanoDto consumo() {
        UUID consultoria = consultoria();
        DireitosLocais direitos = contas.direitos(consultoria).orElse(null);
        Map<String, Long> limites = direitos == null ? Map.of() : direitos.limites();
        long membros = usuarios.countByConsultoriaIdAndPapelAndAtivoTrue(consultoria, Papel.TREINADOR)
                + convites.countByUsadoEmIsNullAndExpiraEmAfter(Instant.now());
        List<Item> itens = List.of(
                item(RecursosDoApp.LIMITE_ALUNOS_ATIVOS, "Alunos ativos", alunos.countByAtivoTrue(), limites),
                item(RecursosDoApp.LIMITE_MEMBROS_EQUIPE, "Membros da equipe", membros, limites));
        return new ConsumoPlanoDto(direitos == null ? null : direitos.planoNome(),
                direitos == null ? null : direitos.versao(), direitos == null ? null : direitos.confirmadoEm(),
                Instant.now(), itens);
    }

    private static Item item(String codigo, String nome, long usado, Map<String, Long> limites) {
        Long limite = limites.get(codigo);
        return new Item(codigo, nome, usado, limite, limite == null ? null : Math.max(0, limite - usado), "unidade",
                EstadoDoConsumo.de(usado, limite));
    }

    private static UUID consultoria() {
        UUID id = TenantContext.get();
        if (id == null) {
            throw new ProibidoException("Sem consultoria na sessão.");
        }
        return id;
    }
}
