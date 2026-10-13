package br.com.treinos.api.integracao;

import br.com.treinos.api.conta.ContaLocalRepositorio;
import br.com.treinos.api.conta.DireitosLocais;
import br.com.treinos.api.conta.RecursosDoApp;
import br.com.treinos.api.receitas.ReceitaService;
import br.com.treinos.api.tenant.TenantContext;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Casos de uso de {@code /integracao/v1} que o controller chama (controller não fala com repositório). */
@Service
public class InstanciaService {

    public record Recurso(String codigo, String nome, String tipo, String unidade, boolean aplicado) { }

    private final ProvisionamentoService provisionamento;
    private final DireitosService direitos;
    private final IntegracaoRepositorio repositorio;
    private final ContaLocalRepositorio contas;
    private final AcessoPorDireitos acesso;
    private final ReceitaService receitas;

    public InstanciaService(ProvisionamentoService provisionamento, DireitosService direitos,
                            IntegracaoRepositorio repositorio, ContaLocalRepositorio contas, AcessoPorDireitos acesso,
                            ReceitaService receitas) {
        this.provisionamento = provisionamento;
        this.direitos = direitos;
        this.repositorio = repositorio;
        this.contas = contas;
        this.acesso = acesso;
        this.receitas = receitas;
    }

    /**
     * Sem {@code @Transactional}: a transação é do {@link ProvisionamentoService}. Duas chamadas simultâneas com a mesma
     * chave esbarram na restrição única; a perdedora tem a transação desfeita e roda de novo, já encontrando a
     * operação gravada (replay, ou 409 se o corpo difere).
     */
    public ProvisionamentoService.Resultado provisionar(UUID chave, String hashCorpo, ProvisionarRequest r) {
        try {
            return comReceitasPadrao(provisionamento.provisionar(chave, hashCorpo, r));
        } catch (DataIntegrityViolationException corrida) {
            return comReceitasPadrao(provisionamento.provisionar(chave, hashCorpo, r));
        }
    }

    /**
     * A consultoria criada pela Central nasce com as mesmas receitas do cadastro (inclusive a metodologia que todo plano
     * recebe). Depois do commit do provisionamento, em transação própria dentro do tenant: o Hibernate lê o tenant ao
     * abrir a sessão, e a que gravou a consultoria abriu sem ele.
     */
    private ProvisionamentoService.Resultado comReceitasPadrao(ProvisionamentoService.Resultado resultado) {
        if (resultado.consultoriaNova() != null) {
            TenantContext.executarComo(resultado.consultoriaNova(), () -> {
                receitas.criarPadrao();
                return null;
            });
        }
        return resultado;
    }

    public ProvisionamentoService.ConviteEmitido reemitirConvite(UUID consultoriaId) {
        return provisionamento.reemitirConviteDoAdministrador(consultoriaId);
    }

    public DireitosService.Resultado aplicarDireitos(UUID consultoriaId, DireitosInstancia d) {
        return direitos.aplicar(consultoriaId, d);
    }

    /** Conciliação (contrato 5.2): só contagens, nada de dado pessoal. */
    @Transactional(readOnly = true)
    public Map<String, Object> consultar(UUID consultoriaId) {
        var consultoria = repositorio.consultoria(consultoriaId).orElseThrow(IntegracaoException::instanciaNaoEncontrada);
        DireitosLocais d = contas.direitos(consultoriaId).orElseThrow(IntegracaoException::instanciaNaoEncontrada);
        Map<String, Object> uso = new LinkedHashMap<>();
        uso.put(RecursosDoApp.LIMITE_ALUNOS_ATIVOS, repositorio.alunosAtivos(consultoriaId));
        uso.put(RecursosDoApp.LIMITE_MEMBROS_EQUIPE, repositorio.membrosDaEquipe(consultoriaId));
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("tenantId", consultoriaId);
        corpo.put("contratacaoId", d.contratacaoId());
        corpo.put("nome", consultoria.nome());
        corpo.put("slug", consultoria.slug());
        corpo.put("versaoDireitos", d.versao());
        corpo.put("confirmadoEm", d.confirmadoEm());
        corpo.put("acessoEfetivo", acesso.acessoEfetivo(consultoriaId));
        corpo.put("uso", uso);
        return corpo;
    }

    /** Catálogo (contrato 5.5). Nenhum limite é aplicado ainda: o consumo só informa, então {@code aplicado=false}. */
    public List<Recurso> recursos() {
        return List.of(
                new Recurso(RecursosDoApp.LIMITE_ALUNOS_ATIVOS, "Alunos ativos", "LIMITE", "aluno", false),
                new Recurso(RecursosDoApp.LIMITE_MEMBROS_EQUIPE, "Membros da equipe", "LIMITE", "pessoa", false),
                new Recurso(RecursosDoApp.FUNCIONALIDADE_CHECKIN, "Check-in", "FUNCIONALIDADE", null, false),
                new Recurso(RecursosDoApp.FUNCIONALIDADE_MOBILIDADE, "Mobilidade", "FUNCIONALIDADE", null, false),
                new Recurso(RecursosDoApp.FUNCIONALIDADE_PDF, "PDF", "FUNCIONALIDADE", null, false),
                new Recurso(RecursosDoApp.FUNCIONALIDADE_EQUIPE, "Equipe", "FUNCIONALIDADE", null, false));
    }

    public Map<String, Object> saude(String produto) {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("status", "UP");
        corpo.put("produto", produto);
        corpo.put("versaoContrato", 1);
        corpo.put("horario", Instant.now());
        return corpo;
    }
}
